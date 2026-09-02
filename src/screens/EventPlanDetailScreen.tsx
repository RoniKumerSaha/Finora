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
 *
 * 2026-08-31 polish: Reset / Save plan moved off the top summary strip
 * into a sticky-bottom bar. The status dot + summary pills (Allocated /
 * Paid / Days to go) stay at the top — they're information the user
 * scans — but the actions now live where the user actually finishes
 * their work, so they don't have to scroll back up after editing a
 * category.
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
import { PresetEventCategories } from '../components/planner/PresetEventCategories';
import { formatPct, pctOf, categoryFillStatus, CATEGORY_FILL } from '../components/planner/jarVisuals';
import { categorySpent } from '../domain/plans';
import { ProgressBar } from '../components/ProgressBar';
import { Warn } from '../components/icons/Icons';
import { uid } from '../domain/ids';
import type { PlanCategory, PlanItem } from '../domain/types';

type EventCategory = PlanCategory & { items: PlanItem[]; dueDate?: string };

type MarkKind = 'overdue' | 'due' | 'paid' | 'future' | 'undated' | 'event';
type CategoryFill = 'empty' | 'blue' | 'cyan' | 'green' | 'orange';
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
  //
  // Sort order is shared with the right-column category cards: dated
  // ASC by dueDate, undated categories grouped last. Without this
  // shared order, the timeline rail and the cards column would diverge
  // whenever categories were added out of date order, and the rail's
  // dots would no longer line up with their corresponding cards.
  const sortedCategories = useMemo(() => {
    const dated = plan.categories.filter(c => c.dueDate);
    const undated = plan.categories.filter(c => !c.dueDate);
    dated.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    return [...dated, ...undated];
  }, [plan.categories]);

  const marks = useMemo<Mark[]>(() => {
    const items: Mark[] = [];
    for (const cat of sortedCategories) {
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
      emoji: plan.emoji || '📅',
      kind: 'event',
      fill: allPaid ? 'green' : 'empty',
    };
    return [eventMark, ...items];
  }, [sortedCategories, plan.eventDate, plan.name, plan.emoji, todayISO]);

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
      {/* Top-row back link — same arrow text-link used by GoalDetail
          so every "planner" / "goal" surface across the app shares
          one back affordance. */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/plan/event')}
          className="text-muted text-sm hover:text-ink transition"
        >{'\u2190'} Events</button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className="w-10 h-10 rounded-input inline-flex items-center justify-center shrink-0 bg-surface-2 text-muted"
        ><span className="text-2xl leading-none">{plan.emoji || '📅'}</span></span>
        <div className="flex-1 min-w-0">
          <h1 className="heading h1-screen truncate">{plan.name}</h1>
          <div className="text-muted text-[12.5px] mt-1">
            {fmtDate(plan.eventDate)} ·{' '}
            {summary.budget > 0
              ? <><span className="text-ink font-semibold">{fmtBDT(summary.budget)}</span> total (sum of categories)</>
              : <>No budget yet — add categories to set one</>}
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

      {/* Summary strip — Allocated / Paid / Days to go. The previous
          "Unsaved changes / Saved" status dot was removed because every
          mutation auto-persists (see `runPlan` in store.ts), so there
          is no dirty state to surface. */}
      <div className="card flex flex-wrap items-center gap-3 sm:gap-5 px-4 py-3">
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
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={{
                  background: 'var(--summary-pill-bg)',
                  border: '1px solid var(--summary-pill-border)',
                }}>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Allocated</span>
                  <span className="font-bold text-[15px] tabular" style={{ color: spentColor }}>{fmtBDT(summary.planned)}</span>
                  <span className="text-[12px] text-muted">/ {fmtBDT(summary.budget)}</span>
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={{
                  background: 'var(--summary-pill-bg)',
                  border: '1px solid var(--summary-pill-border)',
                }}>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Paid</span>
                  <span className="font-bold text-[15px] tabular" style={{ color: paidColor }}>{fmtBDT(paid)}</span>
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill" style={{
                  background: 'var(--summary-pill-bg)',
                  border: '1px solid var(--summary-pill-border)',
                }}>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">
                    {daysToGo >= 0 ? 'Days to go' : 'Days ago'}
                  </span>
                  <span className="font-bold text-[15px] tabular text-primary">{Math.abs(daysToGo)}</span>
                </span>
              </>
            );
          })()}
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
                className="w-10 h-10 rounded-input inline-flex items-center justify-center shrink-0 bg-surface-2 text-muted"
              ><span aria-hidden>🎉</span></span>
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

      {(() => {
        // Over-budget banner — fires when the total across all
        // categories either exceeds the event budget (allocated) or
        // already exceeds it via paid amounts (spent). We split the
        // two because they suggest different user actions:
        //   - allocated > budget: trim estimates, lower an amount,
        //                          or raise the budget.
        //   - paid    > budget: this has already left the wallet;
        //                          the budget was simply too low —
        //                          acknowledge, don't panic.
        // Skipped when the budget is 0 (no budget set, so nothing to
        // overflow against) and when everything is paid cleanly.
        const allocatedOver = summary.budget > 0 && summary.planned > summary.budget;
        const paidOver = summary.budget > 0 && summary.paidSoFar > summary.budget;
        if (!allocatedOver && !paidOver) return null;
        const headline = paidOver
          ? 'Paid past the budget'
          : 'Categories sum past the budget';
        const message = paidOver
          ? `You've already paid ${fmtBDT(summary.paidSoFar)} — ${fmtBDT(summary.paidSoFar - summary.budget)} over the ${fmtBDT(summary.budget)} total. Either raise a category budget or accept the overrun.`
          : `Your categories add up to ${fmtBDT(summary.planned)} — ${fmtBDT(summary.planned - summary.budget)} over the ${fmtBDT(summary.budget)} total. Trim an amount, drop a line item, or raise a category budget.`;
        const overflow = summary.budget > 0 && summary.planned > summary.budget ? summary.planned - summary.budget : summary.paidSoFar - summary.budget;
        return (
          <div
            className="card flex flex-wrap items-center gap-4 px-5 py-4"
            style={{
              background: 'var(--danger-callout-bg)',
              border: '1px solid var(--danger)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="w-9 h-9 rounded-full inline-flex items-center justify-center text-lg shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--danger) 18%, transparent)',
                  color: 'var(--danger-title)',
                }}
              ><Warn className="w-5 h-5" /></span>
              <div>
                <div className="font-bold text-[15px] text-ink leading-tight">{headline}</div>
                <div className="text-[12.5px] text-muted mt-0.5 max-w-[60ch]">
                  {message}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-5 ml-auto">
              <div className="flex flex-col items-end">
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Budget</div>
                <div className="font-bold text-[18px] tabular text-ink leading-tight">{fmtBDT(summary.budget)}</div>
              </div>
              <div className="flex flex-col items-end">
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Allocated</div>
                <div className="font-bold text-[18px] tabular leading-tight" style={{ color: 'var(--danger-title)' }}>
                  {fmtBDT(summary.planned)}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">Over by</div>
                <div className="font-bold text-[18px] tabular leading-tight" style={{ color: 'var(--danger-title)' }}>
                  {fmtBDT(overflow)}
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
          {/* Preset categories panel — kit-aware starter library. Sits
              at the top of the column so it's the first affordance the
              user sees for "what should I add to this event?". Auto-
              collapses once categories exist; user re-opens with
              "Browse presets". Dates are seeded relative to the event
              date so the timeline populates immediately. */}
          <PresetEventCategories plan={plan} />

          {sortedCategories.map(c => (
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
        ⓘ Tap a category card to edit it in a pop-up. Use <b className="text-ink">Browse presets</b> above to drop in starter categories. Every edit saves automatically.
      </div>

      {selectedCat && (
        <CategoryEditorModal
          cat={selectedCat}
          onUpdate={patch => updateCategory(plan.id, selectedCat.id, patch)}
          onRemove={async () => {
            // Single delete entry point from inside the modal — the
            // "Delete category" button at the bottom of the modal
            // triggers this. Confirm before nuking — it's the only
            // way to lose the category + every line item it owns, so
            // one extra click is worth the safety. Stay on the event
            // page after delete (no navigation away).
            const ok = await confirm({
              title: `Delete ${selectedCat.name}?`,
              body: 'The category and every line item inside it will be removed from this event.',
              dangerText: 'This can\u2019t be undone — any amounts you typed are lost.',
              confirmLabel: 'Delete category',
              danger: true,
            });
            if (!ok) return;
            removeCategory(plan.id, selectedCat.id);
            setSelectedCatId(null);
          }}
          onAddItem={item => addItem(plan.id, selectedCat.id, item)}
          onUpdateItem={(itemId, patch) => updateItem(plan.id, selectedCat.id, itemId, patch)}
          onRemoveItem={itemId => removeItem(plan.id, selectedCat.id, itemId)}
          onClose={() => setSelectedCatId(null)}
        />
      )}

      {editingEvent && (
        <EditEventModal
          initialDate={plan.eventDate}
          onCommit={({ eventDate }) => {
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
                    <span className="text-[10px] leading-none" aria-hidden>{m.emoji || '📅'}</span>
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
                <div className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
                  <span className="text-base leading-none" aria-hidden>{m.emoji || '📅'}</span>
                  {m.label}
                </div>
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
  // Spent = sum of line items. The 4-step category palette
  // (blue / cyan / green / deep-orange) matches the Month Planner jars;
  // both are exposed from jarVisuals.
  //
  // Layout: title row (emoji + name + due/overdue chip), thin horizontal
  // bar carrying fill ratio, footer with amounts + payment chip.
  // The bar is the primary fill signal — its right edge telegraphs how
  // much budget is left, which the previous liquid-fill design hid.
  const spent = categorySpent(cat);
  const budget = Number(cat.budget) || 0;
  const pct = pctOf(spent, budget);
  const overflow = budget > 0 && spent > budget;
  const cStatus = categoryFillStatus(pct, overflow, budget);
  const cFill = CATEGORY_FILL[cStatus];
  const paid = cat.items.length > 0 && cat.items.every(i => i.done);
  const dueDays = cat.dueDate ? daysBetween(todayISO, cat.dueDate) : null;


  let chip: React.ReactNode = null;
  // Status chips use a leading coloured dot so the category state
  // (paid / overdue / due / future) reads at a glance — the text on
  // muted soft-tinted backgrounds was too quiet on cream + dark,
  // especially at 11px. The dot is the high-contrast focal point;
  // the text rides along with it. Outlined-only (no fill) so the
  // colour carries through border + dot + ink, leaving the card
  // surface uninterrupted.
  if (paid) chip = (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.04em] px-2 py-[3px] rounded-pill border"
      style={{ borderColor: 'var(--success)', color: 'var(--success-title)' }}
    >
      <span aria-hidden className="w-1 h-1 rounded-full" style={{ background: 'var(--success-title)' }} />
      Paid in full
    </span>
  );
  else if (dueDays !== null && dueDays < 0) chip = (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.04em] px-2 py-[3px] rounded-pill border"
      style={{ borderColor: 'var(--danger)', color: 'var(--danger-title)' }}
    >
      <span aria-hidden className="w-1 h-1 rounded-full" style={{ background: 'var(--danger-title)' }} />
      {Math.abs(dueDays)} days overdue
    </span>
  );
  else if (dueDays !== null && dueDays <= 7) chip = (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.04em] px-2 py-[3px] rounded-pill border"
      style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}
    >
      <span aria-hidden className="w-1 h-1 rounded-full" style={{ background: 'var(--warn)' }} />
      Due in {dueDays} {dueDays === 1 ? 'day' : 'days'}
    </span>
  );
  else if (cat.dueDate) chip = (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.04em] px-2 py-[3px] rounded-pill border border-border text-muted">
      <span aria-hidden className="w-1 h-1 rounded-full bg-muted" />
      {fmtDateShort(cat.dueDate)}
    </span>
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'card-flat border border-border rounded-card text-left transition relative',
        'hover:-translate-y-px hover:border-ink-2',
      ].join(' ')}
      style={{ background: 'var(--surface)' }}
    >
      <div className="relative p-4 flex flex-col gap-3">
        {/* Title row — emoji + name left, status chip right */}
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-input flex items-center justify-center shrink-0 bg-surface-2 text-xl leading-none" aria-hidden>
              {cat.emoji}
            </span>
            <span className="font-semibold text-[18px] tracking-tight text-ink truncate">{cat.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">{chip}</div>
        </div>

        {/* Progress bar — same canonical primary → accent gradient
            every other progress bar in the app uses. The original
            category-ramp colour carries over to figures / labels /
            jar fill, so the visual meaning isn't lost. */}
        <div title={budget > 0 ? cFill.label : 'No budget set'}>
          <ProgressBar
            value={budget > 0 ? Math.min(100, overflow ? 100 : pct) : 0}
            height={6}
          />
        </div>

        {/* Footer — amounts left, payment + date chip right. The
            amounts use the same primary/secondary split as before, so
            big number reads at a glance and the /budget is a quieter
            neighbour. */}
        <div className="flex justify-between items-baseline text-[12.5px] gap-3 flex-wrap">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-[16px] tabular text-ink leading-none">{fmtBDT(spent)}</span>
            <span className="text-muted tabular">/ {fmtBDT(budget)}</span>
          </div>
          <span
            className="px-2 py-[3px] rounded-pill inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-ink border border-border"
          >
            <span aria-hidden className="w-1 h-1 rounded-full bg-muted" />
            <span>
              {cat.items.filter(i => i.done).length} of {cat.items.length} paid
            </span>
            {cat.dueDate && (
              <>
                <span className="text-muted">·</span>
                <span>{fmtDateShort(cat.dueDate)}</span>
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
        <Button variant="outlined-primary" onClick={onSave}>Save category</Button>
        <Button variant="outlined-ghost" onClick={onCancel}>Cancel</Button>
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
  //
  // A zero value is rendered as an empty draft (placeholder takes
  // over) — pre-placing "0" makes the field look like it has a value
  // when the user actually intends "no budget set". Empty still
  // commits as 0 via the onChange handler below.
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [budgetText, setBudgetText] = useState(cat.budget > 0 ? String(cat.budget) : '');
  // Re-seed drafts when the modal opens for a different category.
  useEffect(() => {
    setBudgetText(cat.budget > 0 ? String(cat.budget) : '');
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

  // Commit whatever's in the new-line composer row. Used by the `+`
  // button, Enter on either composer input, AND the modal's "Done"
  // button (so a typed-but-not-clicked line item is flushed before
  // the modal closes — losing typed text on Done was the bug).
  // Returns true if a row was actually committed (so callers can
  // decide whether to swallow the next action).
  function commitNewItem(): boolean {
    const label = newLabel.trim();
    if (!label) return false;
    onAddItem({ label, amount: clampNonNegative(newAmount), done: false });
    setNewLabel('');
    setNewAmount('');
    return true;
  }

  // Done flushes any pending composer text first, then closes. This
  // means the user can type a label + amount and click Done without
  // having to find the tiny `+` button — the row saves itself.
  function handleDone() {
    commitNewItem();
    onClose();
  }

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
            <h3 id="cat-editor-title" className="heading h3-modal m-0 flex items-center gap-2">
              <span className="text-xl leading-none" aria-hidden>{cat.emoji}</span>
              {cat.name}
            </h3>
            <div className="text-muted text-[12.5px] mt-1">
              Budget · spent (sum of line items) · due date.
            </div>
          </div>
          {(() => {
            // The header status pill has TWO modes — percentage states
            // (blue/cyan/green/orange) and the explicit "No budget"
            // state. Originally both used CATEGORY_FILL[status].color
            // for border + text + dot, but the no-budget case collapsed
            // everything to `var(--border)` which is so quiet in dark
            // mode that the pill read as blank space. Give "No budget"
            // its own treatment: muted ink on a translucent surface with
            // a neutral dot, so it reads as "missing data, not at zero".
            const isBudgetZero = budget <= 0;
            const pillColor = isBudgetZero ? 'var(--muted)' : CATEGORY_FILL[status].color;
            const pillText = isBudgetZero
              ? 'No budget'
              : (() => {
                  const f = formatPct(pct, overflow);
                  return `${f.number} ${f.verb}`;
                })();
            return (
              <span
                className={[
                  'text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-[3px] rounded-pill whitespace-nowrap inline-flex items-center gap-1.5 border',
                  isBudgetZero ? 'bg-surface-2/60' : '',
                ].join(' ')}
                style={{
                  borderColor: pillColor,
                  color: pillColor,
                }}
                title={isBudgetZero ? 'Set a category budget to track spending %' : CATEGORY_FILL[status].label}
              >
                <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: pillColor }} />
                <span>{pillText}</span>
              </span>
            );
          })()}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Budget">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={budgetText}
              placeholder="Enter budget"
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
          {/* Empty-amount hint banner. Originally fired only for the
              "Main cost" seed from custom-category creation, but the
              Event Planner now seeds preset categories with their own
              defaultItemLabel too ("Entry tickets", "Per-plate cost", …
              all start at amount 0). Widen the trigger so any single
              untouched line item gets the prompt — the user has no
              other way to discover that the amount field is editable. */}
          {cat.items.length === 1
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
            {cat.items.map((it) => {
              // An amount of 0 with !done marks a row the user hasn't
              // filled in yet — show the "Set cost" placeholder so they
              // know the field is editable. Originally this fired only
              // for the literal "Main cost" label, but the Event
              // Planner now seeds categories with preset-specific labels
              // ("Entry tickets", "Per-plate cost", …) that are also
              // untouched. Use amount/done as the signal so it works for
              // every empty row, not just the first one.
              const isSeeded = it.amount === 0 && !it.done;
              return (
                <div key={it.id} className="grid grid-cols-[20px_1fr_100px_36px] gap-2 items-center py-2 border-t border-border">
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={e => onUpdateItem(it.id, { done: e.target.checked })}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <input
                    value={it.label}
                    onChange={e => onUpdateItem(it.id, { label: e.target.value })}
                    // text-sm matches the composer's label input so
                    // both rows read at the same size — without it,
                    // the row label inherits the Field default and
                    // reads visually bigger than "Add a line —" below.
                    className={[
                      'bg-transparent border-0 py-1 text-sm focus:outline-none focus:text-primary',
                      it.done ? 'text-muted line-through' : 'text-ink',
                    ].join(' ')}
                    style={{ textDecorationColor: 'var(--border)' }}
                  />
                  <LineItemAmount value={it.amount} onChange={n => onUpdateItem(it.id, { amount: n })} emptyHint={isSeeded} />
                  {/* Remove row — proper icon button (not a bare × glyph)
                      so the affordance reads as actionable, with a soft
                      danger hover bg instead of just a colour swap.
                      Track widened from 28px to 36px to fit the surface
                      and visually match the + button on the composer
                      row below. */}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(it.id)}
                    title={`Remove “${it.label || 'this line'}”`}
                    aria-label={`Remove line item ${it.label || ''}`}
                    className="w-9 h-9 rounded-full inline-flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
            <div className="grid grid-cols-[20px_1fr_100px_36px] gap-2 items-center py-2 border-t border-border">
              <div />
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitNewItem(); } }}
                placeholder="Add a line — e.g. Deposit, Tickets"
                className="bg-transparent border-0 border-b border-dashed border-border py-1 text-sm text-muted placeholder:text-muted focus:outline-none focus:text-ink focus:border-primary"
              />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitNewItem(); } }}
                placeholder="Amount"
                className="text-right bg-transparent border-0 border-b border-dashed border-border py-1 text-sm text-muted placeholder:italic placeholder:opacity-70 focus:outline-none focus:text-ink focus:border-primary tabular"
              />
              <button
                type="button"
                onClick={commitNewItem}
                disabled={!newLabel.trim()}
                // Minimalist commit control — a hairline tick icon that
                // sits in line with the row. Same 36×36 footprint as
                // the per-row remove (×) button so the two controls
                // read as a matched pair. At rest it's a muted
                // outline (no fill, no border, no shadow); on hover
                // /focus the colour steps to primary so the affordance
                // becomes findable, but it never grows or fills.
                // Disabled keeps the muted tone — the icon stays
                // visible, just clearly inactive.
                className="w-9 h-9 inline-flex items-center justify-center rounded-sm text-muted hover:text-primary active:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted focus-visible:outline-none focus-visible:text-primary"
                aria-label="Add line item"
                title="Add line item (Enter)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M4 8.5 L7 11.5 L13 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Primary action row — only the safe actions. */}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="primary" onClick={handleDone}>Done</Button>
        </div>

        {/* Danger zone — visually separated so users don't hit Remove by accident. */}
        <div
          className="mt-4 pt-3 flex justify-between items-center text-[12px]"
          style={{
            borderTop: '1px dashed var(--border)',
          }}
        >
          <span className="text-muted">Done with this category?</span>
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={onRemove}>Delete category</Button>
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
  placeholderText = 'Enter cost',
}: {
  value: number;
  onChange: (n: number) => void;
  /** True for the auto-seeded line that hasn't been filled in yet —
   *  switches the field to a placeholder-driven style so it reads as
   *  "tap to set" instead of "this costs 0". */
  emptyHint?: boolean;
  /** Custom placeholder for the empty-state. Default "Enter cost".
   *  Italicised + weight-reduced via the `placeholder:italic
   *  placeholder:font-normal` classes below so it can never be read
   *  as a static row label. */
  placeholderText?: string;
}) {
  // The field has two responsibilities: stay editable (so the user can
  // backspace without the value snapping back) and stay committed
  // (every keystroke lands in the store). Two state pieces:
  //
  //   `draft`   — what's in the input right now (string, can be empty)
  //   `lastCommitted` — the value that was last pushed to the store;
  //                   used to detect when the parent has new data for us
  //                   (e.g. an external mutation) so we can resync.
  //
  // The seed case (emptyHint + value 0) renders as empty so the
  // placeholder shows. Clearing the field commits 0.
  const [draft, setDraft] = useState(() => {
    if (emptyHint && (value === 0 || value == null)) return '';
    return value > 0 ? String(value) : '';
  });
  const [lastCommitted, setLastCommitted] = useState(() => clampNonNegative(draft));
  // If the parent's `value` changes for any reason (another store
  // mutation, opening the modal for a different category) and our local
  // draft isn't mid-edit, resync the draft so we display the truth.
  useEffect(() => {
    if (value !== lastCommitted && document.activeElement?.tagName !== 'INPUT') {
      setDraft(emptyHint && value === 0 ? '' : value > 0 ? String(value) : '');
      setLastCommitted(value);
    }
  }, [value, lastCommitted, emptyHint]);

  const showPlaceholder = emptyHint && (value === 0 || value == null) && draft === '';

  function commit(raw: string) {
    const n = clampNonNegative(raw);
    setLastCommitted(n);
    onChange(n);
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      value={draft}
      onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw !== '' && raw !== '-') commit(raw);
        else if (raw === '') commit('');
      }}
      onBlur={() => {
        // Final flush: if the user typed digits but never moved focus
        // before clicking the modal's Done button, the input's last
        // onChange already pushed the value. This is a no-op safety
        // net that ensures the store reflects the field's text even
        // if a keystroke raced the blur.
        if (clampNonNegative(draft) !== lastCommitted) commit(draft);
      }}
      placeholder={emptyHint ? placeholderText : undefined}
      // Placeholder styling MUST be visibly different from a real
      // value or users will read it as static row content. Italic +
      // reduced font-weight + lower opacity is enough to break the
      // visual equivalence and read as "instruction" not "data".
      // `text-sm` (14px) matches the new-line composer's amount input
      // exactly — without it, the LineItemAmount inherits the Field's
      // default 16px and the seeded "Enter cost" placeholder reads
      // visually larger than the composer row's "Amount" beside it,
      // making the column feel uneven.
      className={[
        'text-right bg-transparent border-0 py-1 text-sm font-semibold tabular focus:outline-none focus:text-primary',
        'placeholder:italic placeholder:font-normal placeholder:opacity-70',
        showPlaceholder ? 'text-muted placeholder:text-muted' : '',
      ].join(' ')}
      title={emptyHint ? 'Tap to enter the cost' : undefined}
    />
  );
}

/* ── Edit-event modal ────────────────────────────────────────────── */

/**
 * Pencil-icon pop-up for the event title's "Edit event details".
 * Lets the user change the date; commits on Save.
 *
 * The event-level budget used to live here too, but it's no longer a
 * free-form input — the budget derives from `Σ category.budget` (see
 * `summariseEventPlan`). To bump the total, the user edits a category's
 * budget inline. This modal is now date-only.
 *
 * Pure presentational — the parent owns the store.
 */
function EditEventModal({
  initialDate,
  onCommit,
  onCancel,
}: {
  initialDate: string;
  onCommit: (next: { eventDate: string }) => void;
  onCancel: () => void;
}) {
  const [dateDraft, setDateDraft] = useState(initialDate);

  const dateDirty = dateDraft !== initialDate;
  const dirty = dateDirty;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function commit() {
    onCommit({ eventDate: dateDraft });
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
            Edit event date
          </h3>
          <div className="text-muted text-[12.5px] mt-1">
            The event's total budget is the sum of category budgets — edit a category to adjust the total.
          </div>
        </div>

        <div className="flex flex-col gap-4">
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
