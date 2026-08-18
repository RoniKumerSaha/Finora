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
 * Map a GdriveError (or any thrown Error) from the Drive REST layer into
 * the same three-part shape that the banner consumes.
 *
 * The error codes are part of the public taxonomy — see
 * src/lib/googleDrive.ts. The UI only knows about {what, why, fix}.
 */
export function formatGdriveError(err: unknown): ThreePartError {
  // Non-GdriveError falls through to the generic message.
  const code = (err as { code?: string })?.code as string | undefined;
  const msg = err instanceof Error ? err.message : 'Google Drive request failed.';
  switch (code) {
    case 'auth_expired':
      return {
        what: 'Disconnected from Google Drive',
        why: 'Your sign-in expired or was revoked.',
        fix: 'Tap Connect Google Drive again to re-authorize.',
      };
    case 'forbidden':
      return {
        what: 'Google Drive denied the request',
        why: msg || 'Your account doesn\'t have permission to write to this folder.',
        fix: 'Sign in with a Google account that has Drive access.',
      };
    case 'not_found':
      return {
        what: 'Couldn\'t find the backup',
        why: 'The Drive file may have been deleted or moved out of the Finora backups folder.',
        fix: 'List backups again, or save a fresh backup.',
      };
    case 'rate_limited':
      return {
        what: 'Google Drive is throttling',
        why: 'Too many requests in a short window.',
        fix: 'Wait a minute, then try again.',
      };
    case 'network':
      return {
        what: 'Couldn\'t reach Google Drive',
        why: 'Your device is offline or the request timed out.',
        fix: 'Check your connection and try again.',
      };
    case 'parse':
      return {
        what: 'Couldn\'t read the backup',
        why: 'The file in Drive isn\'t a valid Finora backup.',
        fix: 'Pick a different backup, or save a fresh one.',
      };
    default:
      return {
        what: msg || 'Google Drive request failed.',
        why: 'The Drive API returned an unexpected error.',
        fix: 'Try again. If it keeps happening, reconnect Google Drive.',
      };
  }
}