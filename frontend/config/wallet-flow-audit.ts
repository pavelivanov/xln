import type { WalletAppView } from '../apps/wallet/src/app-shell-model';

export type WalletFlowAuditEntry = Readonly<{
  id: string;
  pathname: '/app' | '/testnet' | '/address' | `/address/${string}`;
  search: string;
  hash?: string;
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
  disposition: 'implemented' | 'partial' | 'deferred';
  remaining?: string;
  evidenceId: string;
}>;

export const WALLET_FLOW_AUDIT = [
  {
    id: 'entity-ownership-evidence', pathname: '/app', search: '', hash: '#ownership', page: 'app', view: 'entity-tools',
    sources: ['frontend/apps/wallet/src/entity/wallet-entity-evidence.tsx', 'frontend/packages/ui/src/entity/profile/entity-workspace-ownership-panel.tsx'],
    tests: ['frontend/tests/react-candidate/wallet/wallet-entity-evidence.spec.ts'],
  },
  {
    id: 'entity-consensus-evidence', pathname: '/app', search: '', hash: '#settings/consensus', page: 'app', view: 'entity-tools',
    sources: ['frontend/apps/wallet/src/entity/wallet-entity-evidence.tsx', 'frontend/packages/ui/src/entity/accounts/entity-workspace-consensus-panel.tsx'],
    tests: ['frontend/tests/react-candidate/wallet/wallet-entity-evidence.spec.ts'],
  },
  {
    id: 'account-dropdown',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: ['frontend/apps/wallet/src/account/controls/wallet-account-dropdown.tsx', 'frontend/apps/wallet/src/account/controls/wallet-account-dropdown-source.ts',
      'frontend/packages/ui/src/account/account-dropdown.tsx', 'frontend/src/lib/components/Entity/account/account-dropdown-model.ts'],
    tests: ['frontend/tests/react-candidate/wallet/account/wallet-account-dropdown.spec.ts', 'tests/frontend/account/account-dropdown-model.test.ts'],
  },
  {
    id: 'account-rail-and-entity-selection',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/runtime/wallet-workspace-selection.ts',
      'frontend/apps/wallet/src/account/wallet-account-rail.tsx',
      'frontend/apps/wallet/src/account/wallet-account-workspace.tsx',
      'frontend/apps/wallet/src/account/wallet-account-context.ts',
      'frontend/apps/wallet/src/manage/wallet-manage.tsx',
      'frontend/apps/wallet/src/move/wallet-move.tsx',
      'frontend/apps/wallet/src/manage/wallet-lending.tsx',
      'frontend/apps/wallet/src/history/wallet-history.tsx',
      'frontend/bridges/wallet/wallet-canonical-account-context.ts',
      'frontend/packages/ui/src/account/account-workspace-rail.tsx',
      'frontend/packages/runtime-client/src/account-workspace-tabs.ts',
    ],
    tests: ['frontend/tests/react-candidate/wallet/account/wallet-account-rail.spec.ts', 'frontend/tests/react-candidate/wallet/wallet-entity-selection.spec.ts',
      'frontend/tests/react-candidate/wallet/account/wallet-account-workspace.spec.ts', 'tests/frontend/account/wallet-workspace-selection.test.ts',
      'frontend/tests/react-candidate/wallet/account/wallet-account-commands.spec.ts',
      'tests/frontend/account/wallet-account-tools.test.ts'],
  },
  {
    id: 'account-appearance',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/account/controls/wallet-account-appearance.tsx',
      'frontend/apps/wallet/src/account/controls/wallet-account-appearance-source.ts',
      'frontend/apps/wallet/src/account/view/wallet-account-summary.tsx',
      'frontend/packages/ui/src/rcpan/delta-capacity-bar-model.ts',
      'frontend/packages/ui/src/rcpan/delta-capacity-bar.tsx',
      'frontend/packages/ui/src/rcpan/delta-apple.tsx',
    ],
    tests: ['frontend/tests/react-candidate/wallet/account/wallet-account-appearance.spec.ts', 'tests/frontend/account/account-bar-presentation.test.ts'],
  },
  {
    id: 'focused-account-view',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/account/view/wallet-account-view.tsx',
      'frontend/apps/wallet/src/account/view/wallet-account-token.tsx',
      'frontend/apps/wallet/src/account/view/wallet-account-activity.tsx',
      'frontend/apps/wallet/src/account/view/wallet-account-view-source.ts',
      'frontend/src/lib/components/Entity/account/account-focused-view.ts',
      'frontend/src/lib/components/Entity/account/activity/account-activity-presentation.ts',
      'frontend/src/lib/components/Entity/account/account-faucet-command.ts',
    ],
    tests: ['frontend/tests/react-candidate/wallet/account/wallet-account-view.spec.ts', 'tests/frontend/account/account-workspace-navigation.test.ts'],
  },
  {
    id: 'direct-account-opening',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/account/controls/wallet-account-open.tsx',
      'frontend/apps/wallet/src/entity/wallet-entity-input.tsx',
      'frontend/apps/wallet/src/onboarding/wallet-hub-discovery-source.ts',
      'frontend/apps/wallet/src/navigation/wallet-navigation-model.ts',
      'frontend/bridges/wallet/wallet-canonical-hub-discovery.ts',
      'frontend/src/lib/components/Entity/account/account-open-commands.ts',
      'frontend/packages/ui/src/entity-input-model.ts',
    ],
    tests: ['tests/frontend/assets/entity-input-model.test.ts', 'frontend/tests/react-candidate/wallet/account/wallet-account-open.spec.ts'],
  },
  {
    id: 'manual-hub-discovery',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/onboarding/wallet-hub-discovery.tsx',
      'frontend/apps/wallet/src/onboarding/wallet-hub-discovery-source.ts',
      'frontend/bridges/wallet/wallet-canonical-hub-discovery.ts',
      'frontend/src/lib/components/Entity/onboarding/hub-discovery-commands.ts',
      'frontend/src/lib/components/Entity/onboarding/hub-discovery-profile.ts',
    ],
    tests: ['tests/frontend/onboarding/hub-discovery-profile.test.ts', 'frontend/tests/react-candidate/wallet/onboarding/wallet-hub-discovery.spec.ts'],
  },
  {
    id: 'entity-formation',
    pathname: '/app', search: '?portfolio=1', page: 'app', view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/onboarding/wallet-formation.tsx',
      'frontend/bridges/wallet/wallet-canonical-formation.ts',
      'frontend/src/lib/components/Entity/onboarding/formation/formation-commands.ts',
      'frontend/src/lib/components/Entity/onboarding/formation/formation-runtime-projection.ts',
    ],
    tests: ['tests/frontend/onboarding/wallet-formation.test.ts', 'frontend/tests/react-candidate/wallet/onboarding/wallet-formation.spec.ts'],
  },
  {
    id: 'post-creation-profile-and-preferences',
    pathname: '/app', search: '?setup=1', page: 'app', view: 'identity',
    sources: [
      'frontend/apps/wallet/src/onboarding/wallet-onboarding.tsx',
      'frontend/bridges/wallet/wallet-canonical-onboarding.ts',
      'frontend/src/lib/components/Entity/onboarding/onboarding-setup.ts',
      'frontend/src/lib/components/Entity/onboarding/onboarding-hub-join.ts',
    ],
    tests: ['frontend/tests/react-candidate/wallet/onboarding/wallet-onboarding.spec.ts'],
  },
  {
    id: 'embedded-runtime-boot',
    pathname: '/app',
    search: '',
    page: 'app',
    view: 'overview',
    sources: [
      'frontend/packages/browser/src/runtime/session/runtime-module-loader.ts',
      'frontend/packages/browser/src/runtime/wallet-embedded-runtime-session.ts',
      'frontend/packages/browser/src/runtime/wallet-runtime-suspension.ts',
      'frontend/bridges/runtime/browser-runtime-adapter.ts',
      'frontend/bridges/runtime/browser-runtime-bootstrap.ts',
      'frontend/apps/wallet/src/runtime/wallet-embedded-runtime.ts',
    ],
    tests: [
      'tests/frontend/runtime/session/runtime-module-loader.test.ts',
      'tests/frontend/runtime/wallet/wallet-embedded-runtime-session.test.ts',
      'tests/frontend/runtime/wallet/wallet-runtime-suspension.test.ts',
    ],
  },
  {
    id: 'testnet-launcher',
    pathname: '/testnet',
    search: '',
    page: 'testnet',
    view: null,
    sources: [
      'frontend/apps/wallet/src/testnet/testnet-model.ts',
      'frontend/apps/wallet/src/testnet/testnet-page.tsx',
    ],
    tests: ['tests/frontend/tooling/pilots/frontend-testnet-pilot.test.ts'],
  },
  {
    id: 'address-directory',
    pathname: '/address',
    search: '',
    page: 'address-directory',
    view: null,
    sources: [
      'frontend/apps/wallet/src/address/wallet-address-model.ts',
      'frontend/apps/wallet/src/address/wallet-address-runtime-affinity.ts',
      'frontend/apps/wallet/src/address/wallet-address-source.ts',
      'frontend/apps/wallet/src/address/wallet-address.tsx',
    ],
    tests: [
      'tests/frontend/runtime/wallet/frontend-wallet-address.test.ts',
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
      'frontend/apps/wallet/src/address/wallet-address-model.ts',
      'frontend/apps/wallet/src/address/wallet-address-runtime-affinity.ts',
      'frontend/apps/wallet/src/address/wallet-address-source.ts',
      'frontend/apps/wallet/src/address/wallet-address.tsx',
    ],
    tests: [
      'tests/frontend/runtime/wallet/frontend-wallet-address.test.ts',
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
    tests: ['tests/frontend/runtime/wallet/frontend-wallet-app-shell.test.ts'],
  },
  {
    id: 'identity-entry-and-rehearsal',
    pathname: '/app',
    search: '?setup=1',
    page: 'app',
    view: 'identity',
    sources: [
      'frontend/apps/wallet/src/identity/identity-onboarding-model.ts',
      'frontend/apps/wallet/src/identity/identity-onboarding.tsx',
      'frontend/apps/wallet/src/identity/identity-recovery.tsx',
    ],
    tests: [
      'tests/frontend/onboarding/frontend-wallet-identity-onboarding.test.ts',
      'tests/frontend/onboarding/recovery/frontend-wallet-recovery-rehearsal.test.ts',
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
      'frontend/apps/wallet/src/identity/identity-onboarding.tsx',
      'frontend/apps/wallet/src/identity/identity-recovery.tsx',
      'frontend/apps/wallet/src/runtime/wallet-embedded-runtime.ts',
      'frontend/bridges/wallet/wallet-canonical-vault-runtime.ts',
      'frontend/packages/browser/src/runtime/wallet-embedded-runtime-session.ts',
      'frontend/src/lib/stores/vault/walletRuntimeOpeningAdapter.ts',
    ],
    tests: [
      'tests/frontend/onboarding/recovery/frontend-wallet-recovery-rehearsal.test.ts',
      'tests/frontend/onboarding/runtime/wallet-runtime-opening.test.ts',
      'tests/frontend/onboarding/recovery/wallet-recovery-selection-session.test.ts',
      'tests/frontend/runtime/wallet/wallet-embedded-runtime-session.test.ts',
    ],
  },
  {
    id: 'brainvault-runtime-opening',
    pathname: '/app',
    search: '?setup=1',
    page: 'app',
    view: 'identity',
    sources: [
      'frontend/apps/wallet/src/identity/identity-onboarding.tsx',
      'frontend/apps/wallet/src/identity/identity-brainvault-progress.tsx',
      'frontend/apps/wallet/src/runtime/wallet-embedded-runtime.ts',
      'frontend/bridges/wallet/brainvault/wallet-brainvault-browser-derivation.ts',
      'frontend/bridges/wallet/brainvault/wallet-brainvault-material-finalization.ts',
      'frontend/bridges/wallet/wallet-canonical-vault-runtime.ts',
      'frontend/packages/browser/src/identity/wallet-brainvault-material-session.ts',
      'frontend/src/lib/stores/vault/walletRuntimeOpeningAdapter.ts',
    ],
    tests: [
      'tests/frontend/onboarding/brainvault/frontend-wallet-brainvault-derivation.test.ts',
      'tests/frontend/onboarding/brainvault/wallet-brainvault-material-session.test.ts',
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
      'frontend/apps/wallet/src/identity/identity-recovery.tsx',
      'frontend/apps/wallet/src/onboarding/wallet-identity-opening.ts',
      'frontend/apps/wallet/src/runtime/wallet-embedded-runtime.ts',
      'frontend/bridges/wallet/wallet-canonical-vault-runtime.ts',
      'frontend/packages/browser/src/recovery/wallet-recovery-selection-session.ts',
    ],
    tests: [
      'tests/frontend/onboarding/recovery/frontend-wallet-recovery-file.test.ts',
      'tests/frontend/onboarding/recovery/wallet-recovery-selection-session.test.ts',
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
      'frontend/apps/wallet/src/recovery/wallet-recovery-services.tsx',
      'frontend/apps/wallet/src/recovery/wallet-recovery-services-source.ts',
      'frontend/bridges/wallet/wallet-canonical-recovery-services.ts',
      'frontend/packages/browser/src/recovery/wallet-recovery-services.ts',
    ],
    tests: [
      'tests/frontend/onboarding/recovery/frontend-wallet-recovery-services.test.ts',
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
      'frontend/apps/wallet/src/push-wake/wallet-push-wake.tsx',
      'frontend/apps/wallet/src/push-wake/wallet-push-wake-source.ts',
      'frontend/bridges/wallet/wallet-canonical-push-wake.ts',
      'frontend/packages/browser/src/wallet/wallet-push-wake.ts',
      'frontend/static/push-wake-sw.js',
    ],
    tests: [
      'tests/frontend/onboarding/runtime/frontend-wallet-push-wake.test.ts',
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
      'frontend/apps/wallet/src/settings/wallet-settings-model.ts',
      'frontend/apps/wallet/src/settings/wallet-settings.tsx',
    ],
    tests: ['tests/frontend/onboarding/runtime/frontend-wallet-preferences.test.ts'],
  },
  {
    id: 'diagnostics',
    pathname: '/app',
    search: '?diagnostics=1',
    page: 'app',
    view: 'diagnostics',
    sources: [
      'frontend/apps/wallet/src/diagnostics/wallet-diagnostics-model.ts',
      'frontend/apps/wallet/src/diagnostics/wallet-diagnostics.tsx',
    ],
    tests: ['tests/frontend/diagnostics/wallet/frontend-wallet-diagnostics.test.ts'],
  },
  {
    id: 'assets-and-accounts',
    pathname: '/app',
    search: '?portfolio=1',
    page: 'app',
    view: 'portfolio',
    sources: [
      'frontend/apps/wallet/src/portfolio/wallet-portfolio-model.ts',
      'frontend/apps/wallet/src/portfolio/wallet-portfolio-source.ts',
      'frontend/apps/wallet/src/portfolio/wallet-portfolio.tsx',
    ],
    tests: [
      'tests/frontend/runtime/wallet/frontend-wallet-portfolio.test.ts',
      'frontend/tests/react-candidate/wallet/wallet-financial.spec.ts',
    ],
  },
  {
    id: 'financial-health',
    pathname: '/app',
    search: '?health=1',
    page: 'app',
    view: 'health',
    sources: [
      'frontend/apps/wallet/src/financial-health/wallet-financial-health-model.ts',
      'frontend/apps/wallet/src/financial-health/wallet-financial-health-source.ts',
      'frontend/apps/wallet/src/financial-health/wallet-financial-health.tsx',
    ],
    tests: [
      'tests/frontend/runtime/wallet/frontend-wallet-financial-health.test.ts',
      'frontend/tests/react-candidate/wallet/wallet-financial.spec.ts',
    ],
  },
  {
    id: 'payments',
    pathname: '/app',
    search: '?payments=1',
    page: 'app',
    view: 'payments',
    sources: [
      'frontend/apps/wallet/src/payments/wallet-payment-model.ts',
      'frontend/apps/wallet/src/payments/wallet-payment-source.ts',
      'frontend/apps/wallet/src/payments/wallet-payments.tsx',
    ],
    tests: [
      'tests/frontend/payments/frontend-wallet-payments.test.ts',
      'frontend/tests/react-candidate/wallet/wallet-transactions.spec.ts',
    ],
  },
  {
    id: 'markets-and-activity',
    pathname: '/app',
    search: '?markets=1',
    page: 'app',
    view: 'markets',
    sources: [
      'frontend/apps/wallet/src/markets/wallet-market-model.ts',
      'frontend/apps/wallet/src/markets/wallet-market-source.ts',
      'frontend/apps/wallet/src/markets/wallet-markets.tsx',
    ],
    tests: [
      'tests/frontend/markets/frontend-wallet-markets.test.ts',
      'frontend/tests/react-candidate/wallet/wallet-transactions.spec.ts',
    ],
  },
  {
    id: 'external-wallet-moves',
    pathname: '/app',
    search: '?payments=1',
    page: 'app',
    view: 'payments',
    sources: [
      'frontend/apps/wallet/src/payments/wallet-payment-external.tsx',
      'frontend/apps/wallet/src/onboarding/wallet-external-provider-source.ts',
      'frontend/bridges/wallet/wallet-canonical-external-provider.ts',
      'frontend/packages/browser/src/wallet/wallet-external-provider.ts',
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
    evidenceSource: 'frontend/bridges/wallet/wallet-canonical-onboarding.ts',
    evidenceMarker: 'createOnboardingHubJoinCommands',
    reason: 'React post-creation setup, automatic Hub joining and local/remote-owner Entity Formation are verified. Remote Hub opening and full reload parity remain open.',
  },
  {
    id: 'canonical-cutover',
    destination: 'WP10',
    evidenceSource: 'frontend/apps/wallet/src/wallet-app.tsx',
    evidenceMarker: 'canonical Svelte wallet',
    reason: 'Production framework cutover remains an explicit owner-authorized operation.',
  },
] as const satisfies readonly WalletFlowDeferral[];

const REMAINING_WALLET_REQUIREMENTS: Readonly<Record<string, string>> = {
  onboarding: 'Remote Hub opening and the complete reload path remain unverified.',
  settings: 'Committed Consensus is mounted; remaining retained settings and command controls are incomplete.',
  credit: 'Manage commands are mounted; remote request-credit and full retained behavior require closure evidence.',
  collateral: 'Request and Move forms are mounted; full positive collateral command matrix remains open.',
  debt: 'Committed debt reads exist; full retained enforcement controls are incomplete.',
  disputes: 'Prepare/finalize forms exist; the complete positive lifecycle is not browser-verified.',
  history: 'Per-frame Activity pagination can omit events; backend query repair is outside the frontend boundary.',
  lending: 'Forms exist; canonical admission rejects lending mutations with OUT_OF_PROFILE_TX_KINDS.',
  settlement: 'Proposal exists; approval/execution controls and remote read projection remain open.',
  'cross-j': 'Lifecycle reads exist; cross-j command controls are unported.',
  activity: 'Same-frame history pagination loses the unreturned tail; complete history is not verified.',
};

export const WALLET_REQUIREMENT_AUDIT = ([
  { id: 'boot', group: 1, disposition: 'implemented', evidenceId: 'embedded-runtime-boot' },
  { id: 'shell', group: 1, disposition: 'implemented', evidenceId: 'runtime-overview-shell' },
  { id: 'identity', group: 1, disposition: 'implemented', evidenceId: 'identity-entry-and-rehearsal' },
  { id: 'onboarding', group: 1, disposition: 'partial', evidenceId: 'post-creation-profile-and-preferences' },
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
] as const satisfies readonly WalletRequirementAudit[]).map((requirement): WalletRequirementAudit => {
  const remaining = REMAINING_WALLET_REQUIREMENTS[requirement.id];
  return remaining ? { ...requirement, disposition: 'partial', remaining } : requirement;
});
