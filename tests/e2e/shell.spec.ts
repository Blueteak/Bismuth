import { expect, test } from '@playwright/test';

test('shows the loading shell without requiring a GPU', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Preparing the visualizer' }),
  ).toBeVisible();
  await expect(page.getByLabel('Bismuth crystal visualizer')).toBeVisible();
});

test('shows an injected unsupported state without probing a GPU', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (
      window as Window & {
        __BISMUTH_CAPABILITY_STATE__?: {
          status: 'unsupported';
          reason: string;
        };
      }
    ).__BISMUTH_CAPABILITY_STATE__ = {
      status: 'unsupported',
      reason: 'No compatible hardware WebGPU adapter was found.',
    };
  });
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'WebGPU is required' }),
  ).toBeVisible();
  await expect(
    page.getByText('No compatible hardware WebGPU adapter was found.'),
  ).toBeVisible();
});
