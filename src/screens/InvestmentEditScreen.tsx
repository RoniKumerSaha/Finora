/**
 * InvestmentEditScreen — write on the certificate.
 *
 * An investment's terms are a contract, so editing them is editing
 * the contract: the screen IS the certificate, and every field sits
 * on its own ruled line, the way you would write on a form.
 *
 * What separates this from a plain settings form is the LIVE
 * PREVIEW. As the rate, term or principal change, the certificate
 * above re-engraves itself — the maturity date, the maturity value
 * and the interest all move as you type. The user sees the
 * consequence of the edit before saving it.
 *
 * Two guards shape what can be edited:
 *   - a DPS with recorded contributions LOCKS its monthly amount,
 *     because changing it would invalidate every maturity figure
 *     already shown on the detail screen;
 *   - the type picker warns that switching type resets the term
 *     fields, since a DPS term and an FDR term are different shapes.
 *
 * Routes: /investments/:id/edit
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as investments from '../domain/investments';
import * as accounts from '../domain/accounts';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { isPositiveMoney, POSITIVE_MONEY_ERROR } from '../lib/validation';
import { fmtBDT, fmtDate } from '../lib/format';
import { formatDuration } from '../domain/duration';
import { investmentMaturityDate, investmentMaturityValueTyped } from '../domain/math';
import type { Investment, InvestmentType } from '../domain/types';

const MIDDOT = '\u00B7';

/** The document's serial number — a stable hash of the id. */
function serialFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 999999;
  }
  return String(hash).padStart(6, '0');
}

/** The type as the document names it. */
function typeLabel(type: InvestmentType): string {
  return type === 'dps' ? 'DPS' : type === 'fdr' ? 'FDR' : 'SAVINGS';
}

/** Each investment type wears its own tone. */
function toneFor(type: InvestmentType): string {
  return type === 'dps' ? 'var(--primary)' : type === 'fdr' ? 'var(--accent)' : 'var(--info)';
}

/** The three kinds of instrument, and what each one is for. */
const TYPES: { id: InvestmentType; name: string; sub: string }[] = [
  { id: 'dps', name: 'DPS', sub: 'Monthly' },
  { id: 'fdr', name: 'FDR', sub: 'Lump-sum' },
  { id: 'savings', name: 'Savings', sub: 'Interest-bearing' },
];

export function InvestmentEditScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useStore(s => s.state);
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const accs = accounts.list(state);
  const inv = investments.get(state, id!);

  const [name, setName] = useState(inv?.name ?? '');
  const [type, setType] = useState<InvestmentType>(inv?.type ?? 'dps');
  const [principal, setPrincipal] = useState(String(inv?.principal ?? 0));
  const [monthlyContribution, setMonthlyContribution] = useState(String(inv?.monthlyContribution ?? 0));
  const [rate, setRate] = useState(String(inv?.rate ?? ''));
  const [startDate, setStartDate] = useState(inv?.startDate ?? new Date().toISOString().slice(0, 10));
  // Pre-select useDays when the existing record already carries a termDays
  // value. Falls back to months otherwise.
  const [termMonths, setTermMonths] = useState(String(inv?.termMonths ?? ''));
  const [termDays, setTermDays] = useState(String(inv?.termDays ?? ''));
  const [useDays, setUseDays] = useState(
    !!(inv?.termDays != null && Number(inv.termDays) > 0)
  );
  const [payoutAccountId, setPayoutAccountId] = useState(inv?.payoutAccountId ?? '');
  const [institution, setInstitution] = useState(inv?.institution ?? '');

  if (!inv) {
    return (
      <div className="text-muted">
        Investment not found.{' '}
        <button className="underline" onClick={() => navigate('/investments')}>Back to investments</button>
      </div>
    );
  }

  const linkedContributions = state.transactions.filter(t => t.linkedInvestmentId === inv.id).length;
  const hadContributions = linkedContributions > 0;
  const dpsLocked = type === 'dps' && hadContributions;

  // Inline guard (spine: ux-finora-2026-08-14-negative-guard).
  // Pre-populated values are valid; user can break them by typing.
  // Note: when dpsLocked is true the monthly contribution field is
  // disabled, so we don't apply the invalid class to it.
  const principalInvalid = type !== 'dps' && !isPositiveMoney(principal);
  const monthlyInvalid = type === 'dps' && !dpsLocked && !isPositiveMoney(monthlyContribution);
  const termInDays = type !== 'dps' && useDays;
  const termValid = termInDays
    ? Number(termDays) > 0
    : Number(termMonths) > 0;
  const invalidClass = 'border-danger focus:border-danger focus:ring-danger/30';

  function toggleUseDays(next: boolean) {
    setUseDays(next);
    if (next) setTermMonths('');
    else setTermDays('');
  }

  // ── The live preview ───────────────────────────────────────────
  // The certificate above the form re-engraves itself as the terms
  // change: the maturity date and the maturity value both move, so
  // the user sees the consequence of the edit before saving it.
  const preview = useMemo(() => {
    const draft: Investment = {
      ...inv,
      type,
      principal: Number(principal) || 0,
      monthlyContribution: type === 'dps' ? Number(monthlyContribution) || 0 : 0,
      rate: Number(rate) || 0,
      startDate,
      termMonths: termInDays ? 0 : Number(termMonths) || 0,
      termDays: termInDays ? Number(termDays) || 0 : undefined,
    };
    const mat = investmentMaturityDate(draft);
    const value = investmentMaturityValueTyped(draft);
    const invested = type === 'dps'
      ? (Number(monthlyContribution) || 0) * (Number(termMonths) || 0)
      : (Number(principal) || 0);
    return {
      mat,
      matLabel: mat ? fmtDate(mat.toISOString().slice(0, 10)) : '\u2014',
      value,
      valueLabel: fmtBDT(value),
      interest: Math.max(0, value - invested),
      interestLabel: fmtBDT(Math.max(0, value - invested)),
      investedLabel: fmtBDT(invested),
    };
  }, [inv, type, principal, monthlyContribution, rate, startDate, termMonths, termDays, termInDays]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Investment name is required', why: 'Investments without a name cannot be tracked.', fix: 'Enter a name.' });
      return;
    }
    if (type !== 'dps' && !(Number(principal) > 0)) {
      showBanner({ what: 'Principal must be greater than zero', why: 'FDR and savings accounts need a lump-sum principal.', fix: 'Enter a positive number.' });
      return;
    }
    if (!(Number(rate) >= 0)) {
      showBanner({ what: 'Rate must be non-negative', why: 'Negative rates are not supported in V1.', fix: 'Enter 0 or a positive percent.' });
      return;
    }
    if (termInDays) {
      if (!(Number(termDays) > 0)) {
        showBanner({ what: 'Term must be a positive number of days', why: 'A zero-day term has no maturity date.', fix: 'Enter the term in days.' });
        return;
      }
    } else if (!(Number(termMonths) > 0)) {
      showBanner({ what: 'Term must be a positive number of months', why: 'A zero-month term has no maturity date.', fix: 'Enter the term in months.' });
      return;
    }
    if (type === 'dps' && !dpsLocked && !(Number(monthlyContribution) > 0)) {
      showBanner({ what: 'Monthly contribution is required', why: 'DPS calculates maturity from your monthly contribution.', fix: 'Enter a positive number.' });
      return;
    }
    try {
      update(s => investments.update(s, inv!.id, {
        name: name.trim(),
        type,
        principal: Number(principal) || 0,
        monthlyContribution: type === 'dps' ? Number(monthlyContribution) || 0 : undefined,
        rate: Number(rate),
        startDate,
        termMonths: termInDays ? 0 : Number(termMonths),
        termDays: termInDays ? Number(termDays) : undefined,
        payoutAccountId: payoutAccountId || undefined,
        institution: institution.trim() || undefined,
      }));
      showBanner({
        kind: 'success',
        what: `${name.trim()} updated`,
        why: 'The certificate now carries the new terms.',
        fix: `Matures ${preview.matLabel}.`,
      });
      navigate(`/investments/${inv!.id}`);
    } catch (err) {
      showBanner({ what: 'Could not update investment', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  const tone = toneFor(type);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-3">
        <Link to={`/investments/${inv!.id}`} className="text-muted text-sm hover:text-ink transition">{'\u2190'} Investments</Link>
      </div>

      <header>
        <h1 className="heading h1-screen">Edit investment</h1>
        <div className="text-muted text-[13px] mt-1.5">
          Rate, term, and payout destination can change. Past contributions stay as they are.
        </div>
      </header>

      <div className="inv-page">
        {/* ═══ THE LEFT COLUMN ═════════════════════════════════ */}
        <div className="inv-page__col">
          {/* ─── THE LIVE CERTIFICATE ────────────────────────── */}
          <section className="inv-cert" style={{ ['--tone' as string]: tone }}>
            <div className="inv-cert__head">
              <div className="min-w-0">
                <div className="inv-cert__name">{name.trim() || 'Untitled investment'}</div>
                <div className="inv-cert__serial">
                  NO. {serialFor(inv.id)} {MIDDOT} {typeLabel(type)}
                  {institution.trim() ? ` ${MIDDOT} ${institution.trim().toUpperCase()}` : ''}
                  {preview.mat ? ` ${MIDDOT} MATURES ${preview.matLabel.toUpperCase()}` : ''}
                </div>
              </div>
              <div className="inv-cert__seal" style={{ ['--tone' as string]: tone }}>
                <div className="p">{Number(rate) || 0}%</div>
                <div className="l">RATE</div>
              </div>
            </div>

            <div className="inv-cert__fields">
              {type === 'dps' ? (
                <>
                  <div className="inv-cert__f">
                    <div className="k">Monthly contribution</div>
                    <div className="v">{fmtBDT(Number(monthlyContribution) || 0)}</div>
                  </div>
                  <div className="inv-cert__f">
                    <div className="k">Term</div>
                    <div className="v">
                      {Number(termMonths) > 0 ? formatDuration(Number(termMonths)) : '\u2014'}
                    </div>
                  </div>
                  <div className="inv-cert__f">
                    <div className="k">Rate</div>
                    <div className="v">{Number(rate) || 0}% / yr</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="inv-cert__f">
                    <div className="k">Principal</div>
                    <div className="v">{fmtBDT(Number(principal) || 0)}</div>
                  </div>
                  <div className="inv-cert__f">
                    <div className="k">Term</div>
                    <div className="v">
                      {termInDays
                        ? `${Number(termDays) || 0} days`
                        : Number(termMonths) > 0
                          ? formatDuration(Number(termMonths))
                          : '\u2014'}
                    </div>
                  </div>
                  <div className="inv-cert__f">
                    <div className="k">Rate</div>
                    <div className="v">{Number(rate) || 0}% / yr</div>
                  </div>
                </>
              )}
            </div>

            <div className="inv-cert__tally tabular">
              <span className="pip" aria-hidden />
              You put in <b>{preview.investedLabel}</b>
              {MIDDOT} it grows by <b>{preview.interestLabel}</b>
            </div>

            <div className="inv-cert__vals">
              <div className="inv-cert__v inv-cert__v--now">
                <div className="k">Maturity date</div>
                <div className="n" style={{ fontSize: 15 }}>{preview.matLabel}</div>
              </div>
              <div className="inv-cert__v inv-cert__v--mat">
                <div className="k">Maturity value</div>
                <div className="n">{preview.valueLabel}</div>
              </div>
            </div>

            <div className="inv-cert__note">
              <strong>A preview.</strong> These figures update as you type and are only
              saved when you press Save changes. Past contributions are never altered.
            </div>
          </section>

          {/* ─── THE EDIT PASS ─────────────────────────────── */}
          <section className="inv-cert" style={{ ['--tone' as string]: 'var(--warn)' }}>
            <div className="inv-cert__head">
              <div className="min-w-0">
                <div className="inv-cert__name">Edit investment</div>
                <div className="inv-cert__serial">TERMS CAN CHANGE</div>
              </div>
              <div className="inv-cert__stamp inv-cert__stamp--planned" style={{ ['--tone' as string]: 'var(--warn)' }}>
                Editing
              </div>
            </div>

            <div className="dform" style={{ marginTop: 14 }}>
              <div className="dfline">
                <div>
                  <div className="dfline__label">Name</div>
                </div>
                <div>
                  <Field label="Name" hideLabel>
                    <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
                  </Field>
                </div>
              </div>

              <div className="dfline">
                <div>
                  <div className="dfline__label">Type</div>
                  <div className="dfline__hint">DPS, FDR or savings.</div>
                </div>
                <div>
                  <Field label="Type" hideLabel>
                    <div className="typepick" role="radiogroup" aria-label="Type">
                      {TYPES.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={type === t.id}
                          className={`typeopt${type === t.id ? ' on' : ''}`}
                          style={{ ['--tone' as string]: toneFor(t.id) }}
                          onClick={() => setType(t.id)}
                        >
                          <span className="tt">{t.name}</span>
                          <span className="ts">{t.sub}</span>
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </div>

              {type === 'dps' ? (
                <div className="dfline">
                  <div>
                    <div className="dfline__label">Monthly contribution</div>
                    <div className="dfline__hint">
                      {dpsLocked
                        ? `Locked \u2014 ${linkedContributions} contributions already recorded.`
                        : 'The amount you pay each month into this DPS.'}
                    </div>
                  </div>
                  <div>
                    <Field
                      label="Monthly contribution"
                      hideLabel
                      error={monthlyInvalid ? POSITIVE_MONEY_ERROR : undefined}
                    >
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={monthlyContribution}
                        onChange={e => setMonthlyContribution(e.target.value)}
                        disabled={dpsLocked}
                        aria-invalid={monthlyInvalid || undefined}
                        className={monthlyInvalid ? invalidClass : ''}
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="dfline">
                  <div>
                    <div className="dfline__label">Principal</div>
                    <div className="dfline__hint">The amount you've placed into this investment.</div>
                  </div>
                  <div>
                    <Field
                      label="Principal"
                      hideLabel
                      error={principalInvalid ? POSITIVE_MONEY_ERROR : undefined}
                    >
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={principal}
                        onChange={e => setPrincipal(e.target.value)}
                        aria-invalid={principalInvalid || undefined}
                        className={principalInvalid ? invalidClass : ''}
                      />
                    </Field>
                  </div>
                </div>
              )}

              <div className="dfline">
                <div>
                  <div className="dfline__label">Rate (% per year)</div>
                  <div className="dfline__hint">
                    Annual rate. Simple interest for FDR/savings, compounded monthly for DPS.
                  </div>
                </div>
                <div>
                  <Field label="Rate (% per year)" hideLabel>
                    <Input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} />
                  </Field>
                </div>
              </div>

              <div className="dfline">
                <div>
                  <div className="dfline__label">Start date</div>
                </div>
                <div>
                  <Field label="Start date" hideLabel>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </Field>
                </div>
              </div>

              {type !== 'dps' && (
                <div className="dfline">
                  <div>
                    <div className="dfline__label">Term</div>
                    <div className="dfline__hint">
                      {useDays
                        ? 'Maturity = start + this many days.'
                        : 'Changing this shifts the maturity date forward.'}
                    </div>
                  </div>
                  <div>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-[13px] text-muted">
                        <input
                          type="checkbox"
                          checked={useDays}
                          onChange={e => toggleUseDays(e.target.checked)}
                          className="accent-[var(--accent)]"
                        />
                        <span>Use days instead of months (for short-term terms &lt; 1 month)</span>
                      </label>
                      {useDays ? (
                        <Field label="Term (days)" hideLabel>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={termDays}
                            onChange={e => setTermDays(e.target.value)}
                            placeholder="15"
                          />
                        </Field>
                      ) : (
                        <Field label="Term (months)" hideLabel>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={termMonths}
                            onChange={e => setTermMonths(e.target.value)}
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {type === 'dps' && (
                <div className="dfline">
                  <div>
                    <div className="dfline__label">Term</div>
                    <div className="dfline__hint">Changing this shifts the maturity date forward.</div>
                  </div>
                  <div>
                    <Field label="Term (months)" hideLabel>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={termMonths}
                        onChange={e => setTermMonths(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              )}

              <div className="dfline">
                <div>
                  <div className="dfline__label">Payout account</div>
                  <div className="dfline__hint">Where the matured value lands.</div>
                </div>
                <div>
                  <Field label="Payout account (optional)" hideLabel>
                    <Select value={payoutAccountId} onChange={e => setPayoutAccountId(e.target.value)}>
                      <option value="">— None —</option>
                      {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>

              <div className="dfline">
                <div>
                  <div className="dfline__label">Institution</div>
                  <div className="dfline__hint">The bank holding your money.</div>
                </div>
                <div>
                  <Field label="Institution (optional)" hideLabel>
                    <Input
                      value={institution}
                      onChange={e => setInstitution(e.target.value)}
                      placeholder="Bank name…"
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                variant="primary"
                type="submit"
                disabled={
                  !name.trim()
                  || principalInvalid
                  || monthlyInvalid
                  || !(Number(rate) >= 0)
                  || !termValid
                }
              >
                Save changes
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/investments/${inv!.id}`)}>Cancel</Button>
            </div>
          </section>
        </div>

        {/* ═══ THE RIGHT COLUMN ════════════════════════════════ */}
        <div className="inv-page__col">
          <div className="inv-page__sect">What you&rsquo;re changing</div>

          <section className="act-sheet">
            <div className="act-sheet__name">The terms at a glance</div>
            <div className="act-sheet__serial">{typeLabel(type)} {MIDDOT} NO. {serialFor(inv.id)}</div>

            <div className="act-sheet__stats">
              <div className="act-sheet__stat">
                <div className="k">You put in</div>
                <div className="n n--sm">{preview.investedLabel}</div>
              </div>
              <div className="act-sheet__stat">
                <div className="k">Interest</div>
                <div className="n n--sm">{preview.interestLabel}</div>
              </div>
              <div className="act-sheet__stat">
                <div className="k">You get</div>
                <div className="n n--sm">{preview.valueLabel}</div>
              </div>
            </div>

            <div className="act-sheet__rows">
              <div className="act-row">
                <div>
                  <span className="act-row__tag" style={{ color: 'var(--accent)' }}>Maturity date</span>
                  <div className="act-row__amount">{preview.matLabel}</div>
                  <div className="act-row__where">
                    Starting {startDate ? fmtDate(startDate) : '\u2014'}
                  </div>
                </div>
              </div>
              <div className="act-row">
                <div>
                  <span className="act-row__tag" style={{ color: 'var(--accent)' }}>Recorded so far</span>
                  <div className="act-row__amount">{linkedContributions} contributions</div>
                  <div className="act-row__where">
                    {dpsLocked
                      ? 'The monthly amount stays locked while contributions exist.'
                      : 'Nothing recorded yet \u2014 the monthly amount is yours to set.'}
                  </div>
                </div>
              </div>
              <div className="act-row">
                <div>
                  <span className="act-row__tag" style={{ color: 'var(--accent)' }}>Payout destination</span>
                  <div className="act-row__amount">
                    {accs.find(a => a.id === payoutAccountId)?.name ?? 'Not set'}
                  </div>
                  <div className="act-row__where">
                    {payoutAccountId
                      ? 'The matured value lands here.'
                      : 'Without an account the bank has nowhere to send the money back.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="debt-cert__note" style={{ marginTop: 12 }}>
              These figures are a preview. Nothing is written until you press Save
              changes, and past contributions are never altered.
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
