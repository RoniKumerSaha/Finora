/**
 * sync-helpers.ts — test-only utilities for the cloud-sync layer.
 *
 * Provides an in-memory Supabase fake so specs don't hit the network.
 * Mirrors `idb-helpers.ts`: same pattern, same shape, same import
 * ergonomics.
 *
 * The fake implements only the methods `SyncEngine` actually calls —
 * `auth.getSession`, `auth.signInWithOtp`, `auth.signOut`,
 * `auth.onAuthStateChange`, and a single `from('finora_state')` chain
 * supporting `select / upsert / delete / eq / maybeSingle`.
 *
 * Tests should:
 *   - call `installFakeSupabase()` once in beforeEach (already done in
 *     tests-setup.ts; calling again is safe but redundant).
 *   - call `__resetSyncForTests()` to wipe both the in-memory cloud
 *     table AND the production SyncEngine singleton's state (so a
 *     test starts clean — no leaked session, no carried-over pending
 *     pushes).
 */
import { SyncEngine, __resetSyncEngineForTests, syncEngine } from '../domain/sync';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { State } from '../domain/types';

// ─── In-memory cloud table ─────────────────────────────────────────────

interface CloudRow {
  user_id: string;
  version: number;
  payload: State;
  updated_at: string;
}

const cloud = new Map<string, CloudRow>();
let authState: { user: { id: string; email: string } | null } = { user: null };
const authListeners = new Set<(event: string, session: { user: { id: string; email: string } } | null) => void>();

// Per-account password (set via `__seedAuthPassword`). When unset, any
// non-empty password is accepted — this matches the "create account
// without verification" path on the local stack where
// `enable_confirmations = false` (supabase/config.toml:226).
const authPasswords = new Map<string, string>();
// Pre-seeded "users" so tests can drive `signInWithPassword` against a
// known account without going through `signUp` first. Keyed by email.
const seededUsers = new Map<string, { id: string; email: string }>();
// Optional error to inject on the next auth call (consumed once).
let injectedAuthError: { name: string; status: number; message: string } | null = null;

/** Reset everything — the in-memory cloud table, the fake auth state,
 *  AND the production SyncEngine singleton's transient state. Safe
 *  to call from afterEach. */
export function __resetSyncForTests(): void {
  cloud.clear();
  authState = { user: null };
  authListeners.clear();
  authPasswords.clear();
  seededUsers.clear();
  injectedAuthError = null;
  __resetSyncEngineForTests();
}

/**
 * Seed a "user" the fake auth client can sign in as via
 * `signInWithPassword`. Email + password pair is matched exactly
 * (case-sensitive on email); if `password` is omitted any non-empty
 * string is accepted.
 */
export function __seedAuthUser(email: string, password?: string): { id: string; email: string } {
  const id = `seeded-${email}`;
  const user = { id, email };
  seededUsers.set(email, user);
  if (password !== undefined) authPasswords.set(email, password);
  return user;
}

/**
 * Inject an error to be returned by the next `signInWithPassword` or
 * `signUp` call (consumed once, then cleared). Mirrors Supabase's
 * `AuthError` shape so `formatSyncError()` recognises it.
 */
export function __setAuthError(err: { name: string; status: number; message: string } | null): void {
  injectedAuthError = err;
}

/** Inspect / seed the fake cloud directly from a test. */
export function __getCloudRow(userId: string): CloudRow | undefined {
  return cloud.get(userId);
}

export function __seedCloudRow(userId: string, payload: State, updatedAt?: string): void {
  cloud.set(userId, {
    user_id: userId,
    version: payload.version,
    payload,
    updated_at: updatedAt ?? new Date().toISOString(),
  });
}

export function __setAuthUser(user: { id: string; email: string } | null): void {
  authState = { user };
  for (const l of authListeners) l(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null);
}

/**
 * Simulate the user clicking the password-recovery link in their
 * email. Fires PASSWORD_RECOVERY on every registered
 * onAuthStateChange listener — that's the signal App.tsx watches to
 * open the ResetPasswordDialog.
 *
 * If `user` is omitted, defaults to the currently-authenticated user
 * (or null if signed-out, which is a malformed recovery flow but
 * matches what the real Supabase client would do).
 */
export function __simulateRecovery(user?: { id: string; email: string } | null): void {
  const u = user === undefined ? authState.user : user;
  for (const l of authListeners) l('PASSWORD_RECOVERY', u ? { user: u } : null);
}

// ─── Fake SupabaseClient ────────────────────────────────────────────────

type Listener = (event: string, session: { user: { id: string; email: string } } | null) => void;

function makeFakeClient(): SupabaseClient {
  return {
    auth: {
      getSession: async () => ({ data: { session: authState.user ? { user: authState.user } : null }, error: null }),
      // Magic-link path is kept so any stray legacy test still works,
      // but it's a no-op: the production code no longer calls it.
      signInWithOtp: async () => ({ data: {}, error: null }),
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        if (injectedAuthError) {
          const err = injectedAuthError;
          injectedAuthError = null;
          return { data: { user: null, session: null }, error: err as unknown as Error };
        }
        const user = seededUsers.get(email);
        if (!user) {
          return {
            data: { user: null, session: null },
            error: { name: 'AuthApiError', status: 400, message: 'Invalid login credentials' } as unknown as Error,
          };
        }
        const expected = authPasswords.get(email);
        if (expected !== undefined && expected !== password) {
          return {
            data: { user: null, session: null },
            error: { name: 'AuthApiError', status: 400, message: 'Invalid login credentials' } as unknown as Error,
          };
        }
        authState = { user };
        for (const l of authListeners) l('SIGNED_IN', { user });
        return { data: { user, session: { user } }, error: null };
      },
      signUp: async ({ email, password }: { email: string; password: string }) => {
        if (injectedAuthError) {
          const err = injectedAuthError;
          injectedAuthError = null;
          return { data: { user: null, session: null }, error: err as unknown as Error };
        }
        if (seededUsers.has(email)) {
          return {
            data: { user: null, session: null },
            error: { name: 'AuthApiError', status: 422, message: 'User already registered' } as unknown as Error,
          };
        }
        // Mimic the local stack default: `enable_confirmations = false`
        // (supabase/config.toml:226) → sign-up returns a session, no
        // verification round-trip. Tests that want the confirmation
        // path can use __setAuthError to inject the alternate shape.
        const id = `signedup-${email}`;
        const user = { id, email };
        seededUsers.set(email, user);
        authPasswords.set(email, password);
        authState = { user };
        for (const l of authListeners) l('SIGNED_IN', { user });
        return { data: { user, session: { user } }, error: null };
      },
      signOut: async () => {
        authState = { user: null };
        for (const l of authListeners) l('SIGNED_OUT', null);
        return { error: null };
      },
      // Password recovery. Mirrors Supabase v2 — returns
      // { data: {}, error } and does NOT auto-sign-in (the recovery
      // link itself is what establishes the session in the real flow).
      // Tests that want to simulate "user clicked the link and is
      // back in the app" should call __simulateRecovery() below.
      resetPasswordForEmail: async () => {
        if (injectedAuthError) {
          const err = injectedAuthError;
          injectedAuthError = null;
          return { data: {}, error: err as unknown as Error };
        }
        return { data: {}, error: null };
      },
      // Password update. The fake stores the new password into
      // authPasswords so a subsequent signInWithPassword(newPassword)
      // succeeds — matches the real Supabase behavior where the
      // user's stored credentials rotate.
      updateUser: async ({ password }: { password?: string }) => {
        if (injectedAuthError) {
          const err = injectedAuthError;
          injectedAuthError = null;
          return { data: { user: authState.user }, error: err as unknown as Error };
        }
        if (password && authState.user) {
          authPasswords.set(authState.user.email, password);
        }
        return { data: { user: authState.user }, error: null };
      },
      onAuthStateChange: (cb: Listener) => {
        authListeners.add(cb);
        return { data: { subscription: { unsubscribe: () => { authListeners.delete(cb); } } } };
      },
    },
    from: (_table: string) => ({
      select: (_cols: string) => {
        const q = {
          eq: (col: string, val: string) => {
            const row = cloud.get(val);
            return {
              maybeSingle: async () => {
                if (col !== 'user_id') return { data: null, error: null };
                if (!row) return { data: null, error: null };
                return { data: { payload: row.payload, updated_at: row.updated_at }, error: null };
              },
            };
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return q;
      },
      upsert: (values: CloudRow) => {
        const row: CloudRow = {
          ...values,
          updated_at: new Date().toISOString(),
        };
        cloud.set(row.user_id, row);
        return Promise.resolve({ data: null, error: null });
      },
      delete: () => {
        const q = {
          eq: (col: string, val: string) => {
            if (col === 'user_id') cloud.delete(val);
            return Promise.resolve({ data: null, error: null });
          },
        };
        return q;
      },
    }),
  } as unknown as SupabaseClient;
}

// ─── Singleton installer ───────────────────────────────────────────────

let installed = false;
let engine: SyncEngine | null = null;

/** Replace the production SyncEngine's client with our fake. Safe to
 *  call from beforeEach. Returns the engine instance for direct
 *  assertions. */
export function installFakeSupabase(): SyncEngine {
  const fake = makeFakeClient();
  if (!installed) {
    // Reuse the production singleton so callers (the store, the
    // UI) talk to the same engine that the test controls.
    engine = syncEngine;
    installed = true;
  }
  // Always (re-)swap the client so the singleton hits the fake.
  // `engine` was either just assigned to the singleton above, or
  // was already assigned on a previous installFakeSupabase call —
  // either way it's non-null here.
  engine!.__setClientForTests(fake);
  return engine!;
}

/** Get the currently-installed fake engine. Returns null if
 *  installFakeSupabase hasn't been called yet. */
export function getFakeEngine(): SyncEngine | null {
  return engine;
}

/** Wipe state but keep the engine instance — cheaper for tests that
 *  don't want to recreate the singleton between specs. */
export function resetSyncBetweenTests(): void {
  __resetSyncForTests();
}
