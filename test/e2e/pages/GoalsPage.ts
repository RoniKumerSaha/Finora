/**
 * GoalsPage — `/goals`, `/goals/add` and `/goals/:id` (detail + edit).
 *
 * `src/screens/GoalsListScreen.tsx`:
 *   - one `<a class="card card-link">` per goal, each with the name,
 *     a percent `Pill`, a progress bar, and a two-line meta block:
 *     `৳ 10,000 / ৳ 50,000` + `by 30 Jun 2027`, then
 *     `Need ৳ 40,000 more` + `৳ 10,000/mo`.
 *   - the empty state is the shared `EmptyState` (illustration, title
 *     "Save toward something", CTA "+ New goal", learn-more link).
 *
 * `src/screens/GoalAddScreen.tsx` — fields "Name", "Already saved",
 * "Target amount", "Target date"; the submit button says "Save goal".
 *
 * `src/screens/GoalDetailScreen.tsx` — the H1 is the goal's name.
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
    return this.page.locator('a.card-link');
  }

  /** A goal card, by its name. */
  card(name: string): Locator {
    return this.page.locator('a.card-link').filter({ hasText: name }).first();
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
   * A card's percentage chip.
   *
   * The chip is the only `Pill` on the card — a `<span>` whose
   * `title` carries the pace comparison ("62% saved vs target
   * pace").
   */
  percentChip(name: string): Locator {
    return this.card(name).locator('span.rounded-pill').first();
  }

  /** A card's progress bar. */
  progressBar(name: string): Locator {
    return this.card(name).getByRole('progressbar');
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
   * A card's "overdue" marker.
   *
   * An expired goal has no finite per-month requirement, so the
   * card shows "overdue" in that slot INSTEAD of a pace line.
   */
  overdueLine(name: string): Locator {
    return this.card(name).getByText('overdue', { exact: true });
  }

  /** A card's "Need ৳ X more" line. */
  remainingLine(name: string): Locator {
    return this.card(name).getByText('Need', { exact: false });
  }

  /** A card's "৳ X/mo" line. */
  perMonthLine(name: string): Locator {
    return this.card(name).getByText('/mo', { exact: false });
  }

  /**
   * A card's "Goal reached. Nice." line.
   *
   * The line is a `<div>` whose text is "Goal reached. " followed by
   * a `<span>` holding "Nice." — so the whole line is reached by a
   * `hasText` filter on the card's own `<div>`s.
   */
  reachedLine(name: string): Locator {
    return this.card(name).locator('div').filter({ hasText: 'Goal reached.' }).last();
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

  /** The "Saved so far" figure on the detail screen's progress card. */
  get savedSoFarValue(): Locator {
    return this.page.locator('div.text-3xl.font-extrabold.text-primary');
  }

  /** The "Target" figure on the detail screen's progress card. */
  get targetValue(): Locator {
    return this.page.locator('div.text-3xl.font-extrabold.text-ink');
  }

  /** The "{n}% complete" line. */
  get percentComplete(): Locator {
    return this.page.getByText('% complete', { exact: false });
  }

  /** The "{amount} remaining" line. */
  get remainingLabel(): Locator {
    return this.page.getByText('remaining', { exact: false });
  }

  /** The "Goal reached." banner on a completed goal. */
  get goalReachedBanner(): Locator {
    return this.page.getByText('Goal reached.', { exact: false });
  }

  /**
   * The completed-goal callout's FULL text.
   *
   * It reads "Goal reached. ৳ 50,000 saved · target ৳ 50,000" — the
   * `goalReachedBanner` locator matches only its first clause.
   */
  get goalReachedDetail(): Locator {
    return this.page.getByText('saved · target', { exact: false });
  }

  /** The "Target date passed." banner on an expired goal. */
  get goalExpiredBanner(): Locator {
    return this.page.getByText('Target date passed.', { exact: false });
  }

  /** The "Required per month" figure in the "By the numbers" card. */
  get requiredPerMonthValue(): Locator {
    return this.page
      .getByText('Required per month', { exact: true })
      .locator('..')
      .locator('div.text-xl');
  }

  /**
   * The inline edit form's "Heads up:" warning.
   *
   * The heading itself is a `<strong>`, so the warning's PARENT is
   * the unit that carries the whole message.
   */
  get editHeadsUpWarning(): Locator {
    return this.page.getByText('Heads up:', { exact: false }).locator('..');
  }

  /** The inline edit form's submit button. */
  get saveChangesButton(): Locator {
    return this.page.getByRole('button', { name: 'Save changes' });
  }

  /** The inline edit form's cancel button. */
  get cancelEditButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel', exact: true });
  }

  /** The contribution history card's rows. */
  get contributionHistoryCard(): Locator {
    return this.page.locator('section.card').filter({ hasText: 'Contribution history' }).first();
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
   * name, so the "Edit goal" heading is the reliable signal.
   */
  async openEditForm(): Promise<void> {
    await this.editButton.click();
    await this.page.getByRole('heading', { name: 'Edit goal' }).waitFor({ state: 'visible' });
  }
}
