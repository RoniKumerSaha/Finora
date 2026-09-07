/**
 * SignInDialog — modal for entering an email to receive a magic link.
 *
 * Invoked from `AccountSection` when the user clicks "Send magic link".
 * On submit, calls `syncEngine.signIn(email)` and shows a toast;
 * `onSuccess` lets the parent reset its UI state.
 *
 * Pattern mirrors `ConfirmDialog`: portal-rendered, backdrop-blur,
 * focus trap on the input, Escape to cancel. Reuses the existing
 * button + field primitives so the dialog inherits the global visual
 * language with no new design tokens.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Input } from './Field';
import { syncEngine } from '../domain/sync';
import { formatSyncError } from '../lib/errors';
import { useStore } from '../domain/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SignInDialog({ open, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const showToast = useStore(s => s.showToast);

  useEffect(() => {
    if (!open) return;
    // Focus the email input on open; reset the field every time.
    setEmail('');
    setSubmitting(false);
    // Wait one frame for the portal to mount before focusing.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
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
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await syncEngine.signIn(trimmed);
      showToast({
        kind: 'success',
        what: 'Sign-in link sent',
        why: `Check ${trimmed} for a link from Supabase.`,
      });
      onClose();
    } catch (err) {
      const formatted = formatSyncError(err);
      showToast({
        kind: 'error',
        what: formatted.what,
        why: formatted.why,
      });
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
        <h3 id="signin-title" className="heading h3-modal m-0 mb-2">Sign in to sync</h3>
        <p className="text-[13px] text-muted leading-relaxed mb-5">
          Enter your email — we'll send you a magic link. Click it on this device to sign in.
        </p>
        <Input
          ref={inputRef}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={submitting}
          aria-label="Email address"
        />
        <div className="flex gap-2.5 justify-end mt-5">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitting || !email.trim()}>
            {submitting ? 'Sending…' : 'Send magic link'}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
