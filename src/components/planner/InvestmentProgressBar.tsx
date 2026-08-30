/**
 * InvestmentProgressBar — thin progress strip showing how far through
 * a mock investment's term the user is.
 *
 *   - pre-start (≤0d) → empty bar + `starts in N days`
 *   - in-progress     → `month N of M · P%` + partial bar in `--primary`
 *   - matured         → full bar in `--accent`
 *
 * Uses `parseISODate` / `daysBetween` so the calculation matches
 * the rest of the app's date math (UTC, midnight).
 */
import { daysBetween, parseISODate, today } from '../../domain/math';

export function InvestmentProgressBar({
  startDate,
  termMonths,
  now,
}: {
  startDate: string;
  termMonths: number;
  now?: string | Date;
}) {
  const months = Math.max(0, Math.floor(Number(termMonths) || 0));
  if (!startDate || months <= 0) return null;

  const start = parseISODate(startDate);
  const t = today(now ?? new Date());
  const elapsedDays = daysBetween(start, t);
  const totalDays = months * 30; // approximation — the bar is for
                                  // at-a-glance progress, not exact
                                  // accounting. The maturity date
                                  // is computed precisely elsewhere.
  // Before start (or day-of-start): empty bar + "starts in N days" caption.
  // Treat day-of-start as pre-start so the copy is consistent — a plan
  // that hasn't elapsed a full day yet shows "starts in 1 day" rather
  // than the meaningless "month 0 of 36 · 0%".
  if (elapsedDays <= 0) {
    return (
      <div className="flex flex-col gap-1">
        <div className="h-1 rounded-pill bg-surface-2" />
        <div className="text-[10.5px] text-muted">
          starts in <b className="text-ink font-semibold">{Math.max(1, Math.abs(elapsedDays))}</b> days
        </div>
      </div>
    );
  }
  // After maturity: full bar in accent.
  if (elapsedDays >= totalDays) {
    return (
      <div className="flex flex-col gap-1">
        <div className="h-1 rounded-pill bg-surface-2 overflow-hidden">
          <div className="h-full rounded-pill" style={{ width: '100%', background: 'var(--accent)' }} />
        </div>
        <div className="text-[10.5px] text-muted">
          <b className="text-ink font-semibold">matured</b>
        </div>
      </div>
    );
  }
  // In-progress: rounded percent + month label.
  const pct = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  const elapsedMonths = Math.min(months, Math.floor(elapsedDays / 30));
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1 rounded-pill bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-pill transition-all"
          style={{ width: `${pct}%`, background: 'var(--primary)' }}
        />
      </div>
      <div className="text-[10.5px] text-muted">
        month <b className="text-ink font-semibold">{elapsedMonths}</b> of <b className="text-ink font-semibold">{months}</b> · {pct}%
      </div>
    </div>
  );
}
