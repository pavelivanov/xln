import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

test('docs candidate renders without browser errors', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/docs', { waitUntil: 'networkidle' });
  expect(response?.ok(), 'document response for /docs').toBe(true);
  await expect(page.getByTestId('docs-article')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'docs');
  expectNoBrowserErrors(errors);
});
