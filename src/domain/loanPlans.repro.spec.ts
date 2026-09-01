/**
 * loanPlans.repro.spec.ts — regression test for the "Save with no edits"
 * scenario reported by the user.
 *
 * Repro: click "+ New projection" on the Loan Calculator → don't edit
 * anything → click Save plan. After Save, the list should show the new
 * card AND the sidebar Summary "Projections" count should increment.
 * The bug: the new card appears in the list (rendered as a draft
 * because dirty was somehow stuck at true) but the sidebar count
 * stayed at the old number.
 */
import { describe, it, expect } from 'vitest';
import {
  addLoanPlan, saveLoanPlan,
} from './loanPlans';
import { DEFAULT_STATE } from './persistence';
import type { State } from './types';

function makeState(): State {
  return { ...DEFAULT_STATE };
}

describe('repro: create + immediate save with no edits', () => {
  it('after Save, the plan appears in the "saved" slice and increments count', () => {
    let state = makeState();
    const beforeCount = state.loanPlans.filter(p => !p.dirty).length;
    expect(beforeCount).toBe(0);

    // Step 1: user clicks "+ New projection"
    const r1 = addLoanPlan(state, {
      name: '',
      principal: 0,
      rate: 0,
      termMonths: 12,
      startDate: '2026-01-01',
    });
    state = r1.state;

    // Step 2: user clicks Save without editing
    state = saveLoanPlan(state, r1.id);

    // Expectation: the new plan should be in the "saved" slice (not
    // the "drafts" slice). Both the card list and the summary count
    // read off `saved`, so both should update.
    const saved = state.loanPlans.filter(p => !p.dirty);
    const drafts = state.loanPlans.filter(p => p.dirty);

    expect(saved).toHaveLength(1);
    expect(drafts).toHaveLength(0);
    expect(saved[0].id).toBe(r1.id);
    expect(saved[0].savedAt).not.toBeNull();
  });
});