/**
 * AddTransactionForm.spec.tsx — regression: the Category section must
 * always render on Add Expense / Add Income screens, even when
 * `state.categories` has no entries of the current type.
 *
 * Bug (2026-09-02): the section was gated behind `cats.length > 0`,
 * which silently vanished the entire field when categories were empty.
 * Fix: always render the section, and show an EmptyCategoryState panel
 * with a "Restore default categories" recovery action when there are
 * no chips to show.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddTransactionForm } from './AddTransactionForm';
import { useStore } from '../domain/store';
import { ensureReady, mergeDefaults, DEFAULT_STATE, load, __resetPersistenceForTests } from '../domain/persistence';
import { resetIDB, seedIDB, flushPendingWrites } from '../test/idb-helpers';
import type { State } from '../domain/types';

function renderAt(type: 'income' | 'expense') {
  return render(
    <MemoryRouter initialEntries={[`/transactions/new/${type}`]}>
      <AddTransactionForm
        type={type}
        title={type === 'income' ? 'Add income' : 'Add expense'}
        subtitle={type === 'income' ? 'Money received' : 'Quick path · 3 fields'}
      />
    </MemoryRouter>,
  );
}

const minimalState = (over: Partial<State> = {}): State => ({
  ...DEFAULT_STATE,
  settings: { theme: 'dark', onboardingComplete: true },
  ...over,
});

describe('AddTransactionForm — Category section always renders', () => {
  beforeEach(async () => {
    await resetIDB();
    await ensureReady();
    useStore.setState({ state: load() });
  });

  it('renders the Category field on Add Expense with default state', () => {
    renderAt('expense');
    // The field label must be present.
    expect(screen.getByText(/Category \(optional\)/i)).toBeInTheDocument();
  });

  it('renders the Category field on Add Income with default state', () => {
    renderAt('income');
    expect(screen.getByText(/Category \(optional\)/i)).toBeInTheDocument();
  });

  it('renders Category chips when categories exist (expense)', () => {
    // Default state has 31 expense categories. Just assert that the
    // "Show all" button appears (it only renders when groups > 1).
    renderAt('expense');
    expect(screen.getByText(/Show all/i)).toBeInTheDocument();
  });

  it('renders the recovery panel when state.categories is empty', async () => {
    // Seed IDB with a state whose categories are explicitly empty
    // (the bug shape: persisted state had no categories at all).
    __resetPersistenceForTests();
    await seedIDB(minimalState({ categories: [] }));
    await ensureReady();
    useStore.setState({ state: load() });

    renderAt('expense');

    // The Category field must STILL render, not vanish.
    expect(screen.getByText(/Category \(optional\)/i)).toBeInTheDocument();
    // The empty-state recovery panel must be visible.
    expect(screen.getByText(/categories available/i)).toBeInTheDocument();
    expect(screen.getByText(/Restore default categories/i)).toBeInTheDocument();
  });

  it('renders the recovery panel when only the wrong type is present', async () => {
    // Seed IDB with only expense categories — opening Add Income
    // should show the recovery panel.
    __resetPersistenceForTests();
    await seedIDB(minimalState({
      categories: DEFAULT_STATE.categories.filter(c => c.type === 'expense'),
    }));
    await ensureReady();
    useStore.setState({ state: load() });

    renderAt('income');
    expect(screen.getByText(/categories available/i)).toBeInTheDocument();
  });

  it('Restore default categories re-seeds chips without losing data', async () => {
    // Seed IDB with the broken shape PLUS a real account so we can
    // verify the recovery doesn't nuke unrelated data.
    const fixture = minimalState({
      categories: [],
      accounts: [
        { id: 'a-keep', name: 'Keep me', type: 'cash', openingBalance: 999, createdAt: '2026-01-01' },
      ],
    });
    __resetPersistenceForTests();
    await seedIDB(fixture);
    await ensureReady();
    useStore.setState({ state: load() });

    renderAt('expense');
    const restore = screen.getByText(/Restore default categories/i);
    fireEvent.click(restore);
    await flushPendingWrites();

    // Categories must now be the full default set.
    await waitFor(() => {
      const s = useStore.getState().state;
      expect(s.categories.length).toBeGreaterThan(30);
      // The pre-existing account must still be there.
      expect(s.accounts.find(a => a.id === 'a-keep')).toBeTruthy();
      // mergeDefaults is additive, so we can also confirm via the
      // pure function directly.
      expect(mergeDefaults(fixture).categories.length).toBeGreaterThan(30);
    });
  });
});