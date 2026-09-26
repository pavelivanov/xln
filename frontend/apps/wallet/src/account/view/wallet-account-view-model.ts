import type { AccountReadView, EntityReadView } from '../../../../../packages/runtime-client/src/entity/entity-panel-types';
import type { AccountActivityRow } from '../../../../../packages/ui/src/account/account-focused-view';
import type { AccountActivityPresentationInput } from '../../../../../packages/ui/src/account/activity/account-activity-presentation';
import type { AccountTokenDetailRow } from '../../../../../packages/ui/src/account/account-token-details';
import type { DisputedAccountView } from '../../../../../packages/ui/src/account/account-dispute-view';

export type WalletAccountView = Readonly<{
  account: AccountReadView | null;
  replica: EntityReadView;
  entityId: string;
  counterpartyId: string;
  counterpartyName: string;
  entityNames: ReadonlyMap<string, string>;
  tokens: readonly AccountTokenDetailRow[];
  activity: readonly AccountActivityRow[];
  disputed: readonly DisputedAccountView[];
  presentation: AccountActivityPresentationInput;
  formatTokenAmount: (tokenId: number, value: bigint) => string;
  apiBase: string;
  faucetRuntimeId: string;
  commandsReady: boolean;
  sameJurisdiction: boolean;
  relayStatus: 'connected' | 'reconnecting' | 'disconnected';
}>;
