export const THEME_NAMES = [
  'dark',
  'editor',
  'light',
  'merchant',
  'gold-luxe',
  'matrix',
  'arctic',
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export type ThemeCoreColors = Readonly<{
  name: string;
  background: string;
  backgroundGradient: string;
  surface: string;
  surfaceHover: string;
  surfaceBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentColor: string;
  accentHover: string;
  borderColor: string;
}>;

export const THEME_CORE_COLORS = {
  dark: {
    name: 'Dark',
    background: '#09090b',
    backgroundGradient: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #0c0c0e 100%)',
    surface: '#18181b',
    surfaceHover: '#1c1c20',
    surfaceBorder: '#27272a',
    textPrimary: '#e4e4e7',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    accentColor: '#fbbf24',
    accentHover: '#f59e0b',
    borderColor: '#27272a',
  },
  editor: {
    name: 'Editor',
    background: '#1e1e2e',
    backgroundGradient: 'linear-gradient(180deg, #1e1e2e 0%, #181825 100%)',
    surface: '#252536',
    surfaceHover: '#2a2a3c',
    surfaceBorder: '#313145',
    textPrimary: '#cdd6f4',
    textSecondary: '#a6adc8',
    textMuted: '#6c7086',
    accentColor: '#89b4fa',
    accentHover: '#b4d0fb',
    borderColor: '#313145',
  },
  light: {
    name: 'Light',
    background: '#edf2f7',
    backgroundGradient: 'linear-gradient(180deg, #f8fbff 0%, #edf2f7 56%, #e7edf5 100%)',
    surface: '#fbfdff',
    surfaceHover: '#f4f8fc',
    surfaceBorder: '#dbe4ee',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    accentColor: '#2563eb',
    accentHover: '#1d4ed8',
    borderColor: '#dbe4ee',
  },
  merchant: {
    name: 'Merchant',
    background: '#f2ede5',
    backgroundGradient: 'linear-gradient(180deg, #fbf8f3 0%, #f2ede5 58%, #ece3d6 100%)',
    surface: '#fffdfa',
    surfaceHover: '#f8f3ec',
    surfaceBorder: '#ddd5ca',
    textPrimary: '#1c1917',
    textSecondary: '#57534e',
    textMuted: '#a8a29e',
    accentColor: '#0c4a6e',
    accentHover: '#0369a1',
    borderColor: '#ddd5ca',
  },
  'gold-luxe': {
    name: 'Gold Luxe',
    background: '#1a1410',
    backgroundGradient: 'linear-gradient(135deg, #1a1410 0%, #2a2218 50%, #1f1814 100%)',
    surface: '#2a2218',
    surfaceHover: '#342c20',
    surfaceBorder: 'rgba(255, 215, 0, 0.12)',
    textPrimary: '#f5e6d3',
    textSecondary: '#b8a992',
    textMuted: '#8a7a66',
    accentColor: '#ffd700',
    accentHover: '#ffe44d',
    borderColor: 'rgba(255, 215, 0, 0.12)',
  },
  matrix: {
    name: 'Matrix',
    background: '#000000',
    backgroundGradient: 'linear-gradient(135deg, #000000 0%, #001a00 50%, #000000 100%)',
    surface: '#0a1a0a',
    surfaceHover: '#0f240f',
    surfaceBorder: 'rgba(0, 255, 65, 0.12)',
    textPrimary: '#00ff41',
    textSecondary: '#008f11',
    textMuted: '#005500',
    accentColor: '#00ff00',
    accentHover: '#33ff33',
    borderColor: 'rgba(0, 255, 65, 0.12)',
  },
  arctic: {
    name: 'Arctic',
    background: '#0d1117',
    backgroundGradient: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
    surface: '#161b22',
    surfaceHover: '#1c2129',
    surfaceBorder: '#30363d',
    textPrimary: '#c9d1d9',
    textSecondary: '#8b949e',
    textMuted: '#484f58',
    accentColor: '#58a6ff',
    accentHover: '#79c0ff',
    borderColor: '#30363d',
  },
} as const satisfies Readonly<Record<ThemeName, ThemeCoreColors>>;

export const isThemeName = (value: unknown): value is ThemeName =>
  typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value);

export const getThemeCoreColors = (theme: ThemeName): ThemeCoreColors =>
  THEME_CORE_COLORS[theme];

export const getThemeOptions = (): readonly Readonly<{ value: ThemeName; label: string }>[] =>
  THEME_NAMES.map(value => ({ value, label: THEME_CORE_COLORS[value].name }));
