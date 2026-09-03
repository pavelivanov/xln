import { get } from 'svelte/store';

import type {
  WalletRecoveryServiceRole,
  WalletRecoveryServicesMutation,
  WalletRecoveryServicesReadyView,
  WalletRecoveryServicesView,
  WalletRecoverySetupMode,
} from '../packages/browser/src/wallet-recovery-services';
import {
  buildRuntimeRecoveryConfigForMode,
  runtimesState,
  vaultOperations,
  type RecoveryTowerConfig,
  type Runtime,
} from '../src/lib/stores/vault/vaultStore';
import {
  getManualRecoveryTowers,
  inferRecoveryTowerSetupMode,
  isOfficialRecoveryTower,
  normalizeRecoveryDraft,
  normalizeRecoveryUrl,
  resolveOfficialRecoveryTowerUrl,
} from '../src/lib/utils/recovery/recoverySettings';

const normalizeRuntimeId = (runtimeId: string): string => runtimeId.trim().toLowerCase();

const activeRuntime = (): Runtime | null => {
  const state = get(runtimesState);
  const runtimeId = normalizeRuntimeId(String(state.activeRuntimeId || ''));
  return Object.values(state.runtimes)
    .find((runtime) => normalizeRuntimeId(runtime.id) === runtimeId) ?? null;
};

const requireBoundRuntime = (expectedRuntimeId: string): Runtime => {
  const runtime = activeRuntime();
  if (!runtime) throw new Error('RECOVERY_SERVICES_ACTIVE_RUNTIME_REQUIRED');
  const expected = normalizeRuntimeId(expectedRuntimeId);
  const actual = normalizeRuntimeId(runtime.id);
  if (!expected || expected !== actual) {
    throw new Error(`RECOVERY_SERVICES_RUNTIME_CHANGED:${expected}:${actual}`);
  }
  return runtime;
};

const projectRecoveryServices = (runtime: Runtime): WalletRecoveryServicesReadyView => {
  const officialUrl = resolveOfficialRecoveryTowerUrl();
  const services = normalizeRecoveryDraft(runtime.recovery?.towers).map((tower, index) => ({
    id: tower.id || `service-${index + 1}`,
    url: tower.url,
    role: (tower.towerMode === 'delayed_last_resort'
      ? 'delayed_last_resort'
      : 'blind_backup') as WalletRecoveryServiceRole,
    official: isOfficialRecoveryTower(tower, officialUrl),
  }));
  let blockedReason = '';
  try {
    vaultOperations.assertRuntimeAuthority(runtime.id);
  } catch (error: unknown) {
    blockedReason = error instanceof Error ? error.message : String(error);
  }
  return {
    state: 'ready',
    runtimeId: normalizeRuntimeId(runtime.id),
    mode: inferRecoveryTowerSetupMode(runtime.recovery, officialUrl),
    officialAvailable: Boolean(officialUrl),
    services,
    writable: blockedReason === '',
    blockedReason,
  };
};

const validateMode = (mode: WalletRecoverySetupMode): WalletRecoverySetupMode => {
  if (mode !== 'official' && mode !== 'backup_only' && mode !== 'local_only') {
    throw new Error(`RECOVERY_SERVICES_MODE_INVALID:${String(mode)}`);
  }
  return mode;
};

const validateRole = (role: WalletRecoveryServiceRole): WalletRecoveryServiceRole => {
  if (role !== 'blind_backup' && role !== 'delayed_last_resort') {
    throw new Error(`RECOVERY_SERVICE_ROLE_INVALID:${String(role)}`);
  }
  return role;
};

const recoveryConfigForMutation = (
  runtime: Runtime,
  mutation: WalletRecoveryServicesMutation,
) => {
  const officialUrl = resolveOfficialRecoveryTowerUrl();
  const towers: RecoveryTowerConfig[] = mutation.services.map((service, index) => ({
    id: service.id || `manual-${index + 1}`,
    url: normalizeRecoveryUrl(service.url),
    towerMode: validateRole(service.role),
    enabled: true,
  }));
  return buildRuntimeRecoveryConfigForMode(validateMode(mutation.mode), {
    officialTowerUrl: officialUrl,
    manualTowers: getManualRecoveryTowers(towers, officialUrl),
    previous: runtime.recovery || null,
  });
};

export const readCanonicalWalletRecoveryServices = (): WalletRecoveryServicesView => {
  const runtime = activeRuntime();
  return runtime
    ? projectRecoveryServices(runtime)
    : { state: 'unavailable', reason: 'Open a local wallet before configuring recovery services.' };
};

export const previewCanonicalWalletRecoveryServices = (
  mutation: WalletRecoveryServicesMutation,
): WalletRecoveryServicesReadyView => {
  const runtime = requireBoundRuntime(mutation.runtimeId);
  return projectRecoveryServices({
    ...runtime,
    recovery: recoveryConfigForMutation(runtime, mutation),
  });
};

export const saveCanonicalWalletRecoveryServices = async (
  mutation: WalletRecoveryServicesMutation,
): Promise<WalletRecoveryServicesReadyView> => {
  const runtime = requireBoundRuntime(mutation.runtimeId);
  vaultOperations.assertRuntimeAuthority(runtime.id);
  const updated = await vaultOperations.updateRuntimeRecovery(
    runtime.id,
    recoveryConfigForMutation(runtime, mutation),
  );
  return projectRecoveryServices(updated);
};
