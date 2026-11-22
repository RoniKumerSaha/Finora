/**
 * unique-email.ts — a per-run email address.
 *
 * Sign-up is ONE-SHOT: a second attempt with the same address
 * returns "User already registered", which would make a suite pass on
 * a fresh database and fail on the next run. So the local part of
 * the address carries a per-run suffix.
 *
 * The domain, the display name and the password still come from the
 * JSON store — only the address is made unique.
 *
 * Shared by the API suite (`test/e2e/api_tests/`) and the cloud UI
 * suite (`test/e2e/ui_tests/cloud.spec.ts`), because both create
 * accounts against the same backend.
 */

/**
 * A unique address derived from a template.
 *
 * `user@example.com` → `user-1793695518751-wgf1w0@example.com`.
 *
 * Throws when the template is not an address — a typo in the env
 * var would otherwise produce a nonsense address and a confusing
 * "invalid email" error from the server.
 */
export function uniqueEmail(template: string): string {
  const [local, domain] = template.split('@');
  if (!local || !domain) throw new Error(`Not an email address: "${template}"`);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${local}-${stamp}@${domain}`;
}
