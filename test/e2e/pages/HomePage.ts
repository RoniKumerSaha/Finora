/**
 * HomePage — `/home`.
 *
 * `src/screens/HomeScreen.tsx`:
 *   - H1 "Where is my money?" and a meta line
 *     "Net worth · across N accounts · updated just now".
 *   - a "Net worth" hero with the figure and the caption
 *     "Assets minus liabilities" (or "Liabilities exceed assets").
 *   - a "This month" card with "Income", "Expenses" and "Net saved".
 *   - a four-cell strip: "Cash", "Receivables", "Debts",
 *     "Investments" — each a label + figure + hint.
 *   - "Accounts" and "Recent activity" cards, then the
 *     "See full Insights →" link.
 *
 * The strip cells render label / value / hint as three siblings, so a
 * figure is reached through the label's parent.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export type StripLabel = 'Cash' | 'Receivables' | 'Debts' | 'Investments';

export class HomePage extends BasePage {
  /** The screen's H1 — "Where is my money?". */
  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /**
   * The meta line under the H1.
   *
   * "Net worth · across N accounts · updated just now" — note the
   * account count is singular/plural-aware in the app.
   */
  get metaLine(): Locator {
    return this.page.getByText(/^Net worth · across \d+ account/, { exact: false });
  }

  /** The hero's "Net worth" caption. */
  get netWorthLabel(): Locator {
    return this.page.getByText('Net worth', { exact: true });
  }

  /** The hero's net-worth figure. */
  get netWorthFigure(): Locator {
    return this.page.locator('div.text-\\[44px\\], div.text-\\[52px\\]').first();
  }

  /**
   * A text node with an exact string.
   *
   * The Home hero carries the projection label and caption as plain
   * text, so they are read through an exact-text lookup rather than
   * a structural selector.
   */
  textExact(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  /**
   * The hero's "vs last month" delta caption.
   *
   * The row is dropped entirely when the delta is zero, so this
   * locator only exists when there IS a change.
   */
  get netWorthDeltaCaption(): Locator {
    return this.page.getByText('vs last month', { exact: true });
  }

  /**
   * The hero's "Liabilities exceed assets" caption.
   *
   * It replaces "Assets minus liabilities" when net worth is
   * negative, so the two captions are mutually exclusive.
   */
  get liabilitiesCaption(): Locator {
    return this.page.getByText('Liabilities exceed assets', { exact: true });
  }

  /** The hero's sub-caption under the figure. */
  get netWorthCaption(): Locator {
    return this.page.getByText('Assets minus liabilities', { exact: true });
  }

  /**
   * The hero's projection column.
   *
   * It only renders when the projected net worth exceeds the current
   * one, so the label is the anchor.
   */
  get projectionLabel(): Locator {
    return this.page.getByText('Projection', { exact: true });
  }

  /** The hero's "at maturity" caption under the projection. */
  get projectionCaption(): Locator {
    return this.page.getByText('at maturity', { exact: true });
  }

  /** The "This month" card. */
  get thisMonthCard(): Locator {
    return this.page.locator('div.card').filter({ hasText: 'This month' }).first();
  }

  /**
   * A figure from the "This month" card, by its row label.
   *
   * "Income", "Expenses" and "Net saved" each sit in a flex row next
   * to their figure. The row's parent holds BOTH the label's own
   * `<span>` and the figure's `<span>`, so the figure is picked out
   * by its own type — the label is `text-[13px]`, the figure is
   * `text-[17px]`.
   */
  thisMonthValue(label: 'Income' | 'Expenses' | 'Net saved'): Locator {
    return this.thisMonthCard
      .getByText(label, { exact: true })
      .locator('..')
      .locator('span.text-\\[17px\\]');
  }

  /** The "This month" card's footer — the month label and the entry count. */
  get thisMonthFooter(): Locator {
    return this.thisMonthCard.locator('div.border-t');
  }

  /** The "Accounts" preview card. */
  get accountsCard(): Locator {
    return this.page.locator('section.card').filter({ hasText: 'Manage →' }).first();
  }

  /** The "Recent activity" card. */
  get recentActivityCard(): Locator {
    return this.page.locator('section.card').filter({ hasText: 'View all' }).first();
  }

  /** The "See full Insights →" link. */
  get seeFullInsightsLink(): Locator {
    return this.page.getByRole('link', { name: 'See full Insights →' });
  }

  /**
   * An account row in the Accounts preview, by name.
   *
   * `AcctRow` renders a flex line: a left column (icon + name + type)
   * and the balance as its sibling. The row is found by the name's
   * own text rather than by counting levels, so a markup change in
   * the left column cannot silently re-target the balance.
   */
  accountRow(name: string): Locator {
    return this.accountsCard
      .locator('div.flex.justify-between.items-center.py-3')
      .filter({ hasText: name })
      .first();
  }

  /** An account row's balance figure. */
  accountBalance(name: string): Locator {
    return this.accountRow(name).locator('div.font-bold.tabular');
  }

  /** An account row's type label — "Bank Account", "Card", … */
  accountTypeLabel(name: string): Locator {
    return this.accountRow(name).locator('div.text-xs.text-muted');
  }

  /**
   * A row in the Recent activity preview, by its title.
   *
   * `TxRow` renders a `div.group` wrapper: a left column (icon +
   * title + date) and the amount as its sibling. The title text sits
   * inside a `<span>` four levels below the wrapper, so the wrapper
   * is found by its own `group` class rather than by counting.
   */
  activityRow(title: string): Locator {
    return this.recentActivityCard
      .locator('div.group')
      .filter({ hasText: title })
      .first();
  }

  /** A recent-activity row's amount figure. */
  activityAmount(title: string): Locator {
    return this.activityRow(title).locator('div.font-bold.tabular');
  }

  /** A recent-activity row's relative-date + account line. */
  activitySubtitle(title: string): Locator {
    return this.activityRow(title).locator('div.text-xs.text-muted');
  }

  /** Every recent-activity row. */
  get activityRows(): Locator {
    return this.recentActivityCard.locator('div.group');
  }

  /**
   * The empty-state title inside a Home card.
   *
   * The shared `EmptyState` renders its title in a `text-[15px]`
   * block. Scoping on that class disambiguates the title from a strip
   * hint that happens to carry the same copy ("No accounts yet").
   */
  emptyStateTitle(title: string): Locator {
    return this.page.locator('div.text-\\[15px\\].font-semibold.text-ink').filter({
      hasText: title,
    });
  }

  /** The onboarding banner — only rendered when onboarding is incomplete. */
  get onboardingBanner(): Locator {
    return this.page.getByText('Welcome to Finora.', { exact: false });
  }

  /**
   * A figure from the four-cell strip, by its label.
   *
   * The label, value and hint are three siblings inside the cell.
   */
  stripValue(label: StripLabel): Locator {
    return this.page
      .getByText(label, { exact: true })
      .locator('..')
      .locator('div.text-\\[20px\\], div.text-\\[22px\\]');
  }

  /**
   * A strip cell's hint line — "Sum of money across 4 accounts",
   * "no money owed to you", "none yet", …
   *
   * The hint is the cell's third child, so the label's parent's
   * next sibling is the hint.
   */
  stripHint(label: StripLabel): Locator {
    return this.page
      .getByText(label, { exact: true })
      .locator('..')
      .locator('div.text-\\[11\\.5px\\]');
  }

  /** Go to the Home screen. */
  async goto(): Promise<void> {
    await this.gotoRoute('/home');
    await this.waitForAppReady();
  }
}
