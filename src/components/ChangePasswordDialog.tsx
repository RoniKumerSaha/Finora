/**
 * ChangePasswordDialog — in-app modal for signed-in users to change
 * their Supabase password without going through the email round-trip.
 *
 * The email-link recovery flow (RecoveryResetDialog → see
 * ResetPasswordDialog) handles the "I forgot my password" case where
 * the user is signed out. THIS dialog handles the "I'm signed in and
 * want to update my password" case, which is the common one once
 * someone is already using the app. Two flows, two dialogs, same
 * underlying `syncEngine.updatePassword()` call.
 *
 * Why a separate dialog rather than reusing ResetPasswordDialog?
 * ResetPasswordDialog has cross-tab dedupe machinery
 * (`isOwnRecoveryUrl()`, `recovery-opened` broadcast) that doesn't
 * apply when the user is actively signed in and explicitly opened
 * the modal — those checks would either be no-ops (live hash is
 * empty for non-recovery opens) or fire spuriously. Keeping the
 * two paths separate also keeps the recovery-flow tests focused.
 *
 * Pattern mirrors SignInDialog / ResetPasswordDialog: portal-rendered,
 * backdrop-blur, focus trap on first input, Escape to cancel. Reuses
 * the Field/Input/Button primitives.
 */
import { useEffect, useRef, useState } from 'react';
import type { ZodIssue } from 'zod';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Field, Input } from './Field';
import { syncEngine } from '../domain/sync';
import { formatSyncError } from '../lib/errors';
import { passwordSchema } from '../lib/schemas';
import { useStore } from '../domain/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordDialog({ open, onClose }: Props) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  // Touched = user has typed at least one character. We surface the
  // inline error after that so the dialog doesn't flash "required"
  // on the first keystroke.
  const [touched, setTouched] = useState(false);
  const showToast = useStore(s => s.showToast);

  // Reset state every time the dialog opens so a previous failed
  // submit doesn't bleed into the next attempt.
  useEffect(() => {
    if (!open) return;
    setPassword('');
    setSubmitting(false);
    setPasswordError(undefined);
    setTouched(false);
    const focusId = window.setTimeout(() => passwordRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusId);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Live validity so the submit button disables the moment the
  // password becomes invalid.
  const passwordValid = passwordSchema.safeParse(password).success;
  const livePasswordError =
    passwordError ??
    (touched && !passwordValid
      ? (passwordSchema.safeParse(password).error!.issues[0] as ZodIssue).message
      : undefined);
  const canSubmit = passwordValid && !submitting;

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      const issue = result.error.issues[0] as ZodIssue;
      setPasswordError(issue.message);
      return;
    }
    const cleanPassword = result.data;
    setPasswordError(undefined);
    setSubmitting(true);

    try {
      await syncEngine.updatePassword(cleanPassword);
      showToast({
        kind: 'success',
        what: 'Password updated',
        why: 'You\'re signed in with your new password.',
      });
      onClose();
    } catch (err) {
      // Most updateUser failures map to the password field (rate
      // limits, weak password on server, etc.). Fall through to
      // toast for anything we can't classify.
      const formatted = formatSyncError(err);
      const msg = (formatted.what || '').toLowerCase();
      if (/password/.test(msg)) {
        setPasswordError(formatted.what);
      } else {
        showToast({ kind: 'error', what: formatted.what, why: formatted.why });
      }
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(8px)',
          animation: 'backdrop-fade-in 180ms ease-out both',
        }}
      />
      <form
        onSubmit={onSubmit}
        className="relative rounded-card w-[440px] max-w-full shadow-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal), var(--card-inset)',
          padding: '28px',
          animation: 'modal-pop-in 180ms ease-out both',
        }}
      >
        <h3 id="change-password-title" className="heading h3-modal m-0 mb-2">
          Change password
        </h3>
        <p className="text-[13px] text-muted leading-relaxed mb-5">
          Choose a new password for your account. Use at least 8 characters.
          You'll stay signed in on this device.
        </p>

        <div className="flex flex-col gap-4">
          <Field label="New password" error={livePasswordError}>
            <Input
              ref={passwordRef}
              type="password"
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setTouched(true);
                if (passwordError) setPasswordError(undefined);
              }}
              disabled={submitting}
              aria-label="New password"
              aria-invalid={Boolean(livePasswordError)}
            />
          </Field>
        </div>

        <div className="flex gap-2.5 justify-end mt-6">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!canSubmit}>
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
