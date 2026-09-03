import { isThemeName, type ThemeName } from '../../ui/src/theme-model';

export const DISPLAY_PREFERENCES_STORAGE_KEY = 'xln-settings';

export type DisplayPreferences = Readonly<{
  showTimeMachine: boolean;
  showXlnMascot: boolean;
  theme: ThemeName;
}>;

export type DisplayPreferencesStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  showTimeMachine: false,
  showXlnMascot: false,
  theme: 'dark',
};

const parseSettingsRecord = (raw: string | null): Record<string, unknown> => {
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('DISPLAY_PREFERENCES_STORAGE_INVALID');
  }
  return { ...parsed } as Record<string, unknown>;
};

export const parseDisplayPreferences = (raw: string | null): DisplayPreferences => {
  const record = parseSettingsRecord(raw);
  return {
    theme: isThemeName(record['theme']) ? record['theme'] : DEFAULT_DISPLAY_PREFERENCES.theme,
    showTimeMachine: typeof record['showTimeMachine'] === 'boolean'
      ? record['showTimeMachine']
      : DEFAULT_DISPLAY_PREFERENCES.showTimeMachine,
    showXlnMascot: typeof record['showXlnMascot'] === 'boolean'
      ? record['showXlnMascot']
      : DEFAULT_DISPLAY_PREFERENCES.showXlnMascot,
  };
};

export const readDisplayPreferences = (
  storage: DisplayPreferencesStorage,
): DisplayPreferences => parseDisplayPreferences(storage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY));

export const serializeThemePreferenceUpdate = (
  raw: string | null,
  theme: ThemeName,
): string => JSON.stringify({ ...parseSettingsRecord(raw), theme });

export const serializeTimeMachinePreferenceUpdate = (
  raw: string | null,
  showTimeMachine: boolean,
): string => JSON.stringify({ ...parseSettingsRecord(raw), showTimeMachine });

export const serializeXlnGuidePreferenceUpdate = (
  raw: string | null,
  showXlnMascot: boolean,
): string => JSON.stringify({ ...parseSettingsRecord(raw), showXlnMascot });

export function writeThemePreference(
  storage: DisplayPreferencesStorage,
  theme: ThemeName,
): void {
  storage.setItem(
    DISPLAY_PREFERENCES_STORAGE_KEY,
    serializeThemePreferenceUpdate(storage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY), theme),
  );
}

export function writeTimeMachinePreference(
  storage: DisplayPreferencesStorage,
  showTimeMachine: boolean,
): void {
  storage.setItem(
    DISPLAY_PREFERENCES_STORAGE_KEY,
    serializeTimeMachinePreferenceUpdate(
      storage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY),
      showTimeMachine,
    ),
  );
}

export function writeXlnGuidePreference(
  storage: DisplayPreferencesStorage,
  showXlnMascot: boolean,
): void {
  storage.setItem(
    DISPLAY_PREFERENCES_STORAGE_KEY,
    serializeXlnGuidePreferenceUpdate(
      storage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY),
      showXlnMascot,
    ),
  );
}
