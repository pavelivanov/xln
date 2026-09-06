import { openWorkspaceStorageOrigin } from '../../browser-evidence';
import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';

test('database inspector pages, searches and switches isolated browser stores without writing', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await openWorkspaceStorageOrigin(page);
  await page.evaluate(async () => {
    for (const name of ['level-js-db-react-inspector', 'level-js-db-react-inspector-infra']) {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => { request.result.createObjectStore('data'); request.result.createObjectStore('empty'); };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('data', 'readwrite');
          for (let index = 0; index < 55; index += 1) tx.objectStore('data').put({ memo: `entry-${index}`, amount: 9007199254740993n }, `key-${String(index).padStart(2, '0')}`);
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      });
    }
  });
  await page.goto('/__app/ops/entity-workspace');
  await page.getByRole('button', { name: 'Open LevelDB panel', exact: true }).click();
  const inspector = page.getByTestId('leveldb-inspector');
  await inspector.getByRole('button', { name: 'level-js-db-react-inspector core', exact: true }).click();
  await expect(inspector.locator('.ops-db-entry')).toHaveCount(50);
  await expect(inspector).toContainText('9007199254740993n');
  await inspector.getByRole('button', { name: 'Load 50 more', exact: true }).click();
  await expect(inspector.locator('.ops-db-entry')).toHaveCount(55);
  await expect(inspector.getByRole('button', { name: 'Load 50 more', exact: true })).toHaveCount(0);
  await inspector.getByRole('searchbox', { name: 'Search loaded database entries' }).fill('entry-54');
  await expect(inspector.locator('.ops-db-entry')).toHaveCount(1);
  await inspector.getByText('Expand value fully', { exact: true }).click();
  await expect(inspector.locator('details pre')).toContainText('9007199254740993n');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-database-expanded');
  await inspector.getByRole('searchbox', { name: 'Search loaded database entries' }).fill('');
  await inspector.getByLabel('Database object store').selectOption('empty');
  await expect(inspector).toContainText('No entries in this object store.');
  await inspector.getByRole('button', { name: 'infra', exact: true }).click();
  await inspector.getByRole('button', { name: 'level-js-db-react-inspector-infra infra', exact: true }).click();
  await expect(inspector.locator('.ops-db-entry')).toHaveCount(50);
  await inspector.getByRole('button', { name: 'Refresh entries', exact: true }).click();
  await expect(inspector.locator('.ops-db-entry')).toHaveCount(50);
  const count = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('level-js-db-react-inspector');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result; const request = db.transaction('data', 'readonly').objectStore('data').count(); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => { db.close(); reject(request.error); }; };
  }));
  expect(count).toBe(55);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-database-infra');
  expectNoBrowserErrors(errors);
});
