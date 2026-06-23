import { test, expect } from '@playwright/test';

const EMAIL    = process.env.E2E_EMAIL    ?? 'e2e@test.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'E2eTestPass123!';

test.describe('Saved Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/inbox', { timeout: 15_000 });
    await page.waitForTimeout(1_000);
  });

  test('create a filter and navigate to it via sidebar', async ({ page }) => {
    // Click "New filter" in the sidebar
    await page.click('button:has-text("New filter")');
    await expect(page.getByRole('dialog', { name: 'New filter' })).toBeVisible();

    // Fill in name and select P2 priority
    await page.fill('input[aria-label="Filter name"]', 'High prio this week');
    await page.click('button:has-text("P2")');

    // Select "This week" due date
    await page.selectOption('select', 'this_week');

    // Save
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1_000);

    // Filter appears in sidebar
    await expect(page.getByRole('link', { name: 'High prio this week' })).toBeVisible({ timeout: 8_000 });

    // Navigate to filter view
    await page.getByRole('link', { name: 'High prio this week' }).click();
    await expect(page).toHaveURL(/\/filters\//, { timeout: 8_000 });
    await expect(page.getByText('High prio this week')).toBeVisible();
  });
});

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/inbox', { timeout: 15_000 });
    await page.waitForTimeout(1_000);
  });

  test('q opens Quick Capture modal', async ({ page }) => {
    await page.keyboard.press('q');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 4_000 });
    await expect(page.getByPlaceholderText('What needs to be done?')).toBeVisible();
  });

  test('g t navigates to Today', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await expect(page).toHaveURL('/today', { timeout: 4_000 });
  });

  test('? opens the shortcuts overlay', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible({ timeout: 4_000 });
    await expect(page.getByText('Navigation')).toBeVisible();
  });

  test('Escape closes the shortcuts overlay', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeVisible({ timeout: 2_000 });
  });
});
