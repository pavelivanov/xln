export type WalletPushWakePlatform = 'ios' | 'android' | 'web' | 'desktop';

export type WalletPushWakeServiceView = Readonly<{
  url: string;
  role: 'blind_backup' | 'delayed_last_resort';
  registered: boolean;
  platform: WalletPushWakePlatform | null;
  updatedAt: number | null;
}>;

export type WalletPushWakeReadyView = Readonly<{
  state: 'ready';
  runtimeId: string;
  entityId: string;
  registeredCount: number;
  services: readonly WalletPushWakeServiceView[];
  writable: boolean;
  blockedReason: string;
}>;

export type WalletPushWakeView = WalletPushWakeReadyView | Readonly<{
  state: 'unavailable';
  reason: string;
}>;

export type WalletPushWakeOperation = Readonly<{
  view: WalletPushWakeReadyView;
  accepted: number;
  attempted: number;
  errors: readonly string[];
}>;
