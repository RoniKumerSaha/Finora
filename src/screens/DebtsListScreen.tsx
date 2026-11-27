/**
 * DebtsListScreen — one CERTIFICATE per debt.
 *
 * 2026-11-26 redesign (the document family): a debt is an IOU — a
 * PROMISE, not a holding — so the card is a perforated document
 * rather than a tile. The shell is the same sheet the goal receipt
 * and the investment certificate use, but each part of it carries a
 * debt-specific meaning:
 *
 *   - the STAMP states the polarity ("I owe" / "Owed to me"), so the
 *     direction is readable before any number is;
 *   - a flat debt gets a TEAR-OFF STUB — the counterparty's copy,
 *     perforated down the left edge, which is what makes a flat debt
 *     read as an IOU slip;
 *   - a loan gets an APR rate SEAL (a tilted circle, the same shape
 *     as the investment certificate's rate seal), because a loan is
 *     an instrument with a rate;
 *   - the RAIL is the share already settled;
 *   - a completed debt is a SETTLED DOCUMENT — the same sheet in the
 *     quiet ink of something already dealt with, stamped PAID;
 *   - the Summary is a STATEMENT — the rolled-up view, holding the
 *     totals instead of one debt's terms.
 *
 * The `--tone` custom property is set inline per debt: danger for
 * "I owe", primary for "Owed to me". The wash, the stamp, the rail
 * and the hero figure all share that one colour identity.
 *
 * The e2e suite addresses the cards structurally, so the contract
 * below is load-bearing: the direction tag, the paid line, the
 * counterparty line, the `t-22` headline figure, the "of ৳ Y
 * total" caption, the "% paid" hint, the loan terms line, the loan
 * amount and split lines, the Monthly EMI / Outstanding pair, and
 * the Summary's "You owe" / "Owed to you" figures and captions.
 */
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { loanEMI, loanPaymentSplit } from '../domain/math';
import { DebtPaymentModal } from './DebtPaymentModal';
import { fmtBDT, fmtDate } from '../lib/format';
import { debtTone } from '../lib/cardSurface';
import { ProgressRail } from '../components/planner/ProgressRail';
import type { CardTone } from '../lib/cardSurface';

const MIDDOT = '\u00B7';

/* ---------------- tone helpers ---------------- */

/**
 * The tone's raw colour, as a CSS value. The certificate's wash,
 * stamp and rail all read it, so one assignment colours the whole
 * document.
 */
const TONE_VAR: Record<CardTone, string> = {
  primary: 'var(--primary)',
  danger:  'var(--danger)',
  accent:  'var(--accent)',
  warn:    'var(--warn)',
  success: 'var(--success)',
  info:    'var(--info)',
  muted:   'var(--muted)',
  cyan:    'var(--cyan)',
};

/* ---------------- serial numbers ---------------- */

/**
 * A stable serial number for a debt.
 *
 * The app stores no document numbers, so a real one would be a lie.
 * This derives a stable six-digit number from the debt id — the same
 * debt always shows the same serial, so the face does not shuffle
 * between visits.
 */
function serialFor(id: string): string {
  // FNV-1a: small, fast, well-distributed. We only need stability.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return String(h % 1_000_000).padStart(6, '0');
}

/* ---------------- the debt card ---------------- */

function DebtCard({ debt: d, animDelay = 0 }: { debt: any; animDelay?: number }) {
  const state = useStore(s => s.state);
  const isIOwe = d.direction === 'i_owe';
  const isLoan = d.kind === 'loan';
  // Per-debt tone — derived once and reused everywhere on the card
  // (wash, stamp, rail, hero figure).
  const cardTone = debtTone(d.direction, d.kind);
  const directionLabel = isIOwe ? 'I owe' : 'Owed to me';

  // The headline figure: the canonical outstanding. For loan-kind this
  // replays the interest/principal split (so it reports the principal
  // still owed, not total minus gross payments); for flat-kind it's
  // total minus what's been paid.
  const outstanding = debts.outstandingFor(d, state.transactions);

  // ── Loan-specific derived figures ──
  // A loan certificate is an instrument, so it carries the same
  // engraved terms a bond would: the amount borrowed, and the split of
  // every payment so far into interest (money paid to the lender) and
  // principal (money that actually reduced what you owe).
  const rate = Number(d.interestRate) || 0;
  const term = Number(d.termMonths) || 0;
  const monthlyEmi = isLoan && term > 0
    ? Math.round(loanEMI(Number(d.total) || 0, rate, term))
    : 0;
  const linkedTx = isLoan
    ? state.transactions
        .filter(t => t.linkedDebtId === d.id)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  let totalInterest = 0;
  let totalPrincipal = 0;
  if (isLoan && linkedTx.length > 0) {
    let out = Number(d.total) || 0;
    for (const t of linkedTx) {
      const matches =
        (d.direction === 'i_owe' && t.type === 'expense') ||
        (d.direction === 'owed_to_me' && t.type === 'income');
      if (!matches) continue;
      const split = loanPaymentSplit(out, Number(t.amount) || 0, rate);
      totalInterest += split.interest;
      totalPrincipal += split.principal;
      out = Math.max(0, out - split.principal);
    }
  }

  // Progress — the share of the PRINCIPAL that's been retired.
  //
  // For a loan, `paidSoFar` is gross: every payment also carried
  // interest, so gross-paid-over-total ran ahead of the real progress
  // (and could even read 100% while principal was still outstanding).
  // Use the principal actually repaid instead.
  const pct = d.total > 0
    ? Math.min(100, Math.round(
        ((isLoan ? totalPrincipal : (d.paidSoFar || 0)) / d.total) * 100
      ))
    : 0;

  // Loan payment modal — opened from the Pay button on the card.
  const [payOpen, setPayOpen] = useState(false);
  function openPay(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPayOpen(true);
  }

  const serial = serialFor(d.id);

  return (
    <div
      className={`debt-cert ${isLoan ? '' : 'debt-cert--stub'} card-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 relative`}
      style={{ ['--tone' as string]: TONE_VAR[cardTone] }}
    >
      {/* The full-card link overlay. `z-0` puts it under the
          document's own content, and every interactive child sits
          above it via `z-[1]`. */}
      <Link
        to={`/debts/${d.id}/edit`}
        className="absolute inset-0 z-0"
        aria-label={`Edit debt "${d.name}"`}
      />

      {/* The tear-off stub — a flat debt is an IOU slip with the
          counterparty's copy down the left margin. */}
      {!isLoan && (
        <>
          <span className="debt-cert__stublabel" aria-hidden />
          <span className="debt-cert__stubtail" aria-hidden>Counterparty copy</span>
        </>
      )}

      <div className="debt-cert__head">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="debt-cert__name">{d.name}</div>
            {/* The "LOAN" chip — the loan sub-type. A flat debt has
                no chip: the stamp already says what it is.

                It wears the STAMP treatment — a hairline rule in the
                card's own tone, square corners, the wide tracking of
                an engraved label — because it sits directly beside the
                card's own stamp. As a soft filled blob it read as a
                different badge family from the stamp next to it; as a
                miniature stamp the two speak one language. */}
            {isLoan && (
              <span
                className="shrink-0 inline-flex items-center px-2 py-[3px] rounded-[4px] border border-current t-10 font-bold uppercase tracking-label"
                style={{ color: 'var(--tone)' }}
              >
                Loan
              </span>
            )}
          </div>
          <div className="debt-cert__serial">
            NO. {serial}
            {isLoan
              ? ` ${MIDDOT} LOAN${term > 0 ? ` ${term} MO` : ''}`
              : ` ${MIDDOT} ${isIOwe ? 'I OWE' : 'OWED TO ME'}${d.person ? ` ${MIDDOT} ${d.person.toUpperCase()}` : ''}`}
          </div>
        </div>

        {isLoan ? (
          /* A loan is an instrument with a rate, so it carries the
             APR seal rather than the polarity stamp — the polarity
             is already on the serial line. */
          rate > 0 ? (
            <span className="debt-cert__seal" aria-label={`${rate}% APR`}>
              <span className="p">{rate}%</span>
              <span className="l">APR</span>
            </span>
          ) : (
            <span className="debt-cert__stamp">{directionLabel}</span>
          )
        ) : (
          /* The polarity stamp — the one fact that must be readable
             before any number is. */
          <span className="debt-cert__stamp" title={isIOwe ? 'You owe this person' : 'This person owes you'}>
            {directionLabel}
          </span>
        )}
      </div>

      {/* The counterparty line — a flat note has no term and no rate,
          so the one fact it still owes the reader is WHO it is with.
          A loan does not need this line at all: its APR is engraved
          in the seal above and its term is named in the serial line
          beside the name ("LOAN 36 MO"). The line used to repeat
          both — "12.75% APR · 36mo" sat directly under a seal
          already reading 12.75% and a serial already reading 36 MO. */}
      {!isLoan && d.person && (
        <div className="t-12 text-muted tabular truncate mt-2">
          {isIOwe ? 'Owed to' : 'Owed by'} <span className="text-ink font-semibold">{d.person}</span>
        </div>
      )}

      {isLoan ? (
        <>
          {/* The loan's engraved terms — all three read the same way:
              a small uppercase label with its figure on the line
              beneath it. */}
          <div className="debt-cert__fields">
            <div className="debt-cert__f">
              <div className="k">Loan amount</div>
              <div className="v">{fmtBDT(d.total)}</div>
            </div>
            <div className="debt-cert__f">
              <div className="k">Interest paid</div>
              <div className="v v--danger">{fmtBDT(totalInterest)}</div>
            </div>
            <div className="debt-cert__f">
              <div className="k">Principal paid</div>
              <div className="v v--primary">{fmtBDT(totalPrincipal)}</div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* The flat debt's engraved terms. */}
          <div className="debt-cert__fields">
            <div className="debt-cert__f">
              <div className="k">Total</div>
              <div className="v">{fmtBDT(d.total)}</div>
            </div>
            <div className="debt-cert__f">
              <div className="k">Paid</div>
              <div className="v">{fmtBDT(d.paidSoFar || 0)}</div>
            </div>
            <div className="debt-cert__f">
              <div className="k">Settled</div>
              <div className="v">{pct}%</div>
            </div>
          </div>
        </>
      )}

      {/* The rail — the share of the PRINCIPAL already retired.
          For a loan this is not the same as "paid": every payment
          also carried interest, so a bar reading gross-paid-over-total
          would run ahead of the truth and could read 100% while
          principal was still outstanding. So the bar shows principal,
          and the CAPTION says so — "principal settled", not "paid".
          On a flat debt the two are the same thing, so the caption
          drops the qualifier. */}
      <ProgressRail
        value={pct}
        state={pct >= 100 ? 'done' : pct > 0 ? 'active' : 'pending'}
        measure={isLoan ? 'principal settled' : 'debt settled'}
        label={`${d.name} settled`}
        animDelay={animDelay}
        caption={
          pct <= 0 ? (
            // Nothing paid yet — say so. "0%" is a number pretending to
            // be a fact; "nothing paid yet" is the fact.
            <>Nothing paid yet</>
          ) : isLoan ? (
            <>
              <b className="text-ink font-semibold">{pct}%</b> of the principal settled
            </>
          ) : (
            <>
              <b className="text-ink font-semibold">{pct}%</b> paid
            </>
          )
        }
      />

      {/* The document's closing figures. */}
      {isLoan ? (
        <div className="debt-cert__vals">
          <div className="debt-cert__v debt-cert__v--now">
            <div className="k">Monthly EMI</div>
            <div className="n">{monthlyEmi > 0 ? fmtBDT(monthlyEmi) : '—'}</div>
          </div>
          <div className="debt-cert__v debt-cert__v--mat" style={{ textAlign: 'right' }}>
            <div className="k">Outstanding</div>
            <div className="n">{fmtBDT(outstanding)}</div>
          </div>
        </div>
      ) : (
        <div className="debt-cert__vals">
          <div className="debt-cert__v debt-cert__v--now">
            <div className="k">Remaining</div>
            <div className="n">{fmtBDT(outstanding)}</div>
          </div>
          <div className="debt-cert__v debt-cert__v--mat" style={{ textAlign: 'right' }}>
            {/* The unpaid share — the complement of the "Settled %"
                field above. That field says how much is done; this
                one says how much is still owed, and it is the only
                figure on the card not already stated. It used to
                repeat the total instead, printing the same number
                twice thirty pixels apart. */}
            <div className="k">Still owed</div>
            <div className="n">{100 - pct}%</div>
          </div>
        </div>
      )}

      {/* The footnote — the document's small print, plus the action
          that changes it. The flat debt's paid line lives here
          because a flat IOU has no ledger of its own: "You've paid
          ৳ X of ৳ Y" is a statement about the document's total. */}
      {isLoan ? (
        <div className="debt-cert__note flex items-center justify-between gap-3">
          <span>
            <strong>Pay now</strong> — record a repayment against this loan
          </span>
          {d.status === 'active' && (
            <button
              type="button"
              onClick={openPay}
              title={isIOwe ? `Record a payment toward "${d.name}"` : `Record a receipt from "${d.name}"`}
              style={{
                background: isIOwe
                  ? 'color-mix(in srgb, var(--danger) 65%, black)'
                  : 'color-mix(in srgb, var(--primary) 65%, black)',
              }}
              className={`relative z-[1] shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[#ffffff] t-13 font-bold tracking-tight border-0 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 transition active:translate-y-px ${isIOwe ? 'focus-visible:ring-danger/40' : 'focus-visible:ring-primary/40'}`}
            >
              <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-white" />
              {isIOwe ? 'Pay now' : 'Receive now'}
            </button>
          )}
        </div>
      ) : (
        <div className="debt-cert__note flex items-center justify-between gap-3">
          <span className="tabular">
            {isIOwe ? 'You\'ve paid' : 'They\'ve paid'} {fmtBDT(d.paidSoFar || 0)} of {fmtBDT(d.total)}
          </span>
          {d.status === 'active' && (
            <button
              type="button"
              onClick={openPay}
              title={isIOwe ? `Record a payment toward "${d.name}"` : `Record a receipt from "${d.name}"`}
              style={{
                background: isIOwe
                  ? 'color-mix(in srgb, var(--danger) 65%, black)'
                  : 'color-mix(in srgb, var(--primary) 65%, black)',
              }}
              className={`relative z-[1] shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[#ffffff] t-13 font-bold tracking-tight border-0 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 transition active:translate-y-px ${isIOwe ? 'focus-visible:ring-danger/40' : 'focus-visible:ring-primary/40'}`}
            >
              <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-white" />
              {isIOwe ? 'Pay now' : 'Receive now'}
            </button>
          )}
        </div>
      )}

      {payOpen && (
        <DebtPaymentModal
          debt={d}
          outstandingAtOpen={outstanding}
          onClose={() => setPayOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------- the summary statement ---------------- */

function DebtSummary({
  oweRemaining,
  receivableRemaining,
  oweCount,
  receivableCount,
  hasAnyLoan,
}: {
  oweRemaining: number;
  receivableRemaining: number;
  oweCount: number;
  receivableCount: number;
  hasAnyLoan: boolean;
}) {
  // The net position — what you owe minus what you're owed. It is the
  // one number the statement exists to deliver.
  const net = oweRemaining - receivableRemaining;

  // The largest single balance, so the statement names the debt that
  // actually dominates the position.
  const state = useStore(s => s.state);
  let largest = 0;
  let totalInterest = 0;
  for (const d of debts.list(state)) {
    if (d.status !== 'active') continue;
    const left = debts.outstandingFor(d, state.transactions);
    if (left > largest) largest = left;
    if (d.kind === 'loan') {
      const rate = Number(d.interestRate) || 0;
      let out = Number(d.total) || 0;
      for (const t of state.transactions
        .filter(t => t.linkedDebtId === d.id)
        .sort((a, b) => a.date.localeCompare(b.date))) {
        const matches =
          (d.direction === 'i_owe' && t.type === 'expense') ||
          (d.direction === 'owed_to_me' && t.type === 'income');
        if (!matches) continue;
        totalInterest += loanPaymentSplit(out, Number(t.amount) || 0, rate).interest;
      }
    }
  }

  const activeCount = oweCount + receivableCount;

  return (
    <section className="debt-cert debt-cert--statement h-fit lg:sticky lg:top-4" style={{ ['--tone' as string]: 'var(--danger)' }}>
      <div className="debt-cert__head">
        <div className="min-w-0">
          <div className="debt-cert__name" style={{ textTransform: 'uppercase' }}>Summary</div>
          <div className="debt-cert__serial">{activeCount} ACTIVE</div>
        </div>
        <span className="debt-cert__stamp" style={{ ['--tone' as string]: 'var(--muted)', borderStyle: 'dashed', transform: 'rotate(-4deg)' }}>
          {activeCount} active
        </span>
      </div>

      <div className="debt-cert__rule" />

      {/* The per-direction breakdown — one line per polarity, each
          carrying its own tone. The label and the "Across N debt(s)"
          caption are separate elements so the caption can name the
          count in full. */}
      <div className="debt-cert__lines">
        {oweCount > 0 && (
          <div className="debt-cert__line">
            <span className="k">You owe</span>
            <span className="v v--danger">{fmtBDT(oweRemaining)}</span>
            <span className="debt-cert__cap">Across {oweCount} debt{oweCount === 1 ? '' : 's'}</span>
          </div>
        )}
        {receivableCount > 0 && (
          <div className="debt-cert__line">
            <span className="k">Owed to you</span>
            <span className="v v--primary">{fmtBDT(receivableRemaining)}</span>
            <span className="debt-cert__cap">Across {receivableCount} debt{receivableCount === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>

      <div className="debt-cert__rule" />

      <div className="debt-cert__vals">
        <div className="debt-cert__v debt-cert__v--now">
          <div className="k">Net position</div>
          <div className="n">{fmtBDT(net)}</div>
        </div>
        {hasAnyLoan && (
          <div className="debt-cert__v debt-cert__v--mat">
            <div className="k">Interest paid</div>
            <div className="n">{fmtBDT(totalInterest)}</div>
          </div>
        )}
        <div className="debt-cert__v debt-cert__v--wide">
          <span className="k">Largest balance</span>
          <span className="n">{fmtBDT(largest)}</span>
        </div>
      </div>

      {/* This note earns its place: the mechanics it describes —
          opening transactions, income vs expense polarity, the split
          between interest and principal — appear NOWHERE else in the
          app. It is genuinely additive, so it stays. */}
      <div className="debt-cert__note">
        <strong>How it works:</strong> borrowed cash lands as <em>Income</em>; lent cash lands as{' '}
        <em>Expense</em>. Use the <em>Pay now</em> / <em>Receive now</em> chip on a card to record
        a partial repayment.
        {hasAnyLoan && (
          <>
            {' '}
            On loans, each payment splits into <em>interest</em> and <em>principal</em> — only the
            principal reduces what you still owe.
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------- completed debts ---------------- */

/**
 * The settled documents.
 *
 * A completed debt leaves the active grid, but it is not a footnote —
 * it is a document that has been paid, and the archive reads better
 * when each entry is a sheet in the same language as the live ones.
 */
function CompletedSection({ rows }: { rows: any[] }) {
  const state = useStore(s => s.state);
  return (
    <section className="debt-cert debt-cert--settled" style={{ ['--tone' as string]: 'var(--muted-2)' }}>
      <div className="debt-cert__head">
        <div className="min-w-0">
          <h2 className="debt-cert__name" style={{ margin: 0 }}>
            Completed ({rows.length})
          </h2>
          <div className="debt-cert__serial">SETTLED IN FULL</div>
        </div>
        <span className="debt-cert__stamp" style={{ ['--tone' as string]: 'var(--success)' }}>
          Paid
        </span>
      </div>

      <div className="debt-cert__rule" />

      <div className="flex flex-col">
        {rows.map(d => {
          // Find the account that was used in the linked transactions —
          // most recent first, so the user sees the account that actually
          // received the final payment.
          const linked = state.transactions
            .filter(t => t.linkedDebtId === d.id)
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date));
          const accId = linked[0]?.accountId;
          const acc = state.accounts.find((a: any) => a.id === accId);
          const settledOn = linked[0]?.date;
          return (
            <Link
              key={d.id}
              to={`/debts/${d.id}/edit`}
              className="group relative block py-3 border-t border-border first:border-0 row-hover -mx-2 px-2 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className="flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="debt-cert__name">{d.name}</div>
                  <div className="t-11 text-muted leading-tight mt-1 truncate tabular">
                    {fmtBDT(d.total)} paid off
                    {d.person ? ` ${MIDDOT} ${d.person}` : ''}
                    {acc ? ` ${MIDDOT} ${acc.name}` : ''}
                  </div>
                </div>
                <div className="shrink-0 t-10 text-muted uppercase tracking-wider font-semibold opacity-0 group-hover:opacity-100 transition">
                  View
                </div>
              </div>
              {settledOn && (
                <div className="debt-cert__tally">
                  <span className="pip" />
                  Settled on <b>{fmtDate(settledOn)}</b>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- the screen ---------------- */

export function DebtsListScreen() {
  const state = useStore(s => s.state);
  const ds = debts.list(state);
  // Active debts — fully paid debts are surfaced in their own Completed
  // section so the active list stays focused on what's still owed.
  const active = ds.filter(d => d.status === 'active');
  const completed = ds.filter(d => d.status === 'completed');

  // Per-direction remaining totals for the Summary statement. Uses the
  // canonical `debtOutstanding` helper for every debt — loan-kind
  // replays the interest/principal split, flat-kind subtracts paid
  // from total. Same helper Home and net worth read, so the three
  // screens always agree.
  let oweRemaining = 0;
  let receivableRemaining = 0;
  for (const d of active) {
    const left = debts.outstandingFor(d, state.transactions);
    if (d.direction === 'i_owe') oweRemaining += left;
    else receivableRemaining += left;
  }
  const showReceivable = receivableRemaining > 0;
  const showOwe = oweRemaining > 0;
  const oweCount = active.filter(d => d.direction === 'i_owe').length;
  const receivableCount = active.filter(d => d.direction === 'owed_to_me').length;
  // V1.1: drives the extra sentence in the "How it works" copy.
  const hasAnyLoan = active.some(d => d.kind === 'loan');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="heading h1-screen">Debts</h1>
          <div className="text-muted t-13 mt-1.5 tabular">
            {active.length} active{completed.length > 0 ? ` ${MIDDOT} ${completed.length} completed` : ''}
          </div>
        </div>
        <Link
          to="/debts/add"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold t-13 text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
          <span className="t-13 leading-none">+</span>
          <span>Add</span>
        </Link>
      </div>

      {ds.length === 0 ? (
        <section className="card">
          <div className="py-10 text-center text-muted">
            <div className="t-13 font-semibold text-ink">No debts yet.</div>
            <div className="t-12 mt-2">Add a debt to track who owes whom.</div>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
          <div className="flex flex-col gap-4">
            {active.map((d, i) => <DebtCard key={d.id} debt={d} animDelay={i * 180} />)}
            {completed.length > 0 && (
              <CompletedSection rows={completed} />
            )}
          </div>

          {/* Summary statement — pinned on the right at lg+ so the
              totals stay visible while scrolling the list. Stacks
              below the list at smaller breakpoints. */}
          {(showOwe || showReceivable) && (
            <DebtSummary
              oweRemaining={oweRemaining}
              receivableRemaining={receivableRemaining}
              oweCount={oweCount}
              receivableCount={receivableCount}
              hasAnyLoan={hasAnyLoan}
            />
          )}
        </div>
      )}
    </div>
  );
}
