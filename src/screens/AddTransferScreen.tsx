/**
 * AddTransferScreen — thin wrapper that mounts AddTransactionForm with
 *   type='transfer'. v1 visual target: #add-transfer in the mockup.
 *   The form's transfer branch renders the side-by-side From / To
 *   selects with a ⇄ glyph and live balances.
 */
import { AddTransactionForm } from './AddTransactionForm';

export function AddTransferScreen() {
  return (
    <AddTransactionForm
      type="transfer"
      title="Transfer"
      subtitle="Move money between your accounts"
    />
  );
}
