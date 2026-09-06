import type { WalletAccountContext } from '../../../bridges/wallet-canonical-account-context';
import { projectEntityWorkspaceContext } from '../../../packages/runtime-client/src/entity-workspace-context';
import { projectEntityWorkspaceAccounts } from '../../../packages/runtime-client/src/entity-workspace-accounts';
import { projectEntityWorkspaceOwnership } from '../../../packages/runtime-client/src/entity-workspace-ownership';
import { projectEntityWorkspaceConsensusEvidence } from '../../../packages/runtime-client/src/entity-workspace-consensus-evidence';
import { EntityWorkspaceOwnershipPanel } from '../../../packages/ui/src/entity-workspace-ownership-panel';
import { EntityWorkspaceConsensusPanel } from '../../../packages/ui/src/entity-workspace-consensus-panel';
import '../../../packages/ui/src/entity-workspace-shell.css';
import type { WalletPaymentSource } from './wallet-payment-source';
import { WalletOwnershipShares } from './wallet-ownership-shares';

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
  return <div className="wallet-entity-evidence" data-testid={`wallet-entity-${tab}`} data-entity-id={account.entityId}>
    <nav className="wallet-tool-tabs" aria-label="Entity controls">
      <a href="/app#ownership" aria-current={tab === 'ownership' ? 'page' : undefined}>Ownership</a>
      <a href="/app#settings/consensus" aria-current={tab === 'consensus' ? 'page' : undefined}>Consensus</a>
    </nav>
    {tab === 'ownership' ? <>
      <EntityWorkspaceOwnershipPanel ownership={ownership} />
      <WalletOwnershipShares key={`${runtimeId}:${account.entityId}`} source={source} entityId={account.entityId} apiBase={account.apiBase} />
    </> : <EntityWorkspaceConsensusPanel evidence={evidence} />}
  </div>;
}
