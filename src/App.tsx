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

import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Shell } from './components/Shell';
import { RoleAlertBanner } from './components/RoleAlertBanner';
import { ResetPasswordDialog } from './components/ResetPasswordDialog';
import { subscribe } from './components/crossTabRecovery';
import { syncEngine } from './domain/sync';
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
  // Dark mode is the only supported theme (set once at boot — the
  // Theme type is now `'dark'` only, so there's no runtime selection).
  // The cross-fade machinery that used to handle light↔dark transitions
  // is no longer needed.
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
  }, []);

  const recompute = useStore(s => s.recompute);

  // Recompute derived fields on boot (status flips, paidSoFar cache).
  useEffect(() => { recompute(); }, [recompute]);

  // Recovery: open the ResetPasswordDialog when supabase-js fires
  // PASSWORD_RECOVERY (the user just clicked the link in their
  // recovery email). The dialog manages its own field state; we
  // only own the open/close lifecycle.
  //
  // Cross-tab coordination (see crossTabRecovery.ts + ResetPasswordDialog):
  // supabase-js writes the recovery session to localStorage, which is
  // shared across tabs. The OTHER tab (still signed in with the old
  // session) picks up the storage change and also fires PASSWORD_RECOVERY
  // — that's why the dialog itself dedupes via `isOwnRecoveryUrl()` and
  // the `recovery-opened` BroadcastChannel message.
  //
  // **Cold-boot replay.** `syncEngine.init()` is awaited in `main.tsx`
  // BEFORE React mounts. The PASSWORD_RECOVERY event fires inside
  // `init()` (during `getSession()` → `initialize()`), before any
  // listener can be registered. The engine buffers the event as
  // `pendingRecovery` and replays it to any subscriber that
  // registers later — that's how this `useEffect` (which runs AFTER
  // init has completed) still gets called.
  //
  // **Acknowledge-on-handle.** We acknowledge immediately because the
  // dialog's own dedupe (`isOwnRecoveryUrl()` + `recovery-opened`
  // broadcast) decides whether to actually open — the engine just
  // forwards the signal. Acknowledging here keeps StrictMode
  // double-mounts and route changes from re-triggering.
  //
  // On the successful-update side: when the fragment-receiving tab
  // finishes `updatePassword`, it broadcasts `recovery-complete` and
  // closes its own dialog. THIS tab (any sibling that was open) reloads
  // to pick up the new session — both our in-memory Zustand store and
  // the SyncEngine's cached status were tied to the old auth.
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => {
    const offRecovery = syncEngine.onPasswordRecovery(() => {
      syncEngine.acknowledgePendingRecovery();
      setResetOpen(true);
    });
    const offMsg = subscribe(msg => {
      if (msg.type === 'recovery-complete') {
        // Safe to reload immediately — by the time the opening tab
        // broadcasts, it has already persisted the new session to
        // localStorage. Reloading this tab hydrates the store from
        // IDB (which the opening tab has flushed via its own sync
        // cycle) and re-reads the auth session.
        window.location.reload();
      }
    });
    return () => { offRecovery(); offMsg(); };
  }, []);

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
      {/* Auto-opened when the user lands back from a password-recovery
          email link. Renders into a portal (z-40) so it stacks above
          the current screen regardless of route. */}
      <ResetPasswordDialog open={resetOpen} onClose={() => setResetOpen(false)} />
    </HashRouter>
  );
}
