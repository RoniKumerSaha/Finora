/**
 * InvestmentsListScreen — one certificate card per investment, with
 * the Summary card pinned to the right at lg+.
 *
 * 2026-08-18 polish: each active investment is its own full-width
 * .card surface in the left column, not a half- or third-width tile.
 * The wider canvas lets the card carry identity + terms + amounts in
 * a clean left/right horizontal split, so the user can scan more text
 * without truncation. The Summary card stays on the right at lg+ so
 * the totals are always visible while scrolling the list; on smaller
 * screens it stacks below the list as a single full-width band.
 *
 * 2026-11-26: the card is now a CERTIFICATE — a perforated bond
 * instrument carrying engraved terms, a serial number, a tilted rate
 * seal, a two-line deposit ledger and the two values separated by a
 * named interest figure. See `.inv-cert` in `src/styles/app.css`.
 *
 * ONE SHELL FOR EVERY TYPE. A DPS pays a fixed installment every
 * month for years, so its full deposit ledger can run to dozens of
 * rows; an FDR has exactly one deposit. Both get the SAME two-line
 * ledger — LAST DEPOSIT and NEXT DUE (or MATURES for a lump sum) —
 * so the card's HEIGHT NEVER GROWS with the term. A 34-deposit DPS
 * and a 1-deposit FDR are the same card, the same height.
 *
 * Card shape:
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │  Brac Bank DPS                         ⌒ 8.5% RATE              │
 *   │  NO. 126784 · DPS · BRAC BANK                                   │
 *   │  PRINCIPAL  TERM      MATURES                                   │
 *   │  ৳ 3,00,000 60 mo    2.4y                                      │
 *   │  DEPOSITS                              34 OF 60 PAID             │
 *   │  LAST DEPOSIT  01 Nov 2026                            ৳ 5,000 │
 *   │  NEXT DUE      01 Dec 2026                            ৳ 5,000 │
 *   │  ● ৳ 1,70,000 contributed so far · ৳ 1,51,674 in the account    │
 *   │  VALUE TODAY   INTEREST      AT MATURITY                       │
 *   │  ৳ 1,51,674    ৳ 3,01,226    ৳ 4,52,900                        │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Hover lifts via .card-link. Closed investments stay in a quieter
 * flat list at the bottom.
 */
import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import {
  investmentValue,
  isInvestmentHeld,
  daysToMaturity,
  dpsLedger,
  investmentMaturityDate,
} from '../domain/math';
import { fmtBDT, fmtDate } from '../lib/format';
import { investmentTone } from '../lib/cardSurface';
import type { Investment, Transaction } from '../domain/types';

const MIDDOT = '\u00B7';

export function InvestmentsListScreen() {
  const state = useStore(s => s.state);
  const invs = investments.list(state);
  // "Held" = still holding the money. A matured-but-unpaid scheme
  // still holds cash at the bank, so it stays in the main list and in
  // the summary. `closed` / `rolled_over` schemes are retired and move
  // to the quiet list at the bottom. Uses the same predicate as net
  // worth and the Home strip so all three agree.
  const active = invs.filter(isInvestmentHeld);
  const closed = invs.filter(i => !isInvestmentHeld(i));
  // Compute each row's value once and reuse for summary + the row
  // itself (avoids recomputing dpsCurrentValue, which scans every
  // transaction, twice per row).
  let totalCurrent = 0;
  let totalProjected = 0;
  const rows = active.map(inv => {
    const v = investmentValue(inv, state.transactions);
    totalCurrent += v.currentValue;
    totalProjected += v.projectedValue;
    return { inv, current: v.currentValue, projected: v.projectedValue };
  });

  // The per-type breakdown the summary certificate carries — one line
  // per kind of holding, each in its own tone, so the card says WHERE
  // the money is parked and not just how much.
  const breakdown = (['dps', 'fdr', 'savings'] as const)
    .map(type => {
      const ofType = rows.filter(r => r.inv.type === type);
      if (ofType.length === 0) return null;
      return {
        type,
        label: type === 'dps' ? 'DPS' : type === 'fdr' ? 'FDR' : 'Savings',
        tone: investmentTone(type),
        count: ofType.length,
        current: ofType.reduce((s, r) => s + r.current, 0),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="heading h1-screen">Investments</h1>
          <div className="text-muted t-13 mt-1.5 tabular">{invs.length} total</div>
        </div>
        <Link
          to="/investments/add"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn font-bold t-13 text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--primary)' }}
        >
          <span className="t-13 leading-none">+</span>
          <span>Add</span>
        </Link>
      </div>

      {invs.length === 0 ? (
        <section className="card">
          <div className="py-10 text-center text-muted">
            <div className="t-13 font-semibold text-ink">No investments yet.</div>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            <div className="flex flex-col gap-4">
              {rows.map(({ inv, current, projected }) => (
                <InvCard
                  key={inv.id}
                  inv={inv}
                  current={current}
                  projected={projected}
                  transactions={state.transactions}
                />
              ))}
              {closed.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="label m-0">
                    Closed {MIDDOT} {closed.length}
                  </h2>
                  <div className="grid grid-cols-1 gap-4">
                    {closed.map(inv => (
                      <ClosedInvCard key={inv.id} inv={inv} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <section className="h-fit lg:sticky lg:top-4">
              <article className="inv-cert inv-cert--summary">
                <div className="inv-cert__head">
                  <div className="min-w-0">
                    <div className="inv-cert__name">Summary</div>
                    <div className="inv-cert__serial">
                      NO. {String(active.length).padStart(6, '0')} {MIDDOT} {active.length} ACTIVE {MIDDOT} HOLDINGS
                    </div>
                  </div>
                </div>

                {/* The per-type breakdown — one line per kind of
                    holding, each in its own tone, so the card says
                    WHERE the money is parked and not just how much. */}
                <div className="inv-cert__fields inv-cert__fields--stack">
                  {breakdown.map(b => (
                    <div className="inv-cert__f" key={b.label}>
                      <div className="k">
                        {b.label} {MIDDOT} {b.count}
                      </div>
                      <div className="v" style={{ color: `var(--${b.tone})` }}>
                        {fmtBDT(b.current)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* The footer — the same three-figure form the cards
                    use: value today, the interest between, at maturity. */}
                <div className="inv-cert__vals">
                  <div className="inv-cert__v inv-cert__v--now">
                    <div className="k">Value today</div>
                    <div className="n">{fmtBDT(totalCurrent)}</div>
                  </div>
                  <div className="inv-cert__v inv-cert__v--mat">
                    <div className="k">At maturity</div>
                    <div className="n">{fmtBDT(totalProjected)}</div>
                  </div>
                  <div className="inv-cert__grow">
                    <div className="gk">Interest if every term completes</div>
                    <div className="gn">{fmtBDT(Math.max(0, totalProjected - totalCurrent))}</div>
                  </div>
                </div>

                <div className="inv-cert__note">
                  Record a payout as Income to bring the money back to your account.
                </div>
              </article>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/** The type's short label — "DPS" / "FDR" / "Savings". */
function typeLabel(inv: Investment): string {
  return inv.type === 'dps' ? 'DPS' : inv.type === 'fdr' ? 'FDR' : 'Savings';
}

/**
 * A stable-looking serial number for the certificate.
 *
 * Derived from the investment's id so it never changes for a given
 * holding — a serial that shuffled on every render would defeat the
 * point of printing one.
 */
function serialFor(inv: Investment): string {
  let hash = 0;
  for (let i = 0; i < inv.id.length; i += 1) {
    hash = (hash * 31 + inv.id.charCodeAt(i)) % 999999;
  }
  return String(hash).padStart(6, '0');
}

/**
 * The stamp on a retired holding.
 *
 * A stamp is a physical claim about a document, so the wording is
 * document language, not app language — the same vocabulary the goal
 * receipt uses. A scheme that was rolled into another reads ROLLED
 * OVER; one the holder shut by hand reads CLOSED.
 */
const CLOSED_STAMP: Record<'closed' | 'rolled_over', string> = {
  closed: 'Closed',
  rolled_over: 'Rolled over',
};

/**
 * A retired holding — the same certificate shell as a live one, but
 * printed in the quiet ink of a spent document: no rate seal, no
 * ledger, just the terms that were agreed and a status stamp.
 *
 * The stamp is the card's headline. It replaces the soft "CLOSED"
 * pill, which read as a label rather than a verdict on a document.
 */
function ClosedInvCard({ inv }: { inv: Investment }) {
  const stampKind = inv.status === 'rolled_over' ? 'rolled_over' : 'closed';
  const maturity = investmentMaturityDate(inv);
  const days = daysToMaturity(inv);
  const term =
    inv.termDays ? `${inv.termDays}d` : `${inv.termMonths} mo`;

  return (
    <Link
      to={`/investments/${inv.id}`}
      className="block card-link card-link--wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <article
        className="inv-cert inv-cert--closed"
        style={{ ['--tone' as string]: 'var(--muted-2)' }}
      >
        <div className="inv-cert__head">
          <div className="min-w-0">
            <div className="inv-cert__name">{inv.name}</div>
            <div className="inv-cert__serial">
              NO. {serialFor(inv)} {MIDDOT} {typeLabel(inv).toUpperCase()}
              {inv.institution ? ` ${MIDDOT} ${inv.institution.toUpperCase()}` : ''}
            </div>
          </div>
          <div className="inv-cert__stamp">{CLOSED_STAMP[stampKind]}</div>
        </div>

        <div className="inv-cert__fields">
          <div className="inv-cert__f">
            <div className="k">Principal</div>
            <div className="v">{fmtBDT(inv.principal)}</div>
          </div>
          <div className="inv-cert__f">
            <div className="k">Rate</div>
            <div className="v">{inv.rate}%</div>
          </div>
          <div className="inv-cert__f">
            <div className="k">Term</div>
            <div className="v">{term}</div>
          </div>
        </div>

        <div className="inv-cert__tally">
          <span className="pip" aria-hidden />
          <span>
            {maturity
              ? `Ended ${fmtDate(maturity.toISOString().slice(0, 10))}`
              : `Ended ${days > 0 ? 'recently' : 'earlier'}`}
          </span>
        </div>
      </article>
    </Link>
  );
}

function InvCard({
  inv,
  current,
  projected,
  transactions,
}: {
  inv: Investment;
  current: number;
  projected: number;
  transactions: Transaction[];
}) {
  const days = daysToMaturity(inv);
  const isDps = inv.type === 'dps';
  // A holding past its maturity date is a COMPLETED instrument: the
  // bank owes the full mature amount and there is nothing left to
  // project. `investmentValue` collapses current → the mature amount
  // and leaves projected there too, so the two footer figures would
  // read as an identical pair and the interest would print as zero.
  // The card says so explicitly instead.
  const matured = days <= 0;
  // Per-category tone — DPS / FDR / Savings each get their own color
  // family. Applied to the wash + seal + amounts so the whole card
  // reads as one themed instrument.
  const cardTone = investmentTone(inv.type);
  const interest = Math.max(0, projected - current);

  // Long durations (≥ 1 year) read more naturally as years; short
  // durations stay in days. 1 decimal keeps the precision while
  // staying compact (e.g. "2.4y" instead of "877d").
  const maturityLabel =
    days > 0
      ? days >= 365
        ? `Matures in ~${(days / 365).toFixed(1)}y`
        : `Matures in ${days}d`
      : days === 0
        ? 'Matures today'
        : `Matured ${-days}d ago`;

  // The "TIME LEFT" field — the same figure, phrased as a duration.
  // A matured holding has no time left, so it reads "Matured" and
  // the term length stands in for the gap.
  const timeLeft =
    days > 0
      ? days >= 365
        ? `~${(days / 365).toFixed(1)}y`
        : `${days}d`
      : days === 0
        ? 'Today'
        : 'Matured';

  // The DPS ledger — the two dated lines the certificate shows.
  const ledger = isDps ? dpsLedger(inv, transactions) : null;

  // The deposits bar's percentage — how much of the schedule has been
  // paid in. A term of zero months has no schedule, so no bar.
  const depositsPct = isDps && inv.termMonths > 0
    ? Math.min(100, Math.round(((ledger?.installmentsPaid ?? 0) / inv.termMonths) * 100))
    : 0;

  // A lump sum's second ledger line is its MATURITY date; a DPS's is
  // the NEXT installment due. Same shape, so the card's height never
  // grows with the term.
  const maturityDate = investmentMaturityDate(inv);

  return (
    <Link
      to={`/investments/${inv.id}`}
      className="block card-link card-link--wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <article
        className="inv-cert"
        style={{ ['--tone' as string]: `var(--${cardTone})` }}
      >
        {/* The header — name + serial on the left, the tilted rate
            seal on the right. */}
        <div className="inv-cert__head">
          <div className="min-w-0">
            <div className="inv-cert__name">{inv.name}</div>
            <div className="inv-cert__serial">
              NO. {serialFor(inv)} {MIDDOT} {typeLabel(inv).toUpperCase()}
              {inv.institution ? ` ${MIDDOT} ${inv.institution.toUpperCase()}` : ''}
              {` ${MIDDOT} ${maturityLabel}`}
            </div>
          </div>
          <div className="inv-cert__seal" aria-label={`${inv.rate}% rate`}>
            <span className="p">{inv.rate}%</span>
            <span className="l">RATE</span>
          </div>
        </div>

        {/* The engraved terms. A DPS has no principal — its money
            arrives as a monthly installment, so the first field names
            the installment instead of mislabelling it. */}
        <div className="inv-cert__fields">
          <div className="inv-cert__f">
            <div className="k">{isDps ? 'Monthly' : 'Principal'}</div>
            <div className="v">{fmtBDT(isDps ? inv.monthlyContribution ?? 0 : inv.principal)}</div>
          </div>
          <div className="inv-cert__f">
            <div className="k">Term</div>
            <div className="v">
              {inv.termDays ? `${inv.termDays}d` : `${inv.termMonths} mo`}
            </div>
          </div>
          <div className="inv-cert__f">
            <div className="k">Time left</div>
            <div className="v">{timeLeft}</div>
          </div>
        </div>

        {/* The ledger — exactly two dated lines, whatever the type. */}
        <div className="inv-cert__ledger">
          <div className="inv-cert__ledger-head">
            <span className="t">{isDps ? 'Deposits' : 'Deposit record'}</span>
            <span className="n">
              {isDps
                ? `${ledger?.installmentsPaid ?? 0} of ${inv.termMonths} paid`
                : '1 lump sum'}
            </span>
          </div>

          {/* The deposits bar — how far through the schedule the
              deposits have got. A DPS is a marathon of monthly
              payments, and "34 of 60 paid" is a number the reader
              has to do arithmetic on; the bar says it at a glance.

              A lump sum has no schedule, so it gets no bar — an
              always-full bar next to "1 lump sum" would be noise. */}
          {isDps && (
            <div
              className="inv-cert__deposits"
              role="progressbar"
              aria-valuenow={depositsPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${inv.name} deposits made`}
            >
              {/* An empty bar paints no fill — a zero-width fill with a
                  hairline edge still shows as a speck at the start of
                  the track, which reads as a stray mark rather than as
                  "no deposits yet". */}
              {depositsPct > 0 && <i style={{ width: `${depositsPct}%` }} />}
            </div>
          )}

          {isDps ? (
            <>
              <div className="inv-cert__dline">
                <span className="inv-cert__dk">Last deposit</span>
                <span className="inv-cert__dd">
                  {ledger?.lastDeposit ? fmtDate(ledger.lastDeposit.date) : '—'}
                </span>
                <span className="inv-cert__da">
                  {ledger?.lastDeposit ? fmtBDT(ledger.lastDeposit.amount) : '—'}
                </span>
              </div>
              <div className="inv-cert__dline inv-cert__dline--next">
                <span className="inv-cert__dk">Next due</span>
                <span className="inv-cert__dd">{fmtDate(ledger?.nextDueDate ?? inv.startDate)}</span>
                <span className="inv-cert__da">{fmtBDT(inv.monthlyContribution ?? 0)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="inv-cert__dline">
                <span className="inv-cert__dk">Last deposit</span>
                <span className="inv-cert__dd">{fmtDate(inv.startDate)}</span>
                <span className="inv-cert__da">{fmtBDT(inv.principal)}</span>
              </div>
              <div className="inv-cert__dline inv-cert__dline--next">
                <span className="inv-cert__dk">{matured ? 'Matured' : 'Matures'}</span>
                <span className="inv-cert__dd">
                  {maturityDate ? fmtDate(maturityDate) : '—'}
                </span>
                <span className="inv-cert__da">{fmtBDT(projected)}</span>
              </div>
            </>
          )}

          {/* The tally — the numbers the two date lines cannot carry. */}
          <div className="inv-cert__tally">
            <span className="pip" aria-hidden />
            <span>
              {isDps ? (
                <>
                  <b>{fmtBDT(ledger?.contributed ?? 0)}</b> contributed so far {MIDDOT}{' '}
                  <b>{fmtBDT(current)}</b> in the account
                </>
              ) : (
                <>
                  Lump sum {MIDDOT} <b>{fmtBDT(inv.principal)}</b> locked in at start
                </>
              )}
            </span>
          </div>
        </div>

        {/* The footer — value today, the interest between, at maturity.
            A matured holding has nothing left to project: the two
            figures would be identical and the interest would read as
            zero, so it gets a single "payable now" figure and says so. */}
        {matured ? (
          <div className="inv-cert__vals">
            <div className="inv-cert__v inv-cert__v--now">
              <div className="k">Payable now</div>
              <div className="n">{fmtBDT(current)}</div>
            </div>
            <div className="inv-cert__grow">
              <div className="gk">Earned</div>
              <div className="gn">{fmtBDT(Math.max(0, current - (isDps ? (ledger?.contributed ?? current) : inv.principal)))}</div>
            </div>
            <div className="inv-cert__v inv-cert__v--mat">
              <div className="k">Term ended</div>
              <div className="n">{maturityDate ? fmtDate(maturityDate) : '—'}</div>
            </div>
          </div>
        ) : (
          <div className="inv-cert__vals">
            <div className="inv-cert__v inv-cert__v--now">
              <div className="k">Value today</div>
              <div className="n">{fmtBDT(current)}</div>
            </div>
            <div className="inv-cert__grow">
              <div className="gk">Interest</div>
              <div className="gn">{fmtBDT(interest)}</div>
            </div>
            <div className="inv-cert__v inv-cert__v--mat">
              <div className="k">At maturity</div>
              <div className="n">{fmtBDT(projected)}</div>
            </div>
          </div>
        )}
      </article>
    </Link>
  );
}