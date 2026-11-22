/**
 * AuthTests.spec.ts — the Supabase auth contract.
 *
 * These tests are **API-level contract tests, not manual cases**.
 * They carry `API-` titles so they are never mistaken for the
 * one-for-one `FIN-XX` mapping in `test/docs/manual-test.md` — the
 * manual cases that touch cloud sign-in (FIN-C02 … FIN-C04) live in
 * `test/e2e/ui_tests/cloud.spec.ts` and drive the real UI.
 *
 * Finora has **no first-party HTTP API**. The only network surface
 * is Supabase, and it is optional — the build only enables it when
 * `BASE_URL` and `BASE_ANON_KEY` are both present. So this suite is
 * kept OUT of the default gate and **guards itself**: with no
 * backend configured every case skips rather than fails.
 *
 * ## What is covered
 *
 *   - sign-up returns a usable session;
 *   - sign-in exchanges credentials for a session;
 *   - a wrong password is rejected with `invalid_credentials`;
 *   - a short password is rejected by the server's policy.
 *
 * The RLS-isolation case lives in `StateApiTests.spec.ts` — it needs
 * two live users, so it is serialised there.
 *
 * ## Credentials
 *
 * Every input comes from `data/auth.json`. The address is
 * suffixed per run (`uniqueEmail`), because sign-up is one-shot: a
 * second attempt with the same address returns "User already
 * registered", which would make the suite pass on a fresh database
 * and fail on the next run.
 */
import { expect, test } from '@playwright/test';
import { AuthApi, uniqueEmail } from './api/AuthApi';
import { envValue, requireEnv } from '../support/env';
import credentials from '../../data/auth.json' with { type: 'json' };

/**
 * No backend → skip the whole suite, loudly.
 *
 * `envValue` (not `process.env`) so a developer's `.env.local`
 * counts — that is the same precedence the app's own loader uses,
 * and the same one `cloud.spec.ts` follows.
 */
const BACKEND = Boolean(envValue('BASE_URL') && envValue('BASE_ANON_KEY'));
const SKIP_REASON = 'No Supabase configured (BASE_URL / BASE_ANON_KEY unset)';

test.describe('Supabase auth contract', () => {
  test.skip(!BACKEND, SKIP_REASON);

  let auth: AuthApi;
  /** The password lives in the environment, never in the repo. */
  let password: string;

  test.beforeEach(async ({ request }) => {
    auth = new AuthApi(request);
    password = requireEnv(credentials.validCredentials.passwordEnv);
  });

  test('API-User can sign up and receives a usable session', async () => {
    const email = uniqueEmail(credentials.validCredentials.email);

    const response = await auth.signUp(email, password, {
      data: { name: credentials.validCredentials.name },
    });

    // Status FIRST, then parse, then assert the payload.
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('access_token');
    expect(body).toHaveProperty('refresh_token');
    expect(body.token_type).toBe('bearer');
    expect(body.expires_in).toBeGreaterThan(0);

    // The session belongs to the address that was just registered.
    expect(body.user).toHaveProperty('id');
    expect(body.user.email).toBe(email);
    expect(body.user.id).toBeTruthy();

    // The token is a real JWT — three dot-separated segments.
    expect(String(body.access_token).split('.')).toHaveLength(3);
  });

  test('API-User can sign in with valid credentials', async () => {
    const email = uniqueEmail(credentials.validCredentials.email);

    // Register first — this stack has no email confirmation.
    const created = await auth.signUp(email, password);
    expect(created.status()).toBe(200);

    const response = await auth.signIn(email, password);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('access_token');
    expect(body.access_token).toBeTruthy();
    expect(body.user.email).toBe(email);

    // Sign-in issues a session for the SAME user as the sign-up.
    const signupBody = await created.json();
    expect(body.user.id).toBe(signupBody.user.id);
  });

  test('API-A wrong password is rejected with invalid_credentials', async () => {
    const email = uniqueEmail(credentials.validCredentials.email);
    const created = await auth.signUp(email, password);
    expect(created.status()).toBe(200);

    const response = await auth.signIn(
      email,
      requireEnv(credentials.invalidCredentials.passwordEnv),
    );

    // 400 + the documented error code — never a 200 with an empty body.
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error_code).toBe(credentials.invalidCredentials.errorCode);
    expect(body.msg).toBe(credentials.invalidCredentials.errorMessage);
    expect(body).not.toHaveProperty('access_token');
  });

  test('API-An unregistered address cannot sign in', async () => {
    const response = await auth.signIn(
      credentials.nonexistentUser.email,
      requireEnv(credentials.nonexistentUser.passwordEnv),
    );

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error_code).toBe(credentials.invalidCredentials.errorCode);
  });

  test('API-A password below the server policy is rejected', async () => {
    const email = uniqueEmail(credentials.validCredentials.email);

    const response = await auth.signUp(email, credentials.passwordPolicy.tooShort.password);

    // GoTrue answers 422 with a `weak_password` error code — a
    // validation failure, distinct from the 400 the credential
    // exchange returns.
    expect(response.status()).toBe(credentials.passwordPolicy.tooShort.expectedStatus);

    const body = await response.json();
    expect(body.error_code).toBe(credentials.passwordPolicy.tooShort.expectedErrorCode);
    expect(body.msg).toContain(credentials.passwordPolicy.tooShort.expectedError);
    expect(body).not.toHaveProperty('access_token');
  });
});
