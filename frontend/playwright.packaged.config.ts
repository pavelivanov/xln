import { defineConfig } from '@playwright/test';

delete process.env['NO_COLOR'];
if (!process.env['PLAYWRIGHT_PACKAGED_DIRECTORY']) throw new Error('PACKAGED_BROWSER_DIRECTORY_REQUIRED');
if (!process.env['PLAYWRIGHT_STAGING_DIRECTORY']) throw new Error('PACKAGED_BROWSER_STAGING_REQUIRED');

export default defineConfig({
  testDir: './tests/packaged-candidate',
  outputDir: '../output/playwright/packaged-candidate/test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  workers: 1,
  retries: 0,
  projects: [
    { name: 'mobile-390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: 'laptop-1366x900', use: { viewport: { width: 1366, height: 900 } } },
    { name: 'wide-1920x1080', use: { viewport: { width: 1920, height: 1080 } } },
  ],
  reporter: [['line'], ['html', { open: 'never', outputFolder: '../output/playwright/packaged-candidate/report' }]],
});
