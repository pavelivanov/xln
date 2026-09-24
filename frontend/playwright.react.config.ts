import { defineConfig, devices } from '@playwright/test';

import {
  CANDIDATE_BROWSER_READY_PATHS,
  CANDIDATE_BROWSER_VIEWPORTS,
  parseCandidateBrowserSurface,
} from './scripts/testing/test-react-candidate';

delete process.env['NO_COLOR'];

const host = process.env['PLAYWRIGHT_REACT_HOST'] ?? '127.0.0.1';
const gatewayPort = Number(process.env['PLAYWRIGHT_REACT_PORT'] ?? '19080');
const portOffset = Number(process.env['PLAYWRIGHT_REACT_PORT_OFFSET'] ?? '12000');
const baseURL = `http://${host}:${gatewayPort}`;
const selectedSurface = parseCandidateBrowserSurface(process.env['PLAYWRIGHT_REACT_SURFACE']);
const runScope = String(process.env['PLAYWRIGHT_REACT_RUN_SCOPE'] || '').trim();
if (runScope && !CANDIDATE_BROWSER_VIEWPORTS.some(({ name }) => name === runScope)) {
  throw new Error(`FRONTEND_BROWSER_RUN_SCOPE_INVALID:${runScope}`);
}
const runtimeFixtureEnabled = selectedSurface === null || selectedSurface === 'wallet' || selectedSurface === 'ops';
const fixturePort = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] ?? gatewayPort + 12);
if (!Number.isSafeInteger(fixturePort) || fixturePort < 1024 || fixturePort > 65531) {
  throw new Error('FRONTEND_BROWSER_FIXTURE_PORT_INVALID');
}
// Playwright workers and the web-server child must resolve the same fixture.
// An env override only inside webServer leaves helpers on the default port.
if (runtimeFixtureEnabled) process.env['XLN_REACT_WALLET_FIXTURE_PORT'] = String(fixturePort);
const evidenceScope = `${selectedSurface ?? 'candidate'}${runScope ? `-${runScope}` : ''}`;
const readinessPath = selectedSurface === null ? '/' : CANDIDATE_BROWSER_READY_PATHS[selectedSurface];

export default defineConfig({
  testDir: './tests/react-candidate',
  outputDir: `../output/playwright/react-${evidenceScope}/test-results`,
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  expect: { timeout: 15_000 },
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [
    ['line'],
    ['html', { open: 'never', outputFolder: `../output/playwright/react-${evidenceScope}/report` }],
  ],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: CANDIDATE_BROWSER_VIEWPORTS.map(({ name, viewport }) => ({
    name,
    use: {
      ...devices['Desktop Chrome'],
      viewport,
    },
  })),
  webServer: {
    command: `bun scripts/dev.ts ${selectedSurface === null ? '--all' : `--surface=${selectedSurface}`}`,
    url: `${baseURL}${readinessPath}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      XLN_REACT_GATEWAY_HOST: host,
      XLN_REACT_GATEWAY_PORT: String(gatewayPort),
      XLN_REACT_PORT_OFFSET: String(portOffset),
      ...(runtimeFixtureEnabled ? {
        XLN_REACT_WALLET_ADDRESS_FIXTURE: '1',
        XLN_REACT_WALLET_FIXTURE_PORT: String(fixturePort),
      } : {}),
    },
  },
});
