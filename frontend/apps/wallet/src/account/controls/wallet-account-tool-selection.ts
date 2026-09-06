import type { MoveEndpoint } from '../../../../../src/lib/components/Entity/move-routes';
import type { ConfigureWorkspaceTab } from '../../../../../packages/runtime-client/src/entity/entity-workspace-navigation';

export type WalletAccountToolSelection = Readonly<{
  manage: Readonly<{ tokenId: number; tab: ConfigureWorkspaceTab }>;
  lending: Readonly<{ tokenId: number; hub: string }>;
  move: Readonly<{ initialized: boolean; from: MoveEndpoint; to: MoveEndpoint; tokenId: number; sourceAccount: string; target: string; hub: string; manualHub: boolean; recipient: string; eoa: string }>;
}>;

export const emptyWalletAccountToolSelection = (): WalletAccountToolSelection => ({
  manage: { tokenId: 1, tab: 'extend-credit' }, lending: { tokenId: 1, hub: '' },
  move: { initialized: false, from: 'account', to: 'account', tokenId: 1, sourceAccount: '', target: '', hub: '', manualHub: false, recipient: '', eoa: '' },
});
