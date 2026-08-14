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
 * 2026-08-14 responsive: below `md` (768px) the sidebar becomes an
 * off-canvas drawer. A mobile topbar with a hamburger button sits
 * above <main>; tapping it slides the drawer in from the left with a
 * blurred backdrop overlay. Tapping a nav item, the backdrop, the
 * drawer's close button, or pressing Escape all dismiss the drawer.
 * Main padding is reduced on mobile (px-5 vs px-10) so content gets
 * more room on a 375px viewport.
 *
 * Layout (desktop ≥ md):
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
 *
 * Layout (mobile < md):
 *   ┌──────────────────────────┐
 *   │ ☰  Finora            [·] │   ← sticky topbar
 *   ├──────────────────────────┤
 *   │                          │
 *   │       <main>             │
 *   │                          │
 *   └──────────────────────────┘
 *   (☰ opens off-canvas drawer w/ backdrop)
 */
import { useEffect, useState } from 'react';
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

  // Mobile drawer state. Closed by default; opened by tapping the
  // hamburger in the mobile topbar. Closes on navigation, on backdrop
  // click, on Escape, or on the explicit close button in the drawer.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-close drawer whenever the route changes (covers nav-item
  // clicks, browser back/forward, etc.).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Lock body scroll while the drawer is open so the page underneath
  // doesn't move when the user touches it on mobile.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Mobile topbar — only visible below md. Sticky so it follows
         scroll. The hamburger sits on the left; the brand wordmark is
         centered; no right-side CTA (the drawer's Add tx is enough). */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center px-4 h-14 gap-3"
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          boxShadow: 'var(--shadow-nav)',
        }}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="w-10 h-10 -ml-2 inline-flex items-center justify-center rounded-md text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span aria-hidden className="text-[22px] leading-none">{'\u2630'}</span>
        </button>
        <div className="flex-1 flex items-center justify-center gap-2.5">
          <img src={logoUrl} alt="Finora" className="w-7 h-7 rounded-[8px]" />
          <div className="text-[17px] font-extrabold tracking-tight leading-none">
            fin<span className="text-primary">ora</span>
          </div>
        </div>
        {/* Spacer balances the hamburger so the brand stays centered. */}
        <div className="w-10 h-10 -mr-2" aria-hidden />
      </header>

      <div className="md:grid md:grid-cols-[248px_1fr]">
        {/* Backdrop — only rendered when the drawer is open. Acts as
           the click target to dismiss. Positioned above the topbar
           (z-40) and below the drawer (z-50). */}
        {drawerOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-40 cursor-default"
            style={{
              background: 'var(--overlay)',
              backdropFilter: 'blur(8px)',
              animation: 'backdrop-fade-in 200ms ease-out both',
            }}
          />
        )}

        <aside
          className={[
            'flex flex-col px-4 py-5 gap-1',
            // Mobile: fixed drawer that slides off-canvas by default
            'fixed top-0 left-0 h-screen w-[280px] z-50',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
            'transition-[translate] duration-200 ease-out',
            // Desktop (≥ md): sticky in the grid column, no transform
            'md:sticky md:top-0 md:h-screen md:w-auto md:translate-x-0',
            'md:transition-none md:z-auto',
          ].join(' ')}
          style={{
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            boxShadow: drawerOpen ? 'var(--shadow-modal)' : 'var(--sidebar-inset)',
          }}
        >
          {/* Mobile-only close button — sits to the right of the brand.
             Hidden on desktop where the sidebar is always visible. */}
          <div className="flex items-center gap-3 px-2 pb-4 mb-2" style={{ borderBottom: '1px solid var(--border-2)' }}>
            <img src={logoUrl} alt="Finora" className="w-9 h-9 rounded-[10px]" />
            <div className="text-[20px] font-extrabold tracking-tight leading-none grow">
              fin<span className="text-primary">ora</span>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span aria-hidden className="text-lg leading-none">{'\u2715'}</span>
            </button>
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

        <main className="px-5 sm:px-8 md:px-10 py-6 md:py-8 max-w-[1280px]">
          {children}
        </main>
      </div>
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
              className="absolute left-0 top-1/2 -translate-y-1/2 h-[22px] w-[4px] rounded-r-full bg-primary"
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