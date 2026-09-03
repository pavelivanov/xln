import {
  getThemeCoreColors,
  type ThemeName,
} from '../../ui/src/theme-model';

export const buildThemeCoreCssVariables = (
  themeName: ThemeName,
): Readonly<Record<string, string>> => {
  const theme = getThemeCoreColors(themeName);
  return {
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
  };
};

export function applyThemeCoreToDocument(
  themeName: ThemeName,
  target: Document | null = typeof document === 'undefined' ? null : document,
): void {
  if (!target) return;
  const theme = getThemeCoreColors(themeName);
  const root = target.documentElement;
  for (const [property, value] of Object.entries(buildThemeCoreCssVariables(themeName))) {
    root.style.setProperty(property, value);
  }
  root.setAttribute('data-theme', themeName);
  target.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.background);
  target.body?.style.setProperty('background', theme.backgroundGradient);
  target.body?.style.setProperty('color', theme.textPrimary);
}
