/**
 * Shell — sidebar + content area.
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html — the v1
 * "pillowy" roundness pass. Sidebar nav uses 10px radius items with
 * 6px gap; brand row carries the real Finora logo SVG.
 *
 * 2026-08-14 polish: tighter nav spacing, an active-state accent bar
 * on the left edge, a brand-row divider that doesn't run the full
 * width, and a refined primary CTA pinned to the bottom.
 *
 * Layout:
 *   ┌──────────────┐
 *   │ [logo] Finora│   ← brand row
 *   ├──────────────┤
 *   │  ⌂ Home      │
 *   │  ⇄ Transactions
 *   │  ◎ Accounts  │
 *   │  ★ Goals     │
 *   │  🏦 Investments
 *   │  ◐ Debts     │
 *   │  ⚙ Settings  │
 *   │  (spacer)    │
 *   │  [+ Add tx]  │   ← primary CTA pinned to bottom
 *   └──────────────┘
 */
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import logoUrl from '../assets/finora-logo.svg';

interface NavDef { to: string; label: string; icon: string }

const NAV: NavDef[] = [
  { to: '/home',         label: 'Home',         icon: '\u2302' }, // ⌂
  { to: '/insights',     label: 'Insights',     icon: '\u25C7' }, // ◇
  { to: '/transactions', label: 'Transactions', icon: '\u21C4' }, // ⇄
  { to: '/accounts',     label: 'Accounts',     icon: '\u25CE' }, // ◎
  { to: '/goals',        label: 'Goals',        icon: '\u2605' }, // ★
  { to: '/investments',  label: 'Investments',  icon: '\u{1F3E6}' }, // 🏦
  { to: '/debts',        label: 'Debts',        icon: '\u25D0' }, // ◐
  { to: '/settings',     label: 'Settings',     icon: '\u2699' }, // ⚙
];

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Hide the "Add Transaction" shortcut on add/edit/form screens where
  // it'd duplicate a screen's own submit button.
  const onForm =
    /\/add$/.test(location.pathname) ||
    /\/transactions\/new/.test(location.pathname) ||
    /\/transactions\/[^/]+\/edit$/.test(location.pathname) ||
    /\/[^/]+\/[^/]+\/edit$/.test(location.pathname);

  return (
    <div className="grid grid-cols-[248px_1fr] min-h-screen bg-bg text-ink">
      <aside
        className="sticky top-0 h-screen flex flex-col px-4 py-5 gap-1"
        style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          boxShadow: 'var(--sidebar-inset)',
        }}
      >
        <div className="flex items-center gap-3 px-2 pb-4 mb-2" style={{ borderBottom: '1px solid var(--border-2)' }}>
          <img src={logoUrl} alt="Finora" className="w-9 h-9 rounded-[10px]" />
          <div className="text-[20px] font-extrabold tracking-tight leading-none">
            fin<span className="text-primary">ora</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        <div className="flex-1" />

        {!onForm && (
          <NavLink
            to="/transactions/new"
            className="mt-3 inline-flex items-center justify-center gap-2 text-primary-on px-4 py-2.5 rounded-btn font-bold text-[13px] hover:opacity-95 active:translate-y-px transition"
            style={{ background: 'var(--primary)' }}
          >
            <span className="text-base leading-none">+</span>
            <span>Add transaction</span>
          </NavLink>
        )}
      </aside>

      <main className="px-10 py-8 overflow-x-auto max-w-[1280px]">
        {children}
      </main>
    </div>
  );
}

function NavItem({ to, label, icon }: NavDef) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 px-3 py-2 rounded-btn text-[13.5px] font-medium transition-colors',
          isActive
            ? 'bg-primary-soft text-primary'
            : 'text-muted hover:bg-surface-2 hover:text-ink',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary"
            />
          )}
          <span className="w-[18px] inline-flex items-center justify-center text-[15px] leading-none" aria-hidden>
            {icon}
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}