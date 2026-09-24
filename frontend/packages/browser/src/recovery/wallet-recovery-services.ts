import type { RecoveryCoverageItem, RecoveryTowerStatusItem } from './recovery-coverage-view';

export type WalletRecoverySetupMode = 'official' | 'backup_only' | 'local_only';

export type WalletRecoveryServiceRole = 'blind_backup' | 'delayed_last_resort';

export type WalletRecoveryServiceView = Readonly<{
  id: string;
  url: string;
  role: WalletRecoveryServiceRole;
  official: boolean;
}>;

export type WalletRecoveryServicesReadyView = Readonly<{
  state: 'ready';
  runtimeId: string;
  mode: WalletRecoverySetupMode;
  officialAvailable: boolean;
  services: readonly WalletRecoveryServiceView[];
  writable: boolean;
  blockedReason: string;
  coverage: readonly RecoveryCoverageItem[];
  towerStatuses: readonly RecoveryTowerStatusItem[];
  discoveryFailures: readonly string[];
}>;

export type WalletRecoveryServicesView = WalletRecoveryServicesReadyView | Readonly<{
  state: 'unavailable';
  reason: string;
}>;

export type WalletRecoveryServicesMutation = Readonly<{
  runtimeId: string;
  mode: WalletRecoverySetupMode;
  services: readonly WalletRecoveryServiceView[];
}>;

// Keep the current validated draft while refreshing only its observed evidence.
// A stale subscription must not replace a newer mode/service selection.
export const mergeWalletRecoveryServicesObservation = (
  current: WalletRecoveryServicesView | null,
  observed: WalletRecoveryServicesView,
  mutation: WalletRecoveryServicesMutation | null,
): WalletRecoveryServicesView => {
  if (current?.state === 'ready' && mutation && current.runtimeId !== mutation.runtimeId) return current;
  if (current?.state !== 'ready' || observed.state !== 'ready' || current.runtimeId !== observed.runtimeId)
    return observed;
  if (
    !mutation ||
    current.runtimeId !== mutation.runtimeId ||
    current.mode !== mutation.mode ||
    current.services !== mutation.services
  )
    return current;
  return {
    ...current,
    coverage: observed.coverage,
    towerStatuses: observed.towerStatuses,
    discoveryFailures: observed.discoveryFailures,
    writable: observed.writable,
    blockedReason: observed.blockedReason,
  };
};
