/**
 * Toast.tsx — moment-of-success feedback channel.
 *
 * Top-right transient pop-up that stays ~2.4s, then fades. Used by
 * save-flow successes (see plan, step 2 — migrations). Errors stay on
 * the sticky banner (top-center) — the two channels can render
 * simultaneously during a save→navigate transition.
 *
 * Animations re-use the kind palette from `RoleAlertBanner` for visual
 * continuity. The toast surface uses the same callout bg as the
 * banner (success-callout-bg / danger-callout-bg / surface) so a
 * consecutive toast-after-banner moment reads as one continuous system,
 * not two unrelated channels.
 *
 * Mounted once at the top of the Shell layout. Auto-clears via a
 * setTimeout keyed on the toast id (so a second toast before the first
 * one finishes replaces it cleanly).
 */
import { useEffect, useRef } from 'react';
import { useStore } from '../domain/store';

const TOAST_DWELL_MS = 2400;

export function Toast() {
  const toast = useStore(s => s.toast);
  const clearToast = useStore(s => s.clearToast);

  // Track the most recent id we have a timer for, so a new toast
  // arriving mid-dwell cancels the old timer cleanly.
  const timerRef = useRef<{ id: string; handle: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    // Cancel any previous timer that's still pending.
    if (timerRef.current) {
      window.clearTimeout(timerRef.current.handle);
    }
    const handle = window.setTimeout(() => {
      clearToast();
      timerRef.current = null;
    }, TOAST_DWELL_MS);
    timerRef.current = { id: toast.id, handle };
    return () => {
      window.clearTimeout(handle);
    };
  }, [toast?.id, clearToast]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;

  // Surface + accent bar by kind. Real surfaces (not tints) so the
  // toast reads as a distinct surface against the page. The 3px left
  // bar mirrors the banner's left-edge accent.
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
