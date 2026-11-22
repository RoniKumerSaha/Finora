/**
 * InsightsPage — `/insights`.
 *
 * `src/screens/InsightsScreen.tsx`:
 *   - H1 is "Insight" (singular) — the nav label matches, but the
 *     Home link says "See full Insights →".
 *   - five range pills: This month · Last 3 months · Last 6 months ·
 *     Last 12 months · All time. The default is "Last 6 months" and
 *     the choice persists to `localStorage["finora.insights.range"]`.
 *   - three labelled sections: `Cash flow over {range}`,
 *     `Net worth over {range}` and `Trends over {range}`.
 *   - the Trends card renders four rows — "Average monthly expense",
 *     "Savings rate", "Days of runway", "Investment growth" — each
 *     with an optional "vs previous N months" caption under the value.
 */
import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export type RangeLabel =
  | 'This month'
  | 'Last 3 months'
  | 'Last 6 months'
  | 'Last 12 months'
  | 'All time';

export type TrendLabel =
  | 'Average monthly expense'
  | 'Savings rate'
  | 'Days of runway'
  | 'Investment growth';

export class InsightsPage extends BasePage {
  /** The screen's H1 — "Insight" (singular). */
  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** The range sub-line under the H1. */
  get subLine(): Locator {
    return this.page.getByText(/^(This month|Last \d+ months|All time) · /, { exact: false });
  }

  /** The range pills. */
  get rangePills(): Locator {
    return this.page.locator('button.rounded-pill');
  }

  /** A range pill by its label. */
  rangePill(label: RangeLabel): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  /** The pill that is currently pressed — the active range. */
  get activeRangePill(): Locator {
    return this.page.locator('button.rounded-pill[aria-pressed="true"]');
  }

  /** The "Cash flow over {range}" section. */
  get cashFlowSection(): Locator {
    return this.page.locator('section[aria-label^="Cash flow over"]');
  }

  /** The "Net worth over {range}" section. */
  get netWorthSection(): Locator {
    return this.page.locator('section[aria-label^="Net worth over"]');
  }

  /** The "Trends over {range}" section. */
  get trendsSection(): Locator {
    return this.page.locator('section[aria-label^="Trends over"]');
  }

  /** The "Spending by category" card. */
  get spendingCard(): Locator {
    return this.page.locator('div.card').filter({ hasText: 'Spending by category' }).first();
  }

  /**
   * A Trends row, addressed by its label.
   *
   * `TrendRow` renders label + hint on the left and value (+ optional
   * caption) on the right, inside a bordered grid row. Scoping to the
   * label's grandparent row keeps the value and the caption together.
   */
  trendRow(label: TrendLabel): Locator {
    return this.trendsSection
      .getByText(label, { exact: true })
      .locator('xpath=../..');
  }

  /** A Trends row's hint line. */
  trendHint(label: TrendLabel): Locator {
    return this.trendRow(label).locator('div.text-\\[11\\.5px\\]');
  }

  /** A Trends row's value figure. */
  trendValue(label: TrendLabel): Locator {
    return this.trendRow(label).locator('div.text-\\[16px\\], div.text-\\[18px\\]');
  }

  /** A Trends row's optional "vs previous N months" caption. */
  trendCaption(label: TrendLabel): Locator {
    return this.trendRow(label).locator('div.text-\\[11px\\]');
  }

  /** The "Cash flow" card heading. */
  get cashFlowHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Cash flow' });
  }

  /** The Cash flow card's sub-line — "Income & expense by month". */
  get cashFlowSubLine(): Locator {
    return this.page.getByText('Income & expense by month', { exact: true });
  }

  /** The Cash flow card's legend — the "Income" / "Expense" swatches. */
  get cashFlowLegend(): Locator {
    return this.cashFlowSection.getByText(/^(Income|Expense)$/, { exact: true });
  }

  /**
   * The Cash flow legend's running total for one series.
   *
   * The legend renders label + figure as two siblings inside a
   * `<span>`, so the figure is the label's next sibling.
   */
  cashFlowLegendTotal(series: 'Income' | 'Expense'): Locator {
    return this.cashFlowSection
      .getByText(series, { exact: true })
      .locator('..')
      .locator('span.font-semibold');
  }

  /** The Cash flow card's "Net cash flow ±৳X" line. */
  get netCashFlow(): Locator {
    return this.cashFlowSection.getByText('Net cash flow', { exact: false });
  }

  /**
   * The Cash flow card's truncation note — "Showing last 12 of N
   * months". It only renders when the range was capped.
   */
  get cashFlowTruncationNote(): Locator {
    return this.cashFlowSection.getByText(/^Showing last \d+ of \d+ months$/, {
      exact: false,
    });
  }

  /** The Cash flow chart's inline SVG. */
  get cashFlowChart(): Locator {
    return this.cashFlowSection.locator('svg[role="img"]');
  }

  /**
   * A cash-flow chart hit strip — the invisible `<rect>` that raises
   * the hover tooltip for one month.
   */
  cashFlowHitStrip(index: number): Locator {
    return this.cashFlowChart.locator('rect[fill="transparent"]').nth(index);
  }

  /**
   * Hover one month of the cash-flow chart.
   *
   * The hit strip is the FIRST child of the month group, so the dots
   * painted after it sit ON TOP and would swallow the pointer. The
   * strip spans the full month column, so the pointer is placed at
   * the column's left edge — clear of the dots, still inside the
   * strip — and the tooltip is awaited before the hover is released.
   */
  async hoverCashFlowMonth(index: number): Promise<void> {
    const strip = this.cashFlowHitStrip(index);
    const box = await strip.boundingBox();
    if (!box) throw new Error(`Cash-flow hit strip ${index} has no bounding box`);
    await strip.hover({ position: { x: 2, y: Math.round(box.height / 2) } });
    await this.cashFlowTooltip.waitFor({ state: 'visible' });
  }

  /** The cash-flow chart's hover tooltip. */
  get cashFlowTooltip(): Locator {
    return this.cashFlowSection.getByRole('tooltip');
  }

  /** The Cash flow card's empty-state message. */
  get cashFlowEmptyState(): Locator {
    return this.cashFlowSection.getByText('No transactions in this period.', { exact: true });
  }

  /**
   * The "Spending by category" card's total figure.
   *
   * The header renders the caption as
   * `Total <span class="text-ink font-semibold">৳X</span>`, so the
   * figure is the one `<span>` inside the caption div.
   */
  get spendingTotal(): Locator {
    return this.spendingCard
      .locator('div.text-\\[13px\\].text-muted')
      .locator('span.font-semibold');
  }

  /** The "Spending by category" card's total caption, label included. */
  get spendingTotalCaption(): Locator {
    return this.spendingCard.locator('div.text-\\[13px\\].text-muted');
  }

  /** The "Spending by category" card's empty-state message. */
  get spendingEmptyState(): Locator {
    return this.spendingCard.getByText('No expenses in this period.', { exact: true });
  }

  /**
   * A Spending-by-category row, by the category name.
   *
   * The row is name + amount on one line and a progress bar below, so
   * the name's parent is the row's text line.
   */
  spendingRow(category: string): Locator {
    return this.spendingCard.getByText(category, { exact: true }).locator('..');
  }

  /** The "Net worth" card heading. */
  get netWorthHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Net worth' });
  }

  /** The Net worth card's "Now" label. */
  get netWorthNowLabel(): Locator {
    return this.netWorthSection.getByText('Now', { exact: true });
  }

  /**
   * The Net worth card's "Now" figure.
   *
   * The label and the figure are siblings inside the right-hand
   * column, so the figure is the label's next sibling.
   */
  get netWorthNowValue(): Locator {
    return this.netWorthNowLabel.locator('..').locator('div.text-\\[22px\\]');
  }

  /** The Net worth card's hover hint. */
  get netWorthHint(): Locator {
    return this.netWorthSection.getByText("Hover any bar for that month's figure.", {
      exact: true,
    });
  }

  /** The Net worth card's empty-state message. */
  get netWorthEmptyState(): Locator {
    return this.netWorthSection.getByText('No balance history in this period.', {
      exact: true,
    });
  }

  /**
   * A net-worth chart hit strip — the invisible `<rect>` that raises
   * the hover label for one month.
   */
  netWorthHitStrip(index: number): Locator {
    return this.netWorthSection.locator('svg[role="img"] rect[fill="transparent"]').nth(index);
  }

  /**
   * The Net worth chart's hovered-month caption.
   *
   * It replaces the "Hover any bar …" hint while a bar is hovered, so
   * its presence IS the hover signal.
   */
  get netWorthHoveredCaption(): Locator {
    return this.netWorthSection.locator('div.text-\\[11px\\].text-muted.mt-2.tabular');
  }

  /**
   * Hover one month of the net-worth chart.
   *
   * The hit strip is painted first, so the bar sits on top of it and
   * would swallow the pointer. The strip spans the whole month
   * column, so the pointer lands at the column's left edge — clear
   * of the bar, still inside the strip.
   */
  async hoverNetWorthMonth(index: number): Promise<void> {
    const strip = this.netWorthHitStrip(index);
    const box = await strip.boundingBox();
    if (!box) throw new Error(`Net-worth hit strip ${index} has no bounding box`);
    await strip.hover({ position: { x: 2, y: Math.round(box.height / 2) } });
    await expect(this.netWorthHoveredCaption).toBeVisible();
  }

  /** The "Trends" card heading. */
  get trendsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Trends' });
  }

  /** The Trends card's sub-line — "Aggregates over the chosen range". */
  get trendsSubLine(): Locator {
    return this.page.getByText('Aggregates over the chosen range', { exact: true });
  }

  /** The Trends card's footnote. */
  get trendsFootnote(): Locator {
    return this.trendsSection.getByText(
      'Goal / Debt / Investment lists live on their own screens',
      { exact: true },
    );
  }

  /** The Trends footnote's cross-links. */
  get trendsFootnoteLinks(): Locator {
    return this.trendsSection.getByRole('link');
  }

  /** A Trends footnote link, by its label. */
  trendsFootnoteLink(label: 'Goals' | 'Debts' | 'Investments'): Locator {
    return this.trendsSection.getByRole('link', { name: label, exact: true });
  }

  /**
   * A heading with an exact accessible name.
   *
   * The Insight screen is asserted for the widgets it does NOT
   * render — Goals, Debts and Investments each get their own screen
   * — so the absence of a heading by name is the assertion.
   */
  headingNamed(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }

  /** Go to the Insights screen. */
  async goto(): Promise<void> {
    await this.gotoRoute('/insights');
    await this.waitForAppReady();
  }

  /**
   * Pick a date range.
   *
   * The pills are plain buttons with `aria-pressed`, so there is no
   * "selected" role to wait on — the section `aria-label` changes with
   * the range, and that is the reliable signal.
   */
  async selectRange(label: RangeLabel): Promise<void> {
    await this.rangePill(label).click();
    await this.trendsSection.waitFor({ state: 'visible' });
  }
}
