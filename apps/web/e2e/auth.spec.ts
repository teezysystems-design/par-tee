import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('unauthenticated user sees sign-in page when visiting dashboard', async ({ page }) => {
    // Mock Supabase session as null (unauthenticated)
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) })
    );
    await page.goto('/dashboard');
    // Expect redirect to sign-in or auth page
    await expect(page).toHaveURL(/sign-in|login|auth/);
  });

  test('sign-in page is accessible', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: /sign in|log in|welcome/i })).toBeVisible();
  });

  test('onboarding page is accessible', async ({ page }) => {
    await page.goto('/onboarding');
    // Should show the onboarding form or redirect
    const heading = page.getByRole('heading');
    await expect(heading.first()).toBeVisible();
  });
});
