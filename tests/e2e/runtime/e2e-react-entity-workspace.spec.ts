import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Page, type TestInfo } from '../../global-setup.mts';
import { API_BASE_URL, ensureE2EBaseline } from '../../utils/e2e-baseline';
import {
  RUNTIME_ADAPTER_ACCESS_KEY,
  RUNTIME_ADAPTER_AUTH_KEY,
  RUNTIME_ADAPTER_MODE_KEY,
  RUNTIME_ADAPTER_WS_KEY,
} from '../../../frontend/packages/browser/src/runtime-adapter-session';
import { DISPLAY_PREFERENCES_STORAGE_KEY } from '../../../frontend/packages/browser/src/display-preferences';
import { capturePageScreenshot } from '../../utils/e2e-screenshots';

type RuntimeImportCapability = Readonly<{
  access: 'admin';
  label: string;
  token: string;
  wsUrl: string;
}>;

type CandidateServer = Readonly<{
  baseUrl: string;
  cacheRoot: string;
  process: ChildProcess;
}>;

const VIEWPORTS = [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'laptop-1366x900', width: 1366, height: 900 },
  { name: 'wide-1920x1080', width: 1920, height: 1080 },
] as const;

const getFreePort = async (): Promise<number> => await new Promise((resolve, reject) => {
  const server = createServer();
  server.unref();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      reject(new Error('REACT_ENTITY_WORKSPACE_PORT_MISSING'));
      return;
    }
    server.close(error => error ? reject(error) : resolve(address.port));
  });
});

const waitForCandidate = async (
  baseUrl: string,
  process: ChildProcess,
  readOutput: () => string,
): Promise<void> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null || process.signalCode !== null) {
      throw new Error(
        `REACT_ENTITY_WORKSPACE_VITE_EXITED:${String(process.exitCode)}:${String(process.signalCode)}:${readOutput()}`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}/__app/ops/entity-workspace`);
      if (response.ok) return;
    } catch {
      // The process is still booting; the deadline below remains authoritative.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`REACT_ENTITY_WORKSPACE_VITE_TIMEOUT:${baseUrl}:${readOutput()}`);
};

const stopChildProcess = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    let timeout: ReturnType<typeof setTimeout>;
    const onExit = (): void => {
      clearTimeout(timeout);
      resolve();
    };
    child.once('close', onExit);
    child.kill('SIGTERM');
    timeout = setTimeout(() => { child.kill('SIGKILL'); }, 5_000);
  });
};

const startCandidateServer = async (): Promise<CandidateServer> => {
  const port = await getFreePort();
  const cacheRoot = await mkdtemp(join(tmpdir(), 'xln-react-entity-workspace-'));
  const child = spawn('bunx', ['vite', '--config', 'apps/ops/vite.config.ts'], {
    cwd: `${process.cwd()}/frontend`,
    env: {
      ...process.env,
      XLN_REACT_PORT_OFFSET: String(port - 8085),
      XLN_REACT_VITE_CACHE_ROOT: cacheRoot,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const appendOutput = (chunk: unknown): void => {
    output = `${output}${String(chunk)}`.slice(-4_000);
  };
  child.stdout?.on('data', appendOutput);
  child.stderr?.on('data', appendOutput);
  child.once('error', appendOutput);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForCandidate(baseUrl, child, () => output.trim());
  } catch (error) {
    await stopChildProcess(child);
    await rm(cacheRoot, { recursive: true, force: true });
    throw error;
  }
  return { baseUrl, cacheRoot, process: child };
};

const stopCandidateServer = async (server: CandidateServer | null): Promise<void> => {
  if (!server) return;
  await stopChildProcess(server.process);
  await rm(server.cacheRoot, { recursive: true, force: true });
};

const readH1Capability = async (page: Page): Promise<RuntimeImportCapability> => {
  const deadline = Date.now() + 60_000;
  let detail = 'not queried';
  while (Date.now() < deadline) {
    try {
      const response = await page.request.get(`${API_BASE_URL}/api/runtime-import?access=admin`, {
        headers: { 'Cache-Control': 'no-store' },
        timeout: 5_000,
      });
      const payload = await response.json() as {
        ready?: boolean;
        manifest?: { entries?: RuntimeImportCapability[] };
        entries?: RuntimeImportCapability[];
      };
      const entries = payload.manifest?.entries ?? payload.entries ?? [];
      const capability = entries.find(entry => entry.label.trim().toLowerCase() === 'h1');
      if (response.ok() && payload.ready !== false && capability) {
        expect(capability.access).toBe('admin');
        expect(capability.token).toMatch(/^xlnra1\./);
        expect(capability.wsUrl).toMatch(/^wss?:\/\//);
        return capability;
      }
      detail = `status=${response.status()} ready=${String(payload.ready)} entries=${entries.length}`;
    } catch (error: unknown) {
      detail = error instanceof Error ? error.message : String(error);
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`REACT_ENTITY_WORKSPACE_H1_CAPABILITY_TIMEOUT:${detail}`);
};

const installRemoteSession = async (
  context: BrowserContext,
  capability: RuntimeImportCapability,
): Promise<void> => {
  await context.addInitScript(({ keys, session }) => {
    localStorage.setItem(keys.mode, 'remote');
    localStorage.setItem(keys.ws, session.wsUrl);
    localStorage.setItem(keys.access, session.access);
    localStorage.removeItem(keys.auth);
    localStorage.setItem(keys.display, JSON.stringify({
      futureSetting: 'preserve-me',
      showTimeMachine: false,
      showXlnMascot: false,
      theme: 'dark',
    }));
    sessionStorage.setItem(keys.auth, session.token);
  }, {
    keys: {
      mode: RUNTIME_ADAPTER_MODE_KEY,
      ws: RUNTIME_ADAPTER_WS_KEY,
      access: RUNTIME_ADAPTER_ACCESS_KEY,
      auth: RUNTIME_ADAPTER_AUTH_KEY,
      display: DISPLAY_PREFERENCES_STORAGE_KEY,
    },
    session: capability,
  });
};

const assertSelectedContext = async (page: Page, expectedRuntimeId: string): Promise<void> => {
  const shell = page.getByTestId('entity-workspace-shell');
  await expect(shell).toHaveAttribute('data-read-status', 'ready', { timeout: 30_000 });
  await expect(page.getByText('Not attached')).toHaveCount(0);
  await expect(page.getByText(expectedRuntimeId.slice(0, 8), { exact: false })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
};

let candidateServer: CandidateServer | null = null;

test.beforeAll(async () => {
  candidateServer = await startCandidateServer();
});

test.afterAll(async () => {
  await stopCandidateServer(candidateServer);
});

test.setTimeout(180_000);

test('React Entity workspace reads selected context from a real H1 Runtime', { tag: '@functional' }, async ({ browser, page }, testInfo: TestInfo) => {
  const baseline = await ensureE2EBaseline(page, { requireHubMesh: true, minHubCount: 3 });
  const capability = await readH1Capability(page);
  const h1 = (baseline.hubs ?? []).find(hub => String(hub.name || '').trim().toLowerCase() === 'h1');
  const expectedRuntimeId = String(h1?.runtimeId || '').trim().toLowerCase();
  expect(expectedRuntimeId).toMatch(/^0x[0-9a-f]{40}$/);
  if (!candidateServer) throw new Error('REACT_ENTITY_WORKSPACE_VITE_MISSING');

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    try {
      await installRemoteSession(context, capability);
      const candidatePage = await context.newPage();
      const consoleProblems: string[] = [];
      candidatePage.on('console', message => {
        if (message.type() === 'error') consoleProblems.push(`console:${message.text()}`);
      });
      candidatePage.on('pageerror', error => consoleProblems.push(`pageerror:${error.message}`));
      const response = await candidatePage.goto(
        `${candidateServer.baseUrl}/__app/ops/entity-workspace#assets`,
        { waitUntil: 'domcontentloaded' },
      );
      expect(response?.ok()).toBe(true);
      await assertSelectedContext(candidatePage, expectedRuntimeId);
      const reserves = candidatePage.getByTestId('assets-reserve-projection');
      await expect(reserves).toBeVisible();
      await expect(candidatePage.getByTestId('assets-reserve-count')).not.toHaveText('0');
      await expect(reserves.getByText('raw units').first()).toBeVisible();
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-assets-${viewport.name}.png`);
      await candidatePage.evaluate(() => { window.location.hash = 'settings/consensus'; });
      const consensus = candidatePage.getByTestId('settings-consensus-evidence');
      await expect(consensus).toBeVisible();
      await expect(candidatePage.getByTestId('consensus-board-members').locator('li')).not.toHaveCount(0);
      await expect(candidatePage.getByTestId('consensus-account-count')).not.toHaveText('0');
      await expect(consensus.getByText('Committed only')).toBeVisible();
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-consensus-${viewport.name}.png`);
      await candidatePage.getByRole('link', { name: 'Display', exact: true }).click();
      const display = candidatePage.getByTestId('settings-display-panel');
      await expect(display).toBeVisible();
      await expect(candidatePage).toHaveURL(/#settings\/display$/);
      await candidatePage.getByTestId('settings-theme-select').selectOption('light');
      await expect.poll(() => candidatePage.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
      await expect(display.getByText('Light palette')).toBeVisible();
      await expect(candidatePage.getByTestId('entity-workspace-time-machine')).toHaveCount(0);
      await candidatePage.getByTestId('settings-time-machine-toggle').check();
      const timeMachine = candidatePage.getByTestId('entity-workspace-time-machine');
      await expect(timeMachine).toBeVisible();
      const liveLabel = await candidatePage.getByTestId('time-machine-mode').innerText();
      const latestHeight = Number(liveLabel.match(/h(\d+)/)?.[1] || 0);
      expect(latestHeight).toBeGreaterThan(1);
      const historicalHeight = latestHeight - 1;
      await candidatePage.getByTestId('time-machine-remote-height').fill(String(historicalHeight));
      await candidatePage.getByTestId('time-machine-remote-scan-button').click();
      const timeMachineMode = candidatePage.getByTestId('time-machine-mode');
      await expect.poll(() => timeMachineMode.innerText()).not.toMatch(/^Reading /);
      expect(await timeMachineMode.innerText(), await timeMachine.innerText()).toBe(`History · h${historicalHeight}`);
      await expect(candidatePage).toHaveURL(new RegExp(`tmHeight=${historicalHeight}`));
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-time-machine-history-${viewport.name}.png`);
      await candidatePage.getByTestId('time-machine-return-live').click();
      await expect(candidatePage.getByTestId('time-machine-mode')).toHaveText(/Live · h\d+/);
      await expect(candidatePage).not.toHaveURL(/tmHeight=/);
      await candidatePage.getByTestId('time-machine-remote-height').fill(String(historicalHeight));
      await candidatePage.getByTestId('time-machine-remote-scan-button').click();
      await expect(candidatePage.getByTestId('time-machine-mode')).toHaveText(`History · h${historicalHeight}`);
      await candidatePage.getByTestId('settings-time-machine-toggle').uncheck();
      await expect(timeMachine).toHaveCount(0);
      await expect(candidatePage).not.toHaveURL(/tmHeight=/);
      await candidatePage.getByTestId('settings-time-machine-toggle').check();
      await expect(candidatePage.getByTestId('time-machine-mode')).toHaveText(/Live · h\d+/);
      await candidatePage.getByTestId('settings-xln-mascot-toggle').check();
      const storedDisplay = await candidatePage.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), DISPLAY_PREFERENCES_STORAGE_KEY) as Record<string, unknown>;
      expect(storedDisplay['futureSetting']).toBe('preserve-me');
      expect(storedDisplay['showTimeMachine']).toBe(true);
      expect(storedDisplay['showXlnMascot']).toBe(true);
      expect(storedDisplay['theme']).toBe('light');
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-display-light-${viewport.name}.png`);
      await candidatePage.evaluate(() => { window.location.hash = 'accounts'; });
      const accounts = candidatePage.getByTestId('accounts-page-projection');
      await expect(accounts).toBeVisible();
      await expect(candidatePage.getByTestId('accounts-visible-count')).not.toHaveText('0');
      await expect(candidatePage.getByTestId('accounts-total-count')).not.toHaveText('0');
      const firstCommitment = candidatePage.getByTestId('account-commitment').first();
      await expect(firstCommitment).toBeVisible();
      await expect(firstCommitment.getByTestId('account-commitment-j-height')).toHaveText(/^\d+$/);
      await expect(firstCommitment.getByTestId('account-commitment-root')).not.toHaveText('');
      const activity = candidatePage.getByTestId('entity-activity-ledger');
      await expect(activity).toBeVisible();
      const activityThrough = candidatePage.getByTestId('entity-activity-through-height');
      await expect(activityThrough).toHaveText(/^h\d+$/);
      await expect(candidatePage.getByTestId('entity-activity-event-count')).toHaveText(/^\d+$/);
      await expect(activity.getByText('Adapter order is preserved', { exact: false })).toBeVisible();
      const firstActivityTimestamp = candidatePage.getByTestId('entity-activity-timestamp').first();
      await expect(firstActivityTimestamp).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/);
      await expect(firstActivityTimestamp).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      await expect(firstActivityTimestamp).toHaveAttribute('title', /^Runtime timestamp \d+$/);
      const firstRuntimeTimestamp = Number(
        (await firstActivityTimestamp.getAttribute('title'))?.replace('Runtime timestamp ', ''),
      );
      expect(firstRuntimeTimestamp).toBeGreaterThan(0);
      const activityCount = candidatePage.getByTestId('entity-activity-event-count');
      const activityPageSize = candidatePage.getByTestId('entity-activity-page-size');
      await expect(activityPageSize).toHaveValue('8');
      await activityPageSize.selectOption('40');
      await expect(activityPageSize).toHaveValue('40');
      await expect.poll(async () => Number(await activityCount.innerText())).toBeGreaterThan(8);
      await expect.poll(async () => Number(await activityCount.innerText()) <= 40).toBe(true);
      await expect.poll(() => activity.locator('ol').evaluate(
        (list) => list.scrollHeight > list.clientHeight,
      )).toBe(true);
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-activity-page-size-${viewport.name}.png`);
      await activityPageSize.selectOption('8');
      await expect(activityPageSize).toHaveValue('8');
      await expect.poll(async () => Number(await activityCount.innerText()) <= 8).toBe(true);
      const allActivityCount = Number(await activityCount.innerText());
      const refreshActivity = candidatePage.getByTestId('entity-activity-refresh');
      await refreshActivity.click();
      await expect(activityCount).toHaveText(String(allActivityCount));
      const offchainActivity = candidatePage.getByTestId('entity-activity-kind-offchain');
      await offchainActivity.click();
      await expect(offchainActivity).toHaveAttribute('aria-pressed', 'true');
      const offchainActivityCount = Number(await activityCount.innerText());
      expect(offchainActivityCount).toBeGreaterThan(0);
      await expect(activity.locator('li[data-kind="offchain"]')).toHaveCount(offchainActivityCount);
      const onchainActivity = candidatePage.getByTestId('entity-activity-kind-onchain');
      await onchainActivity.click();
      await expect(onchainActivity).toHaveAttribute('aria-pressed', 'true');
      const onchainActivityCount = Number(await activityCount.innerText());
      expect(onchainActivityCount).toBeGreaterThan(0);
      await expect(activity.locator('li[data-kind="onchain"]')).toHaveCount(onchainActivityCount);
      const allActivity = candidatePage.getByTestId('entity-activity-kind-all');
      await allActivity.click();
      await expect(allActivity).toHaveAttribute('aria-pressed', 'true');
      await expect(activityCount).toHaveText(String(allActivityCount));
      const jEventActivity = candidatePage.getByTestId('entity-activity-type-j_event');
      await jEventActivity.click();
      await expect(jEventActivity).toHaveAttribute('aria-pressed', 'true');
      const jEventActivityCount = Number(await activityCount.innerText());
      expect(jEventActivityCount).toBeGreaterThan(0);
      await expect(activity.locator('li[data-type="j_event"]')).toHaveCount(jEventActivityCount);
      const activitySearch = candidatePage.getByTestId('entity-activity-search');
      await activitySearch.fill('ReserveUpdated');
      await expect(activity.locator('li')).toHaveCount(3);
      await expect(activity.locator('li strong')).toHaveText([
        'ReserveUpdated', 'ReserveUpdated', 'ReserveUpdated',
      ]);
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-activity-filters-${viewport.name}.png`);
      const clearActivityFilters = candidatePage.getByTestId('entity-activity-clear-filters');
      await expect(clearActivityFilters).toBeVisible();
      await clearActivityFilters.click();
      await expect(activitySearch).toHaveValue('');
      await expect(jEventActivity).toHaveAttribute('aria-pressed', 'false');
      await expect(activityCount).toHaveText(String(allActivityCount));
      await expect(clearActivityFilters).toHaveCount(0);
      const accountActivity = candidatePage.getByTestId('entity-activity-type-account');
      await accountActivity.click();
      await activitySearch.fill('Credit limit updated');
      await expect.poll(async () => Number(await activityCount.innerText())).toBeGreaterThan(0);
      await expect(activity.locator('li[data-type="account"]')).toHaveCount(Number(await activityCount.innerText()));
      const activityAmount = candidatePage.getByTestId('entity-activity-amount').first();
      await expect(activityAmount.locator('strong')).toHaveText(/^-?\d+$/);
      await expect(activityAmount.locator('small')).toHaveText(/^Amount raw · token #\d+$/);
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-activity-evidence-${viewport.name}.png`);
      await clearActivityFilters.click();
      await expect(activitySearch).toHaveValue('');
      await expect(accountActivity).toHaveAttribute('aria-pressed', 'false');
      await expect(activityCount).toHaveText(String(allActivityCount));
      const pagedActivityMode = candidatePage.getByTestId('entity-activity-mode-paged');
      const infiniteActivityMode = candidatePage.getByTestId('entity-activity-mode-infinite');
      const timeframeActivityMode = candidatePage.getByTestId('entity-activity-mode-timeframe');
      await expect(pagedActivityMode).toHaveAttribute('aria-pressed', 'true');
      await timeframeActivityMode.click();
      await expect(timeframeActivityMode).toHaveAttribute('aria-pressed', 'true');
      const timeframeValues = await candidatePage.evaluate((timestamp) => {
        const format = (value: number): string => {
          const date = new Date(value);
          const twoDigits = (part: number): string => String(part).padStart(2, '0');
          return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
            + `T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
        };
        const fromTimestamp = Math.floor(timestamp / 60_000) * 60_000;
        const toTimestamp = fromTimestamp + 60_000;
        return {
          fromTimestamp,
          fromValue: format(fromTimestamp),
          toTimestamp,
          toValue: format(toTimestamp),
        };
      }, firstRuntimeTimestamp);
      const activityFrom = candidatePage.getByTestId('entity-activity-from');
      const activityTo = candidatePage.getByTestId('entity-activity-to');
      const applyTimeframe = candidatePage.getByTestId('entity-activity-apply-timeframe');
      await activityFrom.fill(timeframeValues.toValue);
      await activityTo.fill(timeframeValues.fromValue);
      await expect(applyTimeframe).toBeDisabled();
      await expect(activity.getByRole('alert')).toHaveText('From must not be later than To.');
      await activityFrom.fill(timeframeValues.fromValue);
      await activityTo.fill(timeframeValues.toValue);
      await expect(applyTimeframe).toBeEnabled();
      await applyTimeframe.click();
      await expect.poll(async () => Number(await activityCount.innerText())).toBeGreaterThan(0);
      const filteredTimestamps = await candidatePage.getByTestId('entity-activity-timestamp')
        .evaluateAll((times) => times.map((time) => Number(time.getAttribute('title')?.replace('Runtime timestamp ', ''))));
      expect(filteredTimestamps.every((timestamp) => (
        timestamp >= timeframeValues.fromTimestamp && timestamp <= timeframeValues.toTimestamp
      ))).toBe(true);
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-activity-timeframe-${viewport.name}.png`);
      await expect(clearActivityFilters).toBeVisible();
      await clearActivityFilters.click();
      await expect(activityFrom).toHaveValue('');
      await expect(activityTo).toHaveValue('');
      await expect(timeframeActivityMode).toHaveAttribute('aria-pressed', 'true');
      await pagedActivityMode.click();
      await expect(pagedActivityMode).toHaveAttribute('aria-pressed', 'true');
      await expect(activityFrom).toHaveCount(0);
      await expect(activityCount).toHaveText(String(allActivityCount));
      await infiniteActivityMode.click();
      await expect(infiniteActivityMode).toHaveAttribute('aria-pressed', 'true');
      const initialInfiniteCount = Number(await activityCount.innerText());
      expect(initialInfiniteCount).toBeGreaterThan(0);
      expect(initialInfiniteCount).toBeLessThanOrEqual(8);
      const loadOlderActivity = candidatePage.getByTestId('entity-activity-load-older');
      await expect(loadOlderActivity).toBeEnabled();
      await loadOlderActivity.click();
      await expect.poll(async () => Number(await activityCount.innerText())).toBeGreaterThan(initialInfiniteCount);
      await expect.poll(async () => Number(await activityCount.innerText()) <= 16).toBe(true);
      await expect(candidatePage.getByTestId('entity-activity-loaded-pages'))
        .toHaveText(/^2 windows · \d+ loaded$/);
      const infiniteEventIds = await activity.locator('li').evaluateAll(
        (items) => items.map((item) => item.getAttribute('data-event-id')),
      );
      expect(new Set(infiniteEventIds).size).toBe(infiniteEventIds.length);
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-activity-infinite-${viewport.name}.png`);
      await pagedActivityMode.click();
      await expect(pagedActivityMode).toHaveAttribute('aria-pressed', 'true');
      await expect(activityCount).toHaveText(String(allActivityCount));
      await expect(loadOlderActivity).toHaveCount(0);
      const latestActivityHeight = Number((await activityThrough.innerText()).replace(/^h/, ''));
      const earlierActivity = candidatePage.getByTestId('entity-activity-earlier');
      await expect(earlierActivity).toBeEnabled();
      await earlierActivity.click();
      await expect.poll(async () => Number((await activityThrough.innerText()).replace(/^h/, '')))
        .toBeLessThan(latestActivityHeight);
      const newerActivity = candidatePage.getByTestId('entity-activity-newer');
      await expect(newerActivity).toBeEnabled();
      await newerActivity.click();
      await expect(activityThrough).toHaveText(`h${latestActivityHeight}`);
      await earlierActivity.click();
      await expect.poll(async () => Number((await activityThrough.innerText()).replace(/^h/, '')))
        .toBeLessThan(latestActivityHeight);
      const latestActivity = candidatePage.getByTestId('entity-activity-latest');
      await expect(latestActivity).toBeEnabled();
      await latestActivity.click();
      await expect(activityThrough).toHaveText(`h${latestActivityHeight}`);
      await expect(candidatePage.getByText('Payments, swaps, credit, and Account lifecycle commands remain on the canonical workspace.')).toBeVisible();
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-accounts-${viewport.name}.png`);
      await candidatePage.evaluate(() => { window.location.hash = 'settings/entity'; });
      const profile = candidatePage.getByTestId('settings-profile-projection');
      await expect(profile).toBeVisible();
      await expect(candidatePage.getByTestId('settings-profile-name')).not.toHaveText('');
      await expect(candidatePage.getByTestId('settings-profile-role')).toHaveText('Hub entity');
      const runtimeSummary = candidatePage.getByTestId('settings-runtime-summary');
      await expect(runtimeSummary).toBeVisible();
      await expect(candidatePage.getByTestId('settings-runtime-mode')).toHaveText('Live');
      await expect(candidatePage.getByTestId('settings-runtime-height')).not.toHaveText('0');
      await expect(candidatePage.getByTestId('settings-account-count')).not.toHaveText('0');
      await expect(candidatePage.getByTestId('settings-visible-reserve-count')).not.toHaveText('0');
      const hubPolicy = candidatePage.getByTestId('settings-hub-policy');
      await expect(hubPolicy).toBeVisible();
      await expect(candidatePage.getByTestId('settings-hub-policy-version')).not.toHaveText('0');
      await expect(hubPolicy.getByText(/ppm$/)).toBeVisible();
      await expect(hubPolicy.getByText(/bps$/)).toBeVisible();
      await expect(hubPolicy.getByText(/raw units$/)).toBeVisible();
      await hubPolicy.scrollIntoViewIfNeeded();
      await expect(candidatePage.getByRole('link', { name: 'Wallet', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(candidatePage.getByText('Profile edits and all Settings commands remain on the canonical workspace.')).toBeVisible();
      await capturePageScreenshot(candidatePage, testInfo, `react-entity-workspace-settings-profile-${viewport.name}.png`);
      expect(consoleProblems).toEqual([]);
    } finally {
      await context.close();
    }
  }
});
