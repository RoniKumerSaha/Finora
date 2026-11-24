/**
 * accounts.spec.ts — FIN-A01 … FIN-A07.
 *
 * The Accounts domain: the account lifecycle, the five account types,
 * the validation rules, the delete refusal, the first-run empty states,
 * the balance/delta metadata and the cancelled confirmation.
 *
 * Each manual case becomes EXACTLY ONE test, titled with its manual
 * ID and the manual title verbatim. `**Priority:** High` cases carry
 * the `@smoke` tag — in the details object, never in the title.
 */
import { expect, test } from '@playwright/test';
import { AccountsPage } from '../pages/AccountsPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import { HelpOverlay } from '../pages/component/HelpOverlay';
import { seedState } from '../fixtures/app-state';
import {
  accountMetadataState,
  baseState,
  firstRunState,
  linkedTransactionsState,
} from '../fixtures/seed-data';
import accountsJson from '../../data/accounts.json' with { type: 'json' };

const data = accountsJson;

test.describe('Accounts', () => {
  let accounts: AccountsPage;

  test.beforeEach(async ({ page }) => {
    accounts = new AccountsPage(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-A01 — account lifecycle
  // ─────────────────────────────────────────────────────────────────

  test('FIN-A01 Account lifecycle', { tag: '@smoke' }, async ({ page }) => {
    await seedState(page, firstRunState());

    await test.step('Open Accounts', async () => {
      await accounts.goto();
    });

    await test.step('Click "+ Add"', async () => {
      await accounts.addButton.click();
      await accounts.addHeading.waitFor({ state: 'visible' });
    });

    await test.step('Enter the name Cash', async () => {
      await accounts.nameInput.fill(data.A01_lifecycle.created.name);
    });

    await test.step('Leave the type as cash', async () => {
      await expect(accounts.typeSelect).toHaveValue('cash');
    });

    await test.step('Enter 5000 as the opening balance', async () => {
      await accounts.openingBalanceInput.fill(data.A01_lifecycle.created.openingBalance);
    });

    await test.step('Click "Save account"', async () => {
      await accounts.saveButton.click();
      await accounts.goto();
    });

    await test.step('Read the new account card', async () => {
      const card = accounts.card(data.A01_lifecycle.created.name);

      await expect(card).toBeVisible();
      await expect(accounts.balanceLabel(data.A01_lifecycle.created.name)).toHaveText('Balance');
      await expect(
        accounts.balanceValue(data.A01_lifecycle.created.name),
      ).toHaveText(data.A01_lifecycle.expected.initialBalance);

      // The type label reads Title Case even though the dropdown
      // offered the lowercase raw value.
      await expect(
        accounts.typeLabel(data.A01_lifecycle.created.name),
      ).toHaveText(data.A01_lifecycle.expected.initialTypeLabel);

      // The wallet pictogram.
      await expect(accounts.typeIcon(data.A01_lifecycle.created.name)).toBeVisible();

      // The card carries NO delta line at all: the screen guards the
      // whole secondary row with `(delta !== 0 || last)`, and a brand
      // new account has neither. See the known gap on FIN-A01.
      await expect(
        accounts.secondaryRow(data.A01_lifecycle.created.name),
      ).toHaveCount(0);
    });

    await test.step('Click the card', async () => {
      await accounts.card(data.A01_lifecycle.created.name).click();
      await accounts.editHeading.waitFor({ state: 'visible' });
    });

    await test.step('Change the name to Pocket Cash and the opening balance to 6000', async () => {
      await accounts.nameInput.fill(data.A01_lifecycle.edited.name);
      await accounts.openingBalanceInput.fill(data.A01_lifecycle.edited.openingBalance);
    });

    await test.step('Click "Save changes"', async () => {
      await accounts.saveButton.click();
      await accounts.goto();

      await expect(
        accounts.balanceValue(data.A01_lifecycle.edited.name),
      ).toHaveText(data.A01_lifecycle.expected.editedBalance);

      // ⚠️ Editing the OPENING BALANCE moves the balance AND the
      // baseline together, so the card's delta against the opening
      // balance stays 0 — and an account with no transactions renders
      // no secondary row at all. The "↑ ৳ 1,000 vs opening" the
      // manual case describes is therefore NOT rendered.
      // See the known gap on FIN-A01.
      await expect(
        accounts.secondaryRow(data.A01_lifecycle.edited.name),
      ).toHaveCount(0);
    });

    await test.step('Open the card\'s ⋯ menu and choose "Delete"', async () => {
      await accounts.openRowMenu(data.A01_lifecycle.edited.name);
      await accounts.chooseRowMenuItem('Delete');

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toContainText(data.A01_lifecycle.edited.name);
      await dialog.confirm('Delete');
    });

    await test.step('Click "Delete" in the confirmation', async () => {
      // The card is gone and the count line follows.
      await expect(accounts.card(data.A01_lifecycle.edited.name)).toHaveCount(0);
      await expect(accounts.countLine).toHaveText('0 total');

      // No error banner is raised by a successful delete.
      const feedback = new Feedback(page);
      await expect(feedback.banner).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-A02 — the five account types
  // ─────────────────────────────────────────────────────────────────

  test('FIN-A02 Account types table sweep', async ({ page }) => {
    await seedState(page, firstRunState());

    await test.step('Open the account add form', async () => {
      await accounts.gotoAdd();
    });

    await test.step('Open the Type dropdown and read every option', async () => {
      const options = await accounts.typeOptions.allTextContents();
      expect(options).toEqual(data.A02_typeSweep.dropdownOptions);

      // *Known gap:* PRD §9.3 specifies FIVE types, the fifth being
      // "Savings Account". The build ships "Card" instead — there is
      // no savings-account type at all.
      expect(options).not.toContain(data.A02_typeSweep.missingType);
      expect(options).not.toContain(data.A02_typeSweep.missingTypeLabel);
    });

    await test.step('Create one account of each type', async () => {
      for (const account of data.A02_typeSweep.accounts) {
        await accounts.gotoAdd();
        await accounts.nameInput.fill(account.name);
        await accounts.typeSelect.selectOption(account.type);
        await accounts.saveButton.click();
        await accounts.goto();
      }
    });

    await test.step('Compare the five resulting cards', async () => {
      for (let i = 0; i < data.A02_typeSweep.accounts.length; i++) {
        const account = data.A02_typeSweep.accounts[i];
        const label = data.A02_typeSweep.cardLabels[i];

        await expect(accounts.card(account.name)).toContainText(label);
        // Each type carries a distinct pictogram.
        await expect(accounts.typeIcon(account.name)).toBeVisible();
      }

      // There is no colour picker — the tone follows the type.
      await expect(accounts.gotoAdd()).resolves.toBeUndefined();
      await accounts.gotoAdd();
      await expect(accounts.colourPicker).toHaveCount(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-A03 — validation
  // ─────────────────────────────────────────────────────────────────

  test('FIN-A03 Account validation table sweep', { tag: '@smoke' }, async ({ page }) => {
    await seedState(page, firstRunState());
    const sweep = data.A03_validationSweep;

    await test.step('Row 1 — leave Name empty and observe "Save account"', async () => {
      await accounts.gotoAdd();
      await accounts.openingBalanceInput.fill('1000');

      await expect(accounts.saveButton).toBeDisabled();
    });

    await test.step('Row 2 — set Opening balance to -500', async () => {
      await accounts.openingBalanceInput.fill(sweep.negativeOpeningBalance.openingBalance);

      await expect(accounts.openingBalanceError).toBeVisible();
      await expect(accounts.saveButton).toBeDisabled();
      // The field carries the danger border.
      await expect(accounts.openingBalanceInput).toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('Row 3 — clear Name and clear Opening balance, then save', async () => {
      await accounts.nameInput.fill('');
      await accounts.openingBalanceInput.fill(sweep.emptyOpeningBalanceOnAdd.openingBalance);

      // An empty opening balance is ALLOWED on add.
      await expect(accounts.openingBalanceError).toHaveCount(0);
      await accounts.nameInput.fill('Zero Starter');
      await accounts.saveButton.click();
      await accounts.goto();

      await expect(
        accounts.balanceValue('Zero Starter'),
      ).toHaveText(sweep.emptyOpeningBalanceOnAdd.expectedBalance);
    });

    await test.step('Row 4 — open an account for editing and clear its Opening balance', async () => {
      await accounts.openEditForm('Zero Starter');
      await accounts.openingBalanceInput.fill(sweep.emptyOpeningBalanceOnEdit.openingBalance);

      // An empty opening balance is REJECTED on edit.
      await expect(accounts.openingBalanceError).toBeVisible();
    });

    await test.step('Row 5 — bypass the disabled save with an empty Name', async () => {
      await accounts.gotoAdd();
      await accounts.nameInput.fill('');

      // The manual case reaches the disabled button through devtools;
      // Playwright refuses to click a disabled button, so the DOM
      // attribute is removed first — the same thing devtools does.
      await accounts.saveButton.evaluate((button: HTMLButtonElement) => {
        button.removeAttribute('disabled');
      });
      await accounts.saveButton.click();

      const feedback = new Feedback(page);
      await feedback.expectBannerText(sweep.nameRequired.banner.what);
      await feedback.expectBannerText(sweep.nameRequired.banner.why);
      await feedback.expectBannerText(sweep.nameRequired.banner.fix);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-A04 — the delete refusal
  // ─────────────────────────────────────────────────────────────────

  test('FIN-A04 An account with linked transactions cannot be deleted', { tag: '@smoke' }, async ({ page }) => {
    const linked = data.A04_linkedTransactions;
    await seedState(page, linkedTransactionsState());

    await test.step('Open Accounts', async () => {
      await accounts.goto();
      await expect(accounts.card(linked.accountName)).toBeVisible();
    });

    await test.step('Open the ⋯ menu on the Cash card and choose "Delete"', async () => {
      await accounts.openRowMenu(linked.accountName);
      await accounts.chooseRowMenuItem('Delete');
    });

    await test.step('Click "Delete" in the confirmation', async () => {
      const dialog = new ConfirmDialog(page);
      await dialog.confirm('Delete');

      const feedback = new Feedback(page);
      await feedback.expectBannerText(linked.banner.what);
      await feedback.expectBannerText(linked.banner.why);
      await feedback.expectBannerText(linked.banner.fix);
    });
    // The account is NOT deleted and its card is still on screen.
    await expect(accounts.card(linked.accountName)).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-A05 — the first-run empty states and the learn-more overlay
  // ─────────────────────────────────────────────────────────────────

  test('FIN-A05 First-run empty states and the learn-more overlay', async ({ page }) => {
    const empty = data.A05_emptyStates;
    await seedState(page, firstRunState());

    await test.step('Open Accounts and read the empty state', async () => {
      await accounts.goto();

      await expect(accounts.emptyStateTitle).toHaveText(empty.accounts.title);
      await expect(accounts.emptyStateDescription).toHaveText(empty.accounts.description);
      await expect(accounts.emptyStateCta).toHaveText(empty.accounts.cta);
      await expect(accounts.learnMoreLink).toHaveText(empty.accounts.learnMore);

      // A 96×96 muted SVG illustration — no emoji.
      const illustration = accounts.emptyStateIllustration;
      await expect(illustration).toBeVisible();
      await expect(illustration).toHaveCSS('width', '96px');
      await expect(illustration).toHaveCSS('height', '96px');
      await expect(accounts.emptyStateIllustrationSvg).toHaveCount(1);
    });

    await test.step('Click "How accounts work →" and close it with the ×', async () => {
      await accounts.learnMoreLink.click();
      const overlay = new HelpOverlay(page);
      await expect(overlay.dialog).toBeVisible();
      await expect(overlay.title).toHaveText(empty.accounts.overlayTitle);

      // The overlay is a 480px modal. The `dialog` role is on the
      // full-bleed wrapper, so the width is asserted on the card.
      await expect(overlay.card).toHaveCSS('width', empty.overlay.width);

      await overlay.dismissWithCloseButton();
      await expect(overlay.dialog).toHaveCount(0);
    });

    await test.step('Open the overlay again and close it with "Got it"', async () => {
      await accounts.learnMoreLink.click();
      const overlay = new HelpOverlay(page);
      await expect(overlay.dialog).toBeVisible();

      await overlay.dismissWithGotIt();
      await expect(overlay.dialog).toHaveCount(0);
    });

    await test.step('Open it a third time and press Escape', async () => {
      await accounts.learnMoreLink.click();
      const overlay = new HelpOverlay(page);
      await expect(overlay.dialog).toBeVisible();

      await overlay.dismissWithEscape();
      await expect(overlay.dialog).toHaveCount(0);
    });

    await test.step('Open it a fourth time and click the backdrop', async () => {
      await accounts.learnMoreLink.click();
      const overlay = new HelpOverlay(page);
      await expect(overlay.dialog).toBeVisible();

      // The backdrop is a full-bleed button labelled "Close dialog".
      await expect(overlay.backdrop).toHaveAttribute('aria-label', empty.overlay.backdropLabel);

      await overlay.dismissWithBackdrop();
      await expect(overlay.dialog).toHaveCount(0);
    });

    await test.step('Open Transactions and click "How transactions work →"', async () => {
      await accounts.gotoRoute('/transactions');
      await accounts.waitForAppReady();

      const transactions = accounts.learnMoreButton(empty.transactions.learnMore);
      await expect(transactions).toBeVisible();
      await transactions.click();

      const overlay = new HelpOverlay(page);
      await expect(overlay.title).toHaveText(empty.transactions.overlayTitle);
      await overlay.dismissWithGotIt();
    });

    await test.step('Open Goals and click "How goals work →"', async () => {
      await accounts.gotoRoute('/goals');
      await accounts.waitForAppReady();

      const goals = accounts.learnMoreButton(empty.goals.learnMore);
      await expect(goals).toBeVisible();
      await goals.click();

      const overlay = new HelpOverlay(page);
      await expect(overlay.title).toHaveText(empty.goals.overlayTitle);
      await overlay.dismissWithGotIt();
    });

    await test.step('On Home, check the empty Transactions card', async () => {
      await accounts.gotoRoute('/home');
      await accounts.waitForAppReady();

      // Home reuses the shared empty state — but with its OWN copy:
      // the description and CTA differ from the list screens'.
      //
      // The empty ACCOUNTS card was removed on 2026-11-24 (Variant H
      // — The board) — the status bar's "Cash" cell carries the
      // "No accounts yet" caption instead — so only the empty
      // Transactions card remains.
      await expect(accounts.homeEmptyTitle('No accounts yet')).toHaveCount(0);
      await expect(
        accounts.homeEmptyDescription(
          'Add an account to track balances, transactions, and net worth.',
        ),
      ).toHaveCount(0);
      await expect(accounts.homeEmptyCta('+ Add an account')).toHaveCount(0);

      await expect(accounts.homeEmptyTitle('No transactions yet')).toBeVisible();
      await expect(accounts.homeEmptyCta('+ Add a transaction')).toBeVisible();

      // …including the learn-more link.
      await expect(
        accounts.learnMoreButton(empty.transactions.learnMore),
      ).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-A06 — balance, delta and last-activity metadata
  // ─────────────────────────────────────────────────────────────────

  test('FIN-A06 Account balance, delta line and last-activity metadata', { tag: '@smoke' }, async ({ page }) => {
    const meta = data.A06_balanceMetadata;
    await seedState(page, accountMetadataState());

    await test.step('Open Accounts', async () => {
      await accounts.goto();
    });

    await test.step('Read the Main Bank card\'s balance', async () => {
      // 120000 + 60000 − 18000 − 3000 = 159000, grouped en-IN.
      await expect(
        accounts.balanceValue(meta.accountName),
      ).toHaveText(meta.expected.balance);
    });

    await test.step('Read the card\'s secondary line', async () => {
      await expect(accounts.deltaLine(meta.accountName)).toContainText(
        meta.expected.delta,
      );
      await expect(accounts.deltaLine(meta.accountName)).toContainText(
        meta.expected.deltaSuffix,
      );

      // The last-activity half reads "Today" plus the category name.
      await expect(accounts.activityLine(meta.accountName)).toContainText('Today');
    });

    await test.step('Read the balance on a second account that has no transactions', async () => {
      // "bKash" is the control — nothing touches it in this fixture.
      await expect(accounts.balanceValue(meta.expected.idleAccountName)).toHaveText(
        meta.expected.idleAccountBalance,
      );

      // ⚠️ An account with NO transactions renders NO secondary row at
      // all. The card guards the row with `(delta !== 0 || last)`, and
      // an untouched account has delta 0 and no last activity — so
      // neither "— no change" nor "no activity yet" is ever shown.
      // See the known gap on FIN-A06.
      await expect(
        accounts.secondaryRow(meta.expected.idleAccountName),
      ).toHaveCount(0);
    });

    await test.step('Read the card of an account whose movements offset each other', async () => {
      // "Cash" receives the 3000 transfer out of Main Bank, so its
      // balance moved but its net delta against the opening balance is
      // zero — the "— no change" branch, WITH a last-activity date.
      await expect(
        accounts.balanceValue(meta.expected.offsettingAccountName),
      ).toHaveText(meta.expected.offsettingBalance);
      await expect(
        accounts.deltaLine(meta.expected.offsettingAccountName),
      ).toHaveText(meta.expected.offsettingDelta);
      await expect(
        accounts.activityLine(meta.expected.offsettingAccountName),
      ).toHaveText(meta.expected.offsettingActivity);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-A07 — cancelling a destructive confirmation
  // ─────────────────────────────────────────────────────────────────

  test('FIN-A07 Cancelling a destructive confirmation changes nothing', async ({ page }) => {
    const cancel = data.A07_cancelConfirmation;
    await seedState(page, baseState());

    await test.step('Open "Delete" and press Escape', async () => {
      await accounts.goto();
      await accounts.openRowMenu(cancel.accountName);
      await accounts.chooseRowMenuItem('Delete');

      const dialog = new ConfirmDialog(page);
      await expect(dialog.heading).toHaveText(cancel.dialogTitle);
      await dialog.dismissWithEscape();

      await expect(accounts.card(cancel.accountName)).toBeVisible();
      await expect(accounts.countLine).toHaveText('4 total');
    });

    await test.step('Repeat: open "Delete", then click "Cancel"', async () => {
      await accounts.openRowMenu(cancel.accountName);
      await accounts.chooseRowMenuItem('Delete');

      const dialog = new ConfirmDialog(page);
      await dialog.cancel();

      await expect(accounts.card(cancel.accountName)).toBeVisible();
      await expect(accounts.countLine).toHaveText('4 total');
    });

    await test.step('Repeat: open "Delete", then click the backdrop', async () => {
      await accounts.openRowMenu(cancel.accountName);
      await accounts.chooseRowMenuItem('Delete');

      const dialog = new ConfirmDialog(page);
      await dialog.dismissWithBackdrop();

      await expect(accounts.card(cancel.accountName)).toBeVisible();
      await expect(accounts.countLine).toHaveText('4 total');
    });

    // No banner or toast is raised by a cancelled confirmation.
    const feedback = new Feedback(page);
    await expect(feedback.banner).toHaveCount(0);
    await expect(feedback.toast).toHaveCount(0);
  });
});
