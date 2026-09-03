import type {
  EntityWorkspaceAccountItem,
  EntityWorkspaceAccounts,
} from './entity-workspace-accounts';
import type { EntityWorkspaceContext } from './entity-workspace-context';
import type {
  EntityWorkspaceBoardMember,
  EntityWorkspaceBoardMode,
  EntityWorkspaceOwnership,
} from './entity-workspace-ownership';

type EmptyEntityWorkspaceConsensusEvidence = Readonly<{
  status: 'empty';
}>;

type SelectedEntityWorkspaceConsensusEvidence = Readonly<{
  status: 'selected';
  entityId: string;
  runtimeHeight: number;
  boardMode: EntityWorkspaceBoardMode;
  threshold: bigint;
  totalShares: bigint;
  members: readonly EntityWorkspaceBoardMember[];
  attachedSignerId: string | null;
  accounts: readonly EntityWorkspaceAccountItem[];
  accountPageIndex: number;
  accountPageCount: number;
  totalAccounts: number;
}>;

export type EntityWorkspaceConsensusEvidence =
  | EmptyEntityWorkspaceConsensusEvidence
  | SelectedEntityWorkspaceConsensusEvidence;

export type EntityWorkspaceConsensusEvidenceInput = Readonly<{
  accounts: EntityWorkspaceAccounts;
  context: EntityWorkspaceContext;
  ownership: EntityWorkspaceOwnership;
}>;

export const emptyEntityWorkspaceConsensusEvidence = (
): EmptyEntityWorkspaceConsensusEvidence => ({ status: 'empty' });

const selectedEvidence = (
  context: Extract<EntityWorkspaceContext, Readonly<{ status: 'selected' }>>,
  accounts: Extract<EntityWorkspaceAccounts, Readonly<{ status: 'selected' }>>,
  ownership: Extract<EntityWorkspaceOwnership, Readonly<{ status: 'selected' }>>,
): SelectedEntityWorkspaceConsensusEvidence => ({
  status: 'selected',
  entityId: context.entityId,
  runtimeHeight: context.height,
  boardMode: ownership.mode,
  threshold: ownership.threshold,
  totalShares: ownership.totalShares,
  members: ownership.members,
  attachedSignerId: ownership.attachedSignerId,
  accounts: accounts.items,
  accountPageIndex: accounts.pageIndex,
  accountPageCount: accounts.pageCount,
  totalAccounts: accounts.totalItems,
});

export function projectEntityWorkspaceConsensusEvidence(
  input: EntityWorkspaceConsensusEvidenceInput,
): EntityWorkspaceConsensusEvidence {
  if (input.context.status === 'empty') {
    if (input.accounts.status !== 'empty' || input.ownership.status !== 'empty') {
      throw new Error('ENTITY_WORKSPACE_CONSENSUS_EMPTY_CONTEXT_MISMATCH');
    }
    return emptyEntityWorkspaceConsensusEvidence();
  }
  if (input.accounts.status !== 'selected' || input.ownership.status !== 'selected') {
    throw new Error('ENTITY_WORKSPACE_CONSENSUS_PROJECTION_MISSING');
  }
  if (
    input.accounts.entityId !== input.context.entityId ||
    input.ownership.entityId !== input.context.entityId
  ) {
    throw new Error('ENTITY_WORKSPACE_CONSENSUS_ENTITY_ID_MISMATCH');
  }
  return selectedEvidence(input.context, input.accounts, input.ownership);
}
