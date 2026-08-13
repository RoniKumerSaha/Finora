/**
 * App.tsx — root component.
 *
 * Per AD-18: hash-mode React Router v7 with the 35-screen shell. Theme is
 * driven from settings via a hook into the Zustand store. RoleAlertBanner
 * is mounted globally so any screen can surface an error.
 *
 * Add-transaction flow (v1 mockup): /transactions/new is the picker,
 *   /transactions/new/{expense|income|transfer} are the per-type forms,
 *   /transactions/:id/edit edits.
 */

import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Shell } from './components/Shell';
import { RoleAlertBanner } from './components/RoleAlertBanner';
import { useStore } from './domain/store';
import { HomeScreen } from './screens/HomeScreen';
import { TransactionsListScreen } from './screens/TransactionsListScreen';
import { AddTransactionPickerScreen } from './screens/AddTransactionPickerScreen';
import { AddExpenseScreen } from './screens/AddExpenseScreen';
import { AddIncomeScreen } from './screens/AddIncomeScreen';
import { AddTransferScreen } from './screens/AddTransferScreen';
import { TransactionEditScreen } from './screens/TransactionEditScreen';
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
      <Routes>
        <Route element={<Shell><RoleAlertBanner /><Outlet /></Shell>}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomeScreen />} />

          <Route path="/transactions" element={<TransactionsListScreen />} />
          <Route path="/transactions/new"                  element={<AddTransactionPickerScreen />} />
          <Route path="/transactions/new/expense"          element={<AddExpenseScreen />} />
          <Route path="/transactions/new/income"           element={<AddIncomeScreen />} />
          <Route path="/transactions/new/transfer"         element={<AddTransferScreen />} />
          <Route path="/transactions/:id/edit"             element={<TransactionEditScreen />} />

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
        </Route>
      </Routes>
    </HashRouter>
  );
}
