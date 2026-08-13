/**
 * AddTransactionPickerScreen — pick the transaction type.
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html#add-picker
 * Three large cards (Income / Expense / Transfer) in a 3-col grid.
 * Click routes to the per-type add screen.
 */
import { useNavigate } from 'react-router-dom';
import { TypePicker } from '../components/TypePicker';

export function AddTransactionPickerScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight leading-none mb-1">What happened?</h1>
        <div className="text-muted text-[13px]">Pick one to continue</div>
      </div>

      <TypePicker
        onPick={t => navigate(`/transactions/new/${t}`)}
      />
    </div>
  );
}
