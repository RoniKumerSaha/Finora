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
import { InsightsScreen } from './screens/InsightsScreen';
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
import { GoalDetailScreen } from './screens/GoalDetailScreen';
import { DebtsListScreen } from './screens/DebtsListScreen';
import { DebtAddScreen } from './screens/DebtAddScreen';
import { DebtEditScreen } from './screens/DebtEditScreen';
import { InvestmentsListScreen } from './screens/InvestmentsListScreen';
import { InvestmentAddScreen } from './screens/InvestmentAddScreen';
import { InvestmentDetailScreen } from './screens/InvestmentDetailScreen';
import { InvestmentEditScreen } from './screens/InvestmentEditScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { PlanScreen } from './screens/PlanScreen';
import { MonthPlanScreen } from './screens/MonthPlanScreen';
import { EventPlanScreen } from './screens/EventPlanScreen';
import { EventPlanDetailScreen } from './screens/EventPlanDetailScreen';
import { InvestmentPlannerScreen } from './screens/InvestmentPlannerScreen';
import { InvestmentPlannerNewScreen } from './screens/InvestmentPlannerNewScreen';
import { InvestmentPlannerDetailScreen } from './screens/InvestmentPlannerDetailScreen';
import { LoanCalculatorListScreen } from './screens/LoanCalculatorListScreen';
import { LoanCalculatorDetailScreen } from './screens/LoanCalculatorDetailScreen';

export function App() {
  const theme = useStore(s => s.state.settings.theme);
  const recompute = useStore(s => s.recompute);

  // Reflect theme onto <html data-theme> so CSS custom properties switch.
  // 'auto' listens to prefers-color-scheme. Each flip also cross-fades
  // the UI (250ms) by toggling a `.theme-fade` class on <html>; without
  // it the color swap is an instant snap that's noticeable on big
  // surfaces. The class is removed once the transition completes so it
  // doesn't permanently inflate transition specificity.
  useEffect(() => {
    const root = document.documentElement;
    let cleanup: (() => void) | undefined;

    function applyWithFade(resolved: 'dark' | 'light') {
      // No-op if the theme hasn't actually changed — avoid fading on
      // initial mount where [data-theme] is still at the default.
      if (root.dataset.theme === resolved) return;
      root.dataset.theme = resolved;
      root.classList.add('theme-fade');
      const t = window.setTimeout(() => {
        root.classList.remove('theme-fade');
      }, 260); // 250ms transition + small buffer
      cleanup = () => {
        window.clearTimeout(t);
        root.classList.remove('theme-fade');
      };
    }

    if (theme === 'auto') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      applyWithFade(mql.matches ? 'dark' : 'light');
      const onChange = (e: MediaQueryListEvent) => {
        applyWithFade(e.matches ? 'dark' : 'light');
      };
      mql.addEventListener('change', onChange);
      return () => {
        mql.removeEventListener('change', onChange);
        cleanup?.();
      };
    }
    applyWithFade(theme);
    return cleanup;
  }, [theme]);

  // Recompute derived fields on boot (status flips, paidSoFar cache).
  useEffect(() => { recompute(); }, [recompute]);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell><RoleAlertBanner /><Outlet /></Shell>}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomeScreen />} />

          <Route path="/insights" element={<InsightsScreen />} />

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
          <Route path="/goals/:id" element={<GoalDetailScreen />} />

          <Route path="/debts" element={<DebtsListScreen />} />
          <Route path="/debts/add" element={<DebtAddScreen />} />
          <Route path="/debts/:id/edit" element={<DebtEditScreen />} />

          <Route path="/investments" element={<InvestmentsListScreen />} />
          <Route path="/investments/add" element={<InvestmentAddScreen />} />
          <Route path="/investments/:id" element={<InvestmentDetailScreen />} />
          <Route path="/investments/:id/edit" element={<InvestmentEditScreen />} />

          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />

          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/plan/month" element={<MonthPlanScreen />} />
          <Route path="/plan/event" element={<EventPlanScreen />} />
          <Route path="/plan/event/:id" element={<EventPlanDetailScreen />} />
          <Route path="/plan/invest" element={<InvestmentPlannerScreen />} />
          <Route path="/plan/invest/new" element={<InvestmentPlannerNewScreen />} />
          <Route path="/plan/invest/:id" element={<InvestmentPlannerDetailScreen />} />
          <Route path="/plan/loan" element={<LoanCalculatorListScreen />} />
          <Route path="/plan/loan/:id" element={<LoanCalculatorDetailScreen />} />

          <Route path="*" element={<div className="p-8 text-muted">Not found.</div>} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
