/**
 * Pill — small uppercase badge for status / category labels.
 *
 * Fully rounded (999px). Three style families:
 *   - solid   — high-emphasis status (Payment, Overdue)
 *   - soft    — tone-tinted category (Payment, Received)
 *   - outline — meta / state (Planned, Draft)
 */
export type PillVariant = 'solid' | 'soft' | 'outline';
export type PillTone = 'primary' | 'accent' | 'info' | 'danger' | 'warn' | 'success' | 'muted' | 'cyan';

const SOLID: Record<PillTone, string> = {
  primary: 'bg-primary text-primary-on',
  accent:  'bg-accent text-accent-on',
  info:    'bg-info text-info-on',
  danger:  'bg-danger text-danger-on',
  warn:    'bg-warn text-warn-on',
  success: 'bg-success text-success-on',
  muted:   'bg-surface-2 text-ink',
  cyan:    'bg-cyan text-cyan-on',
};

const SOFT: Record<PillTone, string> = {
  primary: 'bg-primary-soft text-primary',
  accent:  'bg-accent-soft text-accent',
  info:    'bg-info-soft text-info',
  danger:  'bg-danger-soft text-danger',
  warn:    'bg-warn-soft text-warn',
  success: 'bg-success-soft text-success',
  muted:   'bg-surface-2 text-muted',
  cyan:    'bg-cyan-soft text-cyan',
};

const OUTLINE: Record<PillTone, string> = {
  primary: 'bg-transparent text-primary border border-primary',
  accent:  'bg-transparent text-accent border border-accent',
  info:    'bg-transparent text-info border border-info',
  danger:  'bg-transparent text-danger border border-danger',
  warn:    'bg-transparent text-warn border border-warn',
  success: 'bg-transparent text-success border border-success',
  muted:   'bg-transparent text-muted border border-border',
  cyan:    'bg-transparent text-cyan border border-cyan',
};

export function Pill({
  children,
  tone = 'muted',
  variant = 'soft',
  className = '',
  title,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  variant?: PillVariant;
  className?: string;
  /** Optional native tooltip — spreads onto the rendered <span>. */
  title?: string;
}) {
  const toneClass =
    variant === 'solid' ? SOLID[tone] :
    variant === 'outline' ? OUTLINE[tone] :
    SOFT[tone];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[10.5px] font-bold uppercase tracking-wider shrink-0 ${toneClass} ${className}`}
      title={title}
    >
      {children}
    </span>
  );
}