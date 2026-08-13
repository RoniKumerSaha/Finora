# Vanilla V1 (archived 2026-08-13)

This directory holds the work done under the **vanilla** paradigm (AD-1 through AD-13 of `docs/architecture/2026-08-13-arch-v1/`), before the user chose to rebuild the prototype in React. See `ARCHITECTURE-SPINE.md` §1 and `.memlog.md` AD-14.

## What's here

```
src/      ← original ES-module data + math + render layer (plain JS)
tests/    ← 134 Vitest tests (math + data layer + recompute)
tools/    ← merge-theme.js, sync-js.js (artifact build helpers)
```

## Why it's archived, not deleted

1. **Tests still pass.** `math.js`, the data layer (`accounts.js`, `transactions.js`, `goals.js`, `debts.js`, `investments.js`), `ids.js`, `persistence.js`, and `recompute.js` are pure ES modules with no DOM access. They port almost line-for-line into `src/domain/` of the React build.
2. **The math is authoritative.** The R1–R10 rules, the rollover semantics, the auto-completion of debts — all of those should be carried verbatim. This is the most-load-bearing artifact.
3. **The mockups at `docs/ux-designs/.../mockups/v2/` are still the visual reference.** They survived the reversal — React components will be built to match those screens.

## What changed in AD-14

| Old path | New path |
|---|---|
| `src/js/math.js` | `src/domain/math.ts` (port, add JSDoc types → TS) |
| `src/js/{accounts,transactions,goals,debts,investments}.js` | `src/domain/{accounts,transactions,goals,debts,investments}.ts` |
| `src/js/{ids,persistence,recompute}.js` | `src/domain/{ids,persistence,recompute}.ts` |
| `src/js/{validate,confirm}.js` | `src/lib/{validate,confirm}.ts` (or wrapped per AD-19) |
| `src/js/app.js` | deleted — Zustand store + React shell replace it |
| `tools/merge-theme.js` | deleted — Tailwind config replaces it (AD-17) |
| `tools/sync-js.js` | deleted — Vite handles bundling |
| `tests/math.spec.js`, `tests/data.spec.js` | `src/domain/__tests__/*.spec.ts` — unchanged |
| `mockups/v2/{index,dark,light}.html` (the live `index.html` with `[data-bind]`) | superseded by the React app; the `mockups/v2/` design files are still the visual source of truth |

## Recovering a module

To pull a specific module back into the React build:

```bash
# from project root
cp archive/vanilla-v1/src/js/math.js src/domain/math.ts    # then convert
```

Don't run `tools/merge-theme.js` or `tools/sync-js.js` from this directory — they're for the old build flow.
