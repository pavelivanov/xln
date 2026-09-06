import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, openWorkspaceStorageOrigin, screenshotEvidence } from '../browser-evidence';

test('public embed retains the canonical full layout through focus, reload, internal inspection, and reset', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await page.goto('/embed');
  await expect(page).toHaveTitle('xln — Embedded Workspace');
  const menu = page.getByLabel('Open workspace panel', { exact: true });
  await expect(page.locator('.dv-tab')).toHaveCount(14);
  await expect(page.locator('.ops-pinned-tab')).toHaveText('📌 Main Wallet');
  await expect(page.locator('.ops-pinned-tab button')).toHaveCount(0);
  if (testInfo.project.name.startsWith('mobile')) await page.getByRole('button', { name: 'Full layout', exact: true }).click();
  await expect(page.getByTestId('workspace-jurisdiction')).toBeVisible();
  await screenshotEvidence(page, testInfo, 'ops-embed-full-layout');
  await menu.selectOption('brainvault');
  await expect(page.getByTestId('workspace-brainvault')).toBeVisible();
  await page.getByRole('button', { name: 'Focus panel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Full layout', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.getByTestId('workspace-brainvault').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth;
  })).toBe(true);
  await expect.poll(() => page.getByTestId('workspace-brainvault').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await screenshotEvidence(page, testInfo, 'ops-embed-focused-brainvault');
  await menu.selectOption('architect');
  await expect(page.getByTestId('workspace-architect')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Full layout', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await menu.selectOption('brainvault');
  await expect(page.getByTestId('workspace-brainvault')).toBeVisible();
  const readLayout = () => page.evaluate(() => {
    const saved = localStorage.getItem('xln-workspace-layout');
    if (!saved) return null;
    return JSON.parse(saved);
  });
  await expect.poll(async () => Object.keys((await readLayout())?.dockview.panels ?? {}).length).toBe(15);
  const saved = await readLayout();
  expect(saved.version).toBe('1.0.0');
  expect(saved.dockview.panels['wallet-main'].tabComponent).toBe('pinned-tab');
  const initialGroups = await page.locator('.dv-groupview').count();
  expect(initialGroups).toBe(4);
  await page.reload();
  await expect(page.locator('.dv-tab')).toHaveCount(15);
  await menu.selectOption('brainvault');
  await expect(page.getByTestId('workspace-brainvault')).toBeVisible();
  await screenshotEvidence(page, testInfo, 'ops-embed-restored-layout');
  const beforeInternal = await page.evaluate(() => localStorage.getItem('xln-workspace-layout'));
  await page.goto('/__app/ops/entity-workspace');
  await page.getByRole('button', { name: 'Open Settings panel', exact: true }).click();
  await page.getByRole('button', { name: 'Open Graph3D panel', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('xln-workspace-layout'))).toBe(beforeInternal);
  await page.goto('/embed');
  await expect(page.locator('.dv-tab')).toHaveCount(15);
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  await expect(page.locator('.dv-tab')).toHaveCount(14);
  await expect.poll(async () => Object.keys((await readLayout())?.dockview.panels ?? {}).length).toBe(14);
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});

test('public embed autoplay advances the real recording and pauses on explicit frame selection', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  await page.goto('/embed?scenario=ahb&autoplay=1&speed=4');
  await expect(page).toHaveTitle('xln — ahb scenario');
  const timeline = page.getByTestId('workspace-network-timeline');
  await expect(timeline.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 90_000 });
  const frame = timeline.getByLabel('Network frame', { exact: true });
  await expect.poll(async () => Number(await frame.inputValue())).toBeGreaterThan(0);
  await frame.press('Home');
  await expect(timeline.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(timeline.locator('output')).toContainText('1/126');
  await screenshotEvidence(page, testInfo, 'ops-embed-autoplay-paused');
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});

test('public embed reports malformed trail input visibly while retaining the workspace', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await page.goto('/embed#trail=not-a-recorded-trail');
  await expect(page.getByTestId('workspace-network-timeline').getByRole('alert')).not.toBeEmpty();
  await expect(page.getByLabel('Open workspace panel')).toBeEnabled();
  await page.getByLabel('Open workspace panel').selectOption('architect');
  await expect(page.getByTestId('workspace-architect')).toBeVisible();
  await screenshotEvidence(page, testInfo, 'ops-embed-invalid-trail');
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});

test('public embed diagnoses a corrupt saved layout and resets the complete workspace', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await openWorkspaceStorageOrigin(page);
  await page.evaluate(() => localStorage.setItem('xln-workspace-layout', '{corrupt-layout'));
  await page.goto('/embed');
  const diagnostic = page.getByTestId('ops-workspace').getByRole('alert').filter({ hasText: 'WORKSPACE_LAYOUT_JSON_INVALID' });
  await expect(diagnostic).toBeVisible();
  await expect(page.locator('.dv-tab')).toHaveCount(14);
  await screenshotEvidence(page, testInfo, 'ops-embed-corrupt-layout');
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  await expect(diagnostic).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const saved = localStorage.getItem('xln-workspace-layout');
    return saved ? Object.keys(JSON.parse(saved).dockview.panels).length : 0;
  })).toBe(14);
  await page.reload();
  await expect(page.locator('.dv-tab')).toHaveCount(14);
  await expect(diagnostic).toHaveCount(0);
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});
