/**
 * envCheck.ts — runtime environment checks for the Cloud backup feature.
 *
 * GD-4.1: the Google OAuth redirect flow requires an http(s) origin. When
 * the app is opened from `file://`, the GIS popup cannot complete its
 * redirect. `isFileProtocol()` exposes a testable predicate so callers
 * can short-circuit the Cloud section before any GIS work begins.
 *
 * GD-4.3: defaults for the feature flag and OAuth client id.
 */

/**
 * True when the current page is served from `file://`. Used to hide the
 * Cloud backup section so users don't see a broken connect button on a
 * static download of the app.
 *
 * `window` is referenced defensively — the Cloud module is imported from
 * non-DOM contexts (node-only test setup, SSR) and we don't want this to
 * throw on import.
 */
export function isFileProtocol(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.location?.protocol === 'file:';
  } catch {
    return false;
  }
}

/**
 * Resolve the default for the Cloud feature flag from the build env.
 * Default `false` so the Cloud section stays hidden until the team
 * flips it on.
 */
export function readFeatureFlagDefault(): boolean {
  if (typeof import.meta !== 'undefined') {
    const v = (import.meta as any).env?.VITE_FEATURE_GDRIVE_SYNC;
    if (typeof v === 'string') return v === 'true';
  }
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const v = proc?.env?.VITE_FEATURE_GDRIVE_SYNC;
  return v === 'true';
}

/**
 * Resolve the default for the Google OAuth client id. Empty string when
 * unset — the section can render but `connect()` will reject.
 */
export function readClientIdDefault(): string {
  if (typeof import.meta !== 'undefined') {
    const v = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (typeof v === 'string') return v;
  }
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.VITE_GOOGLE_CLIENT_ID ?? '';
}