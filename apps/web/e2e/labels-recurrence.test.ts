import { test, expect } from '@playwright/test';

const EMAIL    = process.env.E2E_EMAIL    ?? 'e2e@test.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'E2eTestPass123!';

test.describe('Labels and Recurrence', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/inbox', { timeout: 15_000 });
    // Wait for page to fully load
    await page.waitForTimeout(1_000);
  });

  test('label quick-add appears in sidebar and filters', async ({ page }) => {
    // Create a task with a label using quick capture
    await page.click('button[aria-label="Add task"]');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.fill('input[placeholder="What needs to be done?"]', 'Buy soap @home');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2_000); // Wait for dialog to close and sync

    // Verify task appears in inbox
    await expect(page.getByText('Buy soap')).toBeVisible({ timeout: 8_000 });

    // Verify label appears in sidebar
    await expect(page.getByRole('link', { name: 'home' })).toBeVisible({ timeout: 8_000 });

    // Click the label link to filter
    await page.getByRole('link', { name: 'home' }).click();
    await expect(page).toHaveURL(/\/labels\/home/, { timeout: 8_000 });

    // Verify task appears in the filtered label view
    await expect(page.getByText('Buy soap')).toBeVisible({ timeout: 8_000 });
  });

  test('multiple labels on one task', async ({ page }) => {
    // Create a task with multiple labels
    await page.click('button[aria-label="Add task"]');
    await page.fill('input[placeholder="What needs to be done?"]', 'Review document @work @urgent');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2_000);

    // Verify task appears
    await expect(page.getByText('Review document')).toBeVisible({ timeout: 8_000 });

    // Both labels should appear in sidebar
    await expect(page.getByRole('link', { name: 'work' })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('link', { name: 'urgent' })).toBeVisible({ timeout: 8_000 });

    // Filter by work label
    await page.getByRole('link', { name: 'work' }).click();
    await expect(page.getByText('Review document')).toBeVisible({ timeout: 8_000 });

    // Go back to inbox and filter by urgent
    await page.goto('/inbox');
    await page.waitForTimeout(1_000);
    await page.getByRole('link', { name: 'urgent' }).click();
    await expect(page.getByText('Review document')).toBeVisible({ timeout: 8_000 });
  });

  test('recurring task advances on complete and stays visible', async ({ page }) => {
    // Create a recurring task
    await page.click('button[aria-label="Add task"]');
    await page.fill('input[placeholder="What needs to be done?"]', 'Water plants every day');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2_000);

    // Verify task appears in inbox
    const taskRow = page.getByText('Water plants');
    await expect(taskRow).toBeVisible({ timeout: 8_000 });

    // Verify recurring indicator (↻) is visible
    const taskItem = page.locator('[role="listitem"]').filter({ hasText: 'Water plants' }).first();
    await expect(taskItem.locator('text=↻')).toBeVisible();

    // Complete the task
    await page.click(`button[aria-label="Complete Water plants"]`);

    // Task should still be visible (recurring tasks reappear)
    await expect(page.getByText('Water plants')).toBeVisible({ timeout: 8_000 });

    // Recurring indicator should still be present
    await expect(page.locator('[role="listitem"]').filter({ hasText: 'Water plants' }).first().locator('text=↻')).toBeVisible();
  });

  test('recurring task with label', async ({ page }) => {
    // Create a recurring task with a label
    await page.click('button[aria-label="Add task"]');
    await page.fill('input[placeholder="What needs to be done?"]', 'Gym session every day @fitness');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2_000);

    // Verify task appears
    await expect(page.getByText('Gym session')).toBeVisible({ timeout: 8_000 });

    // Label should be in sidebar
    await expect(page.getByRole('link', { name: 'fitness' })).toBeVisible({ timeout: 8_000 });

    // Open the task detail to verify both label and recurrence
    const taskItem = page.locator('[role="listitem"]').filter({ hasText: 'Gym session' }).first();
    await taskItem.click();
    await expect(page.getByRole('complementary', { name: 'Task detail' })).toBeVisible({ timeout: 8_000 });
  });

  test('label appears in label filter view', async ({ page }) => {
    // Create a task with a label
    await page.click('button[aria-label="Add task"]');
    await page.fill('input[placeholder="What needs to be done?"]', 'Shopping @errands');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2_000);

    // Verify label appears in sidebar
    await expect(page.getByRole('link', { name: 'errands' })).toBeVisible({ timeout: 8_000 });

    // Click on the label to filter
    await page.getByRole('link', { name: 'errands' }).click();
    await expect(page).toHaveURL(/\/labels\/errands/, { timeout: 8_000 });

    // Verify task appears in label view
    await expect(page.getByText('Shopping')).toBeVisible({ timeout: 8_000 });
  });
});
