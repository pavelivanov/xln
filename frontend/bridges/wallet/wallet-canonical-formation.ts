import { readStoreValue } from '../../src/lib/utils/observableStore';
import { isTronChainId, type RuntimeAdapter, type RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { allRuntimes, vaultOperations, vaultStorageLoaded } from '../../src/lib/stores/vault/vaultStore';
import { getXLN, registerActiveNumberedEntities, submitRuntimeInput, xlnEnvironment } from '../../src/lib/stores/xlnStore';
import { runtimeControllerHandle } from '../../src/lib/stores/runtimeControllerStore';
import { tabOperations } from '../../src/lib/stores/ui/tabStore';
import { createFormationEntity } from '../../src/lib/components/Entity/onboarding/formation/formation-commands';
import { buildFormationRuntimeProjection, buildFormationRuntimeViewProjection } from '../../src/lib/components/Entity/onboarding/formation/formation-runtime-projection';
import type { WalletFormationRequest, WalletFormationResult, WalletFormationView } from '../../packages/browser/src/wallet/wallet-formation';

const normalize = (value: string) => value.trim().toLowerCase();
let vaultLoadStarted = false;
const readOwner = (runtimeId: string) => {
  if (!readStoreValue(vaultStorageLoaded) && !vaultLoadStarted) {
    vaultLoadStarted = true;
    try { vaultOperations.loadFromStorage(); }
    catch (cause) { vaultLoadStarted = false; throw cause; }
  }
  return readStoreValue(allRuntimes).find(runtime => normalize(runtime.id) === normalize(runtimeId)) ?? null;
};

const readLocal = (runtimeId: string) => {
  const vault = readOwner(runtimeId); const frame = readStoreValue(xlnEnvironment);
  if (!vault || !frame || normalize(String(frame.runtimeId || '')) !== normalize(runtimeId)) return null;
  const signer = vault.signers[vault.activeSignerIndex];
  return { vault, signerId: String(signer?.address || ''), projection: buildFormationRuntimeProjection(frame) };
};

const readyView = (runtimeId: string, projection: ReturnType<typeof buildFormationRuntimeProjection>): WalletFormationView => {
  const vault = readOwner(runtimeId);
  if (!vault) return { state: 'unavailable', message: 'Open the wallet that owns this Runtime to create an Entity.' };
  const signerId = String(vault.signers[vault.activeSignerIndex]?.address || '');
  let blockedReason = '';
  try { vaultOperations.assertRuntimeAuthority(runtimeId); }
  catch (cause) { blockedReason = cause instanceof Error ? cause.message : String(cause); }
  return { state: 'ready', runtimeId, signerId, projection, blockedReason };
};

export const readCanonicalWalletFormation = async (adapter: RuntimeAdapter): Promise<WalletFormationView> => {
  if (adapter.mode === 'embedded') {
    const current = readLocal(adapter.runtimeId);
    return current ? readyView(adapter.runtimeId, current.projection)
      : { state: 'unavailable', message: 'Open the wallet that owns this Runtime to create an Entity.' };
  }
  if (!readOwner(adapter.runtimeId)) return { state: 'unavailable', message: 'Open the wallet that owns this Runtime to create an Entity.' };
  const frame = await adapter.read<RuntimeAdapterViewFrame>('view-frame', { accountsLimit: 1, booksLimit: 1 });
  return readyView(adapter.runtimeId, buildFormationRuntimeViewProjection(frame));
};

export const subscribeCanonicalWalletFormation = (adapter: RuntimeAdapter, listener: (view: WalletFormationView) => void, onError: (cause: unknown) => void): (() => void) => {
  let disposed = false; let generation = 0;
  const publish = () => {
    const current = ++generation;
    void readCanonicalWalletFormation(adapter).then(view => {
      if (!disposed && current === generation) listener(view);
    }).catch(cause => { if (!disposed && current === generation) onError(cause); });
  };
  const releases = [allRuntimes.subscribe(publish), adapter.onChange(publish), adapter.onStatus(publish)];
  if (adapter.mode === 'embedded') releases.push(xlnEnvironment.subscribe(publish), runtimeControllerHandle.subscribe(publish));
  publish();
  return () => { disposed = true; generation += 1; releases.forEach(release => release()); };
};

export const createCanonicalWalletFormation = async (adapter: RuntimeAdapter, request: WalletFormationRequest, signal: AbortSignal): Promise<WalletFormationResult> => {
  const requireCurrent = () => {
    signal.throwIfAborted();
    if (normalize(adapter.runtimeId) !== normalize(request.runtimeId)) throw new Error('FORMATION_RUNTIME_CHANGED');
    const current = readOwner(request.runtimeId);
    const signerId = String(current?.signers[current.activeSignerIndex]?.address || '');
    if (!current || normalize(signerId) !== normalize(request.signerId)) throw new Error('FORMATION_RUNTIME_OR_SIGNER_CHANGED');
    vaultOperations.assertRuntimeAuthority(request.runtimeId);
    return { vault: current, signerId };
  };
  requireCurrent();
  const projection = adapter.mode === 'remote'
    ? buildFormationRuntimeViewProjection(await adapter.read<RuntimeAdapterViewFrame>('view-frame', { accountsLimit: 1, booksLimit: 1 }))
    : readLocal(request.runtimeId)?.projection;
  requireCurrent();
  if (!projection) throw new Error('FORMATION_RUNTIME_NOT_READY');
  return createFormationEntity(request.draft, {
    getRuntimeModule: async () => { requireCurrent(); const xln = await getXLN(); requireCurrent(); return xln; },
    readAuthority: () => { const current = requireCurrent(); return {
      runtimeId: current.vault.id, signerId: current.signerId,
      ...(current.vault.seed ? { seed: current.vault.seed } : {}),
    }; },
    readProjection: () => {
      return { ...projection, jurisdictions: request.draft.entityType === 'numbered'
        ? projection.jurisdictions.filter(j => !isTronChainId(Number(j.chainId))) : projection.jurisdictions };
    },
    registerNumberedEntities: async (input, runtimeId) => {
      requireCurrent();
      if (adapter.mode === 'remote') {
        await adapter.ensureOwnerCommandLane();
        if (adapter.commandLaneKind !== 'owner') throw new Error('FORMATION_REMOTE_OWNER_LANE_REQUIRED');
      }
      const result = adapter.mode === 'remote'
        ? await adapter.registerNumberedEntities(input)
        : await registerActiveNumberedEntities(input, runtimeId);
      requireCurrent(); return result;
    },
    submitRuntimeInput: async input => { requireCurrent(); const result = await submitRuntimeInput(input); requireCurrent(); return result; },
    onImported: (entityId, signerId, jurisdiction) => { requireCurrent(); tabOperations.addTab(entityId, signerId, jurisdiction); },
  });
};
