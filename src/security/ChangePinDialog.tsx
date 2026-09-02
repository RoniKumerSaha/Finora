/**
 * ChangePinDialog — three-step PIN rotation. Same OTP-style boxes
 * and on-screen keypad as SetPinDialog.
 *
 *   step 'current'      → user types their current PIN → verifyPin()
 *     wrong → shake + red error + reset to 'current'
 *     right → advance to 'new'
 *   step 'new'          → user types the new PIN
 *   step 'confirmNew'   → user types the new PIN again
 *     mismatch → shake + reset to 'new'
 *     match   → setPin(new) with a freshly generated salt
 *
 * Why rate-limit is enforced here too: someone with physical access
 * to an unlocked device could open Settings → Change PIN and brute
 * force the old PIN via DevTools interception. The shared session
 * rate-limiter caps attempts regardless of the surface.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PinCells } from './PinCells';
import { Button } from '../components/Button';
import { setPin, verifyPin } from './pin';
import {
  getLockoutRemaining,
  scheduleNextLockout,
} from './rateLimit';

const PIN_LENGTH = 6;

type Step = 'current' | 'new' | 'confirmNew';

interface ChangePinDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangePinDialog({ onClose, onSuccess }: ChangePinDialogProps) {
  const [step, setStep] = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const value =
    step === 'current' ? currentPin
    : step === 'new' ? newPin
    : confirmPin;

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lockout tick — same concept as LockScreen. We don't enforce the
  // rate-limit via lockStore here (we want a single shared counter
  // across both surfaces but live independently of in-memory store
  // state since this dialog may run during normal app usage).
  const [lockoutRemaining, setLockoutRemaining] = useState(getLockoutRemaining());
  useEffect(() => {
    const id = setInterval(() => setLockoutRemaining(getLockoutRemaining()), 250);
    return () => clearInterval(id);
  }, []);
  const lockoutActive = lockoutRemaining > 0;
  const blocked = submitting || lockoutActive;

  function resetNew() {
    setNewPin('');
    setConfirmPin('');
  }

  // Auto-advance when the 6th digit lands (handles keypad + paste).
  useEffect(() => {
    if (value.length !== PIN_LENGTH) return;
    if (step === 'current') {
      void verifyCurrent(value);
      return;
    }
    if (step === 'new') {
      setNewPin(value);
      setStep('confirmNew');
      setConfirmPin('');
      return;
    }
    // step === 'confirmNew'
    if (newPin !== value) {
      setError("New PINs don't match — try again.");
      setShakeKey(Date.now());
      resetNew();
      setStep('new');
      return;
    }
    void persistNew(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, step]);

  async function verifyCurrent(pin: string) {
    setSubmitting(true);
    setError(null);
    try {
      const ok = await verifyPin(pin);
      if (!ok) {
        scheduleNextLockout();
        const remaining = getLockoutRemaining();
        if (remaining >= Number.MAX_SAFE_INTEGER / 2) {
          setError('Too many attempts. Reload the page to continue.');
        } else {
          setError("That PIN doesn't match the one on this device.");
        }
        setShakeKey(Date.now());
        setCurrentPin('');
        return;
      }
      setStep('new');
    } catch (err) {
      setError(`Could not verify PIN: ${(err as Error).message}`);
      setShakeKey(Date.now());
      setCurrentPin('');
    } finally {
      setSubmitting(false);
    }
  }

  async function persistNew(pin: string) {
    setSubmitting(true);
    setError(null);
    try {
      await setPin(pin);
      onSuccess();
    } catch (err) {
      setError(`Could not save new PIN: ${(err as Error).message}`);
      setShakeKey(Date.now());
      resetNew();
      setStep('new');
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    step === 'current' ? 'Enter your current PIN'
    : step === 'new' ? 'Choose a new PIN'
    : 'Confirm the new PIN';

  const subtitle =
    step === 'current' ? "We need to know it's really you before changing it."
    : step === 'new' ? 'Pick a new 6-digit PIN.'
    : 'Type it once more to confirm.';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pin-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: 'var(--overlay)', backdropFilter: 'blur(8px)' }}
      />
      <form
        onSubmit={(e) => e.preventDefault()}
        className="relative rounded-card w-[360px] max-w-full shadow-modal flex flex-col gap-4"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          padding: '22px 22px 18px',
        }}
      >
        <div className="flex flex-col items-center gap-2">
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
            <h3 id="change-pin-title" className="heading h3-modal m-0 text-center">{title}</h3>
            <p className="text-[13px] text-muted m-0 text-center">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <PinCells
            value={value}
            onChange={(next) => {
              if (step === 'current') setCurrentPin(next);
              else if (step === 'new') setNewPin(next);
              else setConfirmPin(next);
            }}
            shakeKey={shakeKey ?? undefined}
            hasError={!!error}
            disabled={blocked}
            ariaLabel={`${value.length} of ${PIN_LENGTH} digits entered`}
          />
          {error && (
            <div role="alert" className="text-[12px] text-danger font-semibold">
              {error}
            </div>
          )}
          {!error && lockoutActive && (
            <div className="text-[12px] text-muted">
              {lockoutRemaining >= Number.MAX_SAFE_INTEGER / 2
                ? 'Locked. Reload the page to continue.'
                : `Try again in ${Math.ceil(lockoutRemaining / 1000)}s`}
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-2 text-center m-0">
          Type with your keyboard. Each box accepts one digit.
        </p>

        <div className="flex gap-2.5 justify-end mt-1">
          <Button variant="outlined-ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}