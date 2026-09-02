import { expect, test, type Page } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectOnlyProxyFailures,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

type SiteRouteEvidence = Readonly<{
  id: string;
  pathname: string;
  heading: string | RegExp;
  ready: (page: Page) => Promise<void>;
  proxyFailure?: true;
}>;

const siteRoutes: readonly SiteRouteEvidence[] = [
  { id: 'site-install', pathname: '/install', heading: /Own the\s+runtime\./i, ready: async page => expect(page.getByTestId('install-primary-command').first()).toBeVisible() },
  { id: 'site-rcpan', pathname: '/rcpan', heading: /A balance\s+you can take\s+to court\./i, ready: async page => expect(page.locator('.settlement-waterfall')).toContainText('Every token conserved during finalization') },
  { id: 'site-releases', pathname: '/releases', heading: 'Releases', ready: async page => expect(page.getByText(/Foundation code root verified/i)).toBeVisible() },
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
  { id: 'site-market-cap', pathname: '/market-cap', heading: 'xln Market Cap', proxyFailure: true, ready: async page => {
    await expect(page.locator('.market-eyebrow')).toContainText('Feed unavailable');
    await expect(page.locator('.market-eyebrow')).toHaveClass(/is-error/);
    await expect(page.getByRole('alert')).toContainText('Live valuation is unavailable');
    await expect(page.getByRole('alert')).toContainText('DEVELOPMENT_GATEWAY_PROXY_FAILED');
  } },
];

for (const route of siteRoutes) {
  test(`${route.pathname} exposes its complete site state`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = observeBrowserErrors(page);
    const response = await page.goto(route.pathname, { waitUntil: 'networkidle' });
    expect(response?.ok(), `document response for ${route.pathname}`).toBe(true);
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await route.ready(page);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, route.id);
    if (route.proxyFailure) expectOnlyProxyFailures(errors);
    else expectNoBrowserErrors(errors);
  });
}
