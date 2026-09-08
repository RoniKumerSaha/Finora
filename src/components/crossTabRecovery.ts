/**
 * crossTabRecovery.ts — small `BroadcastChannel` wrapper used by the
 * password-recovery flow to dedupe the `ResetPasswordDialog` across
 * tabs of the same origin.
 *
 * Problem statement: when the user clicks the password-recovery email
 * link, supabase-js writes the recovery session to `localStorage`
 * (shared across tabs). The OTHER tab — still signed in with the
 * old session — picks up the storage change and its `onAuthStateChange`
 * listener fires `PASSWORD_RECOVERY`, so both tabs open the dialog.
 * After the user updates the password in the new tab, the old tab
 * holds a stale session until manual reload.
 *
 * Solution: a tab-unique id + two messages over a `BroadcastChannel`:
 *   - `recovery-opened`   — the fragment-receiving tab announces it's
 *                            opening the dialog. Other tabs that see
 *                            this from a different tabId suppress
 *                            their own dialog.
 *   - `recovery-complete` — broadcast after `updatePassword` succeeds.
 *                            Other tabs reload to pick up the new
 *                            session.
 *
 * Fail-open: if `BroadcastChannel` is unavailable (private mode in
 * some browsers), the helpers degrade to no-ops. The fragment tab
 * still opens the dialog (via `isOwnRecoveryUrl()`); other tabs may
 * also briefly open it, but the user only sees one if they're
 * interacting with it.
 */
const CHANNEL = 'finora-recovery';

export type RecoveryMsg =
  | { type: 'recovery-opened'; tabId: string }
  | { type: 'recovery-complete' };

/**
 * Snapshot of the recovery URL fragment captured before supabase-js
 * clears it. supabase-js's `detectSessionInUrl` flow strips
 * `#access_token=...&type=recovery` from `window.location.hash`
 * (auth-js GoTrueClient.js line ~3325: `window.location.hash = ''`)
 * immediately after extracting the tokens. By then any reader of
 * `window.location.hash` would see it as empty.
 *
 * `SyncEngine.init()` captures the fragment BEFORE the first call to
 * `getSession()` (which triggers `initialize()` which triggers the
 * fragment extraction). The ResetPasswordDialog then asks
 * `isOwnRecoveryUrl()` — which checks both `window.location.hash`
 * AND this snapshot, so a tab that received the fragment on boot
 * still answers correctly after the URL is cleared.
 *
 * `null` when this tab never had a recovery fragment on boot (the
 * common case).
 */
let snapshotRecoveryFragment: string | null = null;

/** Called by `SyncEngine.init()` once at boot, before any
 *  supabase-js call that might clear `location.hash`. Pass an empty
 *  string (or any non-recovery fragment) to clear the snapshot
 *  between test runs. */
export function captureRecoveryFragment(fragment: string): void {
  if (/type=recovery/.test(fragment)) {
    snapshotRecoveryFragment = fragment;
  } else {
    snapshotRecoveryFragment = null;
  }
}

/**
 * Per-tab UUID stored in `sessionStorage` (per-tab by definition —
 * discarded when the tab closes). Stable across re-renders within a
 * tab; unique across tabs.
 */
export function tabId(): string {
  if (typeof sessionStorage === 'undefined') {
    // SSR / non-browser context — return a stable-but-useless id.
    return 'no-session-storage';
  }
  const KEY = 'finora-tab-id';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    // crypto.randomUUID is widely available in modern browsers;
    // the fallback uses Date.now + Math.random for older targets.
    const gen: () => string =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? () => crypto.randomUUID()
        : () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    id = gen();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * True when this tab's URL contains (or, at boot, contained) the
 * recovery fragment (`#access_token=...&type=recovery`). The
 * fragment-receiving tab is the canonical handler — only it opens
 * the dialog.
 *
 * Checks both the live `window.location.hash` AND the boot-time
 * snapshot — see `captureRecoveryFragment()`. After supabase-js
 * strips the live hash the snapshot is the only signal left.
 */
export function isOwnRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  if (/type=recovery/.test(window.location.hash)) return true;
  if (snapshotRecoveryFragment && /type=recovery/.test(snapshotRecoveryFragment)) return true;
  return false;
}

/** Send a message to all other tabs on the same origin. */
export function broadcast(msg: RecoveryMsg): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(msg);
    ch.close();
  } catch {
    // BroadcastChannel can throw in private-browsing modes or when
    // the channel name is restricted. Fail silently — the dialog
    // still works in the fragment tab.
  }
}

/**
 * Subscribe to messages from other tabs. Returns an unsubscribe.
 *
 * The callback is invoked with the parsed message object. Listener
 * errors are not caught — caller's responsibility.
 */
export function subscribe(cb: (msg: RecoveryMsg) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => { /* no-op */ };
  }
  let ch: BroadcastChannel | null = null;
  try {
    ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = ev => {
      const data = ev.data as RecoveryMsg | undefined;
      if (data && typeof data === 'object' && 'type' in data) {
        cb(data);
      }
    };
  } catch {
    /* same as above */
  }
  return () => {
    try { ch?.close(); } catch { /* ignore */ }
    ch = null;
  };
}
