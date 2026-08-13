/**
 * AddExpenseScreen — thin wrapper that mounts AddTransactionForm with
 *   type='expense'. v1 visual target: #add-expense in the mockup.
 */
import { AddTransactionForm } from './AddTransactionForm';

export function AddExpenseScreen() {
  return (
    <AddTransactionForm
      type="expense"
      title="Add expense"
      subtitle="Quick path · 3 fields"
    />
  );
}
