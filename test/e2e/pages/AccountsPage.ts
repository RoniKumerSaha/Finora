/**
 * AccountsPage — `/accounts` and `/accounts/add`.
 *
 * `src/screens/AccountsListScreen.tsx` renders one `<Link>` card per
 * account, each with:
 *   - the account name (15px semibold)
 *   - the type label (12px muted) — "Cash" / "Bank Account" / …
 *   - a **"Balance"** label and the formatted amount as SEPARATE text
 *     nodes, so there is no contiguous "Balance ৳ 5,000" string
 *   - a `⋯` RowMenu trigger labelled `Actions for {name}`
 *
 * `src/screens/AccountAddScreen.tsx` is a form with the fields
 * "Name", "Type" and "Opening balance".
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export interface AccountInput {
  name: string;
  type: string;
  openingBalance: number;
}

export class AccountsPage extends BasePage {
  /**
   * The "Add" link in the list header.
   *
   * The link's markup is `<span>+</span><span>Add</span>`, so its
   * accessible name is **"+ Add"**, not "Add". `exact: true` on
   * "Add" therefore matches nothing.
   */
  get addButton(): Locator {
    return this.page.getByRole('link', { name: '+ Add', exact: true });
  }

  /** All account cards. */
  get cards(): Locator {
    return this.page.locator('a.card-link');
  }

  /** A specific account card, by its name. */
  card(name: string): Locator {
    return this.page.locator('a.card-link').filter({ hasText: name }).first();
  }

  /** The `⋯` overflow trigger on a specific account card. */
  actionsButton(name: string): Locator {
    return this.page.getByRole('button', { name: `Actions for ${name}` });
  }

  /** The "Balance" caption inside a card. */
  balanceLabel(name: string): Locator {
    return this.card(name).getByText('Balance', { exact: true });
  }

  /**
   * The formatted balance inside a card.
   *
   * The amount is its own `<span>`, sibling to the "Balance" caption —
   * so `toContainText('৳ 5,000')` on the card would also pick up
   * unrelated numbers. Scope to the amount span directly.
   */
  balanceValue(name: string): Locator {
    return this.card(name).locator('span.font-bold.tabular');
  }

  /** The list header's count line — "N total". */
  get countLine(): Locator {
    return this.page.getByText(/\d+ total$/);
  }

  /**
   * The type label on a card — "Cash" / "Bank Account" / ….
   *
   * It is the muted `text-xs` line directly under the account name.
   */
  typeLabel(name: string): Locator {
    return this.card(name).locator('div.text-xs.text-muted').first();
  }

  /**
   * The card's secondary line — the delta ("↑ ৳ 42,000") plus the
   * "vs opening" suffix.
   *
   * The line is only rendered when the account has a delta or a last
   * activity, so this locator is intentionally absent on a brand-new
   * account.
   */
  deltaLine(name: string): Locator {
    return this.card(name)
      .locator('div.border-t.border-border-2')
      .locator('span')
      .first();
  }

  /**
   * The card's last-activity half of the secondary line.
   *
   * It reads "Today · Salary", "no activity yet", "3d ago" or
   * "25 Aug 2026".
   */
  activityLine(name: string): Locator {
    return this.card(name)
      .locator('div.border-t.border-border-2')
      .locator('span')
      .last();
  }

  /** The account-type icon on a card. */
  typeIcon(name: string): Locator {
    return this.card(name).locator('svg').first();
  }

  /** The empty-state CTA. */
  get emptyStateCta(): Locator {
    return this.page.getByRole('link', { name: '+ Add your first account' });
  }

  /** The empty-state headline. */
  get emptyStateTitle(): Locator {
    return this.page.getByText('No accounts yet', { exact: true });
  }

  /** The empty-state body copy. */
  get emptyStateDescription(): Locator {
    return this.page.getByText(
      "Open an account for cash, a bank, a wallet, or a card. Each account tracks what's there now.",
      { exact: true },
    );
  }

  /** The shared empty state's illustration wrapper. */
  get emptyStateIllustration(): Locator {
    return this.page.locator('div.mx-auto.mb-3.opacity-60');
  }

  /** The learn-more link on the shared empty state. */
  get learnMoreLink(): Locator {
    return this.page.getByRole('button', { name: 'How accounts work →' });
  }

  /**
   * The card's secondary row — the whole row, not one of its halves.
   *
   * The row is only rendered when the account has a delta or a last
   * activity, so `toHaveCount(0)` on this locator is how a case proves
   * the row is ABSENT.
   */
  secondaryRow(name: string): Locator {
    return this.card(name).locator('div.border-t.border-border-2');
  }

  /**
   * Any colour / colour-picker affordance on the add form.
   *
   * The build has none — the account's tone follows its type — so a
   * case asserts `toHaveCount(0)` on this locator.
   */
  get colourPicker(): Locator {
    return this.page.getByText(/colour|color|picker/i);
  }

  /**
   * A learn-more button, by its label.
   *
   * Each empty state names its own explainer — "How accounts work →",
   * "How transactions work →", "How goals work →".
   */
  learnMoreButton(label: string): Locator {
    return this.page.getByRole('button', { name: label });
  }

  /**
   * The illustration's SVG inside the shared empty state.
   *
   * The wrapper is a muted, centred `<div>`; the picture itself is
   * the single `<svg>` inside it.
   */
  get emptyStateIllustrationSvg(): Locator {
    return this.emptyStateIllustration.locator('svg');
  }

  // ── Home's empty states ──
  //
  // Home reuses the shared empty state but with its OWN copy, and its
  // "No accounts yet" title collides with the stat strip's "Cash"
  // caption. The card titles are the 15px semibold nodes; the strip
  // captions are 11.5px muted ones.

  /** A Home empty-card title — "No accounts yet", "No transactions yet". */
  homeEmptyTitle(text: string): Locator {
    return this.page
      .locator('div.text-\\[15px\\].font-semibold')
      .filter({ hasText: text });
  }

  /** A Home empty-card description. */
  homeEmptyDescription(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  /** A Home empty-card CTA link — "+ Add an account". */
  homeEmptyCta(name: string): Locator {
    return this.page.getByRole('link', { name });
  }

  // ── Add form ──

  get nameInput(): Locator {
    return this.page.getByLabel('Name');
  }

  get typeSelect(): Locator {
    return this.page.getByLabel('Type');
  }

  get openingBalanceInput(): Locator {
    return this.page.getByLabel('Opening balance');
  }

  /** The inline error under a field — "Amount must be zero or greater." */
  get openingBalanceError(): Locator {
    return this.page.getByText('Amount must be zero or greater.', { exact: true });
  }

  /** The add form's sub-line — "Cash, bank, or mobile wallet." */
  get addSubLine(): Locator {
    return this.page.getByText('Cash, bank, or mobile wallet.', { exact: true });
  }

  /** The edit form's sub-line — "Changes apply to this account only." */
  get editSubLine(): Locator {
    return this.page.getByText('Changes apply to this account only.', { exact: true });
  }

  /** The edit screen's H1 — "Edit account". */
  get editHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Edit account' });
  }

  /** The add screen's H1 — "Add account". */
  get addHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Add account' });
  }

  /** Every option in the Type dropdown, in render order. */
  get typeOptions(): Locator {
    return this.page.getByLabel('Type').locator('option');
  }

  /**
   * The submit button.
   *
   * The add form says "Save account"; the edit form says "Save
   * changes". Match either so the same helper works on both screens.
   */
  get saveButton(): Locator {
    return this.page.getByRole('button', { name: /Save (account|changes)/ });
  }

  get cancelButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel', exact: true });
  }

  /** Go to the list. */
  async goto(): Promise<void> {
    await this.gotoRoute('/accounts');
    await this.waitForAppReady();
  }

  /** Go to the add form. */
  async gotoAdd(): Promise<void> {
    await this.gotoRoute('/accounts/add');
    await this.waitForAppReady();
  }

  /**
   * Fill the add-account form.
   *
   * Every parameter is consumed. `openingBalance` is written as a
   * string so a negative value can be typed (an HTML number input
   * would reject it via `type()`).
   */
  async fillForm(input: AccountInput): Promise<void> {
    await this.nameInput.fill(input.name);
    await this.typeSelect.selectOption(input.type);
    await this.openingBalanceInput.fill(String(input.openingBalance));
  }

  /** Fill and save, then wait for the list. */
  async create(input: AccountInput): Promise<void> {
    await this.gotoAdd();
    await this.fillForm(input);
    await this.saveButton.click();
    await this.goto();
  }

  /** Open a card's `⋯` menu and choose one of its items. */
  async openRowMenu(accountName: string): Promise<void> {
    await this.actionsButton(accountName).click();
    await this.page.getByRole('menu').waitFor({ state: 'visible' });
  }

  /**
   * Open an account's edit form through its `⋯` menu.
   *
   * The card is a `<Link>` to the edit screen, but clicking the card
   * itself would also work — the menu route is the one a user takes
   * when they want to change the account rather than read it.
   */
  async openEditForm(accountName: string): Promise<void> {
    await this.openRowMenu(accountName);
    await this.chooseRowMenuItem('Edit');
    await this.editHeading.waitFor({ state: 'visible' });
  }

  /** Click an item in an open `⋯` menu. */
  async chooseRowMenuItem(label: string): Promise<void> {
    await this.page.getByRole('menuitem', { name: label, exact: true }).click();
  }
}
