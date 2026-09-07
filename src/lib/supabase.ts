/**
 * supabase.ts — singleton Supabase JS client.
 *
 * Reads `BASE_URL` and `BASE_ANON_KEY` from the build environment.
 * These names (no `VITE_` prefix, no `SUPABASE_` prefix) are
 * intentionally chosen by the user; they're exposed to client code
 * via an explicit allow-list in `vite.config.ts` (see `define`).
 *
 * Behavior:
 *   - Both vars present  → returns a real `SupabaseClient`.
 *   - Either missing     → exports `null`. The SyncEngine treats this as
 *                          "cloud sync unavailable on this build"; the
 *                          UI surfaces a muted "Cloud sync is disabled
 *                          in this build" hint. No exception is thrown
 *                          at module-load time so the app still boots
 *                          on a fresh checkout without a `.env.local`.
 *
 * Tests use `src/test/sync-helpers.ts::installFakeSupabase()` to swap
 * this module's default export with an in-memory mock.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.BASE_URL as string | undefined;
const anonKey = import.meta.env.BASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url as string, anonKey as string, {
      auth: {
        // Magic-link tokens live in the URL fragment. Persist session
        // in localStorage so the user doesn't have to re-authenticate
        // on every reload. supabase-js picks the right storage key
        // automatically.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Throws a readable error when cloud sync is invoked but the client
 * wasn't built with credentials. Used by SyncEngine methods that
 * promise a real network call.
 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      '[finora/sync] Cloud sync is not configured. '
        + 'Set BASE_URL and BASE_ANON_KEY in .env.local.',
    );
  }
  return supabase;
}
