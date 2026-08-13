/**
 * ConfirmDialog — modal for destructive actions (AD-11).
 *
 * v1 visual target: docs/ux-designs/.../mockups/v1/index.html
 *   - backdrop:  rgba(15,20,25,.6) + 6px blur
 *   - modal:     bg-surface, border-border, radius 24px (r-card),
 *                padding 28px, width 420px, shadow-modal
 *   - h3:        18px font, no margin below
 *   - body:      13px muted, 18px margin below
 *   - actions:   right-aligned, 10px gap
 *   - danger:    danger-soft bg, danger border-radius-8, padding 10×12
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

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onAnswer(false); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onAnswer]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={() => onAnswer(false)}
        className="absolute inset-0 cursor-default"
        style={{ background: 'var(--overlay)', backdropFilter: 'blur(6px)' }}
      />
      <div className="relative bg-surface border border-border rounded-card p-7 w-[420px] max-w-[90vw] shadow-modal">
        <h3 id="confirm-title" className="text-lg font-semibold m-0 mb-1">{opts.title}</h3>
        {opts.body && <div className="text-[13px] text-muted m-0 mb-4">{opts.body}</div>}
        {opts.dangerText && (
          <div className="text-[13px] text-danger bg-danger-soft border border-danger rounded-lg px-3 py-2.5 mb-2.5">
            {opts.dangerText}
          </div>
        )}
        <div className="flex gap-2.5 justify-end mt-5">
          <button
            type="button"
            ref={cancelRef}
            onClick={() => onAnswer(false)}
            className="inline-flex items-center justify-center px-[18px] py-3 rounded-btn font-bold text-sm bg-surface text-ink border border-border hover:bg-surface-2 transition"
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
