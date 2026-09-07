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

/** Reset everything — the in-memory cloud table, the fake auth state,
 *  AND the production SyncEngine singleton's transient state. Safe
 *  to call from afterEach. */
export function __resetSyncForTests(): void {
  cloud.clear();
  authState = { user: null };
  authListeners.clear();
  __resetSyncEngineForTests();
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

// ─── Fake SupabaseClient ────────────────────────────────────────────────

type Listener = (event: string, session: { user: { id: string; email: string } } | null) => void;

function makeFakeClient(): SupabaseClient {
  return {
    auth: {
      getSession: async () => ({ data: { session: authState.user ? { user: authState.user } : null }, error: null }),
      signInWithOtp: async () => {
        // In tests we don't actually send an email — just flip the
        // session to mirror what the production callback would do.
        // Tests that want to assert on the magic-link send can spy on
        // this method before installing.
        return { data: {}, error: null };
      },
      signOut: async () => {
        authState = { user: null };
        for (const l of authListeners) l('SIGNED_OUT', null);
        return { error: null };
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
