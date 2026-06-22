import { test, expect } from '@playwright/test';

const EMAIL    = process.env.E2E_EMAIL    ?? 'e2e@test.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'E2eTestPass123!';

test.describe('Golden path', () => {
  test('login → quick capture → complete task', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/inbox', { timeout: 10_000 });

    // Quick capture
    await page.click('button[aria-label="Add task"]');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.fill('input[placeholder="What needs to be done?"]', 'E2E golden path task p2');
    await page.click('button:has-text("Add task")');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Task appears in list
    await expect(page.getByText('E2E golden path task')).toBeVisible({ timeout: 8_000 });

    // Open task detail
    await page.click(`button[aria-label="Open task: E2E golden path task"]`);
    await expect(page.getByRole('complementary', { name: 'Task detail' })).toBeVisible();
    await expect(page.getByText('P2')).toBeVisible();

    // Complete the task
    await page.keyboard.press('Escape');
    await page.click(`button[aria-label="Complete E2E golden path task"]`);
    await expect(page.getByText('E2E golden path task')).not.toBeVisible({ timeout: 5_000 });
  });

  test('sign out and redirect to login', async ({ page }) => {
    await page.goto('/inbox');
    await page.click('button:has-text("Sign out")');
    await expect(page).toHaveURL('/login', { timeout: 5_000 });
  });
});
