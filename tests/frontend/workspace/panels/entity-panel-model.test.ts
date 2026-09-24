import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  buildEntityPanelView,
  getCurrentEntityJurisdictionKey,
  getCurrentEntityJurisdictionName,
  getEntityJurisdictionKey,
  getEntityJurisdictionKeyFromReplicas,
  hasDevnetJurisdiction,
  isSameJurisdictionEntity,
  isSameJurisdictionEntityInReplicas,
  jurisdictionKey,
} from '../../../../frontend/bridges/wallet/entity/entity-panel-model';
import { buildAccountPageView, resolveAccountListEntityName } from '../../../../frontend/bridges/entity/accounts/account-list-view';

describe('entity panel model helpers', () => {
  test('builds stable jurisdiction keys from contract config', () => {
    expect(jurisdictionKey({ chainId: 31337, depositoryAddress: '0xABCDEF', name: 'Ignored' }))
      .toBe('dep:31337:0xabcdef');
    expect(jurisdictionKey({ chainId: 31338, name: 'Default' })).toBe('chain:31338');
    expect(jurisdictionKey({ name: 'Base Sepolia' })).toBe('base sepolia');
    expect(jurisdictionKey('Testnet')).toBe('testnet');
  });

  test('resolves current entity jurisdiction from replica before the active environment', () => {
    const env = { activeJurisdiction: 'Default' } as any;
    const replica = {
      state: {
        config: { jurisdiction: { name: 'Configured', chainId: 1 } },
      },
    } as any;

    expect(getCurrentEntityJurisdictionName(env, replica)).toBe('Configured');
    expect(getCurrentEntityJurisdictionKey(env, replica)).toBe('chain:1');
    expect(getCurrentEntityJurisdictionName(env, null)).toBe('Default');
    expect(getCurrentEntityJurisdictionKey(env, null)).toBe('default');
  });

  test('resolves entity jurisdiction from replicas and then gossip', () => {
    const env = {
      state: { eReplicas: new Map([
        ['alice:signer', {
          entityId: 'alice',
          state: { entityId: 'alice', config: { jurisdiction: { chainId: 10 } } },
        }],
      ]) },
      gossip: {
        getProfiles: () => [
          { entityId: 'bob', metadata: { jurisdiction: { name: 'Remote J' } } },
        ],
      },
    } as any;

    expect(getEntityJurisdictionKey(env, 'ALICE')).toBe('chain:10');
    expect(getEntityJurisdictionKey(env, 'bob')).toBe('remote j');
    expect(getEntityJurisdictionKey(env, 'missing')).toBe('');
  });

  test('compares entity jurisdiction with current replica context', () => {
    const replica = {
      state: {
        entityId: 'alice',
        config: { jurisdiction: { chainId: 10 } },
      },
    } as any;
    const env = {
      state: { eReplicas: new Map([
        ['hub:signer', {
          entityId: 'hub',
          state: { entityId: 'hub', config: { jurisdiction: { chainId: 10 } } },
        }],
        ['remote:signer', {
          entityId: 'remote',
          state: { entityId: 'remote', config: { jurisdiction: { chainId: 20 } } },
        }],
      ]) },
    } as any;

    expect(isSameJurisdictionEntity(env, replica, 'alice', 'alice', 'hub')).toBe(true);
    expect(isSameJurisdictionEntity(env, replica, 'alice', 'alice', 'remote')).toBe(false);
    expect(isSameJurisdictionEntity(null, null, '', 'left', 'right')).toBe(true);
    expect(isSameJurisdictionEntity(env, replica, 'alice', 'alice', 'unknown-hub')).toBe(true);
  });

  test('compares entity jurisdiction from projected replica maps without RuntimeReplica ownership', () => {
    const replica = {
      state: {
        entityId: 'alice',
        config: { jurisdiction: { chainId: 10 } },
      },
    } as any;
    const replicas = new Map([
      ['hub:signer', {
        entityId: 'hub',
        state: { entityId: 'hub', config: { jurisdiction: { chainId: 10 } } },
      }],
      ['remote:signer', {
        entityId: 'remote',
        state: { entityId: 'remote', config: { jurisdiction: { chainId: 20 } } },
      }],
    ]) as any;

    expect(getEntityJurisdictionKeyFromReplicas(replicas, 'HUB')).toBe('chain:10');
    expect(isSameJurisdictionEntityInReplicas(replicas, replica, 'alice', 'alice', 'hub')).toBe(true);
    expect(isSameJurisdictionEntityInReplicas(replicas, replica, 'alice', 'alice', 'remote')).toBe(false);
    expect(isSameJurisdictionEntityInReplicas(replicas, replica, 'alice', 'alice', 'unknown-hub')).toBe(true);
  });

  test('projects entity panel read model from env once at the model boundary', () => {
    const view = buildEntityPanelView({
      runtimeId: 'runtime-1',
      state: {
        height: 42,
        timestamp: 1234,
        eReplicas: new Map([
          ['alice:signer-a', {
            entityId: 'alice',
            state: { entityId: 'alice', accounts: new Map([['bob', {}]]) },
          }],
          ['h1:signer-h1', {
            entityId: 'h1',
            state: { entityId: 'h1', profile: { name: 'H1', isHub: true }, accounts: new Map() },
          }],
        ]),
        jReplicas: new Map([
          ['testnet', { name: 'Testnet', chainId: 31337 }],
        ]),
      },
      activeJurisdiction: 'Testnet',
      gossip: {
        getProfiles: () => [
          { entityId: 'alice', name: 'Alice', metadata: { isHub: false } },
        ],
      },
    } as any, 'ALICE', 'signer-a', 'rev-1');

    expect(view.runtimeId).toBe('runtime-1');
    expect(view.height).toBe(42);
    expect(view.timestamp).toBe(1234);
    expect(view.activeJurisdictionName).toBe('Testnet');
    expect(view.replica?.state?.entityId).toBe('alice');
    expect(view.replicas?.size).toBe(2);
    expect(view.profiles.map((profile) => profile.name)).toEqual(['Alice']);
    expect(view.entityNames.get('alice')).toBe('Alice');
    expect(view.entityNames.get('h1')).toBe('H1');
    expect(view.profileByEntityId.get('alice')?.name).toBe('Alice');
    expect(view.jurisdictions).toEqual([{ name: 'Testnet', chainId: 31337 }]);
    expect(view.isDevnet).toBe(true);
  });

  test('projects remote runtime view accounts into the entity account list model', () => {
    const entityId = `0x${'aa'.repeat(32)}`;
    const signerId = '0xsigner';
    const hubOne = `0x${'11'.repeat(32)}`;
    const hubTwo = `0x${'22'.repeat(32)}`;
    const frame = {
      height: 77,
      head: { latestHeight: 77 },
      entities: [
        { entityId, signerId, label: 'B', height: 77, jurisdiction: { name: 'Testnet', chainId: 31337 } },
        { entityId: hubOne, label: 'H1', height: 77, isHub: true, jurisdiction: { name: 'Testnet', chainId: 31337 } },
        { entityId: hubTwo, label: 'H2', height: 77, isHub: true, jurisdiction: { name: 'Testnet', chainId: 31337 } },
      ],
      activeEntityId: entityId,
      activeEntity: {
        summary: { entityId, signerId, label: 'B', height: 77, jurisdiction: { name: 'Testnet', chainId: 31337 } },
        core: {
          entityId,
          signerId,
          height: 76,
          timestamp: 5678,
          profile: { name: 'B' },
          config: { jurisdiction: { name: 'Testnet', chainId: 31337 } },
          lockBook: new Map(),
          htlcRoutes: new Map(),
          htlcFeesEarned: 0n,
        },
        accounts: {
          items: [
            {
              state: {
                leftEntity: entityId,
                rightEntity: hubOne,
                deltas: new Map([[1, { offdelta: 10n }]]),
                locks: new Map(),
                swapOffers: new Map(),
                lastFinalizedJHeight: 3,
                requestedRebalance: new Map(),
                requestedRebalanceFeeState: new Map(),
              },
              status: 'open',
              currentHeight: 5,
              currentFrame: { height: 5, timestamp: 1000, outcome: [], accountTxs: [] },
              mempool: [],
              rollbackCount: 0,
              pendingWithdrawals: new Map(),
              shadow: { rebalance: { policy: new Map(), submittedAtByToken: new Map() } },
            },
            {
              state: {
                leftEntity: hubTwo,
                rightEntity: entityId,
                deltas: new Map([[1, { offdelta: -2n }]]),
                locks: new Map(),
                swapOffers: new Map(),
                lastFinalizedJHeight: 2,
                requestedRebalance: new Map(),
                requestedRebalanceFeeState: new Map(),
              },
              status: 'open',
              currentHeight: 4,
              currentFrame: { height: 4, timestamp: 900, outcome: [], accountTxs: [] },
              mempool: [],
              rollbackCount: 0,
              pendingWithdrawals: new Map(),
              shadow: { rebalance: { policy: new Map(), submittedAtByToken: new Map() } },
            },
          ],
          nextCursor: null,
          totalItems: 2,
          limit: 10,
          pageIndex: 0,
          pageCount: 1,
        },
        books: { items: [], nextCursor: null, totalItems: 0, limit: 10, pageIndex: 0, pageCount: 0 },
      },
    };

    const view = buildEntityPanelView(
      { runtimeId: 'remote-h2', gossip: { profiles: [{ entityId: hubOne, runtimeId: 'h1-transport' }] } } as any,
      entityId,
      signerId,
      'rev-remote',
      frame as never,
    );
    const accountPage = buildAccountPageView(view.replica, false, 0, '');

    expect(view.height).toBe(77);
    expect(view.timestamp).toBe(5678);
    expect(view.replica?.state?.accounts?.size).toBe(2);
    expect(view.replica?.state?.accounts?.get(hubOne)?.state.deltas.get(1)?.offdelta).toBe(10n);
    expect(view.replica?.state?.accounts?.get(hubTwo)?.state.deltas.get(1)?.offdelta).toBe(-2n);
    expect(() => view.replica?.state.accounts.rootHash()).toThrow();
    expect(view.entityNames.get(hubOne)).toBe('H1');
    expect(view.profileByEntityId.get(hubOne)?.runtimeId).toBe('h1-transport');
    expect(view.jurisdictions).toEqual([{ name: 'Testnet', chainId: 31337 }]);
    expect(view.isDevnet).toBe(true);
    expect(accountPage.entries.map((entry) => entry.counterpartyId)).toEqual([hubOne, hubTwo]);
  });

  test('React wallet consumes one decoded portfolio projection instead of rebuilding env projections inline', () => {
    const source = readFileSync('frontend/apps/wallet/src/portfolio/wallet-portfolio-source.ts', 'utf8');
    const view = readFileSync('frontend/apps/wallet/src/portfolio/wallet-portfolio.tsx', 'utf8');

    expect(source).toContain('decodeWalletPortfolioProjection(await client.readViewFrame({');
    expect(source).toContain('requireWalletWorkspaceEntity(');
    expect(view).toContain('const projection = snapshot.projection;');
    expect(view).toContain('<PortfolioContent');
    expect(source).not.toContain('state.eReplicas');
    expect(source).not.toContain('function findReplicaForTab');
  });

  test('move validation and execution consume the same reactive balance snapshot shown to the user', () => {
    const source = readFileSync('frontend/apps/wallet/src/move/wallet-move.tsx', 'utf8');

    expect(source).toContain('const available =');
    expect(source).toContain('sourceAvailableBalance: available');
    expect(source).toContain('parsePositiveAssetAmount(amount, token, available)');
    expect(source).not.toContain('getCurrentMoveSourceAvailableBalance');
  });

  test('focused account display consumes projected entity names instead of full env', () => {
    const model = readFileSync('frontend/apps/wallet/src/account/view/wallet-account-view-model.ts', 'utf8');
    const focusedView = readFileSync('frontend/apps/wallet/src/account/view/wallet-account-view.tsx', 'utf8');

    expect(model).toContain('entityNames: ReadonlyMap<string, string>');
    expect(focusedView).toContain('view?.counterpartyName || counterpartyId');
    expect(focusedView).not.toContain('EnvSnapshot');
    expect(focusedView).not.toContain('activeEnv');
  });

  test('account list display consumes projected height and entity names', () => {
    const accountList = readFileSync('frontend/apps/wallet/src/portfolio/wallet-portfolio.tsx', 'utf8');
    const accountWorkspace = readFileSync('frontend/apps/wallet/src/account/wallet-account-workspace.tsx', 'utf8');

    expect(resolveAccountListEntityName('ALICE', 'alice', new Map(), 'You')).toBe('You');
    expect(resolveAccountListEntityName('BOB', 'alice', new Map([['bob', 'Hub B']]))).toBe('Hub B');
    expect(resolveAccountListEntityName('BOB', 'alice', new Map())).toBe('BOB');
    expect(hasDevnetJurisdiction({
      state: { jReplicas: new Map([['local', { chainId: 31337 }]]) },
    } as any)).toBe(true);
    expect(accountList).toContain('projection.accounts.map');
    expect(accountList).toContain('account.counterpartyLabel');
    expect(accountWorkspace).toContain('Committed height {projection.height}');
    expect(accountWorkspace).toContain('projection.entities.map');
    expect(accountList).not.toContain('xlnEnvironment');
    expect(accountList).not.toContain('$xlnEnvironment');
    expect(accountList).not.toContain('getEntityDisplayName(');
    expect(accountList).not.toContain('xlnEnvironment');
    expect(accountWorkspace).not.toContain('xlnEnvironment');
    expect(accountWorkspace).not.toContain('jReplicas');
  });

  test('account selectors consume projected entity names without owning env', () => {
    const accountDropdown = readFileSync('frontend/apps/wallet/src/account/controls/wallet-account-dropdown.tsx', 'utf8');
    const manage = readFileSync('frontend/apps/wallet/src/manage/wallet-manage.tsx', 'utf8');
    const lending = readFileSync('frontend/apps/wallet/src/manage/wallet-lending.tsx', 'utf8');
    const accountWorkspace = readFileSync('frontend/apps/wallet/src/account/wallet-account-workspace.tsx', 'utf8');

    expect(accountDropdown).toContain('<AccountDropdown accounts={snapshot.data}');
    expect(manage).toContain('context.names.get(id) || id');
    expect(manage).toContain('source.submitAccountTxs(context.entityId');
    expect(manage).toContain('disabled={busy || !context.commandsReady}');
    expect(lending).toContain('Production lending is not enabled');
    expect(lending).not.toContain('submitAccountTxs');
    expect(accountWorkspace).toContain('<WalletManage context={context}');
    expect(accountWorkspace).toContain('<WalletLending />');
  });

  test('entity header dropdown consumes the canonical panel projection', () => {
    const portfolio = readFileSync('frontend/apps/wallet/src/portfolio/wallet-portfolio.tsx', 'utf8');
    const workspace = readFileSync('frontend/apps/wallet/src/account/wallet-account-workspace.tsx', 'utf8');

    expect(portfolio).toContain('projection.entities.map');
    expect(portfolio).toContain('source.selectEntity(event.target.value)');
    expect(workspace).toContain('source.selectEntity(nextEntityId)');
    expect(workspace).toContain('projection.entities.map');
    expect(`${portfolio}\n${workspace}`).not.toContain('xlnEnvironment');
    expect(`${portfolio}\n${workspace}`).not.toContain('visibleReplicas');
  });
});
