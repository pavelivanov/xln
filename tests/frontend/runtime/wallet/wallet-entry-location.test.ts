import { expect, test } from 'bun:test';
import {
  resolveWalletEntryHref,
  resolveWalletEntryPath,
} from '../../../../frontend/apps/wallet/src/navigation/wallet-entry-location';

test('opens the physical extension entry as the Wallet without adding a web alias', () => {
  expect(resolveWalletEntryPath('/app.html', 'chrome-extension:')).toBe('/app');
  expect(resolveWalletEntryPath('/app.html', 'https:')).toBe('/app.html');
  expect(resolveWalletEntryPath('/address/123', 'chrome-extension:')).toBe('/address/123');
});

test('preserves extension query and deep-link hashes through navigation and reload', () => {
  for (const href of ['/app', '/app?settings=1', '/app#settings/display?entity=123']) {
    const destination = resolveWalletEntryHref(href, 'chrome-extension:');
    const before = new URL(href, 'https://xln.finance');
    const after = new URL(destination, 'chrome-extension://candidate');
    expect(after.pathname).toBe('/app.html');
    expect(after.search).toBe(before.search);
    expect(after.hash).toBe(before.hash);
    expect(resolveWalletEntryPath(after.pathname, after.protocol)).toBe('/app');
    expect(resolveWalletEntryHref(href, 'https:')).toBe(href);
  }
});

test('leaves external destinations, other routes and lookalike paths unchanged', () => {
  for (const href of ['/application', '/app.html', '/address/123', '/docs', '#settings', 'https://xln.finance/app']) {
    expect(resolveWalletEntryHref(href, 'chrome-extension:')).toBe(href);
  }
});
