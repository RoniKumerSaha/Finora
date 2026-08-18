/**
 * format.ts — display helpers shared across screens.
 *
 * Keeps every screen aligned with the v2 mockup:
 *   - `৳ 3,500` (BDT after a space, en-IN grouping) for plain values
 *   - `+ ৳ 3,500` / `− ৳ 3,500` (sign-amount with a space after the
 *     sign and after `৳`) for income/expense rows
 *   - "12 Aug 2026" for friendly date display (mockup uses short month)
 *   - "Aug 12" style for table rows where space is tight
 *
 * Pure functions, no DOM, no store. Treeshake-safe — every screen
 * imports only what it uses.
 */

/** Plain BDT: `৳ 3,500`. No sign. */
export function fmtBDT(n: number | string): string {
  const v = Math.round(Number(n) || 0);
  return '\u09F3 ' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/**
 * Signed BDT: `+ ৳ 3,500` / `− ৳ 3,500` / `৳ 3,500` (no sign).
 * Transfer rows pass 'xfr' to render an arrow without sign color.
 */
export function fmtBDTSigned(n: number | string, sign: 'in' | 'out' | 'xfr' = 'in'): string {
  const abs = Math.round(Math.abs(Number(n) || 0));
  const body = '\u09F3 ' + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  if (sign === 'xfr') return '\u21C4 ' + body;
  if (sign === 'out') return '\u2212 ' + body;
  return '+ ' + body;
}

/** "12 Aug 2026" — short month, no weekday, day-month-year. */
export function fmtDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso + 'T00:00:00Z') : iso;
  if (isNaN(d.getTime())) return String(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = d.getUTCDate();
  const mon = months[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  return `${day} ${mon} ${yr}`;
}

/** "Aug 12" — table cell with no year (assumes same year). */
export function fmtDateShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso + 'T00:00:00Z') : iso;
  if (isNaN(d.getTime())) return String(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = d.getUTCDate();
  const mon = months[d.getUTCMonth()];
  return `${mon} ${day}`;
}

/** Today / Yesterday / N days ago — for compact hover labels. */
export function fmtRelative(iso: string | Date, now: Date = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso + 'T00:00:00Z') : iso;
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return `${days}d ago`;
  return fmtDate(iso);
}

/**
 * "Just now" / "5 minutes ago" / "2 hours ago" / "3 days ago" — for the
 * Cloud backup "Last saved" line. Accepts ISO timestamps with time
 * (modifiedTime from Drive). Returns short, human-friendly text.
 *
 * Empty / undefined input falls back to "Never" so the UI can short-circuit
 * without a separate branch.
 */
export function fmtRelativeShort(iso: string | undefined | null, now: Date = new Date()): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return 'Just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  return fmtDate(iso);
}

/**
 * Reject negatives at the input boundary so users can't sneak one past
 * the field. Empty string / lone minus normalises to 0 so the controlled
 * value always parses as a finite non-negative number.
 */
export function clampNonNegative(raw: string): number {
  if (raw === '' || raw === '-') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}
