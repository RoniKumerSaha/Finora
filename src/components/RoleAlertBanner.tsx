/**
 * RoleAlertBanner — AD-11 error UI.
 *
 * Lives once at the App root. Subscribes to the Zustand banner slice so
 * any module can call `showBanner({what, why, fix})` and have it appear
 * at the top of the page with the correct ARIA semantics.
 *
 * v1 visual target: error cards look like the failure variants of the
 *   v1 .demo-banner + danger-text pieces — surface-2 bg, danger-soft
 *   overlay when destructive.
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
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg bg-danger-soft border border-danger rounded-card p-4 shadow-modal flex flex-col gap-1"
    >
      <div className="font-semibold">{banner.what}</div>
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
