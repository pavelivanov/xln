import type { XlnMascotDockPlacement } from './mascot-geometry';
import type { ThemeName } from './theme-model';

export type { ThemeName } from './theme-model';
export type BarColorMode = 'rgy' | 'theme' | 'token';
export type BarLayoutMode = 'center' | 'sides';
export type AccountDeltaViewMode = 'per-token' | 'aggregated';
export type UIDensityMode = 'compact' | 'comfortable' | 'roomy';
export type UIRadiusMode = 'sharp' | 'soft' | 'pill';
export type UIBorderMode = 'minimal' | 'subtle' | 'strong';
export type UIShadowMode = 'flat' | 'soft' | 'float';
export type UITabStyle = 'minimal' | 'underline' | 'rail' | 'pill' | 'segmented' | 'floating';
export type UIButtonStyle = 'minimal' | 'soft' | 'solid';
export type UICardStyle = 'flat' | 'filled' | 'striped';
export type UIInputStyle = 'minimal' | 'outlined' | 'filled';
export type UIAccentIntensity = 'quiet' | 'normal' | 'bold';
export type UITypographyScale = 'sm' | 'md' | 'lg';
export type AccountSkin = 'classic' | 'apple';
export type AccountBarStyle = 'hairline' | 'pips' | 'twin' | 'capsule' | 'thread';

export interface UIStyleSettings {
  density: UIDensityMode;
  radius: UIRadiusMode;
  borders: UIBorderMode;
  shadows: UIShadowMode;
  tabs: UITabStyle;
  buttons: UIButtonStyle;
  cards: UICardStyle;
  inputs: UIInputStyle;
  accent: UIAccentIntensity;
  typography: UITypographyScale;
}

export interface UiSettingsExport {
  version: 1;
  theme: ThemeName;
  uiStyle: UIStyleSettings;
  liteMode: boolean;
  compactNumbers: boolean;
  showTokenIcons: boolean;
  showTimeMachine: boolean;
  showXlnMascot: boolean;
  xlnMascotDock: XlnMascotDockPlacement;
  tokenPrecision: number;
  accountDeltaViewMode: AccountDeltaViewMode;
  portfolioScale: number;
  barColorMode: BarColorMode;
  barLayout: BarLayoutMode;
  accountBarUsdPerPx: number;
  verboseLogging: boolean;
  barCreditGradient: boolean;
  barAnimTransition: boolean;
  barAnimSweep: boolean;
  barAnimGlow: boolean;
  barAnimDeltaFlash: boolean;
  barAnimRipple: boolean;
}

export interface Settings {
  theme: ThemeName;
  accountSkin: AccountSkin;
  accountBarStyle: AccountBarStyle;
  uiStyle: UIStyleSettings;
  liteMode: boolean;
  barColorMode: BarColorMode;
  barLayout: BarLayoutMode;
  accountBarUsdPerPx: number;
  accountDeltaViewMode: AccountDeltaViewMode;
  tokenPrecision: number;
  showTokenIcons: boolean;
  showTimeMachine: boolean;
  showXlnMascot: boolean;
  xlnMascotDock: XlnMascotDockPlacement;
  dropdownMode: 'signer-first' | 'entity-first';
  runtimeDelay: number;
  balanceRefreshMs: number;
  relayUrl: string;
  portfolioScale: number;
  componentStates: Record<string, boolean>;
  compactNumbers: boolean;
  verboseLogging: boolean;
  barCreditGradient: boolean;
  barAnimTransition: boolean;
  barAnimSweep: boolean;
  barAnimGlow: boolean;
  barAnimDeltaFlash: boolean;
  barAnimRipple: boolean;
}
