/**
 * home.spec.ts — FIN-H01, FIN-H02, FIN-H04, FIN-H05, FIN-H06.
 *
 * The Home and Insights domain: the Home dashboard's hero, the
 * "This month" card, the four-cell strip and the two preview cards;
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
  trendsNoPreviousState,
  trendsState,
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

      // The projection column only renders when the projected net
      // worth exceeds the current one.
      await expect(home.projectionLabel).toHaveText(home1.expected.projectionLabel);
      await expect(home.projectionCaption).toHaveText(home1.expected.projectionCaption);
    });

    await test.step('Read the "This month" card', async () => {
      for (const label of home1.expected.thisMonthLabels) {
        await expect(home.thisMonthValue(label as 'Income')).toBeVisible();
      }
      await expect(home.thisMonthValue('Income')).toHaveText(
        home1.figures.thisMonth.income,
      );
      await expect(home.thisMonthValue('Expenses')).toHaveText(
        home1.figures.thisMonth.expenses,
      );
      await expect(home.thisMonthValue('Net saved')).toHaveText(
        home1.figures.thisMonth.netSaved,
      );
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

    await test.step('Read the Accounts preview', async () => {
      await expect(home.accountsCard.getByRole('link', { name: home1.expected.accountsLink })).toBeVisible();

      // The preview shows AT MOST four accounts.
      for (const account of home1.figures.accounts) {
        await expect(home.accountBalance(account.name)).toHaveText(account.balance);
        await expect(home.accountTypeLabel(account.name)).toHaveText(account.type);
      }
      await expect(
        home.accountsCard.getByRole('link', { name: home1.expected.accountsLink }),
      ).toHaveCount(1);
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
          await expect(insights.trendsSection).toHaveAttribute(
            'aria-label',
            h02.sectionLabels.trends.replace('{range}', range),
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

    await test.step('Read the four cards', async () => {
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

      // "Spending by category" — the total plus the top categories.
      await expect(insights.spendingCard.getByRole('heading')).toHaveText(
        h02.expected.spendingHeading,
      );
      await expect(insights.spendingTotal).toHaveText(
        h02.figures.spendingTotal,
      );
      for (const category of h02.figures.spendingRows) {
        await expect(insights.spendingRow(category)).toBeVisible();
      }

      // "Net worth" — the "Now" label and the hover hint.
      await expect(insights.netWorthHeading).toHaveText(h02.expected.netWorthHeading);
      await expect(insights.netWorthNowLabel).toHaveText(h02.expected.netWorthNow);
      await expect(insights.netWorthHint).toHaveText(h02.expected.netWorthHint);

      // "Trends".
      await expect(insights.trendsHeading).toHaveText(h02.expected.trendsHeading);
      await expect(insights.trendsSubLine).toHaveText(h02.expected.trendsSubLine);
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

    await test.step('Hover a net-worth bar', async () => {
      await insights.hoverNetWorthMonth(5);

      // The caption under the chart replaces the hover hint.
      await expect(insights.netWorthHint).toHaveCount(0);
    });

    await test.step('The footnote links to Goals, Debts and Investments', async () => {
      await expect(insights.trendsFootnote).toHaveText(h02.expected.footnote);
      for (const link of h02.expected.footnoteLinks) {
        await expect(
          insights.trendsFootnoteLink(link as 'Goals'),
        ).toBeVisible();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-H04 — the Trends rows and the period-comparison caption
  // ─────────────────────────────────────────────────────────────────

  test('FIN-H04 The Insights trends rows and the period-comparison caption', { tag: '@smoke' }, async ({ page }) => {
    const h04 = data.H04_trends;
    await seedState(page, trendsState());

    await test.step('Open Insight and read the "Trends over …" card', async () => {
      await insights.goto();

      // The app's default range is "Last 6 months" — the third pill.
      await expect(insights.trendsSection).toHaveAttribute(
        'aria-label',
        h04.expected.headingFormat.replace('{range}', h04.ranges[2]),
      );
      await expect(insights.trendsSubLine).toHaveText(h04.expected.subLine);
    });

    await test.step('Read the four stacked rows', async () => {
      for (const row of h04.expected.rows) {
        await expect(
          insights.trendRow(row.label as 'Savings rate'),
        ).toBeVisible();
        await expect(
          insights.trendHint(row.label as 'Savings rate'),
        ).toHaveText(row.hint);
      }
    });

    await test.step('Switch to Last 3 months, then Last 6 months, then Last 12 months', async () => {
      for (const range of ['Last 3 months', 'Last 6 months', 'Last 12 months'] as const) {
        await test.step(`Switch to ${range}`, async () => {
          await insights.selectRange(range);

          // The comparison caption reads "↑ X% vs previous N months".
          await expect(
            insights.trendCaption('Average monthly expense'),
          ).toHaveText(h04.figures.captions[range]);

          // The average itself follows the range.
          await expect(
            insights.trendValue('Average monthly expense'),
          ).toHaveText(h04.figures.avgMonthlyExpense[range]);
        });
      }
    });

    await test.step('Switch to This month and All time', async () => {
      for (const range of ['This month', 'All time'] as const) {
        await test.step(`Switch to ${range}`, async () => {
          await insights.selectRange(range);

          // The caption is SUPPRESSED — never shown as "0%" and never
          // as "NaN%".
          await expect(insights.trendCaption('Average monthly expense')).toHaveCount(0);
        });
      }
    });

    await test.step('Only the "Average monthly expense" row carries a comparison caption', async () => {
      await insights.selectRange('Last 6 months');

      for (const row of ['Savings rate', 'Days of runway', 'Investment growth'] as const) {
        await expect(insights.trendCaption(row)).toHaveCount(0);
      }
    });

    await test.step('The caption is suppressed when the previous window has no data', async () => {
      await reseedState(page, trendsNoPreviousState());
      await insights.goto();
      await insights.selectRange('Last 6 months');

      await expect(insights.trendCaption('Average monthly expense')).toHaveCount(0);
    });

    await test.step('Read the "Savings rate", "Days of runway" and "Investment growth" rows', async () => {
      await reseedState(page, trendsState());
      await insights.goto();

      // No income in the fixture → the savings rate renders "—".
      await expect(insights.trendValue('Savings rate')).toHaveText(
        h04.figures.savingsRate,
      );

      // There IS spend data → the runway is a real "N d" figure.
      await expect(insights.trendValue('Days of runway')).toHaveText(
        new RegExp(h04.figures.runwayPattern),
      );

      await expect(insights.trendValue('Investment growth')).toHaveText(
        h04.figures.investmentGrowth,
      );
      await expect(insights.trendHint('Investment growth')).toHaveText(
        h04.figures.investmentGrowthHint,
      );
    });

    await test.step('No "NaN" or "0% vs previous" artefact appears', async () => {
      const body = await insights.trendsSection.innerText();
      for (const forbidden of h04.figures.forbiddenText) {
        expect(body).not.toContain(forbidden);
      }
      // A bare "0% vs previous" caption would mean the comparison
      // fired on an empty previous window.
      for (const pattern of h04.figures.forbiddenPatterns) {
        expect(body).not.toMatch(new RegExp(pattern, 'm'));
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

    await test.step('Read the empty Accounts card', async () => {
      const empty = h05.expected.accountsEmpty;
      await expect(home.emptyStateTitle(empty.title)).toBeVisible();
      await expect(home.accountsCard.getByText(empty.description, { exact: true })).toBeVisible();
      await expect(home.accountsCard.getByRole('link', { name: empty.cta })).toBeVisible();
      await expect(home.accountsCard.getByRole('button', { name: empty.learnMore })).toBeVisible();
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

    await test.step('Read the cash-flow, spending and net-worth cards', async () => {
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

      await expect(insights.spendingEmptyState).toHaveText(
        h06.expected.spendingEmpty,
      );
      await expect(insights.netWorthEmptyState).toHaveText(
        h06.expected.netWorthEmpty,
      );
    });

    await test.step('On the profile with no investments, read the "Investment growth" row', async () => {
      await expect(insights.trendValue('Investment growth')).toHaveText(
        h06.expected.investmentGrowthEmpty,
      );
      await expect(insights.trendHint('Investment growth')).toHaveText(
        h06.expected.investmentGrowthHintEmpty,
      );
    });

    await test.step('Look for goals, debts and investments widgets on the Insight screen', async () => {
      // The footnote links to the three screens, but NO widget cards
      // are rendered for them.
      for (const widget of h06.expected.absentWidgets) {
        await expect(insights.headingNamed(widget)).toHaveCount(0);
      }
    });

    await test.step('The footnote is present with links to Goals, Debts and Investments', async () => {
      await expect(insights.trendsFootnote).toHaveText(h06.expected.footnote);
      for (const link of h06.figures.footnoteLinks) {
        await expect(
          insights.trendsFootnoteLink(link as 'Goals'),
        ).toBeVisible();
      }
    });

    await test.step('Look for a recurring-transaction insight', async () => {
      const body = await insights.mainRegion.innerText();
      expect(body).not.toMatch(new RegExp(h06.figures.recurringPattern, 'i'));
    });
  });
});
