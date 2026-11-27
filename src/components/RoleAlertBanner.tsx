/**
 * RoleAlertBanner — AD-11 error UI.
 *
 * Lives once at the App root. Subscribes to the Zustand banner slice
 * so any module can call `showBanner({what, why, fix, kind?})`.
 *
 * Duration: success/info 3000ms, error 6000ms. Per-banner override
 * via `durationMs`. Hover/focus re-arms the timer (matches Toast) so
 * long error fixes can be read mid-flow.
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../domain/store';
import type { BannerKind } from '../domain/types';
import { Close } from './icons/Icons';

const DEFAULT_TOTAL_MS = 3000;
const ERROR_TOTAL_MS = 6000;
const FADE_OUT_MS = 400;

function defaultTotalMs(kind: BannerKind): number {
  return kind === 'error' ? ERROR_TOTAL_MS : DEFAULT_TOTAL_MS;
}

export function RoleAlertBanner() {
  const banner = useStore(s => s.banner);
  const dismiss = useStore(s => s.clearBanner);
  const [fading, setFading] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Hold both timers so a banner swap cancels the prior fade/unmount cleanly.
  const timersRef = useRef<{ fade: number; unmount: number } | null>(null);

  useEffect(() => {
    if (!banner) return;
    if (timersRef.current) {
      window.clearTimeout(timersRef.current.fade);
      window.clearTimeout(timersRef.current.unmount);
    }
    setFading(false);
    const total = banner.durationMs ?? defaultTotalMs(banner.kind ?? 'info');
    const fade = window.setTimeout(() => setFading(true), total - FADE_OUT_MS);
    const unmount = window.setTimeout(() => dismiss(), total);
    timersRef.current = { fade, unmount };
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(unmount);
    };
  }, [banner?.id, banner?.durationMs, banner?.kind, hovering, dismiss]);

  if (!banner) return null;
  const kind: BannerKind = banner.kind ?? 'info';

  const colorBar =
    kind === 'success' ? 'var(--success)' :
    kind === 'error'   ? 'var(--danger)'  : 'var(--primary)';

  return (
    <div
      role="alert"
      className={[
        'fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg',
        'rounded-card px-4 py-3.5 flex flex-col gap-1',
        'transition-opacity duration-400 ease-out',
        fading ? 'opacity-0' : 'opacity-100',
        styleFor(kind),
      ].join(' ')}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      style={{
        animation: 'banner-slide-in 200ms ease-out both',
        boxShadow: 'var(--shadow-modal)',
        borderLeft: `3px solid ${colorBar}`,
      }}
    >
      <div className={`font-semibold t-13 ${titleFor(kind)}`}>{banner.what}</div>
      <div className="t-12 text-muted leading-snug">{banner.why}</div>
      <div className="t-12 text-ink leading-snug">{banner.fix}</div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2.5 right-3 w-7 h-7 inline-flex items-center justify-center rounded-md t-13 text-muted hover:bg-surface-3 hover:text-ink transition"
      >
        <Close className="w-4 h-4" />
      </button>
    </div>
  );
}

function styleFor(kind: BannerKind): string {
  if (kind === 'success') return 'border border-success bg-[var(--success-callout-bg)]';
  if (kind === 'error')   return 'border border-danger bg-[var(--danger-callout-bg)]';
  return 'border border-border bg-surface';
}

function titleFor(kind: BannerKind): string {
  if (kind === 'success') return 'text-[var(--success-title)]';
  if (kind === 'error')   return 'text-[var(--danger-title)]';
  return 'text-ink';
}