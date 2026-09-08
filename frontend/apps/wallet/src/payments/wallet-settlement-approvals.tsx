import { useEffect, useState } from 'react';

import type { WalletSettlementOperation } from '../portfolio/wallet-portfolio-model';
import type { WalletPaymentProjection } from './wallet-payment-model';
import type { WalletPaymentSource, WalletPaymentSourceSnapshot } from './wallet-payment-source';
import {
  walletSettlementApprovalBlocker,
  type WalletSettlementApproval,
} from './commands/wallet-settlement-approval-model';
import {
  selectWalletSettlementExecution,
  walletSettlementExecutionBlocker,
} from './commands/wallet-settlement-execution-model';

const operationLabel = (operation: WalletSettlementOperation): string => {
  const token = `token ${operation.tokenId}`;
  if (operation.type === 'forgive') return `Forgive · ${token}`;
  if (operation.type === 'rawDiff') {
    return `Raw diff · ${token} · left ${operation.leftDiff} · right ${operation.rightDiff} · collateral ${operation.collateralDiff} · ondelta ${operation.ondeltaDiff}`;
  }
  return `${operation.type} · ${token} · ${operation.amount} raw`;
};

export function WalletSettlementApprovals({
  projection,
  snapshot,
  source,
}: Readonly<{
  projection: WalletPaymentProjection;
  snapshot: WalletPaymentSourceSnapshot;
  source: WalletPaymentSource;
}>) {
  const [review, setReview] = useState<WalletSettlementApproval | null>(null);
  const [error, setError] = useState('');
  const proposals = projection.accounts.filter((account) => account.settlement);
  const currentReview = review && proposals.some((account) =>
    account.counterpartyId === review.counterpartyEntityId
    && account.settlement?.workspaceHash === review.workspaceHash
    && account.settlement.revision === review.revision) ? review : null;
  const busy = snapshot.status !== 'ready'
    || snapshot.command.status === 'submitting'
    || snapshot.command.status === 'pending';
  const execution = selectWalletSettlementExecution(projection);
  const executionKey = execution?.executionKey || '';
  const executionCounterparty = execution?.counterpartyEntityId || '';

  useEffect(() => {
    if (busy || !executionKey || !executionCounterparty) return;
    let active = true;
    void source.executeReadySettlement(executionCounterparty, executionKey).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : String(failure));
    });
    return () => { active = false; };
  }, [busy, executionCounterparty, executionKey, source]);

  if (proposals.length === 0) return null;

  const prepare = (counterpartyEntityId: string): void => {
    setError('');
    try {
      setReview(source.reviewSettlementApproval(counterpartyEntityId));
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const approve = async (): Promise<void> => {
    if (!currentReview) return;
    setError('');
    try {
      await source.submitReviewedSettlementApproval(currentReview);
      setReview(null);
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return <section className="wallet-settlement-approvals" aria-labelledby="wallet-settlement-approvals-title">
    <div className="wallet-payments-section-heading">
      <div><p>04</p><h2 id="wallet-settlement-approvals-title">Settlement proposals</h2></div>
      <span>Committed Account workspaces</span>
    </div>
    {proposals.map((account) => {
      const workspace = account.settlement!;
      const approverIsLeft = projection.activeEntityId < account.counterpartyId;
      const blocker = walletSettlementApprovalBlocker(workspace, approverIsLeft);
      const executionBlocker = walletSettlementExecutionBlocker(workspace, approverIsLeft);
      const actionLabel = workspace.status === 'ready_to_submit'
        ? executionBlocker === null ? 'Preparing jurisdiction batch' : 'Awaiting designated executor'
        : workspace.status === 'submitted' ? 'Submitted to jurisdiction batch'
          : blocker === 'WALLET_SETTLEMENT_APPROVAL_OWN_PROPOSAL' ? 'Awaiting peer approval'
            : blocker === null ? 'Review peer approval' : 'Approval unavailable';
      return <article className="wallet-settlement-proposal" key={account.counterpartyId}>
        <header><div><strong>{account.counterpartyLabel}</strong><code>{account.counterpartyId}</code></div>
          <span>{workspace.status.replaceAll('_', ' ')}</span></header>
        <div><span>Revision {workspace.revision}</span><code>{workspace.workspaceHash}</code></div>
        <ul>{workspace.ops.map((operation, index) => <li key={`${operation.type}-${operation.tokenId}-${index}`}>{operationLabel(operation)}</li>)}</ul>
        {workspace.memo ? <p>Memo · <code>{workspace.memo}</code></p> : null}
        <button disabled={busy || blocker !== null} onClick={() => prepare(account.counterpartyId)} type="button">
          {actionLabel}
        </button>
      </article>;
    })}
    {error ? <p className="wallet-payment-error" role="alert">{error}</p> : null}
    {currentReview ? <section className="wallet-settlement-approval-review" aria-labelledby="wallet-settlement-approval-review-title">
      <header><div><p>Peer signature review</p><h3 id="wallet-settlement-approval-review-title">Approve revision {currentReview.revision}</h3></div><span>Not signed</span></header>
      <dl>
        <div><dt>Approving Entity</dt><dd>{currentReview.entityLabel}<code>{currentReview.entityId}</code></dd></div>
        <div><dt>Proposal author</dt><dd>{currentReview.proposerLabel}<code>{currentReview.proposerEntityId}</code></dd></div>
        <div><dt>Account peer</dt><dd>{currentReview.counterpartyLabel}<code>{currentReview.counterpartyEntityId}</code></dd></div>
        <div><dt>Executor</dt><dd>{currentReview.executorLabel}<code>{currentReview.executorEntityId}</code></dd></div>
        <div><dt>Workspace</dt><dd>Revision {currentReview.revision}<code>{currentReview.workspaceHash}</code></dd></div>
        <div><dt>Authority</dt><dd>{currentReview.approverSide} side<code>{currentReview.signerId}</code></dd></div>
      </dl>
      <ul>{currentReview.operations.map((operation, index) => <li key={`${operation.type}-${operation.tokenId}-${index}`}>{operationLabel(operation)}</li>)}</ul>
      {currentReview.memo ? <p>Memo · <code>{currentReview.memo}</code></p> : null}
      <p>Approval signs this exact workspace. A changed Entity, signer, revision, or hash requires a new review.</p>
      <div className="wallet-payment-actions">
        <button disabled={busy} onClick={() => setReview(null)} type="button">Cancel approval review</button>
        <button className="is-primary" disabled={busy} onClick={() => void approve()} type="button">Approve exact proposal</button>
      </div>
    </section> : null}
  </section>;
}
