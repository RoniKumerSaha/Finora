/**
 * exportImport.ts — JSON backup / restore (AD-20, AD-10 in the spine).
 *
 * Per PRD §9.10 and the spine §10:
 *   - Export envelope: { version, exportedAt, data: <State> }.
 *   - Pretty-printed (2-space indent).
 *   - Filename: finora-backup-YYYY-MM-DD.json.
 *
 * Import:
 *   1. Parse + validate the envelope (version + required fields).
 *   2. Caller confirms replace via ConfirmDialog (we don't do that here).
 *   3. We hand the parsed State back; the store's `importAndReplace`
 *      recomputes derived fields and persists.
 */
import type { State } from '../domain/types';
import { exportEnvelopeSchema, STATE_VERSION } from './schemas';

export interface ExportEnvelope {
  version: number;
  exportedAt: string;
  data: State;
}

export function buildExport(state: State): ExportEnvelope {
  return {
    version: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    data: state,
  };
}

export function serializeExport(state: State): string {
  return JSON.stringify(buildExport(state), null, 2);
}

export function exportFilename(date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `finora-backup-${yyyy}-${mm}-${dd}.json`;
}

/**
 * Trigger a browser download of the current state. Returns the filename.
 */
export function downloadExport(state: State): string {
  const text = serializeExport(state);
  const filename = exportFilename();
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

/**
 * Parse + validate an uploaded JSON file. Throws on any failure with a
 * three-part error suitable for showBanner.
 */
export function parseImport(text: string): State {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError(
      'Backup file is not valid JSON',
      'The file couldn\'t be parsed as JSON — it may be corrupted.',
      'Re-export from the source device, or check that the file isn\'t truncated.',
    );
  }
  const result = exportEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ImportError(
      `Backup is missing field: ${first.path.join('.') || '(root)'}`,
      'The file doesn\'t match the Finora V1 backup shape.',
      'Make sure you exported from Finora V1 (not V0 or V2).',
    );
  }
  return result.data.data as State;
}

export class ImportError extends Error {
  constructor(public what: string, public why: string, public fix: string) {
    super(what);
  }
}