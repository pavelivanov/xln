import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_DISPLAY_PREFERENCES,
  parseDisplayPreferences,
  serializeTimeMachinePreferenceUpdate,
  serializeThemePreferenceUpdate,
  serializeXlnGuidePreferenceUpdate,
} from '../../../frontend/packages/browser/src/display-preferences';
import { buildThemeCoreCssVariables } from '../../../frontend/packages/browser/src/theme-document';
import {
  THEME_NAMES,
  getThemeCoreColors,
  getThemeOptions,
} from '../../../frontend/packages/ui/src/theme-model';

describe('React Entity workspace display preferences', () => {
  test('decodes only the shared display fields with canonical defaults', () => {
    expect(parseDisplayPreferences(null)).toEqual(DEFAULT_DISPLAY_PREFERENCES);
    expect(parseDisplayPreferences(JSON.stringify({
      futureSetting: 'preserved',
      showTimeMachine: true,
      showXlnMascot: true,
      theme: 'arctic',
    }))).toEqual({ showTimeMachine: true, showXlnMascot: true, theme: 'arctic' });
    expect(parseDisplayPreferences(JSON.stringify({
      showTimeMachine: 'yes',
      showXlnMascot: 1,
      theme: 'unknown',
    }))).toEqual(DEFAULT_DISPLAY_PREFERENCES);
    expect(() => parseDisplayPreferences('{broken')).toThrow();
  });

  test('updates the theme without replacing unrelated persisted settings', () => {
    const serialized = serializeThemePreferenceUpdate(
      JSON.stringify({
        futureSetting: 'keep',
        runtimeDelay: 12,
        showTimeMachine: true,
        showXlnMascot: false,
        theme: 'dark',
      }),
      'light',
    );
    expect(JSON.parse(serialized)).toEqual({
      futureSetting: 'keep',
      runtimeDelay: 12,
      showTimeMachine: true,
      showXlnMascot: false,
      theme: 'light',
    });
  });

  test('updates Time Machine visibility without replacing unrelated persisted settings', () => {
    const serialized = serializeTimeMachinePreferenceUpdate(
      JSON.stringify({ futureSetting: 'keep', showTimeMachine: false, theme: 'arctic' }),
      true,
    );
    expect(JSON.parse(serialized)).toEqual({
      futureSetting: 'keep',
      showTimeMachine: true,
      theme: 'arctic',
    });
  });

  test('updates xln guide visibility without replacing unrelated persisted settings', () => {
    const serialized = serializeXlnGuidePreferenceUpdate(
      JSON.stringify({ futureSetting: 'keep', showXlnMascot: false, theme: 'arctic' }),
      true,
    );
    expect(JSON.parse(serialized)).toEqual({
      futureSetting: 'keep',
      showXlnMascot: true,
      theme: 'arctic',
    });
  });

  test('keeps every option and document token on one canonical palette', () => {
    expect(getThemeOptions().map(option => option.value)).toEqual(THEME_NAMES);
    for (const themeName of THEME_NAMES) {
      const theme = getThemeCoreColors(themeName);
      expect(buildThemeCoreCssVariables(themeName)).toEqual({
        '--theme-background': theme.background,
        '--theme-bg-gradient': theme.backgroundGradient,
        '--theme-surface': theme.surface,
        '--theme-surface-hover': theme.surfaceHover,
        '--theme-surface-border': theme.surfaceBorder,
        '--theme-text-primary': theme.textPrimary,
        '--theme-text-secondary': theme.textSecondary,
        '--theme-text-muted': theme.textMuted,
        '--theme-accent': theme.accentColor,
        '--theme-accent-hover': theme.accentHover,
        '--theme-border': theme.borderColor,
      });
    }
  });

  test('keeps React effects at the ops browser boundary', async () => {
    const [page, source, panel] = await Promise.all([
      Bun.file('frontend/apps/ops/src/ops-entity-workspace.tsx').text(),
      Bun.file('frontend/apps/ops/src/ops-display-preferences.ts').text(),
      Bun.file('frontend/packages/ui/src/entity-workspace-display-panel.tsx').text(),
    ]);
    expect(page).toContain('useSyncExternalStore');
    expect(source).toContain('writeThemePreference(localStorage, theme)');
    expect(source).toContain("window.addEventListener('storage', handleStorage)");
    expect(source).toContain('writeTimeMachinePreference(localStorage, showTimeMachine)');
    expect(source).toContain('writeXlnGuidePreference(localStorage, showXlnMascot)');
    expect(panel).toContain('onToggleXlnGuide(event.currentTarget.checked)');
    expect(panel).toContain('field-scoped writes');
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toContain('frontend/src');
  });
});
