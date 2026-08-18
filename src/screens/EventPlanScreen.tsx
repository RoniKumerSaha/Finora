/**
 * EventPlanScreen — list of event plans (PRD §9.15).
 *
 * Generic: each event has its own name, date, budget, and category
 * cascade. Wedding · Trip · Eid · Project launch — anything with a
 * date and a budget.
 *
 * Visual target: docs/ux-designs/ux-finora-2026-08-17-month-planner/
 * .working-events/option-C-timeline.html (timeline cascade).
 *
 * 2026-08-18 polish: each card is now a whole-card link via
 * `.card-link`, matching the Accounts / Investments grids. The
 * hover lift + shadow tightening makes the click target obvious. The
 * Delete action stays a sibling button with `relative z-10` + click
 * stopPropagation so it doesn't trigger navigation.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as plans from '../domain/plans';
import { fmtBDT, fmtDate, clampNonNegative } from '../lib/format';
import { daysBetween, today } from '../domain/math';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { fillStatus, FILL, formatPct, pctOf, frostedPillStyle } from '../components/planner/jarVisuals';
import { EmojiPicker } from '../components/planner/EmojiPicker';

export function EventPlanScreen() {
  const state = useStore(s => s.state);
  const addEventPlan = useStore(s => s.addEventPlan);
  const removeEventPlan = useStore(s => s.removeEventPlan);
  const showBanner = useStore(s => s.showBanner);
  const events = plans.listEventPlans(state);
  const [creating, setCreating] = useState(false);
  const [emoji, setEmoji] = useState('🏖️');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [budget, setBudget] = useState('');
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();

  function startCreate() {
    setCreating(true);
    setEmoji('🏖️');
    setName('');
    setDate('');
    setBudget('');
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Event name is required', why: 'Without a name the event cannot be tracked.', fix: 'Enter a name (e.g. "Cox\'s Bazar trip").' });
      return;
    }
    if (!date) {
      showBanner({ what: 'Event date is required', why: 'The timeline is anchored to the date.', fix: 'Pick a date.' });
      return;
    }
    const id = addEventPlan({
      name: name.trim(),
      emoji,
      eventDate: date,
      budget: clampNonNegative(budget),
    });
    setCreating(false);
    navigate(`/plan/event/${id}`);
  }

  async function onDelete(id: string) {
    const ok = await confirm({
      title: 'Delete this event plan?',
      body: 'This is a scratchpad — nothing was recorded in your ledger. The plan and its categories are removed.',
      danger: true,
      confirmLabel: 'Delete',
    });
    if (ok) removeEventPlan(id);
  }

  // Sort by event date ascending.
  const sorted = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const todayISO = today().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="heading h1-screen">Plan an event</h1>
          <div className="text-muted text-[13px] mt-1.5">
            Weddings, trips, Eid, anything with a date and a budget. Each event is its own scratchpad.
          </div>
        </div>
        {!creating && (
          <Button variant="primary" onClick={startCreate}>
            <span className="text-base leading-none">+</span>
            <span>New event</span>
          </Button>
        )}
      </div>

      {creating && (
        <form onSubmit={onCreate} className="card flex flex-col gap-5">
          <EmojiPicker value={emoji} onChange={setEmoji} />
          <Field label="Event name">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Cox's Bazar trip, Wedding, Eid…" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Event date">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Budget (optional)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="80000"
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" type="submit">Create event</Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {sorted.length === 0 && !creating && (
        <section className="card">
          <div className="py-10 text-center text-muted">
            <div className="text-3xl opacity-60 mb-2.5">📅</div>
            <div className="text-[15px] font-semibold text-ink">Plan your first event</div>
            <p className="mt-2 text-sm">Set a date and a budget. Add categories, what's due when, and what you've paid.</p>
            <Button variant="primary" onClick={startCreate} className="mt-4">+ New event</Button>
          </div>
        </section>
      )}

      {sorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sorted.map(ev => {
            const summary = plans.summariseEventPlan(ev);
            const days = daysBetween(todayISO, ev.eventDate);
            const pct = pctOf(summary.planned, summary.budget);
            const overflow = summary.budget > 0 && summary.planned > summary.budget;
            const status = fillStatus(pct, overflow, summary.budget);
            const fill = FILL[status];
            const { verb, number } = formatPct(pct, overflow);
            return (
              <Link
                key={ev.id}
                to={`/plan/event/${ev.id}`}
                className="card card-link flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 group"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: fill.color }}
                      />
                      <span className="text-2xl">{ev.emoji ?? '📅'}</span>
                      <div className="font-semibold text-[15px] tracking-tight truncate group-hover:text-primary transition">{ev.name}</div>
                    </div>
                    <div className="text-xs text-muted mt-1.5 tabular ml-[26px]">
                      {fmtDate(ev.eventDate)} · {days >= 0 ? `${days} days to go` : `${Math.abs(days)} days ago`}
                    </div>
                  </div>
                  {/* z-10 keeps the click above the link so it doesn't
                      trigger navigation. */}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(ev.id); }}
                    className="relative z-10 text-xs text-muted hover:text-danger transition px-2 py-1 rounded-btn hover:bg-surface-2"
                    aria-label={`Delete ${ev.name}`}
                  >
                    Delete
                  </button>
                </div>
                <div className="h-2 bg-surface-2 rounded-pill overflow-hidden">
                  <div
                    className="h-full rounded-pill transition-all"
                    style={{
                      width: summary.budget > 0 ? `${Math.min(100, pct)}%` : '0%',
                      background: fill.color,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs tabular gap-2">
                  <span
                    className="px-2 py-0.5 rounded-pill text-ink"
                    style={frostedPillStyle()}
                  >
                    <span className="font-semibold tabular">{fmtBDT(summary.planned)}</span>
                    <span className="text-muted"> / {fmtBDT(summary.budget)}</span>
                  </span>
                  <span
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-pill text-ink"
                    style={frostedPillStyle()}
                    title={fill.label}
                  >
                    {summary.budget > 0 ? (
                      <>
                        <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: fill.color }} />
                        <span className="tabular">{number} <span className="text-muted">{verb}</span></span>
                      </>
                    ) : (
                      <span className="text-muted">No budget</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted tabular">
                  <span>
                    {summary.overdueCount > 0
                      ? <span className="text-danger">{summary.overdueCount} overdue</span>
                      : summary.dueSoonCount > 0
                        ? <span className="text-warn">{summary.dueSoonCount} due soon</span>
                        : `${summary.count} ${summary.count === 1 ? 'category' : 'categories'}`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {dialog}
    </div>
  );
}