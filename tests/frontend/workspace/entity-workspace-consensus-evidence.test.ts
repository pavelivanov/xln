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
  items: [{ counterpartyId: '0xcccc', frameHeight: 7, stateHash: '0xstate' }],
} as const;

const OWNERSHIP = {
  status: 'selected', entityId: '0xaaaa', mode: 'proposer-based', threshold: 2n, totalShares: 3n,
  members: [
    { signerId: '0xbbbb', shares: 2n, isAttachedSigner: true },
    { signerId: '0xdddd', shares: 1n, isAttachedSigner: false },
  ],
  attachedSignerId: '0xbbbb',
} as const;

describe('Entity workspace consensus evidence', () => {
  test('composes only exact committed board and bounded Account evidence', () => {
    expect(projectEntityWorkspaceConsensusEvidence({ accounts: ACCOUNTS, context: CONTEXT, ownership: OWNERSHIP }))
      .toEqual({
        status: 'selected', entityId: '0xaaaa', runtimeHeight: 42,
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
      accounts: { status: 'empty' }, context: CONTEXT, ownership: OWNERSHIP,
    })).toThrow('ENTITY_WORKSPACE_CONSENSUS_PROJECTION_MISSING');
    expect(() => projectEntityWorkspaceConsensusEvidence({
      accounts: { ...ACCOUNTS, entityId: '0xffff' }, context: CONTEXT, ownership: OWNERSHIP,
    })).toThrow('ENTITY_WORKSPACE_CONSENSUS_ENTITY_ID_MISMATCH');
    expect(() => projectEntityWorkspaceConsensusEvidence({
      accounts: ACCOUNTS,
      context: { status: 'empty', runtimeId: null, height: 0, entityId: null, entityName: null, signerId: null, jurisdictionName: null, accountCount: null },
      ownership: OWNERSHIP,
    })).toThrow('ENTITY_WORKSPACE_CONSENSUS_EMPTY_CONTEXT_MISMATCH');
  });
});
