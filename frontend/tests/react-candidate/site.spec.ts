import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

test('site candidate renders without browser errors', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/', { waitUntil: 'networkidle' });
  expect(response?.ok(), 'document response for /').toBe(true);
  await expect(page.getByRole('heading', { name: /Money moves point to point/i })).toBeVisible();
  const launch = page.getByRole('banner').getByRole('link', { name: 'Launch', exact: true });
  const [launchBox, arrowBox] = await Promise.all([
    launch.boundingBox(),
    launch.locator('.site-arrow').boundingBox(),
  ]);
  if (!launchBox || !arrowBox) throw new Error('SITE_HEADER_LAUNCH_GEOMETRY_MISSING');
  const launchCenter = launchBox.y + launchBox.height / 2;
  const arrowCenter = arrowBox.y + arrowBox.height / 2;
  expect(Math.abs(launchCenter - arrowCenter), 'header Launch arrow vertical offset').toBeLessThanOrEqual(.5);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'site');
  expectNoBrowserErrors(errors);
});
