/**
 * goals.spec.ts — FIN-G01 … FIN-G04.
 *
 * The goals domain: the create / contribute / edit / remove / delete
 * lifecycle, the validation rules and the two terminal states
 * (complete, expired), the pace classification, and the
 * plan-not-ledger boundary (R11).
 *
 * Each manual case becomes EXACTLY ONE test, titled with its manual
 * ID and the manual title verbatim. `**Priority:** High` cases carry
 * the `@smoke` tag — in the details object, never in the title.
 *
 * Every selector lives in `GoalsPage` (or `AccountsPage` /
 * `TransactionsPage` / `HomePage`); this file carries no locator
 * strings and no copy literals — every user-visible string is read
 * from `test/data/goals.json`.
 */
import { expect, test } from '@playwright/test';
import { AccountsPage } from '../pages/AccountsPage';
import { GoalsPage } from '../pages/GoalsPage';
import { HomePage } from '../pages/HomePage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import { seedState, reseedState } from '../fixtures/app-state';
import {
  goalLedgerState,
  goalPaceState,
  goalStatusState,
  isoToday,
  noGoalsState,
} from '../fixtures/seed-data';
import { fmtBDT, requiredPerMonth, today } from '../support/money';
import goalsJson from '../../data/goals.json' with { type: 'json' };

const data = goalsJson;

test.describe('Goals', () => {
  let goals: GoalsPage;

  test.beforeEach(async ({ page }) => {
    goals = new GoalsPage(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-G01 — the goal lifecycle
  // ─────────────────────────────────────────────────────────────────

  test('FIN-G01 Goal lifecycle', { tag: '@smoke' }, async ({ page }) => {
    const lifecycle = data.G01_lifecycle;
    await seedState(page, noGoalsState());

    await test.step('Open Goals and click "+ New goal"', async () => {
      await goals.goto();
      await goals.emptyStateCta.click();

      await goals.saveButton.waitFor({ state: 'visible' });
    });

    await test.step(
      'Enter the name, already saved, target and target date, and save',
      async () => {
        await goals.fillForm({
          name: lifecycle.created.name,
          alreadySaved: lifecycle.created.alreadySaved,
          target: lifecycle.created.target,
          targetDate: lifecycle.created.targetDate,
        });
        await goals.saveButton.click();

        await expect(page).toHaveURL(/#\/goals$/);
      },
    );

    await test.step('Read the goal card', async () => {
      const card = goals.card(lifecycle.created.name);
      await expect(card).toBeVisible();

      // The receipt states each fact on its own line — TARGET
      // "৳ 50,000", SAVED "৳ 10,000", DUE "30 Jun 2027".
      await expect(goals.cardTargetValue(lifecycle.created.name)).toHaveText(
        lifecycle.expected.cardTarget,
      );
      await expect(goals.cardSavedValue(lifecycle.created.name)).toHaveText(
        lifecycle.expected.cardSaved,
      );
      await expect(goals.cardDueValue(lifecycle.created.name)).toHaveText(
        lifecycle.expected.cardDate,
      );

      // The PROGRESS figure reads 20%.
      await expect(goals.progressBar(lifecycle.created.name)).toHaveAttribute(
        'aria-valuenow',
        '20',
      );

      // The receipt's total — "Still needed" ৳ 40,000.
      await expect(goals.remainingLine(lifecycle.created.name)).toBeVisible();
      await expect(goals.totalValue(lifecycle.created.name)).toHaveText(
        lifecycle.expected.cardRemaining,
      );

      // The per-month figure is DERIVED from the deadline, so it
      // moves with the calendar — the expectation is computed with
      // the app's own rule rather than frozen.
      const remaining = 50000 - 10000;
      const perMonth = requiredPerMonth(remaining, lifecycle.created.targetDate, today());
      await expect(goals.perMonthLine(lifecycle.created.name)).toContainText(
        fmtBDT(perMonth),
      );
      await expect(goals.perMonthLine(lifecycle.created.name)).toContainText('/mo');
    });

    await test.step('Open the goal and click "+ Add a contribution"', async () => {
      await goals.openGoal(lifecycle.created.name);
      await goals.addContributionButton.click();

      await goals.contributionDialog.waitFor({ state: 'visible' });
    });

    await test.step('Read the contribution modal', async () => {
      await expect(goals.contributionDialogTitle).toHaveText(
        lifecycle.expected.contributionModalTitle,
      );
      await expect(goals.contributionDialogSubLine).toHaveText(
        lifecycle.expected.contributionModalSubLine,
      );

      // The three fields.
      await expect(goals.contributionAmountInput).toBeVisible();
      await expect(goals.contributionDateInput).toBeVisible();
      await expect(goals.contributionNoteInput).toBeVisible();
    });

    await test.step('Escape closes the modal without recording', async () => {
      await page.keyboard.press('Escape');
      await goals.contributionDialog.waitFor({ state: 'detached' });

      // Nothing was recorded — the saved figure is unchanged.
      await expect(goals.savedSoFarValue).toHaveText(lifecycle.expected.cardSaved);
    });

    await test.step('A backdrop click also closes it without recording', async () => {
      await goals.addContributionButton.click();
      await goals.contributionDialog.waitFor({ state: 'visible' });

      // The backdrop is a `<button aria-label="Close dialog">` that
      // sits BEHIND the modal card, so its own centre is covered —
      // the click has to land on the exposed strip at the corner.
      // `clickModalBackdrop` does exactly that.
      await goals.clickModalBackdrop(goals.contributionDialog);

      await goals.contributionDialog.waitFor({ state: 'detached' });
      await expect(goals.savedSoFarValue).toHaveText(lifecycle.expected.cardSaved);
    });

    await test.step(
      'Enter 5000 with the note "December saving" and save',
      async () => {
        await goals.addContributionButton.click();
        await goals.contributionDialog.waitFor({ state: 'visible' });
        await goals.contributionAmountInput.fill(lifecycle.contribution.amount);
        await goals.contributionNoteInput.fill(lifecycle.contribution.note);
        await goals.submitContributionButton.click();

        await goals.contributionDialog.waitFor({ state: 'detached' });
      },
    );

    await test.step('Read the contribution banner', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(lifecycle.expected.contributionBanner);
      await feedback.expectBannerText(lifecycle.expected.contributionBannerBody);
      await feedback.expectBannerText(lifecycle.expected.contributionBannerFix);
    });
    await test.step('Open the goal, change the target to 60000, and save', async () => {
      await goals.openEditForm();
      await goals.targetAmountInput.fill(lifecycle.edited.target);
      await goals.saveChangesButton.click();

      await expect(goals.targetValue).toHaveText(fmtBDT(60000));
    });

    await test.step('Read the "Goal updated" banner and the amber note', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(lifecycle.expected.updateToast);
      // The amber note is on the edit FORM, so it is read while the
      // form is open — it is the form's own warning.
      await goals.openEditForm();
      await expect(goals.editHeadsUpWarning).toBeVisible();
      await expect(goals.editHeadsUpWarning).toContainText(
        lifecycle.expected.updateWarning,
      );
      await goals.cancelEditButton.click();
    });

    await test.step('Remove the contribution', async () => {
      await goals.removeContributionButton.first().click();

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(lifecycle.expected.removeConfirm);
      await dialog.confirm('Remove');
    });

    await test.step('Read the "Contribution removed" banner', async () => {
      const feedback = new Feedback(page);
      await feedback.expectBannerText(lifecycle.expected.removeToast);
    });
    await test.step('Delete the goal', async () => {
      await goals.deleteButton.click();

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(lifecycle.expected.deleteConfirm);
      await dialog.confirm('Delete goal');

      await expect(page).toHaveURL(/#\/goals$/);
      await expect(goals.card(lifecycle.created.name)).toHaveCount(0);
    });

    await test.step('Read the "Goal deleted" banner', async () => {
      // The banner is raised by the delete and the screen then
      // navigates away, so its 3 s lifetime starts at the click — it
      // can be GONE by the time a later step looks for it. The
      // retrying `expect` on the banner locator re-checks until the
      // banner appears, rather than failing with a bare
      // "element(s) not found".
      const feedback = new Feedback(page);
      await expect(feedback.banner).toContainText(lifecycle.expected.deleteToast, {
        timeout: 5_000,
      });
      await expect(feedback.banner).toContainText(lifecycle.expected.deleteToastBody);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-G02 — validation and the two status states
  // ─────────────────────────────────────────────────────────────────

  test('FIN-G02 Goal validation and status states', { tag: '@smoke' }, async ({ page }) => {
    const validation = data.G02_validation;
    await seedState(page, noGoalsState());

    await test.step('Open the Add goal form', async () => {
      await goals.gotoAdd();
    });

    await test.step('Leave Name empty and try to save', async () => {
      await goals.fillForm({
        name: '',
        alreadySaved: '0',
        target: '50000',
        targetDate: '2027-06-30',
      });

      // The save is disabled.
      await expect(goals.saveButton).toBeDisabled();

      // Bypassing it raises the banner — the same thing the manual
      // case reaches through devtools.
      await goals.saveButton.evaluate((button: HTMLButtonElement) => {
        button.removeAttribute('disabled');
      });
      await goals.saveButton.click();

      const feedback = new Feedback(page);
      await feedback.expectBannerText(validation.nameRequired.banner.what);
      await feedback.expectBannerText(validation.nameRequired.banner.why);
      await feedback.expectBannerText(validation.nameRequired.banner.fix);
    });
    await test.step('Enter 0 as the Target, then -1', async () => {
      await goals.nameInput.fill('Validation goal');

      for (const target of ['0', '-1']) {
        await goals.targetAmountInput.fill(target);

        // The inline error appears.
        await expect(goals.fieldError('Target amount')).toHaveText(
          validation.targetError,
        );
        await expect(goals.saveButton).toBeDisabled();
      }
    });

    await test.step('Leave Already saved empty', async () => {
      await goals.targetAmountInput.fill('50000');
      await goals.alreadySavedInput.fill('');

      // The inline error appears — an empty "Already saved" is
      // invalid, so the field is effectively required.
      await expect(goals.fieldError('Already saved')).toHaveText(
        validation.alreadySavedError,
      );
      await expect(goals.saveButton).toBeDisabled();
    });

    await test.step('Leave Target date empty and try to save', async () => {
      await goals.alreadySavedInput.fill('0');
      await goals.targetDateInput.fill('');

      // The save is disabled.
      await expect(goals.saveButton).toBeDisabled();

      // Bypassing it raises the banner.
      await goals.saveButton.evaluate((button: HTMLButtonElement) => {
        button.removeAttribute('disabled');
      });
      await goals.saveButton.click();

      const feedback = new Feedback(page);
      await feedback.expectBannerText(validation.dateRequired.banner.what);
      await feedback.expectBannerText(validation.dateRequired.banner.why);
      await feedback.expectBannerText(validation.dateRequired.banner.fix);
    });
    await test.step('Enter a target date in the past and save', async () => {
      await goals.fillForm({
        name: 'Past date goal',
        alreadySaved: '0',
        target: '50000',
        targetDate: validation.pastDate,
      });
      await goals.saveButton.click();

      // The goal is ACCEPTED — no date validation exists, even
      // though the error copy promises "Pick a date in the future".
      await expect(page).toHaveURL(/#\/goals$/);
      await expect(goals.card('Past date goal')).toBeVisible();
    });

    await test.step('Create a goal, then contribute until the target is reached', async () => {
      // The seed lands on the NEXT load — an init script only runs
      // on a navigation, and the page is already on the add form.
      await reseedState(page, goalStatusState());

      await goals.goto();

      // The card reads "Goal reached. Nice."
      await expect(goals.reachedLine(validation.reached.name)).toContainText(
        validation.reached.cardText,
      );

      await goals.openGoal(validation.reached.name);

      // The detail screen reads
      // "Goal reached. ৳ 50,000 saved · target ৳ 50,000".
      await expect(goals.goalReachedDetail).toHaveText(validation.reached.detailText);

      // "+ Add a contribution" is hidden.
      await expect(goals.addContributionButton).toHaveCount(0);

      // "Required per month" reads "— done —".
      await expect(goals.requiredPerMonthValue).toHaveText(
        validation.reached.requiredPerMonth,
      );
    });

    await test.step('Create a second goal whose target date has passed', async () => {
      await goals.goto();
      const card = goals.card(validation.expired.name);
      await expect(card).toBeVisible();

      // The receipt's footnote reads "Overdue — no monthly plan" —
      // an expired goal has no finite per-month requirement, so the
      // footnote says so INSTEAD of a per-month figure. The stamp
      // at the top-right reads "Overdue" too.
      await expect(goals.overdueLine(validation.expired.name)).toHaveText(
        validation.expired.pace,
      );
      await expect(goals.stamp(validation.expired.name)).toHaveText(
        validation.expired.stamp,
      );
      await expect(goals.paceLine(validation.expired.name)).toHaveCount(0);

      await goals.openGoal(validation.expired.name);

      // The detail screen reads
      // "Target date passed. Either extend it or close the goal."
      await expect(goals.goalExpiredBanner).toHaveText(validation.expired.detailText);

      // "Required per month" reads "— past due —".
      await expect(goals.requiredPerMonthValue).toHaveText(
        validation.expired.requiredPerMonth,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-G03 — the pace classification
  // ─────────────────────────────────────────────────────────────────

  test('FIN-G03 Goal pace — ahead, on track and behind', async ({ page }) => {
    const pace = data.G03_pace;
    await seedState(page, goalPaceState());

    await test.step('Open Goals and read both cards', async () => {
      await goals.goto();

      await expect(goals.card(pace.ahead.name)).toBeVisible();
      await expect(goals.card(pace.behind.name)).toBeVisible();
    });

    await test.step('Read the pace line on each card', async () => {
      await expect(goals.paceLine(pace.ahead.name)).toContainText(pace.expected.aheadPace);
      await expect(goals.paceLine(pace.behind.name)).toContainText(pace.expected.behindPace);
    });

    await test.step('Read the PROGRESS figure on each card', async () => {
      await expect(goals.percentChip(pace.ahead.name)).toHaveText(
        pace.expected.aheadPercent,
      );
      await expect(goals.percentChip(pace.ahead.name)).toHaveAttribute(
        'title',
        pace.expected.aheadChipTitle,
      );

      await expect(goals.percentChip(pace.behind.name)).toHaveText(
        pace.expected.behindPercent,
      );
      await expect(goals.percentChip(pace.behind.name)).toHaveAttribute(
        'title',
        pace.expected.behindChipTitle,
      );
    });

    await test.step('Open a goal that is neither complete nor expired and read its progress figure', async () => {
      await goals.openGoal(pace.ahead.name);

      // The detail screen reports the same percentage — the pace
      // itself is a card-only affordance, so the card is the place
      // the "Pace:" word lives.
      await expect(goals.percentComplete).toContainText(pace.expected.aheadPercent);
      await expect(goals.paceLine(pace.ahead.name)).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-G04 — a contribution never moves a balance
  // ─────────────────────────────────────────────────────────────────

  test('FIN-G04 A goal contribution never moves an account balance', { tag: '@smoke' }, async ({ page }) => {
    const ledger = data.G04_noLedgerEffect;
    await seedState(page, goalLedgerState());

    const accounts = new AccountsPage(page);
    const transactions = new TransactionsPage(page);
    const home = new HomePage(page);

    // The Home Cash figure, read before the contribution, so the
    // after-read can assert it did not move.
    let cashBefore = '';

    await test.step('Read the balance of Cash on Accounts', async () => {
      await accounts.goto();
      await expect(accounts.balanceValue(ledger.accountName)).toHaveText(
        ledger.expected.balanceBefore,
      );
    });

    await test.step('Read the Home status bar BEFORE the contribution', async () => {
      await home.goto();

      // The Cash figure is the sum of every account balance — this is
      // the value the contribution must not move.
      //
      // (The "This month" card this case used to read was removed on
      // 2026-11-24, Variant H — The board.)
      cashBefore = (await home.stripValue('Cash').innerText()).trim();
    });

    await test.step('Create a goal with target 50000 and contribute 5000 to it', async () => {
      await goals.goto();
      await goals.emptyStateCta.click();

      await goals.fillForm({
        name: 'Contribution goal',
        alreadySaved: '0',
        target: ledger.target,
        targetDate: '2027-06-30',
      });
      await goals.saveButton.click();

      await expect(page).toHaveURL(/#\/goals$/);

      await goals.openGoal('Contribution goal');
      await goals.contribute({
        amount: ledger.contribution,
        date: isoToday(),
      });
    });

    await test.step('Read the balance of Cash on Accounts again', async () => {
      await accounts.goto();

      // The balance is UNCHANGED — a contribution is a plan entry.
      await expect(accounts.balanceValue(ledger.accountName)).toHaveText(
        ledger.expected.balanceAfter,
      );
    });

    await test.step('Read the Transactions list', async () => {
      await transactions.goto();

      // The list is EMPTY — a contribution creates no transaction.
      await expect(transactions.rows).toHaveCount(0);
    });

    await test.step('Read the Home status bar', async () => {
      await home.goto();

      // A contribution is plan data, not a transaction — so the
      // account balance the Cash figure is built from is unchanged.
      await expect(home.stripValue('Cash')).toHaveText(cashBefore);
    });

    await test.step('The goal\'s own saved figure does rise', async () => {
      await goals.goto();
      await goals.openGoal('Contribution goal');

      // The contribution IS recorded — as plan data only.
      await expect(goals.savedSoFarValue).toHaveText(ledger.expected.savedAfter);
    });
  });
});
