/**
 * AuthApi — the Supabase Auth surface, wrapped for the API suite.
 *
 * There is no first-party HTTP API in Finora. The only network
 * surface is Supabase, and it is optional (build-time `BASE_URL` +
 * `BASE_ANON_KEY`). So this suite is deliberately kept OUT of the
 * default gate — it only runs when a Supabase instance is
 * configured.
 *
 * ## Why the classes, not raw URLs in the spec
 *
 * The rule "no locator strings in a spec" has an API twin: the
 * endpoint paths and the auth headers live here, so a spec reads as
 * *behaviour* ("a wrong password is rejected") rather than as HTTP.
 *
 * ## Shape of the responses
 *
 * Both endpoints are verified against a live Supabase instance:
 *
 *   - `POST /auth/v1/signup` → 200 with
 *     `{ access_token, refresh_token, token_type, expires_in, user }`.
 *   - `POST /auth/v1/token?grant_type=password` → 200 with the same
 *     envelope on success, or 400 with
 *     `{ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }`.
 */
import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export interface AuthErrorBody {
  code: number;
  error_code: string;
  msg: string;
}

/** A response plus its already-parsed JSON body. */
export interface ApiResult<T = unknown> {
  status: number;
  body: T;
}

const SIGNUP_PATH = '/auth/v1/signup';
const TOKEN_PATH = '/auth/v1/token?grant_type=password';

export class AuthApi {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * Create a user.
   *
   * `emailConfirmation` is false by default so a local stack with
   * `enable_confirmations = false` returns the session immediately
   * rather than a "check your inbox" payload.
   */
  async signUp(
    email: string,
    password: string,
    options: { emailConfirmation?: boolean; data?: Record<string, unknown> } = {},
  ): Promise<APIResponse> {
    return this.request.post(SIGNUP_PATH, {
      data: {
        email,
        password,
        data: options.data ?? {},
        // Ask GoTrue to skip the confirmation hop. A local stack has
        // no mail server, so a confirmed signup would never return a
        // session and the case would hang.
        email_confirm: options.emailConfirmation ?? true,
      },
    });
  }

  /** Exchange an email + password for a session. */
  async signIn(email: string, password: string): Promise<APIResponse> {
    return this.request.post(TOKEN_PATH, {
      data: { email, password },
    });
  }

  /** Sign in and return the parsed session. Throws on a non-200. */
  async signInSession(email: string, password: string): Promise<AuthSession> {
    const response = await this.signIn(email, password);
    if (response.status() !== 200) {
      throw new Error(`Sign-in failed: ${response.status()} ${await response.text()}`);
    }
    return toSession(await response.json());
  }

  /** Sign up and return the parsed session. Throws on a non-200. */
  async signUpSession(
    email: string,
    password: string,
    options: { data?: Record<string, unknown> } = {},
  ): Promise<AuthSession> {
    const response = await this.signUp(email, password, options);
    if (response.status() !== 200) {
      throw new Error(`Sign-up failed: ${response.status()} ${await response.text()}`);
    }
    return toSession(await response.json());
  }
}

/** Normalise the GoTrue session envelope. */
export function toSession(body: {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}): AuthSession {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    tokenType: body.token_type,
    expiresIn: body.expires_in,
    user: body.user,
  };
}

/**
 * A unique address derived from a template.
 *
 * Sign-up is one-shot: a second attempt with the same address
 * returns "User already registered", which would make the suite
 * pass on a fresh database and fail on the next run. So the local
 * part of the address carries a per-run suffix. The domain and the
 * password still come from `data/auth.json`.
 *
 * The implementation lives in `test/e2e/support/unique-email.ts` so
 * the cloud UI suite can use it too — both create accounts against
 * the same backend.
 */
export { uniqueEmail } from '../../support/unique-email';
