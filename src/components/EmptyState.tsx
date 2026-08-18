/**
 * EmptyState — shared first-run empty state for list screens.
 *
 * Visual target: docs/ux-designs/.../DESIGN.md.Iconography
 *   - 1.5px stroke, no fill, muted color
 *   - brand-restraint: no emoji in the illustration, single SVG mark
 *   - illustration 96×96, centered
 *   - title 15px semibold ink, description 13px muted
 *   - primary CTA + optional learn-more link
 *
 * Use the `useHelpOverlay()` hook for the learn-more link — the overlay
 * holds the long-form copy so the empty state stays short.
 */
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useHelpOverlay } from './HelpOverlay';
import type { HelpTopic } from './HelpOverlay';

interface EmptyStateProps {
  illustration?: ReactNode;
  title: string;
  description?: string;
  cta?: { to: string; label: string };
  learnMoreTopic?: HelpTopic;
}

export function EmptyState({ illustration, title, description, cta, learnMoreTopic }: EmptyStateProps) {
  const { open, dialog } = useHelpOverlay();
  return (
    <>
      <div className="py-10 text-center text-muted">
        {illustration && (
          <div className="mx-auto mb-3 opacity-60" style={{ width: 96, height: 96 }}>
            {illustration}
          </div>
        )}
        <div className="text-[15px] font-semibold text-ink">{title}</div>
        {description && <p className="mt-2 text-sm">{description}</p>}
        {cta && (
          <Link
            to={cta.to}
            className="inline-block mt-4 px-4 py-2.5 rounded-btn text-[13px] font-bold text-primary-on hover:opacity-95 transition"
            style={{ background: 'var(--primary)' }}
          >
            {cta.label}
          </Link>
        )}
        {learnMoreTopic && (
          <button
            type="button"
            onClick={() => open(learnMoreTopic)}
            className="block mx-auto mt-3 text-[13px] text-primary hover:underline focus-visible:outline-none focus-visible:underline"
          >
            How {learnMoreTopic} work →
          </button>
        )}
      </div>
      {dialog}
    </>
  );
}

/* ---------- illustrations ---------- */

const STROKE = 'currentColor';
const COMMON = {
  width: 96,
  height: 96,
  viewBox: '0 0 96 96',
  fill: 'none',
  stroke: STROKE,
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function AccountsIllustration() {
  return (
    <svg {...COMMON}>
      <rect x="14" y="26" width="68" height="48" rx="4" />
      <path d="M14 38 L82 38" />
      <path d="M22 52 L36 52" />
      <circle cx="70" cy="52" r="6" />
      <path d="M24 22 L24 14 M72 22 L72 14" />
      <path d="M48 14 L48 22" />
    </svg>
  );
}

export function TransactionsIllustration() {
  return (
    <svg {...COMMON}>
      <path d="M16 38 L36 38 L40 30 L52 50 L56 42 L80 42" />
      <path d="M30 56 L66 56" />
      <path d="M30 64 L52 64" />
      <circle cx="20" cy="56" r="2" />
      <circle cx="76" cy="56" r="2" />
    </svg>
  );
}

export function GoalsIllustration() {
  return (
    <svg {...COMMON}>
      <path d="M48 18 L80 38 L80 78 L16 78 L16 38 Z" />
      <path d="M48 18 L48 78" />
      <path d="M48 50 L60 50" />
      <path d="M48 60 L56 60" />
      <circle cx="48" cy="30" r="4" />
    </svg>
  );
}
