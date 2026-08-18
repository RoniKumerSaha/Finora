# Epics & Stories — Google Drive Manual Sync (Finora V1.1)

**Source PRD:** `docs/prds/2026-08-18-prd-gdrive-sync.md`
**Author:** John (PM)
**Date:** 2026-08-18

Each story is sized for one dev to finish in a sitting or two. Acceptance
criteria are written in Given/When/Then so QA can lift them straight into
the test plan. Story IDs are stable and prefixed by epic.

---

## Epic GD-1 — Google Drive integration layer

The library that does the actual work. No UI, no store changes. Pure
functions + a thin auth wrapper, all unit-tested behind mocks.

### GD-1.1 — `googleDrive.ts` module skeleton + types

**Type:** Backend / library
**Dependencies:** none
**Scope:**
- Add `src/lib/googleDrive.ts` exporting the public API surface from the
  PRD §6 F1:
  ```ts
  export interface GdriveAuth {
    accessToken: string;
    expiresAt: number; // ms epoch
    scope: string;
  }
  export function loadTokens(): GdriveAuth | null;
  export function saveTokens(t: GdriveAuth): void;
  export function clearTokens(): void;
  export async function connect(): Promise<GdriveAuth>;
  export function disconnect(): Promise<void>;
  export async function saveBackup(state: State): Promise<{ fileId: string; modifiedTime: string }>;
  export async function listBackups(): Promise<Array<{ id: string; name: string; modifiedTime: string }>>;
  export async function restoreBackup(fileId: string): Promise<State>;
  export function isGisReady(): boolean;
  export function onGisReady(cb: () => void): () => void; // returns unsubscribe
  ```
- Token storage under `localStorage["finora:gdrive:tokens"]` (§7).
- No Drive API calls in this story — only the auth tokens.

**AC:**
- Given the localStorage key is empty, when `loadTokens()` is called, then it returns `null`.
- Given tokens are saved, when `loadTokens()` is called, then it returns the parsed object.
- Given tokens are cleared, when `loadTokens()` is called, then it returns `null` and the key is removed.
- All exports are typed; no `any` in the public surface.

---

### GD-1.2 — GIS bootstrap + feature flag

**Type:** Frontend wiring
**Dependencies:** GD-1.1
**Scope:**
- Add a single `<script>` tag injection for `https://accounts.google.com/gsi/client`
  in `App.tsx` (or a dedicated `GoogleIdentityLoader.tsx` component)
  with `async` + `defer`.
- Only inject when `import.meta.env.VITE_FEATURE_GDRIVE_SYNC === 'true'`.
- Expose `isGisReady()` and `onGisReady(cb)` from `googleDrive.ts`.
- On `error` from the script load, log to console + emit a one-shot
  `RoleAlertBanner` (string `'gdrive:script-load-failed'`) so the UI
  layer can subscribe.

**AC:**
- Given the feature flag is off, then no script tag is added to the DOM and `isGisReady()` returns `false`.
- Given the feature flag is on, when `<App />` mounts, then a single `<script>` with the GIS URL is present in `<head>`.
- When the script finishes loading, then `isGisReady()` returns `true` and any `onGisReady` callbacks fire.
- The script is loaded at most once per page load (no duplicates on re-renders).

---

### GD-1.3 — OAuth: connect / disconnect

**Type:** Library logic
**Dependencies:** GD-1.1, GD-1.2
**Scope:**
- `connect()` wraps `google.accounts.oauth2.initTokenClient` with:
  - `client_id` from `import.meta.env.VITE_GOOGLE_CLIENT_ID`
  - `scope: 'https://www.googleapis.com/auth/drive.file'`
  - `callback: (resp) => …` that resolves the promise
  - `error_callback: (err) => …` that rejects with a typed error
- Returns a `GdriveAuth` saved via `saveTokens()`.
- Throws a typed `GdriveAuthError` (subclass of `Error`) on user cancel,
  popup blocked, or `access_denied`.
- `disconnect()` calls `saveTokens(null)` → `clearTokens()` AND
  fire-and-forget revoke at `https://oauth2.googleapis.com/revoke?token=...`
  (failures are silent).

**AC:**
- When the user clicks "Connect" and authorises, tokens are saved and the promise resolves with the `GdriveAuth`.
- When the user closes the popup, the promise rejects with `GdriveAuthError` whose `code` is `'popup_closed'`.
- When the user denies, the promise rejects with `code: 'access_denied'`.
- After `disconnect()`, the `localStorage` key is gone and a network call to the revoke endpoint is attempted (asserted via `fetch` mock).

---

### GD-1.4 — Drive API: `saveBackup()` + folder bootstrap

**Type:** Library logic
**Dependencies:** GD-1.3
**Scope:**
- `saveBackup(state)`:
  1. Calls `google.accounts.oauth2.refresh` if `expiresAt - Date.now() < 60s`.
  2. `GET https://www.googleapis.com/drive/v3/files?q=name='Finora backups' and mimeType='application/vnd.google-apps.folder' and trashed=false` → if missing, `POST /files` with the folder mimeType.
  3. If a file with today's name exists in that folder, `PATCH /files/{id}` with the new content + `appProperties.finoraVersion = 1`. Otherwise `POST /files` with the same name.
  4. Body = `serializeExport(state)` (reuse existing function).
  5. Returns `{ fileId, modifiedTime }`.
- All errors with `gaxios`-style JSON are normalised to `{ code, message, status }` and re-thrown as `GdriveApiError`.

**AC:**
- Given no folder exists, when `saveBackup()` is called, then exactly one folder create + one file create happen.
- Given the folder exists but no file with today's name, then folder is reused and one file create happens.
- Given the folder and today's file exist, then folder is reused and one file PATCH happens (no new file).
- Given the access token is expired, then a refresh is attempted before the API call.
- On 401, throws `GdriveApiError` with `code: 'auth_expired'`.
- On 403 with `rateLimitExceeded`, throws with `code: 'rate_limited'`.

---

### GD-1.5 — Drive API: `listBackups()` + `restoreBackup()`

**Type:** Library logic
**Dependencies:** GD-1.4
**Scope:**
- `listBackups()`:
  - `GET /files?q=name contains 'finora-backup' and trashed=false&orderBy=modifiedTime desc&pageSize=20&fields=files(id,name,modifiedTime)`.
  - Returns `Array<{ id, name, modifiedTime }>`.
- `restoreBackup(fileId)`:
  - `GET /files/{fileId}?alt=media`.
  - Returns the raw JSON string → already parsed? No: hand the **string**
    back. The caller (Settings UI) pipes it through the existing
    `parseImport()` for shared validation.
  - Re-exported helper: `fetchBackupText(fileId): Promise<string>` so the
    UI can wire cleanly.

**AC:**
- `listBackups()` returns the files newest-first, matching the response order.
- `listBackups()` with no matching files returns `[]`.
- `fetchBackupText(fileId)` returns the exact body that Drive returned (no transform).
- On 404, throws `GdriveApiError` with `code: 'not_found'`.
- On 403, throws with `code: 'forbidden'`.

---

### GD-1.6 — `googleDrive.ts` test suite

**Type:** Tests
**Dependencies:** GD-1.3, GD-1.4, GD-1.5
**Scope:**
- All `google.accounts.oauth2` calls are mocked via a single
  `__mocks/identity.ts` test helper.
- `fetch` is mocked globally; a recorded-call helper lets assertions
  state exact URL + method + body.
- Coverage ≥ 95% lines on `src/lib/googleDrive.ts`.
- Tests live in `src/lib/googleDrive.spec.ts`.

**AC:**
- Run `npm test` → all `googleDrive.spec.ts` cases pass.
- Coverage report on `googleDrive.ts` shows ≥ 95% lines.
- No skipped tests.
- A round-trip test (save → list → fetchBackupText) succeeds with a
  recorded `fetch` script.

---

## Epic GD-2 — Store + settings extensions

Additive, backward-compatible changes to the domain layer.

### GD-2.1 — `Settings.cloudBackup` field

**Type:** Domain types
**Dependencies:** none
**Scope:**
- Extend `Settings` in `src/domain/types.ts` with:
  ```ts
  cloudBackup?: {
    lastSavedAt?: string; // ISO datetime
  };
  ```
- Update `persistence.ts` `mergeDefaults` so existing installations
  silently get `cloudBackup: {}` (no `lastSavedAt`).
- Update `exportEnvelopeSchema` in `schemas.ts` to make `cloudBackup`
  optional inside `data.settings`.

**AC:**
- Existing V1 backups (no `cloudBackup`) still pass `exportEnvelopeSchema.safeParse`.
- After loading a V1 backup, `state.settings.cloudBackup` is `{}` (not `undefined`).
- No regression in the existing persistence tests.

---

### GD-2.2 — `cloudBackupStore` slice

**Type:** Store
**Dependencies:** GD-2.1
**Scope:**
- Add to `src/domain/store.ts`:
  ```ts
  setCloudBackupLastSavedAt: (iso: string) => void;
  hasCloudBackupSaved: () => boolean; // selector helper
  ```
- `setCloudBackupLastSavedAt` updates `state.settings.cloudBackup.lastSavedAt`
  and persists via `save()`.
- Selector `hasCloudBackupSaved` returns `true` iff `lastSavedAt` is a
  non-empty string.

**AC:**
- After `setCloudBackupLastSavedAt('2026-08-18T12:00:00Z')`, `state.settings.cloudBackup.lastSavedAt === '2026-08-18T12:00:00Z'`.
- `save()` is called exactly once.
- Existing store tests still pass.

---

## Epic GD-3 — Settings UI

The visible surface. Reuses existing components — no new design tokens.

### GD-3.1 — Cloud backup section + Connect/Disconnect

**Type:** UI
**Dependencies:** GD-1.2, GD-2.1
**Scope:**
- Add a new `<section>` inside the existing `Settings → Backup` card,
  rendered only when both `VITE_FEATURE_GDRIVE_SYNC` is on AND
  `isGisReady()` is true.
- Header: `Cloud backup (Google Drive)`.
- Disconnected state: single primary button `Connect Google Drive`.
- Connected state: shows email + `Disconnect` (text link), then the two
  CTA buttons in §5.
- "Last saved" line uses `hasCloudBackupSaved()` and renders
  `<relative-time>` from `format.ts` (existing utility).
- Uses existing `Button` + `RoleAlertBanner` — no new components.

**AC:**
- Given the feature flag is off, the section is not in the DOM.
- Given the user is connected, the email + `Disconnect` link are visible.
- Given the user is disconnected, only the `Connect` button is visible.
- `Last saved: 2 hours ago` renders correctly when `cloudBackup.lastSavedAt` is set; `Last saved: Never` when not.
- All buttons use the existing `Button` component (no inline Tailwind button styles).

---

### GD-3.2 — Save-to-Drive flow

**Type:** UI wiring
**Dependencies:** GD-1.4, GD-2.2, GD-3.1
**Scope:**
- `onSaveToDrive()`:
  - Set `working: true` → both Cloud buttons disabled.
  - `try { const r = await saveBackup(state); setCloudBackupLastSavedAt(r.modifiedTime); showBanner(success) }`
  - On `GdriveApiError` with `code: 'auth_expired'`, drop to Disconnected
    and show a re-auth banner.
  - On other errors, three-part banner via `errors.ts`.
  - On success, banner: `Saved to Drive` / `File finora-backup-YYYY-MM-DD.json was updated in your Finora backups folder` / `Open drive.google.com to see it.`

**AC:**
- When `saveBackup` resolves, `Last saved` updates within the same screen view.
- When `saveBackup` rejects with `auth_expired`, the section visually transitions to Disconnected, and the Cloud CTAs are gone.
- When `saveBackup` rejects with a network error, both CTAs remain enabled and a three-part banner is shown.
- When the user clicks `Save backup to Drive` twice quickly, the second click is a no-op (button disabled).

---

### GD-3.3 — Restore-from-Drive flow + picker

**Type:** UI wiring
**Dependencies:** GD-1.5, GD-3.1
**Scope:**
- `onRestoreFromDrive()`:
  - `working: true`.
  - `const list = await listBackups()`.
  - **0 files** → banner: `No backups found in your Finora backups folder.` / `Save one first.` / `Open drive.google.com → Finora backups.`
  - **1 file** → modal confirm: `Restore from Drive?` / `This will overwrite every account, transaction, goal, debt, investment, and plan currently in the app with the backup dated <relative time>.` / `Restore` (danger).
  - **2+ files** → modal list (filename + `modifiedTime` rendered as relative time). User picks → same confirm chain as the 1-file case.
- On confirm → `fetchBackupText(fileId)` → reuse `parseImport(text)` → reuse existing **Replace current data?** confirm → `importAndReplace(parsed)`. The last two confirm dialogs are the existing ones from local import; only the *first* confirm is new.
- On `GdriveApiError` with `code: 'auth_expired'`, drop to Disconnected.
- On other errors, three-part banner.

**AC:**
- With 0 backups: a single banner is shown, no confirm dialogs.
- With 1 backup: exactly one new confirm dialog appears, then the existing replace-confirm, then `importAndReplace` is called.
- With 2+ backups: the picker modal lists backups newest-first by `modifiedTime`.
- After a successful restore, the `Last saved` line is **not** updated (it's a restore, not a save).
- After restore, the local `State` is byte-identical to the parsed Drive payload (modulo `recomputeDerived` projections).

---

### GD-3.4 — Disconnect UX

**Type:** UI
**Dependencies:** GD-1.3, GD-3.1
**Scope:**
- `Disconnect` link uses the existing `useConfirm()` with title
  `Disconnect Google Drive?` / body `You can still use local backup. To
  reconnect, tap Connect Google Drive again.` / `Disconnect` (default).
- On confirm: `await disconnect()` + `showBanner(success)`.
- Section transitions to Disconnected state.

**AC:**
- After `Disconnect`, the localStorage token key is gone (verified by re-loading the section).
- The banner is shown exactly once and contains the standard three-part structure.

---

## Epic GD-4 — Hardening & ship

The bits that aren't user-visible but have to exist for the feature to be
safe to ship.

### GD-4.1 — Hide Cloud section on `file://`

**Type:** Defensive UX
**Dependencies:** GD-3.1
**Scope:**
- In `App.tsx` (or a hook), detect `window.location.protocol === 'file:'`
  and skip rendering the Cloud section.
- Add a dev-only `console.warn` explaining why.
- A unit test on the rendering condition.

**AC:**
- When the app is loaded from `file://`, the Cloud backup section is not in the DOM.
- When loaded from `http://localhost:5173` (dev) or `https://...` (deploy), the section renders normally.
- The check is per-render, not sticky — works on production builds too.

---

### GD-4.2 — `file://` graceful degradation banner

**Type:** UX
**Dependencies:** GD-4.1
**Scope:**
- If the user has the Cloud section expectation set BUT the page is
  served from `file://`, show a one-line note inside the Backup card:
  `Cloud backup requires hosting this app on the web. Use Export/Import or
  host the build on Netlify/Vercel/GitHub Pages to enable it.`
- Only shown when the feature flag is on (we don't want to nag users who
  never asked).

**AC:**
- When the flag is off, the note is not shown.
- When the flag is on AND the app is on `file://`, the note renders once at the bottom of the Backup card.
- When hosted, the note is not shown.

---

### GD-4.3 — Build-time env wiring + flag defaults

**Type:** Build config
**Dependencies:** none
**Scope:**
- Add to `vite.config.ts` (or `.env`):
  - `VITE_FEATURE_GDRIVE_SYNC` (default `false`).
  - `VITE_GOOGLE_CLIENT_ID` (no default — empty string hides the section).
- Add a `.env.example` documenting both.
- README section: *Cloud backup (Google Drive)* with the OAuth client
  setup steps and link to the Google Cloud console.

**AC:**
- `npm run build` succeeds with the env vars unset (Cloud section is just hidden).
- `npm run build` succeeds with `VITE_FEATURE_GDRIVE_SYNC=true` and no `VITE_GOOGLE_CLIENT_ID` (section hidden, no runtime error).
- A new `npm run build:gdrive` script documents the env setup.

---

### GD-4.4 — End-to-end round-trip test

**Type:** Integration test
**Dependencies:** GD-1.6, GD-3.2, GD-3.3
**Scope:**
- In `tests-setup.ts` (or new `vitest.config.ts` setup), mock `google.accounts.oauth2` + `fetch` against a recorded Drive response.
- A virtual test that:
  1. Loads default state.
  2. Adds one transaction.
  3. Calls `saveBackup(state)` → assert `fetch` was called with the right URL + body.
  4. `listBackups()` returns 1 file.
  5. `fetchBackupText(fileId)` → assert the body is the same JSON envelope.
  6. `parseImport(body)` → `importAndReplace()` → assertion: account & transaction counts match.
- No real network calls.

**AC:**
- New test passes locally.
- Test runs in < 500 ms.
- Test file is co-located with the existing `exportImport.spec.ts` to keep storage tests together.

---

### GD-4.5 — Bundle-size + visual regression check

**Type:** Release gate
**Dependencies:** GD-4.3
**Scope:**
- Measure `dist/` size before/after with the feature flag on and off.
- Confirm the Settings screen renders identically with the flag off
  (visual regression via screenshot diff or manual checklist).
- Update `README.md` deploy section with the new env vars.

**AC:**
- After enabling the feature flag, `dist/` size grows by ≤ 5 KB gzip on the main chunk.
- With the flag off, the Settings screen DOM is unchanged from V1.0.
- README mentions the new env vars under Deploy.

---

## Dependency map

```
GD-1.1 ──► GD-1.2 ──► GD-1.3 ──► GD-1.4 ──► GD-1.5 ──► GD-1.6
                                                              │
GD-2.1 ──► GD-2.2 ─────────────────────────────────────────────┤
                                                              ▼
                                          GD-3.1 ──► GD-3.2 ──► GD-3.3
                                  GD-1.2 ┘                      │
                                                               ▼
                                  GD-3.4 ──► GD-4.1 ──► GD-4.2 ──► GD-4.3 ──► GD-4.4 ──► GD-4.5
```

## Suggested sprint order

1. **Sprint 1 (foundation):** GD-1.1, GD-1.2, GD-1.3, GD-2.1, GD-2.2
   — gets the auth flowing and the schema ready, no UI changes yet.
2. **Sprint 2 (API + UI):** GD-1.4, GD-1.5, GD-1.6, GD-3.1, GD-3.2, GD-3.3, GD-3.4
   — connects the wires, ships the user-visible feature behind the flag.
3. **Sprint 3 (hardening + release):** GD-4.1, GD-4.2, GD-4.3, GD-4.4, GD-4.5
   — pass the release gate, flip the flag on for everyone.

## Acceptance

All stories above have written AC. The PRD is approved for sprint planning.
