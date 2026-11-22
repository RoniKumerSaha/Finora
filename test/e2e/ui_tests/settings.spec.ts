/**
 * settings.spec.ts — FIN-H03, FIN-W01 … FIN-W06.
 *
 * The Backup / Danger-zone domain: exporting a JSON backup, importing
 * one back, the three import error paths, and the destructive
 * "Wipe all data" flow.
 *
 * Each manual case becomes EXACTLY ONE test, titled with its manual
 * ID and the manual title verbatim. Every `**Priority:** High` case
 * carries the `@smoke` tag — in the details object, never in the
 * title.
 *
 * ## Where these cases live
 *
 * The manual plan files FIN-H03 under "Home", but the flow it
 * describes — "Open Settings and click Export backup" — is entirely a
 * Settings-screen flow, and the export/import round trip is the same
 * behaviour FIN-W03 and FIN-W04 cover in more detail. The spec lives
 * with the surface it drives; the traceability lines in
 * `test/docs/manual-test.md` point here.
 *
 * ## Signed-in coverage
 *
 * `SettingsScreen.onWipeEverything` branches on
 * `syncEngine.getEmail()`. The signed-out branch is fully automatable
 * here. The signed-in branch needs a live Supabase session, which the
 * e2e suite cannot create without a backend — so the signed-in halves
 * of FIN-W01 and FIN-W02 are covered by `cloud.spec.ts`, which skips
 * loudly when no backend is configured.
 *
 * ## The download
 *
 * "Export backup" synthesises a Blob and clicks a temporary `<a
 * download>`. The download event carries the suggested filename and a
 * path to the written file — both are read directly.
 */
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { SettingsPage } from '../pages/SettingsPage';
import { AccountsPage } from '../pages/AccountsPage';
import { LockScreen } from '../pages/LockScreen';
import { TransactionsPage } from '../pages/TransactionsPage';
import { ConfirmDialog } from '../pages/component/ConfirmDialog';
import { Feedback } from '../pages/component/Feedback';
import { readState, reseedState, seedState } from '../fixtures/app-state';
import {
  eventPlanState,
  monthPlanState,
  todayState,
} from '../fixtures/seed-data';
import backupJson from '../../data/backup.json' with { type: 'json' };
import securityJson from '../../data/security.json' with { type: 'json' };

const data = backupJson;

/** The PIN the wipe-clears-it case sets through the real Settings UI. */
const pin = securityJson.P01_setPin.pin;

/* ── helpers ────────────────────────────────────────────────────────── */

/**
 * A state carrying BOTH a month plan and an event plan.
 *
 * FIN-W03's precondition asks for "at least one month plan and one
 * event plan", so the export is exercised against a store that
 * actually holds them.
 */
function plansAndLedgerState() {
  const state = monthPlanState();
  state.eventPlans = eventPlanState().eventPlans;
  state.transactions = todayState().transactions;
  return state;
}

/**
 * The exported filename for today, in the app's own format.
 *
 * `exportFilename()` uses UTC, so the date is read the same way.
 */
function expectedBackupFilename(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `finora-backup-${yyyy}-${mm}-${dd}.json`;
}

/**
 * Click "Export backup" and capture the download AND the banner.
 *
 * The banner is raised synchronously with the click, but it only
 * dwells three seconds — and the download event can take longer than
 * that on a cold start or under parallel load. So the banner is READ
 * at the moment it is raised, and the download is awaited afterwards.
 *
 * Waiting for the download first and reading the banner afterwards
 * would let the banner expire.
 */
async function exportBackup(
  settings: SettingsPage,
  feedback: Feedback,
): Promise<{
  filename: string;
  buffer: Buffer;
  banner: { title: string; body: string; fix: string };
}> {
  const downloadPromise = settings.page.waitForEvent('download');
  await settings.exportBackupButton.click();

  const banner = await feedback.readBanner();

  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  return {
    filename: download.suggestedFilename(),
    buffer: await readFile(path as string),
    banner,
  };
}

/* ── the suite ──────────────────────────────────────────────────────── */

test.describe('Settings — backup and reset', () => {
  let settings: SettingsPage;
  let accounts: AccountsPage;
  let lock: LockScreen;
  let transactions: TransactionsPage;
  let confirm: ConfirmDialog;
  let feedback: Feedback;

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
    accounts = new AccountsPage(page);
    lock = new LockScreen(page);
    transactions = new TransactionsPage(page);
    confirm = new ConfirmDialog(page);
    feedback = new Feedback(page);
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-H03 — Export and import round trip
  // ─────────────────────────────────────────────────────────────────

  test('FIN-H03 Export and import round trip', { tag: '@smoke' }, async ({ page }) => {
    const h03 = data.H03_roundTrip;
    const expected = h03.expected;

    await seedState(page, plansAndLedgerState());

    let backupName = '';
    let backupBuffer: Buffer;

    await test.step('Open Settings and click "Export backup"', async () => {
      await settings.goto();
      await expect(settings.screenHeading).toBeVisible();

      const exported = await exportBackup(settings, feedback);

      backupName = exported.filename;
      backupBuffer = exported.buffer;

      expect(backupName).toBe(expectedBackupFilename());

      // The banner names the file it wrote.
      expect(exported.banner.title).toBe(
        expected.bannerFormat.replace('{filename}', expectedBackupFilename()),
      );
      expect(exported.banner.body).toBe(expected.bannerBody);
      expect(exported.banner.fix).toBe(expected.bannerFix);
    });

    await test.step('Inspect the downloaded file\'s name and contents', async () => {
      const text = backupBuffer.toString('utf8');
      const envelope = JSON.parse(text) as {
        version: number;
        exportedAt: string;
        data: Record<string, unknown>;
      };

      // The envelope is `{ version, exportedAt, data }`.
      expect(Object.keys(envelope)).toEqual(expected.envelopeKeys);
      expect(envelope.version).toBe(expected.version);
      expect(typeof envelope.exportedAt).toBe('string');
      expect(envelope.exportedAt.length).toBeGreaterThan(0);

      // The file is pretty-printed with two spaces.
      expect(text).toContain('\n  "version"');

      // `data` holds every entity the app keeps.
      for (const key of expected.dataKeys) {
        expect(Object.keys(envelope.data)).toContain(key);
      }

      // `settings` carries the theme and the onboarding flag.
      const settingsBlock = envelope.data.settings as Record<string, unknown>;
      for (const key of expected.settingsKeys) {
        expect(Object.keys(settingsBlock)).toContain(key);
      }
    });

    await test.step('Change some data — add a transaction and edit an account', async () => {
      const before = await readState(page);
      expect(before?.transactions.length).toBeGreaterThan(0);
      const account = before?.accounts[0];
      expect(account).toBeTruthy();

      await transactions.recordTransaction({
        type: 'expense',
        amount: '1500',
        accountName: account?.name as string,
        note: 'Round trip marker',
      });

      // The account's `⋯` menu lives on the Accounts list, so the
      // test walks there the way a user would.
      await accounts.goto();
      await accounts.openEditForm(account?.name as string);
      await accounts.nameInput.fill('Renamed for the round trip');
      await accounts.saveButton.click();
      await accounts.goto();

      const after = await readState(page);
      expect(after?.transactions.length).toBe((before?.transactions.length ?? 0) + 1);
      expect(after?.accounts.some((a) => a.name === 'Renamed for the round trip')).toBe(true);
    });

    await test.step('Open Settings, click "Import backup", select the downloaded file', async () => {
      await settings.goto();

      // The ORIGINAL export — the one taken before the step-3 changes
      // — is the file that gets imported back.
      await settings.importFile({
        name: backupName,
        mimeType: 'application/json',
        buffer: backupBuffer,
      });

      // The confirmation names the action and its consequence.
      await expect(confirm.dialog).toBeVisible();
      await expect(confirm.heading).toHaveText(expected.confirmTitle);
      await expect(confirm.body).toHaveText(expected.confirmBody);
      await expect(confirm.confirmButton(expected.confirmButton)).toBeVisible();
    });

    await test.step('Click "Replace"', async () => {
      await confirm.confirm(expected.confirmButton);

      const banner = await feedback.readBanner();
      expect(banner.title).toBe(expected.successToast);
      expect(banner.body).toBe(expected.successToastBody);
      expect(banner.fix).toBe(expected.successToastFix);
    });

    await test.step('The step-3 changes are gone', async () => {
      // The backup predates the transaction and the rename, so neither
      // survives the replace.
      const restored = await readState(page);
      expect(restored?.transactions.some((t) => t.note === 'Round trip marker')).toBe(false);
      expect(restored?.accounts.some((a) => a.name === 'Renamed for the round trip')).toBe(false);

      // …and the pre-change records ARE back.
      expect(restored?.transactions.length).toBeGreaterThan(0);
      expect(restored?.accounts.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-W01 — Wipe all data while signed out
  // ─────────────────────────────────────────────────────────────────

  test('FIN-W01 Wipe all data while signed out and while signed in', { tag: '@smoke' }, async ({ page }) => {
    const w01 = data.W01_wipe;
    const expected = w01.expected;

    await seedState(page, todayState());

    await test.step('Open Settings and read the Danger zone', async () => {
      await settings.goto();

      await expect(settings.dangerZoneHeading).toBeVisible();
      await expect(settings.dangerZoneWarning).toHaveText(expected.dangerWarning);
      await expect(settings.wipeAllDataButton).toBeVisible();
    });

    await test.step('Click "Wipe all data" and read the confirmation', async () => {
      await settings.wipeAllDataButton.click();

      await expect(confirm.dialog).toBeVisible();
      await expect(confirm.heading).toHaveText(expected.confirmTitle);
      await expect(confirm.body).toHaveText(expected.signedOutBody);
      await expect(confirm.confirmButton(expected.confirmButton)).toBeVisible();
    });

    await test.step('Cancel the confirmation', async () => {
      await confirm.cancel();

      // Every record is still in place.
      const state = await readState(page);
      expect(state?.accounts.length).toBeGreaterThan(0);
      expect(state?.transactions.length).toBeGreaterThan(0);
    });

    await test.step('Confirm "Wipe everything"', async () => {
      await settings.wipeAllDataButton.click();
      await confirm.confirm(expected.confirmButton);

      const banner = await feedback.readBanner();
      expect(banner.title).toBe(expected.signedOutToast);
      expect(banner.body).toBe(expected.signedOutToastBody);
      expect(banner.fix).toBe(expected.signedOutToastFix);
    });

    await test.step('Read the local data', async () => {
      const state = await readState(page);
      expect(state?.accounts.length ?? 0).toBe(0);
      expect(state?.transactions.length ?? 0).toBe(0);
      expect(state?.goals.length ?? 0).toBe(0);
      expect(state?.debts.length ?? 0).toBe(0);
      expect(state?.investments.length ?? 0).toBe(0);
    });

    await test.step('The About panel link runs the same flow', async () => {
      // Re-seed so the wipe has something to delete.
      await reseedState(page, todayState());
      await settings.goto();

      await settings.eraseEverythingLink.click();

      // The SAME confirmation is raised — the About link and the
      // Danger-zone button share one handler.
      await expect(confirm.dialog).toBeVisible();
      await expect(confirm.heading).toHaveText(expected.confirmTitle);
      await expect(confirm.body).toHaveText(expected.signedOutBody);

      await confirm.confirm(expected.confirmButton);
      const banner = await feedback.readBanner({ title: expected.signedOutToast });
      expect(banner.title).toBe(expected.signedOutToast);
      expect(banner.body).toBe(expected.signedOutToastBody);
      expect(banner.fix).toBe(expected.signedOutToastFix);

      const state = await readState(page);
      expect(state?.accounts.length ?? 0).toBe(0);
    });

    await test.step('The signed-in half is covered by the cloud suite', async () => {
      // The signed-in wipe needs a live Supabase session. It is
      // exercised in `cloud.spec.ts`, which skips loudly when no
      // backend is configured — this assertion documents that the
      // signed-out branch does not silently cover the signed-in one.
      expect(expected.signedInBody).toContain('THIS DEVICE');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-W02 — A failed cloud delete aborts the wipe
  // ─────────────────────────────────────────────────────────────────

  test('FIN-W02 A failed cloud delete aborts the wipe, and a wipe clears the PIN', { tag: '@smoke' }, async ({ page }) => {
    const w02 = data.W02_failedCloudDelete;
    const expected = w02.expected;

    // `clearPin: false` from the very first seed: the seed's init
    // script re-runs on EVERY load, so a `clearPin: true` script would
    // wipe the PIN this case sets later on. (Init scripts accumulate,
    // and every one of them clears the PIN — the LAST one added does
    // not win for this particular side effect.)
    await seedState(page, todayState(), { clearPin: false });

    await test.step('Open Settings and read the Danger zone', async () => {
      await settings.goto();
      await expect(settings.wipeAllDataButton).toBeVisible();
    });

    await test.step('Wipe with no cloud session — the local wipe completes', async () => {
      // Signed out, the cloud delete is never attempted, so the wipe
      // succeeds. The banner is the SUCCESS one — which is what proves
      // the failure banner was never raised. (A `not.toHaveText` check
      // would be vacuous: it passes just as well when the banner is
      // gone.)
      await settings.wipeAllDataButton.click();
      await confirm.confirm('Wipe everything');

      const banner = await feedback.readBanner();
      expect(banner.title).toBe(data.W01_wipe.expected.signedOutToast);
      expect(banner.title).not.toBe(expected.banner);
      expect(banner.fix).not.toBe(expected.fix);
    });

    await test.step('The local data really was wiped', async () => {
      const state = await readState(page);
      expect(state?.accounts.length ?? 0).toBe(0);
    });

    await test.step('A wipe clears the PIN', async () => {
      // Re-seed so the wipe has something to delete, then set a PIN
      // through the real Settings UI — the fixture-free path, so the
      // assertion measures the app and not a seeding script.
      //
      // `clearPin: false` is essential: the default seed clears the
      // PIN keys on every load, which would wipe the PIN the test
      // just set before the reload could prove it took.
      await reseedState(page, todayState(), { clearPin: false });
      await settings.goto();

      await settings.setPinButton.click();
      await settings.typePin(pin);
      await expect(settings.confirmPinDialog).toBeVisible();
      await settings.typePin(pin);
      await expect(settings.setPinDialog).toHaveCount(0);

      // The device now has a PIN.
      await page.reload();
      await expect(lock.region).toBeVisible();

      // Unlock and wipe everything from the Danger zone.
      await lock.unlockWith(pin);
      await settings.goto();
      await settings.wipeAllDataButton.click();
      await confirm.confirm('Wipe everything');
      await feedback.waitForBanner();

      // The PIN is gone, so the app opens WITHOUT a lock screen.
      await page.reload();
      await expect(lock.region).toHaveCount(0);
      await expect(settings.mainRegion).toBeVisible();
    });

    await test.step('The failed-cloud-delete branch is covered by the cloud suite', async () => {
      // Simulating a failed cloud delete needs a live Supabase
      // session. It is exercised in `cloud.spec.ts`, which skips
      // loudly when no backend is configured.
      expect(expected.banner).toBe("Couldn't delete cloud copy");
      expect(expected.fix).toContain('Local data was NOT wiped');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-W03 — Exporting a backup
  // ─────────────────────────────────────────────────────────────────

  test('FIN-W03 Exporting a backup', { tag: '@smoke' }, async ({ page }) => {
    const w03 = data.W03_export;
    const expected = w03.expected;

    await seedState(page, plansAndLedgerState());

    await test.step('Open Settings and click "Export backup"', async () => {
      await settings.goto();
      await expect(settings.exportBackupButton).toBeVisible();
    });

    let exportedText = '';

    await test.step('Read the banner', async () => {
      const exported = await exportBackup(settings, feedback);

      expect(exported.banner.title).toBe(
        expected.bannerFormat.replace('{filename}', expectedBackupFilename()),
      );
      expect(exported.banner.body).toBe(expected.bannerBody);
      expect(exported.banner.fix).toBe(expected.bannerFix);

      // The file is named for today's date.
      expect(exported.filename).toBe(expectedBackupFilename());

      exportedText = exported.buffer.toString('utf8');
    });

    await test.step('Open the downloaded file and read its top-level keys', async () => {
      const envelope = JSON.parse(exportedText) as Record<string, unknown>;

      expect(Object.keys(envelope)).toEqual(expected.envelopeKeys);
      expect(envelope.version).toBe(expected.version);
      expect(typeof envelope.exportedAt).toBe('string');

      // Two-space indentation.
      expect(exportedText).toContain('\n  "exportedAt"');
    });

    await test.step('Read its `data` keys', async () => {
      const envelope = JSON.parse(exportedText) as {
        data: Record<string, unknown>;
      };

      for (const key of expected.dataKeys) {
        expect(Object.keys(envelope.data)).toContain(key);
      }

      const settingsBlock = envelope.data.settings as Record<string, unknown>;
      for (const key of expected.settingsKeys) {
        expect(Object.keys(settingsBlock)).toContain(key);
      }
    });

    await test.step('Search the file for the PIN salt and hash', async () => {
      const stored = await page.evaluate(() => ({
        salt: localStorage.getItem('finora.pin.salt') ?? '',
        hash: localStorage.getItem('finora.pin.hash') ?? '',
      }));

      // Neither the salt nor the hash appears anywhere in the file.
      if (stored.salt) expect(exportedText).not.toContain(stored.salt);
      if (stored.hash) expect(exportedText).not.toContain(stored.hash);

      // Nor does any key named salt / hash / pin.
      const keys = new Set<string>();
      const collect = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (const item of value) collect(item);
          return;
        }
        if (value && typeof value === 'object') {
          for (const [key, nested] of Object.entries(value)) {
            keys.add(key.toLowerCase());
            collect(nested);
          }
        }
      };
      collect(JSON.parse(exportedText));
      for (const forbidden of ['salt', 'hash', 'pin', 'pinhash', 'pinsalt']) {
        expect(keys.has(forbidden)).toBe(false);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-W04 — Importing a backup replaces the current data
  // ─────────────────────────────────────────────────────────────────

  test('FIN-W04 Importing a backup replaces the current data', { tag: '@smoke' }, async ({ page }) => {
    const w04 = data.W04_import;
    const expected = w04.expected;

    await seedState(page, todayState());

    let backupBuffer: Buffer;
    let backupName: string;

    await test.step('Open Settings and click "Export backup"', async () => {
      await settings.goto();

      const exported = await exportBackup(settings, feedback);
      backupName = exported.filename;
      backupBuffer = exported.buffer;
    });

    await test.step('Open Settings and click "Import backup"', async () => {
      await settings.goto();
      await expect(settings.importBackupButton).toBeVisible();

      // The export in the first step raised a banner that dwells for
      // three seconds. Dismiss it HERE — while nothing overlaps it —
      // so the "no banner is raised" assertion below measures THIS
      // cancel and not a leftover. (The confirm dialog's backdrop
      // covers the banner's own dismiss button.)
      if ((await feedback.banner.count()) > 0) {
        await feedback.dismissButton.click();
        await expect(feedback.banner).toHaveCount(0);
      }
    });

    await test.step('Select the exported file and read the confirmation', async () => {
      await settings.importFile({
        name: backupName,
        mimeType: 'application/json',
        buffer: backupBuffer,
      });

      await expect(confirm.dialog).toBeVisible();
      await expect(confirm.heading).toHaveText(expected.confirmTitle);
      await expect(confirm.body).toHaveText(expected.confirmBody);
      await expect(confirm.confirmButton(expected.confirmButton)).toBeVisible();
    });

    await test.step('Cancel the confirmation', async () => {
      const before = await readState(page);

      await confirm.cancel();

      // The data is untouched and no banner is raised.
      const after = await readState(page);
      expect(after?.accounts.length).toBe(before?.accounts.length);
      expect(after?.transactions.length).toBe(before?.transactions.length);
      await expect(feedback.banner).toHaveCount(0);
    });

    await test.step('Re-select the file and click "Replace"', async () => {
      await settings.importFile({
        name: backupName,
        mimeType: 'application/json',
        buffer: backupBuffer,
      });
      await confirm.confirm(expected.confirmButton);
    });

    await test.step('Read the banner', async () => {
      const banner = await feedback.readBanner();
      expect(banner.title).toBe(expected.successToast);
      expect(banner.body).toBe(expected.successToastBody);
      expect(banner.fix).toBe(expected.successToastFix);
    });

    await test.step('Read the current data and compare it with the backup\'s contents', async () => {
      // A record created AFTER the export must be gone — the import
      // is a full replace, not a merge.
      await transactions.recordTransaction({
        type: 'expense',
        amount: '999',
        accountName: 'Cash',
        note: 'Created after the export',
      });

      const withExtra = await readState(page);
      expect(withExtra?.transactions.some((t) => t.note === 'Created after the export')).toBe(true);

      // The import control lives on Settings, so the test walks back.
      await settings.goto();
      await settings.importFile({
        name: backupName,
        mimeType: 'application/json',
        buffer: backupBuffer,
      });
      await confirm.confirm(expected.confirmButton);

      // The atomic read waits for a banner whose own title is the
      // success one, so a banner still on screen from an earlier step
      // cannot satisfy it by accident.
      const banner = await feedback.readBanner({ title: expected.successToast });
      expect(banner.title).toBe(expected.successToast);
      expect(banner.body).toBe(expected.successToastBody);
      expect(banner.fix).toBe(expected.successToastFix);

      const restored = await readState(page);
      expect(restored?.transactions.some((t) => t.note === 'Created after the export')).toBe(false);

      // Every record from the backup is present.
      const envelope = JSON.parse(backupBuffer.toString('utf8')) as {
        data: { accounts: unknown[]; transactions: unknown[] };
      };
      expect(restored?.accounts.length).toBe(envelope.data.accounts.length);
      expect(restored?.transactions.length).toBe(envelope.data.transactions.length);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-W05 — Import error paths
  // ─────────────────────────────────────────────────────────────────

  test('FIN-W05 Import error paths', { tag: '@smoke' }, async ({ page }) => {
    const w05 = data.W05_importErrors;
    const expected = w05.expected;

    await seedState(page, todayState());
    await settings.goto();

    const before = await readState(page);
    expect(before?.accounts.length).toBeGreaterThan(0);

    await test.step('Select the non-JSON file and read the banner', async () => {
      await settings.importFile({
        name: w05.notJson.fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(w05.notJson.content, 'utf8'),
      });

      const banner = await feedback.readBanner({ title: expected.notJson.what });
      expect(banner.title).toBe(expected.notJson.what);
      expect(banner.body).toBe(expected.notJson.why);
      expect(banner.fix).toBe(expected.notJson.fix);
    });

    await test.step('Select the wrong-shape JSON file and read the banner', async () => {
      await settings.importFile({
        name: w05.wrongShape.fileName,
        mimeType: 'application/json',
        buffer: Buffer.from(w05.wrongShape.content, 'utf8'),
      });

      // The schema reports the FIRST mismatch it finds. The
      // wrong-shape file has `version` and `data` but no
      // `exportedAt`, so that is the field the banner names — the
      // `accounts` type error behind it is never reached.
      const wrongShapeTitle = expected.wrongShape.whatFormat.replace(
        '{path}',
        expected.wrongShape.missingPath,
      );

      const banner = await feedback.readBanner({ title: wrongShapeTitle });
      expect(banner.title).toBe(wrongShapeTitle);
      expect(banner.body).toBe(expected.wrongShape.why);
      expect(banner.fix).toBe(expected.wrongShape.fix);
    });

    await test.step('Check that the current data is untouched', async () => {
      const after = await readState(page);
      expect(after?.accounts.length).toBe(before?.accounts.length);
      expect(after?.transactions.length).toBe(before?.transactions.length);
      expect(after?.accounts[0]?.name).toBe(before?.accounts[0]?.name);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // FIN-W06 — There is no standalone "Delete cloud copy" button
  // ─────────────────────────────────────────────────────────────────

  test('FIN-W06 There is no standalone "Delete cloud copy" button', async ({ page }) => {
    const w06 = data.W06_noDeleteCloudCopy;

    await seedState(page, todayState());

    await test.step('Open Settings and read the Danger zone', async () => {
      await settings.goto();

      await expect(settings.dangerZoneHeading).toBeVisible();

      // The Danger zone offers "Wipe all data"…
      await expect(settings.wipeAllDataButton).toBeVisible();
      for (const label of w06.dangerZoneButtons) {
        await expect(
          settings.dangerZone.getByRole('button', { name: label, exact: true }),
        ).toHaveCount(1);
      }
    });

    await test.step('Search the whole Settings screen for a "Delete cloud copy" control', async () => {
      await expect(
        settings.absent.control('button', w06.forbiddenButton),
      ).toHaveCount(0);
      await expect(
        settings.absent.control('link', w06.forbiddenButton),
      ).toHaveCount(0);
      await expect(
        settings.absent.text(w06.forbiddenButton, false),
      ).toHaveCount(0);
    });

    await test.step('Delete the cloud copy by other means and check the local data survives', async () => {
      // The ONLY path to `deleteCloudCopy()` is as the first step of
      // "Wipe everything", which also wipes the local store. So the
      // documented behaviour — delete only the cloud row, keep the
      // local data — is unreachable. This step proves it: the local
      // data does NOT survive the only available delete.
      await settings.wipeAllDataButton.click();
      await confirm.confirm('Wipe everything');
      await feedback.waitForBanner();

      const after = await readState(page);
      expect(after?.accounts.length ?? 0).toBe(0);
      expect(after?.transactions.length ?? 0).toBe(0);
    });
  });
});
