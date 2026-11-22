/**
 * StateApiTests.spec.ts — the `finora_state` REST contract and the
 * **RLS isolation** cases.
 *
 * These tests are **API-level contract tests, not manual cases**.
 * They carry `API-` titles so they are never mistaken for the
 * one-for-one `FIN-XX` mapping in `test/docs/manual-test.md` — the
 * manual cases that touch cloud sync (FIN-C01 … FIN-C04) live in
 * `test/e2e/ui_tests/cloud.spec.ts` and drive the real UI.
 *
 * This is the highest-value test in the whole API suite: the entire
 * cloud-sync design rests on the claim that "users can only see
 * their own data". If RLS is wrong, every user's finances leak.
 *
 * ## How RLS actually fails — and why that matters here
 *
 * Postgres row-level security **filters** rather than errors. A
 * cross-user read is not a 403; it is a 200 with an empty result
 * set, because the row never reaches the response. A cross-user
 * UPDATE is a 200 that matched **zero** rows. Only a cross-user
 * INSERT is a hard 403, because the `with check` clause has
 * something to reject.
 *
 * So the assertions are deliberately shape-sensitive:
 *
 *   - cross-user SELECT → `[]` (not 403, not A's row);
 *   - cross-user UPDATE → `[]` — zero rows touched;
 *   - cross-user INSERT → 403 with a 42501 policy-violation body;
 *   - cross-user DELETE → `[]` — and A's row still exists afterwards.
 *
 * Asserting only the status code would pass on a 200 that leaked
 * nothing *and* on a 200 that leaked everything. Asserting the body
 * shape is what makes the test meaningful.
 *
 * ## Serialisation
 *
 * The suite is `mode: 'serial'` — the two users are shared across
 * the cases, and one failure cascading into four confusing
 * downstream errors is worse than one root cause.
 *
 * ## Gating
 *
 * With no backend configured every case skips rather than fails.
 */
import { expect, test } from '@playwright/test';
import { AuthApi, uniqueEmail } from './api/AuthApi';
import { StateApi, type StateRow } from './api/StateApi';
import { envValue, requireEnv } from '../support/env';
import credentials from '../../data/auth.json' with { type: 'json' };

/**
 * No backend → skip the whole suite, loudly.
 *
 * `envValue` (not `process.env`) so a developer's `.env.local`
 * counts — the same precedence the app's own loader uses.
 */
const BACKEND = Boolean(envValue('BASE_URL') && envValue('BASE_ANON_KEY'));
const SKIP_REASON = 'No Supabase configured (BASE_URL / BASE_ANON_KEY unset)';

test.describe('finora_state REST contract', () => {
  test.skip(!BACKEND, SKIP_REASON);

  // The two users are shared across the cases below, so the suite is
  // serial: one root cause beats four cascading failures.
  test.describe.configure({ mode: 'serial' });

  let auth: AuthApi;
  /** User A — the row owner. */
  let ownerToken: string;
  let ownerId: string;
  /** User B — the outsider who must never see A's data. */
  let outsiderToken: string;
  let outsiderId: string;

  test.beforeAll(async ({ request }) => {
    auth = new AuthApi(request);
    const password = requireEnv(credentials.validCredentials.passwordEnv);

    const ownerEmail = uniqueEmail(credentials.validCredentials.email);
    const outsiderEmail = uniqueEmail(credentials.validCredentials.email);

    const owner = await auth.signUpSession(ownerEmail, password);
    ownerToken = owner.accessToken;
    ownerId = owner.user.id;

    const outsider = await auth.signUpSession(outsiderEmail, password);
    outsiderToken = outsider.accessToken;
    outsiderId = outsider.user.id;
  });

  test('API-A user can write and read back their own state row', async ({ request }) => {
    const api = new StateApi(request, ownerToken);

    const row: Omit<StateRow, 'updated_at'> = {
      user_id: ownerId,
      version: 1,
      payload: { marker: credentials.stateRow.note },
    };

    const written = await api.insert(row, { represent: true });
    expect(written.status()).toBe(201);

    const writtenRows = await written.json();
    expect(writtenRows).toHaveLength(1);
    expect(writtenRows[0].user_id).toBe(ownerId);
    expect(writtenRows[0].version).toBe(1);

    // The owner reads their own row back.
    const read = await api.read(ownerId);
    expect(read.status()).toBe(200);

    const rows = await read.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(ownerId);
    expect(rows[0].payload.marker).toBe(credentials.stateRow.note);
  });

  test('API-An outsider cannot read the owner state row', async ({ request }) => {
    const outsiderApi = new StateApi(request, outsiderToken);

    // Filtering, not erroring: 200 with an EMPTY body.
    const read = await outsiderApi.read(ownerId);
    expect(read.status()).toBe(200);

    const rows = await read.json();
    expect(rows).toHaveLength(0);
    expect(JSON.stringify(rows)).not.toContain(credentials.stateRow.note);
  });

  test('API-An outsider sees no rows at all', async ({ request }) => {
    const outsiderApi = new StateApi(request, outsiderToken);

    const list = await outsiderApi.list();
    expect(list.status()).toBe(200);

    const rows = await list.json();
    expect(rows).toHaveLength(0);
  });

  test('API-An outsider cannot update the owner state row', async ({ request }) => {
    const outsiderApi = new StateApi(request, outsiderToken);

    const update = await outsiderApi.update(ownerId, { version: 99 }, { represent: true });
    expect(update.status()).toBe(200);

    // Zero rows matched — the owner's row was not touched.
    const updated = await update.json();
    expect(updated).toHaveLength(0);

    // Prove it: the owner's version is unchanged.
    const ownerApi = new StateApi(request, ownerToken);
    const read = await ownerApi.read(ownerId);
    const rows = await read.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(1);
  });

  test('API-An outsider cannot insert a row claiming the owner identity', async ({ request }) => {
    const outsiderApi = new StateApi(request, outsiderToken);

    const insert = await outsiderApi.insert({
      user_id: ownerId,
      version: 1,
      payload: { marker: 'stolen' },
    });

    // The one case where RLS raises: the `with check` clause has a
    // row to reject.
    expect(insert.status()).toBe(403);

    const body = await insert.json();
    expect(body.code).toBe('42501');
    expect(body.message).toContain('row-level security policy');

    // And the owner's row is untouched.
    const ownerApi = new StateApi(request, ownerToken);
    const read = await ownerApi.read(ownerId);
    const rows = await read.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.marker).toBe(credentials.stateRow.note);
  });

  test('API-An outsider cannot delete the owner state row', async ({ request }) => {
    const outsiderApi = new StateApi(request, outsiderToken);

    const remove = await outsiderApi.remove(ownerId, { represent: true });
    expect(remove.status()).toBe(200);

    // Zero rows matched.
    const removed = await remove.json();
    expect(removed).toHaveLength(0);

    // The owner's row survives.
    const ownerApi = new StateApi(request, ownerToken);
    const read = await ownerApi.read(ownerId);
    const rows = await read.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(ownerId);
  });

  test('API-An anonymous request cannot write a state row', async ({ request }) => {
    // No Authorization header — just the anon key. The anon role has
    // no `auth.uid()`, so the `with check` clause can never match.
    //
    // PostgREST answers **401** here, not 403: the request carries
    // the anon key but no bearer token, so it is unauthenticated
    // rather than authenticated-as-the-wrong-user. The body is still
    // the RLS policy violation, which is the part that matters.
    const response = await request.post('/rest/v1/finora_state', {
      headers: { Prefer: 'return=representation' },
      data: {
        user_id: outsiderId,
        version: 1,
        payload: { marker: 'anonymous' },
      },
    });

    expect(response.status()).toBe(credentials.anonymousWrite.expectedStatus);

    const body = await response.json();
    expect(body.code).toBe(credentials.anonymousWrite.expectedCode);
    expect(body.message).toContain(credentials.anonymousWrite.expectedMessage);
  });

  test('API-A user can delete their own state row', async ({ request }) => {
    const ownerApi = new StateApi(request, ownerToken);

    const remove = await ownerApi.remove(ownerId, { represent: true });
    expect(remove.status()).toBe(200);

    const removed = await remove.json();
    expect(removed).toHaveLength(1);
    expect(removed[0].user_id).toBe(ownerId);

    // Gone.
    const read = await ownerApi.read(ownerId);
    const rows = await read.json();
    expect(rows).toHaveLength(0);
  });
});
