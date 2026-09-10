import { defineConfig, devices } from '@playwright/test';

delete process.env['NO_COLOR'];
const directory = process.env['XLN_REACT_ARTIFACT_DIRECTORY'];
if (!directory) throw new Error('ARTIFACT_BROWSER_DIRECTORY_REQUIRED');
const port = Number(process.env['PLAYWRIGHT_ARTIFACT_PORT'] ?? '19180');
const fixturePort = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] ?? port + 12);
process.env['XLN_REACT_WALLET_FIXTURE_PORT'] = String(fixturePort);
const baseURL = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  XLN_REACT_GATEWAY_PORT: String(port),
  XLN_REACT_WALLET_FIXTURE_PORT: String(fixturePort),
};

export default defineConfig({
  testDir: './tests/artifact-candidate',
  outputDir: '../output/playwright/artifact-candidate/test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  workers: 1,
  reporter: [['line'], ['html', { open: 'never', outputFolder: '../output/playwright/artifact-candidate/report' }]],
  use: { baseURL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile-390x844', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'laptop-1366x900', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'wide-1920x1080', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: [
    {
      command: 'bun tests/react-candidate/wallet/fixtures/wallet-runtime-fixture.ts',
      url: `http://127.0.0.1:${fixturePort}/info`,
      reuseExistingServer: false,
      timeout: 120_000,
      env,
    },
    // Match the existing Node gateway transport. Only this test server is bundled;
    // the explicit release directory is verified and never compiled or rewritten.
    {
      command:
        'bun build scripts/release/artifact-browser-server.ts --target=node --outfile .artifacts/tooling/artifact-browser-server.mjs && node .artifacts/tooling/artifact-browser-server.mjs',
      url: `${baseURL}/__xln-artifact/identity`,
      reuseExistingServer: false,
      timeout: 30_000,
      env,
    },
  ],
});
