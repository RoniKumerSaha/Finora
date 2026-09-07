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
import { formatSyncError } from '../lib/errors';
import { useLockStore } from '../security/lockStore';
import { recomputeDerived } from './recompute';
import { save as saveLocal } from './persistence';
import {
  CLOUD_LAST_PULLED_KEY,
  CLOUD_LAST_SYNCED_KEY,
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
   */
  async init(): Promise<void> {
    if (this.inited) return;
    this.inited = true;

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

    // Restore session (if any).
    const { data } = await this.client.auth.getSession();
    const session = data.session;
    if (session?.user) {
      this.userId = session.user.id;
      this.userEmail = session.user.email ?? null;
      // Don't auto-enable — `enabled` follows the user's Settings
      // toggle, which the store reads separately on first mutation.
      // We just set up identity so we know who we're syncing as.
    }

    // Subscribe to auth state changes so magic-link returns on this
    // device flip us into signed-in without an app reload.
    this.client.auth.onAuthStateChange((_event, newSession) => {
      const u = newSession?.user;
      this.userId = u?.id ?? null;
      this.userEmail = u?.email ?? null;
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
      const localStamp = local.settings.stateUpdatedAt ?? 0;
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

  async signIn(email: string): Promise<void> {
    const client = this.client ?? requireSupabase();
    // Redirect to the bare origin (no `/#/settings` suffix) so GoTrue's
    // 303 response puts the access_token cleanly in the URL fragment:
    //   Location: ${origin}#access_token=...&type=magiclink
    // supabase-js's `detectSessionInUrl` parses that fragment and
    // fires SIGNED_IN. If we put `/#/settings` here, GoTrue places
    // the params after the existing hash and the access_token ends
    // up in the query string (`/settings?access_token=...`), which
    // the hash router renders as a settings page WITHOUT picking
    // up the token. The hash router then navigates to /home
    // (default) since the path is `/settings` not the access_token
    // we wanted. Use the origin; the user lands on the app, the
    // session is established, the in-app navigation to /settings
    // happens via the auth state change.
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : undefined;
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    if (this.client) {
      await this.client.auth.signOut();
    }
    this.userId = null;
    this.userEmail = null;
    await queue.clearQueue();
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
    // Then push local (in case reconcile pulled down newer data and
    // we still want to make sure cloud mirrors local exactly).
    const { useStore } = await import('./store');
    void this.push(useStore.getState().state);
  }

  /** Used by Settings to display the current account email. */
  getEmail = (): string | null => this.userEmail;
  getLastSyncedAt = (): number | null => this.lastSyncedAt;
  isCloudConfigured = (): boolean => Boolean(this.client);

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
