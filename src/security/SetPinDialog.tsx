/**
 * SetPinDialog — two-step PIN setup (enter, then confirm).
 *
 * Modal pattern: createPortal + dark backdrop + 8px blur. Inside the
 * 400px surface: title + subtitle + 6 OTP-style boxes (PinCells) +
 * on-screen keypad + Cancel / Continue actions.
 *
 * State machine:
 *   step 'enter'    → user types 6 digits → advance to 'confirm'
 *   step 'confirm'  → user types 6 digits → if 6th typed, compare
 *     match:   setPin() → onSuccess() → caller closes
 *     mismatch: shake cells + reset to 'enter'
 *
 * "Continue" button is disabled until the 6th digit lands — `$ is
 * the only way to advance. The button just exists to mirror the
 * design (and to dismiss on `Enter` once filled). We still auto-
 * advance on the 6th keystroke to keep the flow tight.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PinCells } from './PinCells';
import { Button } from '../components/Button';
import { setPin } from './pin';

const PIN_LENGTH = 6;

type Step = 'enter' | 'confirm';

interface SetPinDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function SetPinDialog({ onClose, onSuccess }: SetPinDialogProps) {
  const [step, setStep] = useState<Step>('enter');
  const [entered, setEntered] = useState('');
  const [confirmed, setConfirmed] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const value = step === 'enter' ? entered : confirmed;
  const canContinue = value.length === PIN_LENGTH && !submitting;

  // Auto-advance / compare when the 6th digit lands (handles keypad + paste).
  useEffect(() => {
    if (value.length !== PIN_LENGTH) return;
    if (step === 'enter') {
      setStep('confirm');
      setConfirmed('');
      return;
    }
    if (entered !== value) {
      setError("PINs don't match — try again.");
      setShakeKey(Date.now());
      setEntered('');
      setConfirmed('');
      setStep('enter');
      return;
    }
    void persist(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, step]);

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

  function reset() {
    setError(null);
    setEntered('');
    setConfirmed('');
  }

  async function persist(pin: string) {
    setSubmitting(true);
    setError(null);
    try {
      await setPin(pin);
      onSuccess();
    } catch (err) {
      setError(`Could not save PIN: ${(err as Error).message}`);
      setShakeKey(Date.now());
      reset();
      setStep('enter');
    } finally {
      setSubmitting(false);
    }
  }

  const title = step === 'enter' ? 'Set a 6-digit PIN' : 'Confirm your PIN';
  const subtitle = step === 'enter'
    ? "You'll enter this every time you open Finora"
    : 'Type the same 6 digits once more';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-pin-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: 'var(--overlay)', backdropFilter: 'blur(8px)' }}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canContinue && step === 'confirm') void persist(value);
        }}
        className="relative rounded-card w-[360px] max-w-full shadow-modal flex flex-col gap-4"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          padding: '22px 22px 18px',
        }}
      >
        <div className="flex flex-col items-center gap-2.5">
          {/* Brand shield icon — matches the Set PIN landing design. */}
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
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-1">
            <h3 id="set-pin-title" className="heading h3-modal m-0 text-center">{title}</h3>
            <p className="text-[13px] text-muted m-0 text-center">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <PinCells
            value={value}
            onChange={(next) => {
              if (step === 'enter') setEntered(next);
              else setConfirmed(next);
            }}
            shakeKey={shakeKey ?? undefined}
            hasError={!!error}
            disabled={submitting}
            ariaLabel={`${value.length} of ${PIN_LENGTH} digits entered`}
          />
          {error && (
            <div role="alert" className="text-[12px] text-danger font-semibold">
              {error}
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
          <Button
            variant="primary"
            type="submit"
            disabled={!canContinue}
            onClick={() => { if (canContinue && step === 'confirm') void persist(value); }}
          >
            {step === 'enter' ? 'Continue' : 'Save PIN'}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}