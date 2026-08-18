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

### Environment variables

Configure before building. See `.env.example` for the full template.

| Variable                   | Default   | Description                                                                                                              |
|----------------------------|-----------|--------------------------------------------------------------------------------------------------------------------------|
| `VITE_FEATURE_GDRIVE_SYNC` | `false`   | Feature flag. Set to `true` to render the Cloud backup card inside Settings → Backup.                                    |
| `VITE_GOOGLE_CLIENT_ID`    | *(empty)* | OAuth 2.0 client id from Google Cloud Console. Required when the flag is on. Uses the GIS Token Model with `drive.file` scope. |
| `VITE_APP_VERSION`         | `1.0.0`   | Release version echoed in Settings → About. CI replaces this at build time.                                              |

### Setting up Google Drive sync

1. In Google Cloud Console, create an OAuth 2.0 **Web application** client.
2. Add your deploy origin (e.g. `https://finora.example.com`) to **Authorized JavaScript origins**.
3. Enable the **Google Drive API** for the project.
4. Copy the client id into `VITE_GOOGLE_CLIENT_ID`.
5. Build & deploy: `VITE_FEATURE_GDRIVE_SYNC=true VITE_GOOGLE_CLIENT_ID=... npm run build`.

> **Cloud backup requires an http(s) origin.** Opening `dist/index.html`
> from a `file://` URL hides the Cloud section because the GIS OAuth
> popup cannot complete. Host the build on the web to enable it.

## Data ownership

All data lives in your browser's `localStorage` under the key `finora:v1`. To
back up or move devices, use **Settings → Backup → Export backup**. To
restore, drop the resulting JSON file into **Settings → Backup → Import backup**.

## Vanilla v1 (archived)

The original vanilla HTML+CSS+JS prototype that pre-dated the React rebuild
is preserved at `archive/vanilla-v1/`. The data layer (math + entities +
persistence) is mostly identical; the React app is a fresh UI on top. See
`archive/vanilla-v1/README.md` for the recovery story.