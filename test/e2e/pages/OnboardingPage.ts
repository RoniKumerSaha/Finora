/**
 * OnboardingPage — the first-run welcome screen (`/onboarding`).
 *
 * `src/screens/OnboardingScreen.tsx` is a single column:
 *   - the display heading "Welcome to Finora.";
 *   - the "all local, all yours" blurb;
 *   - a three-step ordered list (① create an account · ② log a
 *     transaction · ③ add a goal, debt, or investment);
 *   - the "Get started" CTA, which completes onboarding and routes
 *     to Home.
 */
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class OnboardingPage extends BasePage {
  /** The welcome heading. */
  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Welcome to Finora.' });
  }

  /** The welcome blurb. */
  get intro(): Locator {
    return this.page.getByText(/Track your money, save toward goals, manage debts and investments/);
  }

  /** The three onboarding steps. */
  get steps(): Locator {
    return this.page.getByRole('listitem');
  }

  /** The "Get started" CTA. */
  get getStartedButton(): Locator {
    return this.page.getByRole('button', { name: 'Get started' });
  }

  // ── navigation ──

  async goto(): Promise<void> {
    await this.gotoRoute('/onboarding');
    await this.waitForAppReady();
  }

  /** Accept the welcome and land on Home. */
  async accept(): Promise<void> {
    await this.getStartedButton.click();
    await this.page.waitForURL(/#\/home/);
  }
}
