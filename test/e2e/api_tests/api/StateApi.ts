/**
 * StateApi — the `public.finora_state` REST surface.
 *
 * One row per user. The row holds the entire `State` blob as JSONB
 * so cross-device sync can use a single write per mutation instead of
 * fanning out to multiple entity tables. RLS scopes every
 * read/write/delete to `auth.uid()`, so users can only see their own
 * data.
 *
 * The RLS policies live in `supabase/migrations/0001_init.sql`:
 *
 *   - `own read`   — `using (auth.uid() = user_id)`
 *   - `own write`  — `with check (auth.uid() = user_id)`
 *   - `own update` — `using` AND `with check` on `auth.uid() = user_id`
 *   - `own delete` — `using (auth.uid() = user_id)`
 *
 * ## Why the raw REST API and not the Supabase client
 *
 * The client would hide exactly the thing this suite exists to
 * prove: **that the server refuses the cross-user read.** A raw
 * `GET /rest/v1/finora_state` with user B's token has to come back
 * empty, not 403-with-a-payload — RLS filters the row out of the
 * result set before the response is built, so B genuinely cannot
 * see A's data. Testing that through the client would hide the
 * distinction between "denied" and "filtered".
 */
import type { APIRequestContext, APIResponse } from '@playwright/test';

const TABLE = 'finora_state';

export interface StateRow {
  user_id: string;
  version: number;
  payload: Record<string, unknown>;
  updated_at: string;
}

export interface WriteOptions {
  /**
   * Ask PostgREST to echo the affected row back.
   *
   * Needed because RLS **filters** rather than errors: a cross-user
   * UPDATE matches zero rows and comes back 200 with an empty body.
   * With `return=representation` the echo is likewise empty — which
   * is precisely the signal the isolation case asserts.
   */
  represent?: boolean;
}

export class StateApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  /** The auth header every call carries. */
  private headers(options: WriteOptions = {}): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };
    if (options.represent) headers.Prefer = 'return=representation';
    return headers;
  }

  /** Read every row visible to this token. */
  async list(): Promise<APIResponse> {
    return this.request.get(`/rest/v1/${TABLE}`, {
      headers: this.headers(),
    });
  }

  /**
   * Read the row for one `user_id`.
   *
   * `maybeSingle` semantics — a 0-row result is an empty body, not
   * a 404 — so the caller distinguishes "not mine" from "not there".
   */
  async read(userId: string): Promise<APIResponse> {
    return this.request.get(`/rest/v1/${TABLE}`, {
      headers: this.headers(),
      params: { user_id: `eq.${userId}`, select: 'user_id,version,payload,updated_at' },
    });
  }

  /** Insert one row. */
  async insert(
    row: Omit<StateRow, 'updated_at'>,
    options: WriteOptions = {},
  ): Promise<APIResponse> {
    return this.request.post(`/rest/v1/${TABLE}`, {
      headers: this.headers(options),
      data: row,
    });
  }

  /** Upsert one row on the `user_id` conflict target. */
  async upsert(
    row: Omit<StateRow, 'updated_at'>,
    options: WriteOptions = {},
  ): Promise<APIResponse> {
    return this.request.post(`/rest/v1/${TABLE}`, {
      headers: this.headers(options),
      params: { on_conflict: 'user_id' },
      data: row,
    });
  }

  /** Update one row. */
  async update(
    userId: string,
    patch: Partial<StateRow>,
    options: WriteOptions = {},
  ): Promise<APIResponse> {
    return this.request.patch(`/rest/v1/${TABLE}`, {
      headers: this.headers(options),
      params: { user_id: `eq.${userId}` },
      data: patch,
    });
  }

  /** Delete one row. */
  async remove(
    userId: string,
    options: WriteOptions = {},
  ): Promise<APIResponse> {
    return this.request.delete(`/rest/v1/${TABLE}`, {
      headers: this.headers(options),
      params: { user_id: `eq.${userId}` },
    });
  }
}
