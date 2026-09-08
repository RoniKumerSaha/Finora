/**
 * App.spec.tsx — verify the cross-tab recovery subscriber wired in
 * App.tsx: when another tab broadcasts `recovery-complete`, THIS tab
 * calls `window.location.reload()` to pick up the new session.
 *
 * We render the full <App /> (HashRouter + Shell + outlet) to assert
 * the actual wiring rather than a re-implementation. Before mounting
 * we stub `window.location.reload` so we can assert it without
 * tearing down happy-dom.
 *
 * happy-dom provides BroadcastChannel out of the box — the production
 * cross-tab subscriber uses it directly and is what we're testing.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { App } from '../../App';
import { broadcast } from '../crossTabRecovery';
import {
  installFakeSupabase,
  __resetSyncForTests,
} from '../../test/sync-helpers';

beforeEach(async () => {
  __resetSyncForTests();
  installFakeSupabase();
  // Reset URL fragment between tests so App.tsx's `isOwnRecoveryUrl()`
  // check inside the dialog's open-effect doesn't interfere with a
  // test that didn't open the recovery URL.
  window.location.hash = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App — cross-tab recovery subscriber', () => {
  it('calls window.location.reload when another tab broadcasts recovery-complete', async () => {
    // Mount the full app once. The recovery subscriber registers its
    // BroadcastChannel listener in the component's useEffect (run on
    // mount). Subsequent broadcasts from any source — including the
    // crossTabRecovery.broadcast() helper below — reach that listener.
    render(<App />);

    const reloadSpy = vi.spyOn(window.location, 'reload')
      // happy-dom's reload is `() => void` and otherwise undefined —
      // define a stub so the call is a no-op for the test runner.
      .mockImplementation(() => { /* noop */ });

    broadcast({ type: 'recovery-complete' });

    // BroadcastChannel.postMessage is asynchronous on some engines
    // (notably happy-dom); give the listener a few ms to fire.
    // A single setTimeout(0) was flaky in CI — bump to 10ms which is
    // still fast but reliably crosses happy-dom's postMessage boundary.
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload on a recovery-opened broadcast', async () => {
    render(<App />);

    const reloadSpy = vi.spyOn(window.location, 'reload')
      .mockImplementation(() => { /* noop */ });

    // The `recovery-opened` message is only relevant to the
    // ResetPasswordDialog's dedupe logic — App doesn't act on it.
    broadcast({ type: 'recovery-opened', tabId: 'sibling-tab' });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
