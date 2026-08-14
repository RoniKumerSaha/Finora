---
status: final
name: Finora — About panel on the right side of Settings
date: 2026-08-14
sources:
  - ../ux-finora-2026-08-13/DESIGN.md
  - ../ux-finora-2026-08-13/EXPERIENCE.md
  - screenshots/SettingsScreen-empty-right.png
  - src/screens/SettingsScreen.tsx
  - src/components/Shell.tsx
  - package.json
updated: 2026-08-14
---

# Finora — About panel on the right side of Settings

A peer contract to the existing V2 Soft design system. **No new
visual tokens, colors, type roles, radii, or component primitives.**
The only changes are (a) the Settings screen grows a right column
holding an `About` card, and (b) the About card reuses the `.card`,
`.chip`, and existing link primitives.

> Spine rule. On any conflict between this run and the parent run,
> the parent wins. This file is an additive panel, not a redesign.

## Foundation

- **Form factor**: web-desktop (inherits from parent).
- **UI system**: Tailwind v4 + CSS custom properties (inherits from
  parent).
- **Visual identity**: `../ux-finora-2026-08-13/DESIGN.md` is the
  source of truth. No new tokens introduced.
- **Privacy stance**: local-only (inherits from parent).
- **Audience**: the single user, looking at their own data.

This run does not produce a `DESIGN.md`. The parent run's DESIGN.md
is the only one that owns tokens.

## Information Architecture

### The split

The Settings screen becomes a two-column layout on desktop:

| Column | Width | Content |
|---|---|---|
| Left | `1fr` | Existing `Theme`, `Backup`, `Demo data`, `Danger zone` stack. |
| Right | `320px` | New `About` card. |

The page-level container grows from `max-w-[640px]` to
`max-w-[1100px]` so the two columns have room to breathe. On
narrow viewports (<768px) the right column falls *below* the
existing sections as a single-column stack — no content is hidden.

### Surface inventory

| # | Surface | Route | Changed by this run? |
|---|---|---|---|
| 1 | Settings page | `/settings` | **Yes — gains two-column layout + About card** |
| 2 | About card | (inline on Settings) | **New** |

## Voice and Tone

The About card matches the parent run's voice: **warm, factual,
un-marketing.** No adjectives. No emoji. No "🎉 v1.0.0".

- Product name: `Finora` (Fraunces, h3-modal weight).
- Blurb: "A Bangladesh-first personal finance notebook. Local-only,
  single user, one currency (BDT ৳)."
- Privacy line: "All data lives in your browser. No accounts, no
  cloud, no telemetry." Two clauses, no softer verbiage.
- Storage line: "Storage: localStorage · N entries." Sub-counts are
  inside the entry count.
- Version chip: `v1.0.0` — monospace-free, label `Version` on the
  left, value on the right.

## Component Patterns

### About card

The About card is a single `.card` primitive at the top of the right
column. Internal layout: a small "About" eyebrow label at the top
(same style as the `h2-section` eyebrow on Home/Insights cards),
followed by the content stack.

| # | Element | Type | Visual treatment |
|---|---|---|---|
| 1 | Eyebrow | `About` | `text-[11px] text-muted uppercase tracking-[0.08em] font-semibold` |
| 2 | Product name | `Finora` | h3-modal (Fraunces, 18px). One row, no extra spacing. |
| 3 | Blurb | One sentence | body role, `text-muted` |
| 4 | Meta rows | `Version` · `Privacy` · `Storage` | Two-column inside the card: label-left, value-right. `caption` role. |
| 5 | Links | `Reset →` | text-primary link, `text-[12.5px] font-semibold`, sits in its own row separated by 16px from the meta block. |

### Version source

`package.json` is the source of truth for the version string. The
component reads it from `import.meta.env.VITE_APP_VERSION` with a
hard-coded fallback to `'1.0.0'`. The fallback is the literal string
from the `package.json` `version` field, never `package.version`
at runtime (would require bundler config). If the env var is unset,
the chip shows `v1.0.0` — never `vundefined` or `v?`.

A future enhancement — short commit SHA for pre-release builds —
is intentionally **out of scope** for this run. The current
implementation does not attempt to render a build SHA.

### Storage count

The `Storage` row reads from the same store the rest of the app
reads from. The value is the sum of `accounts.length +
transactions.length + goals.length + debts.length +
investments.length`. Singular/plural: "1 entry" / "N entries".
If all five are zero, render "Storage: localStorage · empty".

The unit prefix is fixed. We do not attempt to render an exact
byte estimate — `localStorage` is bounded (`~5MB` in most browsers)
and the per-entry overhead is small. The user-facing signal is
"how much stuff is in here," not "how close am I to the limit."

### Links

- **"Reset →"** wires to the existing `Wipe all data` confirm
  dialog via the same `onWipe` handler the Danger-zone button uses.
  This is the non-button path to reset. Same confirmation,
  same banner, same behavior. Visual treatment uses the existing
  link style: `text-primary text-[12.5px] font-semibold
  hover:underline underline-offset-2`.

- **"Help & shortcuts →"** and **"What's new →"** are **not
  rendered** in this run. There is no `/help` or `/changelog`
  surface in V1. Rendering a dead link is a worse affordance than
  omitting it. When those surfaces exist, the links can return.
  Logged as `[NOTE for UX]` in the memlog.

This means the visible link list in V1 has exactly one entry:
**"Reset →"**. The D2 plan included three links, but two have been
culled because they would be dead affordances. The user's preview
selection showed three, but the spine refines the intent: ship
honest links, not link-shaped text.

## State Patterns

### Cold start (zero data)

The `Storage` row renders `localStorage · empty`. The Version,
Privacy, and Reset rows render normally. No collapse, no
"this app doesn't work without data" copy.

### Populated state

The expected steady state. All meta rows populated. `Reset →`
visible. No additional states (no loading, no error — the About
card is read-only and renders from the same store synchronously).

## Interaction Primitives

### Reset flow

Clicking "Reset →" opens the existing wipe confirm dialog:

- Title: "Wipe all data?"
- Body: "Every account, transaction, goal, debt, and investment
  will be deleted. This cannot be undone."
- Confirm: `Wipe everything` (danger variant).
- On confirm: `useStore.update(...)` clears the slices.
- Banner: "All data wiped" success.

Identical behavior to the Danger-zone `Wipe all data` button. The
About-card link is the same affordance behind a different visual
weight, not a different action.

### Click targets

The About card has exactly two interactive elements in V1:

- The visible `Reset →` link (wires to the wipe confirm).
- Future `[NOTE for UX]` affordances may add — see memlog.

The Version, Privacy, Storage, and product-name rows are **not
interactive**. They are static text. Future versions may turn the
Version row into a clipboard-copy affordance; that is explicitly
out of scope here.

## Accessibility Floor

- The `About` card has no `role` override; it is a `section` with an
  h2-style eyebrow that screen readers announce.
- The `Reset →` link is an `<a>` element rendered as text. Keyboard
  focus reaches it via Tab. Focus ring is the global
  `focus-visible:ring-2 focus-visible:ring-primary/40` contract.
- The product name is rendered in Fraunces at `h3-modal` weight;
  the serif is decorative — the eyebrow `About` and the text content
  carry the meaning for assistive tech.
- The `Storage` row announces the full count to screen readers
  (e.g. "Storage: localStorage. 47 entries."), not the bare number.

## Key Flows

### Flow 1 — "I want to know what version I'm on"

**Protagonist**: Rahim, 31, freelancer. He's hitting an odd behavior
and wants to report it.

1. Rahim clicks `Settings` in the sidebar.
2. The Settings screen renders in two columns. His eye lands first
   on the existing sections (Theme, Backup, Demo data, Danger zone).
3. He scrolls minimally. The right column shows `About`.
4. He reads `Finora` and the one-line blurb. He glances at
   `Version  v1.0.0` and the privacy line.
5. **Climax beat**: He copies `v1.0.0` into his bug report. He
   doesn't need the rest of the card.

### Flow 2 — "I want to wipe everything but I'm skimming"

**Protagonist**: Sumaiya, 26, designer. She's selling the laptop and
needs to wipe Finora.

1. Sumaiya opens Settings. She does **not** want to engage with the
   Danger zone directly — the red button feels heavy.
2. She scans the right column. She spots `Reset →` in the About card.
   It reads as a quieter affordance.
3. **Climax beat**: She clicks `Reset →`. The same confirm dialog
   opens. She confirms. The wipe banner appears. Done.

The Danger-zone button still exists for users who scan top-to-bottom
and look for `Wipe all data` literally. The `Reset →` link is a
skimmer's path — both end at the same dialog.

### Flow 3 — "What's in here?"

**Protagonist**: Karim, first session.

1. Karim opens Settings. The right column shows
   `Storage  localStorage · empty`.
2. He understands the app has no data yet. No surprise.
3. He clicks `Load demo data` in the left column.

### Out of scope (deliberate)

- Per-entry storage sizes.
- "Copy version to clipboard" button.
- A live-update feed ("recently added accounts").
- "What's new" release notes surface.
- `/help` shortcut reference page.
- Commit SHA build chip.
- Analytics events when the About card mounts (Finora has no
  analytics, by design).

## Acceptance criteria

A run is complete when all of the following are true:

1. The Settings screen renders in two columns on viewports ≥768px.
2. The right column hosts a single `.card` titled `About`.
3. The About card shows: product name (Fraunces), one-line blurb,
   Version row, Privacy row, Storage row, and a `Reset →` text
   link.
4. The Version value matches `package.json`'s `version` field at
   the time of the build (`v1.0.0`), or the env override
   `VITE_APP_VERSION` if set at build time.
5. The Storage row shows `localStorage · N entries`, where N is
   the sum across `accounts / transactions / goals / debts /
   investments`. Singular/plural is correct.
6. Clicking `Reset →` opens the existing wipe confirm dialog and
   behaves identically to the Danger-zone `Wipe all data` button.
7. No new tokens, colors, type roles, radii, or component
   primitives are introduced. The card and chip primitives are
   reused.
8. On viewports <768px, the layout collapses to a single column
   with the About card rendered *after* Danger zone.
9. The build is clean and the test suite still passes (93 tests
   unaffected — no new tests required; an optional unit test for
   the singular/plural helper is welcome but not blocking).
10. No dead affordances. Only the `Reset →` link is rendered in
    V1; future surfaces (`/help`, `/changelog`) bring their own
    links in their own runs.
