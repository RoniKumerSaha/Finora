/**
 * RoleAlertBanner — AD-11 error UI.
 *
 * Lives once at the App root. Subscribes to the Zustand banner slice so
 * any module can call `showBanner({what, why, fix, kind?})` and have it
 * appear at the top of the page with the correct ARIA semantics.
 *
 * Visual treatment is kind-aware:
 *   - success: opaque sage callout (var(--success-callout-bg)) with
 *              --success-title accent and success border
 *   - info:    opaque surface-2 with neutral ink + border
 *   - error:   opaque red callout (var(--danger-callout-bg)) with
 *              --danger-title accent and danger border
 * No transparent tones — banner must not bleed through to the page
 * beneath it.
 *
 * Auto-dismiss: 6 seconds. The banner fades out over 300ms starting at
 * 5.7s, then unmounts. The user can also click the X to dismiss
 * instantly.
 */
import { useEffect, useState } from 'react';
import { useStore } from '../domain/store';
import type { BannerKind } from '../domain/types';

const FADE_OUT_MS = 300;
const TOTAL_MS = 6000;

export function RoleAlertBanner() {
  const banner = useStore(s => s.banner);
  const dismiss = useStore(s => s.clearBanner);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!banner) return;
    setFading(false);
    const fadeT = setTimeout(() => setFading(true), TOTAL_MS - FADE_OUT_MS);
    const unmountT = setTimeout(() => dismiss(), TOTAL_MS);
    return () => {
      clearTimeout(fadeT);
      clearTimeout(unmountT);
    };
  }, [banner, dismiss]);

  if (!banner) return null;
  const kind: BannerKind = banner.kind ?? 'info';

  return (
    <div
      role="alert"
      className={[
        'fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg',
        'rounded-card p-4 shadow-modal flex flex-col gap-1',
        'transition-opacity duration-300',
        fading ? 'opacity-0' : 'opacity-100',
        styleFor(kind),
      ].join(' ')}
    >
      <div className={`font-semibold ${titleFor(kind)}`}>{banner.what}</div>
      <div className="text-[13px] text-muted">{banner.why}</div>
      <div className="text-[13px]">{banner.fix}</div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2.5 right-3 w-7 h-7 inline-flex items-center justify-center rounded-md text-lg leading-none hover:bg-surface-3"
      >
        {'\u2715'}
      </button>
    </div>
  );
}

function styleFor(kind: BannerKind): string {
  if (kind === 'success') {
    return 'border border-success bg-[var(--success-callout-bg)]';
  }
  if (kind === 'error') {
    return 'border border-danger bg-[var(--danger-callout-bg)]';
  }
  return 'border border-border bg-surface-2';
}

function titleFor(kind: BannerKind): string {
  if (kind === 'success') return 'text-[var(--success-title)]';
  if (kind === 'error') return 'text-[var(--danger-title)]';
  return 'text-ink';
}