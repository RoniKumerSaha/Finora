/**
 * Feedback — the app's two transient channels.
 *
 * - **Toast** — `role="status"`, mounted top-right by the Shell.
 *   Success/info dwell 1.5 s, errors 4 s. Renders `what` + `why`
 *   only — never `fix`. Has no dismiss button.
 * - **Banner** — `role="alert"`, the sticky three-part error surface
 *   (what / why / fix). Success 3 s, error 6 s. Has a **"Dismiss"**
 *   button.
 *
 * ⚠️ The Home onboarding banner's dismiss button is labelled
 * **"Dismiss banner"**, which substring-matches `"Dismiss"`. Always
 * pass `exact: true` when looking for the banner's own dismiss button.
 *
 * ⚠️ Toasts are too short-lived to assert after a navigation. Assert
 * the post-navigation state instead — the transaction form navigates
 * 600 ms after saving, which is *before* a 1.5 s toast expires.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export class Feedback {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** The toast surface. */
  get toast(): Locator {
    return this.page.getByRole('status');
  }

  /** The toast's headline (the `what` line). */
  get toastTitle(): Locator {
    return this.toast.locator('div.text-\\[13px\\]');
  }

  /** The toast's detail (the `why` line). */
  get toastBody(): Locator {
    return this.toast.locator('div.text-\\[12px\\]');
  }

  /** The sticky banner surface. */
  get banner(): Locator {
    return this.page.getByRole('alert');
  }

  /**
   * The banner's headline (the `what` line).
   *
   * `RoleAlertBanner` renders the three parts as sibling divs: the
   * `what` line is `font-semibold text-[14px]`, the `why` line is
   * `text-muted`, and the `fix` line is `text-ink`.
   */
  get bannerTitle(): Locator {
    return this.banner.locator('div.font-semibold.text-\\[14px\\]');
  }

  /** The banner's detail (the `why` line). */
  get bannerBody(): Locator {
    return this.banner.locator('div.text-\\[12\\.5px\\].text-muted');
  }

  /** The banner's remedy (the `fix` line). */
  get bannerFix(): Locator {
    return this.banner.locator('div.text-\\[12\\.5px\\].text-ink');
  }

  /** The banner's dismiss button. `exact` matters — see the class note. */
  get dismissButton(): Locator {
    return this.page.getByRole('button', { name: 'Dismiss', exact: true });
  }

  /**
   * Read the banner's three parts in ONE atomic DOM read.
   *
   * The banner unmounts 3000 ms (info/success) or 6000 ms (error) after
   * it is raised, and it starts fading 400 ms before that. Reading the
   * three parts with three separate `textContent()` calls can therefore
   * lose the banner part-way through — the third call finds nothing.
   *
   * One `evaluate` returns all three strings from a single snapshot of
   * the element, so the read is all-or-nothing. If the banner unmounts
   * between the wait and the read, the read is retried against the next
   * banner rather than throwing.
   *
   * ⚠️ This method WAITS for the banner itself — it does not need a
   * preceding `waitForBanner()`. Callers that used to do
   * `waitForBanner()` then `readBanner()` in two steps had a race: the
   * banner can expire before the wait even starts, and the wait then
   * throws a bare "element(s) not found". Reading directly is safe
   * because the poll below keeps retrying until the banner shows up.
   */
  async readBanner(options: { title?: string } = {}): Promise<{
    title: string;
    body: string;
    fix: string;
  }> {
    const banner = this.banner;
    let read: { title: string; body: string; fix: string } | null = null;

    await expect
      .poll(
        async () => {
          if ((await banner.count()) === 0) return false;
          try {
            read = await banner.evaluate(el => {
              const children = Array.from(el.children) as HTMLElement[];
              const text = (node: HTMLElement | undefined) =>
                (node?.textContent ?? '').trim();
              const has = (node: HTMLElement, cls: string) =>
                node.className.includes(cls);
              return {
                // The title is the only `font-semibold` child.
                title: text(children.find(c => has(c, 'font-semibold'))),
                // The body is the only `text-muted` child.
                body: text(children.find(c => has(c, 'text-muted'))),
                // The fix is the `text-ink` child that is NOT the title —
                // the title also carries `text-ink` for an info banner.
                fix: text(
                  children.find(c => has(c, 'text-ink') && !has(c, 'font-semibold')),
                ),
              };
            });
          } catch {
            // The banner unmounted mid-read — retry against the next one.
            read = null;
            return false;
          }
          // When a title is expected, keep polling until the banner
          // on screen IS that banner — a leftover from an earlier step
          // must not satisfy the read.
          if (options.title !== undefined && read.title !== options.title) {
            read = null;
            return false;
          }
          return true;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    if (!read) {
      throw new Error(
        `Timed out reading the banner${
          options.title ? ` titled "${options.title}"` : ''
        }`,
      );
    }
    return read;
  }

  /** Assert-free waiter for a toast to appear. */
  async waitForToast(): Promise<void> {
    await this.toast.waitFor({ state: 'visible' });
  }

  /**
   * Assert that the banner contains `text`, retrying until it does.
   *
   * This is the race-free way to assert banner CONTENT. The banner
   * lives 3 s (success) or 6 s (error) and can expire before a
   * separate `waitForBanner()` + `toContainText()` pair gets to it.
   * Polling on the content instead of on mere presence means the
   * assertion succeeds whenever the banner is on screen at any point
   * within the timeout — and fails with a clear content diff when it
   * never appears.
   */
  async expectBannerText(text: string, options: { timeout?: number } = {}): Promise<void> {
    await expect(this.banner).toContainText(text, {
      timeout: options.timeout ?? 10_000,
    });
  }

  /**
   * Assert-free waiter for a banner to appear.
   *
   * ⚠️ Prefer `readBanner()` where the banner's TEXT is what matters.
   * This only waits for the element; the banner can still expire
   * before a later assertion runs, which is the race that
   * `readBanner()`'s built-in poll avoids.
   */
  async waitForBanner(): Promise<void> {
    await this.banner.waitFor({ state: 'visible' });
  }
}
