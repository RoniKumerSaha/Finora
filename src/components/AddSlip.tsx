/**
 * AddSlip — the shared vocabulary of the ADD screens.
 *
 * The certificate family (`.inv-cert`, `.debt-cert`, `.goal-receipt`)
 * covers what you HOLD. The add screens cover what you MAKE, and a
 * creation screen has a different job: it has to make you fill in
 * the blanks of a document AND show you the document as it fills in.
 *
 * The first attempt did that with two documents — a form on the left,
 * a live certificate on the right — and the cost was a gap to look
 * across every time you wanted to check a number. So the add screens
 * get ONE document instead: the record itself, drawn at full width,
 * with its blanks still open.
 *
 * Three rules follow from that, and they are the same on all five
 * screens (transactions, accounts, goals, investments, debts):
 *
 *   1. **The amount is the headline.** It is the one thing you always
 *      know the moment you open the screen, so it gets the biggest
 *      type on the page — not a field among fields.
 *
 *   2. **The one big decision is a stamp you press**, not a dropdown.
 *      A dropdown hides the alternative; a stamp shows every option
 *      at once, so you always see what you are *not* choosing. This
 *      matters most where the choice changes everything downstream:
 *      income vs expense vs transfer, I-owe vs owed-to-me.
 *
 *   3. **The consequence is a clause of the record**, written inside
 *      the document — "Cash goes from ৳ 53,500 to ৳ 51,000" — not a
 *      toast bolted under the form where most phones never see it.
 *
 * Every component here takes a `tone` and sets it on the element, so
 * the wash, the stamp, the amount and the clause all share one colour
 * identity that follows the record's kind.
 */
import type { ReactNode } from 'react';

/* ---------- the slip ------------------------------------------ */

/**
 * The record. `tone` is the record's own colour: danger for money
 * going out, primary for money coming in, info for money moving, and
 * so on.
 */
export function Slip({
  tone,
  children,
  className,
}: {
  tone: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={['slip', className || ''].join(' ').trim()}
      style={{ ['--tone' as string]: tone }}
    >
      <div className="slip__wash" aria-hidden />
      {children}
    </section>
  );
}

/** The slip's head — what kind of record this is. */
export function SlipHead({
  what,
  title,
  sub,
  aside,
}: {
  /** The category of the record, in small caps: "New entry". */
  what: string;
  /** The record's name: "A transaction". */
  title: string;
  /** One sentence on what this record will do. */
  sub?: string;
  /** Anything on the right — usually nothing. */
  aside?: ReactNode;
}) {
  return (
    <div className="slip__head">
      <div style={{ minWidth: 0 }}>
        <div className="slip__what">{what}</div>
        <div className="slip__title">{title}</div>
        {sub && <div className="slip__sub">{sub}</div>}
      </div>
      {aside}
    </div>
  );
}

/* ---------- the stamps ---------------------------------------- */

/**
 * One option in a stamp group.
 *
 * Rendered as a `button` with `role="radio"` inside a
 * `role="radiogroup"`, so arrow keys and screen readers treat the
 * group as one choice — which is what it is.
 */
export function Stamp({
  on,
  onClick,
  icon,
  title,
  sub,
}: {
  on: boolean;
  onClick: () => void;
  /** A 16×16 stroke icon. */
  icon: ReactNode;
  /** The choice, in plain words: "Went out". */
  title: string;
  /** The example, so you can tell which entries belong here. */
  sub?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`stamp${on ? ' on' : ''}`}
    >
      <span className="stamp__ico" aria-hidden>{icon}</span>
      <span>
        <span className="stamp__t">{title}</span>
        {sub && <span className="stamp__s">{sub}</span>}
      </span>
    </button>
  );
}

/** The group of stamps — the one big decision on the slip. */
export function StampGroup({
  label,
  cols = 3,
  children,
}: {
  /** The accessible name of the group. */
  label: string;
  /** 2, 3 or 4 across. */
  cols?: 2 | 3 | 4;
  children: ReactNode;
}) {
  const cls = cols === 2 ? 'stamps stamps--2' : cols === 4 ? 'stamps stamps--4' : 'stamps';
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cls}
    >
      {children}
    </div>
  );
}

/* ---------- the amount ---------------------------------------- */

/**
 * The amount, as the slip's headline.
 *
 * `label` says which quantity this is — "Amount", "Total owed",
 * "Target amount", "Every month" — because the same control carries
 * different quantities on different records.
 */
export function SlipAmount({
  label,
  value,
  onChange,
  placeholder,
  inputMode = 'decimal',
  autoFocus,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric';
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="slip__amount">
      <div className="slip__amount-l">{label}</div>
      <div className="slip__amount-v">
        <span className="slip__cur" aria-hidden>৳</span>
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          aria-label={label}
        />
      </div>
    </div>
  );
}

/* ---------- the blanks ---------------------------------------- */

/**
 * A labelled rule waiting for ink.
 *
 * The label sits in the left column — engraved, in the same small
 * caps the certificates use for their engraved fields — and the
 * control sits on the right, on a rule you would write on. The hint
 * under the label says what the field is for.
 *
 * `empty` draws the rule dashed, so "not yet filled" is visible
 * without the label having to say it.
 */
export function Blank({
  label,
  hint,
  empty,
  children,
}: {
  label: string;
  hint?: string;
  /** Draws the rule dashed — for a field still waiting on a value. */
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`blank${empty ? ' blank--empty' : ''}`}>
      <div>
        <div className="blank__k">{label}</div>
        {hint && <div className="blank__hint">{hint}</div>}
      </div>
      <div className="blank__v">{children}</div>
    </div>
  );
}

/** A blank that carries a set of chips rather than one value. */
export function BlankStack({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="blank blank--stack">
      <div>
        <div className="blank__k">{label}</div>
        {hint && <div className="blank__hint">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ---------- the clause ----------------------------------------- */

/**
 * The consequence of the record, written inside the document.
 *
 * On four of the five screens this restates a balance ("Cash goes
 * from ৳ 53,500 to ৳ 51,000"). On the goal screen it does the
 * arithmetic that decides whether the plan works — which is the one
 * question a goal screen can answer that a note field cannot.
 */
export function Clause({
  tone,
  icon,
  children,
}: {
  /** Usually the slip's own tone; override for a warning. */
  tone?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="clause"
      style={tone ? { ['--tone' as string]: tone } : undefined}
    >
      <span className="clause__ico" aria-hidden>{icon}</span>
      <span className="clause__t">{children}</span>
    </div>
  );
}

/* ---------- the effects strip --------------------------------- */

/**
 * Two balances, one movement — the transfer's consequence.
 *
 * Two numbers side by side read faster than a sentence about two
 * numbers, so a transfer gets this strip instead of prose. The AFTER
 * balance is the headline (it is where the money ends up) and the
 * before sits beneath it, struck through by its own wording.
 */
export function Effects({
  fromLabel,
  fromName,
  fromBefore,
  fromAfter,
  toLabel,
  toName,
  toBefore,
  toAfter,
  arrow,
}: {
  fromLabel: string;
  fromName: string;
  fromBefore: string;
  fromAfter: string;
  toLabel: string;
  toName: string;
  toBefore: string;
  toAfter: string;
  arrow: ReactNode;
}) {
  return (
    <div className="effects">
      <div className="effects__side">
        <div className="effects__l">{fromLabel}</div>
        <div className="effects__n">{fromName}</div>
        <div className="effects__move">{fromAfter}</div>
        <div className="effects__was">was {fromBefore}</div>
      </div>
      <div className="effects__arrow" aria-hidden>{arrow}</div>
      <div className="effects__side">
        <div className="effects__l">{toLabel}</div>
        <div className="effects__n">{toName}</div>
        <div className="effects__move">{toAfter}</div>
        <div className="effects__was">was {toBefore}</div>
      </div>
    </div>
  );
}

/* ---------- the foot ------------------------------------------ */

/** The slip's foot — the save row and the note beside it. */
export function SlipFoot({
  note,
  children,
}: {
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="slip__foot">
      {note && <div className="slip__foot-note">{note}</div>}
      <div className="flex gap-2.5 flex-wrap items-center">{children}</div>
    </div>
  );
}

/* ---------- the summary rail ---------------------------------- */

/**
 * The side column's "at a glance" strip.
 *
 * It is a SUMMARY, not a second form — one row of figures, no
 * controls — so it can never disagree with the slip.
 */
export function Recap({
  title = 'At a glance',
  rows,
}: {
  title?: string;
  rows: Array<{ k: string; v: string; tone?: string; total?: boolean }>;
}) {
  return (
    <div className="recap">
      <div className="recap__h">{title}</div>
      <div className="recap__rows">
        {rows.map(r => (
          <div
            key={r.k}
            className={`recap__row${r.total ? ' recap__row--total' : ''}`}
          >
            <span>{r.k}</span>
            <b style={r.tone ? { color: r.tone } : undefined}>{r.v}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
