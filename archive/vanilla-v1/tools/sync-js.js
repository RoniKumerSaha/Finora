#!/usr/bin/env node
/**
 * sync-js.js — copy src/js/*.js into the mockup deploy directory.
 *
 * The mockup at docs/ux-designs/.../v2/index.html is the single-file
 * deliverable. It references modules via a relative `./js/*.js` path so it
 * stays self-contained when opened by double-click (file://) or deployed to
 * a static host (AD-13). The source of truth lives at src/js/.
 *
 * Usage:  node tools/sync-js.js
 * Idempotent.
 */

import { readdirSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SRC_DIR = join(__dirname, '..', 'src', 'js');
const OUT_DIR = join(__dirname, '..', 'docs', 'ux-designs', 'ux-finora-2026-08-13', 'mockups', 'v2', 'js');

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(SRC_DIR).filter(f => f.endsWith('.js'));
for (const f of files) {
  copyFileSync(join(SRC_DIR, f), join(OUT_DIR, f));
}

console.log(`OK: ${files.length} files synced to ${OUT_DIR}`);
for (const f of files) console.log(`  ${f}`);
