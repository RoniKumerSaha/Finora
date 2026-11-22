/**
 * cloud.nosync.spec.ts — FIN-C01.
 *
 * The sync-disabled build.
 *
 * ## Why this case has its own spec file
 *
 * FIN-C01's precondition is *"A build without Supabase environment
 * variables, or sync explicitly disabled."* Cloud sync is a
 * BUILD-TIME decision — `src/lib/supabase.ts` reads
 * `import.meta.env.BASE_URL` / `import.meta.env.BASE_ANON_KEY` and
 * exports `supabase === null` when either is missing. When it is null
 * the `SyncEngine` reports `unconfigured` and the Settings panel
 * renders the "Cloud sync is disabled in this build" notice.
 *
 * So the case cannot be asserted against the ordinary dev server: a
 * developer (and CI) normally HAS `.env.local` with real credentials,
 * which makes that server the *configured* build.
 *
 * This file therefore matches the `no-sync` Playwright project, which
 * runs its own Vite instance via `vite.config.nosync.ts`. That config
 * points Vite's `envDir` at an empty scratch directory, so
 * `.env.local` is never read and the bundle sees `''` for both
 * names — a genuine "fresh checkout, no `.env.local`" build.
 *
 * The `.nosync.spec.ts` suffix is what the project's `testMatch`
 * looks for, and the `chromium` project ignores it.
 *
 * ## The FIN-C01 known gap
 *
 * The manual case records a gap: *"the on-screen instruction names
 * `BASE_URL` and `BASE_ANON_KEY`, but the app reads
 * `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`"*.
 *
 * **That is no longer true of the Settings panel.** The panel copy
 * in `src/components/AccountSection.tsx` names `BASE_URL` and
 * `BASE_ANON_KEY` — the names the app ACTUALLY reads (see
 * `vite.config.ts`'s `define` block and `src/lib/supabase.ts`) — so
 * following the instruction as written DOES enable sync. The stale
 * `VITE_SUPABASE_*` pair survives only in the tooltip of
 * `src/components/SyncStatusPill.tsx`, which the app no longer
 * renders in the sidebar.
 *
 * This spec asserts the SHIPPED copy — the panel naming `BASE_URL` /
 * `BASE_ANON_KEY` — because that is what the user actually sees.
 */
import { expect, test } from '@playwright/test';
import { SettingsPage } from '../pages/SettingsPage';
import authJson from '../../data/auth.json' with { type: 'json' };

const data = authJson;

test.describe('Cloud sync (sync-disabled build)', () => {
  let settings: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
  });

  test('FIN-C01 The sync-disabled build and the signed-out panel', async () => {
    const expected = data.C01_syncDisabled.expected;

    await test.step('Open Settings and read the Cloud sync panel', async () => {
      await settings.goto();

      // The panel is the SYNC-DISABLED variant. If it is not, the
      // server this test ran against was the CONFIGURED build, and
      // the assertion would silently measure the wrong branch — so
      // the failure says so explicitly.
      await expect(settings.syncDisabledNotice).toBeVisible();
      await expect(settings.syncDisabledNotice).toHaveText(expected.panelNotice);

      // The pill reads "Cloud sync off" for the unconfigured state.
      await expect(settings.syncStatusPill).toHaveText(
        data.C03_signedIn.expected.pillLabels[0],
      );
    });

    await test.step('Read the signed-out panel copy', async () => {
      // A sync-disabled build does NOT render the signed-out blurb
      // or the "Sign in" button — the panel explains why sync is
      // off instead. Asserting they are ABSENT keeps the case from
      // passing vacuously on the configured branch.
      await expect(settings.signedOutBlurb).toBeHidden();
      await expect(settings.signInButton).toBeHidden();
    });
  });
});
