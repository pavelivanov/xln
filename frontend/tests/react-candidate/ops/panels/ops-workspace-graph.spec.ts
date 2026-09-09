import { openWorkspaceStorageOrigin } from '../../browser-evidence';
import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import { screenshotGraphEvidence } from '../../graph-evidence';
import { installImportedRuntime, readWalletRuntimeFixture } from '../../wallet/fixtures/wallet-runtime-test-helpers';

test('Graph3D shares the real Runtime and retains a replay timeline across close and reopen', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await openWorkspaceStorageOrigin(page);
  await installImportedRuntime(page, fixture);
  await page.goto('/__app/ops/entity-workspace');
  await page.getByRole('button', { name: 'Open Graph3D panel' }).click();
  const graph = page.getByTestId('workspace-graph');
  await expect(graph).toHaveAttribute('data-node-count', '2');
  await expect(graph).not.toHaveAttribute('data-account-count', '0', { timeout: 20_000 });
  await expect(graph.locator('canvas')).toBeVisible();
  await graph.getByLabel('Graph Entity').selectOption(fixture.entityId);
  await expect(graph.locator('.ops-graph-selection')).toContainText(fixture.entityId);
  await graph.getByRole('button', { name: 'Fit network' }).click();
  await graph.getByRole('button', { name: 'Bars: close' }).click();
  await page.getByRole('button', { name: 'Load timeline' }).click();
  const timeline = page.getByTestId('workspace-network-timeline');
  await expect(timeline.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await timeline.getByRole('button', { name: 'Next network frame' }).click();
  await expect(timeline.locator('output')).toContainText('1/');
  await expect(graph.getByText('Recorded frame', { exact: true })).toBeVisible();
  const range = timeline.getByLabel('Network frame', { exact: true });
  await range.focus();
  await range.press('End');
  await expect(graph).not.toHaveAttribute('data-account-count', '0', { timeout: 20_000 });
  await graph.getByLabel('Graph Account', { exact: true }).selectOption({ index: 1 });
  await expect(graph.getByTestId('graph-account-selection')).toContainText('1 Runtime sources');
  const selectedFrameLabel = await timeline.locator('output').textContent();
  await screenshotGraphEvidence(page, testInfo, 'ops-graph-history');
  await page.locator('.dv-default-tab').filter({ hasText: 'Graph3D' }).locator('.dv-default-tab-action').click();
  await expect(graph).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Graph3D panel' }).click();
  await expect(graph.locator('canvas')).toBeVisible();
  await expect(timeline.locator('output')).toHaveText(selectedFrameLabel ?? '');
  await timeline.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(timeline.locator('output')).toHaveText('Live');
  await expectPageContained(page);
  await screenshotGraphEvidence(page, testInfo, 'ops-graph-reopened');
  expectNoBrowserErrors(errors);
});

test('scenario playback boots without a wallet or live connection', { tag: '@functional' }, async ({ page, context }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  await page.goto('/embed?scenario=ahb&speed=2');
  const timeline = page.getByTestId('workspace-network-timeline');
  await expect(timeline.locator('output')).toContainText('1/', { timeout: 90_000 });
  await expect(page.getByTestId('workspace-graph')).not.toHaveAttribute('data-node-count', '0');
  await expect(timeline.getByLabel('Playback speed')).toHaveValue('2');
  await expect(timeline.getByRole('button', { name: 'Load timeline' })).toHaveCount(0);
  await timeline.getByRole('button', { name: 'Next network frame' }).click();
  await expect(timeline.locator('output')).toContainText('2/');
  const graph = page.getByTestId('workspace-graph');
  const range = timeline.getByLabel('Network frame', { exact: true });
  await range.focus();
  await range.press('End');
  await expect(graph).not.toHaveAttribute('data-account-count', '0');
  await expect(graph).toHaveAttribute('data-jurisdiction-count', '1');
  await graph.getByLabel('Graph Account', { exact: true }).selectOption({ index: 1 });
  await expect(graph.getByTestId('graph-account-selection')).toContainText('1 Runtime sources');
  await graph.getByRole('button', { name: 'Bars: close' }).click();
  await expect(graph.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  await screenshotGraphEvidence(page, testInfo, 'ops-scenario-playback');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await timeline.getByRole('button', { name: 'Copy trail link' }).click();
  const trailUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(trailUrl).toContain('/embed#trail=');
  const replay = new URL(trailUrl);
  replay.search = '?scenario=unknown-scenario&speed=4';
  await page.goto(replay.href);
  await expect(timeline.locator('output')).toContainText('1/');
  await expect(timeline.getByLabel('Playback speed')).toHaveValue('4');
  await expect(graph).toHaveAttribute('data-node-count', '3');
  expect(await page.evaluate(() => localStorage.getItem('xln-vaults'))).toBeNull();
  await range.focus();
  await range.press('End');
  await expect(graph).not.toHaveAttribute('data-account-count', '0');
  await expectPageContained(page);
  await expect(graph.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  await screenshotGraphEvidence(page, testInfo, 'ops-trail-replay');
  expectNoBrowserErrors(errors);
});

test('Graph3D retains camera and view controls without overwriting the full workspace layout', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  await openWorkspaceStorageOrigin(page);
  const layout = '{"retained-full-workspace":"owner-layout"}';
  await page.evaluate(savedLayout => {
    localStorage.setItem('xln-workspace-layout', savedLayout);
    localStorage.setItem('xln-view-settings', JSON.stringify({ gridOpacity: 0.23, forceLayoutEnabled: false }));
    localStorage.setItem('xln-bird-view-settings', JSON.stringify({
      barsMode: 'close', selectedTokenId: 1, viewMode: '3d', entityMode: 'sphere', wasLastOpened: true,
      rotationX: 17, rotationY: 0, rotationZ: 0,
      camera: { position: { x: 0, y: 60, z: 90 }, target: { x: 0, y: 0, z: 0 }, zoom: 1 },
    }));
  }, layout);
  await page.goto('/__app/ops/entity-workspace?scenario=ahb');
  const graph = page.getByTestId('workspace-graph');
  const timeline = page.getByTestId('workspace-network-timeline');
  await expect(timeline.locator('output')).toContainText('1/', { timeout: 90_000 });
  const range = timeline.getByLabel('Network frame', { exact: true });
  await range.focus();
  await range.press('End');
  await expect(graph).not.toHaveAttribute('data-account-count', '0');
  await expect(graph.getByRole('button', { name: 'Force layout', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await graph.getByRole('button', { name: 'Force layout', exact: true }).click();
  await graph.getByRole('button', { name: 'Bars: close' }).click();
  // The real AHB scenario funds USDC only. Registry tokens without Entity
  // reserves do not become size-selector options.
  await expect(graph.getByLabel('Graph size token').locator('option')).toHaveText(['Size: Token #1']);
  await graph.getByLabel('Graph size token').selectOption('1');
  await graph.getByLabel('Graph canonicity').selectOption('height');
  await graph.getByRole('button', { name: 'Auto rotate', exact: true }).click();
  await expect(graph.getByRole('button', { name: 'Auto rotate', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await graph.getByRole('button', { name: 'Auto rotate', exact: true }).click();
  await graph.getByRole('button', { name: 'Fit network' }).click();
  await expect(graph.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  const stored = await page.evaluate(() => ({
    bird: JSON.parse(localStorage.getItem('xln-bird-view-settings') || 'null'),
    view: JSON.parse(localStorage.getItem('xln-view-settings') || 'null'),
    canonicity: localStorage.getItem('xln-graph-canonicity'),
    layout: localStorage.getItem('xln-workspace-layout'),
  }));
  expect(stored.bird).toMatchObject({ barsMode: 'spread', selectedTokenId: 1, rotationX: 17, wasLastOpened: true });
  expect(stored.bird.camera).toMatchObject({ zoom: 1 });
  expect(stored.view).toMatchObject({ gridOpacity: 0.23, forceLayoutEnabled: true, autoRotate: false });
  expect(stored.canonicity).toBe('height');
  expect(stored.layout).toBe(layout);
  await screenshotGraphEvidence(page, testInfo, 'ops-graph-saved-controls');
  await page.locator('.dv-default-tab').filter({ hasText: 'Graph3D' }).locator('.dv-default-tab-action').click();
  await expect(graph).toHaveCount(0);
  const closedCamera = await page.evaluate(() => JSON.parse(localStorage.getItem('xln-bird-view-settings') || 'null').camera);
  await page.getByRole('button', { name: 'Open Graph3D panel' }).click();
  await expect(graph.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  await expect(graph.getByRole('button', { name: 'Bars: spread' })).toBeVisible();
  await expect(graph.getByLabel('Graph size token')).toHaveValue('1');
  await expect(graph.getByLabel('Graph canonicity')).toHaveValue('height');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('xln-bird-view-settings') || 'null').camera)).toEqual(closedCamera);
  await expectPageContained(page);
  await screenshotGraphEvidence(page, testInfo, 'ops-graph-restored-controls');
  expectNoBrowserErrors(errors);
});

test('selected Runtime frames drive controlled effects and exact renderer/XR capability state', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  await openWorkspaceStorageOrigin(page);
  await page.evaluate(() => localStorage.setItem('xln-view-settings', JSON.stringify({
    lightningEnabled: true,
    lightningSpeed: 500,
    broadcastEnabled: true,
    broadcastStyle: 'wave',
    rendererMode: 'webgl',
    vrScaleMultiplier: 1,
  })));
  await page.goto('/__app/ops/entity-workspace?scenario=ahb');
  const graph = page.getByTestId('workspace-graph');
  const canvasOwner = graph.locator('.ops-graph-canvas');
  const timeline = page.getByTestId('workspace-network-timeline');
  const range = timeline.getByLabel('Network frame', { exact: true });
  await expect(timeline.locator('output')).toContainText('1/', { timeout: 90_000 });
  await expect(canvasOwner).toHaveAttribute('data-renderer-mode', 'webgl');
  await expect(graph.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  const xrEntry = graph.getByRole('button', { name: 'Enter VR', exact: true });
  await expect(xrEntry).toBeDisabled();
  await expect(xrEntry).toHaveAttribute('title', 'VR not supported on this device');

  const frameCount = Number(await range.getAttribute('max')) + 1;
  const observed = new Set<string>();
  let lightningFrame = -1;
  let broadcastFrame = -1;
  for (let index = 0; index < frameCount && (!observed.has('lightning') || !observed.has('wave')); index += 1) {
    await range.fill(String(index));
    await expect(graph).toHaveAttribute('data-selected-step-index', String(index));
    await expect(canvasOwner).toHaveAttribute('data-rendered-step-index', String(index));
    await expect(graph.locator('canvas')).toHaveAttribute('aria-busy', 'false');
    for (const kind of (await canvasOwner.getAttribute('data-effect-emitted-kinds') ?? '').split(',').filter(Boolean)) {
      observed.add(kind);
      if (kind === 'lightning') lightningFrame = index;
      if (kind === 'wave') broadcastFrame = index;
    }
  }
  expect([...observed].sort()).toEqual(['lightning', 'wave']);
  expect(lightningFrame).toBeGreaterThanOrEqual(0);
  expect(broadcastFrame).toBeGreaterThanOrEqual(0);
  await range.fill(String(broadcastFrame));

  await page.getByRole('button', { name: 'Open Settings panel', exact: true }).click();
  const settings = page.getByTestId('workspace-settings');
  const graphTab = page.locator('.dv-default-tab').filter({ hasText: 'Graph3D' });
  const settingsTab = page.locator('.dv-default-tab').filter({ hasText: /^Settings$/ });
  await settings.getByRole('button', { name: 'Effects', exact: true }).click();
  await settings.getByRole('checkbox', { name: 'Enable jurisdiction broadcast', exact: true }).uncheck();
  await graphTab.click();
  await expect(canvasOwner).not.toHaveAttribute('data-effect-emitted-kinds', /wave/);
  await settingsTab.click();
  await settings.getByRole('checkbox', { name: 'Enable jurisdiction broadcast', exact: true }).check();
  await settings.getByRole('radio', { name: 'particles', exact: true }).check();
  await graphTab.click();
  await expect(canvasOwner).toHaveAttribute('data-effect-emitted-kinds', /particles/);
  await screenshotGraphEvidence(page, testInfo, 'ops-graph-particle-effect');
  await range.fill(String(lightningFrame));
  await settingsTab.click();
  await settings.getByRole('checkbox', { name: 'Enable lightning animation', exact: true }).uncheck();
  await graphTab.click();
  await expect(canvasOwner).not.toHaveAttribute('data-effect-emitted-kinds', /lightning/);
  await settingsTab.click();
  await settings.getByLabel('Lightning duration (ms)', { exact: true }).fill('420');
  await settings.getByRole('button', { name: 'Performance', exact: true }).click();
  await settings.getByLabel('XR graph scale', { exact: true }).fill('2');
  const renderer = settings.getByLabel('Renderer', { exact: true });
  await renderer.selectOption('webgpu');
  await expect(renderer).toHaveValue('webgpu');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('xln-view-settings') || 'null')?.rendererMode)).toBe('webgpu');
  await graphTab.click();
  await expect(graph).toHaveAttribute('data-renderer-request', 'webgpu');
  let rendererOutcome = '';
  await expect.poll(async () => {
    rendererOutcome = await canvasOwner.getAttribute('data-renderer-mode') === 'webgpu'
      ? 'webgpu'
      : (await graph.getByRole('alert').textContent().catch(() => '')) ?? '';
    return rendererOutcome;
  }, { timeout: 20_000 }).toMatch(/^(webgpu|GRAPH_WEBGPU_(UNSUPPORTED|INITIALIZATION_FAILED:.*))$/);
  await expect(canvasOwner).not.toHaveAttribute('data-renderer-mode', 'webgl');
  const capabilities = await page.evaluate(() => ({
    navigatorGpu: Boolean(navigator.gpu), navigatorXr: Boolean(navigator.xr), webdriver: navigator.webdriver,
  }));
  await testInfo.attach('graph-renderer-xr-capability', {
    body: JSON.stringify({ ...capabilities, rendererOutcome, xrEntryDisabled: await xrEntry.isDisabled() }, null, 2),
    contentType: 'application/json',
  });
  await settingsTab.click();
  await renderer.selectOption('webgl');
  await expect(renderer).toHaveValue('webgl');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('xln-view-settings') || 'null')?.rendererMode)).toBe('webgl');
  await graphTab.click();
  await expect(graph).toHaveAttribute('data-renderer-request', 'webgl');
  await expect(canvasOwner).toHaveAttribute('data-renderer-mode', 'webgl');
  await expect(graph.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  await screenshotGraphEvidence(page, testInfo, 'ops-graph-effects-capability');

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('xln-view-settings') || 'null'));
  expect(stored).toMatchObject({
    lightningEnabled: false, lightningSpeed: 420, broadcastEnabled: true,
    broadcastStyle: 'particles', rendererMode: 'webgl', vrScaleMultiplier: 2,
  });
  await page.locator('.dv-default-tab').filter({ hasText: 'Graph3D' }).locator('.dv-default-tab-action').click();
  await expect(graph).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Graph3D panel', exact: true }).click();
  await expect(canvasOwner).toHaveAttribute('data-renderer-mode', 'webgl');
  await expect(graph.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});

test('Graph3D drags an Entity with real pointer input and opens it on double click', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const errors = observeBrowserErrors(page);
  await page.goto('/__app/ops/entity-workspace?scenario=ahb');
  const graph = page.getByTestId('workspace-graph');
  const timeline = page.getByTestId('workspace-network-timeline');
  await expect(timeline.locator('output')).toContainText('1/', { timeout: 90_000 });
  await timeline.getByLabel('Network frame', { exact: true }).focus();
  await timeline.getByLabel('Network frame', { exact: true }).press('End');
  await graph.getByRole('button', { name: 'Fit network' }).click();
  await expect(graph.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  const box = await graph.locator('canvas').boundingBox();
  if (!box) throw new Error('GRAPH_CANVAS_BOUNDS_REQUIRED');
  let point: { x: number; y: number } | null = null;
  // Find a visible Entity through the actual hover UI, without reaching into
  // renderer internals or introducing a test-only scene bridge.
  const offsets = [0, -16, 16, -32, 32, -48, 48, -64, 64, -80, 80, -96, 96];
  search: for (const y of offsets) for (const x of offsets) {
    const candidate = { x: box.x + box.width / 2 + x, y: box.y + box.height / 2 + y };
    if (candidate.x <= box.x || candidate.x >= box.x + box.width || candidate.y <= box.y || candidate.y >= box.y + box.height) continue;
    await page.mouse.move(candidate.x, candidate.y);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    const tooltip = graph.getByRole('tooltip');
    if (await tooltip.count() && await tooltip.getAttribute('data-kind') === 'entity') { point = candidate; break search; }
  }
  if (!point) throw new Error('GRAPH_VISIBLE_ENTITY_HOVER_REQUIRED');
  const destination = { x: Math.min(box.x + box.width - 12, point.x + 40), y: point.y - 24 };
  await page.mouse.down();
  await page.mouse.move(destination.x, destination.y, { steps: 8 });
  await page.mouse.up();
  const entityId = await graph.getByLabel('Graph Entity', { exact: true }).inputValue();
  expect(entityId).not.toBe('');
  const position = await page.evaluate(id => JSON.parse(localStorage.getItem('xln-graph-position-overrides-v1') || '{}')[id], entityId);
  expect(Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)).toBe(true);
  await screenshotGraphEvidence(page, testInfo, 'ops-graph-entity-drag');
  await graph.getByRole('button', { name: 'Close graph selection' }).click();
  await page.mouse.dblclick(destination.x, destination.y);
  await expect(page.locator(`.workspace-entity-pane[data-entity-id="${entityId}"]`)).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-graph-double-click-entity');
  expectNoBrowserErrors(errors);
});
