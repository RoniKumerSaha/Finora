/**
 * LockScreen — full-screen unlock surface, rendered as the only child
 * of `<Root>` while the lock store's `locked` flag is true.
 *
 * Layout (OTP-style — matches the chosen "A" design):
 *   • Centered stack: Finora brand mark + wordmark
 *   • "Enter your PIN" h1 + subtitle
 *   • 6 separate OTP-style input boxes (auto-advance, backspace,
 *     paste support) inside <PinCells>
 *   • On-screen 3×4 keypad
 *   • Bottom: "Forgot PIN? Wipe all data" link → ConfirmDialog
 *
 * Physical keyboard typing routes through the OTP boxes themselves
 * (they are focusable), so no separate hidden input is needed.
 * Paste of "123456" auto-fills and triggers submission on the 6th.
 *
 * The "Forgotten PIN = wipe" path goes through the same `update(...)`
 * mutation that Danger Zone uses, so both code paths exercise the
 * same code (no second copy of the wipe logic).
 */

import { useEffect, useState } from 'react';
import { useLockStore, getLockoutRemaining } from './lockStore';
import { useStore } from '../domain/store';
import { useConfirm } from '../components/ConfirmDialog';
import { PinCells } from './PinCells';
import { verifyPin, clearPin } from './pin';
import { resetRateLimit } from './rateLimit';

const PIN_LENGTH = 6;

export function LockScreen() {
  const locked = useLockStore(s => s.locked);
  const submitting = useLockStore(s => s.submitting);
  const setSubmitting = useLockStore(s => s.setSubmitting);
  const recordWrongAttempt = useLockStore(s => s.recordWrongAttempt);
  const resetLock = useLockStore(s => s.resetLock);

  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const { confirm, dialog } = useConfirm();

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState<number | null>(null);

  // Tick the lockout countdown at 4Hz so the seconds update smoothly.
  const [remaining, setRemaining] = useState(getLockoutRemaining());
  useEffect(() => {
    const id = setInterval(() => setRemaining(getLockoutRemaining()), 250);
    return () => clearInterval(id);
  }, []);
  const lockoutActive = remaining > 0;
  const blocked = submitting || lockoutActive;
  const indefiniteLockout = remaining >= Number.MAX_SAFE_INTEGER / 2;

  // Auto-submit on the 6th digit (handles keypad + paste).
  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    void tryUnlock(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function tryUnlock(candidate: string) {
    setSubmitting(true);
    setError(null);
    try {
      const ok = await verifyPin(candidate);
      if (ok) {
        resetLock();
        showBanner({
          kind: 'success',
          what: 'Welcome back',
          why: 'PIN accepted.',
          fix: 'Your accounts are ready.',
        });
        return;
      }
      // Wrong — bump rate limit, shake, clear, red text.
      recordWrongAttempt();
      const ms = getLockoutRemaining();
      if (ms >= Number.MAX_SAFE_INTEGER / 2) {
        setError('Too many attempts. Reload the page to continue.');
      } else {
        setError('Wrong PIN. Try again.');
      }
      setShakeKey(Date.now());
      setPin('');
    } catch (err) {
      setError(`Could not check PIN: ${(err as Error).message}`);
      setPin('');
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotPin() {
    const ok = await confirm({
      title: 'Wipe all data and reset PIN?',
      body: 'This permanently deletes every account, transaction, goal, debt, investment, and plan — and clears the PIN. The app will reset to a clean install. There is no recovery.',
      confirmLabel: 'Wipe everything',
      danger: true,
    });
    if (!ok) return;
    update(s => ({
      version: 1,
      accounts: [], transactions: [], goals: [], debts: [], investments: [], categories: [],
      monthPlans: [], eventPlans: [],
      investmentPlans: [], loanPlans: [],
      settings: { ...s.settings, onboardingComplete: true },
    }));
    clearPin();
    resetRateLimit();
    resetLock();
    showBanner({
      kind: 'success',
      what: 'All data wiped',
      why: 'Your local store is now empty.',
      fix: 'Add an account to start tracking again.',
    });
  }

  // The lock screen should always be visible when this is mounted.
  if (!locked) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-4"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(63,181,146,.08), transparent 60%), var(--bg)',
      }}
      role="region"
      aria-label="Unlock Finora"
    >
      {dialog}

      <div
        className="flex flex-col items-center gap-5"
        style={{ width: '100%', maxWidth: 360 }}
      >
        {/* Shield icon — same brand tile as the Set PIN / Change PIN
            dialogs so the lock and unlock surfaces feel like one
            family. A small lock glyph in the centre distinguishes the
            "locked" state from the "set new PIN" checkmark state. */}
        <div
          className="flex items-center justify-center"
          style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--primary-soft)',
          }}
          aria-hidden
        >
          <svg
            width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="var(--primary)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" />
            <rect x="8.5" y="11" width="7" height="5.5" rx="1.2" />
            <path d="M9.7 11V9.2a2.3 2.3 0 0 1 4.6 0V11" />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-1">
          <h1 className="heading h1-display m-0">Secure Finora</h1>
          <p className="text-[13px] text-muted m-0">
            Enter your 6-digit PIN to unlock
          </p>
        </div>

        <PinCells
          value={pin}
          onChange={setPin}
          shakeKey={shakeKey ?? undefined}
          hasError={!!error}
          disabled={blocked}
          ariaLabel={`PIN entry, ${pin.length} of ${PIN_LENGTH} digits entered`}
        />

        {error && (
          <div role="alert" className="text-[12.5px] text-danger font-semibold">
            {error}
          </div>
        )}
        {!error && lockoutActive && (
          <div className="text-[12px] text-muted">
            {indefiniteLockout ? 'Locked. Reload the page to continue.' : `Try again in ${Math.ceil(remaining / 1000)}s`}
          </div>
        )}

        <button
          type="button"
          onClick={onForgotPin}
          className="text-[12px] text-danger hover:opacity-80 underline underline-offset-2 transition mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
        >
          Forgot PIN? Wipe all data
        </button>
      </div>
    </div>
  );
}