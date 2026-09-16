import { expect, test } from '@playwright/test';
import {
  expectPageContained,
  observeBrowserErrors,
  openWorkspaceStorageOrigin,
  screenshotEvidence,
} from '../browser-evidence';
import { installImportedRuntime, readWalletRuntimeFixture } from '../wallet/fixtures/wallet-runtime-test-helpers';

test(
  'Health filters real Runtime events and rejects missing authority on reconnect',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    const fixture = await readWalletRuntimeFixture(page);
    await openWorkspaceStorageOrigin(page);
    await installImportedRuntime(page, fixture);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = observeBrowserErrors(page);
    await page.goto('/health');
    const panel = page.getByTestId('health-runtime-events');
    const feed = page.getByTestId('health-filtered-events');
    await expect(feed.getByTestId('health-runtime-event').first()).toBeVisible({ timeout: 30_000 });
    await expect(panel).toContainText(fixture.runtimeId);
    await expect(panel).toContainText('This is not a complete history.');
    const first = feed.getByTestId('health-runtime-event').first();
    const entities = page.getByTestId('health-runtime-entities');
    const selectedEntity = entities.locator(`[data-entity-id="${fixture.entityId}"]`);
    await expect(selectedEntity).toBeVisible();
    await expect(entities.locator(`[data-entity-id="${fixture.counterpartyEntityId}"]`)).toContainText('hub');
    await expect(selectedEntity.getByRole('link', { name: 'View Entity' })).toHaveAttribute(
      'href',
      `/address/${fixture.entityId}?runtimeId=${encodeURIComponent(fixture.runtimeId)}`,
    );
    await selectedEntity.getByRole('button', { name: 'Copy Entity ID' }).click();
    await expect(selectedEntity.getByRole('button', { name: 'Copied' })).toBeVisible();
    await expect(page.getByTestId('health-flow-edge').first()).toBeVisible();
    expect(await page.getByTestId('health-flow-edge').count()).toBeLessThanOrEqual(12);
    await screenshotEvidence(page, testInfo, 'health-entities-and-flow');
    const eventId = await first.getAttribute('data-event-id');
    expect(eventId).toBeTruthy();
    await page.getByLabel('Search events', { exact: true }).fill(eventId!);
    await expect(feed.getByTestId('health-runtime-event')).toHaveCount(1);
    await first.locator('summary').click();
    await expect(first.locator('pre')).toContainText(eventId!);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'health-runtime-event-details');
    await page.getByLabel('Search events', { exact: true }).fill('no-such-health-event-111');
    await expect(feed).toContainText('No events match filters.');
    await page.getByRole('button', { name: 'Clear event filters' }).click();
    await expect(feed.getByTestId('health-runtime-event').first()).toBeVisible();
    await page.getByRole('combobox', { name: 'Event status', exact: true }).selectOption({ index: 1 });
    await expect(feed.getByTestId('health-runtime-event').first()).toBeVisible();
    await page.getByRole('button', { name: 'Clear event filters' }).click();
    await page.getByLabel('Auto · 4s', { exact: true }).uncheck();
    await panel.getByRole('button', { name: 'Refresh events' }).click();
    await expect(feed.getByTestId('health-runtime-event').first()).toBeVisible();
    await screenshotEvidence(page, testInfo, 'health-runtime-events');

    await page.evaluate(() => sessionStorage.removeItem('xln-runtime-adapter-key'));
    await panel.getByRole('button', { name: 'Refresh events' }).click();
    await expect(panel.getByRole('alert')).toContainText('OPS_ENTITY_REMOTE_AUTH_REQUIRED');
    await expect(feed).toHaveCount(0);
    await expect(entities).toHaveCount(0);
    await expect(page.getByTestId('health-event-flow')).toHaveCount(0);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'health-runtime-authority-required');
    await page.reload();
    await expect(panel.getByRole('alert')).toContainText('OPS_ENTITY_REMOTE_AUTH_REQUIRED');
    await installImportedRuntime(page, fixture);
    await panel.getByRole('button', { name: 'Refresh events' }).click();
    await expect(feed.getByTestId('health-runtime-event').first()).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    // The real fixture supplies Runtime queries, but deliberately has no /api/health.
    await expect(page.getByRole('alert').filter({ hasText: 'OPS_HEALTH_HTTP_404' })).toBeVisible();
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors.length).toBeGreaterThan(0);
    for (const error of errors.consoleErrors) expect(error).toContain('status of 404');
  },
);
