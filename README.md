# Finora V1

Bangladesh-first personal finance / bookkeeping web app. Local-first,
single-user. **Cloud sync is opt-in** — see [Cloud sync](#cloud-sync) below.

## Quick start

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # 391 tests across 33 files
npm run build    # static output in dist/
```

The dev server picks the next free port if 5173 is busy.

## Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind v4** consuming the V2 Soft theme tokens (dark / light / auto)
- **Zustand** for state, with IndexedDB single-blob persistence (database `finora`)
- **Dexie** wrapping IndexedDB for the state blob + the cloud-sync auxiliary rows
- **React Router v7** in hash mode so the build also works as `file://`
- **react-hook-form** + **zod** for forms + three-part error formatting
- **Vitest** + **@testing-library/react** + **happy-dom** + **fake-indexeddb** for tests
- **Supabase JS** for the optional cloud-sync backend (see below)

## Architecture

The historical (pre-React) architecture spine lives at
`docs/architecture/2026-08-13-arch-v1/ARCHITECTURE-SPINE.md` and is preserved
for reference. The current React-era layout is:

```
src/
  domain/         # pure modules + tests (math, accounts, transactions, debts,
                   # investments, goals, plans, recompute, persistence, sync)
                   # + Zustand store
  components/     # Shell, Button, Field, Dialog, Picker, SyncStatusPill, …
  screens/        # HomeScreen + list screens + form screens (one per route)
  security/       # PIN lock, lockStore, ChangePinDialog, SecuritySection
  lib/            # schemas (zod), errors (three-part formatter), exportImport,
                   # supabase client, demoSeed
  test/           # sync-helpers, idb-helpers, boot.spec
  styles/         # theme.css (tokens) + app.css (small overrides)
  main.tsx        # entry — awaits ensureReady() + syncEngine.init() before mount
  App.tsx         # router + theme + banner + recovery listener
```

Detailed product behaviour lives in `PRD.md`. The full wipe / sign-out / sign-in
contract is documented in `PRD.md §9.19.9` (Local ↔ cloud destruction independence).

## Deploy

The build output is `dist/` — a static folder. Three deploy options:

### Option A — Netlify (drag-and-drop)

1. `npm run build`
2. Open https://app.netlify.com/drop
3. Drag the `dist/` folder → live URL.

`netlify.toml` is included for Git-based deploys and CLI flows.

### Option B — GitHub Pages

The workflow at `.github/workflows/deploy.yml` runs on every push to `master` and
publishes `dist/` to GitHub Pages. To enable: **Settings → Pages → Source: GitHub Actions**.

### Option C — Vercel

1. `vercel` (or import the repo on https://vercel.com)
2. Build command: `npm run build`
3. Output directory: `dist`

Since the router is hash-mode, no SPA fallback rewrite is required, but the
included rewrite doesn't hurt.

## Data ownership

All data lives in your browser's **IndexedDB** under the database `finora`,
in a single-blob row keyed `state`. IndexedDB is more durable than
`localStorage` (much larger quota, less prone to eviction) but is still
cleared by "Clear site data", browser uninstall, or profile reset — so
back up regularly. To back up or move devices, use **Settings → Backup →
Export backup**. To restore, drop the resulting JSON file into **Settings →
Backup → Import backup**.

Users upgrading from a pre-2026-09-02 build will have their existing
`localStorage['finora:v1']` data automatically migrated into IndexedDB on
first load; the legacy key is then removed.

## Cloud sync

Cloud sync is **opt-in**. When signed in, Finora pushes the whole local
state blob to Supabase and reconciles on every boot using last-write-wins
(client `stateUpdatedAt` with server `updated_at` as the tiebreaker).
The cloud copy is treated as a backup-of-record for the user's *other*
devices, so the local ↔ cloud destruction contract is deliberate:

- **Signing out** wipes the local store but preserves the cloud copy.
  The user has effectively said "this device no longer belongs to that
  account." On re-sign-in the wiped local has `stateUpdatedAt = 0`, and
  `pickWinner` adopts the cloud row via LWW so the user sees their
  latest snapshot without any export/import dance.
- **Settings → Danger zone "Delete everything" while signed in**
  deletes both local AND cloud (cloud first, with confirmation copy
  spelling that out). The user stays signed in locally — sync
  identity is preserved so the next push (if any) starts from a
  known-empty state.
- **Settings → Danger zone "Delete everything" while signed out**
  deletes only local. The cloud copy (under the previous userId) is
  untouched, so signing back in still pulls it.
- **`Delete cloud copy` (Settings → Danger zone)** deletes only the
  cloud row. Local stays.

The point is that the cloud is a copy of the user's *other* devices.
We never want a local action to silently destroy what another device
owns — but we also never want a stale cloud row to clobber a fresh
local view. The exact reconciliation is in
`PRD.md §9.19.5` and the four wipe flows are in `PRD.md §9.19.9`.

### Enabling cloud sync (development / self-hosting)

1. Start a local Supabase stack (or point at a hosted project):
   ```bash
   supabase start
   ```
2. Apply the migration so the `finora_state` table exists:
   ```bash
   supabase db reset   # or: supabase migration up
   ```
3. Copy `.env.local.example` (if present) → `.env.local`, or set:
   - `BASE_URL` — e.g. `http://127.0.0.1:54321` for the local stack, or
     `https://<project-ref>.supabase.co` for a hosted project.
   - `BASE_ANON_KEY` — the project's anon JWT key (Project Settings → API).
     **Must** be the JWT-format key (starts with `eyJ…`), not the new
     `sb_publishable_…` format — GoTrue rejects publishable keys as
     bearer tokens with `bad_jwt: missing sub claim`, which surfaces as
     sync failures in the UI.
4. `npm run dev` and open Settings → Account → Sign in.

If either variable is missing or empty at build time, the build ships
without cloud sync — the Settings → Cloud sync panel surfaces a muted
"Cloud sync is disabled in this build" message instead of throwing.

### Enabling cloud sync (production deploys)

`BASE_URL` and `BASE_ANON_KEY` are **build-time** env vars (passed
through Vite's `define` block, not `VITE_`-prefixed). For each deploy
target:

- **Netlify**: Site → Site configuration → Environment variables → add
  `BASE_URL` and `BASE_ANON_KEY` → trigger a redeploy.
- **Vercel**: Project → Settings → Environment Variables → add to
  "Production" → redeploy.
- **GitHub Pages**: the included `.github/workflows/deploy.yml` runs
  `npm run build` without secrets — for sync-enabled Pages you'll need
  to add `BASE_URL` and `BASE_ANON_KEY` as repo/org GitHub Actions
  secrets and expose them in the workflow, or build the bundle locally
  and push `dist/` directly.

After deploying with these vars set, the Settings → Cloud sync panel
stops showing "Cloud sync is disabled in this build" and you can sign in
with your email to seed the cloud row.

### What cloud sync does and doesn't do

- ✅ One row per user, scoped by Supabase RLS (`auth.uid() = user_id`).
- ✅ Email + password sign-in (and sign-up). One dialog with a "Sign in" /
  "Create account" toggle, no magic-link round-trip.
- ✅ Password recovery via Supabase email link — auto-detected on return
  (`#access_token=...&type=recovery`), opens a "Set a new password" dialog.
- ✅ In-app "Change password" for signed-in users (Settings → Cloud sync).
  Skips the email round-trip entirely — calls `auth.updateUser({ password })`
  on the active session.
- ✅ Cross-tab recovery — opening the email link in a new tab auto-opens
  the dialog there; other tabs stay on the signed-in view and reload
  automatically once the password is updated.
- ✅ Last-write-wins reconciliation across devices, with server clock
  tiebreaker for the rare same-millisecond case.
- ✅ Sign-out wipes the local store but preserves the cloud copy. Signing
  back in pulls the latest snapshot from the cloud automatically — no
  manual export/restore dance.
- ✅ Offline-tolerant: edits queue in IndexedDB and flush on reconnect,
  coalescing into a single push.
- ✅ Works with the PIN lock — locked devices don't push.
- ❌ No real-time subscriptions. Cross-device edits are eventual.
- ❌ No client-side encryption. Data sits in the cloud row as JSONB
  gated only by RLS — fine against another user reading your row, **not**
  a compromise of the Supabase project itself.
- ❌ No per-field conflict resolution. Concurrent edits on two devices
  resolve "last write wins" — one of them wins in full.

## Vanilla v1 (archived)

The original vanilla HTML+CSS+JS prototype that pre-dated the React rebuild
is preserved at `archive/vanilla-v1/`. The data layer (math + entities +
persistence) is mostly identical; the React app is a fresh UI on top. See
`archive/vanilla-v1/README.md` for the recovery story.