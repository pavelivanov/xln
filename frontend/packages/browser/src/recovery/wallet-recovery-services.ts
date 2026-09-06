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
