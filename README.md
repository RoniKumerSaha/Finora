# Finora V1

Bangladesh-first personal finance / bookkeeping web app. Local-first,
single-user. **Cloud sync is opt-in** — see [Cloud sync](#cloud-sync) below.

## Quick start

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # 28 tests
npm run build    # static output in dist/
```

The dev server picks the next free port if 5173 is busy.

## Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind v4** consuming the V2 Soft theme tokens (dark / light / auto)
- **Zustand** for state, with localStorage single-blob persistence on key `finora:v1`
- **React Router v7** in hash mode so the build also works as `file://`
- **react-hook-form** + **zod** for forms + three-part error formatting
- **Vitest** + **@testing-library/react** + **happy-dom** for tests

## Architecture

The spine lives at `docs/architecture/2026-08-13-arch-v1/ARCHITECTURE-SPINE.md`.
Current build order is recorded in `.memlog.md` — **AD-14..20** for the React rebuild.

```
src/
  domain/         # pure modules + tests (math, accounts, transactions, etc.)
                   # + Zustand store
  components/     # Shell, Button, Field, RoleAlertBanner, ConfirmDialog
  screens/        # HomeScreen + list screens + form screens (one per route)
  lib/            # schemas (zod), errors (three-part formatter), exportImport, demoSeed
  styles/         # theme.css (tokens) + app.css (small overrides)
  main.tsx        # entry
  App.tsx         # router + theme + banner
```

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
(client `stateUpdatedAt` with server `updated_at` as the tiebreaker). The
cloud copy is purely a copy — signing out or deleting it never deletes
local data, and wiping local data never deletes the cloud copy.

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
- ✅ Last-write-wins reconciliation across devices, with server clock
  tiebreaker for the rare same-millisecond case.
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