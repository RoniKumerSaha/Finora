/**
 * errors.ts — three-part error formatting (AD-11 + AD-19).
 *
 * PRD §11: every error is a three-part structure — what, why, fix.
 * Forms render these inline below the field. The role=alert banner uses
 * the same shape for async errors.
 *
 * zod issues are turned into {what, why, fix} via a small rule table.
 * Custom validation rules can be added when the data layer rejects a
 * value the zod schema didn't catch.
 */

import type { ZodError, ZodIssue } from 'zod';

export interface ThreePartError {
  what: string;
  why: string;
  fix: string;
}

/**
 * Turn a zod issue into a three-part error. The mapping is mostly
 * heuristic — zod gives us `path` and `message`, and we infer the rest
 * from the message content. This is the same shape as inline field
 * errors, so callers can use it uniformly.
 */
export function formatZodIssue(issue: ZodIssue): ThreePartError {
  const field = pathToField(issue.path);
  const msg = issue.message;

  // Heuristic: if the message already has a "Because..." or "Fix:..." we
  // could split it, but more often we synthesize the why/fix from the path.
  if (msg.includes('must be greater than zero')) {
    return {
      what: msg,
      why: 'Zero or negative values produce empty or invalid records.',
      fix: 'Enter a positive number, e.g. 1500.',
    };
  }
  if (msg.includes('must be between 0 and 100')) {
    return {
      what: msg,
      why: 'Rates above 100% are not realistic for the V1 simple-interest model.',
      fix: 'Enter a percentage in 0..100, e.g. 8 for 8%.',
    };
  }
  if (msg.includes('future')) {
    return {
      what: msg,
      why: 'Goals with past target dates have no time left to save.',
      fix: 'Pick a date in the future.',
    };
  }
  if (msg.toLowerCase().includes('required')) {
    return {
      what: msg,
      why: `${field} needs a value before this form can be saved.`,
      fix: `Fill in ${field}.`,
    };
  }
  if (msg.toLowerCase().includes('differ')) {
    return {
      what: msg,
      why: 'A transfer between the same account would be a no-op.',
      fix: 'Pick a different destination account.',
    };
  }
  // Fallback.
  return {
    what: msg,
    why: 'This value doesn\'t match what the form expects.',
    fix: 'Review the field and try again.',
  };
}

export function formatZodError(err: ZodError): Record<string, ThreePartError> {
  const out: Record<string, ThreePartError> = {};
  for (const issue of err.issues) {
    const field = pathToField(issue.path);
    if (!out[field]) out[field] = formatZodIssue(issue);
  }
  return out;
}

function pathToField(path: ReadonlyArray<string | number>): string {
  return path.map(String).join('.') || 'form';
}

/**
 * Build a banner-ready error from arbitrary thrown errors (e.g. the
 * data layer threw an Error). Uses the message as `what` and tries to
 * fill in `why`/`fix` heuristically.
 */
export function formatError(err: unknown): ThreePartError {
  if (err instanceof Error) {
    const msg = err.message || 'Something went wrong.';
    return {
      what: msg,
      why: 'The app rejected this action because the data didn\'t pass validation.',
      fix: 'Adjust the form values and try again.',
    };
  }
  return {
    what: 'Something went wrong.',
    why: 'The app caught an unexpected error.',
    fix: 'Try again. If it keeps happening, export your data and reload.',
  };
}

/**
 * Build a banner-ready error from a Supabase / sync-engine failure.
 * Recognises the common shapes thrown by `@supabase/supabase-js` and
 * the browser network stack so the user sees actionable advice rather
 * than a stack-trace summary.
 *
 * Categories:
 *   - Network failure (offline, DNS, fetch threw)
 *   - Auth failure (no session, expired token, OTP rejected)
 *   - RLS / permission denied (Supabase returns 401/403)
 *   - Server-side 5xx
 *   - Anything else → falls through to a generic "sync error" shape
 *     that names the underlying message.
 */
export function formatSyncError(err: unknown): ThreePartError {
  // Network: navigator reports offline, or the error looks like a
  // browser fetch failure.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      what: 'You appear to be offline.',
      why: 'Finora couldn\'t reach Supabase — your device has no internet connection right now.',
      fix: 'Reconnect to the internet. Your recent changes are queued and will sync automatically.',
    };
  }

  const name = (err as { name?: string } | null)?.name ?? '';
  const msg = (err as { message?: string } | null)?.message ?? '';
  const lower = msg.toLowerCase();
  const status = (err as { status?: number } | null)?.status;

  if (name === 'AuthRetryableFetchError' || lower.includes('fetch')) {
    return {
      what: 'Couldn\'t reach Supabase.',
      why: 'The sync request never completed — usually a flaky network or a Supabase outage.',
      fix: 'We\'ll retry automatically. If this keeps showing up, check your connection.',
    };
  }

  if (status === 401 || lower.includes('jwt') || lower.includes('invalid claim') || lower.includes('token')) {
    return {
      what: 'Your sign-in has expired.',
      why: 'The session token Supabase uses to authorise your account is no longer valid.',
      fix: 'Sign in again from Settings → Account.',
    };
  }

  if (status === 403 || lower.includes('row-level security') || lower.includes('permission denied')) {
    return {
      what: 'Supabase denied the sync request.',
      why: 'Your account no longer has permission to write to its cloud copy.',
      fix: 'Sign out and sign back in. If it persists, contact support.',
    };
  }

  if (status && status >= 500) {
    return {
      what: 'Supabase is having trouble.',
      why: `The server returned ${status}. This is on Supabase's side, not yours.`,
      fix: 'We\'ll keep retrying. If it persists, check status.supabase.com.',
    };
  }

  // Fallback — preserve the original message but don't blame the user.
  return {
    what: msg || 'Sync failed.',
    why: 'Finora tried to push your changes to the cloud and the request failed.',
    fix: 'We\'ll keep retrying in the background. Open Settings → Account to force a sync.',
  };
}