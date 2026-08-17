/**
 * EventPlanDetailScreen — single event plan with timeline cascade.
 *
 * Visual target: docs/ux-designs/ux-finora-2026-08-17-month-planner/
 * .working-events/option-C-timeline.html — generic timeline + cascade
 * cards. Each category has its own dueDate chip; the left rail shows
 * the upcoming paint-by-numbers.
 *
 * 2026-08-17 polish: category editor moved into a modal pop-up (mirror
 * of Month Planner's JarEditorModal). 4-step colour ramp + frosted
 * pills applied to category cards. Summary strip recoloured to match
 * the Month Planner's status-driven treatment.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as plans from '../domain/plans';
import { fmtBDT, fmtDate, fmtDateShort, clampNonNegative } from '../lib/format';
import { daysBetween, today } from '../domain/math';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { useConfirm } from '../components/ConfirmDialog';
import { EmojiPicker } from '../components/planner/EmojiPicker';
import { formatPct, pctOf, liquidTop, frostedPillStyle, liquidFillOpacity, categoryFillStatus, CATEGORY_FILL } from '../components/planner/jarVisuals';
import { categorySpent } from '../domain/plans';
import { uid } from '../domain/ids';
import type { PlanCategory, PlanItem } from '../domain/types';

type EventCategory = PlanCategory & { items: PlanItem[]; dueDate?: string };

type MarkKind = 'overdue' | 'due' | 'paid' | 'future' | 'undated' | 'event';
type CategoryFill = 'empty' | 'blue' | 'green' | 'red';
interface Mark {
  id: string;
  date: string;          // ISO; '' for undated marks
  label: string;
  emoji: string;
  kind: MarkKind;        // date-based hint, used for the secondary label
  /** 3-step category palette: blue / green / red. Drives the dot
   *  colour so the timeline matches the category cards. */
  fill: CategoryFill;
}

export function EventPlanDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const saveEvent = useStore(s => s.saveEventPlan);
  const resetEvent = useStore(s => s.resetEventPlan);
  const addCategory = useStore(s => s.addEventCategory);
  const updateEvent = useStore(s => s.updateEventPlan);
  const updateCategory = useStore(s => s.updateEventCategory);
  const removeCategory = useStore(s => s.removeEventCategory);
  const addItem = useStore(s => s.addEventItem);
  const updateItem = useStore(s => s.updateEventItem);
  const removeItem = useStore(s => s.removeEventItem);
  const showBanner = useStore(s => s.showBanner);

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [newCatDraft, setNewCatDraft] = useState<{ emoji: string; name: string; dueDate: string } | null>(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const plan = id ? plans.getEventPlan(state, id) : undefined;

  if (!plan) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => navigate('/plan/event')} className="text-muted text-sm hover:text-ink w-fit">← Back to events</button>
        <div className="card text-center text-muted py-10">Event not found.</div>
      </div>
    );
  }

  const summary = plans.summariseEventPlan(plan);
  const todayISO = today().toISOString().slice(0, 10);
  const daysToGo = daysBetween(todayISO, plan.eventDate);

  // Build the timeline marks. Every category shows up; without a
  // dueDate it becomes an "undated" mark at the bottom (sorted last).
  // Previously we filtered out undated categories entirely, which made
  // the timeline feel stale whenever the user added a category but
  // hadn't picked a date yet.
  //
  // Each mark carries TWO statuses:
  //   - `kind` — date-based hint (paid/overdue/due/future/undated) shown
  //     as the small secondary label below the name.
  //   - `fill` — category palette colour (blue/green/red) used for the
  //     dot so the timeline mirrors the category card.
  const marks = useMemo<Mark[]>(() => {
    const items: Mark[] = [];
    for (const cat of plan.categories) {
      const spent = categorySpent(cat);
      const budget = Number(cat.budget) || 0;
      const pct = pctOf(spent, budget);
      const overflow = budget > 0 && spent > budget;
      // Paid dominates over budget: when every line item is checked,
      // the category is "done" no matter what the budget ratio says,
      // so the timeline dot turns green to celebrate.
      const paid = cat.items.length > 0 && cat.items.every(i => i.done);
      const fill = paid ? 'green' : categoryFillStatus(pct, overflow, budget);
      if (cat.dueDate) {
        const days = daysBetween(todayISO, cat.dueDate);
        const kind: MarkKind = paid
          ? 'paid'
          : days < 0
            ? 'overdue'
            : days <= 7
              ? 'due'
              : 'future';
        items.push({ id: cat.id, date: cat.dueDate, label: cat.name, emoji: cat.emoji, kind, fill });
      } else {
        items.push({ id: cat.id, date: '', label: cat.name, emoji: cat.emoji, kind: 'undated', fill });
      }
    }
    // The event itself is the parent anchor — always rendered first
    // (top of the timeline). Categories then follow sorted by date
    // ASC, with undated categories grouped at the bottom.
    const allPaid = plan.categories.length > 0
      && plan.categories.every(c => c.items.length > 0 && c.items.every(i => i.done));
    const eventMark: Mark = {
      id: '__event',
      date: plan.eventDate,
      label: plan.name,
      emoji: plan.emoji ?? '📅',
      kind: 'event',
      fill: allPaid ? 'green' : 'empty',
    };
    const categories = items.filter(m => m.kind !== 'event');
    const dated = categories.filter(m => m.date);
    const undated = categories.filter(m => !m.date);
    dated.sort((a, b) => a.date.localeCompare(b.date));
    return [eventMark, ...dated, ...undated];
  }, [plan.categories, plan.eventDate, plan.name, plan.emoji, todayISO]);

  function startNewCategory() {
    setNewCatDraft({ emoji: '🏨', name: '', dueDate: '' });
    setSelectedCatId(null);
  }

  function commitNewCategory() {
    if (!newCatDraft || !newCatDraft.name.trim()) {
      showBanner({ what: 'Name the category', why: 'A category without a name is impossible to track.', fix: 'Type a name (e.g. "Hotel") then save.' });
      return;
    }
    if (!id) return;
    // Always seed one default line item so the user can immediately
    // check it off to mark paid. They can rename / re-amount / delete
    // it inside the editor.
    const defaultItem: PlanItem = { id: uid(), label: 'Main cost', amount: 0, done: false };
    addCategory(id, {
      emoji: newCatDraft.emoji,
      name: newCatDraft.name.trim(),
      budget: 0,
      planned: 0,
      dueDate: newCatDraft.dueDate || undefined,
      tone: plans.PLAN_TONES[(plan?.categories.length ?? 0) % plans.PLAN_TONES.length],
    }, [defaultItem]);
    setNewCatDraft(null);
  }

  const selectedCat = selectedCatId
    ? plan.categories.find(c => c.id === selectedCatId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-5 max-w-6xl w-full">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/plan/event')}
          className="text-muted text-sm hover:text-ink"
        >← Events</button>
        <div className="h-5 w-px bg-border" aria-hidden />
        <span
          aria-hidden
          className="w-12 h-12 rounded-full inline-flex items-center justify-center text-2xl shrink-0 border-2"
          style={{
            background: 'var(--primary-soft)',
            borderColor: 'var(--primary)',
          }}
        >{plan.emoji ?? '📅'}</span>
        <div className="flex-1 min-w-0">
          <h1 className="heading h1-screen truncate">{plan.name}</h1>
          <div className="text-muted text-[12.5px] mt-1">
            {fmtDate(plan.eventDate)} ·{' '}
            {plan.budget > 0
              ? <><span className="text-ink font-semibold">{fmtBDT(plan.budget)}</span> budget</>
              : <>No budget yet</>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="text-right"
            title={daysToGo >= 0 ? 'Days until the event' : 'Days since the event'}
          >
            <div className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">
              {daysToGo >= 0 ? 'Days to go' : 'Days ago'}
            </div>
            <div className="text-primary font-bold text-[22px] tabular leading-none mt-1">{Math.abs(daysToGo)}</div>
          </div>
          <button
            type="button"
            onClick={() => setEditingEvent(true)}
            aria-label="Edit event details"
            title="Edit event details"
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 12 L2 10 L10 2 L12 4 L4 12 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8.5 3.5 L10.5 5.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 sm:gap-5 px-4 py-3">
        <div className="flex items-center gap-2 text-[12.5px] text-muted shrink-0">
          <span
            aria-hidden
            className="w-2 h-2 rounded-full"
            style={{
              background: plan.dirty ? 'var(--warn)' : 'var(--success)',
              boxShadow: `0 0 0 3px color-mix(in srgb, ${plan.dirty ? 'var(--warn)' : 'var(--success)'} 25%, transparent)`,
            }}
          />
          <span>
            {plan.dirty ? <>Unsaved changes</> : <>Saved</>}
          </span>
        </div>
        <div className="hidden sm:block h-5 w-px bg-border" aria-hidden />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
          {(() => {
            const pct = pctOf(summary.planned, summary.budget);
            const overflow = summary.budget > 0 && summary.planned > summary.budget;
            const cStatus = categoryFillStatus(pct, overflow, summary.budget);
            const spentColor = CATEGORY_FILL[cStatus].color;
            const planned = summary.planned || 0;
            const paid = summary.paidSoFar;
            const paidColor = planned <= 0
              ? 'var(--muted)'
              : paid >= planned
                ? 'var(--success)'
                : paid === 0
                  ? 'var(--danger)'
                  : 'var(--warn)';
            return (
              <>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={frostedPillStyle()}>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Spent</span>
                  <span className="font-bold text-[15px] tabular" style={{ color: spentColor }}>{fmtBDT(summary.planned)}</span>
                  <span className="text-[12px] text-muted">/ {fmtBDT(plan.budget)}</span>
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={frostedPillStyle()}>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Paid</span>
                  <span className="font-bold text-[15px] tabular" style={{ color: paidColor }}>{fmtBDT(paid)}</span>
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={frostedPillStyle()}>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">
                    {daysToGo >= 0 ? 'Days to go' : 'Days ago'}
                  </span>
                  <span className="font-bold text-[15px] tabular text-primary">{Math.abs(daysToGo)}</span>
                </span>
              </>
            );
          })()}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" onClick={async () => {
            // Reset drops every working-draft edit on the event —
            // confirm before discarding, since the user may have
            // typed per-category amounts they don't want to lose.
            const ok = await confirm({
              title: `Reset ${plan.name}?`,
              body: 'The event will be blanked back to a clean slate — budget set to 0, date moved to today, every category removed.',
              dangerText: 'Everything you\u2019ve planned on this event is wiped — this can\u2019t be undone.',
              confirmLabel: 'Reset',
              danger: true,
            });
            if (!ok) return;
            resetEvent(plan.id);
            setSelectedCatId(null);
            setNewCatDraft(null);
          }}>Reset</Button>
          <Button variant="primary" onClick={() => saveEvent(plan.id)}>Save plan</Button>
        </div>
      </div>

      {(() => {
        // "Event completed" fires when there's at least one category and
        // every line item across every category is checked. Empty
        // plans (no categories yet) don't trigger — the user hasn't
        // actually completed anything.
        const hasCats = plan.categories.length > 0;
        const allPaid = hasCats && plan.categories.every(c =>
          c.items.length > 0 && c.items.every(i => i.done),
        );
        if (!allPaid) return null;
        return (
          <div
            className="card flex flex-wrap items-center gap-4 px-5 py-4"
            style={{
              background: 'var(--success-callout-bg)',
              border: '1px solid var(--success)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--success) 35%, transparent)',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="w-9 h-9 rounded-full inline-flex items-center justify-center text-lg shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--success) 18%, transparent)',
                  color: 'var(--success-title)',
                }}
              >🎉</span>
              <div>
                <div className="font-bold text-[15px] text-ink leading-tight">Event completed</div>
                <div className="text-[12.5px] text-muted mt-0.5">
                  Every line item is paid. {plan.name} is wrapped up.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-5 ml-auto">
              <div className="flex flex-col items-end">
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Spent</div>
                <div className="font-bold text-[18px] tabular text-ink leading-tight">{fmtBDT(summary.planned)}</div>
              </div>
              <div className="flex flex-col items-end">
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Paid</div>
                <div className="font-bold text-[18px] tabular leading-tight" style={{ color: 'var(--success-title)' }}>
                  {fmtBDT(summary.paidSoFar)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <Timeline
          marks={marks}
          todayISO={todayISO}
          eventLabel={daysToGo >= 0 ? 'Timeline' : 'Timeline (past)'}
        />

        <div className="flex flex-col gap-3">
          {plan.categories.map(c => (
            <CategoryCard
              key={c.id}
              cat={c}
              todayISO={todayISO}
              onSelect={() => { setSelectedCatId(c.id); setNewCatDraft(null); }}
            />
          ))}

          {newCatDraft ? (
            <NewCategoryCard
              draft={newCatDraft}
              onChange={setNewCatDraft}
              onSave={commitNewCategory}
              onCancel={() => setNewCatDraft(null)}
            />
          ) : (
            <button
              type="button"
              onClick={startNewCategory}
              className="card-flat border border-dashed border-border rounded-card bg-transparent text-muted text-[13px] font-semibold p-6 hover:border-primary hover:text-primary transition"
            >
              + New category
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-muted text-center">
        ⓘ Tap a category card to edit it in a pop-up. Save the whole event plan from <b className="text-ink">Save plan</b>.
      </div>

      {selectedCat && (
        <CategoryEditorModal
          cat={selectedCat}
          onUpdate={patch => updateCategory(plan.id, selectedCat.id, patch)}
          onRemove={() => { removeCategory(plan.id, selectedCat.id); setSelectedCatId(null); }}
          onAddItem={item => addItem(plan.id, selectedCat.id, item)}
          onUpdateItem={(itemId, patch) => updateItem(plan.id, selectedCat.id, itemId, patch)}
          onRemoveItem={itemId => removeItem(plan.id, selectedCat.id, itemId)}
          onClose={() => setSelectedCatId(null)}
        />
      )}

      {editingEvent && (
        <EditEventModal
          initialBudget={plan.budget}
          initialDate={plan.eventDate}
          onCommit={({ budget, eventDate }) => {
            if (budget !== plan.budget) updateEvent(plan.id, { budget });
            if (eventDate !== plan.eventDate) updateEvent(plan.id, { eventDate });
            setEditingEvent(false);
          }}
          onCancel={() => setEditingEvent(false)}
        />
      )}
      {confirmDialog}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function Timeline({ marks, todayISO, eventLabel }: { marks: Mark[]; todayISO: string; eventLabel: string }) {
  // Header text reflects whether the event date is past or upcoming.
  // The timeline itself renders the event as the parent anchor at the
  // top, followed by dated categories ASC and undated categories last.
  //
  // Rail alignment: every marker sits in a fixed 26px-wide slot, so
  // the vertical line at left-[13px] of the *rows container* (not the
  // card — the card has padding that would offset it) passes through
  // the centre of every shape — circles, squares, dashed rings —
  // without shifting.
  return (
    <div className="card h-fit">
      <div className="text-[12px] text-muted uppercase tracking-[0.08em] font-semibold mb-4">{eventLabel}</div>
      <div className="relative flex flex-col gap-3.5">
        {/* Rail — runs the full height of the rows container so it
            threads through every marker's centre. */}
        <div className="absolute left-[13px] top-0 bottom-0 w-0.5 bg-border" aria-hidden />
        {marks.map(m => {
          if (m.kind === 'event') {
            // Parent anchor — visually distinct from category dots so the
            // user reads it as "the goal" rather than "another step".
            // Larger rounded square with the event emoji inside.
            const eventColor = m.fill === 'green' ? 'var(--success)' : 'var(--primary)';
            const eventSoft  = m.fill === 'green' ? 'var(--success-soft)' : 'var(--primary-soft)';
            return (
              <div key={m.id} className="flex items-center gap-3 py-1">
                <span
                  aria-hidden
                  className="w-[26px] h-[26px] flex items-center justify-center shrink-0 z-[1]"
                >
                  <span
                    className="w-5 h-5 rounded-md border-2 inline-flex items-center justify-center text-[10px]"
                    style={{
                      background: eventSoft,
                      borderColor: eventColor,
                      color: eventColor,
                      boxShadow: `0 0 0 3px color-mix(in srgb, ${eventColor} 18%, transparent)`,
                    }}
                    title={m.fill === 'green' ? 'Event completed' : 'Event date'}
                  >
                    <span style={{ fontSize: '10px', lineHeight: 1 }}>{m.emoji}</span>
                  </span>
                </span>
                <div className="flex flex-col">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold" style={{ color: eventColor }}>
                    Event · {relativeDay(m.date, todayISO)} · {fmtDateShort(m.date)}
                  </div>
                  <div className="text-[13px] font-bold text-ink">{m.label}</div>
                </div>
              </div>
            );
          }

          // Category mark — circle, sized to match the rail.
          return (
            <div key={m.id} className="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors py-1">
              <span
                aria-hidden
                className="w-[26px] h-[26px] flex items-center justify-center shrink-0 z-[1]"
              >
                <span
                  className={[
                    'w-3.5 h-3.5 rounded-full border-2',
                    m.kind === 'undated' && 'border-dashed',
                  ].filter(Boolean).join(' ')}
                  style={{
                    background: m.fill === 'empty' ? 'var(--surface)' : CATEGORY_FILL[m.fill].color,
                    borderColor: m.fill === 'empty' ? 'var(--border)' : CATEGORY_FILL[m.fill].color,
                    boxShadow: m.fill !== 'empty' && m.fill !== 'green'
                      ? `0 0 0 3px color-mix(in srgb, ${CATEGORY_FILL[m.fill].color} 25%, transparent)`
                      : undefined,
                  }}
                  title={CATEGORY_FILL[m.fill].label}
                />
              </span>
              <div className="flex flex-col">
                <div className="text-[11px] text-muted uppercase tracking-[0.04em] font-semibold">
                  {m.kind === 'undated' ? 'No due date' : `${relativeDay(m.date, todayISO)} · ${fmtDateShort(m.date)}`}
                </div>
                <div className="text-[13px] font-semibold text-ink">{m.emoji} {m.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function relativeDay(target: string, todayISO: string): string {
  const days = daysBetween(todayISO, target);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 0 && days < 7) return `in ${days} days`;
  if (days < 0 && days > -7) return `${Math.abs(days)} days ago`;
  return fmtDateShort(target);
}

function CategoryCard({ cat, todayISO, onSelect }: {
  cat: EventCategory;
  todayISO: string;
  onSelect: () => void;
}) {
  // Spent = sum of line items. The 3-step category palette (blue / green
  // / red) is independent of the Month Planner jars (4-step green/
  // yellow/orange/red); both are exposed from jarVisuals.
  const spent = categorySpent(cat);
  const budget = Number(cat.budget) || 0;
  const pct = pctOf(spent, budget);
  const overflow = budget > 0 && spent > budget;
  const cStatus = categoryFillStatus(pct, overflow, budget);
  const cFill = CATEGORY_FILL[cStatus];
  const fillTop = liquidTop(spent, budget);
  const paid = cat.items.length > 0 && cat.items.every(i => i.done);
  const dueDays = cat.dueDate ? daysBetween(todayISO, cat.dueDate) : null;

  let chip: React.ReactNode = null;
  if (paid) chip = <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-success-soft text-success border border-success">Paid in full</span>;
  else if (dueDays !== null && dueDays < 0) chip = <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-danger-soft text-danger border border-danger">{Math.abs(dueDays)} days overdue</span>;
  else if (dueDays !== null && dueDays <= 7) chip = <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-warn-soft text-warn border border-warn">Due in {dueDays}d</span>;
  else if (cat.dueDate) chip = <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-surface-2 text-muted border border-border">{fmtDateShort(cat.dueDate)}</span>;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'card-flat border border-border rounded-card text-left transition relative overflow-hidden',
        'hover:-translate-y-px hover:border-ink-2',
      ].join(' ')}
      style={{ background: 'var(--surface)' }}
    >
      {/* Liquid layer — 3-step palette (blue/green/red). The gradient
          lifts from the soft tint at the top of the fill to the solid
          colour at the bottom so the fill reads even when shallow. */}
      <span
        aria-hidden
        className="absolute left-0 right-0 bottom-0 pointer-events-none transition-[top]"
        style={{
          top: `${fillTop}%`,
          background: `linear-gradient(180deg, ${cFill.soft} 0%, ${cFill.color} 50%, ${cFill.color} 100%)`,
          opacity: cStatus === 'empty' ? 0 : liquidFillOpacity(),
        }}
      />
      <div className="relative p-4 flex flex-col gap-2.5">
        {/* Title row */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[22px] shrink-0">{cat.emoji}</span>
            <span className="font-semibold text-[18px] tracking-tight text-ink truncate">{cat.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">{chip}</div>
        </div>

        {/* Amount row — spent left, / budget right. Big numerals for
            the dominant number, lighter for the denominator. */}
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-bold text-[20px] tabular text-ink leading-none">{fmtBDT(spent)}</span>
          <span className="text-muted text-[13px] tabular">/ {fmtBDT(budget)}</span>
        </div>

        {/* Status pill + progress meta. Both wrapped in frosted pills so
            the text stays readable on every band — the cream pill bg
            dominates the colour band beneath. */}
        <div className="flex justify-between items-center text-[11.5px] tabular gap-2 flex-wrap">
          <div
            className="px-2.5 py-1 rounded-pill inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em] whitespace-nowrap"
            style={frostedPillStyle()}
            title={cFill.label}
          >
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: cFill.color }} />
            <span className="text-ink">
              {budget > 0
                ? (() => {
                    const f = formatPct(pct, overflow);
                    return `${f.number} ${f.verb}`;
                  })()
                : 'No budget'}
            </span>
          </div>
          <span
            className="px-2.5 py-1 rounded-pill inline-flex items-center gap-1 text-[10.5px] font-semibold whitespace-nowrap"
            style={frostedPillStyle()}
          >
            <span className="text-ink">
              {cat.items.filter(i => i.done).length} of {cat.items.length} paid
            </span>
            {cat.dueDate && (
              <>
                <span className="text-muted">·</span>
                <span className="text-ink font-bold">{fmtDateShort(cat.dueDate)}</span>
              </>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}

function NewCategoryCard({ draft, onChange, onSave, onCancel }: {
  draft: { emoji: string; name: string; dueDate: string };
  onChange: (next: { emoji: string; name: string; dueDate: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <EmojiPicker value={draft.emoji} onChange={emoji => onChange({ ...draft, emoji })} />
        <Input
          value={draft.name}
          onChange={e => onChange({ ...draft, name: e.target.value })}
          placeholder="Category name"
          autoFocus
        />
      </div>
      <Field label="Due date (optional)">
        <Input type="date" value={draft.dueDate} onChange={e => onChange({ ...draft, dueDate: e.target.value })} />
      </Field>
      <div className="flex gap-2 justify-end">
        <Button variant="primary" onClick={onSave}>Save category</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/* ── Modal category editor ───────────────────────────────────────── */

function CategoryEditorModal({ cat, onUpdate, onRemove, onAddItem, onUpdateItem, onRemoveItem, onClose }: {
  cat: EventCategory;
  onUpdate: (patch: Partial<EventCategory>) => void;
  onRemove: () => void;
  onAddItem: (item: { label: string; amount: number; done: boolean }) => void;
  onUpdateItem: (id: string, patch: { label?: string; amount?: number; done?: boolean }) => void;
  onRemoveItem: (id: string) => void;
  onClose: () => void;
}) {
  // Local string drafts so the field can be empty mid-edit; we only
  // commit a non-negative number to the store. Without this, every
  // backspace re-renders the input with "0" stuck in it.
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [budgetText, setBudgetText] = useState(String(cat.budget ?? ''));
  // Re-seed drafts when the modal opens for a different category.
  useEffect(() => {
    setBudgetText(String(cat.budget ?? ''));
    setNewLabel('');
    setNewAmount('');
  }, [cat.id]);

  // "Spent" = sum of all line items (every category now has at least
  // one default line item, so this is always the sum).
  const spent = categorySpent(cat);
  const budget = Number(cat.budget) || 0;
  const pct = pctOf(spent, budget);
  const overflow = budget > 0 && spent > budget;
  const status = categoryFillStatus(pct, overflow, budget);
  const paid = cat.items.filter(i => i.done).length;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cat-editor-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(8px)',
          animation: 'backdrop-fade-in 180ms ease-out both',
        }}
      />
      <div
        className="relative rounded-card w-[560px] max-w-full shadow-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal), var(--card-inset)',
          padding: '28px',
          animation: 'modal-pop-in 180ms ease-out both',
        }}
      >
        {/* Close button — top right, always present. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex items-start justify-between gap-3 mb-2 pr-8">
          <div>
            <h3 id="cat-editor-title" className="heading h3-modal m-0">
              {cat.emoji} {cat.name}
            </h3>
            <div className="text-muted text-[12.5px] mt-1">
              Budget · spent (sum of line items) · due date.
            </div>
          </div>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.04em] px-2.5 py-1 rounded-pill whitespace-nowrap flex items-center gap-1.5"
            style={frostedPillStyle()}
          >
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_FILL[status].color }} />
            <span className="text-ink">
              {budget > 0 ? (() => {
                const f = formatPct(pct, overflow);
                return `${f.number} ${f.verb}`;
              })() : 'No budget'}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Budget">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={budgetText}
              onChange={e => {
                const raw = e.target.value;
                setBudgetText(raw);
                const n = clampNonNegative(raw);
                if (raw !== '' && raw !== '-') onUpdate({ budget: n });
                else if (raw === '') onUpdate({ budget: 0 });
              }}
            />
          </Field>
          <Field
            label="Spent"
            hint="Sum of all line items below."
          >
            <Input
              value={fmtBDT(spent)}
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              title="Spent = sum of all line items. Add or edit line items below to change this total."
            />
          </Field>
          <Field label="Due date">
            <Input
              type="date"
              value={cat.dueDate ?? ''}
              onChange={e => onUpdate({ dueDate: e.target.value || undefined })}
            />
          </Field>
        </div>

        <div className="pt-3 mt-1 border-t border-border">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold">Line items</h3>
            <div className="text-[11.5px] text-muted">{paid} of {cat.items.length} done</div>
          </div>
          {cat.items.length === 1
            && cat.items[0].label === 'Main cost'
            && cat.items[0].amount === 0
            && !cat.items[0].done && (
            <div className="text-[12px] text-muted mb-2 flex items-center gap-2">
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--primary)' }}
              />
              Tap the amount field to set the cost for this category.
            </div>
          )}
          <div className="flex flex-col">
            {cat.items.map((it, idx) => {
              // The auto-seeded "Main cost" line is the user's invitation
              // to set the category's primary amount. Detect it by
              // signature so we can flag it visually without storing an
              // extra field on the data model.
              const isSeeded = idx === 0 && it.label === 'Main cost' && it.amount === 0 && !it.done;
              return (
                <div key={it.id} className="grid grid-cols-[20px_1fr_100px_28px] gap-2 items-center py-2 border-t border-border">
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={e => onUpdateItem(it.id, { done: e.target.checked })}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <input
                    value={it.label}
                    onChange={e => onUpdateItem(it.id, { label: e.target.value })}
                    className={[
                      'bg-transparent border-0 py-1 text-sm focus:outline-none focus:text-primary',
                      it.done ? 'text-muted line-through' : 'text-ink',
                    ].join(' ')}
                    style={{ textDecorationColor: 'var(--border)' }}
                  />
                  <LineItemAmount value={it.amount} onChange={n => onUpdateItem(it.id, { amount: n })} emptyHint={isSeeded} />
                  <button
                    type="button"
                    onClick={() => onRemoveItem(it.id)}
                    className="text-muted hover:text-danger text-sm transition"
                    aria-label="Remove line item"
                  >×</button>
                </div>
              );
            })}
            <div className="grid grid-cols-[20px_1fr_100px_28px] gap-2 items-center py-2 border-t border-border">
              <div />
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Add a line — e.g. Friday dinner"
                className="bg-transparent border-0 border-b border-dashed border-border py-1 text-sm text-muted placeholder:text-muted focus:outline-none focus:text-ink focus:border-primary"
              />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                placeholder="Amount"
                className="text-right bg-transparent border-0 border-b border-dashed border-border py-1 text-sm text-muted placeholder:text-muted focus:outline-none focus:text-ink focus:border-primary tabular"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newLabel.trim()) return;
                  onAddItem({ label: newLabel.trim(), amount: clampNonNegative(newAmount), done: false });
                  setNewLabel('');
                  setNewAmount('');
                }}
                className="text-muted hover:text-primary text-lg transition"
                aria-label="Add line item"
              >+</button>
            </div>
          </div>
        </div>

        {/* Primary action row — only the safe actions. */}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>

        {/* Danger zone — visually separated so users don't hit Remove by accident. */}
        <div
          className="mt-4 pt-3 flex justify-between items-center text-[12px]"
          style={{
            borderTop: '1px dashed var(--border)',
          }}
        >
          <span className="text-muted">Done with this category?</span>
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={onRemove}>Remove category</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LineItemAmount({
  value,
  onChange,
  emptyHint,
}: {
  value: number;
  onChange: (n: number) => void;
  /** True for the auto-seeded "Main cost" line that hasn't been filled
   *  in yet — switches the field to a placeholder-driven style so it
   *  reads as "tap to set" instead of "this costs 0". */
  emptyHint?: boolean;
}) {
  // Local draft so the field can be cleared mid-edit. Without this,
  // backspace snaps back to "0" the moment the controlled value changes.
  const [draft, setDraft] = useState(String(value ?? ''));
  const showPlaceholder = emptyHint && (value === 0 || value == null) && draft === '';
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      value={draft}
      onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        const n = clampNonNegative(raw);
        if (raw !== '' && raw !== '-') onChange(n);
        else if (raw === '') onChange(0);
      }}
      onBlur={() => setDraft(String(value ?? ''))}
      placeholder={emptyHint ? 'Set cost' : undefined}
      className={[
        'text-right bg-transparent border-0 py-1 text-sm font-semibold tabular focus:outline-none focus:text-primary',
        showPlaceholder ? 'text-muted placeholder:text-muted' : '',
      ].join(' ')}
    />
  );
}

/* ── Edit-event modal ────────────────────────────────────────────── */

/**
 * Pencil-icon pop-up for the event title's "Edit event details".
 * Lets the user change the budget and/or date; commits both on Save.
 * Pure presentational — the parent owns the store.
 */
function EditEventModal({
  initialBudget,
  initialDate,
  onCommit,
  onCancel,
}: {
  initialBudget: number;
  initialDate: string;
  onCommit: (next: { budget: number; eventDate: string }) => void;
  onCancel: () => void;
}) {
  const [budgetDraft, setBudgetDraft] = useState(String(initialBudget ?? ''));
  const [dateDraft, setDateDraft] = useState(initialDate);

  const parsedBudget = clampNonNegative(budgetDraft);
  const budgetDirty = parsedBudget !== initialBudget;
  const dateDirty = dateDraft !== initialDate;
  const dirty = budgetDirty || dateDirty;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function commit() {
    onCommit({ budget: parsedBudget, eventDate: dateDraft });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-event-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(8px)',
          animation: 'backdrop-fade-in 180ms ease-out both',
        }}
      />
      <div
        className="relative rounded-card w-[480px] max-w-full shadow-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal), var(--card-inset)',
          padding: '28px',
          animation: 'modal-pop-in 180ms ease-out both',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="mb-5 pr-8">
          <h3 id="edit-event-title" className="heading h3-modal m-0">
            Edit event
          </h3>
          <div className="text-muted text-[12.5px] mt-1">
            Update the budget and date. Save commits both.
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Budget">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={budgetDraft}
              onChange={e => setBudgetDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && dirty) { e.preventDefault(); commit(); } }}
              placeholder="0"
              aria-label="Event budget"
              className="!text-[20px] !font-bold tabular"
            />
            {budgetDirty && (
              <div className="text-[10.5px] text-warn uppercase tracking-[0.08em] font-semibold mt-1.5">
                changed
              </div>
            )}
          </Field>

          <Field label="Event date" hint={dateDraft ? fmtDateShort(dateDraft) : undefined}>
            <Input
              type="date"
              value={dateDraft}
              onChange={e => setDateDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && dirty) { e.preventDefault(); commit(); } }}
              aria-label="Event date"
              className="!text-[16px] !font-semibold tabular"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={commit} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
