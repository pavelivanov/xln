import { openWorkspaceStorageOrigin } from '../../browser-evidence';
import { expect, test } from '@playwright/test';
import { readWalletRuntimeFixture } from '../../wallet/fixtures/wallet-runtime-test-helpers';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';

test('workspace language and guide retain preferences, keyboard placement and focus', { tag: '@functional' }, async ({ page }, testInfo) => {
  await readWalletRuntimeFixture(page);
  const errors = observeBrowserErrors(page);
  await openWorkspaceStorageOrigin(page);
  await page.evaluate(() => localStorage.setItem('xln-settings', JSON.stringify({ showXlnMascot: true, unrelatedPreference: 'preserve-me' })));
  await page.goto('/__app/ops/entity-workspace');
  const locale = page.locator('.ops-locale-selector select');
  await expect(locale.locator('option')).toHaveCount(10);
  await locale.selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(locale.locator('..')).toContainText('\u042f\u0437\u044b\u043a');
  await page.reload();
  await expect(locale).toHaveValue('ru');
  const guide = page.getByTestId('xln-mascot-toggle');
  await guide.focus();
  await guide.press('Shift+ArrowLeft');
  await expect.poll(() => guide.evaluate(element => Math.round(element.getBoundingClientRect().left))).toBe(12);
  await guide.press('ArrowUp');
  // StrictMode cancels its first catalog subscription; inspect a completed request.
  const catalogRequest = page.waitForEvent('requestfinished', { predicate: request => new URL(request.url()).pathname === '/api/assistant/models' });
  await guide.press('Enter');
  const catalog = await (await catalogRequest).response();
  if (!catalog) throw new Error('ASSISTANT_CATALOG_RESPONSE_MISSING');
  expect(catalog.status()).toBe(200);
  expect(catalog.headers()['content-type']).toContain('application/json');
  expect((await catalog.json()).provider).toBe('local');
  const chat = page.getByTestId('xln-mascot-chat');
  await expect(chat).toBeVisible();
  await expect(chat.getByLabel('Ask xln', { exact: true })).toBeFocused();
  await expect(chat.getByRole('button', { name: 'Retry local AI' })).toBeEnabled();
  // Exercise the actual assistant proxy. Offline responses stay visible and do
  // not get replaced with a fabricated catalog or assistant response.
  await expect.poll(async () => (await chat.locator('.identity small').textContent()) ?? '')
    .toMatch(/Local AI (offline|· public docs)/);
  const assistantStatus = await chat.locator('.identity small').textContent();
  if (assistantStatus?.includes('offline')) {
    await expect(chat.getByRole('alert')).toBeVisible();
    await expect(chat.getByRole('button', { name: 'Send question' })).toBeDisabled();
    await expect(chat.getByRole('link', { name: 'Open local AI' })).toHaveAttribute('href', '/ai');
  } else await expect(chat.locator('.identity small')).toContainText('Local AI · public docs');
  await screenshotEvidence(page, testInfo, 'ops-guide-open');
  await chat.getByLabel('Ask xln', { exact: true }).press('Escape');
  await expect(chat).toHaveCount(0);
  await expect(guide).toBeFocused();
  await page.reload();
  await expect.poll(() => guide.evaluate(element => Math.round(element.getBoundingClientRect().left))).toBe(12);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('xln-settings') || '{}').unrelatedPreference)).toBe('preserve-me');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-guide-docked');
  expectNoBrowserErrors(errors);
});

test('guide context follows the exact selected Runtime frame and is released on close', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  await page.addInitScript(() => localStorage.setItem('xln-settings', JSON.stringify({ showXlnMascot: true })));
  await page.goto('/__app/ops/entity-workspace?scenario=ahb');
  const timeline = page.getByTestId('workspace-network-timeline');
  await expect(timeline.locator('output')).toContainText('1/', { timeout: 90_000 });
  await page.getByTestId('xln-mascot-toggle').click();
  const chat = page.getByTestId('xln-mascot-chat');
  await expect(chat).toHaveAttribute('data-guide-context', /^scenario:ahb:h\d+:/);
  const firstContext = await chat.getAttribute('data-guide-context');
  await expect(chat.locator('.identity small')).toContainText('scenario:ahb');
  const range = timeline.getByLabel('Network frame', { exact: true });
  await range.press('End');
  await expect(chat).not.toHaveAttribute('data-guide-context', firstContext ?? '');
  await expect(chat.locator('.transcript article')).toHaveCount(0);
  await screenshotEvidence(page, testInfo, 'ops-guide-selected-frame-context');
  await chat.getByRole('button', { name: 'Close xln assistant' }).click();
  await expect(chat).toHaveCount(0);
  await expect(page.getByTestId('xln-mascot-toggle')).toBeFocused();
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});

test('guide streams a real selected-frame answer and aborts on context change', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(180_000);
  const errors = observeBrowserErrors(page);
  await page.addInitScript(() => localStorage.setItem('xln-settings', JSON.stringify({ showXlnMascot: true })));
  await page.goto('/__app/ops/entity-workspace?scenario=ahb');
  const timeline = page.getByTestId('workspace-network-timeline');
  await expect(timeline.locator('output')).toContainText('1/', { timeout: 90_000 });
  await page.getByTestId('xln-mascot-toggle').click();
  const chat = page.getByTestId('xln-mascot-chat');
  await expect(chat.locator('.identity small')).toContainText('Local AI · public docs', { timeout: 15_000 });
  const context = await chat.getAttribute('data-guide-context');
  expect(context).toMatch(/^scenario:ahb:h\d+:/);

  const answerRequest = page.waitForRequest(request =>
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/assistant/chat');
  await chat.getByLabel('Ask xln', { exact: true }).fill('Reply with exactly: selected frame acknowledged.');
  await chat.getByRole('button', { name: 'Send question' }).click();
  const request = await answerRequest;
  const payload = request.postDataJSON() as { messages?: readonly { content?: string }[] };
  expect(payload.messages?.some(message => message.content?.includes('CURRENT SCREEN CONTEXT'))).toBe(true);
  expect(payload.messages?.some(message => message.content?.includes('recorded Runtime scenario:ahb at committed height'))).toBe(true);
  const reply = chat.locator('article.assistant').last();
  await expect(reply).toContainText(/selected frame acknowledged/i, { timeout: 120_000 });
  await expect(chat.getByRole('button', { name: 'Stop answer' })).toHaveCount(0, { timeout: 30_000 });
  await screenshotEvidence(page, testInfo, 'ops-guide-real-stream');

  const abortRequest = page.waitForRequest(next =>
    next.method() === 'POST' && new URL(next.url()).pathname === '/api/assistant/chat');
  await chat.getByLabel('Ask xln', { exact: true }).fill('Explain this selected frame in twenty detailed numbered points.');
  await chat.getByRole('button', { name: 'Send question' }).click();
  await abortRequest;
  await expect(chat.getByRole('button', { name: 'Stop answer' })).toBeVisible();
  await expect(chat.locator('article.assistant').last()).not.toContainText('Thinking…', { timeout: 120_000 });
  await timeline.getByLabel('Network frame', { exact: true }).press('End');
  await expect(chat).not.toHaveAttribute('data-guide-context', context ?? '');
  await expect(chat.locator('.transcript article')).toHaveCount(0);
  await expect(chat.getByRole('button', { name: 'Stop answer' })).toHaveCount(0);
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});
