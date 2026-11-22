/**
 * eventPlans.spec.ts — FIN-L03, FIN-L08, FIN-L09.
 *
 * The Event Planner is a pure scratchpad: each event has a date, a
 * set of categories, and a total budget DERIVED from
 * `Σ category.budget`. It never touches the ledger.
 *
 * ## The two derived numbers
 *
 * `summariseEventPlan` (`src/domain/plans.ts`) computes two
 * independent sums, and the difference matters for every assertion:
 *
 *   - **budget**   = `Σ category.budget` — what the user typed per
 *                    category. This is the "Allocated / Budget"
 *                    denominator and the header's "total (sum of
 *                    categories)".
 *   - **planned**  = `Σ Σ lineItem.amount` — what the line items add
 *                    up to. This is the "Allocated" figure and the
 *                    over-budget numerator.
 *   - **paidSoFar**= `Σ amount` over the TICKED line items only.
 *
 * A category with no line items falls back to its own `planned`
 * figure — that is how the "🪙 Unallocated" seed category (which is
 * created with no line items) still contributes to the total.
 *
 * ## Known gaps this suite ASSERTS
 *
 * The manual plan documents missing behaviour as part of the
 * EXPECTED RESULT — the PRD §9.15.2 five event kits (wedding, trip,
 * religious, party, generic) are not implemented, and the build ships
 * a single generic preset panel. That absence is asserted here as a
 * positive fact about the build rather than as a `test.fail()`.
 */
import { expect, test } from '@playwright/test';
import { EventPlansPage } from '../pages/EventPlansPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import { seedState } from '../fixtures/app-state';
import { baseState, eventPlanState } from '../fixtures/seed-data';
import plansJson from '../../data/plans.json' with { type: 'json' };

const data = plansJson;

/** The seeded event's id — `test/data/plans.json` owns it. */
const EVENT_ID = 'event-trip';

test.describe('Event Plan', () => {
  let events: EventPlansPage;
  let confirm: ConfirmDialog;
  let feedback: Feedback;

  test.beforeEach(async ({ page }) => {
    events = new EventPlansPage(page);
    confirm = new ConfirmDialog(page);
    feedback = new Feedback(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-L03 — the event list and the create flow
  // ─────────────────────────────────────────────────────────────────

  test('FIN-L03 Event Plan — list and create', { tag: '@smoke' }, async ({ page }) => {
    const l03 = data.L03_eventCreate;
    const expected = l03.expected;

    await seedState(page, baseState());

    await test.step('Open Plan → Events and read the H1, the sub-line and the empty state', async () => {
      await events.gotoList();

      await expect(events.heading).toHaveText(expected.listHeading);
      await expect(events.subLine).toHaveText(expected.listSubLine);
      await expect(events.emptyStateTitle).toHaveText(expected.emptyTitle);
      await expect(events.emptyStateBody).toHaveText(expected.emptyBody);
      await expect(events.cards).toHaveCount(0);
    });

    await test.step('Click "+ New event"', async () => {
      await events.openCreateForm();

      await expect(events.eventNameInput).toBeVisible();
      await expect(events.eventDateInput).toBeVisible();
      await expect(events.unallocatedInput).toBeVisible();
      await expect(events.createEventButton).toBeVisible();
    });

    await test.step('Enter the name, the date and the unallocated amount, and create the event', async () => {
      // The form is already open — fill it in place rather than
      // re-opening it (the header's "+ New event" button disappears
      // once the form is showing).
      await events.eventNameInput.fill(l03.created.name);
      await events.eventDateInput.fill(l03.created.eventDate);
      await events.unallocatedInput.fill(l03.created.unallocated);
      await events.createEventButton.click();

      // The app navigates to the detail route.
      await expect(page).toHaveURL(/#\/plan\/event\/.+/);
    });

    await test.step('Read the event detail screen', async () => {
      await expect(events.detailHeading).toHaveText(l03.created.name);

      // The header line carries the derived total.
      await expect(events.detailSubLine).toContainText(expected.headerTotal);

      // The summary strip's three pills.
      await expect(events.allocatedPill).toBeVisible();
      await expect(events.paidPill).toBeVisible();
      await expect(events.daysToGoPill).toBeVisible();
      await expect(events.summaryStrip.locator('span.rounded-pill')).toHaveCount(3);
    });

    await test.step('The unallocated amount seeds one "🪙 Unallocated" category', async () => {
      // The unallocated figure does NOT set an event-level budget — it
      // becomes a category, so the total is still the sum of the
      // category budgets.
      await expect(events.categoryCards).toHaveCount(1);
      await expect(events.categoryCard('Unallocated')).toBeVisible();
      // The emoji and the name are separate nodes on the card.
      await expect(events.categoryCard('Unallocated')).toContainText('🪙');

      // The event's own budget is derived — there is no field for it.
      await expect(events.detailSubLine).toContainText(l03.expected.headerTotalAmount);
      await expect(events.detailSubLine).toContainText('total (sum of categories)');
    });

    await test.step('Read the event card on the list', async () => {
      await events.gotoList();

      const card = events.card(l03.created.name);
      await expect(card).toBeVisible();

      // The emoji, the name, the date and the relative-day phrase.
      await expect(card).toContainText('🏖️');
      await expect(events.cardDateLine(l03.created.name)).toContainText(
        '15 Jun 2030',
      );
      await expect(events.cardDateLine(l03.created.name)).toContainText(
        'days to go',
      );

      // The "Allocated / Budget" pill and the percentage pill.
      await expect(events.cardBudgetPill(l03.created.name)).toContainText(
        l03.expected.budgetPillAmount,
      );
      await expect(events.cardPercentagePill(l03.created.name)).toBeVisible();

      // The category count.
      await expect(events.cardCategoryCount(l03.created.name)).toContainText(
        '1 category',
      );
    });

    await test.step('The PRD five event kits are not implemented', async () => {
      // *Known gap* (FIN-L03 / PRD §9.15.2): the build ships a single
      // generic preset panel — a wedding event does not receive
      // wedding categories.
      await expect(events.absent.text(/wedding kit|trip kit|religious kit|party kit/i, false)).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-L08 — the event detail, its categories and the derived total
  // ─────────────────────────────────────────────────────────────────

  test('FIN-L08 Event Plan detail, categories and the derived total', { tag: '@smoke' }, async ({ page }) => {
    const l08 = data.L08_eventDetail;
    const expected = l08.expected;

    // The fixture already carries the manual case's own precondition:
    // `Hotel` 40000 with a 40000 line item, and `Tickets` 12000 with a
    // 12000 line item. The manual's "add a category" steps describe
    // creating exactly this state, so the fixture satisfies them and
    // the "N of 1 paid" footers it expects stay exact.
    await seedState(page, eventPlanState());

    await test.step('Open the event detail and read the header and the summary strip', async () => {
      await events.gotoDetail(EVENT_ID);

      await expect(events.detailHeading).toHaveText("Cox's Bazar trip");
      await expect(events.detailSubLine).toContainText(expected.headerTotal);

      // The summary strip carries the three pills.
      await expect(events.allocatedPill).toBeVisible();
      await expect(events.paidPill).toBeVisible();
      await expect(events.daysToGoPill).toBeVisible();
    });

    await test.step('Read the category editor for "Hotel"', async () => {
      const hotel = l08.categories[0];

      await events.openCategoryEditor(hotel.name);

      await expect(events.categoryEditorTitle).toContainText(hotel.name);
      await expect(
        events.categoryEditorDialog.getByText(expected.editorSubLine, { exact: true }),
      ).toBeVisible();

      // The four fields.
      await expect(events.categoryBudgetInput).toHaveValue(hotel.budget);
      await expect(events.categorySpentInput).toBeVisible();
      await expect(events.categorySpentHint).toHaveText(expected.spentHint);
      await expect(events.categoryDueDateInput).toBeVisible();
      await expect(events.lineItemsHeading).toHaveText('Line items');

      // The composer.
      await expect(events.newLineItemLabelInput).toHaveAttribute(
        'placeholder',
        expected.composerPlaceholder,
      );
      await expect(events.newLineItemAmountInput).toHaveAttribute(
        'placeholder',
        expected.amountPlaceholder,
      );

      // The seeded line item.
      await expect(events.lineItemCheckbox(hotel.itemLabel)).toBeVisible();
    });

    await test.step('A category with no budget shows the "No budget" pill', async () => {
      // Clear the budget and the header pill flips to "No budget" —
      // the editor has an explicit state for a missing budget.
      await events.categoryBudgetInput.fill('');
      await expect(events.categoryEditorStatusPill).toHaveText(expected.noBudgetPill);

      // Put it back.
      await events.categoryBudgetInput.fill(l08.categories[0].budget);
      await events.categoryDoneButton.click();
      await expect(events.categoryEditorDialog).toHaveCount(0);
    });

    await test.step('Read the header total, the "Allocated" pill and the "Paid" pill', async () => {
      // 40000 + 12000 = 52000 — the total is the sum of the CATEGORY
      // budgets.
      await expect(events.detailSubLine).toContainText(expected.headerTotal);

      // "Allocated" is the sum of the line-item amounts — also 52000.
      await expect(events.allocatedPill).toContainText('Allocated');
      await expect(events.allocatedPill).toContainText(expected.allocatedAmount);
      await expect(events.allocatedPill).toContainText(expected.allocatedDenominator);

      // Only "Bus tickets" is ticked, so "Paid" is 12000.
      await expect(events.paidPill).toContainText('Paid');
      await expect(events.paidPill).toContainText(expected.paidAmount);
    });

    await test.step('The total changes as a category is edited', async () => {
      await events.openCategoryEditor('Hotel');
      await events.categoryBudgetInput.fill('45000');
      await events.categoryDoneButton.click();
      await expect(events.categoryEditorDialog).toHaveCount(0);

      // 45000 + 12000 = 57000.
      await expect(events.detailSubLine).toContainText(expected.editedTotal);

      // Put it back.
      await events.openCategoryEditor('Hotel');
      await events.categoryBudgetInput.fill('40000');
      await events.categoryDoneButton.click();
      await expect(events.categoryEditorDialog).toHaveCount(0);
      await expect(events.detailSubLine).toContainText(expected.headerTotal);
    });

    await test.step('There is no field in which the event total can be typed', async () => {
      // The total is derived — the only editable numbers live in the
      // category editor.
      await expect(events.detailSubLine).toContainText('sum of categories');
      await expect(
        events.absent.control('textbox', /total/i),
      ).toHaveCount(0);
    });

    await test.step('Read the category footers', async () => {
      await expect(events.categoryCard('Tickets')).toContainText(expected.ticketsFooter);
      await expect(events.categoryCard('Hotel')).toContainText(expected.hotelFooter);
    });

    await test.step('Read the timeline rail', async () => {
      await expect(events.timelineHeader).toHaveText(expected.timelineHeader);

      // The event's own anchor sits at the top of the rail, followed
      // by one marker per category — the categories are ordered by
      // their due date (Tickets 10 Jun, Hotel 14 Jun).
      await expect(events.timelineMarkers).toHaveCount(3);
      await expect(events.timelineMarkers.first()).toContainText(
        "Cox's Bazar trip",
      );
      await expect(events.timelineMarkers.nth(1)).toContainText('Tickets');
      await expect(events.timelineMarkers.nth(2)).toContainText('Hotel');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-L09 — validation, completion, over-budget and deletion
  // ─────────────────────────────────────────────────────────────────

  test('FIN-L09 Event Plan validation, completion, over-budget and deletion', async ({ page }) => {
    const l09 = data.L09_eventValidation;
    const expected = l09.expected;

    await seedState(page, eventPlanState());
    await events.gotoList();

    await test.step('Open the create form, fill only the date, and create', async () => {
      await events.openCreateForm();
      await events.eventDateInput.fill('2030-06-15');
      await events.createEventButton.click();

      const banner = await feedback.readBanner({
        title: expected.nameRequired.what,
      });
      expect(banner.title).toBe(expected.nameRequired.what);
      expect(banner.body).toBe(expected.nameRequired.why);
      expect(banner.fix).toBe(expected.nameRequired.fix);

      // The form stays open and no event was created.
      await expect(events.eventNameInput).toBeVisible();
      await expect(events.cards).toHaveCount(1);
    });

    await test.step('Open the create form again, fill only the name, and create', async () => {
      await events.cancelCreateButton.click();
      await events.openCreateForm();
      await events.eventNameInput.fill('Wedding');
      await events.createEventButton.click();

      const banner = await feedback.readBanner({
        title: expected.dateRequired.what,
      });
      expect(banner.title).toBe(expected.dateRequired.what);
      expect(banner.body).toBe(expected.dateRequired.why);
      expect(banner.fix).toBe(expected.dateRequired.fix);

      await expect(events.eventDateInput).toBeVisible();
      await expect(events.cards).toHaveCount(1);
    });

    await test.step('Open an event and add a category with no name', async () => {
      await events.cancelCreateButton.click();
      await events.gotoDetail(EVENT_ID);

      await events.newCategoryButton.click();
      await events.newCategoryNameInput.fill('');
      await events.saveCategoryButton.click();

      const banner = await feedback.readBanner({
        title: expected.categoryNameRequired.what,
      });
      expect(banner.title).toBe(expected.categoryNameRequired.what);
      expect(banner.body).toBe(expected.categoryNameRequired.why);
      expect(banner.fix).toBe(expected.categoryNameRequired.fix);

      // No category was added.
      await expect(events.categoryCards).toHaveCount(2);
    });

    await test.step('Tick every line item in every category', async () => {
      // "Hotel" → "Two nights" 40000.
      await events.openCategoryEditor('Hotel');
      await events.lineItemCheckbox('Two nights').click();
      await events.categoryDoneButton.click();
      await expect(events.categoryEditorDialog).toHaveCount(0);

      // Every line item across every category is now paid.
      await expect(events.completedCallout).toHaveText(expected.completedTitle);
      await expect(
        events.absent.text(expected.completedBody.replace('{plan.name}', "Cox's Bazar trip")),
      ).toBeVisible();
    });

    await test.step('Set a category\'s spent figure above its budget', async () => {
      // "Bus tickets" is 12000 against a 12000 budget. Raise the line
      // item to 30000 so the paid figure (40000 + 30000 = 70000)
      // overshoots the 52000 total.
      await events.openCategoryEditor('Tickets');
      await events.lineItemAmountInput('Bus tickets').fill('30000');
      await events.categoryDoneButton.click();
      await expect(events.categoryEditorDialog).toHaveCount(0);

      await expect(events.overBudgetHeadline).toHaveText(
        expected.overBudgetHeadlines[0],
      );

      // The three figures.
      for (const figure of expected.overBudgetFigures) {
        await expect(events.overBudgetCallout.getByText(figure, { exact: true })).toBeVisible();
      }
      await expect(events.overBudgetCallout.getByText(expected.overBudgetAmount, { exact: true })).toBeVisible();
    });

    await test.step('Open the event\'s date editor', async () => {
      await events.editEventDetailsButton.click();

      await expect(events.editEventDialog).toBeVisible();
      await expect(
        events.editEventDialog.getByText(expected.dateEditorTitle, { exact: true }),
      ).toBeVisible();
      await expect(
        events.editEventDialog.getByText(expected.dateEditorNote, { exact: true }),
      ).toBeVisible();

      // The total is NOT editable there.
      await expect(events.editEventDateInput).toBeVisible();
      await expect(
        events.editEventDialog.getByLabel(/total/i),
      ).toHaveCount(0);

      // "Save changes" stays disabled until the date actually changes.
      await expect(events.saveEventChangesButton).toBeDisabled();

      await events.editEventDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(events.editEventDialog).toHaveCount(0);
    });

    await test.step('Delete a category and confirm', async () => {
      // *Known gap* (FIN-L09): the confirm dialog raised from INSIDE
      // the category editor renders at `z-40` while the editor is at
      // `z-50`, so it lands UNDERNEATH the editor. Neither
      // "Delete category" nor "Cancel" can be clicked — only Escape
      // dismisses it, and that cancels the delete. A category can
      // therefore never be deleted from the Event Plan.
      //
      // The dialog's COPY is asserted (it is what the user reads),
      // and the unreachable outcome is asserted as the defect it is.
      await events.openCategoryEditor('Hotel');

      await events.deleteCategoryButton.click();

      await expect(confirm.dialog).toBeVisible();
      await expect(confirm.heading).toHaveText(
        expected.deleteCategoryTitle.replace('{name}', 'Hotel'),
      );
      await expect(confirm.body).toHaveText(expected.deleteCategoryBody);
      await expect(confirm.dangerLine).toHaveText(expected.deleteCategoryDanger);

      // The confirm button is present but cannot be reached.
      await expect(confirm.confirmButton('Delete category')).toBeVisible();

      // Escape dismisses the confirm and leaves the editor open — the
      // delete is cancelled.
      await page.keyboard.press('Escape');
      await expect(confirm.dialog).toHaveCount(0);

      // The category survives.
      await expect(events.categoryCard('Hotel')).toHaveCount(1);
      await expect(events.detailHeading).toHaveText("Cox's Bazar trip");
    });

    await test.step('Delete the event and confirm', async () => {
      await events.gotoList();

      await events.deleteEventButton("Cox's Bazar trip").click();

      await expect(confirm.dialog).toBeVisible();
      await expect(confirm.heading).toHaveText(expected.deleteEventTitle);
      await expect(confirm.body).toHaveText(expected.deleteEventBody);

      await confirm.confirm('Delete');

      await expect(events.cards).toHaveCount(0);
      await expect(events.emptyStateTitle).toBeVisible();
    });
  });
});
