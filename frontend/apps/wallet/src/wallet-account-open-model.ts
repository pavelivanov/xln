import type { DirectAccountOpenContext } from '../../../src/lib/components/Entity/account/account-open-commands';
import type { HubDiscoveryCommandContext } from '../../../src/lib/components/Entity/onboarding/hub-discovery-commands';
import type { EntityInputProfile } from '../../../src/lib/components/shared/entity-input-model';
import type { DisputedAccountView } from '../../../src/lib/components/Entity/account/account-dispute-view';

export type WalletAccountOpenRead = HubDiscoveryCommandContext & Readonly<{
  direct: DirectAccountOpenContext;
  entities: readonly string[];
  profiles: readonly EntityInputProfile[];
  disputed: readonly DisputedAccountView[];
}>;
