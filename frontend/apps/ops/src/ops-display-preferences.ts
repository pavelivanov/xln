import {
  DEFAULT_DISPLAY_PREFERENCES,
  DISPLAY_PREFERENCES_STORAGE_KEY,
  readDisplayPreferences,
  writeTimeMachinePreference,
  writeThemePreference,
  type DisplayPreferences,
} from '../../../packages/browser/src/display-preferences';
import { applyThemeCoreToDocument } from '../../../packages/browser/src/theme-document';
import type { ThemeName } from '../../../packages/ui/src/theme-model';

export type OpsDisplayPreferencesSnapshot = Readonly<{
  issue: string | null;
  preferences: DisplayPreferences;
}>;

const listeners = new Set<() => void>();

const readSnapshot = (): OpsDisplayPreferencesSnapshot => {
  try {
    return { issue: null, preferences: readDisplayPreferences(localStorage) };
  } catch (error) {
    console.error('OPS_DISPLAY_PREFERENCES_INVALID', error);
    localStorage.removeItem(DISPLAY_PREFERENCES_STORAGE_KEY);
    return {
      issue: 'Stored display preferences were invalid and have been reset.',
      preferences: DEFAULT_DISPLAY_PREFERENCES,
    };
  }
};

let snapshot = readSnapshot();
applyThemeCoreToDocument(snapshot.preferences.theme);

const publish = (next: OpsDisplayPreferencesSnapshot): void => {
  snapshot = next;
  applyThemeCoreToDocument(next.preferences.theme);
  for (const listener of listeners) listener();
};

const handleStorage = (event: StorageEvent): void => {
  if (event.key !== DISPLAY_PREFERENCES_STORAGE_KEY) return;
  publish(readSnapshot());
};

export const opsDisplayPreferencesSource = {
  getSnapshot: (): OpsDisplayPreferencesSnapshot => snapshot,
  subscribe(listener: () => void): () => void {
    if (listeners.size === 0) window.addEventListener('storage', handleStorage);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.removeEventListener('storage', handleStorage);
    };
  },
  setTheme(theme: ThemeName): void {
    const preferences = { ...snapshot.preferences, theme };
    try {
      writeThemePreference(localStorage, theme);
    } catch (error) {
      console.error('OPS_DISPLAY_PREFERENCES_WRITE_RECOVERY', error);
      localStorage.removeItem(DISPLAY_PREFERENCES_STORAGE_KEY);
      writeThemePreference(localStorage, theme);
    }
    publish({ issue: null, preferences });
  },
  setTimeMachineVisibility(showTimeMachine: boolean): void {
    const preferences = { ...snapshot.preferences, showTimeMachine };
    try {
      writeTimeMachinePreference(localStorage, showTimeMachine);
    } catch (error) {
      console.error('OPS_TIME_MACHINE_PREFERENCE_WRITE_RECOVERY', error);
      localStorage.removeItem(DISPLAY_PREFERENCES_STORAGE_KEY);
      writeTimeMachinePreference(localStorage, showTimeMachine);
    }
    publish({ issue: null, preferences });
  },
};
