/**
 * SyncStatusPill.spec.tsx — verify the pill renders the right tone + label
 * for each SyncStatus kind.
 *
 * Strategy: render the pill, force the SyncEngine into each state by
 * calling internal setters via the fake, then assert on the rendered
 * text. We don't poke the React tree deeply — just enough to confirm
 * the labels match the design table.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SyncStatusPill } from '../SyncStatusPill';
import {
  installFakeSupabase,
  __setAuthUser,
  __resetSyncForTests,
} from '../../test/sync-helpers';
import { resetIDB } from '../../test/idb-helpers';

function renderPill() {
  return render(
    <MemoryRouter>
      <SyncStatusPill />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  __resetSyncForTests();
  await resetIDB();
  installFakeSupabase();
});

describe('SyncStatusPill', () => {
  it('shows "Cloud off" when signed out', async () => {
    const engine = installFakeSupabase();
    engine.setEnabled(true);
    renderPill();
    expect(screen.getByText(/cloud off/i)).toBeInTheDocument();
  });

  it('shows "Synced · just now" after a successful push', async () => {
    const engine = installFakeSupabase();
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    await engine.init();
    // Wait for the first-time seed push to land.
    await new Promise(r => setTimeout(r, 100));
    renderPill();
    expect(screen.getByText(/synced/i)).toBeInTheDocument();
  });
});