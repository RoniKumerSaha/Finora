/**
 * Pill — small uppercase badge for status / category labels.
 *
 * Fully rounded (999px). Four style families:
 *   - solid   — high-emphasis status (Payment, Overdue)
 *   - soft    — tone-tinted category (Payment, Received)
 *   - outline — meta / state (Planned, Draft)
 *   - stamp   — a MINIATURE rubber stamp: the document family's own
 *               label, brought down to chip size.
 *
 * The stamp variant exists because the app speaks in two badge
 * languages and they had drifted apart. The big documents (the
 * certificates, the receipts, the planner sheets) mark themselves
 * with a STAMP — a bordered, uppercase label with square corners and
 * wide tracking, tilted a few degrees. The small chips elsewhere were
 * soft filled blobs with fully-round corners.
 *
 * Put the two side by side — a "LOAN" blob beside an "I OWE" stamp —
 * and they read as two unrelated design systems. The stamp variant
 * closes that gap: same border, same corner radius, same tracking,
 * same tone-coloured rule and tone-coloured ink.
 *
 * Two differences from the full-size stamp, both deliberate:
 *   - NOT rotated. The tilt is the big sheets' signature; a chip
 *     sitting inline beside a title has to read straight, and a
 *     tilted 10px label is just a tilted smudge.
 *   - 1px border, not 2px. The rule scales with the label.
 */
export type PillVariant = 'solid' | 'soft' | 'outline' | 'stamp';
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

/* The STAMP — transparent fill, a hairline rule in the chip's own
   tone, and the ink in that tone too. It mirrors `.debt-cert__stamp`
   in shape, corner radius and tracking, but keeps a 1px rule: the
   chip is a tenth the size of the sheet's stamp, so a 2px border
   would read as a heavy slab rather than an engraved label. */
const STAMP: Record<PillTone, string> = {
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
    variant === 'stamp' ? STAMP[tone] :
    SOFT[tone];

  // The stamp's own proportions: square corners (4px, the same radius
  // the big stamp uses), the wide tracking of an engraved label, and a
  // hairline rule. The round pills keep their pill geometry.
  const shape = variant === 'stamp'
    ? 'rounded-[4px] tracking-label'
    : 'rounded-pill tracking-wider';

  return (
    <span
      className={`inline-flex items-center px-2 py-[3px] ${shape} t-10 font-bold uppercase shrink-0 ${toneClass} ${className}`}
      title={title}
    >
      {children}
    </span>
  );
}
