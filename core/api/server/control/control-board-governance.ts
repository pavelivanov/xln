import type { EntityReplica } from '../../../entity/types';
import { encodeBoard, hashBoard } from '../../../entity/factory';
import { toEntityId } from '../../../protocol/identity';
import { getEntityJAdapter } from '../../../runtime/j-submit/api';
import type { RuntimeReplica } from '../../../runtime/types';
import { withRuntimeCommittedRead } from '../../../runtime/frame/lifecycle/writer-lock';
import type { ControlBoardGovernanceRequest } from '../../runtime-adapter/control/control-board-governance';

const ZERO_HASH = `0x${'0'.repeat(64)}`;
const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();
type TakeoverTarget = Readonly<{ entityId: string; name: string }>;
type TakeoverTargetCandidate = Readonly<{
  entityId: string;
  name: string;
  signerId: string;
  validators: readonly string[];
  entityProviderAddress: string;
}>;

const findReplica = (env: RuntimeReplica, entityId: string, signerId: string): EntityReplica => {
  const normalizedEntityId = toEntityId(entityId);
  const normalizedSignerId = normalize(signerId);
  const replica = [...env.state.eReplicas.values()].find(candidate => (
    normalize(candidate.state.entityId || candidate.entityId) === normalizedEntityId
    && normalize(candidate.signerId) === normalizedSignerId
  ));
  if (!replica) throw new Error(`CONTROL_TAKEOVER_TARGET_REPLICA_MISSING:${normalizedEntityId}:${normalizedSignerId}`);
  return replica;
};

export const projectControlTakeoverTargets = (input: Readonly<{
  shareholderEntityId: string;
  signerId: string;
  entityProviderAddress: string;
  candidates: readonly TakeoverTargetCandidate[];
}>): readonly TakeoverTarget[] => {
  const currentEntityId = normalize(input.shareholderEntityId);
  const currentSignerId = normalize(input.signerId);
  const currentProvider = normalize(input.entityProviderAddress);
  const targets = new Map<string, TakeoverTarget>();
  for (const candidate of input.candidates) {
    const entityId = normalize(candidate.entityId);
    if (!entityId || entityId === currentEntityId || normalize(candidate.signerId) !== currentSignerId
      || !currentProvider || normalize(candidate.entityProviderAddress) !== currentProvider
      || !candidate.validators.some(validator => normalize(validator) === currentSignerId)) continue;
    if (!targets.has(entityId)) {
      targets.set(entityId, { entityId, name: candidate.name.trim() || entityId });
    }
  }
  return [...targets.values()].sort((left, right) => left.name.localeCompare(right.name));
};

const projectTargets = (env: RuntimeReplica, shareholderEntityId: string, signerId: string): readonly TakeoverTarget[] => {
  const shareholder = findReplica(env, shareholderEntityId, signerId);
  return projectControlTakeoverTargets({
    shareholderEntityId: shareholder.state.entityId,
    signerId,
    entityProviderAddress: shareholder.state.config.jurisdiction?.entityProviderAddress ?? '',
    candidates: [...env.state.eReplicas.values()].map(candidate => ({
      entityId: candidate.state.entityId || candidate.entityId,
      name: candidate.state.profile?.name ?? '',
      signerId: candidate.signerId,
      validators: candidate.state.config.validators,
      entityProviderAddress: candidate.state.config.jurisdiction?.entityProviderAddress ?? '',
    })),
  });
};

const captureTarget = async (env: RuntimeReplica, request: Exclude<ControlBoardGovernanceRequest, { operation: 'targets' }>) =>
  withRuntimeCommittedRead(env, () => {
    const target = projectTargets(env, request.shareholderEntityId, request.signerId)
      .find(candidate => candidate.entityId === normalize(request.targetEntityId));
    if (!target) throw new Error(`CONTROL_TAKEOVER_TARGET_INELIGIBLE:${normalize(request.targetEntityId)}`);
    const config = structuredClone(findReplica(env, target.entityId, request.signerId).state.config);
    const signerId = normalize(request.signerId);
    const board = {
      mode: config.mode,
      threshold: 1n,
      validators: [signerId],
      shares: { [signerId]: 1n },
      ...(config.jurisdiction ? { jurisdiction: config.jurisdiction } : {}),
    };
    const encodedBoard = encodeBoard(board, env);
    return { target, encodedBoard, newBoardHash: normalize(hashBoard(encodedBoard)) };
  });

const readStatus = async (env: RuntimeReplica, request: Exclude<ControlBoardGovernanceRequest, { operation: 'targets' }>) => {
  const target = await captureTarget(env, request);
  const adapter = getEntityJAdapter(env, toEntityId(request.shareholderEntityId), normalize(request.signerId));
  if (!adapter) throw new Error('CONTROL_TAKEOVER_JADAPTER_REQUIRED');
  const [entity, latestBlock, actionNonce] = await Promise.all([
    adapter.entityProvider.entities(target.target.entityId),
    adapter.provider.getBlock('latest'),
    adapter.entityProvider.boardActionNonces(target.target.entityId),
  ]);
  if (!latestBlock) throw new Error('CONTROL_TAKEOVER_LATEST_BLOCK_MISSING');
  return {
    ...target,
    status: {
      targetEntityId: target.target.entityId,
      currentBoardHash: normalize(entity.currentBoardHash),
      proposedBoardHash: normalize(entity.proposedBoardHash) || ZERO_HASH,
      actionNonce: BigInt(actionNonce),
      currentUnix: BigInt(latestBlock.timestamp),
      activateAt: BigInt(entity.activateAt),
    },
    adapter,
  };
};

export const resolveControlBoardGovernance = async (
  env: RuntimeReplica,
  request: ControlBoardGovernanceRequest,
): Promise<unknown> => {
  if (request.operation === 'targets') {
    return withRuntimeCommittedRead(env, () => ({ targets: projectTargets(env, request.shareholderEntityId, request.signerId) }));
  }
  const captured = await readStatus(env, request);
  if (request.operation === 'status') return captured.status;
  const review = { targetEntityId: captured.target.entityId, targetName: captured.target.name, newBoardHash: captured.newBoardHash, actionNonce: captured.status.actionNonce + 1n };
  if (request.operation === 'review') {
    if (captured.status.proposedBoardHash !== ZERO_HASH) throw new Error('CONTROL_TAKEOVER_PROPOSAL_ALREADY_PENDING');
    if (captured.status.currentBoardHash === captured.newBoardHash) throw new Error('CONTROL_TAKEOVER_BOARD_ALREADY_ACTIVE');
    return review;
  }
  let expectedActionNonce: bigint;
  try { expectedActionNonce = BigInt(request.expectedActionNonce); }
  catch { throw new Error(`CONTROL_TAKEOVER_ACTION_NONCE_INVALID:${request.expectedActionNonce}`); }
  if (normalize(request.expectedBoardHash) !== review.newBoardHash || expectedActionNonce !== review.actionNonce) {
    throw new Error('CONTROL_TAKEOVER_REVIEW_STALE');
  }
  if (captured.status.proposedBoardHash !== ZERO_HASH) throw new Error('CONTROL_TAKEOVER_PROPOSAL_ALREADY_PENDING');
  if (captured.status.currentBoardHash === captured.newBoardHash) throw new Error('CONTROL_TAKEOVER_BOARD_ALREADY_ACTIVE');
  if (!(await captured.adapter.entityProvider.committedBoards(captured.newBoardHash))) {
    const receipt = await (await captured.adapter.entityProvider.commitBoard(captured.encodedBoard)).wait();
    if (receipt?.status !== 1) throw new Error(`BOARD_COMMIT_FAILED:${captured.newBoardHash}`);
  }
  return review;
};
