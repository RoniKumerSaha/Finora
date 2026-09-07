/**
 * AccountSection.spec.tsx — verify the signed-out / signed-in panels.
 *
 * The signed-out panel shows a "Sign in" button that opens the
 * SignInDialog. The signed-in panel shows the user's email and a
 * "Force sync now" button.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountSection } from '../AccountSection';
import {
  installFakeSupabase,
  __setAuthUser,
  __resetSyncForTests,
} from '../../test/sync-helpers';
import { resetIDB } from '../../test/idb-helpers';

beforeEach(async () => {
  __resetSyncForTests();
  await resetIDB();
  installFakeSupabase();
});

function renderSection() {
  return render(
    <MemoryRouter>
      <AccountSection />
    </MemoryRouter>,
  );
}

describe('AccountSection', () => {
  it('shows the signed-out panel with a Sign in button', () => {
    renderSection();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows the user email and Force sync when signed in', async () => {
    const engine = installFakeSupabase();
    __setAuthUser({ id: 'u1', email: 'a@b.com' });
    engine.setEnabled(true);
    await engine.init();
    renderSection();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /force sync now/i })).toBeInTheDocument();
  });
});
