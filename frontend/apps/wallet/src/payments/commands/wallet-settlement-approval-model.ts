import type { RuntimePaymentEntityTx } from '../../../../../packages/runtime-client/src/payments/payment-command-types';

import type {
  WalletSettlementOperation,
  WalletSettlementWorkspace,
} from '../../portfolio/wallet-portfolio-model';
import type { WalletPaymentProjection } from '../wallet-payment-model';

type SettlementApprovalTx = Extract<RuntimePaymentEntityTx, { type: 'settle_approve' }>;

export type WalletSettlementApproval = Readonly<{
  entityId: string;
  entityLabel: string;
  signerId: string;
  counterpartyEntityId: string;
  counterpartyLabel: string;
  workspaceHash: string;
  revision: number;
  status: WalletSettlementWorkspace['status'];
  memo: string;
  proposerEntityId: string;
  proposerLabel: string;
  executorEntityId: string;
  executorLabel: string;
  approverSide: 'left' | 'right';
  operations: readonly WalletSettlementOperation[];
  entityTx: SettlementApprovalTx;
}>;

const entityLabel = (projection: WalletPaymentProjection, entityId: string): string =>
  projection.entities.find((entity) => entity.entityId === entityId)?.label || entityId;

const requireApprovalWorkspace = (
  projection: WalletPaymentProjection,
  counterpartyEntityId: string,
): WalletSettlementWorkspace => {
  const account = projection.accounts.find(({ counterpartyId }) => counterpartyId === counterpartyEntityId);
  if (!account?.settlement) throw new Error('WALLET_SETTLEMENT_APPROVAL_WORKSPACE_MISSING');
  return account.settlement;
};

export const walletSettlementApprovalBlocker = (
  workspace: WalletSettlementWorkspace,
  approverIsLeft: boolean,
): string | null => {
  if (workspace.status !== 'awaiting_counterparty') return 'WALLET_SETTLEMENT_APPROVAL_STATUS_INVALID';
  if (workspace.lastModifiedByLeft === approverIsLeft) return 'WALLET_SETTLEMENT_APPROVAL_OWN_PROPOSAL';
  if (approverIsLeft ? workspace.leftHankoPresent : workspace.rightHankoPresent) {
    return 'WALLET_SETTLEMENT_APPROVAL_ALREADY_SIGNED';
  }
  return null;
};

const participantForSide = (first: string, second: string, left: boolean): string =>
  left === (first < second) ? first : second;

export const buildWalletSettlementApproval = (
  projection: WalletPaymentProjection,
  counterpartyEntityId: string,
): WalletSettlementApproval => {
  const workspace = requireApprovalWorkspace(projection, counterpartyEntityId);
  const approverIsLeft = projection.activeEntityId < counterpartyEntityId;
  const blocker = walletSettlementApprovalBlocker(workspace, approverIsLeft);
  if (blocker) throw new Error(blocker);
  const proposerEntityId = participantForSide(
    projection.activeEntityId, counterpartyEntityId, workspace.lastModifiedByLeft,
  );
  const executorEntityId = participantForSide(
    projection.activeEntityId, counterpartyEntityId, workspace.executorIsLeft,
  );
  return {
    entityId: projection.activeEntityId,
    entityLabel: projection.activeEntityLabel,
    signerId: projection.signerId,
    counterpartyEntityId,
    counterpartyLabel: entityLabel(projection, counterpartyEntityId),
    workspaceHash: workspace.workspaceHash,
    revision: workspace.revision,
    status: workspace.status,
    memo: workspace.memo,
    proposerEntityId,
    proposerLabel: entityLabel(projection, proposerEntityId),
    executorEntityId,
    executorLabel: entityLabel(projection, executorEntityId),
    approverSide: approverIsLeft ? 'left' : 'right',
    operations: workspace.ops,
    entityTx: {
      type: 'settle_approve',
      data: { counterpartyEntityId, workspaceHash: workspace.workspaceHash },
    },
  };
};

export const requireCurrentWalletSettlementApproval = (
  review: WalletSettlementApproval,
  projection: WalletPaymentProjection,
): SettlementApprovalTx => {
  if (projection.activeEntityId !== review.entityId) throw new Error('WALLET_SETTLEMENT_APPROVAL_ENTITY_CHANGED');
  if (projection.signerId !== review.signerId) throw new Error('WALLET_SETTLEMENT_APPROVAL_SIGNER_CHANGED');
  const current = buildWalletSettlementApproval(projection, review.counterpartyEntityId);
  if (current.workspaceHash !== review.workspaceHash || current.revision !== review.revision) {
    throw new Error('WALLET_SETTLEMENT_APPROVAL_STALE');
  }
  return review.entityTx;
};
