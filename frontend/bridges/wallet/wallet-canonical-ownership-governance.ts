import { toEntityId, type RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import { buildControlBoardProposalInput } from '../../src/lib/components/Entity/ownership/ownership-flow';

export type WalletControlTakeoverTarget = Readonly<{ entityId: string; name: string }>;
export type WalletControlTakeoverStatus = Readonly<{
  targetEntityId: string;
  currentBoardHash: string;
  proposedBoardHash: string;
  actionNonce: bigint;
  currentUnix: bigint;
  activateAt: bigint;
}>;
export type WalletControlTakeoverReview = Readonly<{
  targetEntityId: string;
  targetName: string;
  newBoardHash: string;
  actionNonce: bigint;
}>;

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
  const currentBoardHash = normalize(status['currentBoardHash']);
  const proposedBoardHash = normalize(status['proposedBoardHash']);
  if (!/^0x[0-9a-f]{64}$/.test(entityId) || !/^0x[0-9a-f]{64}$/.test(currentBoardHash)
    || !/^0x[0-9a-f]{64}$/.test(proposedBoardHash) || typeof status['actionNonce'] !== 'bigint'
    || typeof status['currentUnix'] !== 'bigint' || typeof status['activateAt'] !== 'bigint') {
    throw new Error('CONTROL_TAKEOVER_STATUS_INVALID');
  }
  return { targetEntityId: entityId, currentBoardHash, proposedBoardHash, actionNonce: status['actionNonce'], currentUnix: status['currentUnix'], activateAt: status['activateAt'] };
});

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
