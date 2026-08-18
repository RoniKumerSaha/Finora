/**
 * settings.cloudBackup.spec.ts — back-compat of the new cloudBackup
 * field on Settings. Covers GD-2.1.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, DEFAULT_STATE } from './persistence';
import { exportEnvelopeSchema } from '../lib/schemas';

describe('Settings.cloudBackup (GD-2.1)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mergeDefaults gives new installs an empty cloudBackup object', () => {
    const s = load();
    expect(s.settings.cloudBackup).toBeDefined();
    expect(s.settings.cloudBackup).toEqual({});
  });

  it('load() of a V1 backup (no cloudBackup) fills cloudBackup: {}', () => {
    // Simulate an older V1 backup written directly to localStorage.
    const legacy = {
      version: 1,
      accounts: [],
      transactions: [],
      goals: [],
      debts: [],
      investments: [],
      categories: [],
      monthPlans: [],
      eventPlans: [],
      settings: { theme: 'dark', onboardingComplete: false },
    };
    localStorage.setItem('finora:v1', JSON.stringify(legacy));
    const s = load();
    expect(s.settings.cloudBackup).toEqual({});
  });

  it('load() preserves a cloudBackup.lastSavedAt if present', () => {
    const withCloud = {
      version: 1,
      accounts: [],
      transactions: [],
      goals: [],
      debts: [],
      investments: [],
      categories: [],
      monthPlans: [],
      eventPlans: [],
      settings: {
        theme: 'dark',
        onboardingComplete: false,
        cloudBackup: { lastSavedAt: '2026-08-18T12:00:00.000Z' },
      },
    };
    localStorage.setItem('finora:v1', JSON.stringify(withCloud));
    const s = load();
    expect(s.settings.cloudBackup?.lastSavedAt).toBe('2026-08-18T12:00:00.000Z');
  });

  it('exportEnvelopeSchema accepts a V1 backup without cloudBackup', () => {
    const env = {
      version: 1,
      exportedAt: '2026-08-18T00:00:00.000Z',
      data: {
        ...DEFAULT_STATE,
        settings: { theme: 'dark' as const, onboardingComplete: false },
      },
    };
    const result = exportEnvelopeSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it('exportEnvelopeSchema accepts a backup with cloudBackup.present', () => {
    const env = {
      version: 1,
      exportedAt: '2026-08-18T00:00:00.000Z',
      data: {
        ...DEFAULT_STATE,
        settings: {
          theme: 'dark' as const,
          onboardingComplete: false,
          cloudBackup: { lastSavedAt: '2026-08-18T12:00:00.000Z' },
        },
      },
    };
    const result = exportEnvelopeSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it('save() round-trips cloudBackup unchanged', () => {
    const state = {
      ...DEFAULT_STATE,
      settings: {
        ...DEFAULT_STATE.settings,
        cloudBackup: { lastSavedAt: '2026-08-18T12:00:00.000Z' },
      },
    };
    save(state);
    const reloaded = load();
    expect(reloaded.settings.cloudBackup?.lastSavedAt).toBe('2026-08-18T12:00:00.000Z');
  });
});
