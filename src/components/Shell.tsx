/**
 * Shell — sidebar + topbar + content area.
 *
 * AD-18: the 35 screens flow into <Outlet />. Sidebar nav lists the
 * main destinations; topbar shows the screen title and any contextual
 * actions (e.g. "Add" button on list screens).
 *
 * TODO AD-18: full visual implementation matching docs/ux-designs/.../v2/.
 * For AD-15 this is a minimal stub so the router compiles.
 */
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-bg text-ink">
      <aside className="bg-surface border-r border-border p-6 flex flex-col gap-1 sticky top-0 h-screen">
        <div className="font-semibold text-lg px-2 pb-4 border-b border-border mb-3">Finora</div>
        <NavLink to="/home"         className={navClass}>Home</NavLink>
        <NavLink to="/transactions" className={navClass}>Transactions</NavLink>
        <NavLink to="/accounts"     className={navClass}>Accounts</NavLink>
        <NavLink to="/goals"        className={navClass}>Goals</NavLink>
        <NavLink to="/debts"        className={navClass}>Debts</NavLink>
        <NavLink to="/investments"  className={navClass}>Investments</NavLink>
        <NavLink to="/settings"     className={navClass + ' mt-auto'}>Settings</NavLink>
      </aside>
      <main className="p-6 overflow-x-auto">{children}</main>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'block px-3 py-2 rounded-md text-sm',
    isActive ? 'bg-primary-soft text-ink font-medium' : 'text-muted hover:bg-surface-2',
  ].join(' ');
}