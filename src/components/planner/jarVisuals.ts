/**
 * jarVisuals — shared visual helpers for the Month Planner jars and
 * the Event Planner categories. Single source for the colour ramp,
 * the percent formatter, and the status pill style so the two
 * planners stay visually consistent.
 *
 * Progression ramp (4 stops):
 *     0–29%  green   — on track, lots of headroom
 *    30–59%  yellow  — moving along
 *    60–99%  orange  — nearly full, watch the spend
 *   ≥100%    red     — overflowing
 *
 * This 4-stop fillStatus is what the summary strip / timeline uses.
 * The category-card palette below has the same thresholds but maps
 * to the user-visible blue → cyan → green → deep-orange band so the
 * planner ring reads as a clear progression rather than traffic-light
 * health.
 */
import type { CSSProperties } from 'react';
import type { CardTone } from '../../lib/cardSurface';

export type FillStatus = 'empty' | 'green' | 'yellow' | 'orange' | 'red';

/** Map a planned ÷ budget ratio to a 4-step colour ramp. */
export function fillStatus(pct: number, overflow: boolean, budget: number): FillStatus {
  if (budget <= 0) return 'empty';
  if (overflow) return 'red';
  if (pct >= 60) return 'orange';
  if (pct >= 30) return 'yellow';
  return 'green';
}

/** Visual tokens for each fill status. CSS variable references so the
 *  ramp picks up theme changes automatically. */
export const FILL: Record<FillStatus, { color: string; soft: string; label: string }> = {
  empty:  { color: 'var(--border)',     soft: 'var(--surface-2)',    label: 'No budget set' },
  green:  { color: 'var(--success)',    soft: 'var(--success-soft)', label: 'On track' },
  yellow: { color: 'var(--warn)',       soft: 'var(--warn-soft)',    label: 'Half filled' },
  orange: { color: 'var(--orange)',     soft: 'var(--orange-soft)',  label: 'Nearly full' },
  red:    { color: 'var(--danger)',     soft: 'var(--danger-soft)',  label: 'Overflowing' },
};

/* ─────────────────────────────────────────────────────────────────────
   Category-card progression palette (shared by Month Planner jars
   and Event Planner category cards)

   4-step scheme drives the ring / fill colour against how full the
   jar is vs its budget:
     0–30%    → blue   (info)     — just starting
     30–60%   → cyan   (cyan)     — making progress
     60–100%  → green  (success)  — at or near budget, looking good
     >100%    → deep orange (orange) — overflowing into red zone

   The thresholds match user intent at each phase: low-usage items
   are quiet (blue), mid-range has its own identifiable colour (cyan)
   so the user can see they're somewhere between "starting" and
   "almost done", and overflowing swaps to a noticeably warmer hue
   (deep orange) rather than red so it still reads as "warning" but
   not as "danger".

   The original 5-step fill ramp (green/yellow/orange/red) below is
   kept for the summary strip and any caller that wants the broader
   health gradient — same breakpoints, just more granularity for
   power data.
   ────────────────────────────────────────────────────────────────────*/

export type CategoryFillStatus = 'empty' | 'blue' | 'cyan' | 'green' | 'orange';

/** Category-card palette: 4 steps (blue / cyan / green / deep-orange). */
export function categoryFillStatus(pct: number, overflow: boolean, budget: number): CategoryFillStatus {
  if (budget <= 0) return 'empty';
  if (overflow) return 'orange';
  if (pct >= 60) return 'green';
  if (pct >= 30) return 'cyan';
  return 'blue';
}

export const CATEGORY_FILL: Record<CategoryFillStatus, { color: string; soft: string; label: string }> = {
  empty:  { color: 'var(--border)',  soft: 'var(--surface-2)',   label: 'No budget set' },
  blue:   { color: 'var(--info)',    soft: 'var(--info-soft)',   label: 'Just starting' },
  cyan:   { color: 'var(--cyan)',    soft: 'var(--cyan-soft)',   label: 'Making progress' },
  green:  { color: 'var(--success)', soft: 'var(--success-soft)', label: 'At budget' },
  orange: { color: 'var(--orange)',  soft: 'var(--orange-soft)', label: 'Overflowing' },
};

/** Map the existing 5-step FillStatus to the 4-step category scheme.
 *  Used by callers that already computed `fillStatus` (e.g. the
 *  timeline, summary strip) and just want a colour. */
export function categoryFillFromStatus(status: FillStatus): CategoryFillStatus {
  switch (status) {
    case 'red':    return 'orange';
    case 'orange': return 'orange';
    case 'yellow': return 'cyan';
    case 'green':  return 'blue';
    case 'empty':  return 'empty';
  }
}

/**
 * Render a fill-percent label that's always one line, short, and
 * informative even at extreme overflow. Rules:
 *   - 0–100% normal:  "75% filled"
 *   - 100–999% normal: "150% overflowing" (still meaningful)
 *   - ≥1000%: "9× over" / "20× over" (multiplier, more readable than 20000%)
 */
export function formatPct(pct: number, overflow: boolean): { verb: string; number: string } {
  if (!overflow) return { verb: 'filled', number: `${pct}%` };
  if (pct >= 1000) {
    const times = Math.round(pct / 100);
    return { verb: 'over', number: `${times}×` };
  }
  return { verb: 'overflowing', number: `${pct}%` };
}

/** Pct by planned ÷ budget, with sensible fallback when budget=0. */
export function pctOf(planned: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.round((planned / budget) * 100);
}

/** Liquid height (0–100%). Caps at 100% so overflow reads as "full jar". */
export function liquidTop(planned: number, budget: number): number {
  const overflow = budget > 0 && planned > budget;
  const fillPct = overflow ? 100 : Math.min(100, pctOf(planned, budget));
  return 100 - fillPct;
}

/** Inline style helpers for the frosted-pill treatment.
 *  Theme-aware: light mode uses an opaque cream wash so the pill
 *  separates from the cream card surface; dark mode uses a dark wash
 *  with neutral ink text. Both pick up `--frost-pill-bg` /
 *  `--frost-pill-border` / `--frost-pill-shadow` from theme.css. */
export function frostedPillStyle(): CSSProperties {
  return {
    background: 'var(--frost-pill-bg)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--frost-pill-border)',
    boxShadow: 'var(--frost-pill-shadow)',
  };
}

/** Tone for a planned-event summary card on EventPlanScreen.
 *  3-color traffic-light system that matches the user's mental model:
 *     budget <  allocated → danger (over-spent — red)
 *     budget == allocated → success (exactly at budget — green)
 *     budget >  allocated → info    (under-spent, room left — blue)
 *    budget <= 0         → null    (no budget set — leave default surface)
 *  Returns a `CardTone` so callers can apply the same wash/bar
 *  treatment as the rest of the list-card surfaces via
 *  `cardSurfaceStyle(tone)` + `leftBarClass(tone)` from
 *  src/lib/cardSurface.ts.
 *  2026-09-01 added. 2026-09-01 simplified from 5-step to 3-step. */
export function eventPlanCardTone(allocated: number, budget: number): CardTone | null {
  if (budget <= 0) return null;
  if (allocated > budget) return 'danger';
  if (allocated === budget) return 'success';
  return 'info';
}

/** Liquid fill opacity for planner cards. Higher in light mode (0.55)
 *  so the colour ramp reads through the cream surface; lower in dark
 *  mode (0.32) so it doesn't drown the deep surface. */
export function liquidFillOpacity(): number {
  // The CSS variable is a string like "0.55" — convert to a number so
  // callers can use it as an `opacity` style value.
  if (typeof window === 'undefined') return 0.32;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--liquid-fill-opacity').trim();
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0.32;
}