/**
 * AddIncomeScreen — thin wrapper that mounts AddTransactionForm with
 *   type='income'. v1 visual target: #add-income in the mockup.
 */
import { AddTransactionForm } from './AddTransactionForm';

export function AddIncomeScreen() {
  return (
    <AddTransactionForm
      type="income"
      title="Add income"
      subtitle="Money received"
    />
  );
}
