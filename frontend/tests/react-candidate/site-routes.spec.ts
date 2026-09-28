import { expect, test, type Page } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectOnlyHttpFailures,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

type SiteRouteEvidence = Readonly<{
  id: string;
  pathname: string;
  heading: string | RegExp;
  ready: (page: Page) => Promise<void>;
  expectedHttpFailure?: number;
}>;

const marketFailure = process.env['PLAYWRIGHT_REACT_SURFACE'] === ''
  ? { code: 'NOT_FOUND', status: 404 }
  : { code: 'DEVELOPMENT_GATEWAY_PROXY_FAILED', status: 502 };

const siteRoutes: readonly SiteRouteEvidence[] = [
  { id: 'site-install', pathname: '/install', heading: /Own the\s+runtime\./i, ready: async page => expect(page.getByTestId('install-primary-command').first()).toBeVisible() },
  { id: 'site-rcpan', pathname: '/rcpan', heading: /A balance\s+you can take\s+to court\./i, ready: async page => expect(page.locator('.settlement-waterfall')).toContainText('Every token conserved during finalization') },
  { id: 'site-releases', pathname: '/releases', heading: /^Releases$/i, ready: async page => {
    await expect(page.getByText('22 signed codebase snapshots · latest 0.1.31')).toBeVisible();
    await expect(page.locator('.verification.is-verified')).toHaveText('✓ Foundation code root verified');
    await expect(page.getByRole('complementary', { name: 'Release versions' }).getByRole('button', { name: /^0\.1\.31 / })).toHaveClass(/is-active/);
    await expect(page.getByRole('article')).toContainText('Foundation Hanko: VERIFIED 2/3');
  } },
  { id: 'site-reviews', pathname: '/reviews', heading: /AI reviews\s+of xln\./i, ready: async page => {
    const prompt = page.getByRole('button', { name: /Why Lightning failed but xln won't/i });
    await prompt.click();
    await expect(prompt).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 2, name: "Why Lightning failed but xln won't" })).toBeVisible();
  } },
  { id: 'site-unicast', pathname: '/unicast', heading: /Why broadcast\s+dies at scale\./i, ready: async page => {
    await page.getByLabel('Network TPS').fill('1000');
    await expect(page.locator('.network-insight')).toContainText('Broadcast collapses toward six operators.');
  } },
  { id: 'site-market-cap', pathname: '/market-cap', heading: 'xln Market Cap', expectedHttpFailure: marketFailure.status, ready: async page => {
    await expect(page.locator('.market-eyebrow')).toContainText('Feed unavailable');
    await expect(page.locator('.market-eyebrow')).toHaveClass(/is-error/);
    await expect(page.getByRole('alert')).toContainText('Live valuation is unavailable');
    await expect(page.getByRole('alert')).toContainText(marketFailure.code);
  } },
];

for (const route of siteRoutes) {
  test(`${route.pathname} exposes its complete site state`, { tag: '@functional' }, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = observeBrowserErrors(page);
    const response = await page.goto(route.pathname, { waitUntil: 'networkidle' });
    expect(response?.ok(), `document response for ${route.pathname}`).toBe(true);
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await route.ready(page);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, route.id);
    if (route.expectedHttpFailure) expectOnlyHttpFailures(errors, route.expectedHttpFailure);
    else expectNoBrowserErrors(errors);
  });
}

test('/market-cap anchors every select indicator', { tag: '@functional' }, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/market-cap', { waitUntil: 'networkidle' });
  expect(response?.ok()).toBe(true);
  const selectAnchors = page.locator('.market-select-anchor');
  await expect(selectAnchors).toHaveCount(6);
  expect(await selectAnchors.evaluateAll((anchors) => anchors.every((anchor) => {
    const select = anchor.querySelector('select');
    const indicator = getComputedStyle(anchor, '::after');
    if (!select) return false;
    const anchorBounds = anchor.getBoundingClientRect();
    const selectBounds = select.getBoundingClientRect();
    return getComputedStyle(select).appearance === 'none'
      && indicator.right === '13px'
      && indicator.pointerEvents === 'none'
      && anchorBounds.width === selectBounds.width
      && anchorBounds.height === selectBounds.height;
  }))).toBe(true);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'site-market-cap-select-anchors');
  if (await page.getByRole('alert').isVisible()) expectOnlyHttpFailures(errors, marketFailure.status);
  else expectNoBrowserErrors(errors);
});
