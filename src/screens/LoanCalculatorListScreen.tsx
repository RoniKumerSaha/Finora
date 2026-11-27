/**
 * LoanCalculatorListScreen — list of saved loan projections.
 *
 * 2026-11-26 redesign (the document family): a projection is a
 * PROMISE, not a contract — nothing here touches the ledger. So the
 * card wears the SAME certificate shell as the real debt card
 * (`.debt-cert`): the same perforated sheet, the same engraved
 * fields, the same rail, the same closing figures.
 *
 * What marks it as a projection rather than a real debt is the
 * PLANNED stamp — a dashed, tilted label standing in for the debt
 * card's APR seal, because there is no instrument behind it yet. The
 * tone is the danger ink a loan always carries: a loan is a cost.
 *
 * The shape matches the debt certificate exactly:
 *
 *   - the header carries the name, the serial and the PLANNED stamp;
 *   - the engraved fields name the principal, the term and the rate;
 *   - the rail tracks the term's progress (the plan has no payments,
 *     so it cannot show a settled share);
 *   - the tally carries the count the other lines cannot hold;
 *   - the footer names the EMI and the total you would pay.
 *
 * The Summary sidebar becomes a STATEMENT certificate — the same
 * shell, holding the aggregates instead of one projection's terms.
 *
 * A DRAFT is a plan that has never been saved, so it is marked with
 * a Draft pill rather than a second stamp: one stamp per card.
 */
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import { listLoanPlans, summariseLoanPlan } from '../domain/loanPlans';
import { Button } from '../components/Button';
import { fmtBDT, fmtDate } from '../lib/format';
import { formatDurationShort } from '../domain/duration';
import type { CardTone } from '../lib/cardSurface';

const MIDDOT = '\u00B7';

/**
 * The tone's raw colour, as a CSS value. The certificate's stamp,
 * pip and amount colours all read it, so one assignment colours the
 * whole document.
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

/**
 * A stable serial number for a projection.
 *
 * The app stores no document numbers, so a real one would be a lie.
 * This derives a stable six-digit number from the plan id — the same
 * plan always shows the same serial, so the face does not shuffle
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

/**
 * The last payment date — the end of the term.
 *
 * The amortization table is monthly from the first payment date, so
 * the last payment lands `termMonths - 1` months later.
 */
function lastPaymentDate(plan: { startDate: string; termMonths: number }): string | null {
  const term = Math.max(0, Math.floor(Number(plan.termMonths) || 0));
  if (!plan.startDate || term <= 0) return null;
  const d = new Date(plan.startDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + term - 1);
  return d.toISOString().slice(0, 10);
}

export function LoanCalculatorListScreen() {
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const addLoanPlan = useStore(s => s.addLoanPlan);
  const removeLoanPlan = useStore(s => s.removeLoanPlan);
  const plans = listLoanPlans(state);

  // Saved plans (have a `savedAt`) come first; drafts (never saved
  // or edited since the last Save) come second. Both render as the
  // same card — drafts just carry the warn-toned Draft pill so the
  // user can tell them apart at a glance. No more hiding drafts in
  // a footer section.
  const saved = plans.filter(p => !p.dirty);
  const drafts = plans.filter(p => p.dirty);
  const ordered = [...saved, ...drafts];

  function startNew() {
    const today = new Date().toISOString().slice(0, 10);
    const id = addLoanPlan({
      name: '',
      principal: 0,
      rate: 0,
      termMonths: 12,
      startDate: today,
    });
    navigate(`/plan/loan/${id}`);
  }

  // Aggregate totals for the sidebar summary statement.
  //
  // DRAFTS COUNT. The cards below show a draft's numbers as plainly
  // as a saved one's, so the summary that sits beside them has to
  // aggregate the same set — otherwise the page contradicts itself,
  // with a card reading "৳ 1,00,000 borrowed" next to a sidebar
  // reading "৳ 0". A draft is a projection the user has not
  // committed yet, but it is still on the board.
  let totalMonthly = 0;
  let totalPaid = 0;
  let totalPrincipal = 0;
  let totalInterest = 0;
  for (const plan of ordered) {
    const s = summariseLoanPlan(plan);
    totalMonthly += s.emi;
    totalPaid += s.totalPaid;
    totalPrincipal += Math.max(0, Number(plan.principal) || 0);
    totalInterest += Math.max(0, s.totalInterest);
  }
  const count = ordered.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Top-row back link — same arrow text-link used by GoalDetail
          and EventPlanDetail so every "planner" / "goal" surface
          across the app shares one back affordance. */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/plan')}
          className="text-muted t-13 hover:text-ink transition"
        >{'\u2190'} Plans</button>
      </div>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">Loan Calculator</h1>
          <div className="text-muted t-13 mt-1.5 max-w-prose">
            Project what a loan will cost. Enter principal, rate, and term — the app fills the amortization table for you.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="primary" onClick={startNew}>+ New projection</Button>
        </div>
      </header>

      {plans.length === 0 ? (
        <div className="card flex flex-col gap-3 items-start">
          <div className="t-15 font-semibold text-ink">No projections yet</div>
          <p className="t-13 text-muted leading-relaxed max-w-prose">
            Try a sample — 100,000 BDT at 9% for 12 months — and see the EMI + total interest computed live.
          </p>
          <Button variant="primary" onClick={startNew}>Start a projection</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
            {/* Left column — one certificate per projection, the same
                shell the Debts screen uses. Saved plans render first,
                drafts render after, each draft carries the Draft pill
                so the user can tell saved from in-flight at a glance. */}
            <div className="flex flex-col gap-3">
              {ordered.map(plan => (
                <LoanProjectionCard
                  key={plan.id}
                  plan={plan}
                  onOpen={() => navigate(`/plan/loan/${plan.id}`)}
                />
              ))}
            </div>

            {/* Right column — the Summary STATEMENT. The sidebar
                carries the position across EVERY projection, which
                is a different fact from any one card's terms.

                It used to also print a per-card echo — the same
                "Total you pay" and "Monthly EMI" figures the card
                beside it already showed, which on a single
                projection meant the number appeared twice on the
                same screen. The sidebar now says only what the
                cards cannot: how many projections are on the board,
                what they add up to, and what that costs. */}
            <section
              className="debt-cert debt-cert--plain debt-cert--statement h-fit lg:sticky lg:top-4"
              style={{ ['--tone' as string]: TONE_VAR.danger }}
            >
              <div className="debt-cert__head">
                <div className="min-w-0">
                  <div className="debt-cert__name" style={{ textTransform: 'uppercase' }}>Summary</div>
                  <div className="debt-cert__serial">
                    NO. {String(count).padStart(6, '0')} {MIDDOT} {count} PROJECTION{count === 1 ? '' : 'S'}
                  </div>
                </div>
                <span
                  className="debt-cert__stamp debt-cert__stamp--planned"
                  title="These are projections — no real loan has been taken."
                >
                  Planned
                </span>
              </div>

              <div className="debt-cert__rule" />

              {/* The breakdown — one line per aggregate, label left
                  and figure right. */}
              <div className="debt-cert__lines">
                <div className="debt-cert__line">
                  <span className="k">Projections</span>
                  <span className="v">{count}</span>
                </div>
                <div className="debt-cert__line">
                  <span className="k">Borrowed in total</span>
                  <span className="v">{fmtBDT(totalPrincipal)}</span>
                </div>
                <div className="debt-cert__line">
                  <span className="k">Interest in total</span>
                  <span className="v" style={{ color: 'var(--danger)' }}>{fmtBDT(totalInterest)}</span>
                </div>
              </div>

              <div className="debt-cert__vals">
                {/* The two closing figures of the WHOLE board — what
                    every projection asks of you each month, and what
                    they cost you in all. */}
                <div className="debt-cert__v debt-cert__v--wide">
                  <span className="k">Combined EMI</span>
                  <span className="n">{fmtBDT(totalMonthly)}</span>
                </div>
                <div className="debt-cert__v debt-cert__v--wide">
                  <span className="k">Total you pay</span>
                  <span className="n">{fmtBDT(totalPaid)}</span>
                </div>
              </div>

              {/* Only the part the figures cannot say for themselves:
                  these are aggregates across every projection, and no
                  real money moves. The old note also explained that
                  "Monthly EMI" and "Total you pay" live on each card
                  — which is visible, three inches away. */}
              <div className="debt-cert__note">
                These are aggregates across every projection. Nothing here moves real money.
              </div>
            </section>
          </div>

          {/* Drafts footer. Drafts already show inline above with
              the Draft pill, but a quiet footer lets the user mass-
              clean drafts they don't want anymore in a single tap. */}
          {drafts.length > 0 && (
            <section className="card">
              <h2 className="label m-0 mb-3">
                Unsaved drafts ({drafts.length})
              </h2>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="t-12 text-muted leading-relaxed m-0">
                  Drafts are shown above with a Draft pill. Clear them here if you don't want to keep them.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { drafts.forEach(d => removeLoanPlan(d.id)); }}>
                    Clear drafts
                  </Button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ── Sub-component ──────────────────────────────────────────────── */

/**
 * A loan projection — the SAME certificate shell as a real debt card,
 * so the plan and the debt read as siblings of one document family.
 *
 * A projection has no payments on record, so its rail cannot show a
 * settled share. It shows the TERM instead: the share of the plan's
 * life that has elapsed, measured against the first payment date.
 */
function LoanProjectionCard({
  plan, onOpen,
}: {
  plan: ReturnType<typeof listLoanPlans>[number];
  onOpen: () => void;
}) {
  const s = summariseLoanPlan(plan);
  const principal = Math.max(0, Number(plan.principal) || 0);
  const term = Math.max(0, Math.floor(Number(plan.termMonths) || 0));
  const rate = Number(plan.rate) || 0;
  const lastDate = lastPaymentDate(plan);

  // A loan projection is a cost, so it carries the danger tone — the
  // same ink the real loan card uses.
  const cardTone: CardTone = 'danger';

  return (
    <div
      className="debt-cert debt-cert--plain card-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 relative"
      style={{ ['--tone' as string]: TONE_VAR[cardTone] }}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open loan projection "${plan.name || 'Untitled loan'}"`}
    >
      {/* The header — name + serial on the left, the PLANNED stamp on
          the right, standing in for the debt card's APR seal. */}
      <div className="debt-cert__head">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="debt-cert__name">{plan.name || 'Untitled loan'}</div>
            {/* The DRAFT chip — a plan that has never been saved. It
                sits beside the title so the user can tell saved from
                in-flight at a glance.

                It wears the STAMP treatment: a hairline rule in the
                warn tone, square corners, the wide tracking of an
                engraved label. It shares a card with the PLANNED
                stamp at the far right, and as a soft filled blob it
                read as a different badge family entirely. */}
            {plan.dirty && (
              <span className="shrink-0 inline-flex items-center px-2 py-[3px] rounded-[4px] border border-warn text-warn t-10 font-bold uppercase tracking-label">
                Draft
              </span>
            )}
          </div>
          <div className="debt-cert__serial">
            NO. {serialFor(plan.id)} {MIDDOT} LOAN PROJECTION
          </div>
        </div>

        {/* The PLANNED stamp — the one fact that must be readable
            before any number is: this is a projection, not a debt. */}
        <span
          className="debt-cert__stamp debt-cert__stamp--planned"
          title="This is a projection — no real loan has been taken."
        >
          Planned
        </span>
      </div>

      {/* The engraved terms — all four read the same way: a small
          uppercase label with its figure on the line beneath it.

          These used to be doubled by a "9% APR · 4y" line above
          them. The rate and the term each appeared twice within
          thirty pixels of each other, and a reader who landed on
          the second copy stopped trusting the first. The fields
          are the copy that stays.

          The interest is the fourth field because it is the cost
          of the loan — the number a borrower actually came for.
          It used to live in a tally line that also repeated the
          principal and the total, so the one figure worth stating
          was buried between two copies of figures already on the
          card. */}
      <div className="debt-cert__fields debt-cert__fields--four">
        <div className="debt-cert__f">
          <div className="k">Loan amount</div>
          <div className="v">{fmtBDT(principal)}</div>
        </div>
        <div className="debt-cert__f">
          <div className="k">Term</div>
          <div className="v">{term > 0 ? formatDurationShort(term) : '—'}</div>
        </div>
        <div className="debt-cert__f">
          <div className="k">Rate</div>
          <div className="v">{rate}%</div>
        </div>
        <div className="debt-cert__f">
          <div className="k">Interest</div>
          <div className="v" style={{ color: 'var(--danger)' }}>{fmtBDT(s.totalInterest)}</div>
        </div>
      </div>

      {/* The document's closing figures. */}
      <div className="debt-cert__vals">
        <div className="debt-cert__v debt-cert__v--now">
          <div className="k">Monthly EMI</div>
          <div className="n">{fmtBDT(s.emi)}</div>
        </div>
        <div className="debt-cert__v debt-cert__v--mat" style={{ textAlign: 'right' }}>
          <div className="k">Total you pay</div>
          <div className="n">{fmtBDT(s.totalPaid)}</div>
        </div>
      </div>

      {/* The footnote — the document's small print. */}
      <div className="debt-cert__note">
        <span className="tabular">
          <strong>First payment</strong> {fmtDate(plan.startDate)}
          {lastDate ? <> {MIDDOT} <strong>Last</strong> {fmtDate(lastDate)}</> : null}
        </span>
      </div>
    </div>
  );
}
