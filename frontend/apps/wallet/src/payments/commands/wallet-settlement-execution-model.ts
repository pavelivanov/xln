import type { RuntimePaymentEntityTx } from '../../../../../packages/runtime-client/src/payments/payment-command-types';

import type {
  WalletSettlementOperation,
  WalletSettlementWorkspace,
} from '../../portfolio/wallet-portfolio-model';
import type { WalletPaymentProjection } from '../wallet-payment-model';

type SettlementExecutionTx = Extract<RuntimePaymentEntityTx, { type: 'settle_execute' }>;

export type WalletSettlementExecution = Readonly<{
  executionKey: string;
  entityId: string;
  signerId: string;
  counterpartyEntityId: string;
  workspaceHash: string;
  revision: number;
  memo: string;
  executorSide: 'left' | 'right';
  operations: readonly WalletSettlementOperation[];
  entityTx: SettlementExecutionTx;
}>;

export const walletSettlementExecutionBlocker = (
  workspace: WalletSettlementWorkspace,
  executorIsLeft: boolean,
): string | null => {
  if (workspace.status !== 'ready_to_submit') return 'WALLET_SETTLEMENT_EXECUTION_STATUS_INVALID';
  if (workspace.executorIsLeft !== executorIsLeft) return 'WALLET_SETTLEMENT_EXECUTION_WRONG_ENTITY';
  return null;
};

export const buildWalletSettlementExecution = (
  projection: WalletPaymentProjection,
  counterpartyEntityId: string,
): WalletSettlementExecution => {
  const account = projection.accounts.find(({ counterpartyId }) => counterpartyId === counterpartyEntityId);
  if (!account?.settlement) throw new Error('WALLET_SETTLEMENT_EXECUTION_WORKSPACE_MISSING');
  const executorIsLeft = projection.activeEntityId < counterpartyEntityId;
  const blocker = walletSettlementExecutionBlocker(account.settlement, executorIsLeft);
  if (blocker) throw new Error(blocker);
  const { workspaceHash, revision, memo, ops } = account.settlement;
  return {
    executionKey: `${projection.activeEntityId}:${counterpartyEntityId}:${revision}:${workspaceHash}`,
    entityId: projection.activeEntityId,
    signerId: projection.signerId,
    counterpartyEntityId,
    workspaceHash,
    revision,
    memo,
    executorSide: executorIsLeft ? 'left' : 'right',
    operations: ops,
    entityTx: { type: 'settle_execute', data: { counterpartyEntityId } },
  };
};

export const selectWalletSettlementExecution = (
  projection: WalletPaymentProjection,
): WalletSettlementExecution | null => {
  if (projection.batch.sentHash) return null;
  const account = projection.accounts.find(({ counterpartyId, settlement }) => settlement
    && walletSettlementExecutionBlocker(
      settlement,
      projection.activeEntityId < counterpartyId,
    ) === null);
  return account ? buildWalletSettlementExecution(projection, account.counterpartyId) : null;
};

export const requireCurrentWalletSettlementExecution = (
  expectedKey: string,
  counterpartyEntityId: string,
  projection: WalletPaymentProjection,
): SettlementExecutionTx => {
  const current = buildWalletSettlementExecution(projection, counterpartyEntityId);
  if (current.executionKey !== expectedKey) throw new Error('WALLET_SETTLEMENT_EXECUTION_STALE');
  return current.entityTx;
};
