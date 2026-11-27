/**
 * DebtsPage — `/debts`, `/debts/add`, `/debts/:id` and `/debts/:id/edit`.
 *
 * `src/screens/DebtsListScreen.tsx`:
 *   - each debt is a `div.card.card-link` with an absolutely-positioned
 *     `<Link aria-label={`View debt "${name}"`}>` covering it, so the
 *     card is addressed by that aria-label, not by a link role.
 *     The card opens the SLIP — the document you READ.
 *   - a flat card shows the direction tag ("I owe" / "Owed to me"),
 *     the name, "You've paid ৳ X of ৳ Y", "Owed to <person>", and a
 *     right zone with "Remaining" + "of ৳ Y total".
 *   - a loan card shows a "Loan" pill, "12% APR · 36mo",
 *     a "Loan amount" field with its figure on the line below,
 *     "Paid ৳ A interest and ৳ B principal",
 *     "Monthly EMI" and "Outstanding".
 *   - "Pay now" (i_owe) / "Receive now" (owed_to_me) opens the payment
 *     modal; it only renders for `status === 'active'`.
 *
 * `src/screens/DebtAddScreen.tsx` — "Direction", "Name",
 * "Total amount", "Cash goes into" / "Cash goes from", "Person
 * (optional)", "Due date (optional)", the loan checkbox, and (for a
 * loan) "Annual interest rate (%)" + "Term in months".
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export type DebtDirection = 'i_owe' | 'owed_to_me';

export class DebtsPage extends BasePage {
  /**
   * The "Add" link in the list header.
   *
   * The link's content is a "+" span plus an "Add" span, so its
   * accessible name is "+ Add".
   */
  get addButton(): Locator {
    return this.page.getByRole('link', { name: '+ Add', exact: true });
  }

  /** All debt cards. */
  get cards(): Locator {
    return this.page.locator('div.debt-cert');
  }

  /**
   * A debt card, by its name.
   *
   * A debt is a CERTIFICATE — a perforated sheet with a serial, a
   * stamp and engraved terms — so the card is found through the
   * certificate shell rather than the generic `.card` primitive.
   */
  card(name: string): Locator {
    return this.page.locator('div.debt-cert').filter({ hasText: name }).first();
  }

  /**
   * The card's full-card link — `View debt "{name}"`.
   *
   * The card opens the SLIP — the document you READ. The slip's own
   * Edit button opens the edit pass.
   */
  viewLink(name: string): Locator {
    return this.page.getByRole('link', { name: `View debt "${name}"` });
  }

  /**
   * The "Edit" link on the debt's detail screen.
   *
   * The detail screen is the slip; Edit is the button in its header
   * that opens the edit pass.
   */
  get editLink(): Locator {
    return this.page.getByRole('link', { name: 'Edit', exact: true });
  }

  /** The "Pay now" / "Receive now" chip on a card. */
  payChip(name: string): Locator {
    return this.card(name).getByRole('button', { name: /Pay now|Receive now/ });
  }

  // ── Card figures ──

  /**
   * The flat card's direction stamp — "I owe" or "Owed to me".
   *
   * The card is a certificate: the polarity is a rubber stamp in the
   * header, so it is read through the stamp element rather than by
   * any loose text match.
   */
  cardDirectionTag(name: string): Locator {
    return this.card(name).locator('.debt-cert__stamp').filter({ hasText: /^(I owe|Owed to me)$/ });
  }

  /**
   * The flat card's status line — "Nothing paid yet" /
   * "Nothing received yet" / "৳ X received so far".
   *
   * The card carries ONE figure (the amount still owed). This line
   * says in words whether anything has come in yet, which is the one
   * fact the hero amount cannot carry on its own.
   */
  cardPaidLine(name: string): Locator {
    return this.card(name).locator('.debt-cert__note span').first();
  }

  /**
   * The flat card's counterparty — the engraved "OWED TO" / "OWED BY"
   * label with the counterparty's name on the line beneath, sitting
   * beside the amount.
   *
   * The direction stamp in the header also starts with "Owed to", so
   * the locator reads the engraved FIELD, not a loose text match: the
   * stamp is a `.debt-cert__stamp`, the counterparty is a
   * `.debt-cert__v` whose `.k` is the label and whose `.n` is the name.
   *
   * It returns the whole BLOCK, so a spec can assert on the pair
   * ("Owed to Rahim") rather than on the name alone — the label is
   * half the fact.
   */
  cardCounterpartyLine(name: string): Locator {
    return this.card(name)
      .locator('.debt-cert__v')
      .filter({ has: this.card(name).locator('.k', { hasText: /Owed (to|by)/i }) });
  }

  /**
   * The card's headline remaining / EMI figure.
   *
   * The certificate's closing figures live in a `.debt-cert__v`
   * block, whose label and value are siblings — so the value is the
   * `.n` div next to the label.
   */
  cardHeadlineFigure(name: string): Locator {
    return this.card(name)
      .locator('.debt-cert__v--now')
      .locator('.n');
  }

  /**
   * The flat card's "of ৳ Y total" caption.
   *
   * The figure was REMOVED from the flat card: it repeated the amount
   * the hero figure already stated. This locator still points at the
   * place that figure used to sit, so a spec can assert it is gone.
   *
   * It matches on the field's LABEL ("Total"), not on the block's
   * class, because `.debt-cert__v--mat` is now the counterparty's
   * block on a flat card — matching the class would find the name
   * and the "it is gone" assertion would fail for the wrong reason.
   */
  cardTotalCaption(name: string): Locator {
    return this.card(name)
      .locator('.debt-cert__v')
      .filter({ has: this.card(name).locator('.k', { hasText: /^total$/i }) })
      .locator('.n');
  }

  /**
   * The card's "{n}% paid" progress caption.
   *
   * Only a LOAN card carries a rail and its caption — a flat card
   * states one figure and nothing else, so it has no "% paid" line.
   * This locator therefore resolves to a zero-count locator on a flat
   * card, which is how the suite asserts the flat card's
   * single-figure shape.
   */
  cardPercentPaid(name: string): Locator {
    return this.card(name).getByText(/% paid/, { exact: false });
  }

  /**
   * The loan card's "12% APR · 36mo" terms line.
   *
   * The APR and the term are two separate `<span>`s inside one div, so
   * the div is the unit that carries both halves of the phrase.
   */
  cardLoanTerms(name: string): Locator {
    return this.card(name).locator('div.t-12.tabular').filter({ hasText: '% APR' });
  }

  /**
   * The loan card's "Loan amount" field.
   *
   * The figure sits on its own line beneath the label, so the label
   * and the figure are separate elements — the field is the unit that
   * carries both.
   */
  cardLoanAmountField(name: string): Locator {
    return this.card(name)
      .locator('.debt-cert__f')
      .filter({ hasText: 'Loan amount' })
      .first();
  }

  /** The loan card's "Loan amount" label. */
  cardLoanAmountLabel(name: string): Locator {
    return this.cardLoanAmountField(name).locator('.k');
  }

  /** The loan card's "Loan amount" figure. */
  cardLoanAmount(name: string): Locator {
    return this.cardLoanAmountField(name).locator('.v');
  }

  /** The loan card's "Paid ৳ A interest and ৳ B principal" line. */
  cardLoanSplitLine(name: string): Locator {
    return this.card(name).getByText(/interest and/, { exact: false });
  }

  /** The loan card's "Monthly EMI" figure. */
  cardMonthlyEmi(name: string): Locator {
    return this.card(name)
      .locator('.debt-cert__v--now')
      .locator('.n');
  }

  /** The loan card's "Outstanding" figure. */
  cardOutstanding(name: string): Locator {
    return this.card(name)
      .locator('.debt-cert__v--mat')
      .locator('.n');
  }

  /**
   * A figure from the Summary card, by its label.
   *
   * The Summary is a statement certificate: each polarity is one
   * line of the breakdown — label on the left, figure on the right.
   */
  summaryValue(label: 'You owe' | 'Owed to you'): Locator {
    return this.summaryCard
      .locator('.debt-cert__line')
      .filter({ hasText: label })
      .locator('.v');
  }

  /** The Summary card's "Across N debt(s)" caption. */
  summaryCaption(label: 'You owe' | 'Owed to you'): Locator {
    return this.summaryCard
      .locator('.debt-cert__line')
      .filter({ hasText: label })
      .locator('.debt-cert__cap');
  }

  /** The "Summary" card — only rendered when something is outstanding. */
  get summaryCard(): Locator {
    return this.page.locator('section.debt-cert--statement').filter({ hasText: 'How it works:' });
  }

  /** The completed-debts group heading, e.g. "Completed (1)". */
  get completedHeading(): Locator {
    return this.page.getByRole('heading', { name: /Completed \(\d+\)/ });
  }

  /** The "Completed (n)" section card. */
  get completedSection(): Locator {
    return this.page
      .locator('section.debt-cert--settled')
      .filter({ has: this.page.getByRole('heading', { name: /Completed \(\d+\)/ }) });
  }

  /** A completed-debt row — "{total} paid off · {person} · {account}". */
  get completedRows(): Locator {
    return this.completedSection.locator('a');
  }

  // ── Add form ──

  get directionSelect(): Locator {
    return this.page.getByLabel('Direction');
  }

  get nameInput(): Locator {
    return this.page.getByLabel('Name', { exact: true });
  }

  get totalAmountInput(): Locator {
    return this.page.getByLabel('Total amount');
  }

  /**
   * The account picker.
   *
   * Its label flips with the direction — "Cash goes into" for
   * `i_owe`, "Cash goes from" for `owed_to_me`.
   */
  get accountSelect(): Locator {
    return this.page.getByLabel(/Cash goes into|Cash goes from/);
  }

  /**
   * The account field's LABEL — "Cash goes from".
   *
   * The label flips with the debt's direction, so it is the signal
   * that the form re-rendered for the owed-to-me case.
   */
  get accountFromLabel(): Locator {
    return this.page.getByLabel('Cash goes from');
  }

  /**
   * The account field's error line — "Pick an account."
   *
   * `Field` renders the error as the wrapper's own
   * `div.t-12.text-danger` child; the hint is hidden while an
   * error is present.
   */
  get accountHintText(): Locator {
    return this.page
      .locator(`label:text-is("Cash goes into"), label:text-is("Cash goes from")`)
      .locator('..')
      .locator('div.t-12.text-danger');
  }

  get personInput(): Locator {
    return this.page.getByLabel('Person (optional)');
  }

  get dueDateInput(): Locator {
    return this.page.getByLabel('Due date (optional)');
  }

  /** The "Is this a loan with interest?" checkbox. */
  get loanCheckbox(): Locator {
    return this.page.getByLabel('Mark this debt as a loan with interest');
  }

  get interestRateInput(): Locator {
    return this.page.getByLabel('Annual interest rate (%)');
  }

  get termMonthsInput(): Locator {
    return this.page.getByLabel('Term in months');
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save debt' });
  }

  /**
   * Submit the form WITHOUT the disabled-button guard.
   *
   * The manual cases reach the form's own validation by bypassing a
   * disabled submit button. Removing the `disabled` ATTRIBUTE is not
   * safe: React's virtual DOM still holds `disabled: true`, so the
   * next render does not re-apply the attribute and the button stays
   * wrongly enabled for the rest of the test.
   *
   * `requestSubmit()` runs the form's own `onSubmit` handler — the
   * app's validation banner — without touching the button at all.
   */
  async submitForm(): Promise<void> {
    await this.page
      .locator('form')
      .first()
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
  }

  /**
   * Clear the account picker.
   *
   * The picker offers no empty option — it defaults to the user's
   * first account — so the "Pick an account." state is reached by
   * writing the empty value the React state actually holds. The
   * `change` event is dispatched explicitly so the controlled select
   * picks the empty value up.
   */
  async clearAccountSelection(): Promise<void> {
    await this.accountSelect.evaluate((select: HTMLSelectElement) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value',
      )?.set;
      setter?.call(select, '');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /** The inline "Amount must be greater than zero." message. */
  get totalError(): Locator {
    return this.page.getByText('Amount must be greater than zero.', { exact: true });
  }

  /** The inline "Enter a rate greater than zero." message. */
  get rateError(): Locator {
    return this.page.getByText('Enter a rate greater than zero.', { exact: true });
  }

  /** The inline "Enter a term greater than zero." message. */
  get termError(): Locator {
    return this.page.getByText('Enter a term greater than zero.', { exact: true });
  }

  // ── Detail screen (the slip) ──

  /** The detail screen's H1 — the debt's name. */
  get detailHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** The "Fully paid." callout on the detail screen. */
  get fullyPaidCallout(): Locator {
    return this.page.getByText('Fully paid.', { exact: true });
  }

  // ── Edit screen ──

  /** The edit screen's H1. */
  get editHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /**
   * The account picker.
   *
   * The edit screen has NO account picker — repayments are tracked
   * via linked transactions, not here.
   */
  get accountPicker(): Locator {
    return this.page.getByLabel(/Cash goes into|Cash goes from/);
  }

  get saveChangesButton(): Locator {
    return this.page.getByRole('button', { name: 'Save changes' });
  }

  /** The "Delete debt" button in the danger zone. */
  get deleteButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete debt' });
  }

  /**
   * The "Activity" LEDGER SHEET — only rendered when payments exist.
   *
   * The debt detail screen's activity feed is a ruled sheet of the
   * same paper as the certificate, so it carries the `.act-sheet`
   * shell rather than the generic `.card` primitive.
   */
  get activityCard(): Locator {
    return this.page.locator('section.act-sheet').filter({ hasText: 'Activity' }).first();
  }

  /** The Activity card's "Payments" / "Total paid" / "Last payment" stats. */
  get activityStats(): Locator {
    return this.activityCard.locator('.act-sheet__stats');
  }

  /**
   * An activity row's tag — "Payment", "Received", "Reversal" or
   * "Adjust".
   *
   * The tag is the `<span>` whose text is the uppercased label, so the
   * rows' own "{TAG} · {date}" line is matched by its prefix.
   */
  activityTag(label: string): Locator {
    return this.activityCard.getByText(new RegExp(`^${label} · `));
  }

  /** Every activity row. */
  get activityRows(): Locator {
    return this.activityCard.locator('.act-row');
  }

  // ── Payment modal ──

  get paymentDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  /** The modal's title — `Pay toward "{name}"` / `Receive toward "{name}"`. */
  get paymentTitle(): Locator {
    return this.paymentDialog.getByRole('heading');
  }

  /** The modal's "Outstanding: ৳ N" line. */
  get paymentOutstanding(): Locator {
    return this.paymentDialog.getByText('Outstanding:', { exact: false });
  }

  get paymentAmountInput(): Locator {
    return this.page.getByLabel('Amount', { exact: true });
  }

  /**
   * The Amount field's hint.
   *
   * `Field` hides the hint whenever an error is showing, and the
   * Amount field starts empty for a flat debt — so the flat hint
   * ("Enter whatever you paid.") is never actually rendered. Only the
   * loan pre-fill note is observable.
   */
  get paymentAmountHint(): Locator {
    return this.paymentDialog.getByText(
      'Pre-filled with the standard EMI for ',
      { exact: false },
    );
  }

  /** The Amount field's inline error. */
  get paymentAmountError(): Locator {
    return this.paymentDialog.getByText('Amount must be greater than zero.', { exact: true });
  }

  get paymentDateInput(): Locator {
    return this.page.getByLabel('Date', { exact: true });
  }

  get paymentAccountSelect(): Locator {
    return this.page.getByLabel(/Paid from|Received into/);
  }

  get paymentNoteInput(): Locator {
    return this.page.getByLabel('Note (optional)');
  }

  /** The loan modal's "This payment will be split as:" preview block. */
  get splitPreview(): Locator {
    return this.paymentDialog.getByText('This payment will be split as:', { exact: true });
  }

  /**
   * The loan modal's "৳ N interest · ৳ M principal" figures.
   *
   * The split line is one div holding both figures; the underpayment
   * chip is a separate node, so the class distinguishes them.
   */
  get splitFigures(): Locator {
    return this.paymentDialog.locator('div.tabular.text-ink.font-semibold');
  }

  /** The loan modal's underpayment chip. */
  get underpaymentChip(): Locator {
    return this.paymentDialog.getByText(
      "Underpayment — this didn't cover the month's interest.",
      { exact: true },
    );
  }

  get recordPaymentButton(): Locator {
    return this.page.getByRole('button', { name: 'Record payment' });
  }

  // ── navigation ──

  async goto(): Promise<void> {
    await this.gotoRoute('/debts');
    await this.waitForAppReady();
  }

  async gotoAdd(): Promise<void> {
    await this.gotoRoute('/debts/add');
    await this.waitForAppReady();
  }

  /** Open a debt's detail screen (the slip). */
  async openDebt(name: string): Promise<void> {
    await this.viewLink(name).click();
    await this.waitForAppReady();
  }

  /**
   * Open a debt's EDIT screen.
   *
   * The card opens the slip; the slip's Edit button opens the edit
   * pass. So reaching the form takes two steps — click the card, then
   * click Edit.
   */
  async openEdit(name: string): Promise<void> {
    await this.openDebt(name);
    await this.editLink.click();
    await this.waitForAppReady();
  }

  /**
   * Open a COMPLETED debt's detail screen.
   *
   * A completed debt has left the active card grid, so it has no
   * "View debt {name}" overlay link — the completed row is a bare
   * `<Link>` whose text carries the debt's name.
   */
  async openCompletedDebt(name: string): Promise<void> {
    await this.completedRows.filter({ hasText: name }).first().click();
    await this.waitForAppReady();
  }

  /**
   * Fill the add-debt form.
   *
   * `direction` selects the option by label; `loan` toggles the
   * interest fields, which only exist for `i_owe`.
   */
  async fillForm(input: {
    name: string;
    direction: DebtDirection;
    total: string;
    accountName: string;
    person?: string;
    loan?: boolean;
    interestRate?: string;
    termMonths?: string;
  }): Promise<void> {
    await this.directionSelect.selectOption({
      label: input.direction === 'i_owe' ? 'I owe (you borrowed)' : 'Owed to me (you lent)',
    });
    await this.nameInput.fill(input.name);
    await this.totalAmountInput.fill(input.total);
    await this.accountSelect.selectOption({ label: input.accountName });
    if (input.person !== undefined) {
      await this.personInput.fill(input.person);
    }
    if (input.loan) {
      await this.loanCheckbox.check();
      await this.interestRateInput.fill(input.interestRate ?? '12');
      await this.termMonthsInput.fill(input.termMonths ?? '36');
    }
  }

  /** Fill the add-debt form and save, then wait for the list. */
  async createDebt(input: {
    name: string;
    direction: DebtDirection;
    total: string;
    accountName: string;
    person?: string;
    loan?: boolean;
    interestRate?: string;
    termMonths?: string;
  }): Promise<void> {
    await this.gotoAdd();
    await this.fillForm(input);
    await this.saveButton.click();
    await this.page.waitForURL(/#\/debts$/);
  }

  /**
   * Open the payment modal for a debt.
   *
   * The modal is portal-rendered, so its fields only exist once the
   * dialog is on screen.
   */
  async openPayment(debtName: string): Promise<void> {
    await this.payChip(debtName).click();
    await this.paymentDialog.waitFor({ state: 'visible' });
  }

  /**
   * Record a payment against a debt.
   *
   * `amount` is written even when the modal pre-filled it — the flat
   * form starts empty and the loan form starts with the EMI.
   */
  async recordPayment(input: {
    debtName: string;
    amount: string;
    date: string;
    accountName: string;
    note?: string;
  }): Promise<void> {
    await this.openPayment(input.debtName);
    await this.paymentAmountInput.fill(input.amount);
    await this.paymentDateInput.fill(input.date);
    await this.paymentAccountSelect.selectOption({ label: input.accountName });
    if (input.note !== undefined) {
      await this.paymentNoteInput.fill(input.note);
    }
    await this.recordPaymentButton.click();
    await this.paymentDialog.waitFor({ state: 'detached' });
  }
}
