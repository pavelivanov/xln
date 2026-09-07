import {
  DEFAULT_DISPLAY_PREFERENCES,
  DISPLAY_PREFERENCES_STORAGE_KEY,
  readDisplayPreferences,
  writeThemePreference,
  writeTimeMachinePreference,
  writeXlnGuidePreference,
  type DisplayPreferences,
} from './display-preferences';
import { applyThemeCoreToDocument } from './theme-document';
import type { ThemeName } from '../../ui/src/theme-model';

export type DisplayPreferencesSourceSnapshot = Readonly<{
  issue: string | null;
  preferences: DisplayPreferences;
}>;

const listeners = new Set<() => void>();

const readSnapshot = (): DisplayPreferencesSourceSnapshot => {
  try {
    return { issue: null, preferences: readDisplayPreferences(localStorage) };
  } catch (error) {
    console.error('DISPLAY_PREFERENCES_INVALID', error);
    localStorage.removeItem(DISPLAY_PREFERENCES_STORAGE_KEY);
    return {
      issue: 'Stored display preferences were invalid and have been reset.',
      preferences: DEFAULT_DISPLAY_PREFERENCES,
    };
  }
};

let snapshot = readSnapshot();
applyThemeCoreToDocument(snapshot.preferences.theme);

const publish = (next: DisplayPreferencesSourceSnapshot): void => {
  snapshot = next;
  applyThemeCoreToDocument(next.preferences.theme);
  for (const listener of listeners) listener();
};

const writeWithRecovery = (label: string, write: () => void): void => {
  try {
    write();
  } catch (error) {
    console.error(label, error);
    localStorage.removeItem(DISPLAY_PREFERENCES_STORAGE_KEY);
    write();
  }
};

const handleStorage = (event: StorageEvent): void => {
  if (event.key === DISPLAY_PREFERENCES_STORAGE_KEY) publish(readSnapshot());
};

export const displayPreferencesSource = {
  getSnapshot: (): DisplayPreferencesSourceSnapshot => snapshot,
  subscribe(listener: () => void): () => void {
    if (listeners.size === 0) window.addEventListener('storage', handleStorage);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.removeEventListener('storage', handleStorage);
    };
  },
  setTheme(theme: ThemeName): void {
    writeWithRecovery('DISPLAY_THEME_PREFERENCE_WRITE_RECOVERY', () => {
      writeThemePreference(localStorage, theme);
    });
    publish({ issue: null, preferences: { ...snapshot.preferences, theme } });
  },
  setTimeMachineVisibility(showTimeMachine: boolean): void {
    writeWithRecovery('DISPLAY_TIME_MACHINE_PREFERENCE_WRITE_RECOVERY', () => {
      writeTimeMachinePreference(localStorage, showTimeMachine);
    });
    publish({ issue: null, preferences: { ...snapshot.preferences, showTimeMachine } });
  },
  setXlnGuideVisibility(showXlnMascot: boolean): void {
    writeWithRecovery('DISPLAY_XLN_GUIDE_PREFERENCE_WRITE_RECOVERY', () => {
      writeXlnGuidePreference(localStorage, showXlnMascot);
    });
    publish({ issue: null, preferences: { ...snapshot.preferences, showXlnMascot } });
  },
};
