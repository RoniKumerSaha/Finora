/**
 * AddTransactionPickerScreen — pick the transaction type.
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html#add-picker
 * Three large cards (Income / Expense / Transfer) in a 3-col grid.
 * Click routes to the per-type add screen.
 *
 * 2026-08-14 polish: Fraunces heading, refined section spacing.
 */
import { useNavigate } from 'react-router-dom';
import { TypePicker } from '../components/TypePicker';

export function AddTransactionPickerScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="heading h1-screen">What happened?</h1>
        <div className="text-muted text-[13px] mt-1.5">Pick one to continue.</div>
      </header>

      <TypePicker
        onPick={t => navigate(`/transactions/new/${t}`)}
      />
    </div>
  );
}