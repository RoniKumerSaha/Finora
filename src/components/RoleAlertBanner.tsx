/**
 * RoleAlertBanner — AD-11 error UI.
 *
 * Lives once at the App root. Subscribes to the Zustand banner slice so
 * any module can call `showBanner({what, why, fix})` and have it appear
 * at the top of the page with the correct ARIA semantics.
 *
 * Inline field errors are handled by `useFieldErrors` in the form layer
 * (AD-19) — this banner is for async / system errors only.
 */

import { useEffect } from 'react';
import { useStore } from '../domain/store';

export function RoleAlertBanner() {
  const banner = useStore(s => s.banner);
  const dismiss = useStore(s => s.clearBanner);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => dismiss(), 12000); // auto-dismiss after 12s
    return () => clearTimeout(t);
  }, [banner, dismiss]);

  if (!banner) return null;
  return (
    <div
      role="alert"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg bg-danger-soft border border-danger rounded-lg p-4 shadow-lg flex flex-col gap-1"
    >
      <div><strong>{banner.what}</strong></div>
      <div className="text-sm text-muted">{banner.why}</div>
      <div className="text-sm">{banner.fix}</div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-3 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}