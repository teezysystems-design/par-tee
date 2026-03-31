import { test, expect } from '@playwright/test';

test('landing page loads and shows hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /book golf by mood/i })).toBeVisible();
});

test('waitlist form shows success state', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/waitlist', route => route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }));
  await page.getByPlaceholder(/your email/i).fill('test@example.com');
  await page.getByRole('button', { name: /join waitlist/i }).click();
  await expect(page.getByText(/you're on the list/i)).toBeVisible();
});
