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
 * 2026-08-14 polish: a left-edge accent bar keyed to the kind, refined
 * shadow, and a more compact action row.
 *
 * Animation: slides in from above (translateY(-12px → 0) over 200ms)
 * via the `banner-slide-in` keyframe in app.css. Fades out over 400ms
 * starting at 8.6s, then unmounts at 9s. The user can also click the
 * X to dismiss instantly. Longer total life (9s) gives users with
 * slower reading speeds a fair chance to absorb the what/why/fix.
 */
import { useEffect, useState } from 'react';
import { useStore } from '../domain/store';
import type { BannerKind } from '../domain/types';

const FADE_OUT_MS = 400;
const TOTAL_MS = 9000;

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
      style={{
        animation: 'banner-slide-in 200ms ease-out both',
        boxShadow: 'var(--shadow-modal)',
        borderLeft: `3px solid ${colorBar}`,
      }}
    >
      <div className={`font-semibold text-[14px] ${titleFor(kind)}`}>{banner.what}</div>
      <div className="text-[12.5px] text-muted leading-snug">{banner.why}</div>
      <div className="text-[12.5px] text-ink leading-snug">{banner.fix}</div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2.5 right-3 w-7 h-7 inline-flex items-center justify-center rounded-md text-sm text-muted hover:bg-surface-3 hover:text-ink transition"
      >
        {'\u2715'}
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