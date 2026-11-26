/**
 * PlanPage — the planner hub (`/plan`) and the Month Plan
 * (`/plan/month`).
 *
 * `src/screens/PlanScreen.tsx` is a hub of four PAPERS:
 * Investments · Loans · This month · Events. Each is a
 * `section.plan-paper` holding one link, a head (the planner's name
 * and its serial line), the planner's item lines, and a closing
 * tally — the one number the planner is really about.
 * The footer carries the "Plans are pure scratch" disclaimer.
 *
 * `src/screens/MonthPlanScreen.tsx` is the biggest planner screen:
 *   - a "← Plans" back link,
 *   - the H1 "Plan my month" and its "Changes save as you go" sub-line,
 *   - a "N card(s) in plan" count chip (only when there are items),
 *   - the "Your items" grid, whose cards open a per-item editor modal,
 *   - a "Select multiple" toggle that turns the grid into a
 *     multi-select, and a floating bar with "Select all" / "Clear" /
 *     "Edit budgets",
 *   - the batch editor modal, whose `role="tablist"` is labelled
 *     "Batch mode" and holds four tabs: Custom amounts · Same amount ·
 *     Adjust % · Clear.
 *
 * There is **no month selector** and **no rollover** — the screen
 * always edits the current month.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export type PlanHubRow = 'Investments' | 'Loans' | 'This month' | 'Events';

export type BatchMode = 'Custom amounts' | 'Same amount' | 'Adjust %' | 'Clear';

export class PlanPage extends BasePage {
  // ── Hub ──

  /** The hub's H1. */
  get hubHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Plan' });
  }

  /** The hub's sub-line. */
  get hubSubLine(): Locator {
    return this.page.getByText(
      'Scratchpads for what you intend to spend. Nothing here is recorded in your ledger — it\'s a way to think ahead.',
      { exact: true },
    );
  }

  /** The hub's "pure scratch" footer. */
  get scratchFooter(): Locator {
    return this.page.getByText(
      'ⓘ Plans are pure scratch — switch tabs, swap emoji, abandon mid-edit. Nothing here touches your real accounts or transactions.',
      { exact: true },
    );
  }

  /** All four hub papers. */
  get hubRows(): Locator {
    return this.page.locator('section.plan-paper');
  }

  /**
   * A hub paper, by its planner name.
   *
   * The paper's own link carries an `aria-label` of "{name} — open
   * the planner", so the sheet is found through its NAME in the
   * head rather than through the link's label.
   */
  hubRow(title: PlanHubRow): Locator {
    return this.page
      .locator('section.plan-paper')
      .filter({ has: this.page.getByText(title, { exact: true }) })
      .first();
  }

  /**
   * A hub paper's link — the whole sheet is one click target.
   */
  hubRowLink(title: PlanHubRow): Locator {
    return this.hubRow(title).locator('a.plan-paper__link');
  }

  /** A hub paper's headline number — the sheet's closing tally. */
  hubRowNumber(title: PlanHubRow): Locator {
    return this.hubRow(title).locator('.plan-paper__tally .v');
  }

  /**
   * A hub paper's number caption — "Projected at maturity",
   * "Monthly EMI", "Budgeted", "Next event".
   */
  hubRowSuffix(title: PlanHubRow): Locator {
    return this.hubRow(title).locator('.plan-paper__tally .k');
  }

  /**
   * A hub paper's serial line — "3 PLANS · SCRATCHPAD".
   */
  hubRowSubLine(title: PlanHubRow): Locator {
    return this.hubRow(title).locator('.plan-paper__serial');
  }

  /** A hub paper's item lines — one per plan, projection or event. */
  hubRowLines(title: PlanHubRow): Locator {
    return this.hubRow(title).locator('.plan-paper__line');
  }

  // ── Month Plan ──

  /** The "← Plans" back link. */
  get backLink(): Locator {
    return this.page.getByRole('button', { name: '← Plans' });
  }

  /** The Month Plan's H1. */
  get monthHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Plan my month' });
  }

  /** The Month Plan's sub-line. */
  get monthSubLine(): Locator {
    return this.page.getByText(
      'Fill the items with budgets for what you intend to spend. Changes save as you go.',
      { exact: true },
    );
  }

  /**
   * The "N card(s) in plan" count chip.
   *
   * The number and the words are SEPARATE nodes — `<b>{n}</b>` then
   * `<span>card{s} in plan</span>` — so there is no contiguous
   * "2 cards in plan" string to match. Scope to the wrapper.
   */
  get cardCountChip(): Locator {
    return this.page.locator('span.ml-1').filter({ hasText: /cards? in plan/ });
  }

  /** The count chip's number. */
  get cardCountNumber(): Locator {
    return this.cardCountChip.locator('xpath=preceding-sibling::b[1]');
  }

  /** The "Your items" section label. */
  get itemsSectionLabel(): Locator {
    return this.page.getByText('Your items', { exact: true });
  }

  /** The "· Tap cards to select" hint (only in selection mode). */
  get tapToSelectHint(): Locator {
    return this.page.getByText('· Tap cards to select', { exact: true });
  }

  /** The Month Plan's footer hint. */
  get monthFooter(): Locator {
    return this.page.getByText(
      'ⓘ Tap an item to edit it in a pop-up. Changes save automatically.',
      { exact: true },
    );
  }

  /** The "New item" dashed button. */
  get addNewItemButton(): Locator {
    return this.page.getByRole('button', { name: 'Add new item' });
  }

  /** The "Select multiple" toggle. */
  get selectMultipleToggle(): Locator {
    return this.page.getByRole('button', { name: /Select multiple|Selecting cards…|of \d+ selected/ });
  }

  /**
   * The selection toggle's count — "N of M selected".
   *
   * The toggle's label IS the count once selection starts, so the
   * toggle itself is the locator.
   */
  get selectionCountLine(): Locator {
    return this.page.getByRole('button', { name: /\d+ of \d+ selected/ });
  }

  /**
   * The floating bar's "N cards selected" headline.
   *
   * It reads "Tap cards to select" before anything is picked and
   * "card selected" / "cards selected" afterwards.
   */
  get floatingBarCount(): Locator {
    return this.page.getByText(/^(Tap cards to select|cards? selected)$/, { exact: true });
  }

  /** The floating bar's "Select all" button. */
  get selectAllButton(): Locator {
    return this.page.getByRole('button', { name: /Select all|All selected/ });
  }

  /** The floating bar's "Clear" button. */
  get clearSelectionButton(): Locator {
    return this.page.getByRole('button', { name: 'Clear', exact: true });
  }

  /** The floating bar's "Edit budgets" CTA. */
  get editBudgetsButton(): Locator {
    return this.page.getByRole('button', { name: 'Edit budgets' });
  }

  /** The "Exit selection mode" button. */
  get exitSelectionButton(): Locator {
    return this.page.getByRole('button', { name: 'Exit selection mode' });
  }

  /**
   * The "Your items" grid — the container the item cards live in.
   *
   * ⚠️ The Month Plan screen ALSO renders a "preset cards" panel of
   * one-tap template items (`PresetBudgetCards`) whose buttons carry
   * the same names — "Groceries" is one of them. A bare
   * `getByRole('button').filter({ hasText: name })` matches the preset
   * button first, so every card locator is scoped to this grid.
   */
  get itemsGrid(): Locator {
    return this.page
      .locator('div.rounded-card.border.border-border')
      .filter({ has: this.page.getByText('Your items', { exact: true }) });
  }

  /**
   * A plan card in the items grid, by its name.
   *
   * The card is a `<button>` whose body holds the name and the budget
   * figure. Match on the button so the click target is the card
   * itself, not a text node inside it.
   */
  card(name: string): Locator {
    return this.itemsGrid.getByRole('button').filter({ hasText: name }).first();
  }

  /** The "Delete {name}" hover button on a plan card. */
  deleteCardButton(name: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${name}` });
  }

  // ── New-item modal ──

  get newItemDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  get newItemTitle(): Locator {
    return this.newItemDialog.getByRole('heading', { name: 'Add new item' });
  }

  get newItemBody(): Locator {
    return this.newItemDialog.getByText(
      'Pick an icon, name the item, set the budget. You can edit the budget later.',
      { exact: true },
    );
  }

  get newItemNameInput(): Locator {
    return this.newItemDialog.getByLabel('Name');
  }

  get newItemBudgetInput(): Locator {
    return this.newItemDialog.getByLabel('Budget (optional)');
  }

  get saveItemButton(): Locator {
    return this.newItemDialog.getByRole('button', { name: 'Save item' });
  }

  get cancelItemButton(): Locator {
    return this.newItemDialog.getByRole('button', { name: 'Cancel', exact: true });
  }

  // ── Per-item editor modal ──

  /** The per-item budget editor's dialog. */
  get editorDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  get editorBudgetInput(): Locator {
    return this.editorDialog.getByLabel('Budget', { exact: true });
  }

  get clearBudgetButton(): Locator {
    return this.editorDialog.getByRole('button', { name: 'Clear budget' });
  }

  get saveEditorButton(): Locator {
    return this.editorDialog.getByRole('button', { name: 'Save', exact: true });
  }

  get removeItemButton(): Locator {
    return this.editorDialog.getByRole('button', { name: 'Remove item' });
  }

  get doneWithItemLabel(): Locator {
    return this.editorDialog.getByText('Done with this item?', { exact: true });
  }

  // ── Batch editor ──

  /** The batch editor's "Batch mode" tablist. */
  get batchTablist(): Locator {
    return this.page.getByRole('tablist', { name: 'Batch mode' });
  }

  /** A batch-mode tab, by its label. */
  batchTab(label: BatchMode): Locator {
    return this.batchTablist.getByRole('tab', { name: label, exact: true });
  }

  /** The batch editor's "New budget" / "Percentage change" input. */
  get batchAmountInput(): Locator {
    return this.page.getByLabel('New budget');
  }

  get batchPercentInput(): Locator {
    return this.page.getByLabel('Percentage change');
  }

  /** The batch editor sheet's heading. */
  get batchSheetTitle(): Locator {
    return this.page.getByRole('heading', { name: 'Batch update budget' });
  }

  /** The sheet's "Nothing is selected" message. */
  get batchNothingSelected(): Locator {
    return this.page.getByText(
      'Nothing is selected. Pick a few cards first, then come back here.',
      { exact: true },
    );
  }

  /**
   * The sheet's apply button — "Apply to {n} card" / "Apply to {n} cards".
   *
   * ⚠️ The manual plan writes the label as "Apply to {n} card(s)",
   * but the app pluralises properly: "Apply to 1 card" and "Apply to
   * 2 cards". The locator therefore matches the real wording.
   */
  get batchApplyButton(): Locator {
    return this.page.getByRole('button', { name: /Apply to \d+ cards?$/ });
  }

  /** A per-card budget input in the custom mode. */
  batchCardBudgetInput(name: string): Locator {
    return this.page.getByLabel(`New budget for ${name}`);
  }

  /** The custom mode's "Clear all" button. */
  get batchClearAllButton(): Locator {
    return this.page.getByRole('button', { name: 'Clear all', exact: true });
  }

  /** The custom mode's "Fill all with…" button. */
  get batchFillAllButton(): Locator {
    return this.page.getByRole('button', { name: 'Fill all with…', exact: true });
  }

  /** The "Fill all with…" amount input (only present once expanded). */
  get batchFillAllInput(): Locator {
    return this.page.getByLabel('Fill all with');
  }

  /** The custom mode's helper line. */
  get batchCustomHelper(): Locator {
    return this.page.getByText(
      'Type a new budget for each card. Leave blank to skip that card.',
      { exact: true },
    );
  }

  // ── Quick-total checker ──

  /** The "Quick total" card's section. */
  get quickTotalCard(): Locator {
    return this.page.locator('section[aria-labelledby="card-checker-title"]');
  }

  /** The card's "Quick total" eyebrow label. */
  get quickTotalLabel(): Locator {
    return this.quickTotalCard.getByText('Quick total', { exact: true });
  }

  /** The card's heading — "Check the cards you'll pay". */
  get quickTotalTitle(): Locator {
    return this.page.locator('#card-checker-title');
  }

  /** The card's sub-line. */
  get quickTotalSubLine(): Locator {
    return this.page.getByText('Check the cards you\'ll pay', { exact: true });
  }

  /** The card's explanation line. */
  get quickTotalExplanation(): Locator {
    return this.page.getByText(
      'Tick items, set your income, see how much you\'d save (or overspend). Nothing is saved.',
      { exact: true },
    );
  }

  /** The card's income input. */
  get quickTotalIncomeInput(): Locator {
    return this.page.getByLabel('Income');
  }

  /**
   * Type an income into the quick-total checker.
   *
   * `IncomeInput` keeps a local string draft and commits it on Enter
   * or on blur — filling the field alone changes nothing the card
   * reads. Pressing Enter is the path a real user takes.
   */
  async setQuickTotalIncome(amount: string): Promise<void> {
    await this.quickTotalIncomeInput.fill(amount);
    await this.quickTotalIncomeInput.press('Enter');
  }

  /** The card's "Clear selection" button. */
  get quickTotalClearSelectionButton(): Locator {
    return this.page.getByRole('button', { name: 'Clear selection' });
  }

  /** The card's empty state. */
  get quickTotalEmptyState(): Locator {
    return this.page.getByText(
      'No items in this month\'s plan yet — open the planner to start.',
      { exact: true },
    );
  }

  /**
   * The card's footer count — "N of M selected".
   *
   * The number and the words are separate nodes — `<b>{n}</b>` then
   * `<span class="ml-1">of {m} selected</span>` — so there is no
   * contiguous "2 of 5 selected" string to match.
   */
  get quickTotalSelectionCount(): Locator {
    return this.quickTotalCard
      .locator('span.ml-1')
      .filter({ hasText: /of \d+ selected/ })
      .locator('xpath=preceding-sibling::b[1]');
  }

  /** The card's footer caption — "of M selected". */
  get quickTotalSelectionCaption(): Locator {
    return this.quickTotalCard.locator('span.ml-1').filter({ hasText: /of \d+ selected/ });
  }

  /** The card's "Total ৳X" figure. */
  get quickTotalTotal(): Locator {
    return this.quickTotalCard.getByText(/^Total/).first();
  }

  /** The card's "Saved ৳X" figure — absent when the selection overspends. */
  get quickTotalSaved(): Locator {
    return this.quickTotalCard.getByText(/^Saved/).first();
  }

  /** The card's "Over by ৳X" figure. */
  get quickTotalOverBy(): Locator {
    return this.quickTotalCard.getByText(/^Over by/).first();
  }

  /** A tickable item chip in the card. */
  quickTotalItem(name: string): Locator {
    return this.quickTotalCard.getByRole('checkbox').filter({ hasText: name });
  }

  // ── navigation ──

  async gotoHub(): Promise<void> {
    await this.gotoRoute('/plan');
    await this.waitForAppReady();
  }

  async gotoMonth(): Promise<void> {
    await this.gotoRoute('/plan/month');
    await this.waitForAppReady();
  }

  /**
   * Open the "Add new item" modal.
   *
   * The button is aria-labelled "Add new item" but renders the text
   * "New item", so the label — not the text — is the reliable hook.
   */
  async openNewItemModal(): Promise<void> {
    await this.addNewItemButton.click();
    await this.newItemDialog.waitFor({ state: 'visible' });
  }

  /** Create a plan item and wait for the modal to close. */
  async addItem(name: string, budget?: string): Promise<void> {
    await this.openNewItemModal();
    await this.newItemNameInput.fill(name);
    if (budget !== undefined) {
      await this.newItemBudgetInput.fill(budget);
    }
    await this.saveItemButton.click();
    await this.newItemDialog.waitFor({ state: 'detached' });
  }

  /**
   * Open the per-item editor for a card.
   *
   * The card's own text is the click target — the grid has no
   * dedicated "edit" button.
   */
  async openItemEditor(name: string): Promise<void> {
    await this.card(name).click();
    await this.editorDialog.waitFor({ state: 'visible' });
  }
}
