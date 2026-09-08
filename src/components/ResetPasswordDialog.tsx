/**
 * ResetPasswordDialog — modal that opens automatically after the user
 * clicks the password-recovery link in their email.
 *
 * Lifecycle:
 *   1. User clicks "Forgot password?" in SignInDialog → email is sent
 *      via syncEngine.resetPasswordForEmail().
 *   2. User taps the link in the email → Supabase redirects back to
 *      the app with `#access_token=...&type=recovery`.
 *   3. supabase-js detects the fragment (detectSessionInUrl: true) and
 *      fires `PASSWORD_RECOVERY` on our onAuthStateChange listener.
 *   4. App.tsx listens via syncEngine.onPasswordRecovery() and opens
 *      THIS dialog. The user enters a new password → calls
 *      syncEngine.updatePassword() → on success, toast + close.
 *
 * Cross-tab dedupe (see crossTabRecovery.ts): when the email link
 * opens in a NEW tab and the user already had the app open in
 * another tab, supabase-js's storage layer fires `PASSWORD_RECOVERY`
 * in BOTH tabs. To stop the duplicate dialog from appearing in the
 * old (signed-in) tab, we check `isOwnRecoveryUrl()` (only the
 * fragment-receiving tab owns the dialog) and listen for
 * `recovery-opened` from sibling tabs — whichever tab broadcasts
 * first keeps the dialog, others close.
 *
 * On successful update the dialog broadcasts `recovery-complete`;
 * sibling tabs (App.tsx) reload to pick up the new session.
 *
 * Pattern mirrors SignInDialog and ConfirmDialog: portal-rendered,
 * backdrop-blur, focus trap on the first input, Escape to cancel.
 * Reuses the existing Field/Input/Button primitives so the dialog
 * inherits the global visual language.
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
import {
  broadcast,
  clearRecoveryFragment,
  isOwnRecoveryUrl,
  subscribe,
  tabId,
  type RecoveryMsg,
} from './crossTabRecovery';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ResetPasswordDialog({ open, onClose }: Props) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  // Touched = the user has typed at least one character. We surface
  // the inline error after that so the dialog doesn't flash "required"
  // on the first keystroke.
  const [touched, setTouched] = useState(false);
  const showToast = useStore(s => s.showToast);

  // Keep `onClose` in a ref so the cross-tab listener below never sees
  // a stale closure (parents commonly pass a fresh function reference
  // each render, which would otherwise re-bind the BroadcastChannel
  // listener on every render).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // Cross-tab dedupe: if this tab didn't receive the recovery
    // fragment (i.e. another tab is handling it), close
    // immediately. The fragment-receiving tab is the canonical
    // handler — see crossTabRecovery.ts.
    if (!isOwnRecoveryUrl()) {
      // Defer so the caller doesn't see onClose fire synchronously
      // during the same render that opened the dialog.
      const id = window.setTimeout(() => onCloseRef.current(), 0);
      return () => window.clearTimeout(id);
    }

    // Announce we're opening the dialog. If a sibling tab beats us
    // to it, that tab broadcasts first → our listener closes us.
    const myTabId = tabId();
    broadcast({ type: 'recovery-opened', tabId: myTabId });

    // Reset state every time the dialog opens so a previous failed
    // submit doesn't bleed into the next attempt.
    setPassword('');
    setSubmitting(false);
    setPasswordError(undefined);
    setTouched(false);

    const focusId = window.setTimeout(() => passwordRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); }
    }
    document.addEventListener('keydown', onKey);

    // Listen for `recovery-opened` from OTHER tabs. If a different
    // tab opens the dialog first, close this one — we're a duplicate.
    const offMsg = subscribe((msg: RecoveryMsg) => {
      if (msg.type === 'recovery-opened' && msg.tabId !== myTabId) {
        onCloseRef.current();
      }
    });

    return () => {
      window.clearTimeout(focusId);
      document.removeEventListener('keydown', onKey);
      offMsg();
      // Clear the boot-time snapshot so a route change / re-mount
      // of App doesn't re-trigger this dialog. The live hash is
      // already cleared by supabase-js; this drops the fallback we
      // kept in `crossTabRecovery.ts` so `isOwnRecoveryUrl()`
      // answers consistently. Fires for every close path:
      // Escape, Cancel button, backdrop click, sibling tab's
      // `recovery-opened` message, AND successful `updatePassword`.
      clearRecoveryFragment();
    };
  }, [open]);

  // Live validity so the submit button disables the moment the
  // password becomes invalid (zod runs on every render — cheap).
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
      // Tell sibling tabs to reload — they may have been holding
      // the old session and stale store state. The dialog still
      // closes on this tab via the existing onClose() below.
      broadcast({ type: 'recovery-complete' });
      showToast({
        kind: 'success',
        what: 'Password updated',
        why: 'You\'re signed in with your new password.',
      });
      onClose();
    } catch (err) {
      // Most updateUser failures map to the password field (rate
      // limits, weak password on server, etc.). Fall through to
      // toast for anything we can't classify — keeps the dialog
      // honest about what the server actually rejected.
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
      aria-labelledby="reset-password-title"
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
        <h3 id="reset-password-title" className="heading h3-modal m-0 mb-2">
          Set a new password
        </h3>
        <p className="text-[13px] text-muted leading-relaxed mb-5">
          Choose a new password for your account. Use at least 8 characters.
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
              onChange={e => { setPassword(e.target.value); setTouched(true); if (passwordError) setPasswordError(undefined); }}
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
          <Button
            variant="primary"
            type="submit"
            disabled={!canSubmit}
          >
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
