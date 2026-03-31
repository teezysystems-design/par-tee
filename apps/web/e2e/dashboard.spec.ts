import { test, expect } from '@playwright/test';

test('dashboard overview loads', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /course dashboard/i })).toBeVisible();
});

test('availability page has add slot button', async ({ page }) => {
  await page.goto('/dashboard/availability');
  await expect(page.getByRole('button', { name: /add slot/i })).toBeVisible();
});
