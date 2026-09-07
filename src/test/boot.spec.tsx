/**
 * boot.spec.tsx — verify the boot order in main.tsx.
 *
 * The boot order is critical: ensureReady() must run before
 * useStore.setState({state: load()}) (otherwise the store holds
 * DEFAULT_STATE), and syncEngine.init() must run AFTER the store
 * is re-synced so reconcile has a baseline.
 *
 * We don't run main.tsx directly (it mounts React). Instead, we
 * simulate the boot sequence against the same primitives.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../domain/store';
import { syncEngine, __resetSyncEngineForTests } from '../domain/sync';
import { ensureReady, load } from '../domain/persistence';
import {
  installFakeSupabase,
  __setAuthUser,
  __seedCloudRow,
  __resetSyncForTests,
} from './sync-helpers';
import { resetIDB } from './idb-helpers';
import type { State } from '../domain/types';

beforeEach(async () => {
  __resetSyncForTests();
  await resetIDB();
  installFakeSupabase();
});

describe('boot sequence', () => {
  it('ensureReady → load → setState → syncEngine.init preserves a cloud-newer state', async () => {
    // Cloud has newer data
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    syncEngine.setEnabled(true);
    const cloudState: State = {
      version: 1, accounts: [], transactions: [], goals: [], debts: [], investments: [],
      categories: [], monthPlans: [], eventPlans: [], investmentPlans: [], loanPlans: [],
      settings: { theme: 'dark', onboardingComplete: true, stateUpdatedAt: 99_999 },
    };
    __seedCloudRow('u1', cloudState);

    // 1. ensureReady (mirrors main.tsx step 1)
    await ensureReady();
    // 2. resync the store with the cache (step 2)
    useStore.setState({ state: load() });
    // 3. syncEngine.init (step 3)
    await syncEngine.init();

    // After boot, the store should reflect the cloud state because
    // cloud wins on first pull.
    expect(useStore.getState().state.settings.stateUpdatedAt).toBe(99_999);
  });

  it('init() is idempotent — calling it twice does not double-pull', async () => {
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    syncEngine.setEnabled(true);
    const cloudState: State = {
      version: 1, accounts: [], transactions: [], goals: [], debts: [], investments: [],
      categories: [], monthPlans: [], eventPlans: [], investmentPlans: [], loanPlans: [],
      settings: { theme: 'dark', onboardingComplete: true, stateUpdatedAt: 7_777 },
    };
    __seedCloudRow('u1', cloudState);

    await ensureReady();
    useStore.setState({ state: load() });
    await syncEngine.init();
    await syncEngine.init(); // second call should be a no-op
    await syncEngine.init();

    // Still 7_777, not double-applied.
    expect(useStore.getState().state.settings.stateUpdatedAt).toBe(7_777);
  });

  it('sync is reset by __resetSyncEngineForTests', async () => {
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    syncEngine.setEnabled(true);
    await syncEngine.init();
    expect((syncEngine as unknown as { inited: boolean }).inited).toBe(true);
    __resetSyncEngineForTests();
    expect((syncEngine as unknown as { inited: boolean }).inited).toBe(false);
  });
});
