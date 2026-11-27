/**
 * SummaryCell — one column of a 3- or 4-cell summary strip.
 *
 * The four-up summary is shared across the planner screens (Total
 * budget · Spent / planned · Paid so far · Days to go). Pass plain
 * strings or pre-styled sub-nodes; the cell handles alignment per prop.
 */
import type { ReactNode } from 'react';

export function SummaryCell({
  label,
  value,
  centered,
  right,
}: {
  label: string;
  value: ReactNode;
  centered?: boolean;
  right?: boolean;
}) {
  return (
    <div
      className={[
        'px-5 py-1 first:pl-0',
        centered ? 'text-center' : '',
        right ? 'text-right' : '',
      ].join(' ')}
    >
      <div className="label">{label}</div>
      <div className="font-bold t-22 tabular mt-1">{value}</div>
    </div>
  );
}
