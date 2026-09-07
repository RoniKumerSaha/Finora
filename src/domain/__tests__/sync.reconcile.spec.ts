/**
 * sync.reconcile.spec.ts — pure-function tests for pickWinner.
 *
 * The reconcile runs on every boot when the user is signed in and
 * cloud sync is enabled. These tests cover the four branches of the
 * decision matrix:
 *
 *   no cloud row         → keep-local
 *   cloud newer          → adopt-cloud
 *   local newer          → keep-local
 *   equal stamps         → server-side updated_at decides
 */
import { describe, expect, it } from 'vitest';
import { pickWinner, type CloudRow } from '../sync.reconcile';
import type { State } from '../types';

function makeState(stamp: number): State {
  return {
    version: 1,
    accounts: [], transactions: [], goals: [], debts: [], investments: [],
    categories: [], monthPlans: [], eventPlans: [], investmentPlans: [], loanPlans: [],
    settings: { theme: 'dark', onboardingComplete: true, stateUpdatedAt: stamp },
  };
}

function makeCloudRow(stamp: number, updatedAt: number): CloudRow {
  return { payload: makeState(stamp), updatedAt };
}

describe('sync.reconcile.pickWinner', () => {
  it('keeps local when no cloud row exists', () => {
    const local = makeState(1_000);
    const outcome = pickWinner(local, null);
    expect(outcome.kind).toBe('keep-local');
    if (outcome.kind === 'keep-local') {
      expect(outcome.reason).toBe('no-cloud');
    }
  });

  it('adopts cloud when cloud stamp is strictly greater than local', () => {
    const local = makeState(1_000);
    const cloud = makeCloudRow(2_000, 2_000);
    const outcome = pickWinner(local, cloud);
    expect(outcome.kind).toBe('adopt-cloud');
    if (outcome.kind === 'adopt-cloud') {
      expect(outcome.cloud.updatedAt).toBe(2_000);
    }
  });

  it('keeps local when local stamp is strictly greater than cloud', () => {
    const local = makeState(2_000);
    const cloud = makeCloudRow(1_000, 1_000);
    const outcome = pickWinner(local, cloud);
    expect(outcome.kind).toBe('keep-local');
    if (outcome.kind === 'keep-local') {
      expect(outcome.reason).toBe('local-newer');
    }
  });

  it('treats undefined stateUpdatedAt as 0 (older saves before this field existed)', () => {
    const local: State = {
      ...makeState(0),
      settings: { theme: 'dark', onboardingComplete: true }, // no stamp
    };
    const cloud = makeCloudRow(500, 500);
    const outcome = pickWinner(local, cloud);
    expect(outcome.kind).toBe('adopt-cloud');
  });

  it('uses server-side updated_at as tiebreaker when client stamps are equal', () => {
    const local = makeState(1_000);
    const cloud = makeCloudRow(1_000, 2_000); // server clock ahead
    const outcome = pickWinner(local, cloud);
    expect(outcome.kind).toBe('adopt-cloud');
  });

  it('keeps local when both stamps are equal AND server clock agrees', () => {
    const local = makeState(1_000);
    const cloud = makeCloudRow(1_000, 1_000);
    const outcome = pickWinner(local, cloud);
    expect(outcome.kind).toBe('keep-local');
    if (outcome.kind === 'keep-local') {
      expect(outcome.reason).toBe('equal-and-cloud-not-newer');
    }
  });
});