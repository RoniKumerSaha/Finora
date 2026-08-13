/**
 * Shell — sidebar + content area.
 *
 * AD-18: the 35 screens flow into <Outlet />. The sidebar layout matches
 * docs/ux-designs/.../mockups/v2/dark.html:
 *
 *   ┌──────────────┐
 *   │ ● Finora     │   ← brand row (border-b)
 *   ├──────────────┤
 *   │  Home        │
 *   │  Transactions│
 *   │  Accounts    │   ← nav-items grouped together
 *   │  Goals       │
 *   │  Investments │
 *   │  Debts       │
 *   │  Settings    │
 *   │  (spacer)    │
 *   │  [+ Add]     │   ← primary button pinned to bottom
 *   └──────────────┘
 *
 * Active item uses the primary-soft background + primary text per the
 * mockup. Items keep a fixed 36 px height and 8 px radius so the sidebar
 * never reflows when a screen changes length.
 */
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

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
  // Hide the "Add Transaction" shortcut on the form screens where it'd
  // duplicate the screen's own submit button.
  const onForm = /\/add$|\/[a-z]+\/[a-z0-9-]+\/edit$/.test(location.pathname);

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-bg text-ink">
      <aside className="bg-surface border-r border-border p-4 flex flex-col gap-1 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2 pb-3 mb-2 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-on grid place-items-center text-base font-bold">
            F
          </div>
          <div className="text-base font-bold tracking-tight">
            fin<span className="text-primary">ora</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        <div className="flex-1" />

        {!onForm && (
          <NavLink
            to="/transactions/add"
            className="mt-2 inline-flex items-center justify-center gap-2 bg-primary text-primary-on px-4 py-2.5 rounded-btn font-semibold text-[13.5px] hover:opacity-90"
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
          'flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] transition',
          isActive
            ? 'bg-primary-soft text-primary font-medium'
            : 'text-muted hover:bg-surface-2 hover:text-ink font-medium',
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
