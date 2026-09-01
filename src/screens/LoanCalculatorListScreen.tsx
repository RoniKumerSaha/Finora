/**
 * LoanCalculatorListScreen — list of saved loan projections.
 *
 * 2026-08-30 polish: cards mirror the InvestmentsListScreen design —
 * horizontal split (identity left, amounts right), hero EMI on the
 * right, total interest under it. A "PLANNED" pill flags that these
 * are projections, not real debts. The only differences from the
 * investment card are the danger-tinted accent (loans are about
 * cost), the danger-tinted wash, and the "interest you'll pay" copy.
 *
 * 2026-08-31: restored the warm-gradient wash (was off during the
 * "Accounts-only wash" interlude). The planned-loan page now reads as
 * a sibling of the planned-investment and real-debt cards — all three
 * list surfaces carry the same wash; only the tone differs.
 *
 * 2026-09-01: drafts are now rendered inline in the same card list
 * with a Draft pill, instead of being hidden in a footer section. The
 * user should always see what they've started — drafts are part of
 * "what I have", not a separate hidden pile.
 *
 * Tap through to edit inputs or inspect the full amortization table.
 */
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import { listLoanPlans, summariseLoanPlan } from '../domain/loanPlans';
import { Button } from '../components/Button';
import { fmtBDT } from '../lib/format';
import { cardSurfaceStyle, leftBarClass, loanPlanTone, toneTextClass } from '../lib/cardSurface';
import { Pill } from '../components/Pill';

const MIDDOT = '\u00B7';

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

  // Aggregate totals for the sidebar summary card.
  let totalMonthly = 0;
  let totalPaid = 0;
  let totalPrincipal = 0;
  let totalInterest = 0;
  for (const plan of saved) {
    const s = summariseLoanPlan(plan);
    totalMonthly += s.emi;
    totalPaid += s.totalPaid;
    totalPrincipal += Math.max(0, Number(plan.principal) || 0);
    totalInterest += Math.max(0, s.totalInterest);
  }
  const count = saved.length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading h1-screen">Loan Calculator</h1>
          <div className="text-muted text-[13px] mt-1.5 max-w-prose">
            Project what a loan will cost. Enter principal, rate, and term — the app fills the amortization table for you.
          </div>
        </div>
        <Button variant="primary" onClick={startNew}>+ New projection</Button>
      </header>

      {plans.length === 0 ? (
        <div className="card flex flex-col gap-3 items-start">
          <div className="text-[15px] font-semibold text-ink">No projections yet</div>
          <p className="text-sm text-muted leading-relaxed max-w-prose">
            Try a sample — 100,000 BDT at 9% for 12 months — and see the EMI + total interest computed live.
          </p>
          <Button variant="primary" onClick={startNew}>Start a projection</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            {/* Left column — full-width loan cards stacked. Saved
                plans render first, drafts render after, each draft
                carries the Draft pill on the second row so the user
                can tell saved from in-flight at a glance. */}
            <div className="flex flex-col gap-3">
              {ordered.map(plan => {
                const s = summariseLoanPlan(plan);
                const principal = Math.max(0, Number(plan.principal) || 0);
                const interest = Math.max(0, s.totalInterest);
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => navigate(`/plan/loan/${plan.id}`)}
                    className="card card-link flex items-stretch gap-5 sm:gap-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 overflow-hidden relative text-left"
                    style={cardSurfaceStyle(loanPlanTone())}
                  >
                  {/* Left accent bar — 3px tone-coloured stripe. Loan
                      cards use danger (cost/interest). The PLANNED pill
                      in the left zone tells the user this isn't a real
                      debt. */}
                  <span
                    aria-hidden
                    className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full pointer-events-none ${leftBarClass(loanPlanTone())}`}
                  />

                  {/* Left zone — identity, terms, total cost.
                      Same py-1 padding as the real InvCard so the
                      planned and real cards have matching weight. */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5 py-1">
                    {/* Row 1: emoji + (name + Loan pill + PLANNED
                        pill) on one row. Both pills hug the title
                        text on the left. PLANNED is outlined so
                        it reads as a state stamp sibling of the
                        Loan pill, not a different category. Title
                        is truncated to 1 line so the pills
                        always sit against the title baseline. */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl shrink-0 leading-none" aria-hidden>{'\u{1F4B0}'}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-semibold text-[16px] tracking-tight leading-tight truncate min-w-0">
                          {plan.name || 'Untitled loan'}
                        </div>
                        <Pill tone={loanPlanTone()} variant="solid">Loan</Pill>
                        {/* PLANNED pill — solid muted tone so it reads as
                            a state stamp, not a category badge. Sits
                            right next to the Loan pill. */}
                        <Pill tone="muted" variant="solid" title="This is a projection — no real loan has been taken.">
                          Planned
                        </Pill>
                      </div>
                    </div>

                    {/* Row 2: optional Draft pill — only when the
                        plan has unsaved edits. Sits on its own row
                        so it doesn't crowd the title row's pills.
                        Now actually reachable since drafts render
                        inline in the main list. */}
                    {plan.dirty && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Pill tone="warn" variant="solid">Draft</Pill>
                      </div>
                    )}

                    {/* Row 3: rate · term · start date. APR and
                        termMonths are the critical pair — wrapped
                        in a non-shrinking span so the start date
                        (when present) doesn't push them off. */}
                    <div className="text-[12px] text-muted tabular truncate">
                      <span className="shrink-0">{plan.rate}% APR {MIDDOT} {plan.termMonths}mo</span>
                      {plan.startDate && <span className="opacity-70"> {MIDDOT} starts {plan.startDate}</span>}
                    </div>

                    {/* Row 4: principal + interest cost on stacked
                        rows so tokens like "₹" and "2,00,000" never
                        split across lines. mt-auto pins to bottom. */}
                    <div className="text-[12px] text-muted mt-auto flex flex-col gap-0.5">
                      <div className="tabular shrink-0">
                        Principal <b className="text-ink font-semibold">{fmtBDT(principal)}</b>
                      </div>
                      <div className="tabular shrink-0">
                        Pay <b className="text-danger font-semibold">{fmtBDT(interest)}</b> interest
                      </div>
                    </div>
                  </div>

                  {/* Vertical divider between identity and amounts.
                      self-stretch + my-1 matches the real card. */}
                  <div
                    aria-hidden
                    className="w-px self-stretch my-1 shrink-0"
                    style={{ background: 'var(--divider)' }}
                  />

                  {/* Right zone — amounts, right-aligned. EMI is the
                      hero (the figure the user plans around); Total
                      you pay sits below as the secondary figure.
                      sm:min-w-[200px] matches the real card so the
                      planned and real cards align visually. */}
                  <div className="flex flex-col gap-3 items-end justify-center shrink-0 sm:min-w-[200px]">
                    <div className="flex flex-col items-end leading-none">
                      <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                        Monthly EMI
                      </span>
                      <span className={`font-bold tabular text-[24px] tracking-tight mt-1.5 ${toneTextClass(loanPlanTone())}`}>
                        {fmtBDT(s.emi)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end leading-none">
                      {/* White on the danger wash — the previous text-danger
                          was red-on-red and disappeared into the wash.
                          The label sits at 70% white so it still reads
                          as a subdued label, not a competing hero figure. */}
                      <span className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">
                        Total you pay
                      </span>
                      <span className="font-bold tabular text-[15px] text-white mt-1">
                        {fmtBDT(s.totalPaid)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            </div>

            {/* Right column — Summary sidebar (sticky at lg+). The
                sidebar carries the aggregates the cards don't show on
                their own: a count, the total principal across every
                projection ("if you borrow this much"), and the total
                interest across all. Per-card EMI and total-paid live
                on the card itself; the sidebar aggregates are only
                interesting once you have multiple projections stacked.
                Mirrors InvestmentsListScreen's Summary card so the
                three list screens (real / planned / loan) share one
                shape. */}
            <section className="card h-fit lg:sticky lg:top-4">
              <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-4">
                Summary
              </h2>
              <div className="flex flex-col gap-5">
                <div>
                  <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">
                    Projections
                  </div>
                  <div className="text-[26px] font-bold text-ink mt-2 tabular tracking-tight leading-none">
                    {count}
                  </div>
                  <div className="text-[11px] text-muted mt-1.5 tabular">
                    {count === 1 ? 'saved loan plan' : 'saved loan plans'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">
                    If you borrow this much
                  </div>
                  <div className="text-[26px] font-bold text-primary mt-2 tabular tracking-tight leading-none">
                    {fmtBDT(totalPrincipal)}
                  </div>
                  <div className="text-[11px] text-muted mt-1.5 tabular">
                    Total principal across every projection
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">
                    Total interest across all
                  </div>
                  <div className="text-[26px] font-bold text-danger mt-2 tabular tracking-tight leading-none">
                    {fmtBDT(totalInterest)}
                  </div>
                  <div className="text-[11px] text-muted mt-1.5 tabular">
                    {count === 1
                      ? 'Over the full term of this loan'
                      : 'Sum of interest across every projection'}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted mt-5 leading-relaxed">
                <strong className="text-ink">How it works:</strong>{' '}
                <em>Total monthly EMI</em> and <em>total you pay</em>
                live on each card. This sidebar carries the aggregates
                across every projection — what you'd borrow in total,
                and what that costs in interest. Nothing here moves real
                money.
              </div>
            </section>
          </div>

          {/* Drafts footer. Drafts already show inline above with
              the Draft pill, but a quiet footer lets the user mass-
              clean drafts they don't want anymore in a single tap. */}
          {drafts.length > 0 && (
            <section className="card">
              <h2 className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold m-0 mb-3">
                Unsaved drafts ({drafts.length})
              </h2>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[12.5px] text-muted leading-relaxed m-0">
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
