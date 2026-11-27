/**
 * HomePage — `/home`.
 *
 * `src/screens/HomeScreen.tsx`:
 *   - H1 "Where is my money?" and a meta line
 *     "Net worth · across N accounts · updated just now".
 *   - a STATUS BAR: the "Net worth" headline with the figure, the
 *     caption "Assets minus liabilities" (or "Liabilities exceed
 *     assets"), the "vs last month" delta and the projection.
 *   - four stat cells beside it: "Cash", "Investments",
 *     "Receivables", "Debts" — each a label + figure + hint.
 *   - a "Recent activity" ledger board, then the
 *     "See full Insights →" link.
 *
 * 2026-11-24 (Variant H — The board): the "Accounts" preview card and
 * the "This month" card were removed — every figure they held now
 * lives in the status bar — so their locators went with them.
 *
 * The stat cells render label / value / hint as three siblings, so a
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
    return this.page.locator('div.t-30').first();
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

  /**
   * The "This month" card.
   *
   * Removed from Home on 2026-11-24 (Variant H — The board) — the
   * locator stays so the suite can assert the card is ABSENT.
   */
  get thisMonthCard(): Locator {
    return this.page.locator('div.card').filter({ hasText: 'This month' }).first();
  }

  /**
   * The "Accounts" preview card.
   *
   * Removed from Home on 2026-11-24 (Variant H — The board) — the
   * locator stays so the suite can assert the card is ABSENT.
   */
  get accountsCard(): Locator {
    return this.page.locator('section.card').filter({ hasText: 'Manage →' }).first();
  }

  /** The "Recent activity" ledger board. */
  get recentActivityCard(): Locator {
    return this.page.locator('section.card').filter({ hasText: 'View all' }).first();
  }

  /** The "See full Insights →" link. */
  get seeFullInsightsLink(): Locator {
    return this.page.getByRole('link', { name: 'See full Insights →' });
  }

  /**
   * A row in the Recent activity board, by its title.
   *
   * `BoardRow` renders a `div.group` wrapper: a left column (icon +
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

  /**
   * A recent-activity row's relative-date + account line.
   *
   * ⚠️ The board is five columns wide, and four of them render a
   * `t-12 text-muted` cell — the subtitle, the Date, the Account and
   * the Category. `leading-tight` is the discriminator: only the
   * subtitle carries it (the title above it carries `font-semibold`,
   * so it never matches `text-muted`).
   */
  activitySubtitle(title: string): Locator {
    return this.activityRow(title).locator('div.t-12.text-muted.leading-tight');
  }

  /** Every recent-activity row. */
  get activityRows(): Locator {
    return this.recentActivityCard.locator('div.group');
  }

  /**
   * The empty-state title inside a Home card.
   *
   * The shared `EmptyState` renders its title in a `heading h4-item`
   * block. Scoping on that class disambiguates the title from a strip
   * hint that happens to carry the same copy ("No accounts yet").
   */
  emptyStateTitle(title: string): Locator {
    return this.page.locator('div.heading.h4-item.text-ink').filter({
      hasText: title,
    });
  }

  /** The onboarding banner — only rendered when onboarding is incomplete. */
  get onboardingBanner(): Locator {
    return this.page.getByText('Welcome to Finora.', { exact: false });
  }

  /**
   * A figure from the status bar's stat cells, by its label.
   *
   * The label, value and hint are three siblings inside the cell.
   */
  stripValue(label: StripLabel): Locator {
    return this.page
      .getByText(label, { exact: true })
      .locator('..')
      .locator('div.t-18');
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
      .locator('div.t-11');
  }

  /** Go to the Home screen. */
  async goto(): Promise<void> {
    await this.gotoRoute('/home');
    await this.waitForAppReady();
  }
}
