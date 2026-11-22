/**
 * ShellPage — the app chrome: sidebar nav, mobile drawer, CTA.
 *
 * Finora has **no top navbar**. Below `md` (768px) the sidebar becomes
 * an off-canvas drawer behind a hamburger button in a mobile topbar.
 * So this class owns both layouts; there is deliberately no `Navbar`
 * page object.
 *
 * Nav labels are singular/plural exactly as rendered in
 * `src/components/Shell.tsx` — note **`Insight`**, not `Insights`.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export type NavTarget =
  | 'Home'
  | 'Plan'
  | 'Insight'
  | 'Transactions'
  | 'Accounts'
  | 'Goals'
  | 'Investments'
  | 'Debts'
  | 'Settings';

/**
 * On-screen copy the shell owns.
 *
 * The shell's strings are structural constants of the app chrome (the
 * 404 copy, the Home meta-line format, the Settings column titles).
 * They live here, beside the locators that point at them, so a spec
 * file never carries a user-visible literal.
 */
export const SHELL_TEXT = {
  /** The catch-all route's message (`src/App.tsx`, `<Route path="*">`). */
  notFound: 'Not found.',
  /** The Home meta line — `{n}` is the account count. */
  homeMetaFormat: 'Net worth · across {n} accounts · updated just now',
  /** The Settings right-hand column title. */
  about: 'About',
  /** The Settings left-hand column title. */
  dangerZone: 'Danger zone',
  /** The sidebar CTA's label (the "+" is a separate span). */
  addTransaction: 'Add transaction',
  /** The wordmark in the topbar and the sidebar brand row. */
  brand: 'Finora',
  /** The attribute the theme lives on. */
  themeAttribute: 'data-theme',
  /** The only theme the build supports. */
  darkTheme: 'dark',
} as const;

/**
 * The hash route each destination lives at.
 *
 * `/` is NOT a destination — it is a redirect to `/home`
 * (`<Route path="/" element={<Navigate to="/home" replace />} />`),
 * so the nine nav items map to nine routes.
 */
export const SHELL_ROUTES: Record<NavTarget, string> = {
  Home: '/home',
  Plan: '/plan',
  Insight: '/insights',
  Transactions: '/transactions',
  Accounts: '/accounts',
  Goals: '/goals',
  Investments: '/investments',
  Debts: '/debts',
  Settings: '/settings',
};

export class ShellPage extends BasePage {
  /** The 9 destinations, in sidebar order. */
  readonly navLabels: NavTarget[] = [
    'Home',
    'Plan',
    'Insight',
    'Transactions',
    'Accounts',
    'Goals',
    'Investments',
    'Debts',
    'Settings',
  ];

  /**
   * The H1 each destination renders.
   *
   * The nav label and the screen heading are NOT the same word — Home's
   * heading is "Where is my money?" and Insight's is "Insight" while
   * its nav label is also "Insight". Keep this map in one place so a
   * copy change is a one-line fix.
   */
  readonly headingsByNav: Record<NavTarget, RegExp> = {
    Home: /Where is my money\?/,
    Plan: /Plan/,
    Insight: /Insight/,
    Transactions: /Transactions/,
    Accounts: /Accounts/,
    Goals: /Goals/,
    Investments: /Investments/,
    Debts: /Debts/,
    Settings: /Settings/,
  };

  /**
   * The sidebar itself. Stays in the DOM at mobile width.
   *
   * Scoped to the `<aside>` that holds the `<nav>` — the Settings
   * screen's About panel is an `<aside class="card">` too, so a bare
   * `aside` selector is ambiguous there.
   */
  get sidebar(): Locator {
    return this.page.locator('aside').filter({
      has: this.page.locator('nav'),
    });
  }

  /** The mobile topbar — only rendered below `md`. */
  get mobileTopbar(): Locator {
    return this.page.locator('header.md\\:hidden');
  }

  /** The hamburger that opens the drawer. */
  get openMenuButton(): Locator {
    return this.page.getByRole('button', { name: 'Open menu' });
  }

  /**
   * The drawer backdrop — rendered ONLY while the drawer is open
   * (`{drawerOpen && (<button aria-label="Close menu" …>)}` in
   * `src/components/Shell.tsx`).
   *
   * This is the reliable open/closed signal. The ✕ button itself is
   * always in the DOM (it's just transformed off-canvas with the
   * `<aside>`), so Playwright still reports it as visible when the
   * drawer is closed.
   */
  get drawerBackdrop(): Locator {
    return this.page.locator('button[aria-label="Close menu"].fixed');
  }

  /** The drawer's own ✕ button (always present in the DOM). */
  get drawerCloseButton(): Locator {
    return this.page.locator('button[aria-label="Close menu"].w-9');
  }

  /**
   * Whether the drawer is open.
   *
   * Reads the backdrop's presence — the backdrop is conditionally
   * rendered, so this is exact.
   */
  async isDrawerOpen(): Promise<boolean> {
    return (await this.drawerBackdrop.count()) > 0;
  }

  /** The "Add transaction" CTA pinned to the bottom of the sidebar. */
  get addTransactionButton(): Locator {
    return this.page.getByRole('link', { name: SHELL_TEXT.addTransaction });
  }

  /** A nav link by its visible label. */
  navLink(label: NavTarget): Locator {
    return this.page.getByRole('link', { name: label, exact: true });
  }

  /** Click a nav destination and wait for the route to settle. */
  async navigateTo(label: NavTarget): Promise<void> {
    await this.navLink(label).click();
    await this.waitForAppReady();
  }

  /** Open the mobile drawer. No-op assertion — the caller asserts. */
  async openDrawer(): Promise<void> {
    await this.openMenuButton.click();
  }

  /** Close the mobile drawer via its ✕ button. */
  async closeDrawerWithButton(): Promise<void> {
    await this.drawerCloseButton.click();
  }

  /**
   * Close the mobile drawer via the backdrop.
   *
   * The backdrop is `fixed inset-0` at `z-40`, but the drawer
   * `<aside>` sits above it at `z-50` and covers the left 280px. So
   * the backdrop's *centre* is physically covered by the drawer —
   * a real user taps the exposed strip on the right. Click there.
   */
  async closeDrawerWithBackdrop(): Promise<void> {
    const box = await this.drawerBackdrop.boundingBox();
    if (!box) throw new Error('Drawer backdrop has no bounding box');
    await this.page.mouse.click(box.x + box.width - 20, box.y + box.height / 2);
  }

  /** Close the mobile drawer via the Escape key. */
  async closeDrawerWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  /** The hash route the app is currently on, without the leading `#`. */
  async currentRoute(): Promise<string> {
    return this.page.evaluate(() => window.location.hash.replace(/^#/, ''));
  }

  // ─────────────────────────────────────────────────────────────────
  // Headings and shell copy
  // ─────────────────────────────────────────────────────────────────

  /**
   * The screen's own `<h1>`.
   *
   * `BasePage.heading` is `getByRole('heading').first()` — that also
   * matches `<h2>`/`<h3>`, so the shell keeps its own level-1 lookup.
   */
  get screenHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** Every nav link in the sidebar, in render order. */
  get navLinks(): Locator {
    return this.page.locator('aside nav a');
  }

  /**
   * The nav link React Router marks as current.
   *
   * `NavLink` sets `aria-current="page"` on the active link and the
   * Shell adds the accent bar, so the attribute is the exact signal
   * for "this item is highlighted".
   */
  get activeNavLink(): Locator {
    return this.page.locator('aside nav a[aria-current="page"]');
  }

  /** How many nav items are highlighted right now. */
  async highlightedNavCount(): Promise<number> {
    return this.activeNavLink.count();
  }

  /** The catch-all route's message. */
  get notFoundMessage(): Locator {
    return this.page.getByText(SHELL_TEXT.notFound, { exact: true });
  }

  /** The Home meta line under the H1. */
  get homeMetaLine(): Locator {
    return this.page.getByText(
      /^Net worth · across \d+ accounts? · updated just now$/,
    );
  }

  /** The expected Home meta line for `n` accounts. */
  homeMeta(n: number): string {
    return SHELL_TEXT.homeMetaFormat.replace('{n}', String(n));
  }

  /** The `<html>` element — carries the theme attribute. */
  get htmlElement(): Locator {
    return this.page.locator('html');
  }

  /** The Settings right-hand column — the "About" panel. */
  get aboutPanel(): Locator {
    return this.page.locator('aside.card').filter({
      has: this.page.getByRole('heading', { level: 2, name: SHELL_TEXT.about }),
    });
  }

  /** The Settings left-hand column — the "Danger zone" heading. */
  get dangerZoneHeading(): Locator {
    return this.page.getByRole('heading', { level: 2, name: SHELL_TEXT.dangerZone });
  }

  /** The wordmark in the mobile topbar. */
  get brandWordmark(): Locator {
    return this.mobileTopbar.locator('div.finora-brand');
  }

  /** The logo + wordmark group — the centred block in the topbar. */
  get brandGroup(): Locator {
    return this.mobileTopbar.locator('div.flex-1');
  }

  /** The hamburger's left edge, in CSS pixels. */
  async hamburgerLeftEdge(): Promise<number> {
    const box = await this.openMenuButton.boundingBox();
    return box ? Math.round(box.x) : 0;
  }

  /** The viewport's inner width in CSS pixels. */
  async viewportWidth(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.clientWidth);
  }

  /** The sidebar's horizontal offset — negative when off-canvas. */
  async drawerOffsetX(): Promise<number> {
    const box = await this.sidebar.boundingBox();
    return box ? Math.round(box.x) : 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // Theme
  // ─────────────────────────────────────────────────────────────────

  /** The theme the document currently carries. */
  async documentTheme(): Promise<string | null> {
    return this.htmlElement.getAttribute(SHELL_TEXT.themeAttribute);
  }

  /**
   * The theme the SERVED html carries, before any script runs.
   *
   * This is the "no flash of a light theme" evidence: the attribute
   * is in the static `index.html`, so the very first paint is already
   * dark — nothing has to flip it later.
   */
  async servedHtmlTheme(): Promise<string | null> {
    const response = await this.page.request.get('/');
    const html = await response.text();
    const match = html.match(/<html[^>]*\sdata-theme="([^"]*)"/);
    return match ? match[1] : null;
  }

  /**
   * How many theme controls the current screen offers.
   *
   * The PRD asks for a Dark / Light / Auto setting and a sidebar
   * segmented toggle; the build ships neither. This counts any
   * interactive element whose accessible name reads like a theme
   * control, so the absence is asserted rather than assumed.
   */
  async themeControlCount(): Promise<number> {
    return this.page.evaluate(() => {
      const pattern = /theme|appearance|dark\s*mode|light\s*mode|auto/i;
      const controls = document.querySelectorAll(
        'button, a, input, select, [role="switch"], [role="checkbox"], [role="radio"]',
      );
      let count = 0;
      controls.forEach(el => {
        const name =
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          (el.textContent || '').trim();
        if (pattern.test(name)) count += 1;
      });
      return count;
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Layout measurement
  // ─────────────────────────────────────────────────────────────────

  /**
   * How far the document scrolls horizontally, in CSS pixels.
   *
   * Zero means there is no horizontal scrollbar.
   */
  async horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
  }

  /**
   * How many elements stick out past the right edge of the viewport.
   *
   * `documentElement.scrollWidth` alone can miss an element that
   * overflows its own scroll container; this walks the tree.
   */
  async overflowingElementCount(): Promise<number> {
    return this.page.evaluate(() => {
      const limit = document.documentElement.clientWidth + 1;
      let count = 0;
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > limit) count += 1;
      });
      return count;
    });
  }

  /** The sidebar's rendered width in CSS pixels. */
  async sidebarWidth(): Promise<number> {
    const box = await this.sidebar.boundingBox();
    return box ? Math.round(box.width) : 0;
  }

  /** The sidebar's computed `position` — `sticky` or `fixed`. */
  async sidebarPosition(): Promise<string> {
    return this.sidebar.evaluate(
      el => window.getComputedStyle(el).position,
    );
  }

  /**
   * The gap between the bottom of the sidebar and the bottom of the
   * "Add transaction" CTA.
   *
   * A CTA "pinned to the bottom" sits flush with the sidebar's
   * padding, so the gap is small and non-zero.
   */
  async ctaBottomGap(): Promise<number> {
    const [aside, cta] = await Promise.all([
      this.sidebar.boundingBox(),
      this.addTransactionButton.boundingBox(),
    ]);
    if (!aside || !cta) throw new Error('Sidebar or CTA has no bounding box');
    return Math.round(aside.y + aside.height - (cta.y + cta.height));
  }

  /**
   * The resolved column count of the Settings grid.
   *
   * `grid-template-columns` computes to one entry per column, so
   * splitting it counts the columns the screen actually renders.
   */
  async settingsColumnCount(): Promise<number> {
    return this.page.evaluate(() => {
      const grid = document.querySelector('main .grid');
      if (!grid) return 0;
      return window
        .getComputedStyle(grid)
        .gridTemplateColumns.split(' ')
        .filter(Boolean).length;
    });
  }

  /** The About panel's rendered width in CSS pixels. */
  async aboutPanelWidth(): Promise<number> {
    const box = await this.aboutPanel.boundingBox();
    return box ? Math.round(box.width) : 0;
  }

  /**
   * How far the About panel sticks out past the viewport's right edge.
   *
   * Zero means it fits; a positive number is how many pixels are
   * clipped (and how wide the horizontal scrollbar gets).
   */
  async aboutPanelOverflow(): Promise<number> {
    const box = await this.aboutPanel.boundingBox();
    if (!box) throw new Error('The About panel has no bounding box');
    return Math.round(box.x + box.width - (await this.viewportWidth()));
  }

  /** The vertical offset of the About panel's top edge. */
  async aboutPanelTop(): Promise<number> {
    const box = await this.aboutPanel.boundingBox();
    return box ? Math.round(box.y) : 0;
  }

  /** The vertical offset of the "Danger zone" heading's top edge. */
  async dangerZoneHeadingTop(): Promise<number> {
    const box = await this.dangerZoneHeading.boundingBox();
    return box ? Math.round(box.y) : 0;
  }

  /**
   * The right edge of the Settings controls column.
   *
   * The Settings grid's first child holds every control; its right
   * edge says whether the controls themselves are clipped.
   */
  async settingsControlsRightEdge(): Promise<number> {
    return this.page.evaluate(() => {
      const grid = document.querySelector('main .grid');
      if (!grid || grid.children.length === 0) return 0;
      return Math.round(grid.children[0].getBoundingClientRect().right);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Mobile drawer internals
  // ─────────────────────────────────────────────────────────────────

  /** The computed `backdrop-filter` on the drawer backdrop. */
  async backdropBlur(): Promise<string> {
    return this.drawerBackdrop.evaluate(
      el => window.getComputedStyle(el).backdropFilter,
    );
  }

  /**
   * Whether the shell has locked the page behind the drawer.
   *
   * `src/components/Shell.tsx` sets `document.body.style.overflow =
   * 'hidden'` while the drawer is open, so the page behind cannot
   * scroll.
   */
  async isBodyScrollLocked(): Promise<boolean> {
    return this.page.evaluate(
      () => document.body.style.overflow === 'hidden',
    );
  }

  /** How far the window is scrolled down, in CSS pixels. */
  async scrollY(): Promise<number> {
    return this.page.evaluate(() => window.scrollY);
  }

  /**
   * Whether the topbar's logo + wordmark group is centred.
   *
   * The manual asks for the wordmark "centred" — the group that holds
   * the logo and the wordmark is what the Shell centres, so the
   * group's midpoint is what is measured (within a pixel or two of
   * the viewport's midpoint).
   */
  async isBrandGroupCentred(): Promise<boolean> {
    const box = await this.brandGroup.boundingBox();
    if (!box) return false;
    const viewportWidth = await this.page.evaluate(
      () => document.documentElement.clientWidth,
    );
    const centre = box.x + box.width / 2;
    return Math.abs(centre - viewportWidth / 2) <= 2;
  }
}
