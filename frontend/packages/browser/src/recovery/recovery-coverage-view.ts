export type RecoveryCoverageStatus = 'ready' | 'configured' | 'missing';
export type RecoveryTowerStatusKind = 'receipt' | 'failure' | 'pending';

export type RecoveryCoverageItem = {
  id: 'local_state' | 'tower_backup' | 'last_resort' | 'peer_refresh';
  label: string;
  status: RecoveryCoverageStatus;
  statusLabel: string;
  detail: string;
};

export type RecoveryTowerStatusItem = {
  url: string;
  status: RecoveryTowerStatusKind;
  label: string;
  detail: string;
};
