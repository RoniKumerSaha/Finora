# Finora V1

Bangladesh-first personal finance / bookkeeping web app. Local-first, single-user, no backend.

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

## Vanilla v1 (archived)

The original vanilla HTML+CSS+JS prototype that pre-dated the React rebuild
is preserved at `archive/vanilla-v1/`. The data layer (math + entities +
persistence) is mostly identical; the React app is a fresh UI on top. See
`archive/vanilla-v1/README.md` for the recovery story.