/**
 * CardTotalChecker — multi-select checklist on the Month Planner page.
 *
 * Lets the user tick off items from the currently-viewed Month Plan,
 * type an income, and instantly see:
 *   - the running total of selected item budgets,
 *   - the saving = income − selected total (positive = green,
 *     negative = red "over by ৳X").
 *
 * Ephemeral: nothing is persisted, so a page refresh resets the
 * selection and the income. The point is a quick "if I pay for
 * these, how much is left?" scratchpad, not a long-lived ledger edit.
 *
 * Visual: a panel that sits at the top of /plan/month. Each item is
 * a chip with emoji + name + budget amount; clicking toggles a
 * "selected" state with a coloured border + filled bg. Footer shows
 * selected count, total, and saving.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../../domain/store';
import * as plans from '../../domain/plans';
import { fmtBDT, clampNonNegative } from '../../lib/format';

export function CardTotalChecker() {
  const state = useStore(s => s.state);
  const plan = plans.getMonthPlan(state, plans.monthKey());
  const items = plan?.categories ?? [];

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [income, setIncome] = useState<number>(0);

  const total = useMemo(() => {
    let sum = 0;
    for (const cat of items) {
      if (selected.has(cat.id)) sum += Number(cat.budget) || 0;
    }
    return sum;
  }, [items, selected]);

  const saving = income - total;

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
      {/* Header row — section label + clear button */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
            Quick total
          </div>
          <h2 id="card-checker-title" className="font-semibold text-[18px] tracking-tight mt-1.5">
            Check the cards you'll pay
          </h2>
          <div className="text-sm text-muted mt-1.5 whitespace-nowrap">
            Tick items, set your income, see how much you'd save (or overspend). Nothing is saved.
          </div>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-[12.5px] text-muted hover:text-ink font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Income row — local draft so users can type freely, commit on
          Enter or blur. Same pattern as the Month Planner's old income
          pill. Empty income → no Saving line in the footer. */}
      <IncomeInput
        value={income}
        onCommit={setIncome}
      />

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

          {/* Footer — selected count, total, saving. The saving cell
              colour-swaps to red when selected > income and shows
              "Over by ৳X" so the user sees the deficit at a glance. */}
          <div
            className="pt-3 border-t border-border flex flex-wrap items-baseline gap-x-5 gap-y-1"
          >
            <span className="text-[12.5px] text-muted tabular">
              <b className="text-ink">{selected.size}</b> of {items.length} selected
            </span>
            <span className="text-[12.5px] text-muted tabular">
              Total <b className="text-ink text-[16px] font-bold tabular ml-1">{fmtBDT(total)}</b>
            </span>
            {income > 0 && (
              saving >= 0 ? (
                <span className="text-[12.5px] text-muted tabular">
                  Saved <b
                    className="font-bold tabular ml-1"
                    style={{ color: 'var(--success-title)', fontSize: '16px' }}
                  >
                    {fmtBDT(saving)}
                  </b>
                </span>
              ) : (
                <span className="text-[12.5px] text-muted tabular">
                  Over by <b
                    className="font-bold tabular ml-1"
                    style={{ color: 'var(--danger-title)', fontSize: '16px' }}
                  >
                    {fmtBDT(Math.abs(saving))}
                  </b>
                </span>
              )
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Income input row. Pure local state — no store writes. Kept inline
 *  here because it's the only place the checker has typed numeric
 *  input, no need to over-componentise. */
function IncomeInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  // Draft pattern: mirror the committed `value` into a string draft so
  // the user can erase + retype without the input snapping back.
  const [draft, setDraft] = useState(value > 0 ? String(value) : '');
  useEffect(() => { setDraft(value > 0 ? String(value) : ''); }, [value]);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const n = clampNonNegative(draft);
    setDraft(n > 0 ? String(n) : '');
    if (n !== value) onCommit(n);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted">
        Income
      </span>
      <span className="inline-flex items-center gap-0.5 px-3 py-2 rounded-input border border-border bg-surface-2">
        <span className="text-[13px] text-muted">৳</span>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          min={0}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={commit}
          placeholder="0"
          aria-label="Income"
          className="bg-transparent border-0 border-b border-dashed focus:outline-none tabular w-[100px] text-right font-semibold text-ink"
          style={{ borderColor: 'color-mix(in srgb, var(--ink) 25%, transparent)' }}
        />
      </span>
      <span className="text-[11px] text-muted">Type your expected income for the month</span>
    </div>
  );
}
