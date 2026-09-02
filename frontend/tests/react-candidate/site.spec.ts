import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

test('site candidate renders without browser errors', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/', { waitUntil: 'networkidle' });
  expect(response?.ok(), 'document response for /').toBe(true);
  await expect(page.getByRole('heading', { name: /Money moves point to point/i })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'site');
  expectNoBrowserErrors(errors);
});
