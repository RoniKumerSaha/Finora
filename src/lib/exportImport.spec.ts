/**
 * exportImport.spec.ts — round-trip identity + version validation.
 */
import { describe, it, expect } from 'vitest';
import { buildExport, serializeExport, parseImport, exportFilename } from './exportImport';
import { DEFAULT_STATE } from '../domain/persistence';

describe('export / import round-trip', () => {
  it('envelope shape has version + exportedAt + data', () => {
    const env = buildExport(DEFAULT_STATE);
    expect(env.version).toBe(1);
    expect(typeof env.exportedAt).toBe('string');
    expect(env.data).toEqual(DEFAULT_STATE);
  });

  it('serializeExport is pretty-printed JSON', () => {
    const text = serializeExport(DEFAULT_STATE);
    expect(text.startsWith('{')).toBe(true);
    expect(text).toContain('\n  ');  // 2-space indent
  });

  it('filename is YYYY-MM-DD', () => {
    expect(exportFilename(new Date('2026-08-13T00:00:00Z'))).toBe('finora-backup-2026-08-13.json');
  });

  it('parses what it serialized', () => {
    const text = serializeExport(DEFAULT_STATE);
    const parsed = parseImport(text);
    expect(parsed).toEqual(DEFAULT_STATE);
  });

  it('rejects non-JSON', () => {
    expect(() => parseImport('not json at all')).toThrow(/not valid JSON/);
  });

  it('rejects wrong version', () => {
    const bad = JSON.stringify({ version: 99, exportedAt: '2026-01-01', data: DEFAULT_STATE });
    expect(() => parseImport(bad)).toThrow(/version/);
  });

  it('rejects missing top-level keys', () => {
    const bad = JSON.stringify({ version: 1, exportedAt: '2026-01-01', data: { version: 1 } });
    expect(() => parseImport(bad)).toThrow();
  });
});