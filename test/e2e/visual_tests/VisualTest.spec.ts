/**
 * VisualTest.spec.ts — the visual-regression suite.
 *
 * Nine snapshots, one per surface with real visual design (the
 * manual plan's §9):
 *
 *   Home · HomeEmpty · Accounts · Transactions · Debts · Investments
 *   Insights · PlanMonth · DarkThemeOnly
 *
 * ## Rules
 *
 *   - **Baselines must be committed.** They live in
 *     `tests/visual_tests/VisualTest.spec.ts-snapshots/` and are
 *     suffixed by OS (`Home-win32.png`). Never gitignore them.
 *   - **The CI OS must match the baseline OS.** A `-linux` baseline
 *     cannot pass on Windows or macOS. The CI visual job is pinned to
 *     the same platform that generated the committed baselines.
 *   - **Functional assertions come FIRST.** If the snapshot fails,
 *     the assertion tells you whether the CONTENT changed or only the
 *     pixels did — otherwise a regression report is just a picture.
 *   - **Deterministic state.** The fixtures use fixed dates; a
 *     screen that renders "3 days ago" would drift every day and
 *     invalidate the baseline by the next week.
 */
import { expect, test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { AccountsPage } from '../pages/AccountsPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { DebtsPage } from '../pages/DebtsPage';
import { InvestmentsPage } from '../pages/InvestmentsPage';
import { InsightsPage } from '../pages/InsightsPage';
import { PlanPage } from '../pages/PlanPage';
import { SettingsPage } from '../pages/SettingsPage';
import { seedState } from '../fixtures/app-state';
import { visualState, emptyLedgerState, firstRunState } from '../fixtures/seed-data';

test.describe('Visual regression', () => {
  test('Home renders the seeded dashboard', async ({ page }) => {
    await seedState(page, visualState());
    const home = new HomePage(page);
    await home.goto();

    // Content first — then the pixels.
    await expect(home.heading).toBeVisible();

    await expect(page).toHaveScreenshot('Home.png', { fullPage: true });
  });

  test('Home renders its empty state with no accounts', async ({ page }) => {
    await seedState(page, emptyLedgerState());
    const home = new HomePage(page);
    await home.goto();

    await expect(home.heading).toBeVisible();

    await expect(page).toHaveScreenshot('HomeEmpty.png', { fullPage: true });
  });

  test('Accounts renders one card per account type', async ({ page }) => {
    await seedState(page, visualState());
    const accounts = new AccountsPage(page);
    await accounts.goto();

    await expect(accounts.cards).toHaveCount(5);

    await expect(page).toHaveScreenshot('Accounts.png', { fullPage: true });
  });

  test('Transactions renders the mixed row shapes', async ({ page }) => {
    await seedState(page, visualState());
    const transactions = new TransactionsPage(page);
    await transactions.goto();

    await expect(transactions.rows).toHaveCount(6);

    await expect(page).toHaveScreenshot('Transactions.png', { fullPage: true });
  });

  test('Debts renders both directions plus the summary', async ({ page }) => {
    await seedState(page, visualState());
    const debts = new DebtsPage(page);
    await debts.goto();

    await expect(debts.cards).toHaveCount(3);
    await expect(debts.summaryCard).toBeVisible();

    await expect(page).toHaveScreenshot('Debts.png', { fullPage: true });
  });

  test('Investments renders the dual-value list', async ({ page }) => {
    await seedState(page, visualState());
    const investments = new InvestmentsPage(page);
    await investments.goto();

    await expect(investments.cards).toHaveCount(2);
    await expect(investments.summaryCard).toBeVisible();

    // The maturity countdown is the ONLY date-dependent text on this
    // screen: `daysToMaturity()` measures against the real "today",
    // so "Matures in 109d" becomes "Matures in 110d" tomorrow and the
    // baseline would be stale by the next run.
    //
    // Masking it keeps the assertion honest — every other pixel of the
    // card is still compared — without baking today's date into the
    // committed baseline. (The functional countdown itself is covered
    // by FIN-I05 / FIN-I06 in `investments.spec.ts`.)
    await expect(page).toHaveScreenshot('Investments.png', {
      fullPage: true,
      mask: [
        investments.cardCountdown('DBBL 1-year FDR'),
        investments.cardCountdown('Monthly DPS'),
      ],
      maskColor: '#000000',
    });
  });

  test('Insights renders all four cards', async ({ page }) => {
    await seedState(page, visualState());
    const insights = new InsightsPage(page);
    await insights.goto();

    await expect(insights.cashFlowChart).toBeVisible();

    await expect(page).toHaveScreenshot('Insights.png', { fullPage: true });
  });

  test('PlanMonth renders the items grid', async ({ page }) => {
    await seedState(page, visualState());
    const plan = new PlanPage(page);
    await plan.gotoMonth();

    await expect(plan.monthHeading).toBeVisible();
    await expect(plan.card('Groceries')).toBeVisible();
    await expect(plan.card('Rent')).toBeVisible();
    await expect(plan.card('Transport')).toBeVisible();

    await expect(page).toHaveScreenshot('PlanMonth.png', { fullPage: true });
  });

  test('Settings renders the dark theme with no light alternative', async ({ page }) => {
    await seedState(page, visualState());
    const settings = new SettingsPage(page);
    await settings.goto();

    await expect(settings.screenHeading).toBeVisible();

    // There is no light theme (manual-plan defect #28) — the
    // Settings screen offers no theme switch at all.
    await expect(page.getByRole('button', { name: /light theme|switch theme/i })).toHaveCount(0);

    await expect(page).toHaveScreenshot('DarkThemeOnly.png', { fullPage: true });
  });

  test('The first-run shell renders with no accounts', async ({ page }) => {
    await seedState(page, firstRunState());
    const accounts = new AccountsPage(page);
    await accounts.goto();

    await expect(accounts.emptyStateCta).toBeVisible();

    await expect(page).toHaveScreenshot('AccountsEmpty.png', { fullPage: true });
  });
});
