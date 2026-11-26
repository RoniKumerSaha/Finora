/**
 * home.spec.ts — FIN-H01, FIN-H02, FIN-H04, FIN-H05, FIN-H06.
 *
 * The Home and Insights domain: the Home dashboard's status bar (the
 * net-worth headline and the four stat cells) and its activity board;
 * the Insights screen's range pills and four cards; the Trends rows
 * and their period-comparison caption; and the empty states on both
 * screens.
 *
 * Each manual case becomes EXACTLY ONE test, titled with its manual
 * ID and the manual title verbatim. `**Priority:** High` cases carry
 * the `@smoke` tag — in the details object, never in the title.
 *
 * Every selector lives in `HomePage` / `InsightsPage`; this file
 * carries no locator strings and no copy literals — every
 * user-visible string is read from `test/data/home-insights.json`.
 */
import { expect, test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { InsightsPage } from '../pages/InsightsPage';
import { seedState, reseedState } from '../fixtures/app-state';
import {
  firstRunState,
  homeLedgerState,
  insightsRangeState,
  negativeNetWorthState,
} from '../fixtures/seed-data';
import homeInsightsJson from '../../data/home-insights.json' with { type: 'json' };

const data = homeInsightsJson;

test.describe('Home and Insights', () => {
  let home: HomePage;
  let insights: InsightsPage;

  test.beforeEach(async ({ page }) => {
    home = new HomePage(page);
    insights = new InsightsPage(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-H01 — the Home dashboard reflects the ledger
  // ─────────────────────────────────────────────────────────────────

  test('FIN-H01 Home reflects the ledger', { tag: '@smoke' }, async ({ page }) => {
    const home1 = data.H01_home;
    await seedState(page, homeLedgerState());

    await test.step('Open Home', async () => {
      await home.goto();
    });

    await test.step('Read the H1 and the meta line', async () => {
      await expect(home.heading).toHaveText(home1.expected.heading);
      await expect(home.metaLine).toHaveText(home1.figures.metaLine);
    });

    await test.step('Read the net-worth hero and its caption', async () => {
      await expect(home.netWorthFigure).toHaveText(home1.figures.netWorth);
      await expect(home.netWorthCaption).toHaveText(home1.expected.netWorthCaption);

      // The "vs last month" row is only rendered when the net worth
      // actually changed — `computeNetWorth` computes cash from ALL
      // transactions regardless of the snapshot date, so only a DPS's
      // compounded value can move the figure. The seeded fixture has
      // such a contribution, so the row is present.
      await expect(home.netWorthDeltaCaption).toHaveText(
        home1.expected.netWorthOvertime,
      );

      // The projection block was removed from Home on 2026-11-24
      // (Variant H — The board) — the status bar carries the headline
      // and the four other figures, and nothing else.
      await expect(home.projectionLabel).toHaveCount(0);
      await expect(home.projectionCaption).toHaveCount(0);
    });

    await test.step('The "This month" card is gone', async () => {
      // Removed on 2026-11-24 (Variant H — The board).
      await expect(home.thisMonthCard).toHaveCount(0);
    });

    await test.step('Read the stat strip', async () => {
      for (const label of home1.expected.statLabels) {
        const cell = label as 'Cash';
        await expect(home.stripValue(cell)).toHaveText(
          home1.figures.strip[cell].value,
        );
        await expect(home.stripHint(cell)).toHaveText(
          home1.figures.strip[cell].hint,
        );
      }
    });

    await test.step('The Accounts preview card is gone', async () => {
      // Removed on 2026-11-24 (Variant H — The board) — the accounts
      // live on their own screen, and Home carries only the figures.
      await expect(home.accountsCard).toHaveCount(0);
    });

    await test.step('Read the Recent activity preview', async () => {
      await expect(
        home.recentActivityCard.getByRole('link', { name: home1.expected.activityLink }),
      ).toBeVisible();

      // AT MOST four rows, newest first.
      await expect(home.activityRows).toHaveCount(home1.figures.activity.rowCount);
      for (const row of home1.figures.activity.rows) {
        await expect(home.activityAmount(row.title)).toHaveText(row.amount);
        await expect(home.activitySubtitle(row.title)).toHaveText(row.subtitle);
      }
    });

    await test.step('A "See full Insights →" affordance closes the screen', async () => {
      await expect(home.seeFullInsightsLink).toBeVisible();
    });

    await test.step('Net worth is net — liabilities dominate when they exceed assets', async () => {
      // The seeded profile has assets, so the caption reads
      // "Assets minus liabilities".
      await expect(home.netWorthCaption).toHaveText(
        home1.expected.netWorthCaption,
      );
      await expect(home.liabilitiesCaption).toHaveCount(0);

      // A profile whose only account is overdrawn flips the caption.
      await reseedState(page, negativeNetWorthState());
      await home.goto();

      await expect(home.liabilitiesCaption).toHaveText(
        home1.expected.liabilitiesCaption,
      );
      await expect(home.netWorthCaption).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-H02 — Insight over the selected range
  // ─────────────────────────────────────────────────────────────────

  test('FIN-H02 Insight over the selected range', { tag: '@smoke' }, async ({ page }) => {
    const h02 = data.H02_insight;
    await seedState(page, insightsRangeState());

    await test.step('Open Insight and read the H1 and the range pills', async () => {
      await insights.goto();

      await expect(insights.heading).toHaveText(h02.expected.heading);
      await expect(insights.rangePills).toHaveText(h02.ranges);
    });

    await test.step('Click each range in turn', async () => {
      for (const range of h02.ranges) {
        await test.step(`Click ${range}`, async () => {
          await insights.selectRange(range as 'All time');

          // The active pill is the pressed one.
          await expect(insights.activeRangePill).toHaveText(range);

          // The three labelled sections follow the range.
          await expect(insights.cashFlowSection).toHaveAttribute(
            'aria-label',
            h02.sectionLabels.cashFlow.replace('{range}', range),
          );
          await expect(insights.netWorthSection).toHaveAttribute(
            'aria-label',
            h02.sectionLabels.netWorth.replace('{range}', range),
          );
          await expect(insights.statementSection).toHaveAttribute(
            'aria-label',
            h02.sectionLabels.statement.replace('{range}', range),
          );
        });
      }
    });

    await test.step('Reload the page', async () => {
      await insights.selectRange('All time');
      await page.reload();
      await insights.waitForAppReady();
    });

    await test.step('The selection persists across a reload', async () => {
      await expect(insights.activeRangePill).toHaveText('All time');

      // The persisted key is the app's own localStorage key.
      const stored = await page.evaluate(
        (key) => window.localStorage.getItem(key),
        h02.storageKey,
      );
      expect(stored).toBe(h02.rangeKeys['All time']);
    });

    await test.step('The default selection is "Last 6 months"', async () => {
      // A fresh profile has no persisted key, so the app falls back
      // to its default range.
      await page.evaluate(
        (key) => window.localStorage.removeItem(key),
        h02.storageKey,
      );
      await page.reload();
      await insights.waitForAppReady();

      await expect(insights.activeRangePill).toHaveText(h02.defaultRange);
    });

    await test.step('Read the cards', async () => {
      // "Cash flow" — sub-line, legend, net line.
      await expect(insights.cashFlowHeading).toHaveText(h02.expected.cashFlowHeading);
      await expect(insights.cashFlowSubLine).toHaveText(
        h02.expected.cashFlowSubLine,
      );
      await expect(insights.cashFlowLegend).toHaveText(h02.expected.legend);
      await expect(insights.cashFlowLegendTotal('Income')).toHaveText(
        h02.figures.legendIncome,
      );
      await expect(insights.cashFlowLegendTotal('Expense')).toHaveText(
        h02.figures.legendExpense,
      );
      await expect(insights.netCashFlow).toHaveText(h02.figures.netCashFlow);

      // "What stands out" — the generated insight feed.
      await expect(insights.insightFeedHeading).toHaveText(
        h02.expected.insightFeedHeading,
      );
      await expect(insights.insightFeedSubLine).toHaveText(
        h02.expected.insightFeedSubLine,
      );
      expect(await insights.insightItems.count()).toBeGreaterThan(0);

      // "Where your money sits" — the composition donut.
      await expect(insights.compositionHeading).toHaveText(
        h02.expected.compositionHeading,
      );
      await expect(insights.compositionRing).toBeVisible();
      expect(await insights.compositionSlices.count()).toBeGreaterThan(0);

      // "Investments" and "Loans" — the two summaries.
      await expect(insights.investmentsHeading).toHaveText(
        h02.expected.investmentsHeading,
      );
      await expect(insights.loansHeading).toHaveText(h02.expected.loansHeading);

      // "Monthly statement".
      await expect(insights.statementHeading).toHaveText(
        h02.expected.statementHeading,
      );
    });

    await test.step('The "All time" chart is truncated to the last 12 months', async () => {
      await insights.selectRange('All time');

      await expect(insights.cashFlowTruncationNote).toHaveText(
        h02.expected.truncatedFormat
          .replace('{capped}', String(h02.figures.truncated.capped))
          .replace('{total}', String(h02.figures.truncated.total)),
      );
    });

    await test.step('Hover a cash-flow point', async () => {
      await insights.selectRange('Last 6 months');

      // The last hit strip is the most recent month.
      await insights.hoverCashFlowMonth(5);

      await expect(insights.cashFlowTooltip).toBeVisible();
    });

    await test.step('The Monthly statement always runs January to December', async () => {
      // The statement is a fixed yearly ledger — the range pills do
      // not change it.
      for (const range of h02.ranges) {
        await insights.selectRange(range as 'All time');

        await expect(insights.statementRows).toHaveCount(12);

        const labels = await insights.statementRows.evaluateAll((els) =>
          els.map((e) => e.getAttribute('data-statement-row') ?? ''),
        );
        expect(labels[0]).toMatch(/^Jan /);
        expect(labels[labels.length - 1]).toMatch(/^Dec /);
      }
    });

    await test.step('Each statement row carries a Flow bar', async () => {
      await insights.selectRange('Last 6 months');

      await expect(insights.flowBars).toHaveCount(12);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-H04 — the Monthly statement is a fixed January-to-December ledger
  // ─────────────────────────────────────────────────────────────────

  test('FIN-H04 The Monthly statement runs January to December', { tag: '@smoke' }, async ({ page }) => {
    const h04 = data.H04_statement;
    await seedState(page, insightsRangeState());

    await test.step('Open Insight and read the "Monthly statement over …" card', async () => {
      await insights.goto();

      // The app's default range is "Last 6 months" — the third pill.
      await expect(insights.statementSection).toHaveAttribute(
        'aria-label',
        h04.expected.sectionHeading.replace('{range}', h04.ranges[2]),
      );
      await expect(insights.statementHeading).toHaveText(h04.expected.heading);
    });

    await test.step('The statement has exactly twelve rows, January first', async () => {
      await expect(insights.statementRows).toHaveCount(h04.expected.rowCount);

      const labels = await insights.statementRows.evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-statement-row') ?? ''),
      );
      expect(labels[0].startsWith(h04.expected.firstMonth)).toBe(true);
      expect(labels[labels.length - 1].startsWith(h04.expected.lastMonth)).toBe(true);
    });

    await test.step('The range pills do not change the statement', async () => {
      for (const range of h04.ranges) {
        await test.step(`Switch to ${range}`, async () => {
          await insights.selectRange(range as 'All time');

          await expect(insights.statementRows).toHaveCount(h04.expected.rowCount);
        });
      }
    });

    await test.step('Every row carries a Flow bar', async () => {
      await insights.selectRange('Last 6 months');

      await expect(insights.flowBars).toHaveCount(h04.expected.rowCount);
    });

    await test.step('A month with activity fills blocks from the zero axis', async () => {
      // The Flow column is a segmented METER: every row carries the
      // zero axis and a fixed run of slots either side of it, and a
      // month that kept money fills green blocks to the RIGHT of the
      // axis while a month that spent more fills red blocks to the
      // LEFT.
      const axes = await page.locator('[data-flow-axis]').count();
      const blocks = await page.locator('[data-flow-bar] i.on').count();

      expect(axes).toBeGreaterThan(0);
      expect(blocks).toBeGreaterThan(0);
    });

    await test.step('No "NaN" or "undefined" artefact appears', async () => {
      const body = await insights.statementSection.innerText();
      for (const forbidden of h04.figures.forbiddenText) {
        expect(body).not.toContain(forbidden);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-H05 — the Home empty states
  // ─────────────────────────────────────────────────────────────────

  test('FIN-H05 Home empty states and stat captions', async ({ page }) => {
    const h05 = data.H05_homeEmpty;

    await test.step('Open Home on a fresh install', async () => {
      // A true first run: no accounts, no transactions, no goals, no
      // debts, no investments.
      await seedState(page, firstRunState());
      await home.goto();
    });

    await test.step('Read the stat strip', async () => {
      for (const [label, hint] of Object.entries(h05.expected.emptyCaptions)) {
        const cell = label as 'Cash';
        await expect(home.stripHint(cell)).toHaveText(hint);
        await expect(home.stripValue(cell)).toHaveText(
          h05.figures.strip[cell].value,
        );
      }
    });

    await test.step('The empty Accounts card is gone', async () => {
      // Removed on 2026-11-24 (Variant H — The board).
      await expect(home.accountsCard).toHaveCount(0);
      await expect(home.emptyStateTitle(h05.expected.accountsEmpty.title)).toHaveCount(0);
    });

    await test.step('Read the empty Transactions card', async () => {
      const empty = h05.expected.transactionsEmpty;
      await expect(home.emptyStateTitle(empty.title)).toBeVisible();
      await expect(home.recentActivityCard.getByText(empty.description, { exact: true })).toBeVisible();
      await expect(home.recentActivityCard.getByRole('link', { name: empty.cta })).toBeVisible();
      await expect(home.recentActivityCard.getByRole('button', { name: empty.learnMore })).toBeVisible();
    });

    await test.step('Read the net-worth caption', async () => {
      // No assets and no liabilities → the neutral caption.
      await expect(home.netWorthCaption).toHaveText(
        h05.expected.netWorthCaption,
      );
      await expect(home.netWorthFigure).toHaveText(h05.figures.netWorth);
    });

    await test.step('No zero-division artefact appears anywhere', async () => {
      const body = await home.mainRegion.innerText();
      for (const forbidden of h05.expected.forbiddenText) {
        expect(body).not.toContain(forbidden);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-H06 — the Insight empty states and the absent widgets
  // ─────────────────────────────────────────────────────────────────

  test('FIN-H06 Insight empty states and the widgets that are absent', async ({ page }) => {
    const h06 = data.H06_insightEmpty;

    await test.step('Open Insight on the profile with no transactions', async () => {
      await seedState(page, firstRunState());
      await insights.goto();
    });

    await test.step('Read the cash-flow card', async () => {
      // The cash-flow card keeps its chart on an empty profile: the
      // month window is always populated, so the legend totals and
      // the net line read zero rather than the card vanishing.
      await expect(insights.cashFlowEmptyState).toHaveCount(0);
      await expect(insights.cashFlowLegendTotal('Income')).toHaveText(
        h06.figures.legendIncome,
      );
      await expect(insights.cashFlowLegendTotal('Expense')).toHaveText(
        h06.figures.legendExpense,
      );
      await expect(insights.netCashFlow).toHaveText(h06.figures.netCashFlow);
    });

    await test.step('Read the empty composition, investments and loans cards', async () => {
      await expect(
        insights.netWorthSection.getByText(h06.expected.compositionEmpty, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        insights.investmentsHeading
          .locator('xpath=ancestor::div[contains(@class,"card")]')
          .getByText(h06.expected.investmentsEmpty, { exact: true }),
      ).toBeVisible();
      await expect(
        insights.loansHeading
          .locator('xpath=ancestor::div[contains(@class,"card")]')
          .getByText(h06.expected.loansEmpty, { exact: true }),
      ).toBeVisible();
    });

    await test.step('Look for a goals widget on the Insight screen', async () => {
      // Goals live on their own screen — no widget card here.
      for (const widget of h06.expected.absentWidgets) {
        await expect(insights.headingNamed(widget)).toHaveCount(0);
      }
    });

    await test.step('Look for a recurring-transaction insight', async () => {
      const body = await insights.mainRegion.innerText();
      expect(body).not.toMatch(new RegExp(h06.figures.recurringPattern, 'i'));
    });
  });
});
