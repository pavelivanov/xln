import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import { finishOpenedWalletSetup, restoreLocalWallet } from './wallet-onboarding-test-helpers';
import { installImportedRuntime, readWalletRuntimeFixture, selectWalletFixtureRuntime } from '../fixtures/wallet-runtime-test-helpers';

const installLockedOwnerMetadata = (page: import('@playwright/test').Page, runtimeId: string, entityId: string) =>
  page.evaluate(({ id, entity }) => {
    localStorage.setItem('xln-vaults', JSON.stringify({ activeRuntimeId: id, runtimes: {
      [id]: { id, label: 'Remote owner', signers: [{ index: 0, address: id, name: 'Owner', entityId: entity }], activeSignerIndex: 0, createdAt: 1, loginType: 'manual' },
    } }));
  }, { id: runtimeId, entity: entityId });

test('Formation creates numbered and weighted lazy Entities through the existing wallet commands', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const fixture = await restoreLocalWallet(page);
  await finishOpenedWalletSetup(page);
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await page.getByRole('button', { name: 'Create Entity', exact: true }).click();
  const panel = page.getByTestId('entity-formation-panel');
  const form = panel.getByRole('form', { name: 'Create Entity' });
  await expect(form.getByRole('button', { name: 'Create Entity', exact: true })).toBeDisabled();
  await form.getByLabel('Entity name', { exact: true }).fill('React Numbered');
  await expect(form.getByRole('combobox', { name: 'Jurisdiction', exact: true })).toHaveValue('React Recovery mnemonic');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-formation-numbered');
  await form.getByRole('button', { name: 'Create Entity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('status')).toContainText('Entity created:');
  await expect(page.getByLabel('Entity', { exact: true }).locator('option').filter({ hasText: 'React Numbered' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Create Entity', exact: true }).click();
  await form.getByLabel('Entity name', { exact: true }).fill('Duplicate Board');
  await form.locator('.wallet-formation-advanced > summary').click();
  await form.getByRole('button', { name: /^Lazy/ }).click();
  await form.getByRole('button', { name: 'Create Entity', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('This validator configuration already exists');
  await form.getByRole('alert').evaluate(element => element.scrollIntoView({ block: 'center' }));
  if (testInfo.project.name === 'mobile-390x844') {
    const issue = await form.getByRole('alert').boundingBox();
    const navigation = await page.getByRole('navigation', { name: 'Wallet navigation' }).boundingBox();
    if (issue === null || navigation === null) throw new Error('FORMATION_ERROR_BOUNDS_UNAVAILABLE');
    expect(issue.y).toBeGreaterThanOrEqual(0);
    expect(issue.y + issue.height).toBeLessThan(navigation.y);
    const path = testInfo.outputPath('wallet-formation-duplicate-viewport.png');
    await page.screenshot({ animations: 'disabled', path });
    await testInfo.attach('mobile-formation-duplicate-viewport', { contentType: 'image/png', path });
  }
  await screenshotEvidence(page, testInfo, 'wallet-formation-duplicate');

  await form.getByLabel('Entity name', { exact: true }).fill('React Weighted');
  await form.getByTestId('formation-shared').click();
  await form.getByLabel('Board member 2', { exact: true }).fill('invalid-member');
  await expect(form.getByRole('button', { name: 'Create Entity', exact: true })).toBeDisabled();
  await expect(form.getByRole('alert').filter({ hasText: 'Cannot derive lazy entity id' })).toBeVisible();
  await form.getByLabel('Board member 2', { exact: true }).fill(fixture.counterpartySignerId);
  await form.getByLabel('Board member 1 weight', { exact: true }).fill('');
  await form.getByLabel('Board member 1 weight', { exact: true }).fill('2');
  await expect(form.getByRole('slider', { name: 'Board signing threshold' })).toHaveValue('3');
  await form.getByRole('slider', { name: 'Board signing threshold' }).press('ArrowLeft');
  await expect(form.getByRole('slider', { name: 'Board signing threshold' })).toHaveValue('2');
  const preview = await form.getByTestId('formation-board-hash').innerText();
  expect(preview).toMatch(/^0x[0-9a-f]{64}$/);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-formation-weighted');
  await form.getByRole('button', { name: 'Create Entity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status')).toContainText(`Entity created: ${preview}`);
  await expect(page.getByLabel('Entity', { exact: true }).locator(`option[value="${preview}"]`)).toHaveText('React Weighted');
  await page.getByLabel('Entity', { exact: true }).selectOption(preview);
  await expect(page.getByLabel('Entity', { exact: true }).locator('option:checked')).toHaveText('React Weighted');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-formation-created');
  expectNoBrowserErrors(errors);
});

test('Formation rejects a wrong or locked owner for the selected remote Runtime', { tag: '@resilience' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await installLockedOwnerMetadata(page, `0x${'11'.repeat(20)}`, fixture.entityId);
  await page.goto('/app?portfolio=1', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create Entity', exact: true }).click();
  const panel = page.getByTestId('entity-formation-panel');
  await expect(panel.getByRole('status')).toHaveText('Open the wallet that owns this Runtime to create an Entity.');
  await screenshotEvidence(page, testInfo, 'wallet-formation-remote-wrong-owner');

  await installLockedOwnerMetadata(page, fixture.runtimeId, fixture.entityId);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create Entity', exact: true }).click();
  const form = panel.getByRole('form', { name: 'Create Entity' });
  await expect(form.getByRole('alert')).toContainText(`RUNTIME_LOCKED:${fixture.runtimeId}`);
  await expect(form.locator('fieldset')).toHaveAttribute('disabled', '');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-formation-remote-locked-owner');
  expectNoBrowserErrors(errors);
});

test('Formation commits a numbered Entity to the selected owner Runtime', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const fixture = await restoreLocalWallet(page);
  await finishOpenedWalletSetup(page);
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await installImportedRuntime(page, fixture);
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage')));
  await page.getByRole('link', { name: 'Payments', exact: true }).click();
  await page.getByRole('link', { name: 'Assets', exact: true }).click();
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Remote Runtime');
  await expect(page.getByLabel('Entity', { exact: true }).locator(`option[value="${fixture.entityId}"]`)).toHaveCount(1);

  await page.getByRole('button', { name: 'Create Entity', exact: true }).click();
  const form = page.getByTestId('entity-formation-panel').getByRole('form', { name: 'Create Entity' });
  await expect(form.getByText(fixture.runtimeId, { exact: true })).toBeVisible();
  await expect(form.getByRole('combobox', { name: 'Jurisdiction', exact: true })).toHaveValue('Wallet Browser Fixture');
  const name = `Remote Formation ${testInfo.project.name}`;
  await form.getByLabel('Entity name', { exact: true }).fill(name);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-formation-remote-review');
  await form.getByRole('button', { name: 'Create Entity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('status')).toContainText('Entity created:');
  await expect(page.getByLabel('Entity', { exact: true }).locator('option').filter({ hasText: name })).toHaveCount(1);
  expect((await readWalletRuntimeFixture(page)).height).toBeGreaterThan(fixture.height);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-formation-remote-created');
  expectNoBrowserErrors(errors);
});
