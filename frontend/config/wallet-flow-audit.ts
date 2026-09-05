import type { WalletAppView } from '../apps/wallet/src/app-shell-model';

export type WalletFlowAuditEntry = Readonly<{
  id: string;
  pathname: '/app' | '/testnet' | '/address' | `/address/${string}`;
  search: string;
  page: 'app' | 'testnet' | 'address-directory' | 'address-detail';
  view: WalletAppView | null;
  sources: readonly string[];
  tests: readonly string[];
}>;

export type WalletFlowDeferral = Readonly<{
  id: string;
  destination: 'WP9' | 'WP10';
  evidenceSource: string;
  evidenceMarker: string;
  reason: string;
}>;

export type WalletRequirementAudit = Readonly<{
  id: string;
  group: 1 | 2 | 3 | 4;
  disposition: 'implemented' | 'deferred';
  evidenceId: string;
}>;

export const WALLET_FLOW_AUDIT = [
  {
    id: 'account-dropdown',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: ['frontend/apps/wallet/src/wallet-account-dropdown.tsx', 'frontend/apps/wallet/src/wallet-account-dropdown-source.ts',
      'frontend/packages/ui/src/account-dropdown.tsx', 'frontend/src/lib/components/Entity/account/account-dropdown-model.ts'],
    tests: ['frontend/tests/react-candidate/wallet-account-dropdown.spec.ts', 'tests/frontend/account/account-dropdown-model.test.ts'],
  },
  {
    id: 'account-rail-and-entity-selection',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/wallet-workspace-selection.ts',
      'frontend/apps/wallet/src/wallet-account-rail.tsx',
      'frontend/packages/ui/src/account-workspace-rail.tsx',
      'frontend/packages/runtime-client/src/account-workspace-tabs.ts',
    ],
    tests: ['frontend/tests/react-candidate/wallet-account-rail.spec.ts', 'tests/frontend/account/wallet-workspace-selection.test.ts'],
  },
  {
    id: 'account-appearance',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/wallet-account-appearance.tsx',
      'frontend/apps/wallet/src/wallet-account-appearance-source.ts',
      'frontend/apps/wallet/src/wallet-account-summary.tsx',
      'frontend/packages/ui/src/rcpan/delta-capacity-bar-model.ts',
      'frontend/packages/ui/src/rcpan/delta-capacity-bar.tsx',
      'frontend/packages/ui/src/rcpan/delta-apple.tsx',
    ],
    tests: ['frontend/tests/react-candidate/wallet-account-appearance.spec.ts', 'tests/frontend/account/account-bar-presentation.test.ts'],
  },
  {
    id: 'focused-account-view',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/wallet-account-view.tsx',
      'frontend/apps/wallet/src/wallet-account-token.tsx',
      'frontend/apps/wallet/src/wallet-account-activity.tsx',
      'frontend/apps/wallet/src/wallet-account-view-source.ts',
      'frontend/src/lib/components/Entity/account/account-focused-view.ts',
      'frontend/src/lib/components/Entity/account/account-activity-presentation.ts',
      'frontend/src/lib/components/Entity/account/account-faucet-command.ts',
    ],
    tests: ['frontend/tests/react-candidate/wallet-account-view.spec.ts', 'tests/frontend/account/account-workspace-navigation.test.ts'],
  },
  {
    id: 'direct-account-opening',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/wallet-account-open.tsx',
      'frontend/apps/wallet/src/wallet-entity-input.tsx',
      'frontend/apps/wallet/src/wallet-hub-discovery-source.ts',
      'frontend/apps/wallet/src/wallet-navigation-model.ts',
      'frontend/bridges/wallet-canonical-hub-discovery.ts',
      'frontend/src/lib/components/Entity/account/account-open-commands.ts',
      'frontend/src/lib/components/shared/entity-input-model.ts',
    ],
    tests: ['tests/frontend/assets/entity-input-model.test.ts', 'frontend/tests/react-candidate/wallet-account-open.spec.ts'],
  },
  {
    id: 'manual-hub-discovery',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/wallet-hub-discovery.tsx',
      'frontend/apps/wallet/src/wallet-hub-discovery-source.ts',
      'frontend/bridges/wallet-canonical-hub-discovery.ts',
      'frontend/src/lib/components/Entity/onboarding/hub-discovery-commands.ts',
      'frontend/src/lib/components/Entity/onboarding/hub-discovery-profile.ts',
    ],
    tests: ['tests/frontend/onboarding/hub-discovery-profile.test.ts', 'frontend/tests/react-candidate/wallet-hub-discovery.spec.ts'],
  },
  {
    id: 'entity-formation',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/wallet-formation.tsx',
      'frontend/bridges/wallet-canonical-formation.ts',
      'frontend/src/lib/components/Entity/onboarding/formation-commands.ts',
      'frontend/src/lib/components/Entity/onboarding/formation-runtime-projection.ts',
    ],
    tests: ['frontend/tests/react-candidate/wallet-formation.spec.ts'],
  },
  {
    id: 'post-creation-profile-and-preferences',
    pathname: '/app', search: '?setup=1', page: 'app', view: 'identity',
    sources: [
      'frontend/apps/wallet/src/wallet-onboarding.tsx',
      'frontend/bridges/wallet-canonical-onboarding.ts',
      'frontend/src/lib/components/Entity/onboarding/onboarding-setup.ts',
      'frontend/src/lib/components/Entity/onboarding/onboarding-hub-join.ts',
    ],
    tests: ['frontend/tests/react-candidate/wallet-onboarding.spec.ts'],
  },
  {
    id: 'embedded-runtime-boot',
    pathname: '/app',
    search: '',
    page: 'app',
    view: 'overview',
    sources: [
      'frontend/packages/browser/src/runtime-module-loader.ts',
      'frontend/packages/browser/src/wallet-embedded-runtime-session.ts',
      'frontend/packages/browser/src/wallet-runtime-suspension.ts',
      'frontend/apps/wallet/src/wallet-embedded-runtime-adapter.ts',
      'frontend/apps/wallet/src/wallet-embedded-runtime-bootstrap.ts',
      'frontend/apps/wallet/src/wallet-embedded-runtime.ts',
    ],
    tests: [
      'tests/frontend/runtime/runtime-module-loader.test.ts',
      'tests/frontend/runtime/wallet-embedded-runtime-session.test.ts',
      'tests/frontend/runtime/wallet-runtime-suspension.test.ts',
    ],
  },
  {
    id: 'testnet-launcher',
    pathname: '/testnet',
    search: '',
    page: 'testnet',
    view: null,
    sources: [
      'frontend/apps/wallet/src/testnet-model.ts',
      'frontend/apps/wallet/src/testnet-page.tsx',
    ],
    tests: ['tests/frontend/tooling/frontend-testnet-pilot.test.ts'],
  },
  {
    id: 'address-directory',
    pathname: '/address',
    search: '',
    page: 'address-directory',
    view: null,
    sources: [
      'frontend/apps/wallet/src/wallet-address-model.ts',
      'frontend/apps/wallet/src/wallet-address-runtime-affinity.ts',
      'frontend/apps/wallet/src/wallet-address-source.ts',
      'frontend/apps/wallet/src/wallet-address.tsx',
    ],
    tests: [
      'tests/frontend/runtime/frontend-wallet-address.test.ts',
      'frontend/tests/react-candidate/wallet.spec.ts',
    ],
  },
  {
    id: 'address-detail',
    pathname: `/address/0x${'0'.repeat(64)}`,
    search: '',
    page: 'address-detail',
    view: null,
    sources: [
      'frontend/apps/wallet/src/wallet-address-model.ts',
      'frontend/apps/wallet/src/wallet-address-runtime-affinity.ts',
      'frontend/apps/wallet/src/wallet-address-source.ts',
      'frontend/apps/wallet/src/wallet-address.tsx',
    ],
    tests: [
      'tests/frontend/runtime/frontend-wallet-address.test.ts',
      'frontend/tests/react-candidate/wallet.spec.ts',
    ],
  },
  {
    id: 'runtime-overview-shell',
    pathname: '/app',
    search: '',
    page: 'app',
    view: 'overview',
    sources: [
      'frontend/apps/wallet/src/app-shell-model.ts',
      'frontend/apps/wallet/src/app-shell.tsx',
    ],
    tests: ['tests/frontend/runtime/frontend-wallet-app-shell.test.ts'],
  },
  {
    id: 'identity-entry-and-rehearsal',
    pathname: '/app',
    search: '?setup=1',
    page: 'app',
    view: 'identity',
    sources: [
      'frontend/apps/wallet/src/identity-onboarding-model.ts',
      'frontend/apps/wallet/src/identity-onboarding.tsx',
      'frontend/apps/wallet/src/identity-recovery.tsx',
    ],
    tests: [
      'tests/frontend/onboarding/frontend-wallet-identity-onboarding.test.ts',
      'tests/frontend/onboarding/frontend-wallet-recovery-rehearsal.test.ts',
      'frontend/tests/react-candidate/wallet.spec.ts',
    ],
  },
  {
    id: 'mnemonic-runtime-opening',
    pathname: '/app',
    search: '?setup=1',
    page: 'app',
    view: 'identity',
    sources: [
      'frontend/apps/wallet/src/identity-onboarding.tsx',
      'frontend/apps/wallet/src/identity-recovery.tsx',
      'frontend/apps/wallet/src/wallet-embedded-runtime.ts',
      'frontend/bridges/wallet-canonical-vault-runtime.ts',
      'frontend/packages/browser/src/wallet-embedded-runtime-session.ts',
      'frontend/src/lib/stores/vault/walletRuntimeOpeningAdapter.ts',
    ],
    tests: [
      'tests/frontend/onboarding/frontend-wallet-recovery-rehearsal.test.ts',
      'tests/frontend/onboarding/wallet-runtime-opening.test.ts',
      'tests/frontend/onboarding/wallet-recovery-selection-session.test.ts',
      'tests/frontend/runtime/wallet-embedded-runtime-session.test.ts',
    ],
  },
  {
    id: 'brainvault-runtime-opening',
    pathname: '/app',
    search: '?setup=1',
    page: 'app',
    view: 'identity',
    sources: [
      'frontend/apps/wallet/src/identity-onboarding.tsx',
      'frontend/apps/wallet/src/identity-brainvault-progress.tsx',
      'frontend/apps/wallet/src/wallet-embedded-runtime.ts',
      'frontend/bridges/wallet-brainvault-browser-derivation.ts',
      'frontend/bridges/wallet-brainvault-material-finalization.ts',
      'frontend/bridges/wallet-canonical-vault-runtime.ts',
      'frontend/packages/browser/src/wallet-brainvault-material-session.ts',
      'frontend/src/lib/stores/vault/walletRuntimeOpeningAdapter.ts',
    ],
    tests: [
      'tests/frontend/onboarding/frontend-wallet-brainvault-derivation.test.ts',
      'tests/frontend/onboarding/wallet-brainvault-material-session.test.ts',
      'frontend/tests/react-candidate/wallet.spec.ts',
    ],
  },
  {
    id: 'encrypted-recovery-file',
    pathname: '/app',
    search: '?setup=1',
    page: 'app',
    view: 'identity',
    sources: [
      'frontend/apps/wallet/src/identity-recovery.tsx',
      'frontend/apps/wallet/src/wallet-identity-opening.ts',
      'frontend/apps/wallet/src/wallet-embedded-runtime.ts',
      'frontend/bridges/wallet-canonical-vault-runtime.ts',
      'frontend/packages/browser/src/wallet-recovery-selection-session.ts',
    ],
    tests: [
      'tests/frontend/onboarding/frontend-wallet-recovery-file.test.ts',
      'tests/frontend/onboarding/wallet-recovery-selection-session.test.ts',
      'frontend/tests/react-candidate/wallet.spec.ts',
    ],
  },
  {
    id: 'recovery-service-onboarding',
    pathname: '/app',
    search: '?settings=1',
    page: 'app',
    view: 'settings',
    sources: [
      'frontend/apps/wallet/src/wallet-recovery-services.tsx',
      'frontend/apps/wallet/src/wallet-recovery-services-source.ts',
      'frontend/bridges/wallet-canonical-recovery-services.ts',
      'frontend/packages/browser/src/wallet-recovery-services.ts',
    ],
    tests: [
      'tests/frontend/onboarding/frontend-wallet-recovery-services.test.ts',
      'frontend/tests/react-candidate/wallet.spec.ts',
    ],
  },
  {
    id: 'push-wake-registration',
    pathname: '/app',
    search: '?settings=1',
    page: 'app',
    view: 'settings',
    sources: [
      'frontend/apps/wallet/src/wallet-push-wake.tsx',
      'frontend/apps/wallet/src/wallet-push-wake-source.ts',
      'frontend/bridges/wallet-canonical-push-wake.ts',
      'frontend/packages/browser/src/wallet-push-wake.ts',
      'frontend/static/push-wake-sw.js',
    ],
    tests: [
      'tests/frontend/onboarding/frontend-wallet-push-wake.test.ts',
      'tests/frontend/recovery/push-wake-registration.test.ts',
      'frontend/tests/react-candidate/wallet.spec.ts',
    ],
  },
  {
    id: 'preferences',
    pathname: '/app',
    search: '?settings=1',
    page: 'app',
    view: 'settings',
    sources: [
      'frontend/apps/wallet/src/wallet-settings-model.ts',
      'frontend/apps/wallet/src/wallet-settings.tsx',
    ],
    tests: ['tests/frontend/onboarding/frontend-wallet-preferences.test.ts'],
  },
  {
    id: 'diagnostics',
    pathname: '/app',
    search: '?diagnostics=1',
    page: 'app',
    view: 'diagnostics',
    sources: [
      'frontend/apps/wallet/src/wallet-diagnostics-model.ts',
      'frontend/apps/wallet/src/wallet-diagnostics.tsx',
    ],
    tests: ['tests/frontend/diagnostics/frontend-wallet-diagnostics.test.ts'],
  },
  {
    id: 'assets-and-accounts',
    pathname: '/app',
    search: '?portfolio=1',
    page: 'app',
    view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/wallet-portfolio-model.ts',
      'frontend/apps/wallet/src/wallet-portfolio-source.ts',
      'frontend/apps/wallet/src/wallet-portfolio.tsx',
    ],
    tests: [
      'tests/frontend/runtime/frontend-wallet-portfolio.test.ts',
      'frontend/tests/react-candidate/wallet-financial.spec.ts',
    ],
  },
  {
    id: 'financial-health',
    pathname: '/app',
    search: '?health=1',
    page: 'app',
    view: 'health',
    sources: [
      'frontend/apps/wallet/src/wallet-financial-health-model.ts',
      'frontend/apps/wallet/src/wallet-financial-health-source.ts',
      'frontend/apps/wallet/src/wallet-financial-health.tsx',
    ],
    tests: [
      'tests/frontend/runtime/frontend-wallet-financial-health.test.ts',
      'frontend/tests/react-candidate/wallet-financial.spec.ts',
    ],
  },
  {
    id: 'payments',
    pathname: '/app',
    search: '?payments=1',
    page: 'app',
    view: 'payments',
    sources: [
      'frontend/apps/wallet/src/wallet-payment-model.ts',
      'frontend/apps/wallet/src/wallet-payment-source.ts',
      'frontend/apps/wallet/src/wallet-payments.tsx',
    ],
    tests: [
      'tests/frontend/payments/frontend-wallet-payments.test.ts',
      'frontend/tests/react-candidate/wallet-transactions.spec.ts',
    ],
  },
  {
    id: 'markets-and-activity',
    pathname: '/app',
    search: '?markets=1',
    page: 'app',
    view: 'markets',
    sources: [
      'frontend/apps/wallet/src/wallet-market-model.ts',
      'frontend/apps/wallet/src/wallet-market-source.ts',
      'frontend/apps/wallet/src/wallet-markets.tsx',
    ],
    tests: [
      'tests/frontend/markets/frontend-wallet-markets.test.ts',
      'frontend/tests/react-candidate/wallet-transactions.spec.ts',
    ],
  },
  {
    id: 'external-wallet-moves',
    pathname: '/app',
    search: '?payments=1',
    page: 'app',
    view: 'payments',
    sources: [
      'frontend/apps/wallet/src/wallet-payment-external.tsx',
      'frontend/apps/wallet/src/wallet-external-provider-source.ts',
      'frontend/bridges/wallet-canonical-external-provider.ts',
      'frontend/packages/browser/src/wallet-external-provider.ts',
      'frontend/src/lib/native/external-wallet-authority.ts',
    ],
    tests: [
      'tests/frontend/payments/frontend-wallet-external-provider.test.ts',
      'frontend/tests/react-candidate/wallet.spec.ts',
    ],
  },
] as const satisfies readonly WalletFlowAuditEntry[];

export const WALLET_FLOW_DEFERRALS = [
  {
    id: 'wallet-creation-and-onboarding',
    destination: 'WP9',
    evidenceSource: 'frontend/bridges/wallet-canonical-onboarding.ts',
    evidenceMarker: 'createOnboardingHubJoinCommands',
    reason: 'React post-creation setup, Entity Formation and manual Hub Discovery are mounted. Local Hub Account opening and remote discovery reads are verified. Successful automatic hub joining, remote owner command integration and full reload parity remain open.',
  },
  {
    id: 'canonical-cutover',
    destination: 'WP10',
    evidenceSource: 'frontend/apps/wallet/src/wallet-app.tsx',
    evidenceMarker: 'canonical Svelte wallet',
    reason: 'Production framework cutover remains an explicit owner-authorized operation.',
  },
] as const satisfies readonly WalletFlowDeferral[];

export const WALLET_REQUIREMENT_AUDIT = [
  { id: 'boot', group: 1, disposition: 'implemented', evidenceId: 'embedded-runtime-boot' },
  { id: 'shell', group: 1, disposition: 'implemented', evidenceId: 'runtime-overview-shell' },
  { id: 'identity', group: 1, disposition: 'implemented', evidenceId: 'identity-entry-and-rehearsal' },
  { id: 'onboarding', group: 1, disposition: 'deferred', evidenceId: 'wallet-creation-and-onboarding' },
  { id: 'recovery', group: 1, disposition: 'implemented', evidenceId: 'push-wake-registration' },
  { id: 'settings', group: 1, disposition: 'implemented', evidenceId: 'preferences' },
  { id: 'diagnostics', group: 1, disposition: 'implemented', evidenceId: 'diagnostics' },
  ...['assets', 'accounts', 'credit', 'collateral'].map((id) => ({
    id, group: 2 as const, disposition: 'implemented' as const, evidenceId: 'assets-and-accounts',
  })),
  ...['debt', 'solvency', 'disputes', 'history'].map((id) => ({
    id, group: 2 as const, disposition: 'implemented' as const, evidenceId: 'financial-health',
  })),
  ...['payments', 'receive', 'invoices', 'lending', 'settlement', 'reconnect', 'failures', 'quotes', 'routing'].map((id) => ({
    id, group: id === 'quotes' || id === 'routing' ? 4 as const : 3 as const,
    disposition: 'implemented' as const, evidenceId: 'payments',
  })),
  { id: 'moves', group: 3, disposition: 'implemented', evidenceId: 'external-wallet-moves' },
  ...['orders', 'orderbook', 'cancel-fill', 'cross-j', 'activity'].map((id) => ({
    id, group: 4 as const, disposition: 'implemented' as const, evidenceId: 'markets-and-activity',
  })),
] as const satisfies readonly WalletRequirementAudit[];
