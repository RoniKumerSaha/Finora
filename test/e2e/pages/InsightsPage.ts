/**
 * InsightsPage — `/insights`.
 *
 * `src/screens/InsightsScreen.tsx`:
 *   - H1 is "Insight" (singular) — the nav label matches, but the
 *     Home link says "See full Insights →".
 *   - five range pills: This month · Last 3 months · Last 6 months ·
 *     Last 12 months · All time. The default is "Last 6 months" and
 *     the choice persists to `localStorage["finora.insights.range"]`.
 *   - four labelled sections: `Cash flow over {range}`,
 *     `Net worth over {range}`, `Monthly statement over {range}` and
 *     the Investments/Loans row (which carries no aria-label).
 *   - the "What stands out" card renders a generated feed of insights.
 *   - the "Where your money sits" card is a donut of the net worth.
 *   - the Investments and Loans cards summarise those two areas.
 *   - the Monthly statement is a fixed Jan–Dec calendar of 12 rows.
 */
import { type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export type RangeLabel =
  | 'This month'
  | 'Last 3 months'
  | 'Last 6 months'
  | 'Last 12 months'
  | 'All time';

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

  /** The "Net worth over {range}" section — now the composition donut. */
  get netWorthSection(): Locator {
    return this.page.locator('section[aria-label^="Net worth over"]');
  }

  /** The "Monthly statement over {range}" section. */
  get statementSection(): Locator {
    return this.page.locator('section[aria-label^="Monthly statement over"]');
  }

  // ---------- Cash flow ----------

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

  // ---------- "What stands out" feed ----------

  /** The "What stands out" card heading. */
  get insightFeedHeading(): Locator {
    return this.page.getByRole('heading', { name: 'What stands out' });
  }

  /** The feed's sub-line. */
  get insightFeedSubLine(): Locator {
    return this.page.getByText('Generated from the chosen range', { exact: true });
  }

  /** Every insight in the feed. */
  get insightItems(): Locator {
    return this.page.locator('[data-insight-item]');
  }

  /** One insight in the feed, by its heading text. */
  insightItem(label: string): Locator {
    return this.page.locator('[data-insight-item]').filter({ hasText: label });
  }

  // ---------- Composition donut ----------

  /** The "Where your money sits" card heading. */
  get compositionHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Where your money sits' });
  }

  /** The composition donut's SVG. */
  get compositionRing(): Locator {
    return this.page.locator('[data-composition-ring]');
  }

  /** Every slice in the donut legend. */
  get compositionSlices(): Locator {
    return this.page.locator('[data-composition-slice]');
  }

  /** One slice of the donut legend, by its key (cash, savings, ...). */
  compositionSlice(key: string): Locator {
    return this.page.locator(`[data-composition-slice="${key}"]`);
  }

  /** The donut's core figure — the net worth. */
  get compositionCoreValue(): Locator {
    return this.page.locator('[data-composition-ring]').locator('text');
  }

  /** The closing sentence under the donut. */
  get compositionSummary(): Locator {
    return this.netWorthSection.getByText(/Cash covers \d+% of what you own\./);
  }

  // ---------- Investments ----------

  /** The "Investments" card heading. */
  get investmentsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Investments' });
  }

  /** The Investments card's scheme rows. */
  get investmentRows(): Locator {
    return this.page.locator('[data-investment-row]');
  }

  /** The Investments card's "See all" link. */
  get investmentsSeeAll(): Locator {
    return this.page.getByRole('link', { name: 'See all', exact: true });
  }

  /** The Investments card's "+N more schemes" line, when it renders. */
  get investmentsMoreLine(): Locator {
    return this.page.getByText(/^\+\d+ more scheme/, { exact: false });
  }

  // ---------- Loans ----------

  /** The "Loans" card heading. */
  get loansHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Loans' });
  }

  /** The Loans card's loan rows. */
  get loanRows(): Locator {
    return this.page.locator('[data-loan-row]');
  }

  /** The Loans card's "+N more loans" line, when it renders. */
  get loansMoreLine(): Locator {
    return this.page.getByText(/^\+\d+ more loan/, { exact: false });
  }

  // ---------- Monthly statement ----------

  /** The "Monthly statement" card heading. */
  get statementHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Monthly statement' });
  }

  /** Every row of the Monthly statement. */
  get statementRows(): Locator {
    return this.page.locator('[data-statement-row]');
  }

  /** One row of the Monthly statement, by its "Mon YYYY" label. */
  statementRow(label: string): Locator {
    return this.page.locator(`[data-statement-row="${label}"]`);
  }

  /** The Monthly statement's Flow bars — one per row. */
  get flowBars(): Locator {
    return this.page.locator('[data-flow-bar]');
  }

  /** One row's Flow bar. */
  flowBar(label: string): Locator {
    return this.page.locator(`[data-statement-row="${label}"]`).locator('[data-flow-bar]');
  }

  /**
   * The zero AXIS of a row's Flow bar.
   *
   * The Flow column is a diverging bar: the axis is the zero line the
   * green and red grow out of, and it renders on every row.
   */
  flowAxis(label: string): Locator {
    return this.flowBar(label).locator('[data-flow-axis]');
  }

  /**
   * The SAVING blocks of a row's Flow meter — the green ones, which
   * grow RIGHT from the zero axis.
   *
   * The Flow column shows the month's NET, so a row has blocks on the
   * saving side, on the overspend side, or on neither — never both.
   */
  flowSavingsSegment(label: string): Locator {
    return this.flowBar(label).locator('[data-flow-side="savings"] i.on');
  }

  /**
   * The OVERSPEND blocks of a row's Flow meter — the red ones, which
   * grow LEFT from the zero axis.
   */
  flowOverspendSegment(label: string): Locator {
    return this.flowBar(label).locator('[data-flow-side="overspend"] i.on');
  }

  /**
   * Every slot on a row's Flow meter — filled blocks and empty
   * ghosts alike.
   */
  flowSlots(label: string): Locator {
    return this.flowBar(label).locator('i');
  }

  /**
   * The filled blocks on a row's Flow meter, whichever side they are on.
   */
  flowFilledBlocks(label: string): Locator {
    return this.flowBar(label).locator('i.on');
  }

  /** The Monthly statement's "Total" row. */
  get statementTotalRow(): Locator {
    return this.statementSection.getByText('Total', { exact: true }).locator('..');
  }

  /**
   * A heading with an exact accessible name.
   *
   * The Insight screen is asserted for the widgets it does NOT
   * render, so the absence of a heading by name is the assertion.
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
    await this.cashFlowSection.waitFor({ state: 'visible' });
  }
}
