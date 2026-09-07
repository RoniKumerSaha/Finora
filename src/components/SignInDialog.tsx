/**
 * SignInDialog — modal for signing in or creating a cloud-sync account.
 *
 * Two modes in one dialog, toggled at the top:
 *   - "Sign in"      → `syncEngine.signInWithPassword(email, password)`
 *   - "Create account" → `syncEngine.signUpWithPassword(email, password)`
 *
 * The toggle replaces the prior magic-link flow (no more email
 * round-trip). On a successful sign-up with `requiresEmailConfirmation`
 * true (hosted Supabase with email-verification enabled), the dialog
 * shows a "Check your email" toast and closes — the user clicks the
 * confirmation link and lands back signed in.
 *
 * Validation: zod schemas in `src/lib/schemas.ts` (emailSchema +
 * passwordSchema). Failures render three-part inline errors below each
 * field. Server-side auth failures (wrong password, account exists,
 * rate-limited) flow through `formatSyncError` and surface as toasts
 * so the dialog stays focused on the form.
 *
 * Pattern mirrors the prior dialog and `ConfirmDialog`: portal-rendered,
 * backdrop-blur, focus trap on the first input, Escape to cancel.
 * Reuses the existing button + field primitives so the dialog inherits
 * the global visual language with no new design tokens.
 */
import { useEffect, useRef, useState } from 'react';
import type { ZodIssue } from 'zod';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Field, Input } from './Field';
import { syncEngine } from '../domain/sync';
import { formatSyncError } from '../lib/errors';
import { emailSchema, passwordSchema } from '../lib/schemas';
import { useStore } from '../domain/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Mode = 'signIn' | 'signUp';

interface FieldErrors {
  email?: string;
  password?: string;
  /** Server-side errors that don't map cleanly to a single field
   *  (e.g. "Email not confirmed", rate limits, generic network
   *  failures). Rendered at the top of the form. */
  form?: string;
}

export function SignInDialog({ open, onClose }: Props) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Touched = the user has interacted with this field. We flip this
  // on the first keystroke rather than on blur so the inline error
  // appears in real time as the user finishes typing, without
  // requiring them to leave the field first.
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const showToast = useStore(s => s.showToast);

  useEffect(() => {
    if (!open) return;
    // Reset state every time the dialog opens so a previous failed
    // submit doesn't bleed into the next attempt.
    setMode('signIn');
    setEmail('');
    setPassword('');
    setSubmitting(false);
    setFieldErrors({});
    setTouched({});
    const id = window.setTimeout(() => emailRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Client-side validation first — fail fast on the cheap checks so
    // we never hit the network with malformed inputs.
    const emailResult = emailSchema.safeParse(email);
    const passwordResult = passwordSchema.safeParse(password);
    const errors: FieldErrors = {};
    if (!emailResult.success) {
      const issue = emailResult.error.issues[0] as ZodIssue;
      errors.email = issue.message;
    }
    if (!passwordResult.success) {
      const issue = passwordResult.error.issues[0] as ZodIssue;
      errors.password = issue.message;
    }
    if (errors.email || errors.password) {
      setFieldErrors(errors);
      return;
    }
    // Validate-and-narrow in one place. TS doesn't carry the
    // `.success === true` narrowing across the early-return above, so
    // re-check and assert. These values are non-null because we just
    // confirmed safeParse succeeded.
    if (!emailResult.success || !passwordResult.success) return;
    const cleanEmail = emailResult.data;
    const cleanPassword = passwordResult.data;
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (mode === 'signIn') {
        await syncEngine.signInWithPassword(cleanEmail, cleanPassword);
        onClose();
      } else {
        const { requiresEmailConfirmation } = await syncEngine.signUpWithPassword(
          cleanEmail,
          cleanPassword,
        );
        if (requiresEmailConfirmation) {
          showToast({
            kind: 'info',
            what: 'Check your email',
            why: `We sent a confirmation link to ${emailResult.data}. Click it to finish creating your account.`,
          });
          onClose();
        } else {
          // Local stack auto-confirms — the engine's onAuthStateChange
          // has already flipped to signed-in. Match the toast shape so
          // the user sees the same positive feedback either way.
          showToast({
            kind: 'success',
            what: 'Account created',
            why: 'You\'re signed in and cloud sync is ready.',
          });
          onClose();
        }
      }
    } catch (err) {
      // Map the server error to the most likely field so the user
      // sees it where they're looking. Toast is reserved for
      // server-side errors that don't map to a specific field (e.g.
      // rate limits, network blips) so the user still gets the
      // feedback somewhere prominent.
      const inline = mapAuthErrorToField(err, mode);
      if (inline) {
        setFieldErrors(inline);
      } else {
        const formatted = formatSyncError(err);
        showToast({
          kind: 'error',
          what: formatted.what,
          why: formatted.why,
        });
      }
      setSubmitting(false);
    }
  }

  const isSignIn = mode === 'signIn';
  const headline = isSignIn ? 'Sign in to sync' : 'Create your account';
  const subtitle = isSignIn
    ? 'Sign in with the email and password you used when you created your account.'
    : 'Pick an email and a password — you\'ll use these to sign in on every device.';

  // Live validity so the submit button disables the moment a field
  // becomes invalid (zod runs on every render — cheap, two fields).
  const emailValid = emailSchema.safeParse(email).success;
  const passwordValid = passwordSchema.safeParse(password).success;
  const canSubmit = emailValid && passwordValid && !submitting;

  // Live client-side errors — only surfaced after the field has been
  // touched (focused then blurred) so we don't flash "required" on the
  // first keystroke. Server-side errors in `fieldErrors.email` /
  // `fieldErrors.password` always win because they describe the
  // authoritative failure (wrong password, email taken, etc.).
  const emailError =
    fieldErrors.email ??
    (touched.email && !emailValid
      ? (emailSchema.safeParse(email).error!.issues[0] as ZodIssue).message
      : undefined);
  const passwordError =
    fieldErrors.password ??
    (touched.password && !passwordValid
      ? (passwordSchema.safeParse(password).error!.issues[0] as ZodIssue).message
      : undefined);

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-title"
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
        <h3 id="signin-title" className="heading h3-modal m-0 mb-2">{headline}</h3>
        <p className="text-[13px] text-muted leading-relaxed mb-5">{subtitle}</p>

        {/* Mode toggle — two pill-style buttons. Keeps the dialog to a
            single screen so users don't have to navigate between two
            separate flows. */}
        <div
          role="tablist"
          aria-label="Sign-in mode"
          className="flex rounded-btn p-1 mb-5"
          style={{ background: 'var(--surface-2)' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={isSignIn}
            onClick={() => { if (!submitting) setMode('signIn'); }}
            disabled={submitting}
            className={[
              'flex-1 px-3 py-1.5 rounded-btn text-[12.5px] font-semibold transition',
              isSignIn
                ? 'bg-surface text-ink shadow-[var(--shadow-inset)]'
                : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isSignIn}
            onClick={() => { if (!submitting) setMode('signUp'); }}
            disabled={submitting}
            className={[
              'flex-1 px-3 py-1.5 rounded-btn text-[12.5px] font-semibold transition',
              !isSignIn
                ? 'bg-surface text-ink shadow-[var(--shadow-inset)]'
                : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            Create account
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {fieldErrors.form && (
            <div
              role="alert"
              className="rounded-btn px-3.5 py-2.5 text-[12.5px] text-danger leading-snug"
              style={{
                background: 'var(--danger-callout-bg)',
                border: '1px solid var(--danger)',
              }}
            >
              {fieldErrors.form}
            </div>
          )}
          <Field label="Email" error={emailError}>
            <Input
              ref={emailRef}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setTouched(t => ({ ...t, email: true })); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: undefined })); }}
              disabled={submitting}
              aria-label="Email address"
              aria-invalid={Boolean(emailError)}
            />
          </Field>
          <Field label="Password" error={passwordError}>
            <Input
              type="password"
              required
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              placeholder={isSignIn ? 'Your password' : 'At least 8 characters'}
              value={password}
              onChange={e => { setPassword(e.target.value); setTouched(t => ({ ...t, password: true })); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
              disabled={submitting}
              aria-label="Password"
              aria-invalid={Boolean(passwordError)}
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
            {submitting
              ? (isSignIn ? 'Signing in…' : 'Creating account…')
              : (isSignIn ? 'Sign in' : 'Create account')}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/**
 * Map a thrown auth error to the most likely field so the user sees
 * the diagnostic inline next to the input that needs fixing. Returns
 * `null` for errors that don't map cleanly (network failures, rate
 * limits, "Email not confirmed") — those go through the toast layer
 * so the user still gets prominent feedback.
 *
 * Supabase's `AuthApiError` carries both a human-readable `message`
 * and a `status`. The mapping is intentionally keyword-based — the
 * upstream message strings are stable across GoTrue versions.
 */
function mapAuthErrorToField(err: unknown, mode: Mode): FieldErrors | null {
  const msg = ((err as { message?: string })?.message || '').toLowerCase();
  const status = (err as { status?: number })?.status;
  if (!msg && status == null) return null;

  // Password-specific (sign-up only — Supabase enforces the server
  // floor on creation). Applies to mode === 'signUp'.
  if (mode === 'signUp' && /password/.test(msg)) {
    return { password: 'Password doesn\'t meet the server\'s requirements.' };
  }

  // Email taken — only on sign-up. Surface inline so the user can
  // either switch to "Sign in" mode or pick a different address.
  if (mode === 'signUp' && (status === 422 || /already (registered|exists)/.test(msg))) {
    return { email: 'An account with this email already exists. Try signing in instead.' };
  }

  // Sign-in only: Supabase returns "Invalid login credentials" for
  // both "no such email" and "wrong password" — by design, to avoid
  // leaking which accounts exist. We attribute it to the email field
  // because (a) it's the field the user typed first, (b) most
  // sign-in failures are typo'd emails, and (c) it nudges the user
  // toward "Sign in with the right email" rather than "guess your
  // password again".
  if (mode === 'signIn' && (status === 400 || /invalid login credentials|invalid credentials/.test(msg))) {
    return { email: 'That email and password don\'t match. Try again.' };
  }

  // Email-shape validation from the server (shouldn't normally fire
  // because we validate client-side, but defensive).
  if (/email/.test(msg) && (status === 422 || /invalid email/.test(msg))) {
    return { email: 'Enter a valid email address.' };
  }

  // Everything else (rate limits, network, server errors) falls
  // through to the toast layer.
  return null;
}
