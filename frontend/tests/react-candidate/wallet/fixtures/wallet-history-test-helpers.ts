import { expect, type Page } from '@playwright/test';

export const expectWalletHistoryEvents = async (page: Page, eventNames: readonly string[]): Promise<void> => {
  const history = page.getByRole('region', { name: 'Committed history', exact: true });
  const navigation = history.getByRole('navigation', { name: 'Committed history pages' });
  const remaining = new Set(eventNames);
  for (let pageIndex = 0; pageIndex < 32; pageIndex += 1) {
    await expect(history.locator('article').first()).toBeVisible({ timeout: 30_000 });
    for (const name of remaining) {
      const event = history.getByText(name, { exact: true }).first();
      if (await event.isVisible()) {
        await expect(event).toBeVisible();
        remaining.delete(name);
      }
    }
    if (remaining.size === 0) return;
    const previous = await navigation.locator('span').textContent();
    const older = navigation.getByRole('button', { name: 'Older', exact: true });
    await expect(older, `Older history required for ${[...remaining].join(', ')}`).toBeEnabled();
    await older.click();
    await expect(navigation.locator('span')).not.toHaveText(previous || '');
  }
  throw new Error(`WALLET_EXPECTED_HISTORY_NOT_FOUND:${[...remaining].join(',')}`);
};
