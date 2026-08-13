/**
 * App.tsx — root component.
 *
 * Per AD-18: hash-mode React Router v7 with the 35-screen shell. Theme is
 * driven from settings via a hook into the Zustand store. RoleAlertBanner
 * is mounted globally so any screen can surface an error.
 *
 * Routing surface (35 screens per PRD §8):
 *   - #/                        → redirect → #/home
 *   - #/home                    → dashboard
 *   - #/transactions            → list
 *   - #/transactions/add        → add form
 *   - #/transactions/:id/edit   → edit form
 *   - #/accounts                → list
 *   - #/accounts/add
 *   - #/accounts/:id/edit
 *   - #/goals                   → list
 *   - #/goals/add
 *   - #/goals/:id/edit
 *   - #/goals/:id/contribute    → add a contribution to a goal
 *   - #/debts                   → list
 *   - #/debts/add
 *   - #/debts/:id/edit
 *   - #/investments             → list
 *   - #/investments/add
 *   - #/investments/:id/edit
 *   - #/investments/:id/close   → close-out flow (matured investment)
 *   - #/investments/:id/rollover→ roll into a new investment
 *   - #/categories              → manage income/expense categories
 *   - #/settings                → theme, export, import, danger zone
 *   - #/settings/export         → download backup
 *   - #/settings/import         → restore from backup
 *   - #/onboarding              → first-run flow
 *   - 11 more form/error edge-case screens come in AD-19
 *
 * The shell layout (sidebar nav, topbar, content area) is rendered once
 * here and screens flow into <Outlet />.
 */

import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Shell } from './components/Shell';
import { RoleAlertBanner } from './components/RoleAlertBanner';
import { useStore } from './domain/store';
import { HomeScreen } from './screens/HomeScreen';
import { TransactionsListScreen } from './screens/TransactionsListScreen';
import { TransactionAddScreen } from './screens/TransactionAddScreen';
import { AccountsListScreen } from './screens/AccountsListScreen';
import { AccountAddScreen } from './screens/AccountAddScreen';
import { AccountEditScreen } from './screens/AccountEditScreen';
import { GoalsListScreen } from './screens/GoalsListScreen';
import { GoalAddScreen } from './screens/GoalAddScreen';
import { DebtsListScreen } from './screens/DebtsListScreen';
import { DebtAddScreen } from './screens/DebtAddScreen';
import { InvestmentsListScreen } from './screens/InvestmentsListScreen';
import { InvestmentAddScreen } from './screens/InvestmentAddScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';

export function App() {
  const theme = useStore(s => s.state.settings.theme);
  const recompute = useStore(s => s.recompute);

  // Reflect theme onto <html data-theme> so CSS custom properties switch.
  // 'auto' listens to prefers-color-scheme.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      root.dataset.theme = mql.matches ? 'dark' : 'light';
      const onChange = (e: MediaQueryListEvent) => {
        root.dataset.theme = e.matches ? 'dark' : 'light';
      };
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    root.dataset.theme = theme;
  }, [theme]);

  // Recompute derived fields on boot (status flips, paidSoFar cache).
  useEffect(() => { recompute(); }, [recompute]);

  return (
    <HashRouter>
      <Shell>
        <RoleAlertBanner />
        <Outlet />
      </Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomeScreen />} />

        <Route path="/transactions" element={<TransactionsListScreen />} />
        <Route path="/transactions/add" element={<TransactionAddScreen />} />

        <Route path="/accounts" element={<AccountsListScreen />} />
        <Route path="/accounts/add" element={<AccountAddScreen />} />
        <Route path="/accounts/:id/edit" element={<AccountEditScreen />} />

        <Route path="/goals" element={<GoalsListScreen />} />
        <Route path="/goals/add" element={<GoalAddScreen />} />

        <Route path="/debts" element={<DebtsListScreen />} />
        <Route path="/debts/add" element={<DebtAddScreen />} />

        <Route path="/investments" element={<InvestmentsListScreen />} />
        <Route path="/investments/add" element={<InvestmentAddScreen />} />

        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />

        <Route path="*" element={<div className="p-8 text-muted">Not found.</div>} />
      </Routes>
    </HashRouter>
  );
}