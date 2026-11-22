/**
 * TransactionsPage — `/transactions`, the three add forms and the edit
 * form.
 *
 * `src/screens/TransactionsListScreen.tsx`:
 *   - 8 filter chips: All · Income · Expense · Transfer · Payouts ·
 *     Debt payments · This month · Cash. Single-select; clicking the
 *     active chip resets to "All".
 *   - The unfiltered ("all") view groups rows under day subheaders
 *     ("25 Aug 2026"). Any other filter collapses to a flat list.
 *   - Rows are `<Link>`s to the edit screen.
 *
 * The add flow is a picker at `/transactions/new` with three
 * per-type forms under `/transactions/new/{expense,income,transfer}`.
 * `src/screens/AddTransactionForm.tsx` renders one shared body:
 *   - a big Amount field (the placeholder varies by type),
 *   - preset chips + a helper line on the EXPENSE form only,
 *   - a Category chip picker (grouped for expense, flat for income),
 *   - Account + Date for income / expense, From + To for transfer,
 *   - a linked-debt select (expense) and a linked-investment select
 *     (income),
 *   - a "Save" submit button, disabled while the amount is invalid.
 *
 * `src/screens/TransactionEditScreen.tsx` is a DIFFERENT form: no
 * presets, no projections, no type selector, the label "Category"
 * (no "(optional)"), the label "Note" with its hint, a "🗑 Delete"
 * button and a "Save" button (NOT "Save changes").
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export type FilterLabel =
  | 'All'
  | 'Income'
  | 'Expense'
  | 'Transfer'
  | 'Payouts'
  | 'Debt payments'
  | 'This month'
  | 'Cash';

/** The three transaction types the picker offers. */
export type TransactionType = 'income' | 'expense' | 'transfer';

/** The H1 each per-type add screen renders. */
const FORM_HEADINGS: Record<TransactionType, string> = {
  income: 'Add income',
  expense: 'Add expense',
  transfer: 'Transfer',
};

/** The label on each type-picker card. */
const TYPE_CARD_LABELS: Record<TransactionType, string> = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
};

export class TransactionsPage extends BasePage {
  /** The "Add" link in the list header. */
  get addButton(): Locator {
    return this.page.getByRole('link', { name: '+ Add', exact: true });
  }

  /** All filter chips. */
  get filterChips(): Locator {
    return this.page.locator('button.rounded-pill');
  }

  /** A specific filter chip. */
  filterChip(label: FilterLabel): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  /**
   * The single ACTIVE filter chip.
   *
   * The active chip is the only one carrying an inline `box-shadow`
   * (the "inner ring" selected state); the inactive ones have no
   * inline style at all.
   */
  get activeFilterChip(): Locator {
    return this.page.locator('button.rounded-pill[style*="inset"]');
  }

  /**
   * The header count line — "8 entries" / "3 of 8 entries".
   *
   * It is the only node on the screen whose text ends in "entries".
   */
  get headerCount(): Locator {
    return this.page.getByText(/\d+( of \d+)? entries/);
  }

  /**
   * Any totals summary on the list.
   *
   * The app renders none — the header carries a count only — so this
   * locator is how a case proves the ABSENCE of a totals row.
   *
   * It is scoped to the LIST CARD so the "Income" FILTER CHIP (whose
   * label is the same word) is not counted as a totals row.
   */
  get totalsSummary(): Locator {
    return this.page
      .locator('section.card')
      .getByText(/^(Income|Expenses|Net saved)$/);
  }

  /** Any search field. The app ships none. */
  get searchField(): Locator {
    return this.page.getByRole('searchbox');
  }

  /** Any select at all — the list has no sort or filter control. */
  get sortControl(): Locator {
    return this.page.getByRole('combobox');
  }

  /** All transaction rows. */
  get rows(): Locator {
    return this.page.locator('a.row-hover');
  }

  /** A transaction row, matched by its title text. */
  row(title: string): Locator {
    return this.page.locator('a.row-hover').filter({ hasText: title }).first();
  }

  /**
   * A transaction row, matched by its formatted amount.
   *
   * Used when a row's title is not in the shared data store (a
   * fixture-specific note, say).
   */
  rowByAmount(amount: string): Locator {
    return this.page.locator('a.row-hover').filter({ hasText: amount }).first();
  }

  /**
   * The pill tag on a transaction row — "Borrowed", "Lent",
   * "Debt payment", "Debt received" or "Payout".
   *
   * `TransactionTag` renders a `<span aria-label="category: …">`, so
   * the label is the reliable handle.
   */
  rowTag(title: string): Locator {
    return this.row(title).locator('[aria-label^="category: "]');
  }

  /** A row's title — the note, the category or the type name. */
  titleOf(row: Locator): Locator {
    return row.locator('div.font-semibold span.min-w-0');
  }

  /** A row's subtitle — the account, the category, or the transfer. */
  subtitleOf(row: Locator): Locator {
    return row.locator('div.text-xs.text-muted');
  }

  /** A row's amount — the bold, tabular figure. */
  amountOf(row: Locator): Locator {
    return row.locator('div.font-bold.tabular');
  }

  /**
   * The transaction id behind a row's edit link.
   *
   * The row is a `<Link to="/transactions/{id}/edit">`, so the id is
   * read straight off the href.
   */
  async rowEditId(title: string): Promise<string> {
    const href = await this.row(title).getAttribute('href');
    if (!href) throw new Error(`Row "${title}" has no href`);
    const match = href.match(/\/transactions\/([^/]+)\/edit/);
    if (!match) throw new Error(`Row "${title}" href is not an edit route: ${href}`);
    return match[1];
  }

  /** The day subheaders in the unfiltered view. */
  get dayHeaders(): Locator {
    return this.page.locator('div.sticky.top-\\[60px\\]');
  }

  /**
   * A row's title — the note, the category or the type name.
   *
   * `TxRow` renders `tx.note || cat?.name || tx.type`, so a row with
   * no note and no category falls back to the type name.
   */
  rowTitle(title: string): Locator {
    return this.row(title).locator('span.min-w-0.truncate.grow');
  }

  /** The empty-state CTA. */
  get emptyStateCta(): Locator {
    return this.page.getByRole('link', { name: '+ Add transaction' });
  }

  /** The plain "no match" line shown when a non-"All" filter is empty. */
  get noMatchMessage(): Locator {
    return this.page.getByText('No transactions match this filter', { exact: false });
  }

  // ── Type picker ──

  /** The picker's H1 — "What happened?". */
  get pickerHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'What happened?' });
  }

  /**
   * The "What happened?" picker's three type cards.
   *
   * Each card is a `<button>` whose text is the label plus a hint
   * ("Income" + "Money received"), so the accessible name is the
   * concatenation of both. The regex anchors on the label so the
   * match cannot drift onto an unrelated button.
   */
  typeCards(): Locator {
    return this.page.getByRole('button', {
      name: /^(Income|Expense|Transfer)( .+)?$/,
    });
  }

  /**
   * One of the three type cards on the picker.
   *
   * The card is a `<button>` whose text is the label plus a hint
   * ("Income" + "Money received"), so the match is a substring.
   */
  typeCard(type: TransactionType): Locator {
    return this.page
      .getByRole('button')
      .filter({ hasText: TYPE_CARD_LABELS[type] })
      .first();
  }

  /** The H1 of a per-type add form. */
  formHeading(type: TransactionType): Locator {
    return this.page.getByRole('heading', { level: 1, name: FORM_HEADINGS[type] });
  }

  /**
   * The picker's "+ Add transaction" link.
   *
   * The picker screen's own CTA carries the full label, while the
   * Transactions LIST header's link reads just "+ Add".
   */
  get addTransactionLink(): Locator {
    return this.page.getByRole('link', { name: '+ Add transaction' });
  }

  // ── Add form ──

  get amountInput(): Locator {
    return this.page.getByLabel('Amount');
  }

  /**
   * The amount field's helper line — "Tap a preset chip to autofill
   * common amounts." Expense form only.
   */
  get amountHelper(): Locator {
    return this.page.getByText('Tap a preset chip to autofill common amounts.', {
      exact: true,
    });
  }

  /**
   * Put a raw string into the amount field, the way a PASTE would.
   *
   * The field is `<input type="number">`, so `fill()` refuses any
   * value the browser considers un-numeric ("abc", "NaN",
   * "Infinity"). A paste is not subject to that constraint the same
   * way — the browser keeps the text and reports it as an invalid
   * value — so the value is set through the DOM and the React
   * `onChange` is dispatched explicitly.
   *
   * This is what the manual's invalid-amount sweep needs: the FORM
   * has to be able to hold a non-numeric string so its own guard can
   * reject it.
   */
  async pasteAmount(value: string): Promise<void> {
    await this.amountInput.evaluate((input: HTMLInputElement, text: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  /**
   * The amount field's rendered placeholder.
   *
   * The placeholder is type-dependent ("250" on expense, "60,000" on
   * income, "5,000" on transfer), so it is READ from the DOM rather
   * than hard-coded here.
   *
   * Prefer `expect(amountInput).toHaveAttribute('placeholder', …)` in
   * a spec: that assertion RETRIES, so it survives the route
   * transition still swapping the previous form's placeholder in.
   * This reader takes a snapshot and does not — it is kept for the
   * cases that need the value as a string.
   */
  async amountPlaceholder(): Promise<string> {
    return (await this.amountInput.getAttribute('placeholder')) ?? '';
  }

  get accountSelect(): Locator {
    return this.page.getByLabel('Account', { exact: true });
  }

  get fromSelect(): Locator {
    return this.page.getByLabel('From', { exact: true });
  }

  get toSelect(): Locator {
    return this.page.getByLabel('To', { exact: true });
  }

  /** The From dropdown's options. */
  get fromOptions(): Locator {
    return this.fromSelect.locator('option');
  }

  /** The To dropdown's options. */
  get toOptions(): Locator {
    return this.toSelect.locator('option');
  }

  /**
   * The big left-right arrow between the From and To selects.
   *
   * It is the only `self-center` accent-coloured element on the
   * transfer form.
   */
  get transferArrow(): Locator {
    return this.page.locator('div.self-center.text-accent svg');
  }

  get dateInput(): Locator {
    return this.page.getByLabel('Date', { exact: true });
  }

  /** The add form's note field — the label carries "(optional)". */
  get noteInput(): Locator {
    return this.page.getByLabel('Note (optional)');
  }

  /**
   * The edit form's note field.
   *
   * The edit form labels it plain **"Note"** with the hint "Add or
   * change a note. Leave blank to remove." — no "(optional)" suffix.
   */
  get editNoteInput(): Locator {
    return this.page.getByLabel('Note', { exact: true });
  }

  /**
   * A type selector.
   *
   * The app ships none — the transaction type is locked on the edit
   * form — so a case asserts `toHaveCount(0)` on this locator.
   */
  get typeSelect(): Locator {
    return this.page.getByLabel('Type', { exact: true });
  }

  // ── Category picker ──

  /**
   * A category chip.
   *
   * `CategoryTile` is a `div[role="button"]`, not a `<button>`, so
   * `getByRole('button')` would not reach it without a name match.
   */
  categoryChip(name: string): Locator {
    return this.page.locator('div[role="button"]').filter({ hasText: name }).first();
  }

  /** Every category chip on screen. */
  get categoryChips(): Locator {
    return this.page.locator('div[role="button"]');
  }

  /** The group headings of the grouped (expense) picker. */
  get categoryGroups(): Locator {
    return this.page.locator('h4');
  }

  /** One group heading, by its label. */
  groupHeading(label: string): Locator {
    return this.page.locator('h4').filter({ hasText: label }).first();
  }

  /**
   * The edit form's category label.
   *
   * It reads plain "Category" — the add form's reads
   * "Category (optional)", so an exact match only ever finds the
   * edit form's label.
   */
  get editCategoryLabel(): Locator {
    return this.page.getByText('Category', { exact: true });
  }

  /**
   * The ADD form's category label — "Category (optional)".
   *
   * The "(optional)" suffix is what distinguishes it from the edit
   * form's plain "Category".
   */
  get addCategoryLabel(): Locator {
    return this.page.getByText('Category (optional)', { exact: true });
  }

  /** The "Selected" caption that appears above a chosen category. */
  get selectedCategoryLabel(): Locator {
    return this.page.getByText('Selected', { exact: true });
  }

  /** The × button that clears the chosen category. */
  get clearCategoryButton(): Locator {
    return this.page.getByRole('button', { name: 'Clear selected category' });
  }

  /** The "Show all N categories" expander (expense form only). */
  get showAllCategoriesButton(): Locator {
    return this.page.getByRole('button', { name: /Show all \d+ categor/ });
  }

  /** The "Hide list" collapser (expense form only). */
  get hideListButton(): Locator {
    return this.page.getByRole('button', { name: 'Hide list' });
  }

  // ── Linked records ──

  get linkedDebtSelect(): Locator {
    return this.page.getByLabel('Linked debt (optional)');
  }

  get linkedInvestmentSelect(): Locator {
    return this.page.getByLabel('Linked investment (optional)');
  }

  /** The linked-debt dropdown's options — "— None —" plus the debts. */
  get linkedDebtOptions(): Locator {
    return this.linkedDebtSelect.locator('option');
  }

  /** The linked-investment dropdown's options. */
  get linkedInvestmentOptions(): Locator {
    return this.linkedInvestmentSelect.locator('option');
  }

  /** The "Remaining: ৳ N" line under a chosen linked debt. */
  get linkedDebtRemaining(): Locator {
    return this.page.getByText('Remaining:', { exact: false });
  }

  /** The projection line under a chosen linked investment. */
  get linkedInvestmentProjection(): Locator {
    return this.page.getByText('(projection):', { exact: false });
  }

  /**
   * The amber "Heads up:" payout-mismatch warning.
   *
   * The heading itself is a `<strong>`, so the warning's PARENT is
   * the unit that carries the whole message — the heading plus the
   * investment name, the payout account and the chosen account.
   */
  get payoutMismatchWarning(): Locator {
    return this.page.getByText('Heads up:', { exact: false }).locator('..');
  }

  // ── Presets & errors ──

  /**
   * The preset amount chips (৳ 50 … ৳ 1,000).
   *
   * Scoped to `bg-surface` so the grouped picker's "Show all N
   * categories" pill (which is `bg-primary-hi`) is not counted.
   */
  get amountPresets(): Locator {
    return this.page.locator('button.rounded-pill.bg-surface');
  }

  /** A preset chip, by its label ("৳ 50"). */
  presetChip(label: string): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  /** The inline "Amount must be greater than zero." message. */
  get amountError(): Locator {
    return this.page.getByText('Amount must be greater than zero.', { exact: true });
  }

  /** The submit button — its label depends on the transaction type. */
  get submitButton(): Locator {
    return this.page.locator('button[type="submit"]');
  }

  /**
   * The Save button.
   *
   * Both the add form and the edit form label it **"Save"** — the
   * edit form does NOT say "Save changes".
   */
  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
  }

  // ── Projections ──

  /**
   * Every balance-projection line.
   *
   * The add form shows one under each account picker on the transfer
   * form, and one under the Account picker on income / expense.
   */
  get projectionLines(): Locator {
    return this.page.locator('div.text-xs.text-muted').filter({
      hasText: 'projected balance after save',
    });
  }

  /** One projection line, matched by its full text. */
  projectionLine(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  // ── Edit form ──

  /** The edit screen's H1 — "Edit transaction". */
  get editHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Edit transaction' });
  }

  /** The edit screen's sub-line — "{type} · {note} · {date}". */
  get editSubLine(): Locator {
    return this.page.locator('div.text-muted.text-\\[13px\\].capitalize');
  }

  /** The not-found state on an edit URL whose transaction is gone. */
  get notFoundHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Transaction not found' });
  }

  /** The "🗑 Delete" button on the edit screen. */
  get deleteButton(): Locator {
    return this.page.getByRole('button', { name: /Delete/ });
  }

  /** The "Cancel" button — on the add form it returns to the picker. */
  get cancelButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel', exact: true });
  }

  // ── Field hints ──

  /**
   * The hint under a labelled field.
   *
   * `Field` renders the hint AFTER the control, so the last `<div>`
   * inside the field wrapper is the hint.
   */
  private fieldHint(control: Locator): Locator {
    return control
      .locator('xpath=ancestor::div[contains(@class,"flex-col")][1]')
      .locator('div')
      .last();
  }

  /** The note field's hint — "Add or change a note. …". */
  get noteHint(): Locator {
    return this.fieldHint(this.editNoteInput);
  }

  /** The linked-debt select's hint. */
  get linkedDebtHint(): Locator {
    return this.fieldHint(this.linkedDebtSelect);
  }

  /** The linked-investment select's hint. */
  get linkedInvestmentHint(): Locator {
    return this.fieldHint(this.linkedInvestmentSelect);
  }

  // ── navigation ──

  /** Go to the list. */
  async goto(): Promise<void> {
    await this.gotoRoute('/transactions');
    await this.waitForAppReady();
  }

  /** Go to the type picker. */
  async gotoPicker(): Promise<void> {
    await this.gotoRoute('/transactions/new');
    await this.waitForAppReady();
  }

  /** Go directly to a per-type form. */
  async gotoForm(type: TransactionType): Promise<void> {
    await this.gotoRoute(`/transactions/new/${type}`);
    await this.waitForAppReady();
  }

  /** Go to a transaction's edit screen by id. */
  async gotoEdit(id: string): Promise<void> {
    await this.gotoRoute(`/transactions/${id}/edit`);
    await this.waitForAppReady();
  }

  /** Pick a filter chip and wait for the list to re-render. */
  async applyFilter(label: FilterLabel): Promise<void> {
    await this.filterChip(label).click();
  }

  /**
   * Open the type picker and choose a type — the path a user takes
   * from the Transactions list.
   *
   * The picker is reached through the list header's "+ Add" link, so
   * the list has to be on screen first.
   */
  async openPickerAndChoose(type: TransactionType): Promise<void> {
    await this.goto();
    await this.addButton.click();
    await this.pickerHeading.waitFor({ state: 'visible' });
    await this.typeCard(type).click();
    await this.formHeading(type).waitFor({ state: 'visible' });
  }

  /**
   * Fill the amount and submit, then wait for the list route.
   *
   * The form navigates 600 ms after a successful save, so we wait on
   * the URL rather than a fixed delay.
   */
  async saveAndWaitForList(): Promise<void> {
    await this.submitButton.click();
    await this.page.waitForURL(/#\/transactions$/);
  }

  /**
   * Save the form and capture the toast's copy while it is still alive.
   *
   * A success toast dwells 1.5 s and the form navigates 600 ms after
   * the save, so the toast is still on screen when the list route
   * settles — but only just. Reading it HERE, at the moment of the
   * save, is what keeps the assertion stable under parallel load:
   * waiting for the URL first and asserting later lets the toast
   * expire.
   */
  async saveAndReadToast(): Promise<{ title: string; body: string }> {
    const toast = this.page.getByRole('status');
    await this.submitButton.click();

    // The toast is raised synchronously with the save, so it is
    // already mounted — but it is read through the auto-waiting
    // locator to tolerate a slow frame.
    await toast.waitFor({ state: 'visible' });
    const title = (await toast.locator('div.text-\\[13px\\]').textContent()) ?? '';
    const body = (await toast.locator('div.text-\\[12px\\]').textContent()) ?? '';

    await this.page.waitForURL(/#\/transactions$/);
    return { title: title.trim(), body: body.trim() };
  }

  /**
   * Record an income or an expense.
   *
   * `category` and `note` are optional — the app allows an
   * uncategorised transaction. When a category is given it is picked
   * from the chip grid (a `div[role="button"]`, not a `<button>`).
   */
  async recordTransaction(input: {
    type: 'income' | 'expense';
    amount: string;
    accountName?: string;
    categoryName?: string;
    note?: string;
    date?: string;
  }): Promise<void> {
    await this.gotoForm(input.type);
    await this.amountInput.fill(input.amount);
    if (input.accountName !== undefined) {
      await this.accountSelect.selectOption({ label: input.accountName });
    }
    if (input.categoryName !== undefined) {
      await this.categoryChip(input.categoryName).click();
    }
    if (input.date !== undefined) {
      await this.dateInput.fill(input.date);
    }
    if (input.note !== undefined) {
      await this.noteInput.fill(input.note);
    }
    await this.saveAndWaitForList();
  }

  /** Record a transfer between two accounts. */
  async recordTransfer(input: {
    amount: string;
    fromAccountName: string;
    toAccountName: string;
  }): Promise<void> {
    await this.gotoForm('transfer');
    await this.amountInput.fill(input.amount);
    await this.fromSelect.selectOption({ label: input.fromAccountName });
    await this.toSelect.selectOption({ label: input.toAccountName });
    await this.saveAndWaitForList();
  }

  /** Open a transaction's edit screen by clicking its row. */
  async openTransaction(title: string): Promise<void> {
    await this.row(title).click();
    await this.waitForAppReady();
  }
}
