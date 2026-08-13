import { Link } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as goals from '../domain/goals';

export function GoalsListScreen() {
  const state = useStore(s => s.state);
  const gs = goals.list(state);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Goals</h1>
        <Link to="/goals/add" className="bg-primary text-primary-on px-4 py-2 rounded-md">Add Goal</Link>
      </header>
      {gs.length === 0 ? (
        <div className="text-muted">No goals yet.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {gs.map(g => {
            const pct = Math.min(100, Math.round(((Number(g.saved) || 0) / (Number(g.target) || 1)) * 100));
            return (
              <li key={g.id} className="bg-surface border border-border rounded-md p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{g.name}</span>
                  <span>{fmtBDT(g.saved || 0)} / {fmtBDT(g.target)}</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-muted mt-2">Target {g.targetDate}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function fmtBDT(n: number) {
  return '৳' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}