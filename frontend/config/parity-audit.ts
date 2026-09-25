import type { SurfaceId } from '../../packages/frontend-release/surfaces';

export type ParityImplementation = 'complete' | 'partial' | 'missing';
// Registration coverage only; passing runs and candidate identity are recorded in the migration plan.
export type ParityBrowserEvidence = 'covered' | 'partial' | 'missing';
export type ParityGapKind = 'browser' | 'implementation' | 'owner' | 'owner-decision' | 'verification';

export const PARITY_GAP_IDS = [
  'ops-workspace-route',
  'candidate-verification',
] as const;

export type ParityGapId = (typeof PARITY_GAP_IDS)[number];

export type RouteParity = Readonly<{
  id: string;
  pathname: string;
  representativePath: `/${string}`;
  intendedOwner: SurfaceId;
  implementation: ParityImplementation;
  browserEvidence: ParityBrowserEvidence;
  reactSource: string | null;
  focusedTests: readonly string[];
  browserTests: readonly string[];
  gapIds: readonly ParityGapId[];
}>;

const siteBrowser = [
  'frontend/tests/react-candidate/site.spec.ts',
  'frontend/tests/react-candidate/site-routes.spec.ts',
] as const;
const docsBrowser = ['frontend/tests/react-candidate/docs.spec.ts'] as const;
const walletBrowser = [
  'frontend/tests/react-candidate/wallet.spec.ts',
  'frontend/tests/react-candidate/wallet/wallet-financial.spec.ts',
  'frontend/tests/react-candidate/wallet/wallet-transactions.spec.ts',
] as const;
const opsBrowser = ['frontend/tests/react-candidate/ops/ops.spec.ts'] as const;
const crossSurfaceBrowser = ['frontend/tests/react-candidate/cross-surface.spec.ts'] as const;

export const ROUTE_PARITY = [
  {
    id: 'home',
    pathname: '/',
    representativePath: '/',
    intendedOwner: 'site',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/site/src/landing-page.tsx',
    focusedTests: ['tests/frontend/tooling/pilots/frontend-site-pilot.test.ts'],
    browserTests: siteBrowser,
    gapIds: [],
  },
  {
    id: 'install',
    pathname: '/install',
    representativePath: '/install',
    intendedOwner: 'site',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/site/src/install-page.tsx',
    focusedTests: ['tests/frontend/tooling/pilots/frontend-site-pilot.test.ts'],
    browserTests: siteBrowser,
    gapIds: [],
  },
  {
    id: 'rcpan',
    pathname: '/rcpan',
    representativePath: '/rcpan',
    intendedOwner: 'site',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/site/src/rcpan/rcpan-page.tsx',
    focusedTests: ['tests/frontend/tooling/pilots/frontend-rcpan-pilot.test.ts'],
    browserTests: siteBrowser,
    gapIds: [],
  },
  {
    id: 'releases',
    pathname: '/releases',
    representativePath: '/releases',
    intendedOwner: 'site',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/site/src/releases/releases-page.tsx',
    focusedTests: ['tests/frontend/tooling/pilots/frontend-releases-pilot.test.ts'],
    browserTests: siteBrowser,
    gapIds: ['candidate-verification'],
  },
  {
    id: 'reviews',
    pathname: '/reviews',
    representativePath: '/reviews',
    intendedOwner: 'site',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/site/src/reviews-page.tsx',
    focusedTests: ['tests/frontend/tooling/pilots/frontend-reviews-pilot.test.ts'],
    browserTests: siteBrowser,
    gapIds: [],
  },
  {
    id: 'unicast',
    pathname: '/unicast',
    representativePath: '/unicast',
    intendedOwner: 'site',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/site/src/unicast/unicast-page.tsx',
    focusedTests: ['tests/frontend/tooling/pilots/frontend-unicast-pilot.test.ts'],
    browserTests: siteBrowser,
    gapIds: [],
  },
  {
    id: 'market-cap',
    pathname: '/market-cap',
    representativePath: '/market-cap',
    intendedOwner: 'site',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/site/src/market-cap-page.tsx',
    focusedTests: ['tests/frontend/tooling/pilots/frontend-market-cap-pilot.test.ts'],
    browserTests: siteBrowser,
    gapIds: [],
  },
  {
    id: 'docs',
    pathname: '/docs',
    representativePath: '/docs',
    intendedOwner: 'docs',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/docs/src/docs-app.tsx',
    focusedTests: ['tests/frontend/tooling/pilots/frontend-docs-pilot.test.ts'],
    browserTests: docsBrowser,
    gapIds: [],
  },
  {
    id: 'wallet-app',
    pathname: '/app',
    representativePath: '/app',
    intendedOwner: 'wallet',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/wallet/src/app-shell.tsx',
    focusedTests: [
      'tests/frontend/runtime/wallet/frontend-wallet-app-shell.test.ts',
      'tests/frontend/tooling/audit/frontend-wallet-flow-audit.test.ts',
      'tests/frontend/payments/frontend-wallet-external-provider.test.ts',
    ],
    browserTests: [...walletBrowser, ...crossSurfaceBrowser],
    gapIds: ['candidate-verification'],
  },
  {
    id: 'wallet-address',
    pathname: '/address',
    representativePath: '/address',
    intendedOwner: 'wallet',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/wallet/src/address/wallet-address.tsx',
    focusedTests: ['tests/frontend/runtime/wallet/frontend-wallet-address.test.ts'],
    browserTests: walletBrowser,
    gapIds: [],
  },
  {
    id: 'wallet-address-entity',
    pathname: '/address/:entityId',
    representativePath: '/address/0xabc',
    intendedOwner: 'wallet',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/wallet/src/address/wallet-address.tsx',
    focusedTests: ['tests/frontend/runtime/wallet/frontend-wallet-address.test.ts'],
    browserTests: walletBrowser,
    gapIds: [],
  },
  {
    id: 'testnet',
    pathname: '/testnet',
    representativePath: '/testnet',
    intendedOwner: 'wallet',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/wallet/src/testnet/testnet-page.tsx',
    focusedTests: ['tests/frontend/tooling/pilots/frontend-testnet-pilot.test.ts'],
    browserTests: walletBrowser,
    gapIds: [],
  },
  {
    id: 'health',
    pathname: '/health',
    representativePath: '/health',
    intendedOwner: 'ops',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/ops/src/health/ops-health.tsx',
    focusedTests: ['tests/frontend/ops/health/frontend-ops-health.test.ts'],
    browserTests: [
      ...opsBrowser,
      'frontend/tests/react-candidate/ops/ops-health-events.spec.ts',
      'frontend/tests/react-candidate/ops/ops-health-topology.spec.ts',
    ],
    gapIds: [],
  },
  {
    id: 'qa',
    pathname: '/qa',
    representativePath: '/qa',
    intendedOwner: 'ops',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/ops/src/qa/ops-qa.tsx',
    focusedTests: ['tests/frontend/ops/frontend-ops-qa.test.ts'],
    browserTests: opsBrowser,
    gapIds: [],
  },
  {
    id: 'qa-hlt',
    pathname: '/qa/hlt',
    representativePath: '/qa/hlt',
    intendedOwner: 'ops',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/ops/src/hlt/ops-hlt.tsx',
    focusedTests: ['tests/frontend/ops/frontend-ops-hlt.test.ts'],
    browserTests: opsBrowser,
    gapIds: [],
  },
  {
    id: 'qa-quorum',
    pathname: '/qa/quorum',
    representativePath: '/qa/quorum',
    intendedOwner: 'ops',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/ops/src/quorum/ops-quorum.tsx',
    focusedTests: ['tests/frontend/ops/frontend-ops-quorum.test.ts'],
    browserTests: opsBrowser,
    gapIds: [],
  },
  {
    id: 'runs',
    pathname: '/runs',
    representativePath: '/runs',
    intendedOwner: 'ops',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/ops/src/runs/ops-runs.tsx',
    focusedTests: ['tests/frontend/ops/frontend-ops-runs.test.ts'],
    browserTests: opsBrowser,
    gapIds: [],
  },
  {
    id: 'scenarios',
    pathname: '/scenarios',
    representativePath: '/scenarios',
    intendedOwner: 'ops',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/ops/src/scenarios/ops-scenarios.tsx',
    focusedTests: ['tests/frontend/ops/frontend-ops-scenarios.test.ts'],
    browserTests: [...opsBrowser, ...crossSurfaceBrowser],
    gapIds: [],
  },
  {
    id: 'ai',
    pathname: '/ai/:chatId?',
    representativePath: '/ai/audit',
    intendedOwner: 'ops',
    implementation: 'complete',
    browserEvidence: 'covered',
    reactSource: 'frontend/apps/ops/src/ai/ops-ai.tsx',
    focusedTests: ['tests/frontend/ops/frontend-ops-ai.test.ts'],
    browserTests: opsBrowser,
    gapIds: [],
  },
  {
    id: 'embed',
    pathname: '/embed',
    representativePath: '/embed',
    intendedOwner: 'ops',
    implementation: 'partial',
    browserEvidence: 'partial',
    reactSource: 'frontend/apps/ops/src/workspace/ops-workspace.tsx',
    focusedTests: [
      'tests/frontend/ops/entity/frontend-ops-entity-workspace.test.ts',
      'tests/frontend/ops/frontend-ops-display-preferences.test.ts',
      'tests/frontend/ops/entity/frontend-ops-entity-time-machine.test.ts',
      'tests/frontend/ops/entity/frontend-ops-entity-activity-ledger.test.ts',
      'tests/frontend/workspace/entity/entity-workspace-profile-update.test.ts',
    ],
    browserTests: opsBrowser,
    gapIds: ['ops-workspace-route'],
  },
] as const satisfies readonly RouteParity[];

export type ParityGap = Readonly<{
  id: ParityGapId;
  kind: ParityGapKind;
  capabilityIds: readonly string[];
  routeIds: readonly string[];
  evidenceSources: readonly string[];
  nextSlice: string;
}>;

export const PARITY_GAPS = [
  {
    id: 'ops-workspace-route',
    kind: 'implementation',
    capabilityIds: ['ops-workspace'],
    routeIds: ['embed'],
    evidenceSources: [
      'frontend/apps/ops/src/ops-app.tsx',
      'frontend/apps/ops/src/ops-model.ts',
      'frontend/apps/ops/src/entity-workspace/ops-entity-workspace.tsx',
      'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-projection.ts',
      'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-profile-command.ts',
      'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-owner.ts',
      'frontend/apps/ops/src/ops-display-preferences.ts',
      'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-activity-controller.ts',
      'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-history.ts',
      'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-history-controller.ts',
      'frontend/packages/browser/src/preferences/display-preferences.ts',
      'frontend/packages/runtime-client/src/entity/workspace/entity-workspace-activity.ts',
      'frontend/packages/runtime-client/src/entity/workspace/entity-workspace-consensus-evidence.ts',
      'frontend/packages/runtime-client/src/entity/profile/entity-workspace-hub-policy.ts',
      'frontend/packages/runtime-client/src/entity/profile/entity-workspace-profile-update.ts',
      'frontend/packages/runtime-client/src/entity/workspace/entity-workspace-settings-summary.ts',
      'frontend/packages/runtime-client/src/entity/workspace/entity-workspace-time-machine.ts',
      'frontend/packages/ui/src/entity/activity/entity-workspace-activity-panel.tsx',
      'frontend/packages/ui/src/entity/activity/entity-workspace-activity-row.tsx',
      'frontend/packages/ui/src/entity/activity/entity-workspace-activity-tone.ts',
      'frontend/packages/ui/src/entity/accounts/entity-workspace-consensus-panel.tsx',
      'frontend/packages/ui/src/entity/settings/entity-workspace-display-panel.tsx',
      'frontend/packages/ui/src/entity/profile/entity-workspace-profile-editor.tsx',
      'frontend/packages/ui/src/entity/profile/entity-workspace-profile-panel.tsx',
      'frontend/packages/ui/src/entity/entity-workspace-time-machine.tsx',
    ],
    nextSlice:
      'R01/R02 and W08d2 are closed. R03 dual-destination BrainVault and late-completion development cases pass; retain final-byte acceptance in V05a/V05b, obtain G04b headset evidence, and resolve the protected wide embed fixture failure; preserve the public /embed boundary.',
  },
  {
    id: 'candidate-verification',
    kind: 'verification',
    capabilityIds: ['site-public-information', 'wallet-payments-and-markets', 'wallet-native-and-offline'],
    routeIds: ['wallet-app', 'releases'],
    evidenceSources: [
      'plans/react-frontend-migration.md',
      'frontend/scripts/testing/test-react-candidate.ts',
      'frontend/scripts/testing/test-artifact-candidate.ts',
    ],
    nextSlice:
      'B9 saved release envelopes are migrated and verified by the canonical decoder. Historical R05 built interactions pass; full unit/browser, final artifact/PWA/rollback, native launch, headset and root gates remain V04–V09/G04b. C02/C03 require explicit owner/release authority.',
  },
] as const satisfies readonly ParityGap[];

export const CAPABILITY_PARITY = [
  { capabilityId: 'site-public-information', gapIds: ['candidate-verification'] },
  { capabilityId: 'docs-reader', gapIds: [] },
  { capabilityId: 'wallet-shell-and-identity', gapIds: [] },
  { capabilityId: 'wallet-browser-lifecycle', gapIds: [] },
  { capabilityId: 'wallet-runtime-discovery', gapIds: [] },
  { capabilityId: 'wallet-recovery', gapIds: [] },
  { capabilityId: 'wallet-finance', gapIds: [] },
  { capabilityId: 'wallet-payments-and-markets', gapIds: ['candidate-verification'] },
  { capabilityId: 'wallet-native-and-offline', gapIds: ['candidate-verification'] },
  { capabilityId: 'ops-health-and-qa', gapIds: [] },
  { capabilityId: 'ops-runs-scenarios-and-ai', gapIds: [] },
  { capabilityId: 'ops-workspace', gapIds: ['ops-workspace-route'] },
] as const;

export const CUTOVER_CHECKLIST = [
  { id: 'retained-route-parity', status: 'verified', evidence: 'frontend/config/parity-audit.ts' },
  {
    id: 'per-surface-browser-evidence',
    status: 'verified',
    evidence: 'frontend/scripts/testing/test-react-candidate.ts',
  },
  {
    id: 'immutable-candidate-release',
    status: 'verified',
    evidence: 'frontend/scripts/release/candidate-release-verifier.ts',
  },
  { id: 'whole-release-rollback', status: 'verified', evidence: 'packages/frontend-release/deployment.ts' },
  { id: 'canonical-commands-and-routing', status: 'verified', evidence: 'package.json' },
  { id: 'canonical-artifact-consumers', status: 'verified', evidence: 'frontend/config/platform-inventory.ts' },
  { id: 'retired-source-dependencies-and-config', status: 'verified', evidence: 'frontend/package.json' },
  { id: 'production-activation', status: 'release-operation-wp11', evidence: 'scripts/deployment/deploy-platform.sh' },
] as const;
