# Mockups — implementation notes

These HTML mockups are **design intent renderings**, not production components. They show layout, color, copy, and behavior shape. The production build (shadcn/ui + Tailwind + Recharts) must apply the **accessibility exemplar patterns** from `plan-editor-a11y.html` to every mockup below.

## Files

| File | Purpose | Status |
|---|---|---|
| `dashboard.html` | Dashboard hero screen — Net Worth, Financial Health, position tiles, current month, plan, goals, spending, insights, mobile preview | Initial mockup |
| `plan-editor.html` | Plan editor with sliders, summary, **over-allocation error state**, underfunded state | Initial mockup |
| `plan-editor-a11y.html` | **Accessibility exemplar** of plan-editor — semantic HTML, real `<input type="range">`, `role="alert"`, `aria-current="page"`, `prefers-reduced-motion`, skip link, focus-visible | Pattern reference for production |
| `goal-detail.html` | Goal detail with calculation breakdown (`38,000 ÷ 12`), 4 state pills | Initial mockup |
| `quick-add-expense.html` | Mobile quick-add — 3-tap save flow with confirmation | Initial mockup |

## What `plan-editor-a11y.html` fixes (apply to all)

These are the **hard requirements** the reviewer lenses flagged as Critical. The exemplar demonstrates the correct pattern; production components in `bmad-build` must replicate them.

### Semantic HTML

- **Sidebar** → `<nav aria-label="Primary">` containing `<a href="…">` (not `<div>`s).
- **Active nav link** → `aria-current="page"`.
- **Slider** → `<input type="range" aria-label="…" min max step value>` styled to match. Never a styled `<div>`.
- **Numeric input** → `<input type="number" inputmode="numeric">` with the `BDT` prefix in a separate visually-adjacent `<span aria-hidden="true">` (so screen readers don't read "BDT" as part of the value).
- **Error banner** → `<div role="alert" aria-live="assertive" id="…">` referenced from any invalid input via `aria-describedby`.
- **Progress bars** → `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- **Stacked allocation bar** → `role="img"` with a single descriptive `aria-label` and visually-hidden `<span>` text per segment.
- **Forms** → `<label for="id">` paired with `<input id="id">`. Required fields → `aria-required="true"`.

### Color

- **Tokens corrected:** `--good` text changed from `#15803d` to `#166534` (passes AA on `good-soft`). `--warn` text changed from `#b45309` to `#92400e` (passes AA on `warn-soft`). See `DESIGN.md` §Colors for the full per-pair audit.
- **Active segmented control ("Expense")** — do **not** color it red. Use `{color.ink}` on `{color.surface.2}` with a 2px `{color.accent}` bottom border. The PRD requires non-judgmental framing.
- **Mode labels** — every monetary value in the UI carries a small `<span class="mode-pill">` next to it (`Actual`, `Projected`, `Planned`, `Reserved`). Color is never the only signal.

### Focus & motion

- **Global focus style:** `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. No custom rings that hide the default.
- **Skip-to-content link** is the first focusable element on every page; visually hidden until focused.
- **Reduced motion:** all animations (Financial Health ring fill, slider value tween, progress-bar fill, skeleton shimmer, stacked-bar transitions) are gated by `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }`.

### Touch targets

- **Minimum 44×44 px** on every interactive element (44 px is the WCAG 2.5.5 minimum; we use 44 px as floor, 48 px as preferred for primary actions).
- **Sidebar nav items** must use `min-height: 44px` (currently ~32 px in initial mockups).
- **Quick-add close button** must be ≥ 44 px (currently 28 px).

### Forms

- **Required-field asterisks** (`*`) in `{color.bad}` color, paired with `aria-required="true"` on the input.
- **Error messages** always follow the three-part format: **What** is wrong / **Why** it matters / **How** to fix. See `EXPERIENCE.md` §3 for templates.
- **Field-level errors** are linked via `aria-describedby` so screen readers announce them when focus returns to the invalid field.

### Screen-reader announcements for amounts

- Use `aria-label="BDT 8,000"` on `<input>` and `<span>` elements that contain a monetary value.
- For lakh-grouped numbers (`BDT 1,42,350`), the screen reader will read the digits; that is acceptable. The `aria-label` should include "BDT" so the unit is unambiguous.
- Negative values: write "minus" in the `aria-label` for SR clarity, e.g. `aria-label="Minus BDT 40,000"` for `- BDT 40,000`.

## What the exemplar demonstrates

`plan-editor-a11y.html` shows the **over-allocated state** with:
- A real `<input type="range">` slider (line ~150) with `aria-label`, `aria-invalid="true"`, `aria-describedby="plan-error"`.
- A `<div role="alert" aria-live="assertive" id="plan-error">` banner that screen readers will announce when it appears.
- The "Why" + "Fix" sub-paragraph in the banner (PRD §11 three-part error format).
- A real `<nav>` with `<a aria-current="page">` (no `<div>` nav).
- A skip-to-content link as the first focusable element.
- `:focus-visible` global rule.
- `prefers-reduced-motion` block that disables all animations.
- A stacked allocation bar with `role="img"` and visually-hidden segment text.

## Production handoff

When `bmad-build` starts implementing the React/Tailwind components:

1. Use `plan-editor-a11y.html` as the pattern reference for every interactive component.
2. Implement `prefers-reduced-motion` at the **CSS layer** (one global rule) rather than per-component.
3. Run a Lighthouse / axe-core audit on every page; no Critical accessibility violations are allowed to ship.
4. Verify 200% browser zoom reflows correctly (no horizontal scroll, no clipped content).
5. Verify keyboard-only operation end-to-end (Tab order, slider arrows, form submission).
6. Run NVDA / VoiceOver smoke tests on each major screen.