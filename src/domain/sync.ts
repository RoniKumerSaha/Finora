/**
 * sync.ts — SyncEngine singleton + status hook.
 *
 * Responsibilities:
 *   - Auth session restore on boot + sign-in (magic link) / sign-out.
 *   - Push the local State blob to Supabase when it changes.
 *   - Pull the cloud State blob on boot, reconcile via LWW, mutate
 *     the store if cloud wins.
 *   - Detect online/offline, queue pushes when offline, drain on
 *     `online`.
 *   - Retry transient failures with backoff (1s, 3s, 9s).
 *   - Expose a `useSyncStatus()` hook for the UI pill / settings page.
 *
 * Public surface used by the rest of the app:
 *   - `syncEngine.init()` — call once from main.tsx after IDB is ready.
 *   - `syncEngine.schedulePush(state)` — call from every store mutation.
 *   - `syncEngine.signIn(email)`, `signOut()`, `deleteCloudCopy()`,
 *     `forceSync()` — called from AccountSection.
 *   - `syncEngine.setEnabled(boolean)` — opt-in toggle.
 *   - `useSyncStatus()` — React hook returning current status.
 *
 * The engine never throws out to the caller — every failure path logs
 * and emits a banner/toast. Local writes always succeed regardless of
 * cloud state.
 */
import { useSyncExternalStore } from 'react';
import { supabase as defaultSupabase, requireSupabase, supabaseEnabled } from '../lib/supabase';
import { captureRecoveryFragment } from '../components/crossTabRecovery';
import { formatSyncError } from '../lib/errors';
import { useLockStore } from '../security/lockStore';
import { recomputeDerived } from './recompute';
import { save as saveLocal } from './persistence';
import {
  CLOUD_LAST_PULLED_KEY,
  CLOUD_LAST_SYNCED_KEY,
  clearSyncRows,
  getSyncRow,
  putSyncRow,
} from './persistence';
import { pickWinner, type CloudRow } from './sync.reconcile';
import * as queue from './sync.queue';
import type { State } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Status enum + hook ────────────────────────────────────────────────

export type SyncStatus =
  | { kind: 'signed-out' }
  | { kind: 'signed-in-synced'; lastSyncedAt: number | null; email: string | null }
  | { kind: 'signed-in-syncing'; email: string | null }
  | { kind: 'signed-in-offline-queued'; pending: number; email: string | null }
  | { kind: 'signed-in-error'; lastError: string; lastSyncedAt: number | null; email: string | null }
  | { kind: 'unconfigured' };

/** Tag every reason "Why no push?" so the UI can show the right hint. */
export type BlockReason = 'signed-out' | 'sync-disabled' | 'locked' | 'offline' | 'unconfigured';

// ─── SyncEngine ────────────────────────────────────────────────────────

const DEBOUNCE_MS = 400;
const RETRY_BACKOFF_MS = [1000, 3000, 9000];
const QUEUE_FLUSH_RETRY_MS = 5000;

interface Listeners { (status: SyncStatus): void }

/**
 * Tiny pub/sub for status changes. Components subscribe via the
 * useSyncStatus hook; the engine calls `setStatus` on every transition.
 */
class StatusBus {
  private current: SyncStatus = { kind: 'signed-out' };
  private listeners = new Set<Listeners>();

  get = (): SyncStatus => this.current;
  set = (next: SyncStatus) => {
    this.current = next;
    for (const l of this.listeners) l(next);
  };
  subscribe = (l: Listeners) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };
}

/**
 * The SyncEngine is a module-singleton class. Tests inject a fake
 * Supabase client via `installFakeSupabase` from
 * `src/test/sync-helpers.ts`. Production callers use the constructor
 * with no args; the singleton lives at `syncEngine` below.
 */
export class SyncEngine {
  private bus = new StatusBus();
  private client: SupabaseClient | null;
  private userEmail: string | null = null;
  private userId: string | null = null;
  private enabled = false;
  private pendingPush: { state: State; handle: number } | null = null;
  private queueDrainTimer: number | null = null;
  private lastError: string | null = null;
  private lastSyncedAt: number | null = null;
  private inited = false;
  // Subscribers fired when supabase-js emits `PASSWORD_RECOVERY`
  // (user clicked the recovery link in their email and landed back
  // on the app). Listed on top of the single onAuthStateChange
  // listener registered in init() — see that block.
  private recoveryListeners = new Set<() => void>();
  // Set to true when PASSWORD_RECOVERY fires while no listeners are
  // registered yet. This happens on the cold-boot recovery flow: the
  // user lands on the app with `#access_token=...&type=recovery` in
  // the URL, `syncEngine.init()` runs inside `main.tsx`'s boot (which
  // awaits React mount), and React mounts the App AFTER init() has
  // already completed — so by the time App.tsx calls
  // `onPasswordRecovery(cb)`, the event has already fired and
  // dispatched to zero listeners. The flag lets newly-registered
  // listeners replay the missed event once on subscription.
  // Cleared by `acknowledgePendingRecovery()` so subsequent
  // re-mounts don't re-open the dialog.
  private pendingRecovery = false;

  constructor(client?: SupabaseClient | null) {
    this.client = client === undefined ? defaultSupabase : client;
  }

  /** Test-only: swap the underlying Supabase client. Used by
   *  `installFakeSupabase()` to replace the real client with an
   *  in-memory mock without changing the singleton's identity
   *  (so `useStore` callbacks still point at this object). */
  __setClientForTests(client: SupabaseClient | null): void {
    this.client = client;
  }

  // ── Status accessors ─────────────────────────────────────────────────

  getStatus = (): SyncStatus => this.bus.get();
  subscribe = (l: Listeners) => this.bus.subscribe(l);

  // ── Boot ─────────────────────────────────────────────────────────────

  /**
   * Boot-time init. Order matters: this must run AFTER `ensureReady()`
   * (IDB primed) and AFTER `useStore.setState({ state: load() })`
   * (store already has the local snapshot). It restores the auth
   * session and, if signed-in + cloud-sync enabled, performs the
   * first reconcile. Safe to call multiple times.
   *
   * **Listener-first ordering.** The auth state-change listener MUST
   * be attached BEFORE `getSession()` (or any other method that
   * triggers `initialize()`). supabase-js buffers notifications fired
   * during the init chain (the recovery flow runs entirely inside
   * `initialize()` → `detectSessionInUrl` → fire PASSWORD_RECOVERY)
   * and flushes them once `initializePromise` resolves. `getSession()`
   * awaits that promise, so by the time it returns the buffer has
   * already been drained. If our listener is attached after
   * `getSession()` we miss the recovery event entirely and the
   * ResetPasswordDialog never opens.
   *
   * **Snapshotting the recovery URL fragment.** `detectSessionInUrl`
   * also clears `window.location.hash` after extracting the tokens
   * (auth-js GoTrueClient.js:3325: `window.location.hash = ''`).
   * The ResetPasswordDialog's cross-tab dedupe needs to know
   * whether THIS tab is the fragment-receiving tab, but by the time
   * the dialog mounts the hash is already gone. We snapshot the
   * fragment here — BEFORE supabase-js clears it — so the dedupe
   * helper can answer correctly.
   */
  async init(): Promise<void> {
    if (this.inited) return;
    this.inited = true;

    // Snapshot the URL fragment before supabase-js wipes it. See the
    // method doc above for why ordering matters. We only do this
    // when the client is actually configured — the no-client branch
    // below returns early and never calls getSession().
    if (this.client && typeof window !== 'undefined') {
      captureRecoveryFragment(window.location.hash);
    }

    // Pull persisted timestamps so the UI shows the right "Last
    // synced" hint before the first push completes.
    const lastSynced = await getSyncRow(CLOUD_LAST_SYNCED_KEY);
    if (typeof lastSynced === 'number') this.lastSyncedAt = lastSynced;

    // Wire online/offline listeners once.
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
    }

    if (!this.client) {
      this.bus.set({ kind: 'unconfigured' });
      return;
    }

    // Attach the auth-state listener FIRST so the PASSWORD_RECOVERY
    // event fired during `initialize()` (called from `getSession()`
    // below) reaches us. See the method doc.
    this.client.auth.onAuthStateChange((event, newSession) => {
      const u = newSession?.user;
      this.userId = u?.id ?? null;
      this.userEmail = u?.email ?? null;
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the recovery link in their email. We don't
        // run reconcileAndPushLatest — the recovery session is
        // short-lived and the user is about to set a new password.
        // Just notify any listeners (App.tsx mounts the
        // ResetPasswordDialog). Don't recomputeStatus either: the
        // recovery session has the same user_id so the engine's
        // signed-in state stays accurate.
        //
        // Set the pending flag so a listener that subscribes AFTER
        // this event fires (the common case on cold-boot — React
        // mounts after `init()` completes) still gets notified.
        this.pendingRecovery = true;
        for (const cb of this.recoveryListeners) cb();
        return;
      }
      if (u) {
        // Sign-in: persist the email, enable the engine, and run
        // the first reconcile. recordSignIn() inside the store does
        // the persistence + stateUpdatedAt bump + syncEngine.setEnabled(true).
        // We only need to handle the engine-side state and the
        // initial pull here.
        void (async () => {
          const { useStore } = await import('./store');
          useStore.getState().recordSignIn(u.email ?? '');
          this.enabled = true;
          await this.reconcileAndPushLatest();
        })();
      } else {
        this.recomputeStatus();
      }
    });

    // Now safe to call getSession() — by the time its `initialize()`
    // completes (including the recovery-fragment extraction that
    // fires PASSWORD_RECOVERY), our listener above is attached.
    const { data } = await this.client.auth.getSession();
    const session = data.session;
    if (session?.user) {
      this.userId = session.user.id;
      this.userEmail = session.user.email ?? null;
      // Don't auto-enable — `enabled` follows the user's Settings
      // toggle, which the store reads separately on first mutation.
      // We just set up identity so we know who we're syncing as.
    }

    // If we're signed in AND enabled, pull from cloud.
    if (this.userId && this.enabled) {
      await this.reconcileAndPushLatest();
    } else {
      this.recomputeStatus();
    }
  }

  // ── Settings-driven toggles ──────────────────────────────────────────

  setEnabled = (on: boolean): void => {
    this.enabled = on;
    if (on && this.userId) {
      void this.reconcileAndPushLatest();
    } else {
      this.recomputeStatus();
    }
  };

  isEnabled = (): boolean => this.enabled;

  // ── Store hook: schedulePush ─────────────────────────────────────────

  /**
   * Called from every store mutation (`run`, `runPlan`, `add*Plan`,
   * `importAndReplace`). Debounces a real push to 400 ms so a burst
   * of edits collapses into one Supabase write. Returns immediately —
   * the caller (a store action) doesn't await anything.
   *
   * No-op when:
   *   - cloud sync is disabled in Settings
   *   - user is not signed in
   *   - Supabase client is not configured
   *   - the PIN lock is engaged (`locked === true`)
   */
  schedulePush(state: State): void {
    if (!this.shouldPush()) return;

    if (this.pendingPush) {
      window.clearTimeout(this.pendingPush.handle);
    }
    this.pendingPush = {
      state,
      handle: window.setTimeout(() => {
        this.pendingPush = null;
        void this.push(state);
      }, DEBOUNCE_MS),
    };
  }

  private shouldPush(): boolean {
    if (!this.enabled) return false;
    if (!this.userId) return false;
    if (!this.client) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // Don't push right now — let the caller continue. The `offline`
      // event handler will drain the queue when connectivity returns.
      return false;
    }
    return true;
  }

  private isLocked(): boolean {
    // Belt-and-braces: the app tree is replaced with <LockScreen />
    // while locked (see main.tsx + App.tsx), so `run`/`runPlan` are
    // unreachable in that state. This guard catches the edge case
    // where a push is already in flight when the user locks the app.
    try {
      return useLockStore.getState().locked;
    } catch {
      return false;
    }
  }

  // ── Push / pull / reconcile ──────────────────────────────────────────

  private async push(state: State): Promise<void> {
    if (this.isLocked()) return;
    if (!this.userId || !this.client) return;

    this.bus.set({ kind: 'signed-in-syncing', email: this.userEmail });

    try {
      const result = await this.tryUpsert(state);
      if (result === 'ok') {
        this.lastError = null;
        this.lastSyncedAt = Date.now();
        putSyncRow(CLOUD_LAST_SYNCED_KEY, this.lastSyncedAt);
        this.recomputeStatus();
      } else if (result === 'queued-offline') {
        await queue.enqueue(state);
        this.recomputeStatus();
      } else if (result === 'retrying') {
        // A retry is in flight; status stays "syncing".
      } else {
        // Permanent failure — bubble to the banner.
        const err = new Error('Sync failed after retries.');
        this.lastError = err.message;
        this.bus.set({
          kind: 'signed-in-error',
          lastError: err.message,
          lastSyncedAt: this.lastSyncedAt,
          email: this.userEmail,
        });
        this.emitBannerFromError(err);
      }
    } catch (err) {
      this.lastError = (err as Error).message || 'Sync failed.';
      this.bus.set({
        kind: 'signed-in-error',
        lastError: this.lastError,
        lastSyncedAt: this.lastSyncedAt,
        email: this.userEmail,
      });
      this.emitBannerFromError(err);
    }
  }

  /**
   * Attempt one upsert with retry. Returns:
   *   'ok'               — upsert succeeded
   *   'queued-offline'   — device went offline, queued for later
   *   'retrying'         — failed but a retry timer is now scheduled
   *   'permanent-fail'   — retries exhausted
   */
  private async tryUpsert(state: State): Promise<'ok' | 'queued-offline' | 'retrying' | 'permanent-fail'> {
    if (!this.client || !this.userId) return 'permanent-fail';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'queued-offline';
    }

    for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt++) {
      try {
        const { error } = await this.client
          .from('finora_state')
          .upsert({
            user_id: this.userId,
            version: state.version,
            payload: state,
          }, { onConflict: 'user_id' });
        if (!error) return 'ok';
        // Non-retryable: RLS / 4xx other than 401/408/429.
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) {
          throw error;
        }
        // Retryable: fall through to backoff.
        if (attempt < RETRY_BACKOFF_MS.length - 1) {
          await sleep(RETRY_BACKOFF_MS[attempt]);
          continue;
        }
        throw error;
      } catch (err) {
        // Network failure → check navigator.onLine; if we just went
        // offline, queue and bail.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return 'queued-offline';
        }
        if (attempt === RETRY_BACKOFF_MS.length - 1) {
          return 'permanent-fail';
        }
        await sleep(RETRY_BACKOFF_MS[attempt]);
      }
    }
    return 'permanent-fail';
  }

  /**
   * Boot pull + reconcile. Reads the cloud row (if any), compares to
   * the current local state via `pickWinner`, and either:
   *   - adopts the cloud state (mutates the store + recomputes + saves
   *     locally, then pushes so the local stamp matches cloud)
   *   - keeps local and pushes to cloud (so the cloud stamp catches up)
   *
   * Safe to call multiple times. Returns the cloud row's payload if
   * adopted; null otherwise.
   */
  async reconcileAndPushLatest(): Promise<void> {
    if (!this.client || !this.userId) {
      this.recomputeStatus();
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.recomputeStatus();
      return;
    }

    let cloud: CloudRow | null = null;
    try {
      const { data, error } = await this.client
        .from('finora_state')
        .select('payload, updated_at')
        .eq('user_id', this.userId)
        .maybeSingle();
      if (!error && data) {
        cloud = {
          payload: data.payload as State,
          updatedAt: new Date(data.updated_at as string).getTime(),
        };
        putSyncRow(CLOUD_LAST_PULLED_KEY, Date.now());
      }
    } catch {
      // Network blip on pull — don't fail the boot. We just keep
      // whatever was loaded into the store already.
      this.recomputeStatus();
      return;
    }

    if (this.lastSyncedAt === null && cloud === null) {
      // First-ever pull with no cloud row. Only push local if local
      // actually has data — otherwise, this is a fresh/empty device
      // racing to seed the cloud, and pushing empty would clobber
      // any data the user has on another device. The first non-empty
      // device to sign in wins; empty devices stay empty until the
      // next pull.
      const { useStore } = await import('./store');
      const local = useStore.getState().state;
      const hasData = local.accounts.length > 0
        || local.transactions.length > 0
        || local.goals.length > 0
        || local.debts.length > 0
        || local.investments.length > 0;
      if (hasData) {
        // Push local so cloud has a baseline for cross-device sync.
        // We push directly rather than going through schedulePush so
        // the initial-seed isn't lost to the 400ms debounce.
        void this.push(local);
      } else {
        // Empty local — don't push. Just compute status and wait for
        // the other device to seed. On the next mutation we'll pull
        // first, then push our delta on top.
        this.recomputeStatus();
      }
      return;
    }

    // Read the current local state by importing the store lazily to
    // break the cycle (sync.ts → store.ts → sync.ts at boot).
    const { useStore } = await import('./store');
    const local = useStore.getState().state;
    const outcome = pickWinner(local, cloud);

    if (outcome.kind === 'adopt-cloud') {
      const adopted = recomputeDerived(outcome.cloud.payload);
      useStore.setState({ state: adopted });
      saveLocal(adopted);
      this.lastSyncedAt = Date.now();
      putSyncRow(CLOUD_LAST_SYNCED_KEY, this.lastSyncedAt);
    } else if (cloud === null && this.userId) {
      // No cloud row — push local ONLY if local has data. An empty
      // local pushing would clobber any data the user has on
      // another device (which is what the user reported). The
      // pickWinner above already chose keep-local for this case,
      // so the user intends to keep what's here.
      const localHasData = local.accounts.length > 0
        || local.transactions.length > 0
        || local.goals.length > 0
        || local.debts.length > 0
        || local.investments.length > 0;
      if (localHasData) {
        void this.push(local);
      }
    }

    this.recomputeStatus();
  }

  // ── Auth ─────────────────────────────────────────────────────────────

  /**
   * Sign in an existing user with email + password. Synchronously
   * establishes a session on success (no email round-trip, no redirect
   * magic to worry about). The thrown `AuthError` carries `status`,
   * `name`, and `message` so `formatSyncError()` can give the user
   * actionable advice without any new error-formatting code.
   */
  async signInWithPassword(email: string, password: string): Promise<void> {
    const client = this.client ?? requireSupabase();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  /**
   * Create a new account. Returns `requiresEmailConfirmation: true`
   * when Supabase created the user but did NOT issue a session (the
   * host project has `enable_confirmations = true`). The dialog uses
   * this to surface a "Check your email to confirm" toast instead of
   * assuming the user is signed in.
   *
   * When `requiresEmailConfirmation` is false, the `onAuthStateChange`
   * callback fires SIGNED_IN synchronously and `recordSignIn` runs as
   * normal — no extra wiring needed here.
   */
  async signUpWithPassword(
    email: string,
    password: string,
  ): Promise<{ requiresEmailConfirmation: boolean }> {
    const client = this.client ?? requireSupabase();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    // Supabase returns { user, session: null } when email confirmation
    // is required, and { user, session: { access_token, ... } } when
    // confirmation is auto-confirmed (the local stack default).
    const requiresEmailConfirmation = !data.session;
    return { requiresEmailConfirmation };
  }

  /**
   * Send a password-recovery email. The link in the email redirects
   * back to `window.location.origin` (the app root) with a
   * `#access_token=...&type=recovery` hash fragment. supabase-js
   * auto-detects the fragment because `detectSessionInUrl: true`
   * (src/lib/supabase.ts:37) and fires `PASSWORD_RECOVERY` on our
   * `onAuthStateChange` listener — App.tsx listens for that via
   * `onPasswordRecovery()` and opens the reset dialog.
   *
   * Throws on Supabase error (rate-limit, invalid email format on
   * server, etc.). Errors flow through `formatSyncError` to the
   * toast layer.
   */
  async resetPasswordForEmail(email: string): Promise<void> {
    const client = this.client ?? requireSupabase();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/',
    });
    if (error) throw error;
  }

  /**
   * Update the password for the currently signed-in user. Called by
   * the ResetPasswordDialog after the user clicks the recovery link
   * and lands back in the app with a short-lived recovery session.
   * The recovery session has `updateUser` privileges scoped to
   * password changes only — it does NOT grant access to other
   * user-mgmt endpoints, which is the right behavior for this flow.
   *
   * Throws on Supabase error. The dialog maps validation-style
   * errors to inline field copy; everything else falls through to
   * the toast layer.
   */
  async updatePassword(newPassword: string): Promise<void> {
    const client = this.client ?? requireSupabase();
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  /**
   * Subscribe to the `PASSWORD_RECOVERY` auth event (the recovery
   * hash fragment was detected on the URL). App.tsx uses this to
   * auto-open the ResetPasswordDialog when the user returns from
   * the emailed link.
   *
   * **Replay-on-subscribe.** On the cold-boot recovery flow, the
   * user lands on the app with `#access_token=...&type=recovery`
   * in the URL, `main.tsx`'s boot awaits `syncEngine.init()` to
   * completion, and React mounts the App AFTER init() has already
   * fired `PASSWORD_RECOVERY` (it runs inside `getSession()` →
   * `initialize()`). If we naively registered the listener then
   * called any existing listeners, there'd be zero listeners and
   * the event would be lost — the user would see the signed-in app
   * instead of the reset dialog.
   *
   * The fix: when `onPasswordRecovery` is called, if a recovery
   * event has already fired (the `pendingRecovery` flag is true),
   * we replay it once via the new subscriber's callback so the
   * dialog opens. The caller is expected to call
   * `acknowledgePendingRecovery()` once it has handled the replay
   * so subsequent re-mounts (StrictMode, route changes that
   * unmount App, etc.) don't re-open the dialog.
   *
   * Returns an unsubscribe.
   */
  onPasswordRecovery(cb: () => void): () => void {
    this.recoveryListeners.add(cb);
    if (this.pendingRecovery) {
      // Replay the missed event synchronously so the dialog opens
      // on the same render cycle that subscribes.
      cb();
    }
    return () => { this.recoveryListeners.delete(cb); };
  }

  /**
   * Clear the `pendingRecovery` flag after the recovery event has
   * been handled (the reset dialog has been opened, or the user has
   * dismissed it, or the URL is no longer a recovery URL). Called
   * by App.tsx once it has decided what to do with the replayed
   * event so subsequent mount/unmount cycles don't re-trigger.
   */
  acknowledgePendingRecovery(): void {
    this.pendingRecovery = false;
  }

  /**
   * Sign the current user out of Supabase and wipe the local store.
   *
   * **Local is always wiped on sign-out (the cloud copy is NOT).**
   * This is deliberate: signing out means "this device no longer
   * belongs to that account." Leaving the local data behind would
   * (a) expose the next person to use this device to the previous
   * owner's accounts/transactions, and (b) trip the reconcile guard
   * on the next sign-in — an empty local with a recent `stateUpdatedAt`
   * would beat the cloud's older stamp via LWW and clobber the cloud
   * row. Wiping local ensures the next sign-in sees the cloud as the
   * source of truth and pulls it via `pickWinner`.
   *
   * `onboardingComplete` is preserved as `true` so the user doesn't
   * get re-onboarded after signing back in (their account is the same
   * one they already onboarded). `cloudSyncEnabled` + `cloudUserEmail`
   * are cleared — those are identity, not preference, and will be
   * re-stamped by `recordSignIn` on the next sign-in.
   */
  async signOut(): Promise<void> {
    if (this.client) {
      await this.client.auth.signOut();
    }
    this.userId = null;
    this.userEmail = null;
    await queue.clearQueue();
    // Local wipe — see the method doc. Mirrors the Settings → Danger
    // zone "Wipe all data" path, but scoped to "I am done being this
    // user on this device" rather than "delete everything I care
    // about". Same machinery, different intent.
    await clearSyncRows();
    // Dynamic import to break the sync.ts → store.ts cycle.
    const { useStore } = await import('./store');
    const { DEFAULT_STATE: defaultState } = await import('./persistence');
    useStore.getState().reset();
    // `reset()` preserves the previous `cloudSyncEnabled` /
    // `cloudUserEmail` (the Danger-zone wipe reuses the same action
    // and the user's sync opt-in should survive a wipe of their
    // data). For sign-out we want the opposite: clear identity so the
    // next sign-in starts from a clean slate. Stamp a clean state on
    // top of the wiped store.
    const wiped = useStore.getState().state;
    const signedOut: State = {
      ...defaultState,
      settings: {
        ...wiped.settings,
        cloudSyncEnabled: false,
        cloudUserEmail: null,
      },
    };
    useStore.setState({ state: signedOut });
    saveLocal(signedOut);
    // Drop the engine's in-memory sync metadata so the next sign-in's
    // reconcile treats this device as fresh (the cloud copy will
    // overwrite the wiped local via pickWinner's LWW).
    this.resetSyncMetadata();
    this.recomputeStatus();
  }

  /**
   * Authoritative cloud-side delete. Used by the "Delete cloud copy"
   * Danger-zone button. Local data is NOT touched.
   */
  async deleteCloudCopy(): Promise<void> {
    if (!this.client || !this.userId) return;
    const { error } = await this.client
      .from('finora_state')
      .delete()
      .eq('user_id', this.userId);
    if (error) throw error;
    this.lastSyncedAt = null;
    putSyncRow(CLOUD_LAST_SYNCED_KEY, null);
    this.recomputeStatus();
  }

  /** Explicit "Force sync now" — pull + push. */
  async forceSync(): Promise<void> {
    if (!this.userId) return;
    await this.reconcileAndPushLatest();
    // Then push local ONLY if local has data — otherwise an empty
    // local would clobber any cloud row pulled in above (or push
    // empty when cloud is also empty). Mirrors the hasData guard in
    // reconcileAndPushLatest.
    const { useStore } = await import('./store');
    const local = useStore.getState().state;
    const localHasData = local.accounts.length > 0
      || local.transactions.length > 0
      || local.goals.length > 0
      || local.debts.length > 0
      || local.investments.length > 0;
    if (localHasData) {
      void this.push(local);
    }
  }

  /** Used by Settings to display the current account email. */
  getEmail = (): string | null => this.userEmail;
  getLastSyncedAt = (): number | null => this.lastSyncedAt;
  isCloudConfigured = (): boolean => Boolean(this.client);

  /**
   * Wipe in-memory sync metadata without touching the IDB keys (the
   * caller is expected to clearSyncRows() too) or the cloud. Called
   * after a local "Wipe all data" so the next boot's reconcile
   * treats this device as fresh — otherwise the stale
   * `lastSyncedAt` would skip the empty-state guard and an empty
   * local could clobber another device's cloud row.
   */
  resetSyncMetadata(): void {
    this.lastSyncedAt = null;
    this.lastError = null;
    if (this.queueDrainTimer !== null) {
      clearTimeout(this.queueDrainTimer);
      this.queueDrainTimer = null;
    }
    this.pendingPush = null;
  }

  // ── Offline handling ─────────────────────────────────────────────────

  private onOnline = (): void => {
    // Drain queue if there's anything pending.
    void this.drainQueue();
    // And recompute status (the pill flips from "Offline · N pending"
    // back to "Syncing…" or "Synced").
    this.recomputeStatus();
  };

  private onOffline = (): void => {
    this.recomputeStatus();
  };

  private async drainQueue(): Promise<void> {
    if (!this.userId || !this.client) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    let pending = await queue.readQueue();
    while (pending.length > 0) {
      const head = pending[0];
      const result = await this.tryUpsert(head);
      if (result === 'ok') {
        await queue.dequeue();
        pending = pending.slice(1);
        this.lastSyncedAt = Date.now();
        putSyncRow(CLOUD_LAST_SYNCED_KEY, this.lastSyncedAt);
      } else if (result === 'queued-offline') {
        // Still offline; re-evaluate in a bit.
        this.scheduleQueueDrain();
        return;
      } else if (result === 'retrying') {
        this.scheduleQueueDrain();
        return;
      } else {
        // Permanent fail — leave the queue alone, surface banner.
        this.emitBannerFromError(new Error('Sync failed after retries.'));
        return;
      }
    }
    this.recomputeStatus();
  }

  private scheduleQueueDrain(): void {
    if (this.queueDrainTimer !== null) return;
    this.queueDrainTimer = window.setTimeout(() => {
      this.queueDrainTimer = null;
      void this.drainQueue();
    }, QUEUE_FLUSH_RETRY_MS);
  }

  // ── Status computation ───────────────────────────────────────────────

  private async recomputeStatus(): Promise<void> {
    if (!this.client) {
      this.bus.set({ kind: 'unconfigured' });
      return;
    }
    if (!this.userId) {
      this.bus.set({ kind: 'signed-out' });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const pending = await queue.queueLength();
      this.bus.set({
        kind: 'signed-in-offline-queued',
        pending,
        email: this.userEmail,
      });
      return;
    }
    if (this.lastError) {
      this.bus.set({
        kind: 'signed-in-error',
        lastError: this.lastError,
        lastSyncedAt: this.lastSyncedAt,
        email: this.userEmail,
      });
      return;
    }
    this.bus.set({
      kind: 'signed-in-synced',
      lastSyncedAt: this.lastSyncedAt,
      email: this.userEmail,
    });
  }

  /** Sync recomputeStatus but don't await the queue probe. */
  private emitBannerFromError(err: unknown): void {
    const formatted = formatSyncError(err);
    // Dynamic import to avoid a hard cycle with the store.
    void import('./store').then(({ useStore }) => {
      useStore.getState().showBanner({
        kind: 'error',
        what: formatted.what,
        why: formatted.why,
        fix: formatted.fix,
      });
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

/** Module-level singleton. The test fixture mutates this via
 *  `installFakeSupabase()` to swap in a fake client. */
export const syncEngine = new SyncEngine();

/** Test-only escape hatch. Wipes the singleton's identity + init flag
 *  so a fresh test can re-run init() from a clean slate. Production
 *  code MUST NOT call this. Not exported from any barrel. */
export function __resetSyncEngineForTests(): void {
  const e = syncEngine as unknown as {
    userId: string | null;
    userEmail: string | null;
    inited: boolean;
    enabled: boolean;
    lastSyncedAt: number | null;
    lastError: string | null;
    pendingPush: unknown;
    queueDrainTimer: number | null;
    recoveryListeners: Set<unknown>;
    pendingRecovery: boolean;
  };
  e.userId = null;
  e.userEmail = null;
  e.inited = false;
  e.enabled = false;
  e.lastSyncedAt = null;
  e.lastError = null;
  e.pendingPush = null;
  if (e.queueDrainTimer !== null) {
    clearTimeout(e.queueDrainTimer);
    e.queueDrainTimer = null;
  }
  e.pendingRecovery = false;
  e.recoveryListeners.clear();
}

// ─── React hook ────────────────────────────────────────────────────────

/**
 * Subscribe to SyncEngine status changes. Components that render the
 * pill / "last synced" caption use this; it re-renders on transition.
 */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    syncEngine.subscribe,
    syncEngine.getStatus,
    syncEngine.getStatus,
  );
}

// Re-export so test setup can read this without an import cycle.
export { supabaseEnabled };
