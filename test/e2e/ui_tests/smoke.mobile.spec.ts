/**
 * smoke.mobile.spec.ts — FIN-S05, the mobile drawer.
 *
 * Runs only in the `mobile` project (Pixel 7), because the drawer only
 * exists below the `md` breakpoint (768px).
 *
 * The drawer dismisses four ways — the ✕ button, the backdrop, the
 * Escape key, and by navigating (the Shell closes it on every route
 * change) — and the page behind it must not scroll while it is open.
 * All four dismissals are asserted in ONE test, because the manual
 * case is one case.
 *
 * The open/closed signal is the BACKDROP's presence — it is
 * conditionally rendered only while the drawer is open. The ✕ button
 * stays in the DOM (transformed off-canvas with the `<aside>`), so a
 * visibility check on it would always pass.
 */
import { expect, test } from '@playwright/test';
import { ShellPage, SHELL_ROUTES, SHELL_TEXT } from '../pages/ShellPage';
import { seedState } from '../fixtures/app-state';
import { todayState } from '../fixtures/seed-data';

test.describe('Smoke — mobile drawer', () => {
  let shell: ShellPage;

  test.beforeEach(async ({ page }) => {
    shell = new ShellPage(page);
  });

  test('FIN-S05 Mobile drawer opens and dismisses four ways', { tag: '@smoke' }, async ({ page }) => {
    await seedState(page, todayState());

    await test.step('Open the app URL at 375×812', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await shell.gotoRoute('/home');
      await shell.waitForAppReady();
    });

    await test.step('The topbar shows the wordmark centred with the hamburger on the left', async () => {
      await expect(shell.mobileTopbar).toBeVisible();
      await expect(shell.openMenuButton).toBeVisible();
      await expect(shell.brandWordmark).toHaveText(SHELL_TEXT.brand);

      // The hamburger sits on the left half, the brand group is
      // centred on the viewport.
      expect(await shell.hamburgerLeftEdge()).toBeLessThan(
        (await shell.viewportWidth()) / 2,
      );
      expect(await shell.isBrandGroupCentred()).toBe(true);
    });

    await test.step('Tap the hamburger in the topbar', async () => {
      expect(await shell.isDrawerOpen()).toBe(false);

      await shell.openDrawer();
      await expect(shell.drawerBackdrop).toBeVisible();
      expect(await shell.isDrawerOpen()).toBe(true);
    });

    await test.step('The drawer slides in over a blurred backdrop, listing all nine nav items plus the "+ Add transaction" CTA', async () => {
      // The backdrop is blurred, so the page behind it is diffused.
      expect(await shell.backdropBlur()).not.toBe('none');

      expect(await shell.navLinks.count()).toBe(shell.navLabels.length);
      for (const label of shell.navLabels) {
        await expect(shell.navLink(label)).toBeVisible();
      }

      await expect(shell.addTransactionButton).toBeVisible();
      await expect(shell.addTransactionButton).toHaveText(
        new RegExp(SHELL_TEXT.addTransaction),
      );
    });

    await test.step('Open the drawer and attempt to scroll the page behind it', async () => {
      // The Shell sets `body { overflow: hidden }` while the drawer is
      // open, so the page behind cannot move.
      expect(await shell.isBodyScrollLocked()).toBe(true);

      const before = await shell.scrollY();
      await page.mouse.move(200, 500);
      await page.mouse.wheel(0, 600);
      expect(await shell.scrollY()).toBe(before);
    });

    await test.step('Tap a nav item — the drawer closes', async () => {
      await shell.navLink('Accounts').click();

      await expect(page).toHaveURL(new RegExp(`#${SHELL_ROUTES.Accounts}$`));
      await expect(shell.screenHeading).toHaveText(shell.headingsByNav.Accounts);
      await expect(shell.drawerBackdrop).toHaveCount(0);
      expect(await shell.isDrawerOpen()).toBe(false);
    });

    await test.step('Open the drawer again and tap the backdrop', async () => {
      await shell.openDrawer();
      await expect(shell.drawerBackdrop).toBeVisible();

      await shell.closeDrawerWithBackdrop();
      await expect(shell.drawerBackdrop).toHaveCount(0);
      expect(await shell.isDrawerOpen()).toBe(false);
    });

    await test.step('Open the drawer again and tap the close ×', async () => {
      await shell.openDrawer();
      await expect(shell.drawerBackdrop).toBeVisible();

      await shell.closeDrawerWithButton();
      await expect(shell.drawerBackdrop).toHaveCount(0);
      expect(await shell.isDrawerOpen()).toBe(false);
    });

    await test.step('Open the drawer again and press Escape', async () => {
      await shell.openDrawer();
      await expect(shell.drawerBackdrop).toBeVisible();

      await shell.closeDrawerWithEscape();
      await expect(shell.drawerBackdrop).toHaveCount(0);
      expect(await shell.isDrawerOpen()).toBe(false);
    });

    await test.step('All four dismissal paths closed the drawer and removed the backdrop', async () => {
      expect(await shell.isDrawerOpen()).toBe(false);
      await expect(shell.drawerBackdrop).toHaveCount(0);

      // The scroll lock is released with the drawer.
      expect(await shell.isBodyScrollLocked()).toBe(false);
    });
  });
});
