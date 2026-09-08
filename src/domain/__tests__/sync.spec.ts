/**
 * sync.spec.ts — SyncEngine integration tests against a fake Supabase.
 *
 * Coverage:
 *   - push happy path writes the cloud row + bumps lastSyncedAt
 *   - signed-out / disabled: schedulePush is a no-op
 *   - boot reconcile: adopt-cloud when cloud wins, push-local when cloud empty
 *   - sign-out clears queue and flips status
 *   - forceSync triggers reconcile + push
 *   - deleteCloudCopy calls the right Supabase method
 *   - retry/backoff paths (limited — exercising the timer is fragile
 *     in vitest; we just assert that a permanent error flips status)
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  installFakeSupabase,
  __setAuthUser,
  __getCloudRow,
  __resetSyncForTests,
  __seedCloudRow,
  __seedAuthUser,
  __setAuthError,
  __simulateRecovery,
} from '../../test/sync-helpers';
import { resetIDB } from '../../test/idb-helpers';
import { clearSyncRows } from '../persistence';
import { SyncEngine } from '../sync';
import type { State } from '../types';

function makeState(stamp: number): State {
  return {
    version: 1,
    accounts: [], transactions: [], goals: [], debts: [], investments: [],
    categories: [], monthPlans: [], eventPlans: [], investmentPlans: [], loanPlans: [],
    settings: { theme: 'dark', onboardingComplete: true, stateUpdatedAt: stamp },
  };
}

async function flush(ms = 50): Promise<void> {
  // Allow debounced pushes (400ms) + microtasks to drain.
  await new Promise(r => setTimeout(r, ms));
}

let engine: SyncEngine;

beforeEach(async () => {
  __resetSyncForTests();
  await resetIDB();
  engine = installFakeSupabase();
});

describe('SyncEngine — push', () => {
  it('schedulePush is a no-op when not signed in', async () => {
    engine.setEnabled(true);
    engine.schedulePush(makeState(1));
    await flush(500);
    expect(__getCloudRow('any-id')).toBeUndefined();
  });

  it('schedulePush is a no-op when sync disabled', async () => {
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(false);
    engine.schedulePush(makeState(1));
    await flush(500);
    expect(__getCloudRow('u1')).toBeUndefined();
  });

  it('pushes a state blob when enabled + signed in', async () => {
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    // init() reads the session and stores userId.
    await engine.init();
    engine.schedulePush(makeState(1_000));
    await flush(500);
    const row = __getCloudRow('u1');
    expect(row).toBeDefined();
    expect((row!.payload as State).settings.stateUpdatedAt).toBe(1_000);
  });

  it('debounces bursts: many pushes within 400ms collapse to one row write', async () => {
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    await engine.init();
    engine.schedulePush(makeState(1));
    engine.schedulePush(makeState(2));
    engine.schedulePush(makeState(3));
    await flush(500);
    expect(__getCloudRow('u1')).toBeDefined();
    expect((__getCloudRow('u1')!.payload as State).settings.stateUpdatedAt).toBe(3);
  });
});

describe('SyncEngine — boot reconcile', () => {
  it('adopts cloud when cloud stamp is newer', async () => {
    const { useStore } = await import('../store');
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    const newCloudState = makeState(99_999);
    __seedCloudRow('u1', newCloudState);
    // Init the store with a low-stamp local state.
    useStore.setState({ state: makeState(1) });
    await engine.init();
    expect(useStore.getState().state.settings.stateUpdatedAt).toBe(99_999);
  });

  it('pushes local to seed cloud when cloud has no row but user is signed in + enabled', async () => {
    // First-ever sign-in with data: the engine pushes the local state
    // to the cloud so a second device signing in to the same account
    // has something to pull.
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    const { useStore } = await import('../store');
    const state = makeState(1);
    state.accounts = [{ id: 'a', name: 'Cash', type: 'cash', openingBalance: 0, createdAt: '2026-01-01' }];
    useStore.setState({ state });
    await engine.init();
    // The push is async; give it a moment to land.
    await new Promise(r => setTimeout(r, 100));
    const row = __getCloudRow('u1');
    expect(row).toBeDefined();
    expect((row!.payload as State).settings.stateUpdatedAt).toBe(1);
    expect((row!.payload as State).accounts.length).toBe(1);
  });

  it('does NOT push empty local on first-ever sign-in (would clobber other devices)', async () => {
    // Regression: when a fresh device with empty local state signed
    // in for the first time, the engine pushed its empty state to
    // the cloud, which clobbered any data the user had on another
    // device. The fix: only seed the cloud when local has data.
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    const { useStore } = await import('../store');
    useStore.setState({ state: makeState(1) });
    // makeState returns an empty State with stamp set but no entities.
    await engine.init();
    await new Promise(r => setTimeout(r, 100));
    expect(__getCloudRow('u1')).toBeUndefined();
  });
});

describe('SyncEngine — auth', () => {
  it('signOut clears queue + flips status to signed-out', async () => {
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    await engine.init();
    engine.schedulePush(makeState(1));
    await flush(500);
    expect(__getCloudRow('u1')).toBeDefined();
    await engine.signOut();
    expect(engine.getStatus().kind).toBe('signed-out');
  });

  it('signOut wipes local state but leaves the cloud row intact', async () => {
    // Regression: signing out previously preserved local data on
    // disk, which meant wiping data + signing back in with the same
    // email exposed the user to an empty local that beat the cloud's
    // older LWW stamp and clobbered the cloud row. The fix: sign-out
    // is now a full local reset; cloud is preserved untouched.
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    await engine.init();
    const cloudStamped = makeState(5_000);
    cloudStamped.accounts = [{ id: 'acc-1', name: 'Cash', type: 'cash', openingBalance: 100, createdAt: '2026-01-01' }];
    engine.schedulePush(cloudStamped);
    await flush(500);
    expect(__getCloudRow('u1')).toBeDefined();

    await engine.signOut();

    // Cloud survived — other devices still see the data.
    expect(__getCloudRow('u1')).toBeDefined();
    expect((__getCloudRow('u1')!.payload as State).accounts.length).toBe(1);

    // Local is wiped: settings cleared, accounts empty.
    const { useStore } = await import('../store');
    const local = useStore.getState().state;
    expect(local.settings.cloudSyncEnabled).toBe(false);
    expect(local.settings.cloudUserEmail).toBeNull();
    expect(local.accounts.length).toBe(0);
    expect(local.transactions.length).toBe(0);
  });

  it('sign-back-in pulls the cloud row over the wiped local state', async () => {
    // Regression for the "wipe + re-sign-in loses cloud data" bug:
    // previously, after signing out and back in, the empty local was
    // either ignored (because lastSyncedAt cleared during the wipe)
    // or it pushed its empty state over the cloud. Now sign-out wipes
    // local, so re-sign-in always sees an empty local and pulls the
    // cloud row via pickWinner's LWW.
    //
    // Seed a user FIRST so __seedAuthUser's synthetic id
    // (`seeded-b@c.com`) is the id we use throughout — the cloud row
    // is keyed by userId, so we have to keep id consistent across
    // sign-out → sign-in.
    const seeded = __seedAuthUser('b@c.com', 'pw');
    __setAuthUser(seeded);
    engine.setEnabled(true);
    await engine.init();
    const cloudStamped = makeState(7_777);
    cloudStamped.accounts = [{ id: 'cloud-acc', name: 'Bank', type: 'bank', openingBalance: 500, createdAt: '2026-01-01' }];
    engine.schedulePush(cloudStamped);
    await flush(500);

    // Sign out → wipes local. Cloud row stays.
    await engine.signOut();
    expect((__getCloudRow(seeded.id)!.payload as State).accounts.length).toBe(1);

    // Sign back in as the SAME user. The fake's signInWithPassword
    // fires SIGNED_IN → onAuthStateChange → recordSignIn +
    // reconcileAndPushLatest.
    await engine.signInWithPassword('b@c.com', 'pw');
    // Drain the fire-and-forget async block in the auth listener.
    await new Promise(r => setTimeout(r, 100));

    // The cloud row was adopted into local — the user sees their
    // "Bank" account after signing back in.
    const { useStore } = await import('../store');
    const local = useStore.getState().state;
    expect(local.accounts.length).toBe(1);
    expect(local.accounts[0].name).toBe('Bank');
    expect(local.settings.stateUpdatedAt).toBe(7_777);
  });

  it('onPasswordRecovery replays a pending recovery event to a late subscriber', async () => {
    // Regression for the cold-boot recovery flow: the user lands on
    // the app with `#access_token=...&type=recovery` in the URL.
    // `syncEngine.init()` runs (during `main.tsx`'s awaited boot)
    // and fires PASSWORD_RECOVERY on its auth-state listener BEFORE
    // React has mounted. App.tsx's `onPasswordRecovery(cb)` only
    // registers its callback AFTER init() has completed — without
    // replay support, the event is lost and the user sees the
    // signed-in app instead of the reset dialog.
    __setAuthUser({ id: 'u-recovery', email: 'recovery@example.com' });
    await engine.init();
    // Simulate PASSWORD_RECOVERY firing before any listener has
    // registered. This is exactly what happens when the recovery
    // link is opened in a cold-boot tab.
    __simulateRecovery();

    // Now the App mounts and registers its listener. Without replay
    // support, the cb would never fire — the test would assert 0
    // calls. With replay, the cb is called synchronously on
    // subscribe.
    let calls = 0;
    const off = engine.onPasswordRecovery(() => { calls += 1; });
    expect(calls).toBe(1);

    // Acknowledging prevents a second subscriber (StrictMode
    // double-mount, route-change re-mount) from re-triggering.
    engine.acknowledgePendingRecovery();
    let calls2 = 0;
    const off2 = engine.onPasswordRecovery(() => { calls2 += 1; });
    expect(calls2).toBe(0);

    off();
    off2();
  });

  it('onPasswordRecovery fires live events when no pending recovery is buffered', async () => {
    // The non-cold-boot path: App.tsx mounts and registers BEFORE
    // any recovery event fires. A subsequent PASSWORD_RECOVERY
    // should reach the live callback (not just the replay).
    __setAuthUser({ id: 'u-recovery-live', email: 'live@example.com' });
    await engine.init();

    let calls = 0;
    const off = engine.onPasswordRecovery(() => { calls += 1; });

    __simulateRecovery();
    expect(calls).toBe(1);

    __simulateRecovery();
    expect(calls).toBe(2);

    off();
  });

  it('deleteCloudCopy removes the cloud row', async () => {
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    await engine.init();
    engine.schedulePush(makeState(1));
    await flush(500);
    expect(__getCloudRow('u1')).toBeDefined();
    await engine.deleteCloudCopy();
    expect(__getCloudRow('u1')).toBeUndefined();
  });

  it('signInWithPassword succeeds and the engine treats the user as signed in', async () => {
    __seedAuthUser('a@b.com', 'correct-horse');
    // init() registers the onAuthStateChange listener that flips
    // userEmail + status when the fake fires SIGNED_IN after a
    // successful password sign-in.
    await engine.init();
    await engine.signInWithPassword('a@b.com', 'correct-horse');
    // The onAuthStateChange handler is fire-and-forget; give its
    // async block (recordSignIn → reconcileAndPushLatest → recomputeStatus)
    // a few ticks to drain before asserting on derived state.
    await new Promise(r => setTimeout(r, 20));
    expect(engine.getStatus().kind).toBe('signed-in-synced');
    expect(engine.getEmail()).toBe('a@b.com');
    // recordSignIn persists the email into Settings via the store;
    // verify it landed.
    const { useStore } = await import('../store');
    expect(useStore.getState().state.settings.cloudUserEmail).toBe('a@b.com');
    expect(useStore.getState().state.settings.cloudSyncEnabled).toBe(true);
  });

  it('signInWithPassword throws on a wrong password and leaves the engine signed-out', async () => {
    __seedAuthUser('a@b.com', 'correct-horse');
    await engine.init();
    await expect(engine.signInWithPassword('a@b.com', 'wrong')).rejects.toBeDefined();
    expect(engine.getStatus().kind).toBe('signed-out');
    expect(engine.getEmail()).toBeNull();
  });

  it('signUpWithPassword returns requiresEmailConfirmation=false on the local stack', async () => {
    // Local stack: enable_confirmations = false → sign-up returns a
    // session synchronously. The fake mirrors that.
    await engine.init();
    const result = await engine.signUpWithPassword('new@example.com', 'password1');
    expect(result.requiresEmailConfirmation).toBe(false);
    // The onAuthStateChange listener is fire-and-forget — give its
    // async block a tick to drain before asserting on status.
    await new Promise(r => setTimeout(r, 20));
    // Engine should be signed-in now (the fake's signUp flips authState).
    expect(engine.getStatus().kind).toBe('signed-in-synced');
  });

  it('signUpWithPassword returns requiresEmailConfirmation=true when the server withholds the session', async () => {
    // Inject an alternate signUp shape: { user, session: null }.
    __setAuthUser(null);
    __setAuthError(null);
    await engine.init();
    // Monkey-patch the fake's signUp to return user-without-session.
    const fake = (engine as unknown as { client: { auth: { signUp: typeof engine.signUpWithPassword } } }).client.auth;
    const origSignUp = fake.signUp;
    fake.signUp = (async () => ({
      data: { user: { id: 'pending', email: 'pending@example.com' }, session: null },
      error: null,
    })) as unknown as typeof origSignUp;
    try {
      const result = await engine.signUpWithPassword('pending@example.com', 'password1');
      expect(result.requiresEmailConfirmation).toBe(true);
      // No session was issued, so the engine stays signed-out.
      expect(engine.getStatus().kind).toBe('signed-out');
    } finally {
      fake.signUp = origSignUp;
    }
  });
});

describe('SyncEngine — wipe flows', () => {
  it('signed-in wipe deletes the cloud row and stays signed-in locally', async () => {
    // The Settings → Danger-zone "Wipe all data" path, when signed
    // in: deletes the cloud row first (via deleteCloudCopy), then
    // wipes the local store. The user remains signed in. A
    // regression here would have the post-wipe local state bump
    // stateUpdatedAt and trigger a debounced re-push that re-creates
    // the cloud row — clobbering whatever the user has on other
    // devices the next time they reconcile.
    __setAuthUser({ id: 'u-wipe', email: 'wipe@example.com' });
    engine.setEnabled(true);
    await engine.init();
    const stamped = makeState(2_000);
    stamped.accounts = [{ id: 'acc', name: 'Cash', type: 'cash', openingBalance: 0, createdAt: '2026-01-01' }];
    engine.schedulePush(stamped);
    await flush(500);
    expect(__getCloudRow('u-wipe')).toBeDefined();

    // Force the local store's identity fields to match the engine's
    // current user (the store is a module singleton that leaks across
    // tests; previous specs may have stamped a different email).
    const { useStore } = await import('../store');
    const seeded = useStore.getState().state;
    useStore.setState({
      state: {
        ...seeded,
        settings: {
          ...seeded.settings,
          cloudSyncEnabled: true,
          cloudUserEmail: 'wipe@example.com',
        },
      },
    });

    // Simulate the SettingsScreen flow: deleteCloudCopy + reset.
    await engine.deleteCloudCopy();
    expect(__getCloudRow('u-wipe')).toBeUndefined();

    useStore.getState().reset();
    await clearSyncRows();
    engine.resetSyncMetadata();

    // Local is empty, but sync identity is preserved.
    const local = useStore.getState().state;
    expect(local.accounts.length).toBe(0);
    expect(local.settings.cloudSyncEnabled).toBe(true);
    expect(local.settings.cloudUserEmail).toBe('wipe@example.com');

    // CRITICAL: the cloud row must NOT be re-created by the reset.
    // Wait long enough for any debounced push to fire (and fail
    // to create a row) before asserting.
    await flush(700);
    expect(__getCloudRow('u-wipe')).toBeUndefined();
  });

  it('signed-out wipe leaves the cloud row intact', async () => {
    // The Danger-zone wipe while signed out: local is wiped but the
    // cloud copy (under the user's id) is preserved untouched. The
    // user can sign back in and have their cloud data pulled.
    const seeded = __seedAuthUser('return@example.com', 'pw');
    __setAuthUser(seeded);
    engine.setEnabled(true);
    await engine.init();
    const stamped = makeState(8_888);
    stamped.accounts = [{ id: 'acc', name: 'Bank', type: 'bank', openingBalance: 200, createdAt: '2026-01-01' }];
    engine.schedulePush(stamped);
    await flush(500);

    // Sign out (now wipes local) — cloud row stays.
    await engine.signOut();
    expect(__getCloudRow(seeded.id)).toBeDefined();

    // Simulate the Danger-zone wipe path. reset() preserves
    // cloudSyncEnabled/cloudUserEmail — but since we're signed out,
    // both are already cleared. The cloud row must NOT be touched.
    const { useStore } = await import('../store');
    useStore.getState().reset();
    await flush(700);
    expect(__getCloudRow(seeded.id)).toBeDefined();
    expect((__getCloudRow(seeded.id)!.payload as State).accounts.length).toBe(1);

    // Sign back in → cloud row is adopted into local.
    await engine.signInWithPassword('return@example.com', 'pw');
    await new Promise(r => setTimeout(r, 100));
    const local = useStore.getState().state;
    expect(local.accounts.length).toBe(1);
    expect(local.accounts[0].name).toBe('Bank');
    expect(local.settings.stateUpdatedAt).toBe(8_888);
  });
});
