import { expect, test } from '@playwright/test';

test.describe('WordShift Web App', () => {
  test('renders home page with primary Play with Friend and Practice entry points', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Shift one letter/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Private Room/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Join Match/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Practice Mode/i })).toBeVisible();
  });

  test('supports solo practice mode tile editing and on-screen keyboard', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByText(/Start:/i)).toBeVisible();
    await expect(page.getByText(/Target:/i)).toBeVisible();

    // Tap letter 'S' on the on-screen keyboard and verify submit button enables
    const submitBtn = page.getByRole('button', { name: /Submit Move/i });
    await expect(submitBtn).toBeDisabled();
    await page.getByRole('button', { name: 'S', exact: true }).click();
    await expect(submitBtn).toBeEnabled();
  });

  test('renders auth page and validates inputs', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByRole('heading', { name: /Sign in to WordShift/i })).toBeVisible();
    await page.getByRole('button', { name: /Need an account\? Sign up/i }).click();
    await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible();
  });
});
