/**
 * Toast — moment-of-success feedback channel.
 *
 * Mounted once at the top of the Shell layout. Auto-clears via a
 * setTimeout keyed on the toast id (so a second toast before the first
 * one finishes replaces it cleanly). Errors stay on the sticky banner
 * (top-center) — the two channels can render simultaneously during a
 * save→navigate transition.
 *
 * Duration: success/info 1500ms, error 4000ms. Per-toast override via
 * `durationMs`. Hover/focus re-arms the full dwell so long `why` text
 * can be read without losing the toast.
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../domain/store';

const DEFAULT_DWELL_MS = 1500;
const ERROR_DWELL_MS = 4000;

function defaultDwellMs(kind: 'success' | 'info' | 'error'): number {
  return kind === 'error' ? ERROR_DWELL_MS : DEFAULT_DWELL_MS;
}

export function Toast() {
  const toast = useStore(s => s.toast);
  const clearToast = useStore(s => s.clearToast);

  // Key timer by id so a new toast arriving mid-dwell cancels cleanly.
  const timerRef = useRef<{ id: string; handle: number } | null>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (!toast) return;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current.handle);
    }
    const dwell = toast.durationMs ?? defaultDwellMs(toast.kind);
    const handle = window.setTimeout(() => {
      clearToast();
      timerRef.current = null;
    }, dwell);
    timerRef.current = { id: toast.id, handle };
    return () => {
      window.clearTimeout(handle);
    };
  }, [toast?.id, toast?.durationMs, toast?.kind, hovering, clearToast]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;

  // Surface + accent bar by kind. The 3px left bar mirrors the banner's
  // left-edge accent so consecutive toast-after-banner reads as one system.
  const surface =
    toast.kind === 'success'
      ? 'bg-[var(--success-callout-bg)]'
      : toast.kind === 'error'
      ? 'bg-[var(--danger-callout-bg)]'
      : 'bg-surface';
  const accentBar =
    toast.kind === 'success'
      ? 'bg-success'
      : toast.kind === 'error'
      ? 'bg-danger'
      : 'bg-primary';
  const titleColor =
    toast.kind === 'success'
      ? 'text-success-title'
      : toast.kind === 'error'
      ? 'text-danger-title'
      : 'text-ink';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="toast-pop-in fixed top-4 right-4 z-50 min-w-[280px] max-w-[420px]"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div
        className={`relative ${surface} border border-border rounded-card shadow-modal pl-4 pr-4 py-3 flex items-start gap-3`}
      >
        <span aria-hidden className={`shrink-0 w-[3px] self-stretch rounded ${accentBar}`} />
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-semibold tracking-tight ${titleColor}`}>
            {toast.what}
          </div>
          {toast.why && (
            <div className="text-[12px] text-muted mt-0.5 leading-snug">{toast.why}</div>
          )}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              clearToast();
            }}
            className="shrink-0 self-center text-[12px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
