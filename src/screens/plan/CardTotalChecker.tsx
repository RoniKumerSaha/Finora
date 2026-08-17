/**
 * CardTotalChecker — multi-select checklist on the Month Planner page.
 *
 * Lets the user tick off items from the currently-viewed Month Plan
 * (the active month, not necessarily "today's") and see a running
 * total of the selected item budgets. Ephemeral: nothing is
 * persisted, so a page refresh resets the selection. The point is a
 * quick "if I pay for these, how much is that?" scratchpad, not a
 * long-lived ledger edit.
 *
 * Visual: a panel that sits below the summary strip on /plan/month.
 * Each item is a chip with emoji + name + budget amount; clicking
 * toggles a "selected" state with a coloured border + filled bg.
 * Footer shows the running total plus a Clear button when N > 0.
 */
import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../domain/store';
import * as plans from '../../domain/plans';
import { fmtBDT } from '../../lib/format';

export function CardTotalChecker({ activeKey }: { activeKey: string }) {
  const state = useStore(s => s.state);
  const plan = plans.getMonthPlan(state, activeKey);
  const items = plan?.categories ?? [];

  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Reset selection when the user switches months — keeping stale ids
  // for a different month's items would be confusing and produce
  // totals of 0 silently.
  useEffect(() => {
    setSelected(new Set());
  }, [activeKey]);

  const total = useMemo(() => {
    let sum = 0;
    for (const cat of items) {
      if (selected.has(cat.id)) sum += Number(cat.budget) || 0;
    }
    return sum;
  }, [items, selected]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  return (
    <section
      className="card flex flex-col gap-4"
      aria-labelledby="card-checker-title"
    >
      {/* Header row — section label + count summary */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
            Quick total
          </div>
          <h2 id="card-checker-title" className="font-semibold text-[18px] tracking-tight mt-1.5">
            Check the cards you'll pay
          </h2>
          <div className="text-sm text-muted mt-1.5 max-w-prose">
            Tick the items from this month's plan to see how much they'd add up to. Nothing is saved — just a quick sum.
          </div>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-[12.5px] text-muted hover:text-ink font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
          >
            Clear
          </button>
        )}
      </div>

      {/* Body: chips grid or empty state */}
      {items.length === 0 ? (
        <div className="text-[12.5px] text-muted">
          No items in this month's plan yet — open the planner to start.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {items.map(cat => {
              const isSelected = selected.has(cat.id);
              const budget = Number(cat.budget) || 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggle(cat.id)}
                  className={[
                    'inline-flex items-center gap-2 px-3 py-2 rounded-input border text-left transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    isSelected
                      ? 'bg-primary/10 border-primary text-ink'
                      : 'bg-surface-2 border-border text-ink hover:border-ink-2',
                  ].join(' ')}
                >
                  {/* Checkmark / dot indicator */}
                  <span
                    aria-hidden
                    className={[
                      'w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0 transition',
                      isSelected ? 'bg-primary text-white' : 'border border-border bg-surface',
                    ].join(' ')}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                        <path d="M2 5 L4.2 7.2 L8 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[15px] shrink-0" aria-hidden>{cat.emoji ?? '•'}</span>
                  <span className="text-[13px] font-semibold truncate max-w-[160px]">{cat.name}</span>
                  <span className="text-[12.5px] text-muted tabular shrink-0">
                    {fmtBDT(budget)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer — selected count + running total. */}
          <div
            className="pt-3 border-t border-border flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1"
          >
            <span className="text-[12.5px] text-muted tabular">
              <b className="text-ink">{selected.size}</b> of {items.length} {items.length === 1 ? 'item' : 'items'} selected
            </span>
            <span className="text-[12.5px] text-muted tabular">
              Total <b className="text-ink text-[16px] font-bold tabular ml-1">{fmtBDT(total)}</b>
            </span>
          </div>
        </>
      )}
    </section>
  );
}