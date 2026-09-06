import { expect, type Page, type TestInfo } from '@playwright/test';

export type BrowserErrors = Readonly<{
  consoleErrors: string[];
  pageErrors: string[];
}>;

// Seed same-origin storage before starting an application. The public embed
// now owns a real Runtime/layout lifecycle, so it is not a setup document.
export const openWorkspaceStorageOrigin = async (page: Page): Promise<void> => {
  const response = await page.goto('/scenarios/catalog.json');
  expect(response?.ok()).toBe(true);
  expect(response?.headers()['content-type']).toContain('application/json');
};

export const observeBrowserErrors = (page: Page): BrowserErrors => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
};

export const expectNoBrowserErrors = (errors: BrowserErrors): void => {
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
};

export const expectOnlyProxyFailures = (errors: BrowserErrors): void => {
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors.length).toBeGreaterThan(0);
  for (const error of errors.consoleErrors) expect(error).toContain('status of 502');
};

export const expectPageContained = async (page: Page): Promise<void> => {
  await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
};

export const screenshotEvidence = async (
  page: Page,
  testInfo: TestInfo,
  surfaceId: string,
): Promise<Buffer> => {
  const path = testInfo.outputPath(`${surfaceId}.png`);
  const screenshot = await page.screenshot({ animations: 'disabled', fullPage: true, path });
  await testInfo.attach(`${surfaceId}-${testInfo.project.name}`, { contentType: 'image/png', path });
  return screenshot;
};
