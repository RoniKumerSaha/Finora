/**
 * ConfirmDialog — modal for destructive actions (AD-11).
 *
 * 2026-08-14 polish: tighter modal width (440px), refined title weight,
 * a single action row, and a danger-callout body that uses the global
 * "real surface" contract (no transparent tints).
 *
 * Per PRD §11: destructive confirms (delete account, delete debt, wipe
 * data, replace-on-import) use a modal with Cancel | Confirm. No toast.
 *
 * Usage:
 *   const ok = await confirm({ title: 'Delete account?', danger: true });
 *   if (ok) doDelete();
 *
 * Renders as a controlled promise. Escape cancels, click on backdrop
 * cancels, Tab is a no-op (only two focusable controls).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  dangerText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  function confirm(options: ConfirmOptions): Promise<boolean> {
    setOpts(options);
    return new Promise(resolve => { resolver.current = resolve; });
  }

  function answer(v: boolean) {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }

  const dialog = opts ? <ConfirmDialog opts={opts} onAnswer={answer} /> : null;
  return { confirm, dialog };
}

function ConfirmDialog({ opts, onAnswer }: { opts: ConfirmOptions; onAnswer: (v: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Keep the latest onAnswer in a ref so the keyboard handler below
  // never sees a stale closure, without re-running on every parent render
  // (parents commonly pass a fresh `answer` reference each render, which
  // would otherwise re-trigger the focus shift below).
  const onAnswerRef = useRef(onAnswer);
  useEffect(() => { onAnswerRef.current = onAnswer; }, [onAnswer]);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onAnswerRef.current(false); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={() => onAnswer(false)}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(8px)',
          animation: 'backdrop-fade-in 180ms ease-out both',
        }}
      />
      <div
        className="relative rounded-card w-[440px] max-w-full shadow-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal), var(--card-inset)',
          padding: '28px',
          animation: 'modal-pop-in 180ms ease-out both',
        }}
      >
        <h3
          id="confirm-title"
          className="heading h3-modal m-0"
          style={{ marginBottom: opts.body || opts.dangerText ? '12px' : '20px' }}
        >
          {opts.title}
        </h3>
        {opts.body && (
          <div className="text-[13.5px] text-muted leading-relaxed m-0 mb-4">
            {opts.body}
          </div>
        )}
        {opts.dangerText && (
          <div
            className="text-[13px] text-ink rounded-btn px-3.5 py-2.5 mb-5"
            style={{
              background: 'var(--danger-callout-bg)',
              border: '1px solid var(--danger)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)',
              color: 'var(--danger-title)',
            }}
          >
            {opts.dangerText}
          </div>
        )}
        <div className="flex gap-2.5 justify-end mt-5">
          <button
            type="button"
            ref={cancelRef}
            onClick={() => onAnswer(false)}
            className="inline-flex items-center justify-center px-[18px] py-2.5 rounded-btn font-bold text-sm bg-surface text-ink border border-border hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {opts.cancelLabel ?? 'Cancel'}
          </button>
          <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => onAnswer(true)}>
            {opts.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}