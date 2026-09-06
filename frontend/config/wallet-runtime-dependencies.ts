// These packages are first reached through lazy recovery/Account tools.
// Resolve them before serving either host: a dependency reload would erase
// transient seed rehearsal or payment-form input.
export const WALLET_RUNTIME_DEPENDENCIES = [
  'jdenticon', 'qrcode', '@capacitor/core', '@capacitor/app', '@capacitor/device',
  '@capacitor/haptics', '@capacitor/keyboard', '@capacitor/local-notifications',
  '@capacitor/preferences', '@capacitor/push-notifications',
  '@capacitor/splash-screen', '@capacitor/status-bar',
] as const;
