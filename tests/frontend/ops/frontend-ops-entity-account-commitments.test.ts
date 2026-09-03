import { describe, expect, test } from 'bun:test';

import { projectEntityWorkspaceAccounts } from '../../../frontend/packages/runtime-client/src/entity-workspace-accounts';
import { projectEntityWorkspaceContext } from '../../../frontend/packages/runtime-client/src/entity-workspace-context';

const frame = {
  height: 44,
  activeEntityId: '0xaaaa',
  activeEntity: {
    summary: { entityId: '0xaaaa', label: 'Treasury' },
    core: { entityId: '0xaaaa' },
    accounts: {
      items: [{
        state: { leftEntity: '0xaaaa', rightEntity: '0xbbbb' },
        currentFrame: {
          height: 12,
          timestamp: 1_700_000_012,
          jHeight: 11,
          accountTxs: [{ type: 'directPayment' }, { type: 'ack' }],
          prevFrameHash: '0xprevious',
          accountStateRoot: '0xroot',
          stateHash: '0xstate',
        },
      }],
      pageIndex: 0,
      pageCount: 1,
      totalItems: 1,
      limit: 8,
    },
  },
};

describe('React Entity Account commitment evidence', () => {
  test('projects the exact bounded Account frame header without financial derivation', () => {
    const context = projectEntityWorkspaceContext({ runtimeId: 'runtime-a', frame });
    expect(projectEntityWorkspaceAccounts({ context, frame })).toMatchObject({
      status: 'selected',
      items: [{
        counterpartyId: '0xbbbb',
        frameHeight: 12,
        frameTimestamp: 1_700_000_012,
        jurisdictionHeight: 11,
        transactionCount: 2,
        previousFrameHash: '0xprevious',
        accountStateRoot: '0xroot',
        stateHash: '0xstate',
      }],
    });
  });

  test('keeps the visible Account commitment surface read-only', async () => {
    const panel = await Bun.file('frontend/packages/ui/src/entity-workspace-accounts-panel.tsx').text();
    expect(panel).toContain('data-testid="account-commitment"');
    expect(panel).toContain('Account state root');
    expect(panel).toContain('Previous frame');
    expect(panel).toContain('Exact committed frame evidence');
    expect(panel).not.toContain('.send(');
    expect(panel).not.toContain('deriveDelta');
  });
});
