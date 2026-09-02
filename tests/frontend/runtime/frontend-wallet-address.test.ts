import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  buildWalletAddressSummaryDetail,
  decodeWalletAddressDetail,
  decodeWalletAddressDirectory,
  filterWalletAddressDirectory,
  isWalletAddressEntityId,
} from '../../../frontend/apps/wallet/src/wallet-address-model';
import {
  resolveWalletPage,
  walletPageMetadata,
} from '../../../frontend/apps/wallet/src/wallet-model';

const USER_ID = `0x${'1'.repeat(64)}`;
const HUB_ID = `0x${'2'.repeat(64)}`;
const RUNTIME_ID = `0x${'a'.repeat(40)}`;
const context = { runtimeId: RUNTIME_ID, online: true, height: 12 } as const;

const userSummary = {
  entityId: USER_ID,
  runtimeId: RUNTIME_ID,
  label: 'Alice',
  height: 12,
  isHub: false,
  jurisdiction: { name: 'Local Development', chainId: 31337 },
};

const hubSummary = {
  entityId: HUB_ID,
  runtimeId: RUNTIME_ID,
  label: 'Liquidity Hub',
  height: 8,
  isHub: true,
  jurisdiction: { name: 'Settlement Lab', chainId: '31338' },
};

describe('React wallet address model', () => {
  test('validates, sorts, and filters strict Runtime Entity summaries', () => {
    const directory = decodeWalletAddressDirectory([userSummary, hubSummary], context);
    expect(directory.map(({ entityId }) => entityId)).toEqual([HUB_ID, USER_ID]);
    expect(directory[0]).toMatchObject({
      name: 'Liquidity Hub',
      capabilities: ['entity', 'hub', 'routing'],
      jurisdictionName: 'Settlement Lab',
      online: true,
    });
    expect(filterWalletAddressDirectory(directory, 'alice')).toHaveLength(1);
    expect(filterWalletAddressDirectory(directory, 'routing')[0]?.entityId).toBe(HUB_ID);
    expect(filterWalletAddressDirectory(directory, 'settlement')[0]?.entityId).toBe(HUB_ID);
  });

  test('projects profile, page counts, capabilities, and jurisdiction without raw state', () => {
    const summary = decodeWalletAddressDirectory([userSummary], context)[0];
    if (!summary) throw new Error('TEST_ADDRESS_SUMMARY_MISSING');
    const detail = decodeWalletAddressDetail({
      height: 12,
      activeEntity: {
        summary: userSummary,
        core: {
          profile: { name: 'Alice Prime', isHub: true, bio: 'Routes local value.', website: 'https://xln.finance' },
          orderbookHubProfile: null,
        },
        accounts: { items: [{ id: 'a' }], totalItems: 3, nextCursor: 'next-account' },
        books: { items: [{ pairId: '1/2' }], totalItems: 1, nextCursor: null },
      },
    }, USER_ID, summary, context);
    expect(detail).toMatchObject({
      entityId: USER_ID,
      name: 'Alice Prime',
      isHub: true,
      capabilities: ['entity', 'hub', 'routing', 'accounts', 'books'],
      profile: { bio: 'Routes local value.', website: 'https://xln.finance' },
      jurisdiction: { name: 'Local Development', chainId: '31337' },
      accounts: { shown: 1, total: 3, hasMore: true },
      books: { shown: 1, total: 1, hasMore: false },
    });
    expect(buildWalletAddressSummaryDetail(summary).accounts.total).toBe(0);
  });

  test('rejects malformed or duplicate Entity evidence before presentation', () => {
    expect(isWalletAddressEntityId(USER_ID.toUpperCase())).toBe(true);
    expect(isWalletAddressEntityId('0xabc')).toBe(false);
    expect(() => decodeWalletAddressDirectory({}, context)).toThrow('WALLET_ADDRESS_DIRECTORY_INVALID');
    expect(() => decodeWalletAddressDirectory([userSummary, userSummary], context))
      .toThrow('WALLET_ADDRESS_DIRECTORY_DUPLICATE');
    expect(() => decodeWalletAddressDetail({ activeEntity: null }, '0xabc', null, context))
      .toThrow('WALLET_ADDRESS_ENTITY_ID_INVALID:0xabc');
    expect(() => decodeWalletAddressDetail({
      height: 12,
      activeEntity: {
        summary: hubSummary,
        core: { profile: { name: 'Hub' } },
        accounts: { items: [] },
        books: { items: [] },
      },
    }, USER_ID, null, context)).toThrow('WALLET_ADDRESS_ACTIVE_ENTITY_MISMATCH');
  });
});

describe('React wallet address routes', () => {
  test('resolves directory and detail paths with runtime affinity', () => {
    expect(resolveWalletPage('/address')).toEqual({ kind: 'address-directory' });
    expect(resolveWalletPage('/address/')).toEqual({ kind: 'address-directory' });
    expect(resolveWalletPage(`/address/${USER_ID}`, `?rt=${RUNTIME_ID.toUpperCase()}`)).toEqual({
      kind: 'address-detail',
      entityId: USER_ID,
      requestedRuntimeId: RUNTIME_ID,
    });
    expect(resolveWalletPage('/address/too/many')).toEqual({ kind: 'pending', pathname: '/address/too/many' });
    expect(walletPageMetadata({ kind: 'address-directory' }).title).toBe('xln Address Directory');
    expect(walletPageMetadata({ kind: 'address-detail', entityId: USER_ID, requestedRuntimeId: '' }).title)
      .toBe('xln Entity Explorer');
  });

  test('keeps Runtime effects in a height-aware source and failures in the visible React surface', () => {
    const source = readFileSync('frontend/apps/wallet/src/wallet-address-source.ts', 'utf8');
    const view = readFileSync('frontend/apps/wallet/src/wallet-address.tsx', 'utf8');
    const app = readFileSync('frontend/apps/wallet/src/wallet-app.tsx', 'utf8');
    expect(source).toContain('client.readEntities({ limit: 5000 })');
    expect(source).toContain('client.readViewFrame({ entityId, accountsLimit: 8, booksLimit: 8 })');
    expect(source).toContain('client.readActivity({');
    expect(source).toContain('subscribeHeight: (listener) => adapter.onChange');
    expect(source).not.toContain('RuntimeReplica');
    expect(source).not.toContain('setInterval');
    expect(view).toContain('useSyncExternalStore');
    expect(view).toContain('entity-history-runtime-mismatch');
    expect(view).toContain('role="alert"');
    expect(view).not.toContain('JSON.stringify');
    expect(app).toContain('<WalletAddressPage');
  });
});
