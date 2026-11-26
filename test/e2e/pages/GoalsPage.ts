/**
 * GoalsPage — `/goals`, `/goals/add` and `/goals/:id` (detail + edit).
 *
 * `src/screens/GoalsListScreen.tsx`:
 *   - one `<a class="goal-receipt card-link">` per goal, each a
 *     till receipt: the goal's name in caps at the top-left, a
 *     status STAMP at the top-right ("Open" / "Overdue" / "Done"),
 *     then the line items TARGET / SAVED / PROGRESS / DUE, then
 *     the dashed rule and the total "STILL NEEDED", then the
 *     footnote (the per-month ask) and the pace line.
 *   - the PROGRESS figure carries `role="progressbar"`.
 *   - the empty state is the shared `EmptyState` (illustration, title
 *     "Save toward something", CTA "+ New goal", learn-more link).
 *
 * `src/screens/GoalAddScreen.tsx` — fields "Name", "Already saved",
 * "Target amount", "Target date"; the submit button says "Save goal".
 *
 * `src/screens/GoalDetailScreen.tsx` — the H1 is the goal's name, and
 * the page below it is a bundle of RECEIPTS: the statement receipt
 * (saved / target / remaining / target date, the fill line, and the
 * per-month total), the "By the numbers" receipt, the edit pass, and
 * the contribution history receipt. The receipt's tone follows the
 * goal — mint while it runs, sage once reached, coral once overdue.
 * Contributions live in a `role="dialog"` modal titled
 * "Add a contribution" with fields Amount / Date / Note (optional).
 * Delete lives in a "Danger zone" section.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class GoalsPage extends BasePage {
  /**
   * The "Add" link in the list header.
   *
   * The link's content is a "+" span plus an "Add" span, so its
   * accessible name is "+ Add".
   */
  get addButton(): Locator {
    return this.page.getByRole('link', { name: '+ Add', exact: true });
  }

  /** All goal cards. */
  get cards(): Locator {
    return this.page.locator('a.goal-receipt');
  }

  /** A goal card, by its name. */
  card(name: string): Locator {
    return this.page.locator('a.goal-receipt').filter({ hasText: name }).first();
  }

  /** The empty-state CTA. */
  get emptyStateCta(): Locator {
    return this.page.getByRole('link', { name: '+ New goal' });
  }

  /** The learn-more link on the shared empty state. */
  get learnMoreLink(): Locator {
    return this.page.getByRole('button', { name: 'How goals work →' });
  }

  // ── Card anatomy ──

  /**
   * A card's PROGRESS figure — "62%".
   *
   * The receipt has no percent PILL and no separate bar: the
   * PROGRESS line's figure IS the percentage, and it carries
   * `role="progressbar"` so the value is still announced.
   */
  percentChip(name: string): Locator {
    return this.card(name).getByRole('progressbar');
  }

  /** A card's progress bar — the same element as `percentChip`. */
  progressBar(name: string): Locator {
    return this.card(name).getByRole('progressbar');
  }

  /**
   * A card's status STAMP — "Open", "Overdue" or "Done".
   *
   * It is the tilted, bordered label at the top-right of the
   * receipt.
   */
  stamp(name: string): Locator {
    return this.card(name).locator('.goal-receipt__stamp');
  }

  /**
   * A card's pace line — "Pace: Ahead".
   *
   * The line is hidden entirely when the pace is on-track,
   * completed or expired.
   */
  paceLine(name: string): Locator {
    return this.card(name).getByText('Pace:', { exact: false });
  }

  /**
   * A card's overdue marker — the receipt's footnote.
   *
   * An expired goal has no finite per-month requirement, so the
   * footnote says "Overdue — no monthly plan" INSTEAD of a
   * per-month figure. It is scoped to the footnote block so it does
   * not match the "Overdue" stamp in the header.
   */
  overdueLine(name: string): Locator {
    return this.card(name).locator('.goal-receipt__pace').getByText('Overdue');
  }

  /**
   * A card's "Still needed" total.
   *
   * The receipt's bottom line — `৳ 40,000` — sits under a label
   * that reads "Still needed". The locator reaches the LABEL; the
   * figure is its sibling, so use `totalValue` for the amount.
   */
  remainingLine(name: string): Locator {
    return this.card(name).getByText('Still needed', { exact: true });
  }

  /**
   * A card's "Still needed" FIGURE — `৳ 40,000`.
   *
   * The total row is a `<div>` holding a label span and a value
   * `<b>`, so the amount is the row's `<b>` child.
   */
  totalValue(name: string): Locator {
    return this.card(name).locator('.goal-receipt__row--total > b');
  }

  /** A card's "৳ X/mo" figure — the per-month ask. */
  perMonthLine(name: string): Locator {
    return this.card(name).getByText('/mo', { exact: false });
  }

  /**
   * A card's TARGET line — the target amount.
   *
   * The receipt states each fact on its own row, so the figure is
   * the row's `<b>` sibling of the "Target" label.
   *
   * Named `cardTargetValue` (not `targetValue`) so it does not
   * collide with the DETAIL screen's `targetValue` getter below.
   */
  cardTargetValue(name: string): Locator {
    return this.card(name)
      .locator('.goal-receipt__row')
      .filter({ hasText: 'Target' })
      .locator('> b');
  }

  /** A card's SAVED line — the saved amount. */
  cardSavedValue(name: string): Locator {
    return this.card(name)
      .locator('.goal-receipt__row')
      .filter({ hasText: 'Saved' })
      .locator('> b');
  }

  /** A card's DUE line — the target date. */
  cardDueValue(name: string): Locator {
    return this.card(name)
      .locator('.goal-receipt__row')
      .filter({ hasText: 'Due' })
      .locator('> b');
  }

  /**
   * A card's "Goal reached. Nice." line.
   *
   * On a completed goal the receipt's TOTAL row is replaced by a
   * "Status" row whose figure reads "Goal reached. Nice.".
   */
  reachedLine(name: string): Locator {
    return this.card(name).getByText('Goal reached. Nice.', { exact: false });
  }

  // ── Add form ──

  get nameInput(): Locator {
    return this.page.getByLabel('Name', { exact: true });
  }

  get alreadySavedInput(): Locator {
    return this.page.getByLabel('Already saved');
  }

  get targetAmountInput(): Locator {
    return this.page.getByLabel('Target amount');
  }

  get targetDateInput(): Locator {
    return this.page.getByLabel('Target date');
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save goal' });
  }

  // ── Detail screen ──

  /** The detail screen's H1 — the goal's name. */
  get detailHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** The "+ Add a contribution" button. Hidden once the goal is complete. */
  get addContributionButton(): Locator {
    return this.page.getByRole('button', { name: '+ Add a contribution' });
  }

  /** The inline "Edit" toggle on the detail screen. */
  get editButton(): Locator {
    return this.page.getByRole('button', { name: 'Edit', exact: true });
  }

  /** The "Delete goal" button in the danger zone. */
  get deleteButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete goal' });
  }

  /** The "Remove contribution" button on a contribution row. */
  get removeContributionButton(): Locator {
    return this.page.getByRole('button', { name: 'Remove contribution' });
  }

  // ── Detail screen ──

  /**
   * The detail screen's STATEMENT receipt — the big slip on the left
   * carrying the saved / target / remaining / target-date rows.
   */
  get statementReceipt(): Locator {
    return this.page.locator('section.goal-receipt').first();
  }

  /**
   * A figure on the statement receipt, found by its row label.
   *
   * The receipt states each fact on its own row, so the figure is
   * the row's `<b>` sibling of the label.
   */
  private receiptValue(label: string): Locator {
    return this.statementReceipt
      .locator('.goal-receipt__row')
      .filter({ hasText: label })
      .locator('> b')
      .first();
  }

  /** The "Saved so far" figure on the detail screen's statement receipt. */
  get savedSoFarValue(): Locator {
    return this.receiptValue('Saved so far');
  }

  /** The "Target" figure on the detail screen's statement receipt. */
  get targetValue(): Locator {
    return this.receiptValue('Target');
  }

  /** The "{n}% complete" line — the fill hint under the fill line. */
  get percentComplete(): Locator {
    return this.page.getByText('% complete', { exact: false });
  }

  /** The "{amount} to go" line — the other half of the fill hint. */
  get remainingLabel(): Locator {
    return this.page.getByText('to go', { exact: false });
  }

  /**
   * The receipt's pace FOOTNOTE — the plain-words note under the
   * total row. It states the goal's status in a sentence.
   */
  get paceNote(): Locator {
    return this.page.locator('.goal-pace').first();
  }

  /** The "Goal reached." banner on a completed goal. */
  get goalReachedBanner(): Locator {
    return this.page.getByText('Goal reached.', { exact: false });
  }

  /**
   * The completed-goal callout's FULL text.
   *
   * The receipt's footnote opens "Goal reached." and then states what
   * was set aside against the target — the `goalReachedBanner`
   * locator matches only its first clause.
   */
  get goalReachedDetail(): Locator {
    return this.page
      .getByText('Goal reached.', { exact: false })
      .locator('..');
  }

  /**
   * The "Target date passed." banner on an expired goal.
   */
  get goalExpiredBanner(): Locator {
    return this.page
      .getByText('Target date passed.', { exact: false })
      .locator('..');
  }

  /** The "Required per month" figure — the receipt's total row. */
  get requiredPerMonthValue(): Locator {
    return this.statementReceipt
      .locator('.goal-receipt__row--total > b')
      .first();
  }


  /**
   * The inline edit form's "Heads up:" warning.
   *
   * The warning is a `<strong>` inside the receipt's warn box, so
   * the BOX is the unit that carries the whole message.
   */
  get editHeadsUpWarning(): Locator {
    return this.page.locator('.goal-warnbox');
  }

  /** The inline edit form's submit button. */
  get saveChangesButton(): Locator {
    return this.page.getByRole('button', { name: 'Save changes' });
  }

  /** The inline edit form's cancel button. */
  get cancelEditButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel', exact: true });
  }

  /** The contribution history receipt. */
  get contributionHistoryCard(): Locator {
    return this.page
      .locator('section.goal-receipt')
      .filter({ hasText: 'Contribution history' })
      .first();
  }

  // ── Contribution modal ──

  get contributionDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  /** The contribution modal's heading — "Add a contribution". */
  get contributionDialogTitle(): Locator {
    return this.contributionDialog.getByRole('heading', {
      name: 'Add a contribution',
    });
  }

  /**
   * The contribution modal's explanatory sub-line.
   *
   * It is the modal's own `<p>`, not the dialog's accessible
   * description.
   */
  get contributionDialogSubLine(): Locator {
    return this.contributionDialog.getByText(
      "Records the amount you've set aside toward this goal. Your account balance is not changed.",
      { exact: true },
    );
  }

  get contributionAmountInput(): Locator {
    return this.page.getByLabel('Amount', { exact: true });
  }

  get contributionDateInput(): Locator {
    return this.page.getByLabel('Date', { exact: true });
  }

  get contributionNoteInput(): Locator {
    return this.page.getByLabel('Note (optional)');
  }

  get submitContributionButton(): Locator {
    return this.page.getByRole('button', { name: 'Add contribution' });
  }

  // ── field errors ──

  /**
   * The inline error under a labelled field.
   *
   * `Field` renders `<div><label/><control/><hint/><error/></div>`
   * (`src/components/Field.tsx`), so the error is the wrapper's own
   * `div.text-xs.text-danger` child — the wrapper being the label's
   * PARENT.
   */
  fieldError(label: string): Locator {
    return this.page
      .locator(`label:text-is("${label}")`)
      .locator('..')
      .locator('div.text-xs.text-danger');
  }

  // ── navigation ──

  /** Go to the goal list. */
  async goto(): Promise<void> {
    await this.gotoRoute('/goals');
    await this.waitForAppReady();
  }

  /** Go to the add-goal form. */
  async gotoAdd(): Promise<void> {
    await this.gotoRoute('/goals/add');
    await this.waitForAppReady();
  }

  /** Open a goal's detail screen by clicking its card. */
  async openGoal(name: string): Promise<void> {
    await this.card(name).click();
    await this.waitForAppReady();
  }

  /**
   * Fill the add-goal form.
   *
   * Every parameter is consumed — `alreadySaved` is written as a string
   * so a negative value can be typed.
   */
  async fillForm(input: {
    name: string;
    alreadySaved: string;
    target: string;
    targetDate: string;
  }): Promise<void> {
    await this.nameInput.fill(input.name);
    await this.alreadySavedInput.fill(input.alreadySaved);
    await this.targetAmountInput.fill(input.target);
    await this.targetDateInput.fill(input.targetDate);
  }

  /**
   * Record a contribution from the detail screen.
   *
   * The modal is portal-rendered, so the Amount field is only present
   * once the dialog is on screen.
   */
  async contribute(input: { amount: string; date: string; note?: string }): Promise<void> {
    await this.addContributionButton.click();
    await this.contributionDialog.waitFor({ state: 'visible' });
    await this.contributionAmountInput.fill(input.amount);
    await this.contributionDateInput.fill(input.date);
    if (input.note !== undefined) {
      await this.contributionNoteInput.fill(input.note);
    }
    await this.submitContributionButton.click();
    await this.contributionDialog.waitFor({ state: 'detached' });
  }

  /**
   * Open the inline edit form.
   *
   * The form replaces the view mode in place — the H1 stays the goal's
   * name, so the "Edit goal" receipt title is the reliable signal.
   */
  async openEditForm(): Promise<void> {
    await this.editButton.click();
    await this.page
      .locator('.goal-receipt__name')
      .filter({ hasText: 'Edit goal' })
      .first()
      .waitFor({ state: 'visible' });
  }
}
