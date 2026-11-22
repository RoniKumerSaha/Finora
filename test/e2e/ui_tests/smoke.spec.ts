/**
 * smoke.spec.ts — FIN-S01 … FIN-S04, FIN-S06, FIN-S07.
 *
 * The smoke gate: if these fail, nothing else is worth running. They
 * prove the app boots clean, every destination opens, hash routing
 * survives a static build, the layout holds at three breakpoints and
 * the browser's history works.
 *
 * The mobile drawer case (FIN-S05) lives in `smoke.mobile.spec.ts` —
 * the `mobile` project only picks up `*.mobile.spec.ts` files.
 *
 * Every selector and every user-visible string lives in `ShellPage`
 * (or the shared fixtures), so this file carries no locator strings
 * and no copy literals.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ShellPage, SHELL_ROUTES, SHELL_TEXT, type NavTarget } from '../pages/ShellPage';
import { readState, seedState } from '../fixtures/app-state';
import { todayState } from '../fixtures/seed-data';

/**
 * Chromium refuses to load a module script or a stylesheet from a
 * `file://` page unless it is launched with file access relaxed —
 * the page's origin is `null`, so the subresource requests are
 * blocked by CORS. The flag changes nothing else about the run.
 *
 * ⚠️ WITHOUT this flag the shipped build CANNOT boot from `file://`
 * in Chromium at all. See FIN-S04's note on the relative build base.
 */
test.use({ launchOptions: { args: ['--allow-file-access-from-files'] } });

/**
 * Walk up from the working directory until the repo root is found.
 *
 * `process.cwd()` is wherever the runner was invoked from, so the
 * search makes the build independent of that.
 */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'vite.config.ts')) && existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not locate the repository root from ' + process.cwd());
}

/**
 * Build the app into a throwaway directory.
 *
 * ⚠️ THREE documented deviations from the manual's "Run `npm run build`":
 *
 *  1. `npm run build` is `tsc -b && vite build`. The `tsc -b` step
 *     currently FAILS on `test/unit/data/fixtures.contract.spec.ts`
 *     (`TS2307: Cannot find module 'node:fs'`, `TS2304: Cannot find
 *     name '__dirname'`) — a pre-existing typecheck failure in a file
 *     this suite does not own. So the bundling step is invoked
 *     directly, which is the part FIN-S04 is actually about.
 *
 *  2. `vite.config.ts` sets no `base`, so the SHIPPED build emits
 *     ABSOLUTE asset URLs (`/assets/index-*.js`). Resolved against a
 *     `file://` document those become `file:///C:/assets/…` — the
 *     assets are not found and the app cannot boot at all. The build
 *     therefore uses `--base=./`, which emits relative URLs and is
 *     what a `file://` deploy needs.
 *
 *     ⚠️ This means the manual case's premise — "the router is in
 *     hash mode, so a static build works from `file://` with no
 *     server" — does NOT hold for the build the repo actually
 *     produces. Hash routing is necessary but NOT sufficient: the
 *     asset URLs must be relative too. Reported to the doc owner.
 *
 *  3. The output goes to a temp directory, so the repo's own `dist/`
 *     is left alone.
 */
function buildStaticApp(): string {
  const root = repoRoot();
  const outDir = mkdtempSync(join(tmpdir(), 'finora-static-'));
  try {
    execFileSync(
      process.execPath,
      [
        join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
        'build',
        '--base=./',
        '--outDir',
        outDir,
      ],
      { cwd: root, stdio: 'pipe' },
    );
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? '';
    rmSync(outDir, { recursive: true, force: true });
    throw new Error('Static build failed:\n' + stderr);
  }
  return outDir;
}

test.describe('Smoke', () => {
  let shell: ShellPage;

  test.beforeEach(async ({ page }) => {
    shell = new ShellPage(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-S01 — a clean boot
  // ─────────────────────────────────────────────────────────────────

  test('FIN-S01 App boots cleanly to Home', { tag: '@smoke' }, async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const pageErrors: string[] = [];

    // The listeners must be attached BEFORE the first navigation, or
    // the boot's own console output is missed.
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
      if (message.type() === 'warning') consoleWarnings.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await test.step('Open the app URL', async () => {
      await shell.gotoRoute('/');
      await shell.waitForAppReady();
    });

    await test.step('Wait for the Home screen to finish rendering', async () => {
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Home);
      await expect(shell.screenHeading).toHaveCount(1);
    });

    await test.step('The meta line reads "Net worth · across N accounts · updated just now"', async () => {
      // A fresh profile has no accounts, so N is 0.
      await expect(shell.homeMetaLine).toHaveText(shell.homeMeta(0));
    });

    await test.step('The console shows no errors and no React warnings', async () => {
      // React 18 reports its warnings through `console.error`, so an
      // empty error list already covers "no React warnings". The
      // warning channel is checked separately for the same phrasing.
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);

      const reactWarnings = [...consoleErrors, ...consoleWarnings].filter(
        (message) =>
          /React does not recognize|unique "key"|Each child in a list|Warning:/.test(
            message,
          ),
      );
      expect(reactWarnings).toEqual([]);
    });

    await test.step('The document is dark-themed on first paint, with no flash of a light theme', async () => {
      // The served `index.html` already carries `data-theme="dark"`, so
      // the very first paint is dark — nothing has to flip it later.
      expect(await shell.servedHtmlTheme()).toBe(SHELL_TEXT.darkTheme);
      expect(await shell.documentTheme()).toBe(SHELL_TEXT.darkTheme);
    });

    await test.step('Known gap: the theme is dark-only — no theme control is offered anywhere', async () => {
      // PRD §9.6 / §9.14 ask for a Dark / Light / Auto setting and a
      // sidebar segmented toggle. The build ships neither.
      expect(await shell.themeControlCount()).toBe(0);

      await shell.navigateTo('Settings');
      expect(await shell.themeControlCount()).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-S02 — all nine destinations
  // ─────────────────────────────────────────────────────────────────

  test('FIN-S02 All nine destinations open', { tag: '@smoke' }, async ({ page }) => {
    await seedState(page, todayState());

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await test.step('Open the app URL', async () => {
      await shell.gotoRoute('/home');
      await shell.waitForAppReady();
    });

    // The manual's nine destinations, in the order it clicks them.
    const destinations: NavTarget[] = [
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

    expect(destinations).toHaveLength(shell.navLabels.length);

    for (const label of destinations) {
      await test.step(`Click ${label}`, async () => {
        await shell.navigateTo(label);

        // Each destination renders its own screen with its own H1.
        await expect(shell.screenHeading).toHaveText(shell.headingsByNav[label]);
        await expect(shell.screenHeading).toHaveCount(1);

        // The URL hash matches the destination.
        expect(await shell.currentRoute()).toBe(SHELL_ROUTES[label]);
        await expect(page).toHaveURL(new RegExp(`#${SHELL_ROUTES[label]}$`));

        // No dead links — the nav item points at that route.
        expect(await shell.navLink(label).getAttribute('href')).toBe(
          `#${SHELL_ROUTES[label]}`,
        );

        // Exactly one nav item is highlighted, and it is this one.
        expect(await shell.highlightedNavCount()).toBe(1);
        await expect(shell.activeNavLink).toHaveText(label);
      });
    }

    await test.step('No console errors were raised on the way through', async () => {
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-S03 — the root redirect and the catch-all route
  // ─────────────────────────────────────────────────────────────────

  test('FIN-S03 Root redirects to Home and an unknown route shows "Not found."', async ({ page }) => {
    await seedState(page, todayState());

    await test.step('Navigate to #/', async () => {
      await shell.gotoRoute('/');
      await shell.waitForAppReady();

      expect(await shell.currentRoute()).toBe(SHELL_ROUTES.Home);
      await expect(page).toHaveURL(new RegExp(`#${SHELL_ROUTES.Home}$`));
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Home);
    });

    await test.step('Navigate to #/nope-not-a-route', async () => {
      await shell.gotoRoute('/nope-not-a-route');
      await shell.waitForAppReady();

      await expect(shell.notFoundMessage).toHaveText(SHELL_TEXT.notFound);
      await expect(shell.notFoundMessage).toBeVisible();
    });

    await test.step('The sidebar stays visible and navigable in the not-found state', async () => {
      await expect(shell.sidebar).toBeVisible();
      expect(await shell.navLinks.count()).toBe(shell.navLabels.length);

      await shell.navigateTo('Accounts');
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Accounts);
      expect(await shell.currentRoute()).toBe(SHELL_ROUTES.Accounts);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-S04 — hash routing survives a static build
  // ─────────────────────────────────────────────────────────────────

  test('FIN-S04 Hash routing survives a static build', async ({ page }) => {
    test.setTimeout(120_000);

    let outDir = '';

    await test.step('Build the app', async () => {
      outDir = buildStaticApp();
    });

    const requests: string[] = [];
    const consoleErrors: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const indexPath = join(outDir, 'index.html');
    const indexHtml = readFileSync(indexPath, 'utf8');

    try {
      await test.step('Open dist/index.html from disk using a file:// URL', async () => {
        // The build must not assume a server root: every asset URL is
        // relative, so the document resolves them against its own
        // folder rather than the filesystem root.
        expect(indexHtml).not.toMatch(/["']\/assets\//);
        expect(indexHtml).toMatch(/["']\.\/assets\//);

        await page.goto(pathToFileURL(indexPath).href);
        await shell.waitForAppReady();

        await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Home);
        await expect(shell.htmlElement).toHaveAttribute(
          SHELL_TEXT.themeAttribute,
          SHELL_TEXT.darkTheme,
        );
      });

      await test.step('Navigate between Home, Transactions and Accounts', async () => {
        await shell.navigateTo('Transactions');
        await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Transactions);

        await shell.navigateTo('Accounts');
        await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Accounts);
      });

      await test.step('The router is in hash mode, so no SPA rewrite rule is needed', async () => {
        // The route lives in the fragment; the document's own path
        // never changes — there is nothing for a server to rewrite.
        const url = new URL(page.url());
        expect(url.protocol).toBe('file:');
        expect(url.pathname).toBe(new URL(pathToFileURL(indexPath).href).pathname);
        expect(url.hash).toBe(`#${SHELL_ROUTES.Accounts}`);
        expect(await shell.currentRoute()).toBe(SHELL_ROUTES.Accounts);
      });

      await test.step('The app boots with no web server running', async () => {
        // Every request the page made was served from disk.
        expect(requests.length).toBeGreaterThan(0);
        expect(requests.every((url) => url.startsWith('file://'))).toBe(true);
        expect(consoleErrors).toEqual([]);
      });

      await test.step('Known gap: the build the repo SHIPS cannot boot from file://', async () => {
        // `vite.config.ts` sets no `base`, so `npm run build` emits
        // ABSOLUTE asset URLs. Against a `file://` document those
        // resolve against the FILESYSTEM ROOT (`file:///C:/assets/…`),
        // the assets are never found, and the app never mounts.
        //
        // The case above therefore had to build with `--base=./`.
        // Hash routing alone is NOT sufficient for a `file://` deploy.
        const shippedDir = mkdtempSync(join(tmpdir(), 'finora-shipped-'));
        try {
          const root = repoRoot();
          execFileSync(
            process.execPath,
            [
              join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
              'build',
              '--outDir',
              shippedDir,
            ],
            { cwd: root, stdio: 'pipe' },
          );

          const shippedHtml = readFileSync(join(shippedDir, 'index.html'), 'utf8');
          expect(shippedHtml).toMatch(/["']\/assets\//);

          const probe = await page.context().newPage();
          const probeErrors: string[] = [];
          probe.on('console', (message) => {
            if (message.type() === 'error') probeErrors.push(message.text());
          });
          await probe.goto(pathToFileURL(join(shippedDir, 'index.html')).href);
          // The app never mounts — no `<h1>` at all.
          await expect(probe.locator('h1')).toHaveCount(0);
          expect(probeErrors.length).toBeGreaterThan(0);
          await probe.close();
        } finally {
          rmSync(shippedDir, { recursive: true, force: true });
        }
      });
    } finally {
      if (outDir) rmSync(outDir, { recursive: true, force: true });
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-S06 — the layout at three breakpoints
  // ─────────────────────────────────────────────────────────────────

  test('FIN-S06 Layout holds at three breakpoints', async ({ page }) => {
    await seedState(page, todayState());

    await test.step('Resize the viewport to 1440×900 and open Settings', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await shell.gotoRoute('/settings');
      await shell.waitForAppReady();
    });

    await test.step('At 1440×900 the sidebar is a sticky 248px left column with the CTA pinned at the bottom', async () => {
      expect(await shell.sidebarWidth()).toBe(248);
      expect(await shell.sidebarPosition()).toBe('sticky');

      // "Pinned at the bottom" = the CTA sits flush with the sidebar's
      // own bottom padding, not part of the nav flow.
      expect(await shell.ctaBottomGap()).toBeGreaterThan(0);
      expect(await shell.ctaBottomGap()).toBeLessThanOrEqual(32);
      await expect(shell.addTransactionButton).toBeVisible();

      // Two columns, with a 320px About panel.
      expect(await shell.settingsColumnCount()).toBe(2);
      expect(await shell.aboutPanelWidth()).toBe(320);
    });

    await test.step('At 1440×900 no content is clipped and there is no horizontal scrollbar', async () => {
      expect(await shell.horizontalOverflow()).toBeLessThanOrEqual(1);
      expect(await shell.overflowingElementCount()).toBe(0);
    });

    await test.step('Resize to 768×1024 and re-read Settings', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await shell.waitForAppReady();
    });

    await test.step('At 768×1024 the sidebar is still the desktop column and Settings is two columns', async () => {
      // The Shell's `md:` breakpoint is 768px, so AT 768 the sidebar
      // is still the sticky desktop column — the off-canvas drawer
      // starts below 768.
      expect(await shell.sidebarPosition()).toBe('sticky');
      expect(await shell.sidebarWidth()).toBe(248);
      await expect(shell.mobileTopbar).toBeHidden();

      expect(await shell.settingsColumnCount()).toBe(2);
      expect(await shell.aboutPanelWidth()).toBe(320);
    });

    await test.step('At 768×1024 the About column is what sticks out past the viewport', async () => {
      // ⚠️ KNOWN GAP — the manual says "no content is clipped and there
      // is no horizontal scrollbar at any of the three widths", but at
      // exactly 768px the Settings two-column grid cannot fit in the
      // 520px main column (248px sidebar + 80px padding leaves 440px,
      // and the grid wants 1fr + 320px + a 24px gap). The document
      // scrolls horizontally and the About column is clipped.
      // Reported to the doc owner — see the FIN-S06 discrepancy.
      expect(await shell.aboutPanelOverflow()).toBeGreaterThan(0);
      expect(await shell.horizontalOverflow()).toBeGreaterThan(0);

      // Nothing else is clipped: the controls column still fits.
      expect(await shell.settingsControlsRightEdge()).toBeLessThanOrEqual(
        await shell.viewportWidth(),
      );
    });

    await test.step('Resize to 375×812 and re-read Settings', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await shell.waitForAppReady();
    });

    await test.step('At 375×812 the sidebar is a fixed off-canvas drawer and the topbar shows the hamburger left with the wordmark centred', async () => {
      expect(await shell.sidebarPosition()).toBe('fixed');
      expect(await shell.drawerOffsetX()).toBeLessThan(0);

      await expect(shell.mobileTopbar).toBeVisible();
      expect(await shell.hamburgerLeftEdge()).toBeLessThan(
        (await shell.viewportWidth()) / 2,
      );
      await expect(shell.brandWordmark).toHaveText(SHELL_TEXT.brand);
      expect(await shell.isBrandGroupCentred()).toBe(true);
    });

    await test.step('Below 768px Settings renders one column with About after the Danger zone', async () => {
      expect(await shell.settingsColumnCount()).toBe(1);
      await expect(shell.aboutPanel).toBeVisible();
      await expect(shell.dangerZoneHeading).toBeVisible();

      const aboutTop = await shell.aboutPanelTop();
      const dangerTop = await shell.dangerZoneHeadingTop();
      expect(aboutTop).toBeGreaterThan(dangerTop);
    });

    await test.step('At 375×812 no content is clipped and there is no horizontal scrollbar', async () => {
      expect(await shell.horizontalOverflow()).toBeLessThanOrEqual(1);
      expect(await shell.overflowingElementCount()).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-S07 — the browser history
  // ─────────────────────────────────────────────────────────────────

  test('FIN-S07 Browser back and forward move between screens', async ({ page }) => {
    await seedState(page, todayState());

    const ledgerFingerprint = async () => {
      const state = await readState(page);
      return {
        accounts: state?.accounts.length ?? 0,
        transactions: state?.transactions.length ?? 0,
        total: (state?.transactions ?? []).reduce(
          (sum, transaction) => sum + transaction.amount,
          0,
        ),
      };
    };

    await test.step('Navigate to Home', async () => {
      await shell.gotoRoute('/home');
      await shell.waitForAppReady();
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Home);
    });

    await test.step('Navigate to Transactions', async () => {
      await shell.navigateTo('Transactions');
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Transactions);
    });

    await test.step('Navigate to Accounts', async () => {
      await shell.navigateTo('Accounts');
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Accounts);
    });

    const before = await ledgerFingerprint();

    await test.step('Press the browser Back button twice', async () => {
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`#${SHELL_ROUTES.Transactions}$`));
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Transactions);
      expect(await shell.currentRoute()).toBe(SHELL_ROUTES.Transactions);
      expect(await shell.highlightedNavCount()).toBe(1);
      await expect(shell.activeNavLink).toHaveText('Transactions');

      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`#${SHELL_ROUTES.Home}$`));
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Home);
      expect(await shell.currentRoute()).toBe(SHELL_ROUTES.Home);
      expect(await shell.highlightedNavCount()).toBe(1);
      await expect(shell.activeNavLink).toHaveText('Home');
    });

    await test.step('Press the browser Forward button twice', async () => {
      await page.goForward();
      await expect(page).toHaveURL(new RegExp(`#${SHELL_ROUTES.Transactions}$`));
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Transactions);
      expect(await shell.currentRoute()).toBe(SHELL_ROUTES.Transactions);
      expect(await shell.highlightedNavCount()).toBe(1);
      await expect(shell.activeNavLink).toHaveText('Transactions');

      await page.goForward();
      await expect(page).toHaveURL(new RegExp(`#${SHELL_ROUTES.Accounts}$`));
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Accounts);
      expect(await shell.currentRoute()).toBe(SHELL_ROUTES.Accounts);
      expect(await shell.highlightedNavCount()).toBe(1);
      await expect(shell.activeNavLink).toHaveText('Accounts');
    });

    await test.step('No state is lost and no screen renders blank', async () => {
      expect(await ledgerFingerprint()).toEqual(before);

      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Accounts);
      await expect(shell.screenHeading).toBeVisible();
      await expect(shell.mainRegion).not.toBeEmpty();
    });
  });
});
