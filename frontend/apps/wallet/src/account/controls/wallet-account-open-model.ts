import type { DirectAccountOpenContext } from '../../../../../packages/browser/src/wallet/account-open-commands';
import type { HubDiscoveryCommandContext } from '../../../../../packages/browser/src/wallet/hub-discovery-commands';
import type { EntityInputProfile } from '../../../../../packages/ui/src/entity-input-model';
import type { DisputedAccountView } from '../../../../../packages/ui/src/account/account-dispute-view';

export type WalletAccountOpenRead = HubDiscoveryCommandContext & Readonly<{
  direct: DirectAccountOpenContext;
  entities: readonly string[];
  profiles: readonly EntityInputProfile[];
  disputed: readonly DisputedAccountView[];
}>;
