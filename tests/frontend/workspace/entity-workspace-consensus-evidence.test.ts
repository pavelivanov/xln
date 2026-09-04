import { describe, expect, test } from 'bun:test';

import {
  emptyEntityWorkspaceConsensusEvidence,
  projectEntityWorkspaceConsensusEvidence,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-consensus-evidence';

const CONTEXT = {
  status: 'selected', runtimeId: 'runtime-a', height: 42, entityId: '0xaaaa',
  entityName: 'Treasury', signerId: '0xbbbb', jurisdictionName: 'Localnet', accountCount: 1,
} as const;

const ACCOUNTS = {
  status: 'selected', entityId: '0xaaaa', pageIndex: 0, pageCount: 1, totalItems: 1, limit: 8,
  items: [{
    chainId: 31_337, counterpartyId: '0xcccc', depositoryAddress: '0xdepository',
    frameHeight: 7, frameTimestamp: 1_700_000_007, jurisdictionHeight: 6,
    jurisdictionNonce: 3, lastFinalizedJurisdictionHeight: 5,
    leftResponseSeconds: 3_600, rightResponseSeconds: 3_600, transactionCount: 1,
    previousFrameHash: '0xprevious', accountStateRoot: '0xroot', stateHash: '0xstate',
  }],
} as const;

const OWNERSHIP = {
  status: 'selected', entityId: '0xaaaa', mode: 'proposer-based', threshold: 2n, totalShares: 3n,
  members: [
    { signerId: '0xbbbb', shares: 2n, isAttachedSigner: true },
    { signerId: '0xdddd', shares: 1n, isAttachedSigner: false },
  ],
  attachedSignerId: '0xbbbb',
} as const;

const FRAME = {
  height: 42,
  activeEntity: {
    core: {
      entityId: '0xaaaa', height: 9, timestamp: 1_700_000_009,
      prevFrameHash: '0xentity-frame', lastFinalizedJHeight: 8,
    },
  },
} as const;

describe('Entity workspace consensus evidence', () => {
  test('composes exact committed Entity, board, and bounded Account evidence', () => {
    expect(projectEntityWorkspaceConsensusEvidence({ accounts: ACCOUNTS, context: CONTEXT, frame: FRAME, ownership: OWNERSHIP }))
      .toEqual({
        status: 'selected', entityId: '0xaaaa', runtimeHeight: 42,
        entityHeight: 9, entityTimestamp: 1_700_000_009,
        entityFrameHash: '0xentity-frame', lastFinalizedJurisdictionHeight: 8,
        boardMode: 'proposer-based', threshold: 2n, totalShares: 3n,
        members: OWNERSHIP.members, attachedSignerId: '0xbbbb',
        accounts: ACCOUNTS.items, accountPageIndex: 0, accountPageCount: 1, totalAccounts: 1,
      });
  });

  test('keeps a consistently empty Runtime projection explicit', () => {
    expect(projectEntityWorkspaceConsensusEvidence({
      accounts: { status: 'empty' }, context: { status: 'empty', runtimeId: null, height: 0, entityId: null, entityName: null, signerId: null, jurisdictionName: null, accountCount: null },
      ownership: { status: 'empty' },
    })).toEqual(emptyEntityWorkspaceConsensusEvidence());
  });

  test('rejects partial projections and cross-Entity composition', () => {
    expect(() => projectEntityWorkspaceConsensusEvidence({
      accounts: { status: 'empty' }, context: CONTEXT, frame: FRAME, ownership: OWNERSHIP,
    })).toThrow('ENTITY_WORKSPACE_CONSENSUS_PROJECTION_MISSING');
    expect(() => projectEntityWorkspaceConsensusEvidence({
      accounts: { ...ACCOUNTS, entityId: '0xffff' }, context: CONTEXT, frame: FRAME, ownership: OWNERSHIP,
    })).toThrow('ENTITY_WORKSPACE_CONSENSUS_ENTITY_ID_MISMATCH');
    expect(() => projectEntityWorkspaceConsensusEvidence({
      accounts: ACCOUNTS,
      context: { status: 'empty', runtimeId: null, height: 0, entityId: null, entityName: null, signerId: null, jurisdictionName: null, accountCount: null },
      ownership: OWNERSHIP,
    })).toThrow('ENTITY_WORKSPACE_CONSENSUS_EMPTY_CONTEXT_MISMATCH');
  });

  test('rejects malformed committed Entity frame evidence', () => {
    const project = (core: Record<string, unknown>) => projectEntityWorkspaceConsensusEvidence({
      accounts: ACCOUNTS,
      context: CONTEXT,
      frame: { ...FRAME, activeEntity: { core } },
      ownership: OWNERSHIP,
    });
    expect(() => project({ ...FRAME.activeEntity.core, entityId: '0xffff' }))
      .toThrow('ENTITY_WORKSPACE_CONSENSUS_FRAME_ENTITY_ID_MISMATCH');
    expect(() => project({ ...FRAME.activeEntity.core, height: -1 }))
      .toThrow('ENTITY_WORKSPACE_CONSENSUS_ENTITY_HEIGHT_INVALID');
    expect(() => project({ ...FRAME.activeEntity.core, timestamp: Number.MAX_SAFE_INTEGER }))
      .toThrow('ENTITY_WORKSPACE_CONSENSUS_ENTITY_TIMESTAMP_INVALID');
    expect(() => project({ ...FRAME.activeEntity.core, prevFrameHash: '' }))
      .toThrow('ENTITY_WORKSPACE_CONSENSUS_ENTITY_FRAME_HASH_INVALID');
    expect(() => project({ ...FRAME.activeEntity.core, lastFinalizedJHeight: 1.5 }))
      .toThrow('ENTITY_WORKSPACE_CONSENSUS_FINALIZED_J_HEIGHT_INVALID');
  });

  test('renders exact Entity frame coordinates without local consensus state', async () => {
    const panel = await Bun.file('frontend/packages/ui/src/entity-workspace-consensus-panel.tsx').text();
    expect(panel).toContain('data-testid="consensus-entity-height"');
    expect(panel).toContain('data-testid="consensus-entity-timestamp"');
    expect(panel).toContain('data-testid="consensus-finalized-j-height"');
    expect(panel).toContain('data-testid="consensus-entity-frame-hash"');
    expect(panel).not.toContain('pendingFrameHash');
    expect(panel).not.toContain('leaderCertificateVoteCount');
  });
});
