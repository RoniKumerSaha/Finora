/**
 * plan.spec.ts — FIN-L01, FIN-L02, FIN-L05, FIN-L06, FIN-L07.
 *
 * The Plan hub and the Month Plan. Each manual case becomes EXACTLY
 * ONE test, titled with its manual ID and the manual title verbatim.
 *
 * ## Why the cases are consolidated
 *
 * The manual plan writes FIN-L01 … FIN-L09 as nine cases, but three of
 * them describe the SAME screens this file already drives:
 *
 *   - **FIN-L03** (event list and create) and **FIN-L08 / FIN-L09**
 *     (event detail, validation, deletion) live in
 *     `eventPlans.spec.ts` — the Event Plan is a different screen
 *     family with its own page object.
 *   - **FIN-L04** (Investment Planner and Loan Calculator) lives in
 *     `planners.spec.ts` — the two mock planners have their own page
 *     objects.
 *
 * The `**Automation:**` lines in `test/docs/manual-test.md` point at
 * the file that actually drives each case.
 *
 * ## Known gaps this suite ASSERTS
 *
 * The manual plan documents several missing controls as part of the
 * EXPECTED RESULT — the Month Plan has no month selector and no
 * rollover (FIN-L01), no Reset control and no "Save plan" button
 * (FIN-L05), and the batch banner points at a "Save plan" control
 * that does not exist (FIN-L02). Those absences are asserted here as
 * positive facts about the build, not as `test.fail()` placeholders.
 */
import { expect, test } from '@playwright/test';
import { PlanPage } from '../pages/PlanPage';
import { LoanCalculatorPage } from '../pages/LoanCalculatorPage';
import { InvestmentPlannerPage } from '../pages/InvestmentPlannerPage';
import { EventPlansPage } from '../pages/EventPlansPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import { readState, reseedState, seedState } from '../fixtures/app-state';
import { baseState, monthPlanState } from '../fixtures/seed-data';
import plansJson from '../../data/plans.json' with { type: 'json' };

const data = plansJson;

/**
 * Re-enter selection mode, pick every card, and open the batch editor.
 *
 * Applying a batch update CLOSES the editor and leaves selection mode,
 * so each mode in the manual case starts from a fresh selection.
 */
async function openBatchEditor(
  plan: PlanPage,
  cardCount: number,
): Promise<void> {
  await plan.selectMultipleToggle.click();
  await plan.selectAllButton.click();
  await expect(plan.selectionCountLine).toHaveText(`${cardCount} of ${cardCount} selected`);
  await plan.editBudgetsButton.click();
  await plan.batchSheetTitle.waitFor({ state: 'visible' });
}

test.describe('Plan', () => {
  let plan: PlanPage;
  let loan: LoanCalculatorPage;
  let invest: InvestmentPlannerPage;
  let events: EventPlansPage;
  let confirm: ConfirmDialog;
  let feedback: Feedback;

  test.beforeEach(async ({ page }) => {
    plan = new PlanPage(page);
    loan = new LoanCalculatorPage(page);
    invest = new InvestmentPlannerPage(page);
    events = new EventPlansPage(page);
    confirm = new ConfirmDialog(page);
    feedback = new Feedback(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-L01 — the Plan hub
  // ─────────────────────────────────────────────────────────────────

  test('FIN-L01 The Plan hub', async ({ page }) => {
    const l01 = data.L01_hub;
    const expected = l01.expected;

    await seedState(page, monthPlanState());

    await test.step('Open Plan and read the H1, the sub-line and the four rows', async () => {
      await plan.gotoHub();

      await expect(plan.hubHeading).toHaveText(expected.heading);
      await expect(plan.hubSubLine).toHaveText(expected.subLine);
      await expect(plan.hubRows).toHaveCount(4);

      for (const row of expected.rows) {
        await expect(plan.hubRow(row as 'Investments')).toBeVisible();
      }
    });

    await test.step('Read the footer note', async () => {
      await expect(plan.scratchFooter).toHaveText(expected.footer);
    });

    await test.step('Read the four row states', async () => {
      // Investments — "at maturity".
      await expect(plan.hubRowSuffix('Investments')).toHaveText(expected.rowSuffixes.investments);
      // Loans — "/mo EMI".
      await expect(plan.hubRowSuffix('Loans')).toHaveText(expected.rowSuffixes.loans);
      // This month — "budgeted · N items" (the fixture holds two).
      await expect(plan.hubRowSuffix('This month')).toContainText('budgeted · 2 item');
      // Events — "no events yet" (the fixture holds no event plan).
      await expect(plan.hubRowSuffix('Events')).toHaveText('no events yet');
    });

    await test.step('Click each row in turn and read the destination screen\'s H1', async () => {
      await plan.hubRow('This month').click();
      await expect(page).toHaveURL(/#\/plan\/month$/);
      await expect(plan.monthHeading).toHaveText('Plan my month');

      await plan.gotoHub();
      await plan.hubRow('Loans').click();
      await expect(page).toHaveURL(/#\/plan\/loan$/);
      await expect(loan.heading).toHaveText('Loan Calculator');

      await plan.gotoHub();
      await plan.hubRow('Investments').click();
      await expect(page).toHaveURL(/#\/plan\/invest$/);
      await expect(invest.screenHeading).toHaveText('Investment Planner');

      await plan.gotoHub();
      await plan.hubRow('Events').click();
      await expect(page).toHaveURL(/#\/plan\/event$/);
      await expect(events.screenHeading).toHaveText('Plan an event');
    });

    await test.step('Return to Plan and read the "This month" and "Events" rows again', async () => {
      await plan.gotoHub();

      await expect(plan.hubRowSuffix('This month')).toContainText('budgeted · 2 item');
      await expect(plan.hubRowSuffix('Events')).toHaveText('no events yet');
    });

    await test.step('The Month Plan has no month selector and no rollover', async () => {
      // *Known gap* (FIN-L01): PRD §9.15.1 specifies both. Neither
      // exists — the screen always edits the current calendar month.
      await plan.gotoMonth();

      await expect(
        plan.absent.control('button', /previous month|next month|month selector/i),
      ).toHaveCount(0);
      await expect(
        plan.absent.control('combobox', /month/i),
      ).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-L02 — the Month Plan batch budget editor
  // ─────────────────────────────────────────────────────────────────

  test('FIN-L02 The Month Plan batch budget editor', async ({ page }) => {
    const l02 = data.L02_batchEditor;
    const expected = l02.expected;

    await seedState(page, monthPlanState());
    await plan.gotoMonth();

    await test.step('Enter selection mode and select three cards', async () => {
      await plan.selectMultipleToggle.click();
      await expect(plan.floatingBarCount).toHaveText(expected.hint);

      // The fixture holds two cards, so "three" is the manual plan's
      // precondition — the fixture is the authority for the count and
      // it carries two. Select all of them.
      await plan.selectAllButton.click();
      await expect(plan.selectionCountLine).toHaveText('2 of 2 selected');
    });

    await test.step('Read the floating bar', async () => {
      await expect(plan.floatingBarCount).toHaveText('cards selected');
      await expect(plan.selectAllButton).toHaveText(expected.allSelected);
      await expect(plan.clearSelectionButton).toBeVisible();
      await expect(plan.editBudgetsButton).toBeVisible();
      await expect(plan.exitSelectionButton).toBeVisible();
    });

    await test.step('Open "Edit budgets" and read the four mode tabs', async () => {
      await plan.editBudgetsButton.click();

      await expect(plan.batchSheetTitle).toHaveText(expected.sheetTitle);
      await expect(plan.batchTablist).toBeVisible();

      for (const tab of expected.tabs) {
        await expect(plan.batchTab(tab as 'Custom amounts')).toBeVisible();
      }
    });

    await test.step('Choose "Same amount", enter 5000, and apply', async () => {
      await plan.batchTab('Same amount').click();
      await plan.batchAmountInput.fill(l02.sameAmount);

      await expect(plan.batchApplyButton).toHaveText(
        // The manual plan writes "Apply to {n} card(s)"; the app
        // pluralises properly — "Apply to 2 cards".
        expected.applyFormatPlural.replace('{n}', '2'),
      );
      await plan.batchApplyButton.click();

      const banner = await feedback.readBanner({
        title: expected.updatedBannerPlural.replace('{n}', '2'),
      });
      expect(banner.title).toBe('2 cards updated');
      expect(banner.fix).toBe(expected.bannerFix);
    });

    await test.step('Choose "Adjust %", apply +10%, and apply', async () => {
      await openBatchEditor(plan, 2);
      await plan.batchTab('Adjust %').click();
      await plan.batchPercentInput.fill('10');

      await plan.batchApplyButton.click();

      const banner = await feedback.readBanner({
        title: expected.updatedBannerPlural.replace('{n}', '2'),
      });
      expect(banner.title).toBe('2 cards updated');
    });

    await test.step('Choose "Custom amounts", leave one card blank, and apply', async () => {
      await openBatchEditor(plan, 2);
      await plan.batchTab('Custom amounts').click();

      // The custom mode's helper copy.
      await expect(plan.batchCustomHelper).toHaveText(expected.customHelper);
      await expect(plan.batchClearAllButton).toHaveText(expected.clearAll);
      await expect(plan.batchFillAllButton).toHaveText(expected.fillAllWith);

      // One card gets a budget; the other is left blank.
      await plan.batchCardBudgetInput('Groceries').fill('7000');
      await plan.batchApplyButton.click();

      const banner = await feedback.readBanner({
        title: expected.updatedBannerSingular.replace('{n}', '1'),
      });
      expect(banner.title).toBe('1 card updated');
    });

    await test.step('Choose "Clear" and apply', async () => {
      await openBatchEditor(plan, 2);
      await plan.batchTab('Clear').click();
      await plan.batchApplyButton.click();

      const banner = await feedback.readBanner({
        title: expected.clearedBannerPlural.replace('{n}', '2'),
      });
      expect(banner.title).toBe('2 cards cleared');
      expect(banner.fix).toBe(expected.bannerFix);
    });

    await test.step('Exit selection mode — the editor cannot be reopened with nothing selected', async () => {
      // *Known gap* (FIN-L02): the manual plan expects the editor to
      // open with an empty selection and show "Nothing is selected.
      // Pick a few cards first, then come back here." That branch
      // exists in `BatchBudgetEditor` but is UNREACHABLE — the only
      // opener, the "Edit budgets" button, is `disabled={nothingSelected}`.
      //
      // The reachable behaviour is asserted instead: the CTA is disabled
      // while nothing is picked, and the message never renders.
      //
      // Applying the last batch update already LEFT selection mode, so
      // re-enter it to reach the "Exit selection mode" button.
      await plan.selectMultipleToggle.click();
      await expect(plan.exitSelectionButton).toBeVisible();
      await plan.exitSelectionButton.click();
      await expect(plan.floatingBarCount).toHaveCount(0);

      // Re-enter selection mode with nothing picked.
      await plan.selectMultipleToggle.click();
      await expect(plan.editBudgetsButton).toBeDisabled();
      await expect(plan.batchNothingSelected).toHaveCount(0);
    });

    await test.step('The banner points at a "Save plan" control the Month Plan does not have', async () => {
      // *Known gap* (FIN-L02): the banner's fix text names a button
      // that does not exist on this screen — only "Save item" inside
      // the per-item modal does.
      await expect(
        plan.absent.control('button', 'Save plan'),
      ).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-L05 — the Plan save/reset and dirty discipline
  // ─────────────────────────────────────────────────────────────────

  test('FIN-L05 The Plan save/reset and dirty discipline', { tag: '@smoke' }, async ({ page }) => {
    const l05 = data.L05_saveReset;
    const expected = l05.expected;

    await seedState(page, baseState());

    await test.step('Open the Loan Calculator and change the rate, without saving', async () => {
      await loan.gotoList();
      await loan.startNewProjection();

      await loan.nameInput.fill('Car loan');
      await loan.principalInput.fill('100000');
      await loan.annualRateInput.fill('9');
      await loan.termInput.fill('12');

      // The toolbar now reads "Unsaved changes".
      await expect(loan.unsavedChangesLabel).toBeVisible();
      await expect(loan.unsavedChangesHint).toBeVisible();
    });

    await test.step('Look for a "Reset" control', async () => {
      // The toolbar offers exactly "Save plan" and "Delete".
      await expect(loan.resetButton).toHaveCount(0);
      await expect(loan.savePlanButton).toBeVisible();
      await expect(loan.deleteProjectionButton).toBeVisible();
    });

    await test.step('Tap "Save plan"', async () => {
      await loan.savePlanButton.click();

      // The app navigates back to the projection list.
      await expect(page).toHaveURL(/#\/plan\/loan$/);
    });

    await test.step('Reopen the plan and confirm the value persisted', async () => {
      await loan.projectionCard('Car loan').click();
      await expect(loan.detailHeading).toBeVisible();

      await expect(loan.annualRateInput).toHaveValue('9');
      await expect(loan.savedLabel).toHaveText(expected.savedLine);
      await expect(loan.unsavedChangesLabel).toHaveCount(0);
    });

    await test.step('Edit it again and navigate back via "← Loan Calculator"', async () => {
      await loan.annualRateInput.fill('11');
      await expect(loan.unsavedChangesLabel).toBeVisible();

      await loan.backLink.click();
      await expect(page).toHaveURL(/#\/plan\/loan$/);

      // No guard-rail dialog — the dirty dot is the only indicator.
      await expect(loan.anyDialog).toHaveCount(0);
    });

    await test.step('The Month Plan has no Save/Reset toolbar at all', async () => {
      await plan.gotoMonth();

      await expect(plan.monthFooter).toHaveText(expected.monthFooter);
      await expect(
        plan.absent.control('button', 'Save plan'),
      ).toHaveCount(0);
      await expect(plan.absent.control('button', 'Reset')).toHaveCount(0);
    });

    await test.step('The Month Plan auto-saves — the change is already persisted', async () => {
      // *Known gap* (FIN-L05): Month Plan and Event Plan auto-save
      // every edit while the two mock planners need an explicit
      // "Save plan" — two contradictory save models under one rule.
      //
      // The persistence is measured against the stored blob rather
      // than a reload: the seed's init script re-runs on every
      // navigation and would overwrite the app's own write.
      await plan.addItem('Auto saved item', '1200');
      await expect(plan.card('Auto saved item')).toBeVisible();

      const stored = await readState(page);
      const categories = stored?.monthPlans?.[0]?.categories ?? [];
      expect(categories.some(c => c.name === 'Auto saved item')).toBe(true);
    });

    await test.step('Backing out of a never-saved plan drops it silently', async () => {
      // *Known gap* (FIN-L05, PRD §9.15.2): the Investment Planner's
      // back link calls `removeInvestmentPlan(plan.id)` whenever the
      // plan has no `savedAt` — the draft disappears with no
      // confirmation and no message. A plan is a scratchpad, not a
      // transaction, so the PRD expects it to survive.
      //
      // The Loan Calculator does exactly the same (`removeLoanPlan`).
      // The Investment Planner is asserted here because FIN-L04
      // already drives the Loan Calculator's save path.
      await invest.gotoList();
      await invest.startBlankPlan();

      await invest.nameInput.fill(l05.unsavedPlan.name);
      await invest.principalInput.fill(l05.unsavedPlan.principal);
      await expect(invest.unsavedChangesLabel).toBeVisible();

      // Back to the list — no confirm dialog, no toast.
      await invest.backLink.click();
      await expect(page).toHaveURL(/#\/plan\/invest$/);
      await expect(invest.anyDialog).toHaveCount(0);

      // The draft is gone.
      await expect(invest.planCard(l05.unsavedPlan.name)).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-L06 — Month Plan: add an item, set a budget, remove it
  // ─────────────────────────────────────────────────────────────────

  test('FIN-L06 Month Plan — add an item, set a budget, remove it', { tag: '@smoke' }, async ({ page }) => {
    const l06 = data.L06_monthPlanItem;
    const expected = l06.expected;

    await seedState(page, baseState());

    await test.step('Open Plan → This month and read the H1, the sub-line and the count chip', async () => {
      await plan.gotoMonth();

      await expect(plan.monthHeading).toHaveText(expected.heading);
      await expect(plan.monthSubLine).toHaveText(expected.subLine);
      await expect(plan.monthFooter).toHaveText(expected.footer);
      await expect(plan.itemsSectionLabel).toHaveText(expected.sectionHeading);

      // The plan is empty, so the count chip is absent.
      await expect(plan.cardCountChip).toHaveCount(0);
    });

    await test.step('Add an item named "Groceries" with a budget of 8000', async () => {
      await plan.openNewItemModal();

      await expect(plan.newItemTitle).toHaveText(expected.addModalTitle);
      await expect(plan.newItemBody).toHaveText(expected.addModalBody);

      await plan.newItemNameInput.fill(l06.added.name);
      await plan.newItemBudgetInput.fill(l06.added.budget);
      await plan.saveItemButton.click();

      await expect(plan.newItemDialog).toHaveCount(0);
      await expect(plan.card('Groceries')).toBeVisible();
      await expect(plan.cardCountNumber).toHaveText('1');
    });

    await test.step('Read the item card', async () => {
      await expect(plan.card('Groceries')).toContainText(expected.budgetAmount);
      await expect(plan.cardCountChip).toContainText('card in plan');
    });

    await test.step('Open the budget editor and clear the budget', async () => {
      await plan.openItemEditor('Groceries');

      await expect(
        plan.editorDialog.getByText(expected.editorHeading, { exact: true }),
      ).toBeVisible();
      await expect(plan.editorDialog.getByText('Budget set', { exact: true })).toBeVisible();
      await expect(plan.clearBudgetButton).toBeVisible();
      await expect(plan.saveEditorButton).toBeVisible();
      await expect(plan.doneWithItemLabel).toHaveText(expected.editorFooter);
      await expect(plan.removeItemButton).toHaveText(expected.removeItem);

      await plan.clearBudgetButton.click();
      await plan.saveEditorButton.click();
      await expect(plan.editorDialog).toHaveCount(0);

      await plan.openItemEditor('Groceries');
      await expect(plan.editorDialog.getByText('No budget', { exact: true })).toBeVisible();
      await plan.saveEditorButton.click();
    });

    await test.step('Open the budget editor and set it to 9000', async () => {
      await plan.openItemEditor('Groceries');
      await plan.editorBudgetInput.fill(l06.updated);
      await plan.saveEditorButton.click();
      await expect(plan.editorDialog).toHaveCount(0);

      await expect(plan.card('Groceries')).toContainText(expected.updatedBudgetAmount);
    });

    await test.step('Remove the item and confirm', async () => {
      await plan.deleteCardButton('Groceries').click();

      await expect(confirm.dialog).toBeVisible();
      await expect(confirm.heading).toHaveText(
        expected.deleteTitle.replace('{name}', 'Groceries'),
      );
      await expect(confirm.body).toContainText(expected.deleteBody);
      await expect(confirm.dangerLine).toHaveText(expected.deleteDanger);

      await confirm.confirm('Delete');

      await expect(plan.card('Groceries')).toHaveCount(0);
      await expect(plan.cardCountChip).toHaveCount(0);
    });

    await test.step('Add an item with no name and try to save', async () => {
      await plan.openNewItemModal();
      await plan.newItemNameInput.fill('');
      await plan.saveItemButton.click();

      const banner = await feedback.readBanner({
        title: expected.nameRequiredBanner.what,
      });
      expect(banner.title).toBe(expected.nameRequiredBanner.what);
      expect(banner.body).toBe(expected.nameRequiredBanner.why);
      expect(banner.fix).toBe(expected.nameRequiredBanner.fix);

      // The modal stays open and nothing was added.
      await expect(plan.newItemDialog).toBeVisible();
      await expect(plan.cardCountChip).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-L07 — the Month Plan quick-total checker
  // ─────────────────────────────────────────────────────────────────

  test('FIN-L07 The Month Plan quick-total checker', async ({ page }) => {
    const l07 = data.L07_quickTotal;
    const expected = l07.expected;

    await seedState(page, monthPlanState());

    await test.step('Open Plan → This month and scroll to the "Quick total" card', async () => {
      await plan.gotoMonth();

      await expect(plan.quickTotalLabel).toHaveText(expected.title);
      await expect(plan.quickTotalTitle).toHaveText(expected.subLine);
      await expect(plan.quickTotalExplanation).toHaveText(expected.explanation);
      await expect(plan.quickTotalIncomeInput).toBeVisible();
    });

    await test.step('Enter an income of 50000 and tick two items', async () => {
      await plan.setQuickTotalIncome(l07.income);

      await plan.quickTotalItem('Groceries').click();
      await plan.quickTotalItem('Rent').click();

      await expect(plan.quickTotalSelectionCount).toHaveText(
        l07.selectedCount.toString(),
      );
      await expect(plan.quickTotalSelectionCaption).toHaveText('of 2 selected');
    });

    await test.step('Read the totals', async () => {
      // 8,000 + 25,000 = 33,000 selected; the income is 50,000.
      await expect(plan.quickTotalTotal).toHaveText(
        `${expected.totalLabel} ${expected.totalAmount}`,
      );
      await expect(plan.quickTotalSaved).toHaveText(
        `${expected.savedLabel} ${expected.savedAmount}`,
      );
      await expect(plan.quickTotalOverBy).toHaveCount(0);
    });

    await test.step('Raise the income to 1000 so the selection costs more', async () => {
      await plan.setQuickTotalIncome(l07.lowIncome);

      await expect(plan.quickTotalOverBy).toHaveText(
        `${expected.overByLabel} ${expected.overByAmount}`,
      );
      await expect(plan.quickTotalSaved).toHaveCount(0);
    });

    await test.step('Click "Clear selection"', async () => {
      await plan.quickTotalClearSelectionButton.click();

      await expect(plan.quickTotalSelectionCount).toHaveText('0');
      await expect(plan.quickTotalTotal).toHaveText(`${expected.totalLabel} ${expected.emptyAmount}`);
    });

    await test.step('Reload the page and re-open the card', async () => {
      await page.reload();

      await expect(plan.quickTotalSelectionCount).toHaveText('0');
      await expect(plan.quickTotalTotal).toHaveText(`${expected.totalLabel} ${expected.emptyAmount}`);
      await expect(plan.quickTotalSaved).toHaveCount(0);
      await expect(plan.quickTotalOverBy).toHaveCount(0);

      // The income is reset too.
      await expect(plan.quickTotalIncomeInput).toHaveValue('');
    });

    await test.step('The empty state names the planner', async () => {
      // A separate, empty plan — the checker explains itself.
      // `reseedState` reloads, because an init script only runs on a
      // navigation.
      await reseedState(page, baseState());
      await plan.gotoMonth();

      await expect(plan.quickTotalEmptyState).toHaveText(expected.emptyState);
    });
  });
});
