import { describe, expect, test } from 'bun:test';

import {
  emptyEntityWorkspaceAccounts,
  projectEntityWorkspaceAccounts,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-accounts';
import {
  projectEntityWorkspaceContext,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-context';
import { formatEntityWorkspaceTimestamp } from '../../../frontend/packages/ui/src/entity-workspace-display';

const account = (
  leftEntity: string,
  rightEntity: string,
  frameHeight: number,
  stateHash: string,
  frameOverrides: Record<string, unknown> = {},
  stateOverrides: Record<string, unknown> = {},
) => ({
  state: {
    leftEntity,
    rightEntity,
    domain: { chainId: 31_337, depositoryAddress: '0xdepository' },
    lastFinalizedJHeight: frameHeight + 8,
    jNonce: frameHeight + 3,
    disputeConfig: { leftResponseSeconds: 3_600, rightResponseSeconds: 86_400 },
    ...stateOverrides,
  },
  currentFrame: {
    height: frameHeight,
    timestamp: 1_700_000_000 + frameHeight,
    jHeight: frameHeight + 10,
    accountTxs: [{ type: 'test' }],
    prevFrameHash: frameHeight === 0 ? '' : 'genesis',
    accountStateRoot: `0xroot${frameHeight}`,
    stateHash,
    ...frameOverrides,
  },
});

const frameWithAccounts = (items: unknown[], overrides: Record<string, unknown> = {}) => ({
  height: 27,
  activeEntityId: '0xaaaa',
  activeEntity: {
    summary: { entityId: '0xaaaa', label: 'Treasury' },
    core: { entityId: '0xaaaa' },
    accounts: {
      items,
      pageIndex: 0,
      pageCount: items.length === 0 ? 0 : 1,
      totalItems: items.length,
      limit: 8,
      ...overrides,
    },
  },
});

const FRAME = frameWithAccounts([
  account('0xAAAA', '0xBBBB', 4, '0xSTATEB'),
  account('0xCCCC', '0xaaaa', 7, '0xSTATEC'),
]);

const CONTEXT = projectEntityWorkspaceContext({ runtimeId: 'runtime-a', frame: FRAME });

describe('Entity workspace Accounts page projection', () => {
  test('preserves adapter order and projects committed Account evidence only', () => {
    expect(projectEntityWorkspaceAccounts({ context: CONTEXT, frame: FRAME })).toEqual({
      status: 'selected',
      entityId: '0xaaaa',
      items: [
        {
          chainId: 31_337, counterpartyId: '0xbbbb', depositoryAddress: '0xdepository',
          frameHeight: 4, frameTimestamp: 1_700_000_004, jurisdictionHeight: 14,
          jurisdictionNonce: 7, lastFinalizedJurisdictionHeight: 12,
          leftResponseSeconds: 3_600, rightResponseSeconds: 86_400,
          transactionCount: 1, previousFrameHash: 'genesis',
          accountStateRoot: '0xroot4', stateHash: '0xSTATEB',
        },
        {
          chainId: 31_337, counterpartyId: '0xcccc', depositoryAddress: '0xdepository',
          frameHeight: 7, frameTimestamp: 1_700_000_007, jurisdictionHeight: 17,
          jurisdictionNonce: 10, lastFinalizedJurisdictionHeight: 15,
          leftResponseSeconds: 3_600, rightResponseSeconds: 86_400,
          transactionCount: 1, previousFrameHash: 'genesis',
          accountStateRoot: '0xroot7', stateHash: '0xSTATEC',
        },
      ],
      pageIndex: 0,
      pageCount: 1,
      totalItems: 2,
      limit: 8,
    });
  });

  test('represents an Entity-empty Runtime without inventing an Account page', () => {
    const context = projectEntityWorkspaceContext({ runtimeId: 'runtime-a', frame: { height: 2, activeEntity: null } });
    expect(projectEntityWorkspaceAccounts({ context, frame: { height: 2, activeEntity: null } }))
      .toEqual(emptyEntityWorkspaceAccounts());
  });

  test('accepts a later bounded page without presenting it as a total', () => {
    const frame = frameWithAccounts([
      account('0xaaaa', '0xdddd', 9, '0xstated'),
    ], { pageIndex: 1, pageCount: 2, totalItems: 9 });
    expect(projectEntityWorkspaceAccounts({ context: CONTEXT, frame })).toMatchObject({
      status: 'selected', pageIndex: 1, pageCount: 2, totalItems: 9,
      items: [{ counterpartyId: '0xdddd' }],
    });
  });

  test('rejects malformed or contradictory page metadata', () => {
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([], { pageCount: 1, totalItems: 0 }),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_PAGE_METADATA_MISMATCH');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash')], { limit: 0 }),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_LIMIT_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '')]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_STATE_HASH_INVALID');
  });

  test('rejects malformed committed Account frame evidence', () => {
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', { timestamp: -1 })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_FRAME_TIMESTAMP_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', { timestamp: Number.MAX_SAFE_INTEGER })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_FRAME_TIMESTAMP_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', { jHeight: 1.5 })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_JURISDICTION_HEIGHT_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', { accountTxs: new Array(21) })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_FRAME_TXS_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', { accountStateRoot: '' })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_STATE_ROOT_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', { prevFrameHash: null })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_PREVIOUS_FRAME_HASH_INVALID');
  });

  test('renders exact Account-frame timestamps as deterministic UTC evidence', async () => {
    expect(formatEntityWorkspaceTimestamp(1_700_000_004)).toEqual({
      dateTime: '1970-01-20T16:13:20.004Z',
      label: '1970-01-20 16:13:20 UTC',
    });
    const panel = await Bun.file('frontend/packages/ui/src/entity-workspace-accounts-panel.tsx').text();
    expect(panel).toContain('data-testid="account-commitment-timestamp"');
    expect(panel).toContain('className="account-commitment-timestamp"');
    expect(panel).toContain('dateTime={formatted.dateTime}');
    expect(panel).toContain('title={`Runtime timestamp ${timestamp}`}');
    expect(panel).toContain('formatEntityWorkspaceTimestamp(timestamp)');
  });

  test('projects exact committed Account protocol context without financial derivation', async () => {
    const projected = projectEntityWorkspaceAccounts({ context: CONTEXT, frame: FRAME });
    if (projected.status !== 'selected') throw new Error('TEST_ACCOUNT_PROTOCOL_CONTEXT_MISSING');
    expect(projected.items[0]).toMatchObject({
      chainId: 31_337,
      depositoryAddress: '0xdepository',
      jurisdictionNonce: 7,
      lastFinalizedJurisdictionHeight: 12,
      leftResponseSeconds: 3_600,
      rightResponseSeconds: 86_400,
    });
    const panel = await Bun.file('frontend/packages/ui/src/entity-workspace-accounts-panel.tsx').text();
    expect(panel).toContain('data-testid="account-protocol-depository"');
    expect(panel).toContain('data-testid="account-protocol-response-windows"');
    expect(panel).not.toContain('deriveDelta');
  });

  test('rejects malformed committed Account protocol context', () => {
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', {}, {
        domain: { chainId: 0, depositoryAddress: '0xdepository' },
      })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_CHAIN_ID_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', {}, {
        domain: { chainId: 31_337, depositoryAddress: '' },
      })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_DEPOSITORY_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', {}, { jNonce: 1.5 })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_JURISDICTION_NONCE_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', {}, { lastFinalizedJHeight: -1 })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_FINALIZED_J_HEIGHT_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', {}, {
        disputeConfig: { leftResponseSeconds: -1, rightResponseSeconds: 0 },
      })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_LEFT_RESPONSE_SECONDS_INVALID');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xbbbb', 1, '0xhash', {}, { disputeConfig: null })]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_DISPUTE_CONFIG_INVALID');
  });

  test('rejects foreign, self, or duplicate bilateral Accounts', () => {
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xdddd', '0xbbbb', 1, '0xhash')]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_PERSPECTIVE_MISMATCH');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([account('0xaaaa', '0xaaaa', 1, '0xhash')]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_PERSPECTIVE_MISMATCH');
    expect(() => projectEntityWorkspaceAccounts({
      context: CONTEXT,
      frame: frameWithAccounts([
        account('0xaaaa', '0xbbbb', 1, '0xhash1'),
        account('0xbbbb', '0xaaaa', 2, '0xhash2'),
      ]),
    })).toThrow('ENTITY_WORKSPACE_ACCOUNT_COUNTERPARTY_DUPLICATE');
  });
});
