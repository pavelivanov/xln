import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, expect, test } from '@playwright/test';
import { expectNoBrowserErrors, observeBrowserErrors, screenshotEvidence } from '../react-candidate/browser-evidence';

// The canonical native verifier is Bun tooling; Playwright runs its tests in Node.
const verifyPackage = (): unknown =>
  JSON.parse(
    execFileSync(
      'bun',
      [
        '-e',
        `
  import { verifyPackagedShellCandidateDirectory } from '../scripts/native/packaged-shell-candidate-manifest';
  console.log(JSON.stringify(await verifyPackagedShellCandidateDirectory(
    process.env.PLAYWRIGHT_PACKAGED_DIRECTORY, process.env.PLAYWRIGHT_STAGING_DIRECTORY,
  )));
`,
      ],
      { encoding: 'utf8' },
    ),
  );

test('packaged extension action opens the exact Wallet and preserves preferences across reload and reopen', async ({}, testInfo) => {
  test.setTimeout(25000);
  const directory = process.env['PLAYWRIGHT_PACKAGED_DIRECTORY'];
  const staging = process.env['PLAYWRIGHT_STAGING_DIRECTORY'];
  if (!directory || !staging) throw new Error('PACKAGED_BROWSER_INPUTS_REQUIRED');
  const before = verifyPackage();
  const extension = join(directory, 'extension');
  const profile = await mkdtemp(join(tmpdir(), 'xln-extension-browser-'));
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      viewport: testInfo.project.use.viewport,
      // Chromium requires an explicit opt-in for extension action automation.
      // This temporary profile contains only the verified candidate extension.
      args: [
        '--enable-unsafe-extension-debugging',
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
  let context = await launch();
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).host;
    await expect.poll(() => worker.evaluate('chrome.action.onClicked.hasListeners()')).toBe(true);
    const browser = context.browser();
    if (!browser) throw new Error('PACKAGED_BROWSER_CONNECTION_REQUIRED');
    const browserSession = await browser.newBrowserCDPSession();
    const { targetInfos } = await browserSession.send('Target.getTargets', { filter: [{ type: 'tab' }] });
    expect(targetInfos).toHaveLength(1);
    const targetInfo = targetInfos[0];
    if (!targetInfo) throw new Error('PACKAGED_BROWSER_TAB_REQUIRED');
    const [page] = await Promise.all([
      context.waitForEvent('page', { timeout: 5000 }),
      browserSession.send('Extensions.triggerAction', { id: extensionId, targetId: targetInfo.targetId }),
    ]);
    page.setDefaultTimeout(5000);
    console.info(`PACKAGED_EXTENSION_OPEN url=${page.url()}`);
    const errors = observeBrowserErrors(page);
    await expect(page).toHaveURL(`chrome-extension://${extensionId}/app.html`);
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute(
      'href',
      '/app.html?settings=1',
    );
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('link', { name: 'Theme', exact: true }).click();
    await page.getByRole('button', { name: 'Paper light', exact: false }).click();
    await expect(page.getByRole('button', { name: 'Paper light', exact: false })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const settingsUrl = page.url();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Paper light', exact: false })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await screenshotEvidence(page, testInfo, 'extension-wallet-reload');
    expectNoBrowserErrors(errors);
    await context.close();
    context = await launch();
    const reopened = await context.newPage();
    reopened.setDefaultTimeout(5000);
    const reopenErrors = observeBrowserErrors(reopened);
    await reopened.goto(settingsUrl);
    await expect(reopened.getByRole('button', { name: 'Paper light', exact: false })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await screenshotEvidence(reopened, testInfo, 'extension-wallet-reopened');
    expectNoBrowserErrors(reopenErrors);
    expect(verifyPackage()).toEqual(before);
  } catch (error) {
    const page = context.pages().at(-1);
    if (page) {
      console.info(`PACKAGED_EXTENSION_FAILURE url=${page.url()} text=${await page.locator('body').innerText()}`);
      await screenshotEvidence(page, testInfo, 'extension-wallet-failure');
    }
    throw error;
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
