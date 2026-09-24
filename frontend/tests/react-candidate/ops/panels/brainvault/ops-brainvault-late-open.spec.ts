import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  openWorkspaceStorageOrigin,
  screenshotEvidence,
} from '../../../browser-evidence';
import { installImportedRuntime, readWalletRuntimeFixture } from '../../../wallet/fixtures/wallet-runtime-test-helpers';
import { WALLET_RECOVERY_FIXTURE_MNEMONIC } from '../../../wallet/fixtures/wallet-fixture-identities';

const embeddedModule = `/__app/ops/@fs${fileURLToPath(new URL('../../../../../apps/wallet/src/runtime/wallet-embedded-runtime.ts', import.meta.url))}`;
const mnemonic = WALLET_RECOVERY_FIXTURE_MNEMONIC;
const selectedRuntime = (page: Page) =>
  page.evaluate(async () => {
    const path = '/__app/ops/src/entity-workspace/ops-entity-workspace-runtime.ts';
    const { opsEntityWorkspaceSource } = await import(path);
    const adapter = opsEntityWorkspaceSource.getAdapter();
    return adapter ? { mode: adapter.mode, runtimeId: adapter.runtimeId } : null;
  });

for (const action of ['close', 'destination change', 'different Runtime selection'] as const) {
  test(
    `late local BrainVault recovery preserves workspace focus after ${action}`,
    { tag: '@resilience' },
    async ({ page }, testInfo) => {
      const errors = observeBrowserErrors(page);
      const fixture = await readWalletRuntimeFixture(page);
      await page.addInitScript((towerUrl: string) => {
        localStorage.setItem('xln-watchtower-urls', JSON.stringify([towerUrl]));
        (window as typeof window & { __XLN_WATCHTOWERS__?: string[] }).__XLN_WATCHTOWERS__ = [towerUrl];
      }, fixture.recovery.towerUrl);
      await openWorkspaceStorageOrigin(page);
      await installImportedRuntime(page, fixture);
      await page.goto('/__app/ops/entity-workspace');
      await page.getByRole('button', { name: 'Open BrainVault panel', exact: true }).click();
      const panel = page.getByTestId('workspace-brainvault');
      await panel.getByRole('button', { name: 'Create/recover local Runtime', exact: true }).click();
      await panel.getByRole('tab', { name: /Mnemonic/ }).click();
      await panel.getByRole('textbox', { name: /^Seed phrase/ }).fill(mnemonic);
      await panel.getByRole('button', { name: 'Review identity inputs' }).click();
      await panel.getByRole('button', { name: 'Verify recovery' }).click();
      await panel.getByRole('textbox', { name: /^Seed phrase/ }).fill(mnemonic);
      await panel.getByRole('button', { name: 'Verify recovered wallet' }).click();
      await panel.getByRole('button', { name: 'Check recovery and open wallet' }).click();
      await expect(panel.getByRole('heading', { name: 'Choose a backup' })).toBeVisible();

      // Delay only delivery of the real fixture's RPC response. Recovery, its
      // encrypted backup, and the eventual local adapter remain canonical.
      let received = false;
      const release = Promise.withResolvers<void>();
      const rpcPort = new URL(fixture.recovery.rpcUrl).port;
      await page.route(
        url => ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === rpcPort,
        async route => {
          const intercepted = route.request();
          const postData = intercepted.postData();
          const response = await fetch(intercepted.url(), {
            method: intercepted.method(),
            headers: intercepted.headers(),
            ...(postData === null ? {} : { body: postData }),
          });
          const responseSnapshot = {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body: Buffer.from(await response.arrayBuffer()),
          };
          received = true;
          await release.promise;
          await route.fulfill(responseSnapshot);
        },
      );
      let expectedRuntimeId = fixture.runtimeId;
      try {
        await panel.getByRole('button', { name: 'Restore selected backup' }).click();
        await expect.poll(() => received).toBe(true);
        expect(
          await page.evaluate(async path => {
            const { getWalletEmbeddedRuntimeSnapshot } = await import(path);
            return getWalletEmbeddedRuntimeSnapshot().status;
          }, embeddedModule),
        ).toBe('booting');
        if (action === 'close') {
          await page
            .locator('.dv-default-tab')
            .filter({ hasText: /^BrainVault$/ })
            .locator('.dv-default-tab-action')
            .click();
          await expect(panel).toHaveCount(0);
        } else if (action === 'destination change') {
          await panel.getByRole('button', { name: 'Cancel local creation/recovery', exact: true }).click();
          await expect(panel).toHaveAttribute('data-destination', 'remote');
        } else {
          const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
          const response = await page.request.post(`http://127.0.0.1:${port}/account-dropdown-fixture`);
          expect(response.ok()).toBe(true);
          const other = (await response.json()) as { runtimeId: string; wsUrl: string; token: string };
          expect(other.runtimeId).not.toBe(fixture.runtimeId);
          expectedRuntimeId = other.runtimeId;
          await page.getByRole('button', { name: 'Open Runtimes panel', exact: true }).click();
          const manager = page.getByTestId('remote-runtime-manager');
          await manager.getByLabel('Label', { exact: true }).fill('Newer selection');
          await manager.getByLabel('WebSocket endpoint').fill(other.wsUrl);
          await manager.getByLabel('Admin capability token').fill(other.token);
          await manager.getByRole('button', { name: 'Validate & attach', exact: true }).click();
          await expect(manager.getByRole('status')).toHaveText('Attached 1/1');
        }
        expect(await selectedRuntime(page)).toEqual({ mode: 'remote', runtimeId: expectedRuntimeId });
      } finally {
        release.resolve();
      }
      await expect
        .poll(() =>
          page.evaluate(async path => {
            const { getWalletEmbeddedRuntimeSnapshot } = await import(path);
            const current = getWalletEmbeddedRuntimeSnapshot();
            return { status: current.status, runtimeId: current.runtimeId };
          }, embeddedModule),
        )
        .toEqual({ status: 'ready', runtimeId: fixture.recovery.runtimeId });
      // Cross another browser task after publication so the opening callback and
      // workspace subscribers have run before checking the surviving selection.
      await page.getByRole('button', { name: 'Open Wallet panel', exact: true }).click();
      const wallet = page.getByTestId('ops-wallet-panel');
      await expect(wallet).toHaveAttribute('data-runtime-id', expectedRuntimeId);
      await expect(wallet.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible();
      expect(await selectedRuntime(page)).toEqual({ mode: 'remote', runtimeId: expectedRuntimeId });
      await page.getByRole('button', { name: 'Open BrainVault panel', exact: true }).click();
      await expect(panel).toHaveAttribute('data-destination', 'remote');
      await expect(panel.getByLabel('Passphrase', { exact: true })).toHaveValue('');
      await expect(panel.getByRole('heading', { name: 'Wallet opened' })).toHaveCount(0);
      await screenshotEvidence(page, testInfo, `ops-brainvault-late-open-${action.replaceAll(' ', '-')}`);
      await expectPageContained(page);
      expectNoBrowserErrors(errors);
    },
  );
}
