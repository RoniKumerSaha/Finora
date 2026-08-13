/**
 * ConfirmDialog — modal for destructive actions (AD-11).
 *
 * Per PRD §11: destructive confirms (delete account, delete debt, wipe
 * data, replace-on-import) use a modal with Cancel | Confirm. No toast.
 *
 * Usage:
 *   const ok = await confirm({ title: 'Delete account?', danger: true });
 *   if (ok) doDelete();
 *
 * Renders as a controlled promise. Focus-traps inside the modal, Escape
 * cancels, click on backdrop cancels.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
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
      if (e.key === 'Tab') {
        // Focus trap: only the two buttons are focusable.
        if (document.activeElement?.tagName === 'BUTTON') return;
        e.preventDefault();
        cancelRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onAnswer]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0" style={{ background: 'var(--overlay)', backdropFilter: 'blur(6px)' }} onClick={() => onAnswer(false)} />
      <div className="relative bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 id="confirm-title" className="text-lg font-semibold mb-2">{opts.title}</h3>
        {opts.body && <div className="text-sm text-muted mb-6">{opts.body}</div>}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            ref={cancelRef}
            onClick={() => onAnswer(false)}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-surface-2 text-ink border border-border hover:bg-surface-3"
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