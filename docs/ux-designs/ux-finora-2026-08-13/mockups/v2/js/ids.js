/**
 * ids.js — UUID generation, shared by every entity module.
 *
 * Uses crypto.randomUUID() when available (modern browsers + Node 19+).
 * Falls back to a time-prefixed random hex for the rare environment without
 * the Web Crypto API. The browser-loadable path uses crypto.randomUUID.
 */

export function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: 32 random hex chars prefixed with a timestamp for collision resistance.
  const t = Date.now().toString(16);
  const r = Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  return `${t}${r}`;
}
