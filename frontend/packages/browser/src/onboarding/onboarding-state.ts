const ONBOARDING_COMPLETE_PREFIX = 'xln-onboarding-complete:';
const ONBOARDING_COMPLETE_EVENT = 'xln:onboarding-complete';

const normalizeEntityId = (entityId: string): string =>
  String(entityId || '').trim().toLowerCase();

export const getOnboardingCompleteKey = (entityId: string): string =>
  `${ONBOARDING_COMPLETE_PREFIX}${normalizeEntityId(entityId)}`;

export const readOnboardingComplete = (entityId: string): boolean => {
  if (typeof localStorage === 'undefined') return false;
  const normalized = normalizeEntityId(entityId);
  if (!normalized) return false;
  return localStorage.getItem(getOnboardingCompleteKey(normalized)) === 'true';
};

export const writeOnboardingComplete = (entityId: string, complete = true): void => {
  if (typeof localStorage === 'undefined') return;
  const normalized = normalizeEntityId(entityId);
  if (!normalized) return;
  const key = getOnboardingCompleteKey(normalized);
  const before = localStorage.getItem(key) === 'true';
  if (before === complete) return;
  if (complete) {
    localStorage.setItem(key, 'true');
  } else {
    localStorage.removeItem(key);
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ONBOARDING_COMPLETE_EVENT));
};

export const writeOnboardingCompleteForEntities = (entityIds: string[], complete = true): void => {
  for (const entityId of entityIds) writeOnboardingComplete(entityId, complete);
};

export const readAnyOnboardingComplete = (entityIds: string[]): boolean =>
  entityIds.some((entityId) => readOnboardingComplete(entityId));

export const subscribeOnboardingCompletion = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(ONBOARDING_COMPLETE_EVENT, listener);
  return () => window.removeEventListener(ONBOARDING_COMPLETE_EVENT, listener);
};
