/**
 * HelpOverlay — small modal that explains a feature when the user
 * taps "How X works" on a first-run empty state.
 *
 * Same modal shell as ConfirmDialog (440px, backdrop blur, modal-pop-in).
 * One selected page at a time; pages are JSX nodes keyed by topic.
 *
 * Use the `useHelpOverlay()` hook to open a page from anywhere:
 *   const { open, dialog } = useHelpOverlay();
 *   <button onClick={() => open('accounts')}>How accounts work</button>
 *   {dialog}
 *
 * Topics are intentionally narrow — one paragraph per page. The user
 * is here because they tapped the empty-state "Learn more" link; they
 * want a 30-second orient, not a manual.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type HelpTopic = 'accounts' | 'transactions' | 'goals';

interface HelpPage {
  title: string;
  body: React.ReactNode;
}

const PAGES: Record<HelpTopic, HelpPage> = {
  accounts: {
    title: 'How accounts work',
    body: (
      <>
        <p>Open accounts before recording transactions. Each account has a starting balance
        and tracks what's there now. The balance updates as you record income, expenses, and
        transfers.</p>
        <p>Use accounts for cash on hand, bank accounts, mobile wallets, and cards. The total
        across all accounts is your net worth.</p>
      </>
    ),
  },
  transactions: {
    title: 'How transactions work',
    body: (
      <>
        <p>Three types — Income (money in), Expense (money out), Transfer (between accounts).
        Income and expense affect the assigned account's balance. Transfers move money between
        two accounts without counting as income or expense.</p>
        <p>Link a transaction to a debt to track repayments, or to an investment to track
        contributions and payouts.</p>
      </>
    ),
  },
  goals: {
    title: 'How goals work',
    body: (
      <>
        <p>Set a target amount and a target date. We show how much to save per month to hit
        the goal on time.</p>
        <p>Add contributions to track how much you've set aside. Contributions are a plan entry
        — your account balance is not changed. Move money between accounts the way you
        normally would; the goal just records how much of the target is parked.</p>
      </>
    ),
  },
};

export function useHelpOverlay() {
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  function open(t: HelpTopic) { setTopic(t); }
  function close() { setTopic(null); }
  const dialog = topic ? <HelpOverlay topic={topic} onClose={close} /> : null;
  return { open, close, dialog };
}

function HelpOverlay({ topic, onClose }: { topic: HelpTopic; onClose: () => void }) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const page = PAGES[topic];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(8px)',
          animation: 'backdrop-fade-in 180ms ease-out both',
        }}
      />
      <div
        className="relative rounded-card w-[480px] max-w-full"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal), var(--card-inset)',
          padding: '28px',
          animation: 'modal-pop-in 180ms ease-out both',
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 id="help-title" className="heading h3-modal m-0">{page.title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 -mt-1 -mr-1 inline-flex items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 text-lg leading-none"
          >
            {'\u00D7'}
          </button>
        </div>
        <div className="text-[13.5px] text-ink leading-relaxed flex flex-col gap-3 [&_p]:m-0">
          {page.body}
        </div>
        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-[18px] py-2.5 rounded-btn font-bold text-sm bg-primary text-primary-on hover:opacity-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
