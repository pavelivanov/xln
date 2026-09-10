import { expect, test, type Page } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

const openCatalog = async (page: Page): Promise<void> => {
  const toggle = page.getByTestId('docs-nav-toggle');
  const search = page.getByTestId('docs-search');
  if (await toggle.isVisible()) await toggle.click();
  await expect(search).toBeInViewport();
};

const expectDocument = async (page: Page, title: string | RegExp): Promise<void> => {
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
  await expect(page.getByTestId('docs-article')).toBeVisible();
};

test('docs candidate renders without browser errors', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/docs', { waitUntil: 'networkidle' });
  expect(response?.ok(), 'document response for /docs').toBe(true);
  await expect(page.getByTestId('docs-article')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'docs');
  expectNoBrowserErrors(errors);
});

test('docs search selects a real catalog document', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await page.goto('/docs', { waitUntil: 'networkidle' });
  await expectDocument(page, 'xln documentation');
  await openCatalog(page);
  await page.getByTestId('docs-search').fill('universal signature system');
  const result = page.getByTestId('doc-link-architecture-hanko');
  await expect(result).toBeInViewport();
  await screenshotEvidence(page, testInfo, 'docs-search-results');
  await result.click();
  await expect(page).toHaveURL(/\/docs\?doc=architecture%2Fhanko$/);
  await expectDocument(page, "hanko: xln's universal signature system");
  await screenshotEvidence(page, testInfo, 'docs-search-selection');
  expectNoBrowserErrors(errors);
});

test(
  'docs direct links, anchors, Back and Forward preserve selection',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    const errors = observeBrowserErrors(page);
    await page.goto('/docs?doc=architecture%2Fhanko#overview', { waitUntil: 'networkidle' });
    await expectDocument(page, "hanko: xln's universal signature system");
    await expect(page.locator('#overview')).toBeInViewport();
    await openCatalog(page);
    await page.getByRole('button', { name: /^New to xln / }).click();
    await expect(page).toHaveURL(/\/docs\?doc=readme$/);
    await expectDocument(page, 'xln documentation');
    await page.goBack();
    await expect(page).toHaveURL(/\/docs\?doc=architecture%2Fhanko#overview$/);
    await expectDocument(page, "hanko: xln's universal signature system");
    await page.goForward();
    await expect(page).toHaveURL(/\/docs\?doc=readme$/);
    await expectDocument(page, 'xln documentation');
    await screenshotEvidence(page, testInfo, 'docs-history');
    expectNoBrowserErrors(errors);
  },
);

test('docs catalog errors remain visible and retryable', { tag: '@resilience' }, async ({ page }) => {
  let unavailable = true;
  let attempts = 0;
  await page.route('**/docs-catalog/manifest.json', async route => {
    attempts += 1;
    if (unavailable) await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    else await route.continue();
  });
  await page.goto('/docs', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('docs-error')).toContainText(
    'Failed to load docs catalog: manifest request failed: 503',
  );
  unavailable = false;
  await page.getByRole('button', { name: /Retry request/ }).click();
  await expectDocument(page, 'xln documentation');
  expect(attempts).toBeGreaterThanOrEqual(2);
});

test('docs document errors remain visible and retryable', { tag: '@resilience' }, async ({ page }) => {
  let attempts = 0;
  await page.route('**/docs-catalog/readme.md', async route => {
    attempts += 1;
    if (attempts === 1) await route.fulfill({ status: 503, contentType: 'text/plain', body: 'unavailable' });
    else await route.continue();
  });
  await page.goto('/docs', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('docs-error')).toContainText('Failed to load document: document request failed: 503');
  await page.getByRole('button', { name: /Retry request/ }).click();
  await expectDocument(page, 'xln documentation');
  expect(attempts).toBe(2);
});
