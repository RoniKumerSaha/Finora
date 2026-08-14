/**
 * Shell — sidebar + content area.
 *
 * Visual target: docs/ux-designs/.../mockups/v1/index.html — the v1
 * "pillowy" roundness pass. Sidebar nav uses 14px radius items with
 * 6px gap; brand row carries the real Finora logo SVG.
 *
 * Layout:
 *   ┌──────────────┐
 *   │ [logo] Finora│   ← brand row (border-b)
 *   ├──────────────┤
 *   │  Home        │
 *   │  Transactions│   ← nav-items grouped, 14px radius
 *   │  Accounts    │
 *   │  Goals       │
 *   │  Investments │
 *   │  Debts       │
 *   │  Settings    │
 *   │  (spacer)    │
 *   │  [+ Add]     │   ← primary button pinned to bottom (r-btn)
 *   └──────────────┘
 */
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import logoUrl from '../assets/finora-logo.svg';

interface NavDef { to: string; label: string; icon: string }

const NAV: NavDef[] = [
  { to: '/home',         label: 'Home',         icon: '\u2302' }, // ⌂
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
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-bg text-ink">
      <aside className="bg-surface border-r border-border p-4 flex flex-col gap-[6px] sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2 pb-3 mb-2 border-b border-border">
          <img src={logoUrl} alt="Finora" className="w-9 h-9 rounded-[12px]" />
          <div className="text-[22px] font-extrabold tracking-tight leading-none">
            fin<span className="text-primary">ora</span>
          </div>
        </div>

        <nav className="flex flex-col gap-[6px]">
          {NAV.map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        <div className="flex-1" />

        {!onForm && (
          <NavLink
            to="/transactions/new"
            className="mt-2 inline-flex items-center justify-center gap-2 bg-primary text-primary-on px-[18px] py-3 rounded-btn font-bold text-sm hover:opacity-90"
          >
            <span className="text-base leading-none">+</span>
            <span>Add Transaction</span>
          </NavLink>
        )}
      </aside>

      <main className="px-8 py-6 overflow-x-auto max-w-[1280px]">{children}</main>
    </div>
  );
}

function NavItem({ to, label, icon }: NavDef) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-[14px] py-[10px] rounded-btn text-[13.5px] font-medium transition',
          isActive
            ? 'bg-primary-soft text-primary'
            : 'text-muted hover:bg-surface-2 hover:text-ink',
        ].join(' ')
      }
    >
      <span className="w-[18px] inline-flex items-center justify-center text-[15px]" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}
