/**
 * Chip — labelled value inside a card (e.g. "You put in / ৳ 60,000").
 *
 * Squared, 10px radius. Used for numbers that anchor a card.
 *
 * Tones:
 *   - neutral  — default, surface-2 fill, ink text
 *   - primary  — sage tint, primary text
 *   - accent   — honey tint, accent text
 *   - danger   — warm tint, danger text
 */
export type ChipTone = 'neutral' | 'primary' | 'accent' | 'danger' | 'warn' | 'success';

const TONE_CLASS: Record<ChipTone, string> = {
  neutral: 'bg-surface-2 text-ink',
  primary: 'bg-primary-soft text-primary',
  accent:  'bg-accent-soft text-accent',
  danger:  'bg-danger-soft text-danger',
  warn:    'bg-warn-soft text-warn',
  success: 'bg-success-soft text-success',
};

export function Chip({
  label,
  value,
  tone = 'neutral',
  className = '',
}: {
  label: string;
  value: string;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <div
      className={`flex-1 min-w-[120px] rounded-btn px-3 py-2 border border-border flex flex-col gap-0.5 ${className}`}
    >
      <div className="text-[10px] text-muted uppercase tracking-[0.08em] font-semibold">
        {label}
      </div>
      <div className={`text-[14px] font-bold tabular leading-tight ${TONE_CLASS[tone]}`}>
        {value}
      </div>
    </div>
  );
}