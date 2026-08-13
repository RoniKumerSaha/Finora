#!/usr/bin/env node
/**
 * merge-theme.js — AD-8 of the V1 architecture spine.
 *
 * Reads docs/ux-designs/ux-finora-2026-08-13/mockups/v2/dark.html and
 * light.html, emits docs/ux-designs/ux-finora-2026-08-13/mockups/v2/index.html
 * whose only color literals live inside [data-theme="dark"] /
 * [data-theme="light"] blocks.
 *
 * Approach:
 *   1. Take dark.html as the canonical body (the two files have identical
 *      line counts and identical body markup — the drift is only in CSS
 *      literals).
 *   2. Apply rewrites to dark.html: each drift-point CSS literal becomes a
 *      var(--token) reference.
 *   3. Validate that each rewrite's "light literal" exists in light.html —
 *      a sanity check on token values, not on body content.
 *   4. Replace dark.html's :root block with two themed blocks: dark tokens +
 *      light tokens.
 *   5. Update <title>.
 *   6. Write to index.html.
 *
 * Drift points promoted to new tokens (each token is defined per-theme):
 *   --primary-on       — text/icon color over a primary background (btn-primary)
 *   --toggle-knob      — the white/dark circle inside the toggle pill
 *   --overlay          — modal backdrop (modal-bg)
 *   --shadow-modal     — large card / modal elevation shadow
 *   --primary-border   — 1px border on primary-tinted cards / filters
 *   --danger-border    — 1px border on danger-tinted cards / modals
 *   --warn-border      — 1px border on warn-tinted cards / modals
 *   --warn-bg-soft     — warn-tinted card background
 *   --accent-border    — 1px border on accent-tinted cards (e.g. maturity-value review)
 *
 * Usage:  node tools/merge-theme.js
 * Idempotent. Re-running overwrites index.html from the two originals.
 */

const fs = require('fs');
const path = require('path');

const MOCK_DIR = path.join(__dirname, '..', 'docs', 'ux-designs', 'ux-finora-2026-08-13', 'mockups', 'v2');
const DARK_PATH  = path.join(MOCK_DIR, 'dark.html');
const LIGHT_PATH = path.join(MOCK_DIR, 'light.html');
const OUT_PATH   = path.join(MOCK_DIR, 'index.html');

const dark  = fs.readFileSync(DARK_PATH, 'utf8');
const light = fs.readFileSync(LIGHT_PATH, 'utf8');

// Sanity: line counts should match exactly so section-by-section merge is 1:1.
const darkLines  = dark.split('\n').length;
const lightLines = light.split('\n').length;
if (darkLines !== lightLines) {
  console.error(`Line count mismatch: dark=${darkLines} light=${lightLines}. Aborting.`);
  process.exit(1);
}

// ---------- Drift-point rewrites (dark literal → var(...)) ----------
// Each entry: [ dark CSS literal that exists in dark.html,
//               light CSS literal that exists in light.html (validates token value),
//               replacement using var() in the merged file ]

const REWRITES = [
  // .btn-primary text color
  {
    id: 'btn-primary-text',
    darkMatch:  '.btn-primary{background:var(--primary);color:#0F1419}',
    lightMatch: '.btn-primary{background:var(--primary);color:#FFFFFF}',
    replace:    '.btn-primary{background:var(--primary);color:var(--primary-on)}',
  },
  // .modal-bg overlay
  {
    id: 'modal-bg',
    darkMatch:  'background:rgba(15,20,25,.6);backdrop-filter:blur(6px)',
    lightMatch: 'background:rgba(42,38,32,.25);backdrop-filter:blur(6px)',
    replace:    'background:var(--overlay);backdrop-filter:blur(6px)',
  },
  // .modal + .onb-card shadow — same dark literal, different light literals.
  // Replaced via String.replaceAll so both occurrences collapse to one var.
  {
    id: 'shadow-modal-both',
    darkMatch:  'box-shadow:0 10px 40px rgba(0,0,0,.4)',
    lightMatches: [
      'box-shadow:0 10px 40px rgba(42,38,32,.12)',  // .modal
      'box-shadow:0 10px 40px rgba(42,38,32,.1)',   // .onb-card
    ],
    replace:    'box-shadow:0 10px 40px var(--shadow-modal)',
    replaceAll: true,
  },
  // .toggle.on::after knob (matches --primary-on). Light has trailing border-color
  // we leave alone (it already uses var(--primary)). We match a stable prefix.
  {
    id: 'toggle-knob',
    darkMatch:  'left:18px;background:#0F1419}',
    lightMatch: 'left:18px;background:#FFFFFF;',
    replace:    'left:18px;background:var(--toggle-knob);}',
    // Note: the dark version has no trailing `;` before `}` (last property).
    // The replace adds one so light's trailing border-color stays valid CSS
    // when dark's compact form is used as canonical.
  },
  // .btn-danger border (1px solid …)
  {
    id: 'btn-danger-border',
    darkMatch:  'border:1px solid rgba(214,117,96,.3)',
    lightMatch: 'border:1px solid rgba(184,85,63,.3)',
    replace:    'border:1px solid var(--danger-border)',
  },
  // .btn-danger:hover background (lighter version — light uses .18, dark .25.
  // Same var is close enough for V1.)
  {
    id: 'btn-danger-hover-bg',
    darkMatch:  'background:rgba(214,117,96,.25)',
    lightMatch: 'background:rgba(184,85,63,.18)',
    replace:    'background:var(--danger-border)',
  },
  // .modal .danger-text border
  {
    id: 'modal-danger-border',
    darkMatch:  'border:1px solid rgba(214,117,96,.25)',
    lightMatch: 'border:1px solid rgba(184,85,63,.25)',
    replace:    'border:1px solid var(--danger-border)',
  },
  // .filter.active border-color
  {
    id: 'filter-active-border',
    darkMatch:  'border-color:rgba(93,191,160,.4)',
    lightMatch: 'border-color:rgba(13,130,117,.4)',
    replace:    'border-color:var(--primary-border)',
  },
  // inline: first-style card on home (line 884)
  {
    id: 'home-first-card',
    darkMatch:  'border:1px solid rgba(93,191,160,.3)',
    lightMatch: 'border:1px solid rgba(13,130,117,.3)',
    replace:    'border:1px solid var(--primary-border)',
  },
  // inline: debt-confirm + delete-debt-confirm modal borders (lines 1060, 1184).
  // Same dark literal, different light literals.
  {
    id: 'danger-modal-borders',
    darkMatch:  'border-color:rgba(214,117,96,.4)',
    lightMatches: [
      'border-color:rgba(184,85,63,.4)',
    ],
    replace:    'border-color:var(--danger-border)',
    replaceAll: true,
  },
  // inline: matured-investment card border (line 1325) + close-investment modal
  // border (line 1520). Same dark literal, same light literal.
  {
    id: 'warn-borders',
    darkMatch:  'border-color:rgba(244,184,96,.4)',
    lightMatch: 'border-color:rgba(182,132,46,.4)',
    replace:    'border-color:var(--warn-border)',
    replaceAll: true,
  },
  // inline: matured-investment card background (line 1325)
  {
    id: 'matured-card-bg',
    darkMatch:  'background:rgba(244,184,96,.06)',
    lightMatch: 'background:var(--warn-soft)',
    replace:    'background:var(--warn-bg-soft)',
  },
  // inline: add-investment review card border (line 1446)
  {
    id: 'review-card-border',
    darkMatch:  'border:1px solid rgba(217,178,107,.4)',
    lightMatch: 'border:1px solid rgba(164,126,44,.4)',
    replace:    'border:1px solid var(--accent-border)',
  },
];

// Apply rewrites to dark.html body. Idempotent.
// Idempotency is checked against the *source* literal (darkMatch) — if the
// literal is no longer present, this rewrite has already fired.
function applyRewritesToDark(html) {
  let out = html;
  for (const r of REWRITES) {
    if (!out.includes(r.darkMatch)) continue;  // already merged
    if (r.replaceAll) {
      out = out.split(r.darkMatch).join(r.replace);
    } else {
      out = out.replace(r.darkMatch, r.replace);
    }
  }
  return out;
}

// Validate that each rewrite's light literal(s) exist in light.html. This is
// a sanity check on the token values — if a light literal is missing it
// means light.html drifted from the expected pattern.
function validateLightTokens(html) {
  for (const r of REWRITES) {
    const matches = r.lightMatches || [r.lightMatch];
    for (const m of matches) {
      if (!html.includes(m)) {
        throw new Error(`Light match not found for "${r.id}": ${m}`);
      }
    }
  }
}

validateLightTokens(light);
const mergedBody = applyRewritesToDark(dark);

// ---------- Token tables per theme ----------
// Extracted from the two :root blocks (lines 9..17) of each source file.
const DARK_TOKENS = {
  '--bg':           '#1E2A26',
  '--surface':      '#253229',
  '--surface-2':    '#2E3C34',
  '--surface-3':    '#3A4A42',
  '--ink':          '#F1F3EF',
  '--muted':        '#94A59C',
  '--muted-2':      '#647068',
  '--primary':      '#5DBFA0',
  '--primary-soft': 'rgba(93,191,160,.18)',
  '--primary-hi':   'rgba(93,191,160,.08)',
  '--accent':       '#D9B26B',
  '--accent-soft':  'rgba(217,178,107,.18)',
  '--danger':       '#D67560',
  '--danger-soft':  'rgba(214,117,96,.18)',
  '--warn':         '#F4B860',
  '--warn-soft':    'rgba(244,184,96,.15)',
  '--border':       '#324139',
  '--border-2':     '#28332D',
  '--shadow':       '0 4px 14px rgba(0,0,0,.25)',
  // New tokens (AD-8)
  '--primary-on':   '#0F1419',
  '--toggle-knob':  '#0F1419',
  '--overlay':      'rgba(15,20,25,.6)',
  '--shadow-modal': 'rgba(0,0,0,.4)',
  '--primary-border': 'rgba(93,191,160,.4)',
  '--danger-border':  'rgba(214,117,96,.3)',
  '--warn-border':    'rgba(244,184,96,.4)',
  '--warn-bg-soft':   'rgba(244,184,96,.06)',
  '--accent-border':  'rgba(217,178,107,.4)',
};

const LIGHT_TOKENS = {
  '--bg':           '#F7F4EC',
  '--surface':      '#FFFFFF',
  '--surface-2':    '#F0EBDF',
  '--surface-3':    '#E5DECB',
  '--ink':          '#2A2620',
  '--muted':        '#7A6F5E',
  '--muted-2':      '#B5A992',
  '--primary':      '#0D8275',
  '--primary-soft': 'rgba(13,130,117,.12)',
  '--primary-hi':   'rgba(13,130,117,.06)',
  '--accent':       '#A47E2C',
  '--accent-soft':  'rgba(164,126,44,.14)',
  '--danger':       '#B8553F',
  '--danger-soft':  'rgba(184,85,63,.12)',
  '--warn':         '#B6842E',
  '--warn-soft':    'rgba(182,132,46,.14)',
  '--border':       '#E5DECB',
  '--border-2':     '#D8CFB8',
  '--shadow':       '0 4px 14px rgba(42,38,32,.06)',
  // New tokens (AD-8)
  '--primary-on':   '#FFFFFF',
  '--toggle-knob':  '#FFFFFF',
  '--overlay':      'rgba(42,38,32,.25)',
  '--shadow-modal': 'rgba(42,38,32,.12)',
  '--primary-border': 'rgba(13,130,117,.4)',
  '--danger-border':  'rgba(184,85,63,.3)',
  '--warn-border':    'rgba(182,132,46,.4)',
  '--warn-bg-soft':   'var(--warn-soft)',
  '--accent-border':  'rgba(164,126,44,.4)',
};

function tokensToCSS(tokens, indent = '    ') {
  return Object.entries(tokens).map(([k, v]) => `${indent}${k}:${v};`).join('\n');
}

const THEMED_CSS = `
[data-theme="dark"] {
${tokensToCSS(DARK_TOKENS, '  ')}
}
[data-theme="light"] {
${tokensToCSS(LIGHT_TOKENS, '  ')}
}`;

// Replace the original :root block with the new themed blocks.
const OLD_ROOT_RE = /:root\{[^}]*\}/;
if (!OLD_ROOT_RE.test(mergedBody)) {
  throw new Error('Could not find :root block in merged body.');
}
const finalBody = mergedBody.replace(OLD_ROOT_RE, THEMED_CSS.trim());

// Update the <title> so users opening the file see something neutral.
const finalHtml = finalBody.replace(
  /<title>[^<]*<\/title>/,
  '<title>Finora · Prototype</title>'
);

fs.writeFileSync(OUT_PATH, finalHtml, 'utf8');

console.log(`OK: ${OUT_PATH}`);
console.log(`  dark  ${darkLines} lines → merged`);
console.log(`  light ${lightLines} lines → merged`);
console.log(`  rewrites applied: ${REWRITES.length}`);
console.log(`  new tokens per theme: ${Object.keys(DARK_TOKENS).length}`);