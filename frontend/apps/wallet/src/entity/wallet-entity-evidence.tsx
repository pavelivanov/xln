import type { WalletAccountContext } from '../../../../bridges/wallet/wallet-canonical-account-context';
import { projectEntityWorkspaceContext } from '../../../../packages/runtime-client/src/entity/entity-workspace-context';
import { projectEntityWorkspaceAccounts } from '../../../../packages/runtime-client/src/entity/entity-workspace-accounts';
import { projectEntityWorkspaceOwnership } from '../../../../packages/runtime-client/src/entity/entity-workspace-ownership';
import { projectEntityWorkspaceConsensusEvidence } from '../../../../packages/runtime-client/src/entity/entity-workspace-consensus-evidence';
import { EntityWorkspaceOwnershipPanel } from '../../../../packages/ui/src/entity/profile/entity-workspace-ownership-panel';
import { EntityWorkspaceConsensusPanel } from '../../../../packages/ui/src/entity/accounts/entity-workspace-consensus-panel';
import '../../../../packages/ui/src/entity/entity-workspace-shell.css';
import type { WalletPaymentSource } from '../payments/wallet-payment-source';
import { WalletOwnershipGovernance } from '../ownership/wallet-ownership-governance';
import { WalletOwnershipShares } from '../ownership/wallet-ownership-shares';

export function WalletEntityEvidence({ context: account, tab, source }: Readonly<{
  context: WalletAccountContext;
  source: WalletPaymentSource;
  tab: 'ownership' | 'consensus';
}>) {
  const { frame, runtimeId } = account;
  const context = projectEntityWorkspaceContext({ frame, runtimeId });
  const ownership = projectEntityWorkspaceOwnership({ context, frame });
  const accounts = projectEntityWorkspaceAccounts({ context, frame });
  const evidence = projectEntityWorkspaceConsensusEvidence({ context, ownership, accounts, frame });
  const depositoryAddress = account.replica.state.config.jurisdiction?.depositoryAddress ?? '';
  return <div className="wallet-entity-evidence" data-testid={`wallet-entity-${tab}`} data-entity-id={account.entityId}>
    <nav className="wallet-tool-tabs" aria-label="Entity controls">
      <a href="/app#ownership" aria-current={tab === 'ownership' ? 'page' : undefined}>Ownership</a>
      <a href="/app#settings/consensus" aria-current={tab === 'consensus' ? 'page' : undefined}>Consensus</a>
    </nav>
    {tab === 'ownership' ? <>
      <EntityWorkspaceOwnershipPanel ownership={ownership} />
      <WalletOwnershipShares
        key={`${runtimeId}:${account.entityId}`}
        source={source}
        entityId={account.entityId}
        signerId={context.signerId ?? ''}
        depositoryAddress={depositoryAddress}
        commandsReady={account.commandsReady}
        commandReason={account.commandReason}
        apiBase={account.apiBase}
      />
      <WalletOwnershipGovernance
        source={source}
        entityId={account.entityId}
        signerId={context.signerId ?? ''}
        commandsReady={account.commandsReady}
        commandReason={account.commandReason}
      />
    </> : <EntityWorkspaceConsensusPanel evidence={evidence} />}
  </div>;
}
