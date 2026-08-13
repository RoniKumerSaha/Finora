import { useStore } from '../domain/store';
import { useNavigate } from 'react-router-dom';

export function OnboardingScreen() {
  const navigate = useNavigate();
  const complete = useStore(s => s.completeOnboarding);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 mt-12">
      <h1 className="text-3xl font-semibold">Welcome to Finora</h1>
      <p className="text-muted">
        Track your money, save toward goals, manage debts and investments — all local, all yours.
      </p>
      <ol className="flex flex-col gap-3 text-sm">
        <li>① Create an account (cash, bank, bKash, …)</li>
        <li>② Log a transaction to see balances update</li>
        <li>③ Add a goal, debt, or investment</li>
      </ol>
      <button
        type="button"
        onClick={() => { complete(); navigate('/home'); }}
        className="bg-primary text-primary-on px-6 py-3 rounded-md font-medium self-start"
      >
        Get started
      </button>
    </div>
  );
}