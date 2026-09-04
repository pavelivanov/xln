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
import {
  requireFiniteNumber,
  requireUnknownRecord,
} from './boundary';

type EmptyEntityWorkspaceConsensusEvidence = Readonly<{
  status: 'empty';
}>;

type SelectedEntityWorkspaceConsensusEvidence = Readonly<{
  status: 'selected';
  entityId: string;
  runtimeHeight: number;
  entityHeight: number;
  entityTimestamp: number;
  entityFrameHash: string;
  lastFinalizedJurisdictionHeight: number;
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
  frame?: unknown;
  ownership: EntityWorkspaceOwnership;
}>;

export const emptyEntityWorkspaceConsensusEvidence = (
): EmptyEntityWorkspaceConsensusEvidence => ({ status: 'empty' });

const nonnegativeInteger = (value: unknown, code: string): number => {
  const parsed = requireFiniteNumber(value, code);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
  return parsed;
};

const entityTimestamp = (value: unknown): number => {
  const timestamp = nonnegativeInteger(value, 'ENTITY_WORKSPACE_CONSENSUS_ENTITY_TIMESTAMP_INVALID');
  if (timestamp > 8_640_000_000_000_000) {
    throw new Error('ENTITY_WORKSPACE_CONSENSUS_ENTITY_TIMESTAMP_INVALID');
  }
  return timestamp;
};

// EntityState.prevFrameHash is installed with the just-committed frame hash;
// at non-genesis height it is the certified head that must parent the next
// frame. Treating it as an optional historical parent would hide a broken
// durable lineage from this evidence boundary.
const entityFrameHash = (value: unknown, height: number): string => {
  if (height === 0 && (value === undefined || value === null || value === '' || value === 'genesis')) {
    return 'genesis';
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('ENTITY_WORKSPACE_CONSENSUS_ENTITY_FRAME_HASH_INVALID');
  }
  return value.trim();
};

const entityFrameEvidence = (
  frame: unknown,
  entityId: string,
): Pick<
  SelectedEntityWorkspaceConsensusEvidence,
  'entityHeight' | 'entityTimestamp' | 'entityFrameHash' | 'lastFinalizedJurisdictionHeight'
> => {
  const root = requireUnknownRecord(frame, 'ENTITY_WORKSPACE_CONSENSUS_FRAME_INVALID');
  const active = requireUnknownRecord(root['activeEntity'], 'ENTITY_WORKSPACE_CONSENSUS_ACTIVE_ENTITY_INVALID');
  const core = requireUnknownRecord(active['core'], 'ENTITY_WORKSPACE_CONSENSUS_CORE_INVALID');
  if (typeof core['entityId'] !== 'string' || core['entityId'].trim().toLowerCase() !== entityId) {
    throw new Error('ENTITY_WORKSPACE_CONSENSUS_FRAME_ENTITY_ID_MISMATCH');
  }
  const entityHeight = nonnegativeInteger(core['height'], 'ENTITY_WORKSPACE_CONSENSUS_ENTITY_HEIGHT_INVALID');
  return {
    entityHeight,
    entityTimestamp: entityTimestamp(core['timestamp']),
    entityFrameHash: entityFrameHash(core['prevFrameHash'], entityHeight),
    lastFinalizedJurisdictionHeight: nonnegativeInteger(
      core['lastFinalizedJHeight'],
      'ENTITY_WORKSPACE_CONSENSUS_FINALIZED_J_HEIGHT_INVALID',
    ),
  };
};

const selectedEvidence = (
  context: Extract<EntityWorkspaceContext, Readonly<{ status: 'selected' }>>,
  accounts: Extract<EntityWorkspaceAccounts, Readonly<{ status: 'selected' }>>,
  ownership: Extract<EntityWorkspaceOwnership, Readonly<{ status: 'selected' }>>,
  frame: unknown,
): SelectedEntityWorkspaceConsensusEvidence => ({
  status: 'selected',
  entityId: context.entityId,
  runtimeHeight: context.height,
  ...entityFrameEvidence(frame, context.entityId),
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
  return selectedEvidence(input.context, input.accounts, input.ownership, input.frame);
}
