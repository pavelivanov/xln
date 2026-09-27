export const WALLET_LOCAL_PAIR_HASH_PARAM = 'xlnPair';
export const WALLET_LOCAL_ONBOARDING_HASH_PARAM = 'xlnOnboarding';
export const WALLET_LOCAL_ENTITY_HASH_PARAM = 'xlnEntity';

export type WalletLocalLauncherStage = 'create' | 'formation' | null;

export type WalletLocalLauncherRequest = Readonly<{
  pairingToken: string;
  stage: WalletLocalLauncherStage;
  entityId: string;
}>;

export type WalletLocalLauncherOnboarding = Readonly<{
  stage: WalletLocalLauncherStage;
  entityId: string;
  runtimeId: string;
}>;

const emptyOnboarding = (): WalletLocalLauncherOnboarding => ({
  stage: null,
  entityId: '',
  runtimeId: '',
});

const paramsFromHash = (hash: string): URLSearchParams => {
  const raw = String(hash || '').replace(/^#\??/u, '');
  return new URLSearchParams(raw);
};

export const readWalletLocalLauncherRequest = (
  hash: string,
): WalletLocalLauncherRequest => {
  const params = paramsFromHash(hash);
  const pairingToken = String(params.get(WALLET_LOCAL_PAIR_HASH_PARAM) || '').trim();
  const rawStage = String(params.get(WALLET_LOCAL_ONBOARDING_HASH_PARAM) || '').trim();
  if (rawStage && rawStage !== 'create' && rawStage !== 'formation') {
    throw new Error(`LOCAL_LAUNCHER_ONBOARDING_STAGE_INVALID:${rawStage}`);
  }
  const entityId = String(params.get(WALLET_LOCAL_ENTITY_HASH_PARAM) || '').trim().toLowerCase();
  if (entityId && !/^0x[0-9a-f]{64}$/u.test(entityId)) {
    throw new Error('LOCAL_LAUNCHER_ENTITY_ID_INVALID');
  }
  if (rawStage === 'formation' && !entityId) {
    throw new Error('LOCAL_LAUNCHER_ENTITY_ID_MISSING');
  }
  if (rawStage !== 'formation' && entityId) {
    throw new Error('LOCAL_LAUNCHER_ENTITY_WITHOUT_FORMATION');
  }
  return {
    pairingToken,
    stage: rawStage === 'create' || rawStage === 'formation' ? rawStage : null,
    entityId,
  };
};

export const stripWalletLocalLauncherHash = (hash: string): string => {
  const params = paramsFromHash(hash);
  params.delete(WALLET_LOCAL_PAIR_HASH_PARAM);
  params.delete(WALLET_LOCAL_ONBOARDING_HASH_PARAM);
  params.delete(WALLET_LOCAL_ENTITY_HASH_PARAM);
  const next = params.toString();
  return next ? `#${next}` : '';
};

let onboarding = emptyOnboarding();
const listeners = new Set<() => void>();

export const getWalletLocalLauncherOnboarding = (): WalletLocalLauncherOnboarding => onboarding;

export const subscribeWalletLocalLauncherOnboarding = (
  listener: () => void,
): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const setWalletLocalLauncherOnboarding = (
  next: WalletLocalLauncherOnboarding,
): void => {
  onboarding = {
    stage: next.stage,
    entityId: String(next.entityId || '').trim().toLowerCase(),
    runtimeId: String(next.runtimeId || '').trim().toLowerCase(),
  };
  for (const listener of listeners) listener();
};

export const clearWalletLocalLauncherOnboarding = (): void => {
  setWalletLocalLauncherOnboarding(emptyOnboarding());
};
