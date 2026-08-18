# PRD — Google Drive Manual Sync (Finora V1.1)

**Status:** Draft
**Author:** John (PM)
**Date:** 2026-08-18
**Target release:** Finora V1.1 (additive — no V1 contract changes)
**Owner:** TBD
**Related:** `PRD.md` §9.10 (Backup & Restore), `ARCHITECTURE-SPINE.md` AD-2/AD-3/AD-10/AD-20

---

## 1. Problem

Today, Finora's only data portability story is **local file** — the user
clicks *Export backup* and gets a JSON file in their downloads folder. To
restore, they have to keep that file somewhere, pick it back up, and
import it. In practice this means:

- Most users **never back up at all**. The data is trapped in one browser.
- Switching devices (laptop → phone browser, old laptop → new) requires
  the user to manually ferry the JSON file — easy to forget, easy to
  lose, easy to over-write the wrong file.
- There is no "oops" recovery — if the user wipes their browser data and
  did not export last week, the data is gone.

The user pain is real but the volume is low (single-user, local-only app).
We are **not** building a real-time multi-device sync product. We are
building the smallest thing that solves the "my data is now on a second
device" problem without violating the "local-only, no telemetry" promise
in the About panel.

## 2. Goal

Give the user a one-click way to **push** the current Finora state to a
Google Drive folder they can see, and a matching one-click way to
**pull** the latest backup back into Finora on another device. The local
Export/Import buttons stay exactly as they are.

**Primary success outcome:** A user with Finora open on Device A can
restore their data on Device B in under 90 seconds, with zero
file-management on their part.

## 3. Non-goals

- **No automatic background sync.** Save-to-Drive is a deliberate user
  action every time. We are not building reconciliation, conflict
  resolution, or polling.
- **No multi-user / shared books.** One Google account = one independent
  Finora state. Family sharing is out of scope.
- **No real-time collaboration.** This is not Google Docs.
- **No encryption layer in V1.1.** The backup JSON is uploaded as plain
  text inside the user's own Drive. Documented as a follow-up (see §9).
- **No migration of V1.0 contracts.** The export envelope
  (`{ version, exportedAt, data }`) is unchanged. Existing import
  validation (`exportEnvelopeSchema`) is reused.

## 4. Users & use cases

### Primary persona
**Rahim, 32, Dhaka, Android-first.** Uses Finora on his phone browser
most days, occasionally on a work laptop. Tech-comfortable but not a
developer. Already has a Google account and uses Google Drive daily.

### Use cases

| ID  | Story                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| U1  | Rahim buys a new phone. He opens Finora, signs in to Google Drive, and his last week of transactions is back in 60 seconds.        |
| U2  | Rahim just paid a big bill and wants a safety net. He taps *Save to Drive* and goes back to his day.                               |
| U3  | Rahim accidentally wipes data. He opens *Restore from Drive*, picks the latest backup, and confirms — same state as before.         |
| U4  | Rahim does not want anything to do with Google. He continues using the existing local Export/Import without ever seeing Drive UI.    |

## 5. UX (high level)

Sits inside the existing **Settings → Backup** card. No new screen.

```
┌─ Backup ─────────────────────────────────────────────┐
│  [Export backup]   [Import backup]                   │  ← unchanged
│                                                      │
│  ── Cloud backup (Google Drive) ──                   │  ← new
│  Status: ● Connected as rahim@gmail.com  [Disconnect]│
│                                                      │
│  [Save backup to Drive]                              │
│  [Restore from Drive]                                │
│                                                      │
│  Last saved to Drive: 2 hours ago                    │
└──────────────────────────────────────────────────────┘
```

**State transitions for the Cloud section:**

1. **Disconnected** (default first time)
   - Single CTA: **Connect Google Drive** → opens GIS popup.
   - On success → state 2. On failure → error banner with three-part
     message (matches existing `RoleAlertBanner` style).
2. **Connected**
   - Header shows email + Disconnect.
   - Two CTAs: **Save backup to Drive** and **Restore from Drive**.
   - Footer line: `Last saved to Drive: <relative time>` (or "Never").
3. **Working** (any in-flight network call)
   - Both CTAs disabled, spinner inside the button.
   - No hard modal — the user can navigate away.
4. **Error** (e.g. token expired, network down)
   - Localised three-part error via existing `RoleAlertBanner`. Both
     CTAs remain clickable. If the error is auth-related, the section
     falls back to **Disconnected** state.

### Restore flow (decision: one → auto, many → picker)

When user clicks **Restore from Drive**:
- Drive folder is listed for `name contains 'finora-backup'`.
- **0 files** → banner: "No backups found in your Drive folder."
- **1 file** → confirm dialog ("Replace current data with backup from
  Drive, last edited 2 days ago?"). On confirm → download → parse via
  existing `parseImport()` → existing **Replace current data?** confirm →
  `importAndReplace()`.
- **2+ files** → small modal list (filename + modified date, newest
  first). User picks one → same confirm chain as the 1-file case.

### Save flow

When user clicks **Save backup to Drive**:
- Same envelope as local export (`buildExport(state)`).
- File name: `finora-backup-YYYY-MM-DD.json` (same name as local).
- Folder: `Finora backups` (created on first save via
  `drive.files.create` with `mimeType: application/vnd.google-apps.folder`).
- Overwrite semantics: if a file with that exact name exists in the
  folder, **update** it (same `fileId`, new content + new `modifiedTime`).
  Rationale: keeps the Drive folder tidy; "latest is the file".
- On success: banner + update `Last saved to Drive` line.

### Auth UX

- GIS Token Model, popup.
- Client ID injected via `VITE_GOOGLE_CLIENT_ID` env var (build-time).
- Scope: `https://www.googleapis.com/auth/drive.file` (the narrowest
  scope — read/write only files Finora creates).
- On disconnect, the local access token is discarded. The refresh token
  (if any) is best-effort revoked via Google's revoke endpoint, but
  failure there is silent — the user can still revoke from
  https://myaccount.google.com/permissions.

### What is **not** changing

- The local `Export backup` / `Import backup` buttons, their handlers,
  the file format, the `ConfirmDialog` flows, the `RoleAlertBanner`.
- The store, `recomputeDerived`, `persistence.ts`, `schemas.ts`.
- The router, theme, navigation.

## 6. Functional requirements

| ID  | Requirement                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | A new `src/lib/googleDrive.ts` module exposes `connect`, `disconnect`, `saveBackup`, `listBackups`, `restoreBackup`.                       |
| F2  | OAuth tokens are stored under `localStorage` key `finora:gdrive:tokens` — **separate** from the exported `State` blob.                      |
| F3  | The Cloud section is **only rendered** when the feature flag is on (see §8) AND the GIS script has loaded.                                  |
| F4  | `saveBackup()` writes `{ version, exportedAt, data: State }` to `Finora backups/finora-backup-YYYY-MM-DD.json`, overwriting if same name.    |
| F5  | `restoreBackup()` reuses `parseImport()` and `importAndReplace()` unchanged. Same `ConfirmDialog` chain.                                    |
| F6  | `lastSavedToDriveAt` is stored in `settings` (under a new `cloudBackup: { lastSavedAt?: ISODateTime }` field, optional for back-compat).   |
| F7  | Auth errors with `401` / `invalid_grant` → silently drop to **Disconnected** state and show a banner asking user to reconnect.              |
| F8  | All network errors surface via the existing three-part banner (`what / why / fix`).                                                         |
| F9  | The Cloud section is **hidden** completely when running from `file://` (Google OAuth requires HTTPS / `localhost`).                          |
| F10 | No `localStorage` write happens during the Drive operation unless the underlying state actually changes (don't re-save on empty restore).  |

## 7. Data

### Backup file (also reused by local export — no change)

```json
{
  "version": 1,
  "exportedAt": "2026-08-18T12:34:56.000Z",
  "data": { /* full State */ }
}
```

### Tokens (new)

Stored at `localStorage["finora:gdrive:tokens"]`:

```json
{
  "accessToken": "ya29...",
  "expiresAt": 1724000000000,
  "scope": "https://www.googleapis.com/auth/drive.file"
}
```

**Why not in the State blob:** if it were in `State`, it would be exported
to the user's JSON backup and uploaded to Drive — credentials leak.

### Settings extension (new, additive)

```ts
interface Settings {
  theme: 'dark' | 'light' | 'auto';
  onboardingComplete: boolean;
  cloudBackup?: {
    lastSavedAt?: string; // ISO datetime
  };
}
```

`cloudBackup` is optional. Older backups without it load fine.

### Drive folder structure

```
My Drive/
└── Finora backups/
    └── finora-backup-2026-08-18.json   ← overwritten in place on each save
```

We keep **one** current file per day-named-save. Older saves are not
versioned in V1.1 (see §9).

## 8. Technical constraints

- **Stack:** no new runtime deps unless forced. The GIS SDK is loaded
  via `<script>` from `https://accounts.google.com/gsi/client` (no
  npm install). The Drive REST API is called via `fetch` — no
  `googleapis` npm package.
- **Build:** `VITE_GOOGLE_CLIENT_ID` is required at build time. If
  missing, the Cloud section is hidden (defensive: see F3).
- **Testing:** target 95% line coverage on `src/lib/googleDrive.ts`.
  Unit tests mock `fetch` + `google.accounts.oauth2`. The Settings UI
  is tested via existing `react-testing-library` patterns.
- **Bundle budget:** +5 KB gzip on the main chunk. The GIS script is
  lazy-loaded when the user opens the Settings screen for the first
  time.
- **Feature flag:** `VITE_FEATURE_GDRIVE_SYNC` (default `false`).
  Enables gradual rollout + lets us ship the code behind a flag for
  one sprint before flipping it on. When the flag is off, the Cloud
  section is not rendered at all.

## 9. Out of scope / future work

| Item                                                              | Why deferred                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Client-side encryption of the backup before upload                | Needs a key derivation story + UX for "forgot passphrase".   |
| Versioned backups (keep last N dated files)                       | Not requested. One-named-file overwrite is enough for V1.1.   |
| Auto-sync on every save                                           | Needs conflict-resolution policy + per-device identity.       |
| Other providers (Dropbox, OneDrive, iCloud)                       | One provider validates the pattern; don't pre-build.          |
| Migrate/auto-upload the existing `Settings.cloudBackup` schema    | Forward-only — no V1 → V1.1 migration needed.                 |
| Setting to choose between `appDataFolder` and visible folder      | Visible folder is the V1.1 default (decided).                 |

## 10. Success metrics

N/A as hard numbers in V1.1 — this is a release-validation feature, not a
growth lever. We will accept the release if:

- [ ] All 10 functional requirements pass manual QA on Chrome + Firefox
      + Safari + mobile Chrome + mobile Safari.
- [ ] Coverage on `src/lib/googleDrive.ts` ≥ 95%.
- [ ] Round-trip test: clear data → save to Drive on Device A → restore
      on Device B → state is byte-identical (modulo `exportedAt`).
- [ ] Existing local Export/Import tests still pass with no changes.
- [ ] `npm run build` size warning delta ≤ 5 KB gzip.

## 11. Risks

| Risk                                                             | Likelihood | Mitigation                                             |
| ---------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| Google OAuth popup blocked (Safari ITP, embedded WebViews)      | Medium     | Document limitation; fallback to redirect in V1.2.     |
| User uploads backup to a shared Drive folder → other users see it | Low        | Document the scope; `:drive.file` limits app access.   |
| Token expires mid-session                                       | Medium     | F7 auto-reconnects + banners.                          |
| Network failure during save                                     | Medium     | F8 three-part banner; no partial writes (Drive is atomic on file replace). |
| Encrypted data leak via backup JSON (no encryption in V1.1)     | Low        | Document explicitly; offer encryption in V1.2.         |

## 12. Open questions

- (none — all three gating decisions resolved: popup, one→auto/many→picker, visible folder)

---

## Acceptance

This PRD is ready for the **Create Epics & Stories** step.
