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
 * 2026-09-02 brand mark: the static logo SVG is replaced with an
 * animated equalizer mark — three colored bars (primary/info/accent)
 * on a var(--bg) tile that dissolves into the Shell surface. Bars
 * scale in a wave (1.2s, each offset 0.4s); the tile itself sways
 * ±25° hue (10s, off by default). The wordmark beside it carries a
 * full hue-rotate gradient sweep. Together they read as a single
 * living brand mark. Reduced-motion users see both animations
 * disabled. Bar wave runs at 2.4s (half-speed of the original 1.2s)
 * so the motion reads as calm breathing rather than a busy equalizer.
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
import {
  NavHome, NavInsights, NavTransactions, NavAccounts,
  NavGoals, NavInvestments, NavDebts, NavPlan, NavSettings,
  Menu, Close,
} from './icons/Icons';
import { Toast } from './Toast';

/**
 * FinoraLogo — animated equalizer mark that pairs with the FINORA
 * wordmark. Three bars (primary / info / accent) sit on a tile whose
 * background matches `var(--bg)`, so the tile itself dissolves into
 * the Shell surface and only the colored bars are visible. Each bar
 * scales on its own delay (1.2s loop, 0.4s offset) so the motion
 * rolls left-to-right like an audio meter. Sizing matches the
 * wordmark cap height per surface (mobile 22×22, desktop 26×26).
 *
 * The optional `sway` flag adds a subtle ±25° hue sway on the tile
 * (off by default — used to be on when the tile was bg-colored; now
 * that the tile matches the surrounding surface, sway is unnecessary
 * and can pull focus). The bar wave itself keeps the mark alive.
 */
function FinoraLogo({
  size,
  sway = false,
}: {
  size: number;
  sway?: boolean;
}) {
  // Bar widths and gaps scale with `size` so the proportions stay
  // identical at 22px and 26px. 18% bar / 12% gap → at 22px that's
  // ~4px bar / ~2.6px gap; at 26px ~4.7px / ~3.1px. Heights are
  // baked into CSS as percentages of the tile so the bars always
  // reach the same relative top edge regardless of size.
  const barWidth = Math.round(size * 0.18);
  const gap = Math.round(size * 0.12);
  return (
    <span
      aria-hidden
      className={['finora-logo inline-flex items-center justify-center shrink-0 rounded-md overflow-hidden', sway ? '' : ''].join(' ')}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        gap: `${gap}px`,
        background: 'var(--surface)',
        animation: sway ? 'finora-bg-sway 10s linear infinite' : undefined,
      }}
    >
      <i
        className="block rounded-sm"
        style={{
          width: `${barWidth}px`,
          height: '45%',
          background: 'var(--primary)',
          transformOrigin: 'bottom center',
          animation: 'finora-bar-wave 2.4s ease-in-out infinite',
        }}
      />
      <i
        className="block rounded-sm"
        style={{
          width: `${barWidth}px`,
          height: '75%',
          background: 'var(--info)',
          transformOrigin: 'bottom center',
          animation: 'finora-bar-wave 2.4s ease-in-out -0.8s infinite',
        }}
      />
      <i
        className="block rounded-sm"
        style={{
          width: `${barWidth}px`,
          height: '35%',
          background: 'var(--accent)',
          transformOrigin: 'bottom center',
          animation: 'finora-bar-wave 2.4s ease-in-out -1.6s infinite',
        }}
      />
    </span>
  );
}

interface NavDef { to: string; label: string; Icon: (props: any) => JSX.Element }

const NAV: NavDef[] = [
  { to: '/home',         label: 'Home',         Icon: NavHome },
  { to: '/plan',         label: 'Plan',         Icon: NavPlan },
  { to: '/insights',     label: 'Insights',     Icon: NavInsights },
  { to: '/transactions', label: 'Transactions', Icon: NavTransactions },
  { to: '/accounts',     label: 'Accounts',     Icon: NavAccounts },
  { to: '/goals',        label: 'Goals',        Icon: NavGoals },
  { to: '/investments',  label: 'Investments',  Icon: NavInvestments },
  { to: '/debts',        label: 'Debts',        Icon: NavDebts },
  { to: '/settings',     label: 'Settings',     Icon: NavSettings },
];

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Hide the "Add Transaction" shortcut only on the add-transaction
  // screens themselves (`/transactions/new` and its per-type variants
  // /transactions/new/expense, /income, /transfer) — there the sidebar
  // CTA would duplicate the screen's own submit button. On every
  // other screen, including entity edits like DebtEditScreen, the
  // button is the fastest path to recording a new transaction.
  const hideAddTx = /\/transactions\/new/.test(location.pathname);

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
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2.5">
          <FinoraLogo size={22} />
          <div
            className="finora-brand text-[17px] font-extrabold tracking-tight leading-none"
            style={{
              background: 'linear-gradient(90deg, var(--info), var(--primary))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              animation: 'finora-hue 8s linear infinite',
            }}
          >
            Finora
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
            <FinoraLogo size={26} />
            <div
              className="finora-brand text-[20px] font-extrabold tracking-tight leading-none grow"
              style={{
                background: 'linear-gradient(90deg, var(--info), var(--primary))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                animation: 'finora-hue 8s linear infinite',
              }}
            >
              Finora
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Close className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.map(n => <NavItem key={n.to} {...n} />)}
          </nav>

          <div className="flex-1" />

          {/* Theme toggle removed — dark is the only mode (see Settings
             > Theme for the explanatory copy). The slot used to host a
             Dark / Light segmented control. */}

          {!hideAddTx && (
            <NavLink
              to="/transactions/new"
              className="inline-flex items-center justify-center gap-2 text-primary-on px-4 py-2.5 rounded-btn font-bold text-[13px] hover:opacity-95 active:translate-y-px transition"
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
      {/* Toast mounts at the root of the Shell so it sits above route
         transitions, the drawer backdrop, and the banner — the z-50
         stack is one continuous layer in the layout. */}
      <Toast />
    </div>
  );
}



function NavItem({ to, label, Icon }: NavDef) {
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
          <Icon className="w-[18px] h-[18px] shrink-0" />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}