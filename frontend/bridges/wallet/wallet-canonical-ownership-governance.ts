import { toEntityId, type RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import {
  buildControlBoardActivationInputs,
  buildControlBoardProposalInput,
  type ControlTakeoverBoard,
} from '../../src/lib/components/Entity/ownership/ownership-flow';

export type WalletControlTakeoverTarget = Readonly<{ entityId: string; name: string }>;
export type WalletControlTakeoverStatus = Readonly<{
  targetEntityId: string;
  currentBoardHash: string;
  proposedBoardHash: string;
  successorBoardHash: string;
  runtimeBoardHash: string;
  actionNonce: bigint;
  currentUnix: bigint;
  activateAt: bigint;
  activationAvailableAt: bigint;
}>;
export type WalletControlTakeoverReview = Readonly<{
  targetEntityId: string;
  targetName: string;
  newBoardHash: string;
  actionNonce: bigint;
}>;
export type WalletControlActivationReview = Readonly<{
  targetEntityId: string;
  targetName: string;
  currentBoardHash: string;
  newBoardHash: string;
  actionNonce: bigint;
  activateAt: bigint;
  activationAvailableAt: bigint;
  board: ControlTakeoverBoard;
}>;
export type WalletControlActivationState = 'unavailable' | 'waiting' | 'ready' | 'active';

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();
const requireRecord = (value: unknown, code: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
};

const requireTarget = (value: unknown): WalletControlTakeoverTarget => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CONTROL_TAKEOVER_TARGET_INVALID');
  const target = value as Record<string, unknown>;
  const entityId = normalize(target['entityId']);
  const name = String(target['name'] || '').trim();
  if (!/^0x[0-9a-f]{64}$/.test(entityId) || !name) throw new Error('CONTROL_TAKEOVER_TARGET_INVALID');
  return { entityId, name };
};

const requireHash = (value: unknown, code: string): string => {
  const hash = normalize(value);
  if (!/^0x[0-9a-f]{64}$/.test(hash)) throw new Error(code);
  return hash;
};

export const readWalletControlTakeoverTargets = async (
  adapter: RuntimeAdapter,
  shareholderEntityId: string,
  signerId: string,
): Promise<readonly WalletControlTakeoverTarget[]> => {
  const result = await adapter.control<{ targets: unknown }>({
    type: 'control-board-governance', operation: 'targets', shareholderEntityId, signerId,
  });
  if (!Array.isArray(result.targets)) throw new Error('CONTROL_TAKEOVER_TARGETS_INVALID');
  return result.targets.map(requireTarget);
};

export const readWalletControlTakeoverStatus = (
  adapter: RuntimeAdapter,
  shareholderEntityId: string,
  signerId: string,
  targetEntityId: string,
): Promise<WalletControlTakeoverStatus> => adapter.control<unknown>({
  type: 'control-board-governance', operation: 'status', shareholderEntityId, signerId, targetEntityId,
}).then(value => {
  const status = requireRecord(value, 'CONTROL_TAKEOVER_STATUS_INVALID');
  const entityId = normalize(status['targetEntityId']);
  const currentBoardHash = requireHash(status['currentBoardHash'], 'CONTROL_TAKEOVER_STATUS_INVALID');
  const proposedBoardHash = requireHash(status['proposedBoardHash'], 'CONTROL_TAKEOVER_STATUS_INVALID');
  const successorBoardHash = requireHash(status['successorBoardHash'], 'CONTROL_TAKEOVER_STATUS_INVALID');
  const runtimeBoardHash = requireHash(status['runtimeBoardHash'], 'CONTROL_TAKEOVER_STATUS_INVALID');
  if (!/^0x[0-9a-f]{64}$/.test(entityId) || typeof status['actionNonce'] !== 'bigint'
    || typeof status['currentUnix'] !== 'bigint' || typeof status['activateAt'] !== 'bigint'
    || typeof status['activationAvailableAt'] !== 'bigint') {
    throw new Error('CONTROL_TAKEOVER_STATUS_INVALID');
  }
  return {
    targetEntityId: entityId, currentBoardHash, proposedBoardHash, successorBoardHash, runtimeBoardHash,
    actionNonce: status['actionNonce'], currentUnix: status['currentUnix'], activateAt: status['activateAt'],
    activationAvailableAt: status['activationAvailableAt'],
  };
});

export const getWalletControlActivationState = (status: WalletControlTakeoverStatus): WalletControlActivationState => {
  if (status.currentBoardHash === status.successorBoardHash && status.runtimeBoardHash === status.successorBoardHash) {
    return 'active';
  }
  if (status.runtimeBoardHash !== status.currentBoardHash || status.proposedBoardHash !== status.successorBoardHash) {
    return 'unavailable';
  }
  return status.activationAvailableAt > 0n && status.currentUnix >= status.activationAvailableAt ? 'ready' : 'waiting';
};

const requireReview = (value: unknown): WalletControlTakeoverReview => {
  const review = requireRecord(value, 'CONTROL_TAKEOVER_REVIEW_INVALID');
  const targetEntityId = normalize(review['targetEntityId']);
  const targetName = String(review['targetName'] || '').trim();
  const newBoardHash = normalize(review['newBoardHash']);
  if (!/^0x[0-9a-f]{64}$/.test(targetEntityId) || !targetName
    || !/^0x[0-9a-f]{64}$/.test(newBoardHash) || typeof review['actionNonce'] !== 'bigint') {
    throw new Error('CONTROL_TAKEOVER_REVIEW_INVALID');
  }
  return { targetEntityId, targetName, newBoardHash, actionNonce: review['actionNonce'] };
};

export const reviewWalletControlBoardProposal = (
  adapter: RuntimeAdapter,
  shareholderEntityId: string,
  signerId: string,
  targetEntityId: string,
): Promise<WalletControlTakeoverReview> => adapter.control<unknown>({
  type: 'control-board-governance', operation: 'review', shareholderEntityId, signerId, targetEntityId,
}).then(requireReview);

export const prepareWalletControlBoardProposal = async (
  adapter: RuntimeAdapter,
  shareholderEntityId: string,
  signerId: string,
  review: WalletControlTakeoverReview,
) => {
  const prepared = requireReview(await adapter.control<unknown>({
    type: 'control-board-governance', operation: 'prepare', shareholderEntityId, signerId,
    targetEntityId: review.targetEntityId, expectedBoardHash: review.newBoardHash,
    expectedActionNonce: review.actionNonce.toString(),
  }));
  if (prepared.newBoardHash !== review.newBoardHash || prepared.actionNonce !== review.actionNonce) {
    throw new Error('CONTROL_TAKEOVER_REVIEW_STALE');
  }
  return buildControlBoardProposalInput({
    shareholderEntityId: toEntityId(shareholderEntityId), signerId,
    targetEntityId: toEntityId(review.targetEntityId), newBoardHash: review.newBoardHash,
    actionNonce: review.actionNonce,
  });
};

export const observeWalletControlBoardProposal = async (
  adapter: RuntimeAdapter,
  shareholderEntityId: string,
  signerId: string,
  review: WalletControlTakeoverReview,
): Promise<WalletControlTakeoverStatus> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const status = await readWalletControlTakeoverStatus(adapter, shareholderEntityId, signerId, review.targetEntityId);
    if (status.proposedBoardHash === review.newBoardHash && status.actionNonce === review.actionNonce) return status;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`CONTROL_TAKEOVER_PROPOSAL_NOT_OBSERVED:${review.newBoardHash}`);
};

const requireBoard = (value: unknown, signerId: string): ControlTakeoverBoard => {
  const board = requireRecord(value, 'CONTROL_TAKEOVER_ACTIVATION_BOARD_INVALID');
  const validators = board['validators'];
  const shares = requireRecord(board['shares'], 'CONTROL_TAKEOVER_ACTIVATION_BOARD_INVALID');
  const signer = normalize(signerId);
  if (
    (board['mode'] !== 'proposer-based' && board['mode'] !== 'gossip-based') ||
    board['threshold'] !== 1n ||
    !Array.isArray(validators) ||
    validators.length !== 1 ||
    normalize(validators[0]) !== signer ||
    shares[signer] !== 1n ||
    Object.keys(shares).length !== 1
  ) {
    throw new Error('CONTROL_TAKEOVER_ACTIVATION_BOARD_INVALID');
  }
  return { mode: board['mode'], threshold: 1n, validators: [signer], shares: { [signer]: 1n } };
};

const requireActivationReview = (value: unknown, signerId: string): WalletControlActivationReview => {
  const review = requireRecord(value, 'CONTROL_TAKEOVER_ACTIVATION_REVIEW_INVALID');
  const targetEntityId = normalize(review['targetEntityId']);
  const targetName = String(review['targetName'] || '').trim();
  if (
    !/^0x[0-9a-f]{64}$/.test(targetEntityId) ||
    !targetName ||
    typeof review['actionNonce'] !== 'bigint' ||
    typeof review['activateAt'] !== 'bigint' ||
    typeof review['activationAvailableAt'] !== 'bigint'
  ) {
    throw new Error('CONTROL_TAKEOVER_ACTIVATION_REVIEW_INVALID');
  }
  return {
    targetEntityId,
    targetName,
    currentBoardHash: requireHash(review['currentBoardHash'], 'CONTROL_TAKEOVER_ACTIVATION_REVIEW_INVALID'),
    newBoardHash: requireHash(review['newBoardHash'], 'CONTROL_TAKEOVER_ACTIVATION_REVIEW_INVALID'),
    actionNonce: review['actionNonce'],
    activateAt: review['activateAt'],
    activationAvailableAt: review['activationAvailableAt'],
    board: requireBoard(review['board'], signerId),
  };
};

export const reviewWalletControlBoardActivation = (
  adapter: RuntimeAdapter,
  shareholderEntityId: string,
  signerId: string,
  targetEntityId: string,
): Promise<WalletControlActivationReview> =>
  adapter
    .control<unknown>({
      type: 'control-board-governance',
      operation: 'activation-review',
      shareholderEntityId,
      signerId,
      targetEntityId,
    })
    .then(value => requireActivationReview(value, signerId));

export const prepareWalletControlBoardActivation = async (
  adapter: RuntimeAdapter,
  shareholderEntityId: string,
  signerId: string,
  review: WalletControlActivationReview,
) => {
  const prepared = requireActivationReview(
    await adapter.control<unknown>({
      type: 'control-board-governance',
      operation: 'activation-prepare',
      shareholderEntityId,
      signerId,
      targetEntityId: review.targetEntityId,
      expectedBoardHash: review.newBoardHash,
      expectedActionNonce: review.actionNonce.toString(),
    }),
    signerId,
  );
  if (prepared.newBoardHash !== review.newBoardHash || prepared.actionNonce !== review.actionNonce) {
    throw new Error('CONTROL_TAKEOVER_ACTIVATION_REVIEW_STALE');
  }
  return buildControlBoardActivationInputs({
    shareholderEntityId: toEntityId(shareholderEntityId),
    targetEntityId: toEntityId(review.targetEntityId),
    signerId,
    board: prepared.board,
  });
};

export const observeWalletControlBoardActivation = async (
  adapter: RuntimeAdapter,
  shareholderEntityId: string,
  signerId: string,
  review: WalletControlActivationReview,
): Promise<WalletControlTakeoverStatus> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const status = await readWalletControlTakeoverStatus(adapter, shareholderEntityId, signerId, review.targetEntityId);
    if (getWalletControlActivationState(status) === 'active') return status;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`CONTROL_TAKEOVER_ACTIVATION_NOT_OBSERVED:${review.newBoardHash}`);
};
