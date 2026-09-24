import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

delete process.env['NO_COLOR'];
if (!process.env['PLAYWRIGHT_PACKAGED_DIRECTORY']) throw new Error('PACKAGED_BROWSER_DIRECTORY_REQUIRED');
if (!process.env['PLAYWRIGHT_STAGING_DIRECTORY']) throw new Error('PACKAGED_BROWSER_STAGING_REQUIRED');

export default defineConfig({
  testDir: fileURLToPath(new URL('../../tests/packaged-candidate', import.meta.url)),
  outputDir: fileURLToPath(new URL('../../../output/playwright/packaged-candidate/test-results', import.meta.url)),
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  workers: 1,
  retries: 0,
  projects: [
    { name: 'mobile-390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: 'laptop-1366x900', use: { viewport: { width: 1366, height: 900 } } },
    { name: 'wide-1920x1080', use: { viewport: { width: 1920, height: 1080 } } },
  ],
  reporter: [[
    'line',
  ], [
    'html',
    { open: 'never', outputFolder: fileURLToPath(new URL('../../../output/playwright/packaged-candidate/report', import.meta.url)) },
  ]],
});
