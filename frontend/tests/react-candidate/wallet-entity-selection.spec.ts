import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';
import { selectWalletFixtureRuntime } from './wallet-runtime-test-helpers';

const surfaces = [
  { query: 'portfolio=1', heading: 'Assets & accounts', section: '.wallet-portfolio' },
  { query: 'health=1', heading: 'Financial health', section: '.wallet-health' },
  { query: 'payments=1', heading: 'Payments', section: '.wallet-payments' },
  { query: 'markets=1', heading: 'Markets', section: '.wallet-markets' },
] as const;

for (const surface of surfaces) test(`${surface.heading} keeps the latest Entity when selection reverses before a real read returns`, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto(`/app?${surface.query}`);
  await expect(page.getByRole('heading', { name: surface.heading, exact: true })).toBeVisible();
  const entity = page.getByLabel('Entity', { exact: true });
  const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
  await expect(refresh).toBeEnabled();
  const first = await entity.inputValue();
  const second = first === fixture.entityId ? fixture.counterpartyEntityId : fixture.entityId;
  // Both native change events run in one browser task, before WebSocket replies
  // can deliver either real read. No response is intercepted or fabricated.
  const transitions = await entity.evaluate((element, { ids, section }) => {
    if (!(element instanceof HTMLSelectElement)) throw new Error('WALLET_ENTITY_SELECT_REQUIRED');
    return ids.map(id => {
      element.value = id;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return { selected: element.value, loadingSelection: element.closest(section)?.textContent?.includes('Loading selected Entity…') ?? false };
    });
  }, { ids: [second, first], section: surface.section });
  expect(transitions).toEqual([{ selected: second, loadingSelection: true }, { selected: first, loadingSelection: false }]);
  await expect(refresh).toBeEnabled();
  await expect(entity).toHaveValue(first);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, `entity-selection-${surface.query.split('=')[0]}`);
  await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('link', { name: surface.query === 'portfolio=1' ? 'Health' : 'Assets', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(first);
  expectNoBrowserErrors(errors);
});
