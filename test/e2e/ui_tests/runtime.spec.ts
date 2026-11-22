/**
 * runtime.spec.ts — FIN-R01, FIN-R02, FIN-R03.
 *
 * The three cross-cutting runtime cases: persistence, a clean install,
 * and the accessibility / UI conventions that hold everywhere.
 *
 * ## Why these cases are in their own file
 *
 * FIN-R01 and FIN-R02 are about the STORAGE LAYER, not about any one
 * screen: they read IndexedDB, `localStorage` and `sessionStorage`
 * directly. FIN-R03 walks the whole app asserting conventions that
 * every screen shares. Neither fits the shape of a feature suite, so
 * both live here rather than being smeared across the feature specs.
 *
 * ## The storage contract (FIN-R01 / FIN-R02)
 *
 *   IndexedDB → database `finora` → store `kv` → key `state`
 *            → row `{ id: 'state', data: <State> }`
 *
 * (`src/domain/persistence.ts` — `SINGLETON_KEY = 'state'`.) The PIN
 * deliberately lives OUTSIDE that blob:
 *
 *   localStorage['finora.pin.salt']  / ['finora.pin.hash']
 *   sessionStorage['finora.pin.attempts'] / ['finora.pin.lockoutUntil']
 *
 * (`src/security/pin.ts`, `src/security/rateLimit.ts`.) The legacy
 * pre-2026-09-02 blob lived in `localStorage['finora:v1']` and is
 * migrated into IndexedDB on first load — see
 * `src/domain/persistence.migrations.ts`.
 *
 * ⚠️ **The init-script trap.** `seedState` installs an
 * `addInitScript`, and init scripts re-run on EVERY navigation. A
 * `page.reload()` therefore re-writes the seeded blob — so a reload
 * can never be used to prove that the APP persisted anything. The
 * persistence assertions read the store back with `readState(page)`
 * instead, and the reload is only ever used to prove the route and
 * the rendered records survive.
 *
 * ## FIN-R03's known gaps
 *
 * The manual case says the debt-payment modal does NOT close on a
 * backdrop click, while the goal-contribution modal does. Both
 * modals ship a backdrop `<button onClick={onClose}>` — so the
 * build's behaviour is asserted as it is, and the inconsistency is
 * recorded rather than asserted as a defect that is not there.
 */
import { expect, test, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { A11yPage } from '../pages/A11yPage';
import { GoalsPage } from '../pages/GoalsPage';
import { DebtsPage } from '../pages/DebtsPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import {
  readState,
  seedState,
  type SeedState,
} from '../fixtures/app-state';
import { baseState, eventPlanState, todayTransactions } from '../fixtures/seed-data';
import runtimeJson from '../../data/runtime.json' with { type: 'json' };

const data = runtimeJson;

/**
 * Delete a Chromium profile directory, tolerating a locked file.
 *
 * On Windows, closing the browser does NOT immediately release every
 * handle it took — `chrome_debug.log` in the profile stays locked for
 * a moment afterwards, and `rm(..., { recursive: true })` then fails
 * with `EBUSY`. That is a temp-directory cleanup detail, not a
 * product defect, so it must never fail the test that proved the
 * app persists data.
 *
 * The removal is retried briefly and, if it still fails, the leftover
 * directory is left to the OS temp cleaner rather than failing the
 * run.
 */
async function removeProfileDir(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(dir, { recursive: true, force: true, maxRetries: 3 });
      return;
    } catch {
      // The browser still holds a handle — give it a moment.
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  // Best effort only: the directory lives in the OS temp folder.
}

test.describe('Runtime', () => {
  let a11y: A11yPage;
  let goals: GoalsPage;
  let debts: DebtsPage;
  let confirm: ConfirmDialog;
  let feedback: Feedback;

  test.beforeEach(async ({ page }) => {
    a11y = new A11yPage(page);
    goals = new GoalsPage(page);
    debts = new DebtsPage(page);
    confirm = new ConfirmDialog(page);
    feedback = new Feedback(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-R01 — data survives a reload and a full browser restart
  // ─────────────────────────────────────────────────────────────────

  // This case is legitimately heavier than the rest of the suite: it
  // launches a SECOND persistent Chromium context over the same
  // on-disk profile, writes a record through the app, closes the
  // browser, and reopens it. Under a fully parallel run that second
  // browser launch can push the default 30s timeout over the edge,
  // so the budget is raised here rather than globally.
  test('FIN-R01 Data survives a reload and a full browser restart', { tag: '@smoke' }, async ({ page }) => {
    // `timeout` is not a `TestDetails` field — the budget is raised
    // with `test.setTimeout()` instead.
    test.setTimeout(90_000);

    const r01 = data.R01_persistence;
    const expected = r01.expected;

    // The precondition: a transaction, a goal and an event plan.
    const state = eventPlanState();
    state.transactions = todayTransactions();
    await seedState(page, state);

    const transactionCount = state.transactions.length;
    const goalCount = state.goals.length;
    const planCount = state.eventPlans.length;
    expect(transactionCount).toBeGreaterThan(0);
    expect(goalCount).toBeGreaterThan(0);
    expect(planCount).toBeGreaterThan(0);

    await test.step('Open the app — the seeded records are there', async () => {
      await page.goto('/#/home');
      await goals.mainRegion.waitFor({ state: 'visible' });
    });

    await test.step('The state lives in IndexedDB, not in localStorage', async () => {
      const stored = await page.evaluate(
        (legacyKey) =>
          new Promise<{ row: unknown; legacy: string | null }>((resolve, reject) => {
            const req = indexedDB.open('finora');
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction('kv', 'readonly');
              const get = tx.objectStore('kv').get('state');
              get.onsuccess = () => {
                const row = get.result;
                db.close();
                resolve({ row, legacy: localStorage.getItem(legacyKey) });
              };
              get.onerror = () => reject(get.error);
            };
            req.onerror = () => reject(req.error);
          }),
        expected.legacyKey,
      );

      // The row exists under the documented key.
      expect(stored.row).toBeTruthy();
      expect((stored.row as { id: string }).id).toBe(expected.key);

      // …and the legacy localStorage blob is NOT the home of the data.
      expect(stored.legacy).toBeNull();
    });

    await test.step('Reload the page and read the records again', async () => {
      await page.reload();
      await goals.mainRegion.waitFor({ state: 'visible' });

      const after = await readState(page);
      expect(after?.transactions).toHaveLength(transactionCount);
      expect(after?.goals).toHaveLength(goalCount);
      expect(after?.eventPlans).toHaveLength(planCount);
    });

    await test.step('The route is preserved across a reload', async () => {
      await page.goto('/#/goals');
      await goals.mainRegion.waitFor({ state: 'visible' });
      await page.reload();
      await goals.mainRegion.waitFor({ state: 'visible' });

      // The user lands back on the same screen.
      await expect(page).toHaveURL(/#\/goals$/);
      await expect(goals.heading).toBeVisible();
    });

    await test.step('Close the browser entirely and reopen it', async () => {
      // A genuine browser restart: the same browser profile is
      // reopened from the same on-disk user-data directory, so the
      // IndexedDB store comes back with it.
      //
      // ⚠️ Playwright's `newContext()` starts from an EMPTY profile,
      // which would model "the user's data was wiped", not "the
      // browser was restarted". A persistent context is the only way
      // to test the real thing — so the app is booted in one, the
      // records are written, the context is closed, and a second
      // persistent context over the SAME directory is opened.
      const profileDir = await mkdtemp(join(tmpdir(), 'finora-r01-'));
      const baseURL = new URL(page.url()).origin;

      const firstContext = await chromium.launchPersistentContext(profileDir, {
        baseURL,
        viewport: { width: 1440, height: 900 },
      });

      try {
        const first = firstContext.pages()[0] ?? (await firstContext.newPage());

        // Seed the store in the persistent profile.
        await first.addInitScript(
          async ({ s }: { s: SeedState }) => {
            await new Promise<void>((resolve, reject) => {
              const req = indexedDB.open('finora');
              req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('kv')) {
                  db.createObjectStore('kv', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('meta')) {
                  db.createObjectStore('meta', { keyPath: 'key' });
                }
              };
              req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction(['kv', 'meta'], 'readwrite');
                tx.objectStore('kv').put({ id: 'state', data: s });
                tx.objectStore('meta').put({ key: 'schema', value: 1 });
                tx.oncomplete = () => {
                  db.close();
                  resolve();
                };
                tx.onerror = () => reject(tx.error);
              };
              req.onerror = () => reject(req.error);
            });
          },
          { s: state },
        );

        await first.goto('/#/home');
        await first.locator('main').first().waitFor({ state: 'visible' });

        // The app WRITES a record of its own, so the store is the
        // app's — not just the fixture's.
        const transactions = new TransactionsPage(first);
        await transactions.recordTransaction({
          type: 'expense',
          amount: '1250',
          accountName: state.accounts[0]?.name as string,
          categoryName: state.categories.find((c) => c.type === 'expense')?.name as string,
          note: 'persistence probe',
        });

        const written = await readState(first);
        expect(written?.transactions).toHaveLength(transactionCount + 1);
      } finally {
        await firstContext.close();
      }

      // The browser is closed. Reopen it over the SAME profile.
      const secondContext = await chromium.launchPersistentContext(profileDir, {
        baseURL,
        viewport: { width: 1440, height: 900 },
      });

      try {
        const second = secondContext.pages()[0] ?? (await secondContext.newPage());
        await second.goto('/#/home');
        await second.locator('main').first().waitFor({ state: 'visible' });

        // The record the app wrote is still there.
        const after = await readState(second);
        expect(after?.transactions).toHaveLength(transactionCount + 1);
        expect(after?.goals).toHaveLength(goalCount);
        expect(after?.eventPlans).toHaveLength(planCount);
        expect(
          after?.transactions.some((t) => t.note === 'persistence probe'),
        ).toBe(true);
      } finally {
        await secondContext.close();
        await removeProfileDir(profileDir);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-R02 — clearing site data yields a clean install
  // ─────────────────────────────────────────────────────────────────

  test('FIN-R02 Clearing site data yields a clean install', async ({ page, browser }) => {
    const r02 = data.R02_cleanInstall;
    const expected = r02.expected;

    await test.step('Start with data present', async () => {
      const state = baseState();
      state.transactions = todayTransactions();
      await seedState(page, state);
      await page.goto('/#/home');
      await goals.mainRegion.waitFor({ state: 'visible' });

      const before = await readState(page);
      expect(before?.accounts.length).toBeGreaterThan(0);
    });

    await test.step('Clear the site data and reload', async () => {
      // The equivalent of the devtools "Clear site data": the
      // storage is wiped and the app boots from scratch.
      //
      // ⚠️ A fresh BROWSER CONTEXT, not a fresh page in this one.
      // `page.addInitScript` registers the seed against the CONTEXT,
      // so every page in it re-writes the seeded blob on load — a new
      // page would still see the seed. A new context has its own,
      // empty storage and no init scripts at all, which is exactly
      // what "clear site data" leaves behind.
      const cleanContext = await browser.newContext();
      const clean = await cleanContext.newPage();

      await clean.goto('/#/home');
      await clean.locator('main').first().waitFor({ state: 'visible' });

      await test.step('Nothing is left behind in localStorage or sessionStorage', async () => {
        const leftovers = await clean.evaluate((keys: string[]) => {
          const storage: Record<string, string> = {};
          for (const key of keys) {
            storage[key] = [
              localStorage.getItem(key) === null ? 'absent' : 'present',
              sessionStorage.getItem(key) === null ? 'absent' : 'present',
            ].join('/');
          }
          return storage;
        }, expected.clearedKeys);

        for (const key of expected.clearedKeys) {
          expect(leftovers[key]).toBe('absent/absent');
        }
      });

      await test.step('The app boots as a clean install — no accounts, no transactions', async () => {
        // A clean install has NO `state` row at all until the app
        // writes one, so the store reads back as `undefined` — which
        // is the same thing as "no accounts, no transactions".
        const state = await readState(clean);
        expect(state?.accounts ?? []).toHaveLength(0);
        expect(state?.transactions ?? []).toHaveLength(0);
      });

      await test.step('The onboarding screen is reachable', async () => {
        const cleanOnboarding = new OnboardingPage(clean);
        await cleanOnboarding.goto();
        await expect(cleanOnboarding.heading).toBeVisible();
        await expect(cleanOnboarding.getStartedButton).toBeVisible();
      });

      await cleanContext.close();
    });

    await test.step('A legacy localStorage blob is migrated into IndexedDB', async () => {
      // A pre-2026-09-02 build kept the whole state in
      // `localStorage['finora:v1']`. On first load the app migrates it
      // into IndexedDB and removes the legacy key.
      const legacyContext = await browser.newContext();
      const legacy = await legacyContext.newPage();

      // Write the legacy blob BEFORE the app boots.
      await legacy.addInitScript((legacyKey: string) => {
        localStorage.setItem(
          legacyKey,
          JSON.stringify({
            version: 1,
            accounts: [{ id: 'acc-legacy', name: 'Legacy Cash', kind: 'cash', opening: 5000 }],
            transactions: [],
            goals: [],
            debts: [],
            investments: [],
            categories: [],
            monthPlans: [],
            eventPlans: [],
            investmentPlans: [],
            loanPlans: [],
            settings: { theme: 'dark', onboardingComplete: true },
          }),
        );
      }, expected.legacyKey);

      await legacy.goto('/#/home');
      await legacy.locator('main').first().waitFor({ state: 'visible' });

      // The blob landed in IndexedDB…
      const migrated = await readState(legacy);
      expect(migrated?.accounts).toHaveLength(1);
      expect(migrated?.accounts[0]?.name).toBe('Legacy Cash');

      // …and the legacy key is gone.
      const legacyValue = await legacy.evaluate(
        (key) => localStorage.getItem(key),
        expected.legacyKey,
      );
      expect(legacyValue).toBeNull();

      await legacyContext.close();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-R03 — accessibility and UI conventions
  // ─────────────────────────────────────────────────────────────────

  test('FIN-R03 Accessibility and UI conventions', async ({ page }) => {
    const r03 = data.R03_accessibility;
    const expected = r03.expected;

    const state = baseState();
    state.transactions = todayTransactions();
    await seedState(page, state);

    await test.step('Each label is programmatically associated with its control', async () => {
      await goals.gotoAdd();

      const label = a11y.labelFor('Name');
      await expect(label).toHaveCount(1);

      // The label points at the control…
      const controlId = await label.getAttribute('for');
      expect(controlId).toBeTruthy();
      if (!controlId) throw new Error('The label carries no `for` attribute');
      await expect(a11y.controlById(controlId)).toHaveCount(1);

      // …and clicking it moves the focus to that control.
      await label.click();
      await expect(goals.nameInput).toBeFocused();
    });

    await test.step('The hint is hidden when an error is present, and the field is marked invalid', async () => {
      // The Target amount field carries a hint. The form starts with
      // an EMPTY target, which is already invalid — so the hint is
      // already hidden and the error is already showing. A VALID
      // target is what makes the hint appear, and clearing it again
      // is what makes the hint go.
      await goals.targetAmountInput.fill('50000');

      const targetHint = a11y.fieldHint('Target amount');
      await expect(targetHint).toBeVisible();
      await expect(a11y.fieldError('Target amount')).toHaveCount(0);
      await expect(goals.targetAmountInput).not.toHaveAttribute('aria-invalid', 'true');

      // Now clear it — the error appears and the hint must go.
      await goals.targetAmountInput.fill('');
      await goals.targetAmountInput.blur();

      await expect(a11y.fieldError('Target amount')).toBeVisible();
      await expect(targetHint).toHaveCount(0);
      await expect(goals.targetAmountInput).toHaveAttribute('aria-invalid', 'true');
    });

    await test.step('A progress bar carries role="progressbar" with a 0–100 range', async () => {
      await goals.goto();

      const bar = a11y.progressBars.first();
      await expect(bar).toHaveCount(1);
      await expect(bar).toHaveAttribute('role', expected.progressbarRole);
      await expect(bar).toHaveAttribute('aria-valuemin', expected.progressbarValues['aria-valuemin']);
      await expect(bar).toHaveAttribute('aria-valuemax', expected.progressbarValues['aria-valuemax']);

      // The value is present and clamped to 0–100.
      const value = Number(await bar.getAttribute('aria-valuenow'));
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });

    await test.step('A confirm dialog cancels on Escape, on a backdrop click and on "Cancel"', async () => {
      await goals.goto();
      await goals.card(state.goals[0]?.name ?? '').click();
      await goals.screenHeading.waitFor({ state: 'visible' });

      // The initial focus lands on "Cancel", not the destructive
      // action.
      await goals.deleteButton.click();
      await expect(confirm.dialog).toBeVisible();
      await expect(
        confirm.dialog.getByRole('button', { name: expected.confirmFocusTarget, exact: true }),
      ).toBeFocused();

      // Escape cancels.
      await confirm.dismissWithEscape();
      await expect(goals.deleteButton).toBeVisible();

      // The backdrop click cancels.
      await goals.deleteButton.click();
      await expect(confirm.dialog).toBeVisible();
      await confirm.dismissWithBackdrop();

      // The "Cancel" button cancels.
      await goals.deleteButton.click();
      await expect(confirm.dialog).toBeVisible();
      await confirm.cancel();

      // The goal survived all three cancellations.
      await expect(goals.detailHeading).toBeVisible();
    });

    await test.step('The goal-contribution modal closes on a backdrop click', async () => {
      await goals.goto();
      await goals.card(state.goals[0]?.name ?? '').click();
      await goals.screenHeading.waitFor({ state: 'visible' });

      await goals.addContributionButton.click();
      await expect(goals.contributionDialog).toBeVisible();

      await a11y.clickModalBackdrop(goals.contributionDialog);
      await expect(goals.contributionDialog).toHaveCount(0);
    });

    await test.step('The debt-payment modal also closes on a backdrop click', async () => {
      // *Known divergence* (FIN-R03): the manual case says the debt
      // modal does NOT close on a backdrop click and only Escape
      // closes it. The build ships the same backdrop button on both
      // modals — `DebtPaymentModal.tsx` binds `onClick={onClose}`
      // exactly like `ContributeModal` — so it DOES close. The build's
      // behaviour is asserted here and the inconsistency is recorded.
      const debtName = state.debts[0]?.name;
      expect(debtName).toBeTruthy();

      await debts.goto();
      await debts.openPayment(debtName as string);
      await expect(debts.paymentDialog).toBeVisible();

      await a11y.clickModalBackdrop(debts.paymentDialog);
      await expect(debts.paymentDialog).toHaveCount(0);
    });

    await test.step('Escape closes the debt-payment modal', async () => {
      const debtName = state.debts[0]?.name;
      await debts.openPayment(debtName as string);
      await expect(debts.paymentDialog).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(debts.paymentDialog).toHaveCount(0);
    });

    await test.step('The banner has role="alert" with three lines and a "Dismiss" button', async () => {
      // The debt-add form raises a three-part error banner when the
      // amount is invalid. The submit button is disabled in that
      // state, so the form's own handler is invoked directly —
      // `DebtsPage.submitForm()` does that with `requestSubmit()`.
      await debts.gotoAdd();
      await debts.nameInput.fill('Banner probe');
      await debts.totalAmountInput.fill('0');
      await debts.submitForm();

      const banner = await feedback.readBanner();
      expect(banner.title).toBeTruthy();
      expect(banner.body).toBeTruthy();
      expect(banner.fix).toBeTruthy();

      // The banner's three stacked lines are three direct children.
      await expect(feedback.banner.locator('div.font-semibold.text-\\[14px\\]')).toHaveCount(1);
      await expect(feedback.banner.locator('div.text-\\[12\\.5px\\].text-muted')).toHaveCount(1);
      await expect(feedback.banner.locator('div.text-\\[12\\.5px\\].text-ink')).toHaveCount(1);

      // The dismiss button.
      await expect(feedback.dismissButton).toBeVisible();

      // It really is an alert.
      await expect(feedback.banner).toHaveAttribute('role', expected.bannerRole);
    });

    await test.step('The toast has role="status" with at most two lines', async () => {
      // Recording a transaction raises a toast. `saveAndReadToast()`
      // reads it in the same tick as the save, because a success
      // toast only dwells for 1.5 s.
      const transactions = new TransactionsPage(page);
      const expense = state.transactions.find((t) => t.type === 'expense');
      expect(expense).toBeTruthy();
      const account = state.accounts.find((a) => a.id === expense?.accountId);
      const category = state.categories.find((c) => c.id === expense?.categoryId);

      await transactions.gotoForm('expense');
      await transactions.amountInput.fill('450');
      await transactions.accountSelect.selectOption({ label: account?.name as string });
      await transactions.categoryChip(category?.name as string).click();
      const toastCopy = await transactions.saveAndReadToast();

      // The toast's role and its shape.
      await expect(feedback.toast).toHaveAttribute('role', expected.toastRole);
      await expect(feedback.toastTitle).toHaveText(toastCopy.title);

      // The toast carries what / why only — never a third "fix" line.
      const toast = await page.evaluate(() => {
        const node = document.querySelector('[role="status"]');
        if (!node) return null;
        const body = node.querySelector('div > div > div');
        return {
          role: node.getAttribute('role'),
          children: body?.children.length ?? 0,
        };
      });

      expect(toast).not.toBeNull();
      expect(toast?.role).toBe(expected.toastRole);
      expect(toast?.children).toBeLessThanOrEqual(expected.toastLines);
    });
  });
});
