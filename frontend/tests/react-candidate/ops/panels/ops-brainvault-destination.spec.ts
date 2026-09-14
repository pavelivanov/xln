import { expect, test, type Page } from '@playwright/test';
import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  openWorkspaceStorageOrigin,
  screenshotEvidence,
} from '../../browser-evidence';
import { installImportedRuntime, readWalletRuntimeFixture } from '../../wallet/fixtures/wallet-runtime-test-helpers';

const mnemonic = 'test test test test test test test test test test test junk';
const readSelectedRuntime = (page: Page) =>
  page.evaluate(async () => {
    const path = '/__app/ops/src/entity-workspace/ops-entity-workspace-runtime.ts';
    const { opsEntityWorkspaceSource } = await import(path);
    const adapter = opsEntityWorkspaceSource.getAdapter();
    return { mode: adapter.mode, runtimeId: adapter.runtimeId };
  });
const readStorage = (page: Page) => page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));

test(
  'local BrainVault cancel and close preserve the remote Runtime and discard secret inputs',
  { tag: '@resilience' },
  async ({ page }, testInfo) => {
    const errors = observeBrowserErrors(page);
    const fixture = await readWalletRuntimeFixture(page);
    await openWorkspaceStorageOrigin(page);
    await installImportedRuntime(page, fixture);
    await page.goto('/__app/ops/entity-workspace');
    const open = page.getByRole('button', { name: 'Open BrainVault panel', exact: true });
    await open.click();
    const panel = page.getByTestId('workspace-brainvault');
    await expect(panel).toHaveAttribute('data-destination', 'remote');
    await panel.getByRole('button', { name: 'Create/recover local Runtime', exact: true }).click();
    await panel.getByRole('tab', { name: /Mnemonic/ }).click();
    await panel.getByRole('textbox', { name: /^Seed phrase/ }).fill(mnemonic);
    expect(await readSelectedRuntime(page)).toEqual({ mode: 'remote', runtimeId: fixture.runtimeId });
    await panel.getByRole('button', { name: 'Cancel local creation/recovery', exact: true }).click();
    await expect(panel).toHaveAttribute('data-destination', 'remote');
    expect(await readSelectedRuntime(page)).toEqual({ mode: 'remote', runtimeId: fixture.runtimeId });
    await panel.getByRole('button', { name: 'Create/recover local Runtime', exact: true }).click();
    await panel.getByRole('tab', { name: /Mnemonic/ }).click();
    await expect(panel.getByRole('textbox', { name: /^Seed phrase/ })).toHaveValue('');
    await panel.getByRole('textbox', { name: /^Seed phrase/ }).fill(mnemonic);
    await page
      .locator('.dv-default-tab')
      .filter({ hasText: /^BrainVault$/ })
      .locator('.dv-default-tab-action')
      .click();
    await expect(panel).toHaveCount(0);
    await open.click();
    await expect(panel).toHaveAttribute('data-destination', 'remote');
    expect(await readSelectedRuntime(page)).toEqual({ mode: 'remote', runtimeId: fixture.runtimeId });
    expect(await readStorage(page)).not.toContain(mnemonic);
    await screenshotEvidence(page, testInfo, 'ops-brainvault-cancelled-local');
    await expectPageContained(page);
    expectNoBrowserErrors(errors);
  },
);

test(
  'Runtime reselection invalidates both local and remote BrainVault forms',
  { tag: '@resilience' },
  async ({ page }, testInfo) => {
    const errors = observeBrowserErrors(page);
    const fixture = await readWalletRuntimeFixture(page);
    await openWorkspaceStorageOrigin(page);
    await installImportedRuntime(page, fixture);
    await page.goto('/__app/ops/entity-workspace');
    const open = page.getByRole('button', { name: 'Open BrainVault panel', exact: true });
    await open.click();
    const panel = page.getByTestId('workspace-brainvault');
    await panel.getByRole('button', { name: 'Create/recover local Runtime', exact: true }).click();
    await panel.getByRole('tab', { name: /Mnemonic/ }).click();
    await panel.getByRole('textbox', { name: /^Seed phrase/ }).fill(mnemonic);
    const reselect = async () => {
      await page.getByRole('button', { name: 'Open Runtimes panel', exact: true }).click();
      const manager = page.getByTestId('remote-runtime-manager');
      await manager.getByRole('button', { name: 'Select Browser fixture', exact: true }).click();
      await expect(manager.getByRole('button', { name: 'Select Browser fixture', exact: true })).toBeEnabled();
      await expect(manager.getByRole('status')).toHaveText('Runtime selected');
      await open.click();
    };
    await reselect();
    await expect(panel).toHaveAttribute('data-destination', 'remote');
    await expect(panel.getByRole('textbox', { name: /^Seed phrase/ })).toHaveCount(0);
    await panel.getByLabel('Passphrase', { exact: true }).fill('discard-on-runtime-reselection');
    await reselect();
    await expect(panel).toHaveAttribute('data-destination', 'remote');
    await expect(panel.getByLabel('Passphrase', { exact: true })).toHaveValue('');
    expect(await readSelectedRuntime(page)).toEqual({ mode: 'remote', runtimeId: fixture.runtimeId });
    expect(await readStorage(page)).not.toContain(mnemonic);
    expect(await readStorage(page)).not.toContain('discard-on-runtime-reselection');
    await screenshotEvidence(page, testInfo, 'ops-brainvault-runtime-reselected');
    await expectPageContained(page);
    expectNoBrowserErrors(errors);
  },
);

test(
  'changing BrainVault destination aborts active native derivation and allows a fresh operation',
  { tag: '@resilience' },
  async ({ page }, testInfo) => {
    const errors = observeBrowserErrors(page);
    const fixture = await readWalletRuntimeFixture(page);
    await openWorkspaceStorageOrigin(page);
    await installImportedRuntime(page, fixture);
    await page.goto('/__app/ops/entity-workspace');
    await page.getByRole('button', { name: 'Open BrainVault panel', exact: true }).click();
    const panel = page.getByTestId('workspace-brainvault');
    await panel.getByLabel('Passphrase', { exact: true }).fill('discard-on-destination-change');
    await panel.getByLabel('Work level or explicit shards', { exact: true }).fill('4');
    await panel.getByRole('button', { name: 'Derive and install on selected node', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Cancel derivation', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Create/recover local Runtime', exact: true }).click();
    await expect(panel).toHaveAttribute('data-destination', 'local');
    await expect(panel.getByRole('button', { name: 'Cancel derivation', exact: true })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Cancel local creation/recovery', exact: true }).click();
    await expect(panel.getByTestId('brainvault-node-result')).toHaveCount(0);
    await expect(panel.getByLabel('Passphrase', { exact: true })).toHaveValue('');
    await expect(panel.getByLabel('Work level or explicit shards', { exact: true })).toHaveValue('1');
    await panel.getByLabel('Name', { exact: true }).fill('fresh-after-destination-change');
    await panel.getByLabel('Passphrase', { exact: true }).fill('fresh-destination-passphrase');
    await panel.getByRole('button', { name: 'Derive and install on selected node', exact: true }).click();
    await expect(panel.getByTestId('brainvault-node-result')).toContainText('Native duration', { timeout: 15_000 });
    await expect(panel.getByRole('alert')).toHaveCount(0);
    expect(await readSelectedRuntime(page)).toEqual({ mode: 'remote', runtimeId: fixture.runtimeId });
    expect(await readStorage(page)).not.toContain('discard-on-destination-change');
    expect(await readStorage(page)).not.toContain('fresh-destination-passphrase');
    await screenshotEvidence(page, testInfo, 'ops-brainvault-new-remote-operation');
    await expectPageContained(page);
    expectNoBrowserErrors(errors);
  },
);
