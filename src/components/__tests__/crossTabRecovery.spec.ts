/**
 * crossTabRecovery.spec.ts — exercise the small BroadcastChannel wrapper
 * used to dedupe the ResetPasswordDialog across tabs.
 *
 * Covers:
 *   - tabId() is stable within a tab and unique across calls (per-tab
 *     sessionStorage keeps the value)
 *   - isOwnRecoveryUrl() reflects the current `window.location.hash`
 *   - subscribe() invokes the callback on broadcast; messages broadcast
 *     on the same channel reach subscribers
 *
 * happy-dom provides BroadcastChannel and sessionStorage out of the box,
 * so we don't mock them — the production wiring is what we're testing.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { broadcast, captureRecoveryFragment, isOwnRecoveryUrl, subscribe, tabId } from '../crossTabRecovery';

beforeEach(() => {
  // Reset the per-tab id and the URL fragment so each test starts from
  // a known state. happy-dom shares sessionStorage across tests within
  // a file unless explicitly cleared.
  sessionStorage.removeItem('finora-tab-id');
  // Setting hash to '' clears it. Some jsdom variants emit a hashchange
  // event when we write; happy-dom is quiet here which is what we want.
  window.location.hash = '';
  // Clear any boot-time snapshot from a previous test — it's a module
  // singleton so we have to scrub it manually.
  captureRecoveryFragment('');
});

describe('tabId', () => {
  it('returns a stable id within a tab', () => {
    const a = tabId();
    const b = tabId();
    expect(a).toBe(b);
    // The id is stored in sessionStorage so a subsequent spec (or a
    // component remount) reads the same value.
    expect(sessionStorage.getItem('finora-tab-id')).toBe(a);
  });

  it('returns a non-empty string', () => {
    expect(tabId().length).toBeGreaterThan(0);
  });
});

describe('isOwnRecoveryUrl', () => {
  it('returns false when the URL has no recovery fragment', () => {
    window.location.hash = '';
    expect(isOwnRecoveryUrl()).toBe(false);
  });

  it('returns true when the URL contains type=recovery', () => {
    window.location.hash = '#access_token=abc&type=recovery';
    expect(isOwnRecoveryUrl()).toBe(true);
  });

  it('returns false when the hash contains other types but not recovery', () => {
    window.location.hash = '#access_token=abc&type=magiclink';
    expect(isOwnRecoveryUrl()).toBe(false);
  });

  it('returns true after the URL hash is cleared but a recovery fragment was snapshotted at boot', () => {
    // Simulate the boot sequence: app loads with the recovery
    // fragment, supabase-js extracts it, then clears
    // `window.location.hash`. The fragment was captured by
    // captureRecoveryFragment() before the clear, so isOwnRecoveryUrl
    // still returns true.
    captureRecoveryFragment('#access_token=abc&type=recovery');
    window.location.hash = ''; // supabase-js wiped it
    expect(isOwnRecoveryUrl()).toBe(true);
  });

  it('does not false-positive on a non-recovery snapshot', () => {
    captureRecoveryFragment('#access_token=abc&type=magiclink');
    window.location.hash = '';
    expect(isOwnRecoveryUrl()).toBe(false);
  });
});

describe('broadcast / subscribe', () => {
  it('subscribe receives a broadcast message on the channel', async () => {
    const received: Array<unknown> = [];
    const off = subscribe(msg => received.push(msg));

    broadcast({ type: 'recovery-complete' });

    // BroadcastChannel.postMessage is asynchronous on some engines
    // (notably happy-dom); give the listener a few ms to fire.
    // A single setTimeout(0) was flaky — 10ms is still fast but
    // reliably crosses happy-dom's postMessage boundary.
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received).toEqual([{ type: 'recovery-complete' }]);
    off();
  });

  it('subscribe receives recovery-opened with its tabId', async () => {
    const received: Array<unknown> = [];
    const off = subscribe(msg => received.push(msg));

    broadcast({ type: 'recovery-opened', tabId: 'tab-XYZ' });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received).toEqual([{ type: 'recovery-opened', tabId: 'tab-XYZ' }]);
    off();
  });

  it('unsubscribe stops further messages from being delivered', async () => {
    const received: Array<unknown> = [];
    const off = subscribe(msg => received.push(msg));
    off();

    broadcast({ type: 'recovery-complete' });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received).toEqual([]);
  });
});
