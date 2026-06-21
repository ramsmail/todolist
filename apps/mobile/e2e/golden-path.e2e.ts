import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

describe('Golden Path', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('shows the login screen on first launch', async () => {
    await detoxExpect(element(by.text('Sign in'))).toBeVisible();
  });

  it('logs in and reaches the Inbox tab', async () => {
    // Fill credentials — Detox uses testID for reliable element lookup
    await element(by.id('auth-email-input')).typeText('test@example.com');
    await element(by.id('auth-password-input')).typeText('testpassword123');
    await element(by.id('auth-signin-button')).tap();

    // Wait for navigation to Inbox
    await waitFor(element(by.text('Inbox')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('creates a task via QuickCaptureModal', async () => {
    // Tap the FAB
    await element(by.label('Add task')).tap();

    // Type in the modal input
    await element(by.id('quick-capture-input')).typeText('Buy groceries p2 tomorrow');

    // Tap Add task button
    await element(by.id('quick-capture-save')).tap();

    // Task should appear in the list
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
