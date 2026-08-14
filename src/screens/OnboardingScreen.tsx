/**
 * OnboardingScreen — first-run welcome.
 *
 * Visual target: shared design tokens. Sets up the Fraunces display
 * heading and a single primary CTA. On accept, completes onboarding
 * and routes to the Home dashboard.
 */
import { useStore } from '../domain/store';
import { useNavigate } from 'react-router-dom';

export function OnboardingScreen() {
  const navigate = useNavigate();
  const complete = useStore(s => s.completeOnboarding);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 mt-12">
      <div>
        <h1 className="heading h1-display">Welcome to Finora.</h1>
        <p className="text-muted text-[14px] mt-3 leading-relaxed">
          Track your money, save toward goals, manage debts and investments —
          all local, all yours. Three quick steps to get going:
        </p>
      </div>
      <ol className="flex flex-col gap-3 text-[13.5px] leading-relaxed">
        <li><span className="text-primary font-bold tabular">①</span> Create an account (cash, bank, mobile wallet, …)</li>
        <li><span className="text-primary font-bold tabular">②</span> Log a transaction to see balances update</li>
        <li><span className="text-primary font-bold tabular">③</span> Add a goal, debt, or investment</li>
      </ol>
      <button
        type="button"
        onClick={() => { complete(); navigate('/home'); }}
        className="self-start inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-btn font-bold text-[13px] text-primary-on hover:opacity-95 active:translate-y-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        style={{ background: 'var(--primary)' }}
      >
        Get started
        <span aria-hidden>{'\u2192'}</span>
      </button>
    </div>
  );
}