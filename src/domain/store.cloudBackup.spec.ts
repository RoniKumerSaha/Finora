/**
 * store.cloudBackup.spec.ts — GD-2.2.
 *
 * Covers setCloudBackupLastSavedAt + hasCloudBackupSaved.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock persistence so we can spy on save() calls.
vi.mock('./persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./persistence')>();
  return {
    ...actual,
    save: vi.fn(),
    clear: vi.fn(() => actual.clear()),
    load: () => ({ ...actual.DEFAULT_STATE }),
  };
});

import { useStore } from './store';
import * as persistence from './persistence';

describe('cloudBackup store slice (GD-2.2)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // reset store to default state between tests
    useStore.setState({ state: { ...persistence.DEFAULT_STATE } });
  });

  it('setCloudBackupLastSavedAt updates state.settings.cloudBackup.lastSavedAt', () => {
    useStore.getState().setCloudBackupLastSavedAt('2026-08-18T12:00:00.000Z');
    expect(useStore.getState().state.settings.cloudBackup?.lastSavedAt).toBe(
      '2026-08-18T12:00:00.000Z',
    );
  });

  it('setCloudBackupLastSavedAt calls save() exactly once', () => {
    const saveSpy = vi.mocked(persistence.save);
    useStore.getState().setCloudBackupLastSavedAt('2026-08-18T12:00:00.000Z');
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('setCloudBackupLastSavedAt persists the new state to localStorage', () => {
    useStore.getState().setCloudBackupLastSavedAt('2026-08-18T12:00:00.000Z');
    expect(vi.mocked(persistence.save)).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          cloudBackup: { lastSavedAt: '2026-08-18T12:00:00.000Z' },
        }),
      }),
    );
  });

  it('hasCloudBackupSaved returns false before any save', () => {
    expect(useStore.getState().hasCloudBackupSaved()).toBe(false);
  });

  it('hasCloudBackupSaved returns true after setCloudBackupLastSavedAt', () => {
    useStore.getState().setCloudBackupLastSavedAt('2026-08-18T12:00:00.000Z');
    expect(useStore.getState().hasCloudBackupSaved()).toBe(true);
  });

  it('hasCloudBackupSaved returns false when lastSavedAt is an empty string', () => {
    useStore.getState().setCloudBackupLastSavedAt('');
    expect(useStore.getState().hasCloudBackupSaved()).toBe(false);
  });

  it('preserves other settings keys when updating lastSavedAt', () => {
    useStore.setState((s) => ({
      state: {
        ...s.state,
        settings: { ...s.state.settings, theme: 'light' as const },
      },
    }));
    useStore.getState().setCloudBackupLastSavedAt('2026-08-18T12:00:00.000Z');
    expect(useStore.getState().state.settings.theme).toBe('light');
    expect(useStore.getState().state.settings.cloudBackup?.lastSavedAt).toBe(
      '2026-08-18T12:00:00.000Z',
    );
  });
});
