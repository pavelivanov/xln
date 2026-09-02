import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

test('hub-collapse executes and reconstructs the wallet preview', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  const rpcRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/rpc') rpcRequests.push(request.method()); });

  const response = await page.goto('/scenarios?scenario=hub-collapse', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  const player = page.getByTestId('scenario-player');
  await expect(player).toHaveAttribute('data-state', 'ready', { timeout: 90_000 });
  await expect(player).toHaveAttribute('data-scenario-id', 'hub-collapse');
  await expect(page.getByTestId('scenario-status')).toHaveText(/Hub collapse: [1-9]\d* frames/);

  const frameRange = page.getByTestId('scenario-frame-range');
  await frameRange.fill('0');
  const initialFrame = Number(await frameRange.inputValue());
  await page.getByTestId('scenario-play').click();
  await expect.poll(async () => Number(await frameRange.inputValue()), { timeout: 5_000 }).toBeGreaterThan(initialFrame);
  if (await page.getByTestId('scenario-pause').isVisible().catch(() => false)) await page.getByTestId('scenario-pause').click();
  const finalFrame = Number(await frameRange.getAttribute('max'));
  expect(finalFrame).toBeGreaterThan(0);
  await frameRange.fill(String(finalFrame));
  await expect(frameRange).toHaveValue(String(finalFrame));
  await expect(page.getByTestId('scenario-node').first()).toBeVisible();
  await expect(page.getByTestId('scenario-builder-inspect')).toContainText(`frame=${finalFrame + 1}/${finalFrame + 1}`);
  await screenshotEvidence(page, testInfo, 'ops-scenarios');

  await page.getByTestId('preview-in-wallet').click();
  await expect(page).toHaveURL(/\/app\?.*scenarioPreview=1/);
  await expect(page.getByTestId('scenario-preview-wallet-banner')).toHaveAttribute('data-state', 'ready', { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Hub collapse' })).toBeVisible();
  await screenshotEvidence(page, testInfo, 'wallet-scenario-preview');
  await expectPageContained(page);
  expect(rpcRequests).toEqual([]);
  expectNoBrowserErrors(errors);
});
