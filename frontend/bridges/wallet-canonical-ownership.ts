import { isNumberedEntity, toEntityId, type RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { fetchExternalTokenCatalog, buildOnchainReserves } from '../src/lib/components/Entity/external-wallet-reader';
import { projectEntityShareTokens } from '../src/lib/components/Entity/ownership/ownership-flow';
import type { ExternalToken } from '../src/lib/components/Entity/assets/entity-asset-catalog';

type OwnershipFrame = Pick<RuntimeAdapterViewFrame, 'height' | 'activeEntityId'> & {
  activeEntity: { core: Pick<NonNullable<RuntimeAdapterViewFrame['activeEntity']>['core'], 'entityId' | 'reserves' | 'entityProviderActionState'> & { config: { jurisdiction?: { entityProviderAddress: string } } } } | null;
};

export function projectWalletOwnership(frame: OwnershipFrame, entityId: string, tokens: ExternalToken[]) {
  const active = frame.activeEntity;
  if (!active || frame.activeEntityId !== entityId || active.core.entityId !== entityId) {
    throw new Error('OWNERSHIP_ENTITY_CHANGED');
  }
  const numbered = isNumberedEntity(toEntityId(entityId));
  const provider = active.core.config.jurisdiction?.entityProviderAddress.toLowerCase();
  if (numbered && !provider) throw new Error('OWNERSHIP_ENTITY_PROVIDER_REQUIRED');
  const shareCatalog = tokens.filter(token => token.address.toLowerCase() === provider);
  const action = active.core.entityProviderActionState;
  const pending = action?.pending;
  return {
    entityId,
    height: frame.height,
    numbered,
    shares: numbered ? projectEntityShareTokens(toEntityId(entityId), shareCatalog, buildOnchainReserves(active.core.reserves, shareCatalog)) : [],
    confirmedNonce: action?.confirmedNonce ?? null,
    pendingRelease: pending?.payload.kind === 'releaseControlShares'
      ? { hash: pending.actionHash, nonce: pending.actionNonce } : null,
    releaseBlocked: Boolean(pending && pending.payload.kind !== 'releaseControlShares'),
  };
}

export async function readCanonicalWalletOwnership(frame: RuntimeAdapterViewFrame, entityId: string, apiBase: string) {
  const tokens = isNumberedEntity(toEntityId(entityId)) ? await fetchExternalTokenCatalog(apiBase) : [];
  return projectWalletOwnership(frame, entityId, tokens);
}

export type WalletOwnership = ReturnType<typeof projectWalletOwnership>;
