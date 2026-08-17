/**
 * jarVisuals — shared visual helpers for the Month Planner jars and
 * the Event Planner categories. Single source for the colour ramp,
 * the percent formatter, and the status pill style so the two
 * planners stay visually consistent.
 */
import type { CSSProperties } from 'react';

export type FillStatus = 'empty' | 'green' | 'yellow' | 'orange' | 'red';

/** Map a planned ÷ budget ratio to a 4-step colour ramp. */
export function fillStatus(pct: number, overflow: boolean, budget: number): FillStatus {
  if (budget <= 0) return 'empty';
  if (overflow) return 'red';
  if (pct >= 80) return 'orange';
  if (pct >= 50) return 'yellow';
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
   Category-card specific palette (Event Planner only)

   3-step scheme chosen for the category cards:
     <80%    → blue  (info)     — still room
     80–100% → green (success)  — at budget, all good
     >100%   → red   (danger)   — overflowing

   The 4-step jar ramp above (green/yellow/orange/red) is preserved
   for the Month Planner jars, where a finer gradient helps the user
   pace themselves across the whole month.
   ────────────────────────────────────────────────────────────────────*/

export type CategoryFillStatus = 'empty' | 'blue' | 'green' | 'red';

/** Category-card palette: 3 steps (blue / green / red). */
export function categoryFillStatus(pct: number, overflow: boolean, budget: number): CategoryFillStatus {
  if (budget <= 0) return 'empty';
  if (overflow) return 'red';
  if (pct >= 80) return 'green';
  return 'blue';
}

export const CATEGORY_FILL: Record<CategoryFillStatus, { color: string; soft: string; label: string }> = {
  empty: { color: 'var(--border)',  soft: 'var(--surface-2)',  label: 'No budget set' },
  blue:  { color: 'var(--info)',    soft: 'var(--info-soft)',  label: 'Under budget' },
  green: { color: 'var(--success)', soft: 'var(--success-soft)', label: 'At budget' },
  red:   { color: 'var(--danger)',  soft: 'var(--danger-soft)',  label: 'Overflowing' },
};

/** Map the existing 4-step FillStatus to the 3-step category scheme.
 *  Used by callers that already computed `fillStatus` (e.g. the
 *  timeline, summary strip) and just want a colour. */
export function categoryFillFromStatus(status: FillStatus): CategoryFillStatus {
  switch (status) {
    case 'red':    return 'red';
    case 'orange': return 'green';  // 80–100% maps to green
    case 'yellow': return 'blue';
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