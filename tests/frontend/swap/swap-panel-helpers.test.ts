import { describe, expect, test } from 'bun:test';

import {
  buildSwapPanelRuntimeView,
  buildCrossSwapSetupSteps,
  crossOrderbookPairLabel,
  entityInitials,
  firstAvailableHubId,
  formatEntityNetworkLabel,
  jurisdictionBadgeText,
  normalizeJurisdictionDisplayName,
  orderbookLotsDisplayScale,
  parseCrossAssetKey,
  resolveHubIdCandidate,
  sameOrderbookPairLabel,
  tokenNetworkLabel,
} from '../../../frontend/bridges/wallet/swap-panel-helpers';

const tokenSymbol = (tokenId: number): string => {
  if (tokenId === 1) return 'WETH';
  if (tokenId === 2) return 'USDC';
  return `T${tokenId}`;
};

describe('swap panel helpers', () => {
  test('displays canonical orderbook lots in human token units for every decimal domain', () => {
    expect(orderbookLotsDisplayScale(6)).toBe(1_000_000);
    expect(orderbookLotsDisplayScale(18)).toBe(1_000_000);
    expect(orderbookLotsDisplayScale(2)).toBe(100);
    expect(() => orderbookLotsDisplayScale(-1)).toThrow('SWAP_TOKEN_DECIMALS_INVALID');
  });

  test('builds a read-only runtime projection for swap display data', () => {
    const hubId = '0xHubA';
    const userId = '0xUserA';
    const book = { bids: [], asks: [] };
    const frame = {
      gossip: {
        profiles: new Map([
          [
            hubId,
            {
              entityId: hubId,
              name: 'H1',
              metadata: { isHub: true, jurisdiction: { name: 'Tron' } },
            },
          ],
        ]),
      },
      state: { eReplicas: new Map([
        [
          `${userId}:0xSignerA`,
          {
            entityId: userId,
            signerId: '0xSignerA',
            state: {
              entityId: userId,
              accounts: new Map(),
              config: { jurisdiction: { name: 'Testnet' } },
            },
          },
        ],
        [
          `${userId}:0xSignerB`,
          {
            entityId: userId,
            signerId: '0xSignerB',
            state: {
              entityId: userId,
              accounts: new Map(),
              config: { jurisdiction: { name: 'Testnet' } },
            },
          },
        ],
        [
          `${hubId}:0xSignerH`,
          {
            entityId: hubId,
            signerId: '0xSignerH',
            state: {
              entityId: hubId,
              accounts: new Map(),
              orderbookExt: { books: new Map([['1/2', book]]) },
              config: { jurisdiction: { name: 'Tron' } },
            },
          },
        ],
      ]) },
    };

    const view = buildSwapPanelRuntimeView(frame as never);

    expect(view.entityNames.get(hubId.toLowerCase())).toBe('H1');
    expect(view.isHubEntity(hubId)).toBe(true);
    expect(view.getHubProfile(hubId)?.name).toBe('H1');
    expect(view.localReplicas.map(replica => replica.entityId)).toEqual([userId, hubId]);
    expect(view.getPairBook(hubId, '1/2')).toBe(book);
    expect(view.getPairBook(userId, '1/2')).toBeNull();
  });

  test('builds swap projection from runtime-view fields without RuntimeReplica shape', () => {
    const hubId = '0xHubProjection';
    const userId = '0xUserProjection';
    const book = { bids: [], asks: [] };
    const view = buildSwapPanelRuntimeView({
      profiles: [
        {
          entityId: hubId,
          name: 'H projection',
          metadata: { isHub: true, jurisdiction: { name: 'Testnet' } },
        },
      ],
      entityNames: new Map([[userId, 'User projection']]),
      replicas: new Map([
        [
          `${userId}:0xSignerProjection`,
          {
            entityId: userId,
            signerId: '0xSignerProjection',
            state: {
              entityId: userId,
              accounts: new Map(),
              config: { jurisdiction: { name: 'Testnet' } },
            },
          },
        ],
        [
          `${hubId}:0xSignerProjection`,
          {
            entityId: hubId,
            signerId: '0xSignerProjection',
            state: {
              entityId: hubId,
              accounts: new Map(),
              orderbookExt: { books: new Map([['1/2', book]]) },
              config: { jurisdiction: { name: 'Testnet' } },
            },
          },
        ],
      ]),
    });

    expect(view.entityNames.get(hubId.toLowerCase())).toBe('H projection');
    expect(view.entityNames.get(userId.toLowerCase())).toBe('User projection');
    expect(view.isHubEntity(hubId)).toBe(true);
    expect(view.localReplicaEntries.map(entry => entry.entityId)).toEqual([userId.toLowerCase(), hubId.toLowerCase()]);
    expect(view.getPairBook(hubId, '1/2')).toBe(book);
  });

  test('uses live signed network profiles for relay routing without replacing committed replicas', () => {
    const hubId = '0xHubProjection';
    const committedReplica = {
      entityId: '0xUserProjection',
      signerId: '0xSignerProjection',
      state: {
        entityId: '0xUserProjection',
        accounts: new Map(),
      },
    };
    const view = buildSwapPanelRuntimeView({
      profiles: [
        {
          entityId: hubId,
          name: 'H projection',
          relays: [],
          metadata: { isHub: true, jurisdiction: { name: 'Testnet' } },
        },
      ],
      networkProfiles: [
        {
          entityId: hubId,
          name: 'H live',
          relays: ['ws://127.0.0.1:20262/relay'],
          metadata: { isHub: true, jurisdiction: { name: 'Testnet' } },
        },
      ],
      replicas: new Map([['0xUserProjection:0xSignerProjection', committedReplica]]),
    });

    expect(view.getHubProfile(hubId)?.relays).toEqual(['ws://127.0.0.1:20262/relay']);
    expect(view.localReplicas).toEqual([committedReplica]);
  });

  test('committed user role vetoes a stale live Hub advertisement', () => {
    const entityId = '0xRoleBoundEntity';
    const view = buildSwapPanelRuntimeView({
      profiles: [],
      networkProfiles: [{
        entityId,
        name: 'Stale Hub',
        relays: ['ws://127.0.0.1:20262/relay'],
        metadata: { isHub: true, jurisdiction: { name: 'Testnet' } },
      }],
      replicas: new Map([[`${entityId}:0xSigner`, {
        entityId,
        signerId: '0xSigner',
        state: {
          entityId,
          profile: { name: 'Committed User', isHub: false },
          accounts: new Map(),
        },
      }]]),
    });

    expect(view.getHubProfile(entityId)).toBe(null);
    expect(view.profiles[0]?.metadata.isHub).toBe(false);
  });

  test('preserves jurisdiction labels and strips repeated suffixes', () => {
    expect(normalizeJurisdictionDisplayName('arrakis')).toBe('arrakis');
    expect(normalizeJurisdictionDisplayName('Arrakis (shared anvil)')).toBe('Arrakis (shared anvil)');
    expect(normalizeJurisdictionDisplayName('Wakanda')).toBe('Wakanda');
    expect(normalizeJurisdictionDisplayName('Base Sepolia')).toBe('Base Sepolia');

    expect(formatEntityNetworkLabel('Hub Alpha (arrakis)', 'arrakis')).toBe('Hub Alpha (arrakis)');
    expect(formatEntityNetworkLabel('Hub Alpha Testnet', 'Testnet')).toBe('Hub Alpha (Testnet)');
    expect(formatEntityNetworkLabel('', '')).toBe('Unknown');
  });

  test('resolves known and advertised hub candidates deterministically', () => {
    const knownHubIds = ['0xHubA', '0xHubB'];
    const advertised = new Set(['0xhubc']);
    const isHub = (entityId: string): boolean => advertised.has(entityId.toLowerCase());

    expect(resolveHubIdCandidate(' 0xhuba ', knownHubIds, isHub)).toBe('0xHubA');
    expect(resolveHubIdCandidate('0xHubC', knownHubIds, isHub)).toBe('0xhubc');
    expect(resolveHubIdCandidate('0xUnknown', knownHubIds, isHub)).toBe('');
    expect(firstAvailableHubId(knownHubIds, ['0xUnknown', '0xHubC'], isHub)).toBe('0xhubc');
    expect(firstAvailableHubId(knownHubIds, ['0xUnknown'], isHub)).toBe('0xHubA');
  });

  test('parses cross-asset keys and formats pair labels with injected symbols', () => {
    expect(parseCrossAssetKey('chain-a:2')).toEqual({ jurisdictionRef: 'chain-a', tokenId: 2 });
    expect(parseCrossAssetKey('chain-a:0')).toBeNull();
    expect(parseCrossAssetKey(':2')).toBeNull();
    expect(parseCrossAssetKey('chain-a:two')).toBeNull();

    expect(tokenNetworkLabel(1, 'wakanda', tokenSymbol)).toBe('WETH (wakanda)');
    expect(sameOrderbookPairLabel(1, 2, 'Base Sepolia', tokenSymbol)).toBe('WETH-USDC (Base Sepolia)');
    expect(crossOrderbookPairLabel(1, 'arrakis', 2, 'Base Sepolia', tokenSymbol)).toBe(
      'WETH (arrakis) - USDC (Base Sepolia)',
    );
  });

  test('formats compact identity markers', () => {
    expect(entityInitials('0xabcdef', 'Grace Tron')).toBe('GR');
    expect(entityInitials('0xabcdef')).toBe('0X');
    expect(jurisdictionBadgeText('Base Sepolia')).toBe('BS');
    expect(jurisdictionBadgeText('arrakis')).toBe('AR');
    expect(jurisdictionBadgeText('')).toBe('J');
  });

  test('builds cross-swap setup consent steps only for missing preparation', () => {
    expect(
      buildCrossSwapSetupSteps({
        routeMode: 'same',
        targetAccountReady: false,
        canOpenTargetAccount: true,
        needsCreditLimit: true,
        targetHubLabel: 'H1',
        targetJurisdictionLabel: 'Tron',
        creditLimitLabel: '10,000 USDC',
        creditIncreaseLabel: '+10,000 USDC',
        tokenSymbol: 'USDC',
      }),
    ).toEqual([]);

    expect(
      buildCrossSwapSetupSteps({
        routeMode: 'cross',
        targetAccountReady: true,
        canOpenTargetAccount: false,
        needsCreditLimit: false,
        targetHubLabel: 'H1',
        targetJurisdictionLabel: 'Tron',
        creditLimitLabel: '',
        creditIncreaseLabel: '',
        tokenSymbol: 'USDC',
      }),
    ).toEqual([]);

    expect(
      buildCrossSwapSetupSteps({
        routeMode: 'cross',
        targetAccountReady: false,
        canOpenTargetAccount: false,
        needsCreditLimit: true,
        targetHubLabel: 'H1',
        targetJurisdictionLabel: 'Tron',
        creditLimitLabel: '10,000 USDC',
        creditIncreaseLabel: '+10,000 USDC',
        tokenSymbol: 'USDC',
      }),
    ).toEqual([]);

    expect(
      buildCrossSwapSetupSteps({
        routeMode: 'cross',
        targetAccountReady: false,
        canOpenTargetAccount: true,
        needsCreditLimit: true,
        targetHubLabel: 'H1',
        targetJurisdictionLabel: 'Tron',
        creditLimitLabel: '10,000 USDC',
        creditIncreaseLabel: '+10,000 USDC',
        tokenSymbol: 'USDC',
      }),
    ).toEqual([
      {
        id: 'target-account',
        label: 'Create target account',
        detail: 'Open Tron account with H1.',
      },
      {
        id: 'target-credit',
        label: 'Set inbound credit limit',
        detail: 'Set inbound USDC credit to 10,000 USDC (+10,000 USDC).',
      },
    ]);
  });

  test('React market source submits the exact Runtime-owned command plan before cross intent', () => {
    const source = Bun.file('frontend/apps/wallet/src/markets/wallet-market-source.ts');
    return source.text().then(text => {
      expect(text).toContain('if (review.plan.targetSetupInput) await this.submitInput(review.plan.targetSetupInput);');
      expect(text).toContain('await this.requireAdapter().submitCrossJurisdictionIntent(review.plan.crossJurisdictionIntent);');
      expect(text.indexOf('review.plan.targetSetupInput')).toBeLessThan(text.indexOf('submitCrossJurisdictionIntent'));
      expect(text).not.toContain('.deriveDelta');
      expect(text).not.toContain('10_000n * 10n ** decimals');
      expect(text).not.toContain('buildCrossTargetSetupTxs');
    });
  });

  test('React market reads through query projections instead of component-owned RuntimeReplica reads', async () => {
    const [panel, source, model] = await Promise.all([
      Bun.file('frontend/apps/wallet/src/markets/wallet-market-pane.tsx').text(),
      Bun.file('frontend/apps/wallet/src/markets/wallet-market-source.ts').text(),
      Bun.file('frontend/apps/wallet/src/markets/wallet-market-model.ts').text(),
    ]);

    expect(panel).toContain('projection: WalletMarketProjection;');
    expect(panel).not.toContain('RuntimeReplica');
    expect(source).toContain('createWalletRuntimeQueryClient(adapter)');
    expect(source).toContain('client.readViewFrame({');
    expect(source).toContain('decodeWalletMarketProjection');
    expect(model).toContain('decodeWalletMarketContext');
  });

  test('React market remote actions submit through projection-backed command paths', async () => {
    const source = await Bun.file('frontend/apps/wallet/src/markets/wallet-market-source.ts').text();
    expect(source).toContain('buildWalletMarketOrderInput(');
    expect(source).toContain('buildWalletMarketCancelInput(this.requireProjection(), offerId)');
    expect(source).toContain('buildWalletCrossMarketCancelInput(this.requireProjection(), orderId)');
    expect(source).toContain('this.requireAdapter().submitCrossJurisdictionIntent');
    expect(source).not.toContain("throw new Error('XLN environment not ready')");
  });

  test('React market ticket keeps amount state in the owning form and submits that exact state', async () => {
    const panel = await Bun.file('frontend/apps/wallet/src/markets/wallet-market-pane.tsx').text();
    expect(panel).toContain("const [giveAmount, setGiveAmount] = useState('');");
    expect(panel).toContain("const [wantAmount, setWantAmount] = useState('');");
    expect(panel).toContain('giveAmount,\n        wantAmount,');
    expect(panel).toContain('value={giveAmount}');
    expect(panel).toContain('value={wantAmount}');
  });

  test('React cross-market ticket makes online and manual-close risk impossible to omit', async () => {
    const ticket = await Bun.file('frontend/apps/wallet/src/markets/wallet-cross-market-ticket.tsx').text();
    expect(ticket).toContain('data-testid="cross-j-safety-banner"');
    expect(ticket).toContain('Stay online for this cross-network swap');
    expect(ticket).toContain('cancelled manually');
    expect(ticket).toContain('65,535 steps');
  });

  test('React market applies each command-palette draft only once', () => {
    const source = Bun.file('frontend/apps/wallet/src/markets/wallet-market-pane.tsx');
    return source.text().then(text => {
      expect(text).toContain('const appliedDraft = useRef<number | null>(null);');
      expect(text).toContain('appliedDraft.current === draft.id');
      expect(text).toContain('appliedDraft.current = draft.id;');
    });
  });

  test('cross-market routes retain canonical projected Hub ordering', async () => {
    const model = await Bun.file('frontend/apps/wallet/src/markets/wallet-market-model.ts').text();
    expect(model).toContain('targetHubs');
    expect(model).toContain('left.hubLabel.localeCompare(right.hubLabel)');
  });

  test('market projection sorts committed pairs deterministically', async () => {
    const model = await Bun.file('frontend/apps/wallet/src/markets/wallet-market-model.ts').text();
    expect(model).toContain("sort((left, right) => left.pairId.localeCompare(right.pairId))");
  });
});
