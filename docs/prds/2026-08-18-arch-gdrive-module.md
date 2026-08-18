# Architecture — `src/lib/googleDrive.ts`

**Author:** Winston (Architect)
**Date:** 2026-08-18
**For:** Sprint 1, stories GD-1.1, GD-1.2, GD-1.3, GD-1.4, GD-1.5, GD-1.6
**Reads:** `docs/prds/2026-08-18-prd-gdrive-sync.md`, `docs/prds/2026-08-18-stories-gdrive-sync.md`

---

## 1. Goal

Lock down the shape of the integration module so the dev agent can
build GD-1.1 → GD-1.6 mechanically. **Not code** — signatures, error
taxonomy, lifecycle, file layout, test strategy.

## 2. File layout

```
src/lib/
  googleDrive.ts          ← public API; no side effects at import
  googleDrive.script.ts   ← <script> tag injector (separate so
                             googleDrive.ts is importable in tests
                             without touching the DOM)
  googleDrive.spec.ts     ← vitest unit tests
  __mocks__/gis.ts        ← manual stub for google.accounts.oauth2 +
                             the GIS global; consumed by every spec
                             that touches the auth surface
```

**Why split the script injector:** `googleDrive.ts` is imported by both
`App.tsx` (lifecycle) and `SettingsScreen.tsx`. If the script tag were
injected at module import time, every unit test would try to create a
`<script>` in happy-dom. Keeping the DOM work behind `loadGisScript()`
lets `googleDrive.ts` remain a pure ES module.

`__mocks__/gis.ts` exports:
- `installGisMock()` — patches `globalThis.google.accounts.oauth2`
- `resetGisMock()` — for `beforeEach`
- `__gis` — record object the specs assert against

## 3. Public API (final)

```ts
export interface GdriveTokens {
  accessToken: string;
  expiresAt: number;        // ms epoch
  scope: string;            // always drive.file in V1.1
  email?: string;
}

export interface BackupFile {
  id: string;
  name: string;
  modifiedTime: string;     // RFC3339 from Drive
}

export interface SaveResult {
  fileId: string;
  modifiedTime: string;
}

export type GdriveErrorCode =
  | 'popup_closed'
  | 'access_denied'
  | 'popup_blocked'
  | 'script_load_failed'
  | 'script_not_ready'
  | 'auth_expired'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'network'
  | 'parse'
  | 'unknown';

export class GdriveError extends Error {
  readonly code: GdriveErrorCode;
  readonly status?: number;
  readonly cause?: unknown;
  constructor(code: GdriveErrorCode, message: string, opts?: { status?: number; cause?: unknown });
}

// ── Token storage (GD-1.1) ───────────────────────────────────────
export const GDRIVE_TOKENS_KEY = 'finora:gdrive:tokens';
export function loadTokens(): GdriveTokens | null;
export function saveTokens(t: GdriveTokens): void;
export function clearTokens(): void;

// ── GIS lifecycle (GD-1.2) ───────────────────────────────────────
export function isGisReady(): boolean;
export function onGisReady(cb: () => void): () => void;       // unsubscribe
export function loadGisScript(): Promise<void>;               // idempotent
export type GisLoadErrorListener = (reason: GdriveError) => void;
export function onGisLoadError(cb: GisLoadErrorListener): () => void;

// ── Auth (GD-1.3) ────────────────────────────────────────────────
export function connect(): Promise<GdriveTokens>;
export function disconnect(): Promise<void>;
export function getAccessToken(): Promise<string>;             // refreshes if needed

// ── Drive API (GD-1.4, GD-1.5) ───────────────────────────────────
export async function saveBackup(state: import('../domain/types').State): Promise<SaveResult>;
export async function listBackups(): Promise<BackupFile[]>;
export async function fetchBackupText(fileId: string): Promise<string>;

// ── Module-level feature flag check ──────────────────────────────
export function isFeatureEnabled(): boolean;
```

**Decisions:**

- `connect()` returns populated tokens (with `email`) — no second
  round-trip needed in the UI.
- `getAccessToken()` is the **only** path that talks to
  `google.accounts.oauth2`. `saveBackup` / `listBackups` /
  `fetchBackupText` go through it. Single seam for refresh and mock.
- `listBackups()` caps at 20 (`pageSize: 20`). Pagination is a follow-up.
- `fetchBackupText(fileId)` returns the **raw string**. Caller pipes it
  through `parseImport()` so validation stays in one place.
- `GdriveError` extends `Error`; UI discriminates on `code`, not message.

## 4. Error class hierarchy

One base class, `code` is the discriminator. UI never string-matches
on `message`.

```
GdriveError
  ├─ 'popup_closed'        — connect(); user closed OAuth popup
  ├─ 'access_denied'       — connect(); user clicked Cancel
  ├─ 'popup_blocked'       — connect(); initTokenClient threw
  │                          'popup_failed' or 'popup_closed' before
  │                          user saw UI
  ├─ 'script_load_failed'  — emitted via onGisLoadError; UI hides
  │                          Cloud section + logs
  ├─ 'script_not_ready'    — connect() called before GIS ready;
  │                          UI should disable button via ready hook
  ├─ 'auth_expired'        — Drive 401; tokens cleared internally;
  │                          UI drops to Disconnected
  ├─ 'forbidden'           — Drive 403
  ├─ 'not_found'           — Drive 404
  ├─ 'rate_limited'        — Drive 429
  ├─ 'network'             — fetch threw (offline, DNS, CORS)
  └─ 'parse'               — fetched body is not a valid envelope;
                              surfaced when parseImport throws —
                              wrap at the UI boundary, not here
  └─ 'unknown'             — fallback
```

**UI banner messages live in `SettingsScreen.tsx`**, not in this
module. Keeps human-language copy next to the UI.

## 5. Lifecycle hooks (GIS script)

States: **not loaded → loading → ready** (terminal). Single private
singleton; multiple callers asking for the script at once get the same
promise.

- `loadGisScript()` — idempotent. Resolves immediately if already
  ready; returns in-flight promise if loading. 10s default timeout
  (configurable via `{ timeoutMs }`). On timeout the injected tag is
  removed and `onGisLoadError` fires with `'script_load_failed'`.
- `isGisReady()` — boolean, safe any time.
- `onGisReady(cb)` — subscribes; if already ready, cb fires on next
  microtask. Returns unsubscribe.
- `onGisLoadError(cb)` — fires once if `loadGisScript` rejects. Never
  retried. Returns unsubscribe.

**Hard rules:**

1. The `<script>` tag is created once per page load (keyed by an
   internal `_scriptEl` symbol property).
2. `VITE_FEATURE_GDRIVE_SYNC !== 'true'` short-circuits everything:
   `loadGisScript()` resolves without injecting; `isGisReady()` returns
   `false`; `connect()` rejects with `'script_not_ready'`.
3. The 10s timeout is why the Cloud section will never appear stuck.

## 6. Token storage

```
GDRIVE_TOKENS_KEY = 'finora:gdrive:tokens'
```

```json
{
  "accessToken": "ya29.…",
  "expiresAt": 1724000000000,
  "scope": "https://www.googleapis.com/auth/drive.file",
  "email": "rahim@gmail.com"
}
```

- **Separate** key from the `State` blob (`finora:v1`). Tokens must
  never appear in the export JSON.
- `loadTokens()` is defensive — catches JSON parse + `localStorage`
  access errors and returns `null`.
- `saveTokens()` swallows quota errors with a `console.warn`; UI
  treats missing tokens as "disconnected" and offers re-connect.
- `clearTokens()` is the only path that `removeItem`s.

## 7. Connect / disconnect / refresh

### `connect()`
1. Assert `isGisReady()` — else reject `'script_not_ready'`.
2. Read `VITE_GOOGLE_CLIENT_ID`. Empty → reject `'unknown'` +
   `console.error` to set the env var.
3. `google.accounts.oauth2.initTokenClient({ client_id, scope: 'drive.file', callback, error_callback })`.
4. `requestAccessToken({ prompt: '' })` if tokens already exist
   (silent re-auth), else `prompt: 'consent'`.
5. Resolve `GdriveTokens`; reject `GdriveError` with appropriate `code`.

### `disconnect()`
1. `clearTokens()`.
2. Fire-and-forget `POST https://oauth2.googleapis.com/revoke?token=...`.
   Failures are silent.
3. Resolve immediately.

### `getAccessToken()` (internal seam)
1. `loadTokens()`. If `null` → reject `'auth_expired'`.
2. If `expiresAt - Date.now() < 60_000`:
   - Call `google.accounts.oauth2.refresh(...)` if available (wrapped
     in feature check — some GIS versions don't expose it).
   - On failure, `clearTokens()` + reject `'auth_expired'`.
3. Otherwise return `accessToken`.

This is the only function that touches `google.accounts.oauth2`. Every
Drive call goes through it. Mocking `getAccessToken` makes
`saveBackup` / `listBackups` / `fetchBackupText` testable as pure
fetch-with-Authorization-header units.

## 8. Drive API contracts

### `saveBackup(state)`
1. `const token = await getAccessToken()` — throws `'auth_expired'`
   if no tokens.
2. `findOrCreateFolder(token, 'Finora backups')`.
3. `const today = exportFilename()` (reuse `lib/exportImport.ts`).
4. `listBackups()` → pick file whose `name === today`. If found
   `PATCH /files/{id}`, else `POST /files`.
5. Body = `serializeExport(state)`. Content type `application/json`.
   `appProperties.finoraVersion = '1'`.
6. Return `{ fileId, modifiedTime }`.

**Folder bootstrap:**
- Search: `name = 'Finora backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`.
- Create: `{ name: 'Finora backups', mimeType: 'application/vnd.google-apps.folder' }`.
- Created once per account; an existing folder from an older install
  is reused.

### `listBackups()`
```
GET /files
  ?q=name contains 'finora-backup' and trashed = false
  &orderBy=modifiedTime desc
  &pageSize=20
  &fields=files(id,name,modifiedTime)
Authorization: Bearer <token>
```
Returns `BackupFile[]`, newest-first. `[]` when none.

### `fetchBackupText(fileId)`
```
GET /files/{fileId}?alt=media
Authorization: Bearer <token>
```
Returns the **raw response text**. Caller pipes through `parseImport()`.
Errors:
- 401 → `'auth_expired'`
- 403 → `'forbidden'`
- 404 → `'not_found'`
- network throw → `'network'`

## 9. Test strategy

**Runner:** vitest + happy-dom. No new global setup. Spec at
`src/lib/googleDrive.spec.ts`. Coverage ≥ 95% lines on
`googleDrive.ts` and `googleDrive.script.ts` per GD-1.6.

**Mock seams:**

| Seam                              | How                                  |
| --------------------------------- | ------------------------------------ |
| `globalThis.google.accounts.oauth2` | `__mocks__/gis.ts` (manual mock)    |
| `fetch`                           | `vi.spyOn(globalThis, 'fetch')`      |
| `localStorage`                    | happy-dom (default)                  |
| `import.meta.env`                 | `vi.stubEnv`                        |
| `<script>` injection              | `vi.spyOn(document, 'createElement')` |

**Test cases:**

- Token storage round-trip + null + malformed JSON
- `isGisReady` returns `false` initially
- `loadGisScript()` injects exactly one `<script>` at
  `https://accounts.google.com/gsi/client` with `async`
- After `onload`, `isGisReady` is `true`; subscribers fire
- `loadGisScript` timeout (>10s without `onload`) fires
  `onGisLoadError` with `'script_load_failed'`
- `connect()` happy path — tokens saved, email populated
- `connect()` cancel → `'popup_closed'`
- `connect()` deny → `'access_denied'`
- `disconnect()` clears tokens + fires one revoke fetch
- `saveBackup` no tokens → `'auth_expired'`
- `saveBackup` happy (folder missing): exactly 3 fetches in order
- `saveBackup` happy (folder + today's file): exactly 2 fetches;
  the file one is `PATCH /files/{id}`
- `saveBackup` refreshes token when `expiresAt - now < 60s`
- `listBackups` parses response shape
- `fetchBackupText` 404 → `'not_found'`
- `fetchBackupText` 401 → `'auth_expired'` + tokens cleared
- Round-trip: save → list → fetch returns original JSON envelope

**Out of scope:**

- Real network fetch of `accounts.google.com` (faked)
- Drive-side authorization rules
- Real clock drift with the 60s refresh buffer (tested with
  `expiresAt = now + 30_000` and `now + 120_000`)

## 10. Open architectural questions

- **Expose `prefetchGis()`?** No — `loadGisScript` is idempotent.
- **`saveBackup` accepts `State` or pre-serialised envelope?** `State`.
  One-line serialisation; keeps the API ergonomic.
- **`disconnect()` async?** Yes — leaves room for future multi-session
  revoke without an API break.

## 11. Acceptance

This design unblocks GD-1.1 → GD-1.6. Dev agent can implement against
the signatures in §3 + the error taxonomy in §4 without further
architectural input.
