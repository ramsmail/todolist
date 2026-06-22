import { test, expect } from '@playwright/test';

const EMAIL    = process.env.E2E_EMAIL    ?? 'e2e@test.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'E2eTestPass123!';

test('offline: create task while disconnected, verify sync on reconnect', async ({ page, context }) => {
  // Login first
  await page.goto('/login');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/inbox', { timeout: 10_000 });

  // Wait for initial sync
  await page.waitForTimeout(3_000);

  // Go offline
  await context.setOffline(true);

  // Sidebar should show "Offline"
  await expect(page.getByText('Offline')).toBeVisible({ timeout: 8_000 });

  // Create task while offline
  await page.click('button[aria-label="Add task"]');
  await page.fill('input[placeholder="What needs to be done?"]', 'Offline task test');
  await page.click('button:has-text("Add task")');
  await expect(page.getByText('Offline task test')).toBeVisible({ timeout: 5_000 });

  // Reconnect
  await context.setOffline(false);

  // Sync indicator should return to synced
  await expect(page.getByText('Synced')).toBeVisible({ timeout: 15_000 });
});
