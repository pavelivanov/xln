import { useEffect, useSyncExternalStore } from 'react';
import { settings, settingsOperations } from '../../../src/lib/stores/settingsStore';

// Consume the retained framework-neutral store and its existing persistence.
// Reload before writes so another mounted preferences consumer's keys survive.
export const accountAppearanceOperations = {
  layout(value: 'center' | 'sides') { settingsOperations.loadFromStorage(); settingsOperations.setBarLayout(value); },
  skin(value: 'classic' | 'apple') { settingsOperations.loadFromStorage(); settingsOperations.setAccountSkin(value); },
  style(value: 'hairline' | 'pips' | 'twin' | 'capsule' | 'thread') { settingsOperations.loadFromStorage(); settingsOperations.setAccountBarStyle(value); },
  scale(value: number) { settingsOperations.loadFromStorage(); settingsOperations.setAccountBarUsdPer100Px(value); },
  effect(key: 'barCreditGradient' | 'barAnimTransition' | 'barAnimSweep' | 'barAnimGlow' | 'barAnimDeltaFlash' | 'barAnimRipple', value: boolean) {
    settingsOperations.loadFromStorage(); settingsOperations.update({ [key]: value });
  },
};

export function useAccountAppearance() {
  const value = useSyncExternalStore(settings.subscribe, settings.get, settings.get);
  useEffect(() => { settingsOperations.loadFromStorage(); }, []);
  return value;
}
