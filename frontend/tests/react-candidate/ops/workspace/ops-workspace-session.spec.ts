import { openWorkspaceStorageOrigin } from '../../browser-evidence';
import { expect, test, type WebSocket } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from '../../browser-evidence';
import {
  installImportedRuntime,
  readWalletRuntimeFixture,
  seedWalletOverfullActivity,
} from '../../wallet/fixtures/wallet-runtime-test-helpers';

test(
  'Entity panels keep independent selection, navigation and history on one real Runtime connection',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    const errors = observeBrowserErrors(page);
    const fixture = await readWalletRuntimeFixture(page);
    const overfull = await seedWalletOverfullActivity(page, `ops-${testInfo.project.name}`);
    await openWorkspaceStorageOrigin(page);
    await installImportedRuntime(page, fixture);
    const sockets: WebSocket[] = [];
    page.on('websocket', socket => {
      if (socket.url() === fixture.wsUrl) sockets.push(socket);
    });
    await page.goto('/__app/ops/entity-workspace#accounts');
    const primary = page.locator('.workspace-entity-pane:not([data-entity-id])');
    await expect(primary.getByTestId('entity-workspace-shell')).toHaveAttribute('data-read-status', 'ready');
    const primaryEntity = await primary.getByTestId('entity-workspace-shell').getAttribute('data-entity-id');
    if (!primaryEntity) throw new Error('PRIMARY_ENTITY_REQUIRED');
    const peerEntityId = primaryEntity === fixture.entityId ? fixture.counterpartyEntityId : fixture.entityId;
    await page.getByRole('button', { name: 'Open Gossip panel' }).click();
    const directory = page.getByTestId('runtime-gossip-panel');
    await directory.getByRole('searchbox').fill(peerEntityId);
    const peerTitle = await directory.locator('article strong').innerText();
    await directory.getByRole('button', { name: /^Open Entity / }).click();
    const peer = page.locator(`.workspace-entity-pane[data-entity-id="${peerEntityId}"]`);
    await expect(peer.getByTestId('entity-workspace-shell')).toHaveAttribute('data-read-status', 'ready');
    await expect(peer.getByTestId('entity-workspace-shell')).toHaveAttribute('data-entity-id', peerEntityId);
    const fixturePane = primaryEntity === fixture.entityId ? primary : peer;
    if (primaryEntity === fixture.entityId) {
      await page.getByRole('button', { name: 'Open Entity panel', exact: true }).click();
    }
    await fixturePane.getByTestId('entity-workspace-tab-accounts').click();
    await expect(fixturePane.getByTestId('entity-activity-mode-infinite')).toBeVisible();
    await fixturePane.getByTestId('entity-activity-mode-infinite').click();
    const fixtureActivityRows = fixturePane.getByTestId('entity-activity-event');
    const readFixtureActivityIds = async () => (await fixtureActivityRows.evaluateAll(rows =>
      rows.map(row => row.getAttribute('data-event-id')).filter((id): id is string => Boolean(id))))
      .filter(id => overfull.ids.includes(id));
    for (let pageIndex = 0; pageIndex < 8 && (await readFixtureActivityIds()).length < overfull.ids.length; pageIndex += 1) {
      const before = (await readFixtureActivityIds()).length;
      await fixturePane.getByTestId('entity-activity-load-older').click();
      await expect.poll(async () => (await readFixtureActivityIds()).length).toBeGreaterThan(before);
    }
    const loadedFixtureIds = await readFixtureActivityIds();
    expect(loadedFixtureIds).toEqual(overfull.ids);
    expect(new Set(loadedFixtureIds).size).toBe(overfull.ids.length);
    await screenshotEvidence(page, testInfo, 'ops-overfull-activity-paging');
    const peerTab = page.locator('.dv-default-tab').filter({ hasText: peerTitle });
    await peerTab.click();
    await expect(peer.getByTestId('entity-workspace-shell')).toHaveAttribute('data-read-status', 'ready');
    await peer.getByTestId('entity-workspace-tab-settings').click();
    await peer.getByRole('link', { name: 'Display', exact: true }).click();
    await peer.getByRole('checkbox', { name: /Time Machine/i }).check();
    const input = peer.getByTestId('time-machine-remote-height');
    const latest = Number(await input.getAttribute('max'));
    expect(latest).toBeGreaterThan(1);
    const historyHeight = 1;
    await input.fill(String(historyHeight));
    await peer.getByTestId('time-machine-remote-scan-button').click();
    await expect(peer.getByTestId('entity-workspace-time-machine')).toHaveAttribute('data-mode', 'history');
    // The deterministic base frame predates optional fixtures that intentionally
    // install extra browser-only jurisdictions outside the production WAL.
    await expect(peer.getByTestId('time-machine-mode')).toHaveText(`History · h${historyHeight}`, { timeout: 15_000 });
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue(String(historyHeight));
    await expect(peer.getByTestId('entity-workspace-shell')).toHaveAttribute('data-read-status', 'ready');
    await screenshotEvidence(page, testInfo, 'ops-peer-entity-history');
    expect(new URL(page.url()).hash).toBe('#accounts');
    await page.getByRole('button', { name: 'Open Entity panel', exact: true }).click();
    await expect(primary.getByTestId('entity-workspace-shell')).toHaveAttribute('data-active-tab', 'accounts');
    await expect(primary.getByTestId('entity-workspace-shell')).toHaveAttribute('data-entity-id', primaryEntity);
    await expect(primary.getByTestId('entity-workspace-time-machine')).toHaveAttribute('data-mode', 'live');
    expect(sockets).toHaveLength(1);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'ops-independent-entity-panels');
    await page.getByRole('button', { name: 'Open Gossip panel' }).click();
    await directory.getByRole('button', { name: /^Open Entity / }).click();
    await expect(peer).toHaveCount(1);
    await expect(peer.getByTestId('entity-workspace-time-machine')).toHaveAttribute('data-mode', 'history');
    await expect(peer.getByTestId('time-machine-mode')).toHaveText(`History · h${historyHeight}`);
    await peerTab.locator('.dv-default-tab-action').click();
    await expect(peer).toHaveCount(0);
    await page.getByRole('button', { name: 'Open Entity panel', exact: true }).click();
    await expect(primary.getByTestId('entity-workspace-shell')).toHaveAttribute('data-read-status', 'ready');
    expect(sockets).toHaveLength(1);
    await openWorkspaceStorageOrigin(page);
    await expect
      .poll(async () => {
        const response = await page.request.get(fixture.wsUrl.replace('ws:', 'http:').replace('/rpc', '/connections'));
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('active' in result))
          throw new Error('FIXTURE_CONNECTION_COUNT_INVALID');
        return result.active;
      })
      .toBe(0);
    expectNoBrowserErrors(errors);
  },
);
