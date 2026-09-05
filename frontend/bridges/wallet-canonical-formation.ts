import { get } from 'svelte/store';
import { isTronChainId } from '@xln/core/api/public/runtime-module';
import { activeRuntime, vaultOperations } from '../src/lib/stores/vault/vaultStore';
import { getXLN, registerActiveNumberedEntities, submitRuntimeInput, xlnEnvironment } from '../src/lib/stores/xlnStore';
import { runtimeControllerHandle } from '../src/lib/stores/runtimeControllerStore';
import { tabOperations } from '../src/lib/stores/ui/tabStore';
import { createFormationEntity } from '../src/lib/components/Entity/onboarding/formation-commands';
import { buildFormationRuntimeProjection } from '../src/lib/components/Entity/onboarding/formation-runtime-projection';
import type { WalletFormationRequest, WalletFormationResult, WalletFormationView } from '../packages/browser/src/wallet-formation';

const normalize = (value: string) => value.trim().toLowerCase();
const readCurrent = (runtimeId: string) => {
  const vault = get(activeRuntime);
  const frame = get(xlnEnvironment);
  if (!vault || normalize(vault.id) !== normalize(runtimeId)) return null;
  if (!frame || normalize(String(frame.runtimeId || '')) !== normalize(runtimeId)) return null;
  const signer = vault.signers[vault.activeSignerIndex];
  return { vault, signerId: String(signer?.address || ''), projection: buildFormationRuntimeProjection(frame) };
};

export const readCanonicalWalletFormation = (runtimeId: string): WalletFormationView => {
  const current = readCurrent(runtimeId);
  if (!current) return { state: 'unavailable', message: 'Open the wallet that owns this Runtime to create an Entity.' };
  let blockedReason = '';
  try { vaultOperations.assertRuntimeAuthority(runtimeId); }
  catch (cause) { blockedReason = cause instanceof Error ? cause.message : String(cause); }
  return { state: 'ready', runtimeId, signerId: current.signerId, projection: current.projection, blockedReason };
};

export const subscribeCanonicalWalletFormation = (runtimeId: string, listener: (view: WalletFormationView) => void, onError: (cause: unknown) => void): (() => void) => {
  const publish = () => { try { listener(readCanonicalWalletFormation(runtimeId)); } catch (cause) { onError(cause); } };
  const releases = [activeRuntime.subscribe(publish), xlnEnvironment.subscribe(publish), runtimeControllerHandle.subscribe(publish)];
  return () => releases.forEach(release => release());
};

export const createCanonicalWalletFormation = async (request: WalletFormationRequest, signal: AbortSignal): Promise<WalletFormationResult> => {
  const requireCurrent = () => {
    signal.throwIfAborted();
    const current = readCurrent(request.runtimeId);
    if (!current || normalize(current.signerId) !== normalize(request.signerId)) throw new Error('FORMATION_RUNTIME_OR_SIGNER_CHANGED');
    vaultOperations.assertRuntimeAuthority(request.runtimeId);
    return current;
  };
  requireCurrent();
  return createFormationEntity(request.draft, {
    getRuntimeModule: async () => { requireCurrent(); const xln = await getXLN(); requireCurrent(); return xln; },
    readAuthority: () => { const current = requireCurrent(); return {
      runtimeId: current.vault.id, signerId: current.signerId,
      ...(current.vault.seed ? { seed: current.vault.seed } : {}),
    }; },
    readProjection: () => {
      const projection = requireCurrent().projection;
      return { ...projection, jurisdictions: request.draft.entityType === 'numbered'
        ? projection.jurisdictions.filter(j => !isTronChainId(Number(j.chainId))) : projection.jurisdictions };
    },
    registerNumberedEntities: async (input, runtimeId) => {
      requireCurrent(); const result = await registerActiveNumberedEntities(input, runtimeId); requireCurrent(); return result;
    },
    submitRuntimeInput: async input => { requireCurrent(); const result = await submitRuntimeInput(input); requireCurrent(); return result; },
    onImported: (entityId, signerId, jurisdiction) => { requireCurrent(); tabOperations.addTab(entityId, signerId, jurisdiction); },
  });
};
