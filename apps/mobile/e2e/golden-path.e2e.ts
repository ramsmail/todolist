import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

/**
 * Golden path — tests run sequentially and share state intentionally:
 *   1. Verify login screen (unauthenticated cold launch)
 *   2. Log in — auth token persisted via expo-secure-store
 *   3. Create a task (depends on being logged in from test 2)
 *   4. Swipe-complete the task (depends on task created in test 3)
 *
 * Do NOT add beforeEach reloadReactNative — that would reset JS state and
 * require async auth rehydration before each test, causing intermittent failures.
 */
describe('Golden Path', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows the login screen on first launch', async () => {
    await detoxExpect(element(by.id('auth-signin-button'))).toBeVisible();
  });

  it('logs in and reaches the Inbox tab', async () => {
    await element(by.id('auth-email-input')).typeText('test@example.com');
    await element(by.id('auth-password-input')).typeText('testpassword123');
    await element(by.id('auth-signin-button')).tap();

    await waitFor(element(by.text('Inbox')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('creates a task via QuickCaptureModal', async () => {
    // Ensure Inbox is visible before interacting (auth rehydration guard)
    await waitFor(element(by.text('Inbox')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.label('Add task')).tap();
    await element(by.id('quick-capture-input')).typeText('Buy groceries p2 tomorrow');
    await element(by.id('quick-capture-save')).tap();

    await waitFor(element(by.text('Buy groceries')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('swipe-to-complete removes a task from inbox', async () => {
    await waitFor(element(by.text('Buy groceries')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Buy groceries')).swipe('left', 'fast', 0.8);

    await waitFor(element(by.text('Buy groceries')))
      .not.toBeVisible()
      .withTimeout(5000);
  });
});
