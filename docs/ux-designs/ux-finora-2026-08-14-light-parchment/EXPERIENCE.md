---
status: final
name: Finora — Light mode parchment palette
date: 2026-08-14
sources:
  - ../ux-finora-2026-08-13/DESIGN.md (updated by this run)
  - ../ux-finora-2026-08-13/EXPERIENCE.md
  - screenshots/light-mode-too-bright.png
  - ../../../../docs/ux-designs/ux-finora-2026-08-14-light-parchment/.working/mockup-a.html (chosen)
  - src/styles/theme.css
updated: 2026-08-14
---

# Finora — Light mode parchment palette

An **Update** run to the parent DESIGN.md. **No new visual
identity tokens, no new typography roles, no new component
primitives.** The only changes are inside `[data-theme="light"]`
in `src/styles/theme.css`:

| Token | Before | After | Notes |
|---|---|---|---|
| `--bg` | `#F7F4EC` | `#EFE5D0` | Warm parchment cream (was pale cream) |
| `--surface` | `#FFFFFF` | `#F8F2E3` | Soft cream, lighter than bg |
| `--surface-2` | `#F0EBDF` | `#F0E5CC` | Warm cream in lockstep with new bg |
| `--surface-3` | `#E5DECB` | `#E0D4B6` | Deepest cream |
| `--border` | `#E5DECB` | `#D8C9A6` | Deeper for soft-cream cards |
| `--border-2` | `#D8CFB8` | `#C8B98F` | Deeper |
| `--card-inset` (light) | `rgba(255,255,255,0.5)` | `rgba(255,255,255,0.35)` | Less white-on-cream punch |

Ink / muted / brand colors / dark-mode tokens — **unchanged**.

> Spine rule. This run is a palette rebalance, not a redesign.
> On any conflict with the parent DESIGN.md or any prior run,
> parent wins.

## Foundation

- **Form factor**: web-desktop (inherits from parent).
- **UI system**: Tailwind v4 + CSS custom properties (inherits
  from parent).
- **Visual identity**: the parent `../ux-finora-2026-08-13/DESIGN.md`
  is the source of truth. This run **modifies** the colors block
  of the YAML frontmatter and the Surfaces & ink body table.

## Information Architecture

### What changed

The light-mode half of the app. Every other surface — dark mode,
typography, components, spacing, elevation — is unchanged.

### What stayed the same

| | |
|---|---|
| Dark mode tokens | All values for `[data-theme="dark"]` |
| Ink color (`#2A2620` light) | Unchanged — readable against all new surfaces |
| Muted color (`#7A6F5E` light) | Unchanged — contrast ratio against new card surface (~4.6:1) stays above WCAG AA threshold |
| Primary teal (`#0D8275`) | Unchanged |
| Accent gold (`#A47E2C`) | Unchanged |
| Danger, warn, success | All unchanged — semantic palette is brand-stable |
| Component primitives | All unchanged — `.card`, `.chip`, etc. all re-resolve via the new tokens |
| Spacing, radii, elevation, typography | All unchanged |

## Voice and Tone

No voice or copy changes. This run does not introduce user-facing
strings.

## Component Patterns

### Card surface (light)

The `.card` primitive in light mode now resolves to:

- Background: `var(--surface)` = `#F8F2E3` (soft cream, lighter
  than the new bg).
- Border: `1px solid var(--border)` = `#D8C9A6` (deeper tan).
- Top inset highlight: `inset 0 1px 0 rgba(255, 255, 255, 0.35)`
  (softer than the old `0.5`).
- Shadow: `var(--shadow-card)` — unchanged dark-based shadow
  applied at a lower opacity so it blends with the warm cream.

The card-on-bg contrast is now ~4% (down from ~3.4% but in a
warmer register). Hierarchy is carried by the deeper border +
shadow, not by surface contrast.

### Input surface (light)

`bg-surface-2` (`#F0E5CC`) is the recessed input surface. The
new value is one shade deeper than the old `#F0EBDF` to maintain
the same "recessed" feel against the new softer cards.

## State Patterns

No new states. All existing card / input / button states resolve
transparently through the token updates.

### Theme toggle behavior unchanged

Settings → Theme picker still offers `dark / light / auto`. The
`auto` mode still listens to `prefers-color-scheme`. The user's
choice is persisted via `state.settings.theme`. All three modes
flip the `[data-theme]` attribute on `<html>`, which causes the
updated `[data-theme="light"]` block in `theme.css` to apply.

## Interaction Primitives

No new interaction primitives. All existing affordances
(buttons, links, chips, pills, cards, tabs, toggles) inherit the
new palette automatically through the token update.

## Accessibility Floor

| Concern | Status |
|---|---|
| WCAG AA body-text contrast (ink `#2A2620` on bg `#EFE5D0`) | ~11.5:1. ✓ |
| WCAG AA muted-text contrast (muted `#7A6F5E` on card `#F8F2E3`) | ~4.6:1. ✓ |
| WCAG AA on primary surfaces (white text on `#0D8275`) | ~5.4:1. ✓ |
| Card-edge readability | Border `#D8C9A6` against card `#F8F2E3` contrast ~1.4:1 — same as before. The card "exists" through border + shadow as much as color contrast. |
| Color-blind users | Money-direction sign + color encoding unchanged; no impact. |

Focus rings, hover states, success / danger / warn callouts —
all unchanged.

## Key Flows

### Flow 1 — "I just toggled to light mode"

**Protagonist**: Karim, first session. He prefers light theme.

1. Karim opens Settings → Theme → `light`.
2. The page re-renders. The bg shifts from deep forest to warm
   parchment cream (`#EFE5D0`). Cards shift from pure white to
   soft cream (`#F8F2E3`). The sidebar shifts to match the new
   bg.
3. **Climax beat**: His eye stops bouncing off the pure-white
   cards. The whole app reads as one continuous warm paper surface.
   Borders carry the hierarchy.

### Flow 2 — "Can I read it after sunset?"

**Protagonist**: Sumaiya, late-evening session. She's on a phone
in low light. She flipped to `auto` mode earlier in the day.

1. The OS toggles dark mode at sunset. The app flips to
   `[data-theme="dark"]`. The light-parchment tokens are no
   longer in effect.
2. **Climax beat**: Dark forest returns. The light-mode change is
   fully reversible — no tokens "leak" between themes.

### Out of scope (deliberate)

- A "dark-mode" version of the parchment palette (the dark mode
  is its own forest / teal register and stays).
- A printer-friendly / sepia variant.
- High-contrast accessibility variant (would require new tokens).
- Per-system palette overrides (macOS Mojave's "increase contrast"
  etc. — those are OS-level, not app-level).

## Acceptance criteria

A run is complete when all of the following are true:

1. `[data-theme="light"]` in `src/styles/theme.css` reflects the
   seven token updates listed above.
2. The home dashboard in light mode shows:
   - Bg `#EFE5D0` (warm parchment cream)
   - Cards `#F8F2E3` (soft cream, lighter than bg)
   - 4% or less surface contrast between bg and card
   - Borders `#D8C9A6` (deeper tan)
3. Dark mode is byte-identical to before this run. No regressions.
4. All buttons, links, chips, pills, cards, inputs render through
   the new tokens without per-component overrides.
5. WCAG AA contrast checks pass for body text, muted text, and
   primary-on-color text.
6. The build is clean and the test suite still passes (93 tests).
7. The parent `DESIGN.md` YAML frontmatter `colors` block and
   the Surfaces & ink body table reflect the new values, with
   inline comments dated `2026-08-14 light-parchment`.
