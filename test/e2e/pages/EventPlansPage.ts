/**
 * EventPlansPage — `/plan/event` (the list) and
 * `/plan/event/:id` (the detail).
 *
 * `src/screens/EventPlanScreen.tsx` — the list:
 *   - H1 "Plan an event", sub "Weddings, trips, Eid, anything with a
 *     date and a budget. Each event is its own scratchpad."
 *   - a "+ New event" button that reveals an inline create form
 *     (emoji picker, "Event name", "Event date", "Unallocated
 *     (optional)", "Create event" / "Cancel")
 *   - one `<a class="card card-link">` per event, showing the emoji,
 *     the name, the date + "N days to go" / "N days ago", a progress
 *     bar, an "Allocated / Budget" pill, a percentage pill, and a
 *     category count.
 *   - the empty state reads "Plan your first event".
 *
 * `src/screens/EventPlanDetailScreen.tsx` — the detail:
 *   - H1 is the event's name; the sub-line carries the total budget
 *     and the "Days to go" figure.
 *   - a summary strip with the "Allocated", "Paid" and "Days to go"
 *     pills.
 *   - a timeline rail on the left, one card per category on the
 *     right. Each category card shows the emoji, the name, a status
 *     chip ("Paid in full" / "N days overdue" / "Due in N days" /
 *     the date), a progress bar, and a footer with the spent figure,
 *     the budget, and an "N of M paid" pill.
 *
 * The event's TOTAL budget is derived from `Σ category.budget` — the
 * "Unallocated" input on the create form seeds a single "🪙
 * Unallocated" category rather than setting the event's own budget.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class EventPlansPage extends BasePage {
  // ── List screen ──

  /** The list screen's H1. */
  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Plan an event' });
  }

  /** The list screen's sub-line. */
  get subLine(): Locator {
    return this.page.getByText(
      'Weddings, trips, Eid, anything with a date and a budget. Each event is its own scratchpad.',
      { exact: true },
    );
  }

  /**
   * The header's "+ New event" button — the one beside the page title.
   *
   * ⚠️ The empty state renders a *second* "+ New event" button, so a
   * bare `getByRole('button', { name: /New event/ })` is ambiguous.
   * The header button is the one that lives in the title's row, so
   * this locator is scoped to the row that holds the H1.
   *
   * The header button's accessible name is "+New event" — the "+"
   * glyph and the label are ADJACENT spans with no whitespace
   * between them, so the accessible name has no space. The
   * empty-state button renders "+ New event" as one text node, with
   * a space. A regex covers both spellings.
   */
  get newEventButton(): Locator {
    return this.page
      .getByRole('heading', { level: 1 })
      .locator('xpath=../..')
      .getByRole('button', { name: /\+ ?New event/ });
  }

  /** Every event card. */
  get cards(): Locator {
    return this.page.locator('a.card-link');
  }

  /** An event card, by its name. */
  card(name: string): Locator {
    return this.page.locator('a.card-link').filter({ hasText: name }).first();
  }

  /** The empty-state heading. */
  get emptyStateTitle(): Locator {
    return this.page.getByText('Plan your first event', { exact: true });
  }

  /**
   * The empty state's body copy.
   *
   * "Set a date. Add categories with their own budgets — the event's
   * total is the sum of category budgets."
   */
  get emptyStateBody(): Locator {
    return this.page.getByText(
      'Set a date. Add categories with their own budgets — the event\'s total is the sum of category budgets.',
      { exact: true },
    );
  }

  /** The "Delete {name}" button on an event card. */
  deleteEventButton(name: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${name}` });
  }

  /**
   * An event card's date line — "15 Jun 2030 · N days to go".
   *
   * The date and the relative-day phrase are one string, so the whole
   * line is matched. For a past-dated event the app swaps the phrase
   * for "N days ago".
   */
  cardDateLine(name: string): Locator {
    return this.card(name).locator('div.text-xs.text-muted').first();
  }

  /**
   * An event card's "Allocated / Budget" pill.
   *
   * The pill renders the allocated figure, a slash and the budget as
   * separate spans, so the whole pill is matched on its text.
   */
  cardBudgetPill(name: string): Locator {
    return this.card(name).locator('span.rounded-pill').first();
  }

  /**
   * An event card's percentage pill.
   *
   * The second pill carries the percentage and its verb — "46% of
   * budget" — or "No budget" when the event has no budget at all.
   */
  cardPercentagePill(name: string): Locator {
    return this.card(name).locator('span.rounded-pill').nth(1);
  }

  /** An event card's category-count line. */
  cardCategoryCount(name: string): Locator {
    return this.card(name).locator('div.flex.justify-between.text-xs.text-muted.tabular');
  }

  // ── Create form ──

  get eventNameInput(): Locator {
    return this.page.getByLabel('Event name');
  }

  get eventDateInput(): Locator {
    return this.page.getByLabel('Event date');
  }

  get unallocatedInput(): Locator {
    return this.page.getByLabel('Unallocated (optional)');
  }

  get createEventButton(): Locator {
    return this.page.getByRole('button', { name: 'Create event' });
  }

  get cancelCreateButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel', exact: true });
  }

  // ── Detail screen ──

  /** The detail screen's H1 — the event's name. */
  get detailHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** The detail's "← Events" back link. */
  get detailBackLink(): Locator {
    return this.page.getByRole('button', { name: '← Events' });
  }

  /** The pencil button that opens the event-date editor. */
  get editEventDetailsButton(): Locator {
    return this.page.getByRole('button', { name: 'Edit event details' });
  }

  /**
   * The header's "Days to go" / "Days ago" figure.
   *
   * The label and the number are separate nodes, so the number is
   * found as the element's sibling.
   */
  get daysToGoValue(): Locator {
    return this.page
      .locator('div.text-right')
      .locator('div.text-\\[22px\\]');
  }

  /**
   * The detail's sub-line — the event date and the derived total.
   *
   * Reads "15 Jun 2030 · ৳ 52,000 total (sum of categories)" once the
   * event has categories, and "15 Jun 2030 · No budget yet — add
   * categories to set one" before any exist.
   */
  get detailSubLine(): Locator {
    return this.page
      .locator('div.text-muted')
      .filter({ hasText: /total \(sum of categories\)|No budget yet/ })
      .first();
  }

  /** The summary strip's "Allocated" pill. */
  get allocatedPill(): Locator {
    return this.summaryStrip
      .locator('span.rounded-pill')
      .filter({ has: this.page.getByText('Allocated', { exact: true }) })
      .first();
  }

  /** The summary strip's "Paid" pill. */
  get paidPill(): Locator {
    return this.summaryStrip
      .locator('span.rounded-pill')
      .filter({ has: this.page.getByText('Paid', { exact: true }) })
      .first();
  }

  /**
   * The summary strip's "Days to go" / "Days ago" pill.
   *
   * For a past-dated event the app swaps the label to "Days ago".
   */
  get daysToGoPill(): Locator {
    return this.summaryStrip
      .locator('span.rounded-pill')
      .filter({ has: this.page.getByText(/^(Days to go|Days ago)$/, { exact: true }) })
      .first();
  }

  /**
   * The summary strip — the card holding the Allocated / Paid /
   * Days-to-go pills.
   *
   * ⚠️ The header ALSO renders a "Days to go" label (next to the big
   * number), so a bare `getByText('Days to go')` is ambiguous. Scope
   * the pills to the strip.
   */
  get summaryStrip(): Locator {
    return this.page
      .locator('div.card')
      .filter({ has: this.page.getByText('Allocated', { exact: true }) })
      .filter({ has: this.page.getByText('Paid', { exact: true }) })
      .first();
  }

  /**
   * The header's "Days to go" / "Days ago" figure — the big number.
   *
   * The label and the number are separate nodes, so the number is the
   * `text-[22px]` child of the header's right-hand block.
   */
  get headerDaysValue(): Locator {
    return this.page.locator('div.text-right').locator('div.text-\\[22px\\]');
  }

  /**
   * Every category card on the detail screen.
   *
   * ⚠️ The "+ New category" button shares the `card-flat` class with
   * the real category cards, so it has to be filtered out or every
   * count assertion is off by one.
   */
  get categoryCards(): Locator {
    return this.page
      .locator('button.card-flat')
      .filter({ hasNotText: '+ New category' });
  }

  /** A category card, by its name. */
  categoryCard(name: string): Locator {
    return this.categoryCards.filter({ hasText: name }).first();
  }

  /** The timeline rail's header. */
  get timelineHeader(): Locator {
    return this.page.getByText(/^Timeline( \(past\))?$/, { exact: true }).first();
  }

  /** The "Event completed" callout — only present when every item is paid. */
  get completedCallout(): Locator {
    return this.page.getByText('Event completed', { exact: true });
  }

  /** The over-budget callout's headline. */
  get overBudgetHeadline(): Locator {
    return this.page.getByText(/^(Paid past the budget|Categories sum past the budget)$/);
  }

  /**
   * The over-budget callout — the card holding the headline and the
   * Budget / Allocated / Over by figures.
   *
   * ⚠️ The summary strip ALSO carries an "Allocated" label, so the
   * callout is scoped by its headline.
   */
  get overBudgetCallout(): Locator {
    return this.page
      .locator('div.card')
      .filter({ has: this.overBudgetHeadline })
      .first();
  }

  // ── Category cards ──

  /**
   * A category card's status chip.
   *
   * The chip is one of "Paid in full", "N days overdue",
   * "Due in N days" or a bare date. It lives inside the card's
   * title row, next to the category name.
   */
  categoryStatusChip(name: string): Locator {
    return this.categoryCard(name).locator('span.rounded-pill').first();
  }

  /**
   * A category card's footer pill — "N of M paid".
   *
   * The footer pill carries the paid count, an optional "· date"
   * suffix, and a coloured dot, so the text is matched loosely.
   */
  categoryPaidPill(name: string): Locator {
    return this.categoryCard(name).locator('span.rounded-pill').last();
  }

  /** The "+ New category" button. */
  get newCategoryButton(): Locator {
    return this.page.getByRole('button', { name: '+ New category' });
  }

  // ── New-category inline form ──

  /** The inline new-category form's name field. */
  get newCategoryNameInput(): Locator {
    return this.page.getByPlaceholder('Category name');
  }

  /** The inline new-category form's due-date field. */
  get newCategoryDueDateInput(): Locator {
    return this.page.getByLabel('Due date (optional)');
  }

  get saveCategoryButton(): Locator {
    return this.page.getByRole('button', { name: 'Save category' });
  }

  get cancelCategoryButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel', exact: true });
  }

  // ── Category editor modal ──

  /** The category editor's dialog. */
  get categoryEditorDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Budget · spent (sum of line items) · due date.' });
  }

  /**
   * The category editor's heading — the category's name.
   *
   * The dialog carries a second `h3` ("Line items"), so the title is
   * matched by its `aria-labelledby` id rather than by level.
   */
  get categoryEditorTitle(): Locator {
    return this.categoryEditorDialog.locator('#cat-editor-title');
  }

  /** The category editor's status pill. */
  get categoryEditorStatusPill(): Locator {
    return this.categoryEditorDialog.locator('span.rounded-pill').first();
  }

  /** The category editor's budget field. */
  get categoryBudgetInput(): Locator {
    return this.categoryEditorDialog.getByLabel('Budget', { exact: true });
  }

  /** The category editor's read-only "Spent" field. */
  get categorySpentInput(): Locator {
    return this.categoryEditorDialog.getByLabel('Spent', { exact: true });
  }

  /** The "Spent" field's hint — "Sum of all line items below." */
  get categorySpentHint(): Locator {
    return this.categoryEditorDialog.getByText('Sum of all line items below.', { exact: true });
  }

  /** The category editor's due-date field. */
  get categoryDueDateInput(): Locator {
    return this.categoryEditorDialog.getByLabel('Due date', { exact: true });
  }

  /** The "Line items" section heading. */
  get lineItemsHeading(): Locator {
    return this.categoryEditorDialog.getByRole('heading', { name: 'Line items' });
  }

  /** The editor's "N of M done" caption. */
  get categoryDoneCount(): Locator {
    return this.categoryEditorDialog.getByText(/\d+ of \d+ done/);
  }

  /**
   * A line item's checkbox.
   *
   * A line-item row is a `grid-cols-[20px_1fr_100px_36px]` grid whose
   * first cell is the checkbox. The composer row — the one with the
   * "Add a line" placeholder — has an EMPTY first cell, so filtering
   * on the checkbox alone excludes it.
   *
   * ⚠️ The row's label is an `<input value="…">`, not a text node, so
   * `hasText` never matches it. The row is found by the LABEL
   * INPUT's value instead.
   *
   * ⚠️ The `has:` inner locator is re-rooted relative to the row, so
   * it must be PAGE-rooted — a dialog-scoped inner locator matches
   * nothing and silently filters every row out.
   */
  lineItemCheckbox(label: string): Locator {
    return this.categoryEditorDialog
      .locator('div.grid.grid-cols-\\[20px_1fr_100px_36px\\]')
      .filter({ has: this.page.locator(`input[value="${label}"]`) })
      .locator('input[type="checkbox"]');
  }

  /**
   * A line item's amount input.
   *
   * Found by the row's label input, for the same reason as
   * `lineItemCheckbox`.
   */
  lineItemAmountInput(label: string): Locator {
    return this.categoryEditorDialog
      .locator('div.grid.grid-cols-\\[20px_1fr_100px_36px\\]')
      .filter({ has: this.page.locator(`input[value="${label}"]`) })
      .locator('input[type="number"]')
      .first();
  }

  /** The composer's line-label input. */
  get newLineItemLabelInput(): Locator {
    return this.categoryEditorDialog.getByPlaceholder('Add a line — e.g. Deposit, Tickets');
  }

  /** The composer's amount input. */
  get newLineItemAmountInput(): Locator {
    return this.categoryEditorDialog.getByPlaceholder('Amount');
  }

  /** The composer's "Add line item" button. */
  get addLineItemButton(): Locator {
    return this.categoryEditorDialog.getByRole('button', { name: 'Add line item' });
  }

  /** A line item's remove button. */
  removeLineItemButton(label: string): Locator {
    return this.categoryEditorDialog.getByRole('button', { name: `Remove line item ${label}` });
  }

  /** The editor's "Done" button. */
  get categoryDoneButton(): Locator {
    return this.categoryEditorDialog.getByRole('button', { name: 'Done', exact: true });
  }

  /** The editor's "Done with this category?" footer. */
  get doneWithCategoryLabel(): Locator {
    return this.categoryEditorDialog.getByText('Done with this category?', { exact: true });
  }

  /** The editor's "Delete category" button. */
  get deleteCategoryButton(): Locator {
    return this.categoryEditorDialog.getByRole('button', { name: 'Delete category' });
  }

  // ── Edit-event-date modal ──

  /** The event-date editor's dialog. */
  get editEventDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Edit event date' });
  }

  /** The event-date editor's date field. */
  get editEventDateInput(): Locator {
    return this.editEventDialog.getByLabel('Event date');
  }

  get saveEventChangesButton(): Locator {
    return this.editEventDialog.getByRole('button', { name: 'Save changes' });
  }

  // ── timeline ──

  /** A timeline marker label — "today", "tomorrow", "in N days", "N days ago". */
  timelineLabel(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  /**
   * Every timeline marker row.
   *
   * Each marker is a row in the left rail: a dot, the category's
   * name, and a secondary line with the relative day and the short
   * date ("tomorrow · Jun 11"). The rail's own container is
   * `relative flex flex-col gap-3.5`, and every marker inside it is a
   * `flex items-center gap-3` row.
   */
  get timelineMarkers(): Locator {
    return this.page
      .locator('div.relative.flex.flex-col.gap-3\\.5')
      .locator('div.flex.items-center.gap-3');
  }

  /**
   * A timeline marker's secondary line — the relative day and the
   * short date, e.g. "tomorrow · Jun 11".
   *
   * The event's own anchor reads "Event · tomorrow · Jun 11"; the
   * category markers read "tomorrow · Jun 11".
   */
  timelineMarkerLabel(text: string): Locator {
    return this.page.getByText(text, { exact: false });
  }

  // ── navigation ──

  async gotoList(): Promise<void> {
    await this.gotoRoute('/plan/event');
    await this.waitForAppReady();
  }

  async gotoDetail(id: string): Promise<void> {
    await this.gotoRoute(`/plan/event/${id}`);
    await this.waitForAppReady();
  }

  /** Reveal the inline create form. */
  async openCreateForm(): Promise<void> {
    await this.newEventButton.click();
    await this.eventNameInput.waitFor({ state: 'visible' });
  }

  /**
   * Create an event and wait for the detail route.
   *
   * The app navigates to `/plan/event/:id` on a successful create.
   */
  async createEvent(input: {
    name: string;
    eventDate: string;
    unallocatedBudget?: string;
  }): Promise<void> {
    await this.openCreateForm();
    await this.eventNameInput.fill(input.name);
    await this.eventDateInput.fill(input.eventDate);
    if (input.unallocatedBudget !== undefined) {
      await this.unallocatedInput.fill(input.unallocatedBudget);
    }
    await this.createEventButton.click();
    await this.page.waitForURL(/#\/plan\/event\/.+/);
  }

  /**
   * Add a category through the inline form.
   *
   * The form only renders while a draft is open, so the name field is
   * the reliable signal that it opened.
   */
  async addCategory(input: { name: string; dueDate?: string }): Promise<void> {
    await this.newCategoryButton.click();
    await this.newCategoryNameInput.fill(input.name);
    if (input.dueDate !== undefined) {
      await this.newCategoryDueDateInput.fill(input.dueDate);
    }
    await this.saveCategoryButton.click();
    await this.newCategoryNameInput.waitFor({ state: 'detached' });
  }

  /**
   * Open the editor for a category.
   *
   * The category card itself is the click target — the grid has no
   * dedicated "edit" button.
   */
  async openCategoryEditor(name: string): Promise<void> {
    await this.categoryCard(name).click();
    await this.categoryEditorDialog.waitFor({ state: 'visible' });
  }

  /**
   * Add a line item to the open category editor.
   *
   * The composer commits on Enter or on the ✓ button; the button is
   * disabled until a label is typed, so the label must land first.
   */
  async addLineItem(label: string, amount: string): Promise<void> {
    await this.newLineItemLabelInput.fill(label);
    await this.newLineItemAmountInput.fill(amount);
    await this.addLineItemButton.click();
  }
}
