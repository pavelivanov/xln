import type { AccountReplica } from '@xln/core/api/public/runtime-module';
import type { EntityReplica } from '../../../src/lib/types/ui';
import type { AccountActivityRow } from '../../../src/lib/components/Entity/account/account-focused-view';
import type { AccountActivityPresentationInput } from '../../../src/lib/components/Entity/account/account-activity-presentation';
import type { AccountTokenDetailRow } from '../../../src/lib/components/Entity/shared/account-token-details';
import type { DisputedAccountView } from '../../../src/lib/components/Entity/account/account-dispute-view';

export type WalletAccountView = Readonly<{
  account: AccountReplica | null;
  replica: EntityReplica;
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
