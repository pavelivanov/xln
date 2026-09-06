import type { SurfaceId } from './surfaces';

export type ParityImplementation = 'complete' | 'partial' | 'missing';
export type ParityBrowserEvidence = 'covered' | 'partial' | 'missing';
export type ParityGapKind = 'browser' | 'implementation' | 'owner' | 'owner-decision' | 'verification';

export const PARITY_GAP_IDS = [
  'ops-workspace-route',
  'wallet-operation-parity',
  'framework-isolation',
  'candidate-verification',
] as const;

export type ParityGapId = (typeof PARITY_GAP_IDS)[number];

export type RetainedRouteParity = Readonly<{
  id: string;
  pathname: string;
  representativePath: `/${string}`;
  sveltePage: string;
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

export const RETAINED_ROUTE_PARITY = [
  { id: 'home', pathname: '/', representativePath: '/', sveltePage: 'frontend/src/routes/+page.svelte', intendedOwner: 'site', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/site/src/landing-page.tsx', focusedTests: ['tests/frontend/tooling/pilots/frontend-site-pilot.test.ts'], browserTests: siteBrowser, gapIds: [] },
  { id: 'install', pathname: '/install', representativePath: '/install', sveltePage: 'frontend/src/routes/install/+page.svelte', intendedOwner: 'site', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/site/src/install-page.tsx', focusedTests: ['tests/frontend/tooling/pilots/frontend-site-pilot.test.ts'], browserTests: siteBrowser, gapIds: [] },
  { id: 'rcpan', pathname: '/rcpan', representativePath: '/rcpan', sveltePage: 'frontend/src/routes/rcpan/+page.svelte', intendedOwner: 'site', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/site/src/rcpan/rcpan-page.tsx', focusedTests: ['tests/frontend/tooling/pilots/frontend-rcpan-pilot.test.ts'], browserTests: siteBrowser, gapIds: [] },
  { id: 'releases', pathname: '/releases', representativePath: '/releases', sveltePage: 'frontend/src/routes/releases/+page.svelte', intendedOwner: 'site', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/site/src/releases/releases-page.tsx', focusedTests: ['tests/frontend/tooling/pilots/frontend-releases-pilot.test.ts'], browserTests: siteBrowser, gapIds: [] },
  { id: 'reviews', pathname: '/reviews', representativePath: '/reviews', sveltePage: 'frontend/src/routes/reviews/+page.svelte', intendedOwner: 'site', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/site/src/reviews-page.tsx', focusedTests: ['tests/frontend/tooling/pilots/frontend-reviews-pilot.test.ts'], browserTests: siteBrowser, gapIds: [] },
  { id: 'unicast', pathname: '/unicast', representativePath: '/unicast', sveltePage: 'frontend/src/routes/unicast/+page.svelte', intendedOwner: 'site', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/site/src/unicast/unicast-page.tsx', focusedTests: ['tests/frontend/tooling/pilots/frontend-unicast-pilot.test.ts'], browserTests: siteBrowser, gapIds: [] },
  { id: 'market-cap', pathname: '/market-cap', representativePath: '/market-cap', sveltePage: 'frontend/src/routes/market-cap/+page.svelte', intendedOwner: 'site', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/site/src/market-cap-page.tsx', focusedTests: ['tests/frontend/tooling/pilots/frontend-market-cap-pilot.test.ts'], browserTests: siteBrowser, gapIds: [] },
  { id: 'docs', pathname: '/docs', representativePath: '/docs', sveltePage: 'frontend/src/routes/docs/+page.svelte', intendedOwner: 'docs', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/docs/src/docs-app.tsx', focusedTests: ['tests/frontend/tooling/pilots/frontend-docs-pilot.test.ts'], browserTests: docsBrowser, gapIds: [] },
  { id: 'wallet-app', pathname: '/app', representativePath: '/app', sveltePage: 'frontend/src/routes/app/+page.svelte', intendedOwner: 'wallet', implementation: 'partial', browserEvidence: 'partial', reactSource: 'frontend/apps/wallet/src/app-shell.tsx', focusedTests: ['tests/frontend/runtime/wallet/frontend-wallet-app-shell.test.ts', 'tests/frontend/tooling/frontend-wallet-flow-audit.test.ts', 'tests/frontend/payments/frontend-wallet-external-provider.test.ts'], browserTests: [...walletBrowser, ...crossSurfaceBrowser], gapIds: ['wallet-operation-parity', 'framework-isolation', 'candidate-verification'] },
  { id: 'wallet-address', pathname: '/address', representativePath: '/address', sveltePage: 'frontend/src/routes/address/+page.svelte', intendedOwner: 'wallet', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/wallet/src/address/wallet-address.tsx', focusedTests: ['tests/frontend/runtime/wallet/frontend-wallet-address.test.ts'], browserTests: walletBrowser, gapIds: [] },
  { id: 'wallet-address-entity', pathname: '/address/:entityId', representativePath: '/address/0xabc', sveltePage: 'frontend/src/routes/address/[entityId]/+page.svelte', intendedOwner: 'wallet', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/wallet/src/address/wallet-address.tsx', focusedTests: ['tests/frontend/runtime/wallet/frontend-wallet-address.test.ts'], browserTests: walletBrowser, gapIds: [] },
  { id: 'testnet', pathname: '/testnet', representativePath: '/testnet', sveltePage: 'frontend/src/routes/testnet/+page.svelte', intendedOwner: 'wallet', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/wallet/src/testnet/testnet-page.tsx', focusedTests: ['tests/frontend/tooling/pilots/frontend-testnet-pilot.test.ts'], browserTests: walletBrowser, gapIds: [] },
  { id: 'health', pathname: '/health', representativePath: '/health', sveltePage: 'frontend/src/routes/health/+page.svelte', intendedOwner: 'ops', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/ops/src/health/ops-health.tsx', focusedTests: ['tests/frontend/ops/frontend-ops-health.test.ts'], browserTests: opsBrowser, gapIds: [] },
  { id: 'qa', pathname: '/qa', representativePath: '/qa', sveltePage: 'frontend/src/routes/qa/+page.svelte', intendedOwner: 'ops', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/ops/src/qa/ops-qa.tsx', focusedTests: ['tests/frontend/ops/frontend-ops-qa.test.ts'], browserTests: opsBrowser, gapIds: [] },
  { id: 'qa-hlt', pathname: '/qa/hlt', representativePath: '/qa/hlt', sveltePage: 'frontend/src/routes/qa/hlt/+page.svelte', intendedOwner: 'ops', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/ops/src/hlt/ops-hlt.tsx', focusedTests: ['tests/frontend/ops/frontend-ops-hlt.test.ts'], browserTests: opsBrowser, gapIds: [] },
  { id: 'qa-quorum', pathname: '/qa/quorum', representativePath: '/qa/quorum', sveltePage: 'frontend/src/routes/qa/quorum/+page.svelte', intendedOwner: 'ops', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/ops/src/quorum/ops-quorum.tsx', focusedTests: ['tests/frontend/ops/frontend-ops-quorum.test.ts'], browserTests: opsBrowser, gapIds: [] },
  { id: 'runs', pathname: '/runs', representativePath: '/runs', sveltePage: 'frontend/src/routes/runs/+page.svelte', intendedOwner: 'ops', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/ops/src/runs/ops-runs.tsx', focusedTests: ['tests/frontend/ops/frontend-ops-runs.test.ts'], browserTests: opsBrowser, gapIds: [] },
  { id: 'scenarios', pathname: '/scenarios', representativePath: '/scenarios', sveltePage: 'frontend/src/routes/scenarios/+page.svelte', intendedOwner: 'ops', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/ops/src/scenarios/ops-scenarios.tsx', focusedTests: ['tests/frontend/ops/frontend-ops-scenarios.test.ts'], browserTests: [...opsBrowser, ...crossSurfaceBrowser], gapIds: [] },
  { id: 'ai', pathname: '/ai/:chatId?', representativePath: '/ai/audit', sveltePage: 'frontend/src/routes/ai/[[chatId]]/+page.svelte', intendedOwner: 'ops', implementation: 'complete', browserEvidence: 'covered', reactSource: 'frontend/apps/ops/src/ai/ops-ai.tsx', focusedTests: ['tests/frontend/ops/frontend-ops-ai.test.ts'], browserTests: opsBrowser, gapIds: [] },
  { id: 'embed', pathname: '/embed', representativePath: '/embed', sveltePage: 'frontend/src/routes/embed/+page.svelte', intendedOwner: 'ops', implementation: 'partial', browserEvidence: 'partial', reactSource: 'frontend/apps/ops/src/workspace/ops-workspace.tsx', focusedTests: ['tests/frontend/ops/entity/frontend-ops-entity-workspace.test.ts', 'tests/frontend/ops/frontend-ops-display-preferences.test.ts', 'tests/frontend/ops/entity/frontend-ops-entity-time-machine.test.ts', 'tests/frontend/ops/entity/frontend-ops-entity-activity-ledger.test.ts', 'tests/frontend/workspace/entity/entity-workspace-profile-update.test.ts'], browserTests: opsBrowser, gapIds: ['ops-workspace-route'] },
] as const satisfies readonly RetainedRouteParity[];

export type ParityGap = Readonly<{
  id: ParityGapId;
  kind: ParityGapKind;
  capabilityIds: readonly string[];
  routeIds: readonly string[];
  evidenceSources: readonly string[];
  nextSlice: string;
}>;

export const PARITY_GAPS = [
  { id: 'ops-workspace-route', kind: 'implementation', capabilityIds: ['ops-workspace'], routeIds: ['embed'], evidenceSources: ['frontend/apps/ops/src/ops-app.tsx', 'frontend/apps/ops/src/ops-model.ts', 'frontend/apps/ops/src/entity-workspace/ops-entity-workspace.tsx', 'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-projection.ts', 'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-profile-command.ts', 'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-owner.ts', 'frontend/apps/ops/src/ops-display-preferences.ts', 'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-activity-controller.ts', 'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-history.ts', 'frontend/apps/ops/src/entity-workspace/ops-entity-workspace-history-controller.ts', 'frontend/packages/browser/src/display-preferences.ts', 'frontend/packages/runtime-client/src/entity/entity-workspace-activity.ts', 'frontend/packages/runtime-client/src/entity/entity-workspace-consensus-evidence.ts', 'frontend/packages/runtime-client/src/entity/profile/entity-workspace-hub-policy.ts', 'frontend/packages/runtime-client/src/entity/profile/entity-workspace-profile-update.ts', 'frontend/packages/runtime-client/src/entity/entity-workspace-settings-summary.ts', 'frontend/packages/runtime-client/src/entity/entity-workspace-time-machine.ts', 'frontend/packages/ui/src/entity/activity/entity-workspace-activity-panel.tsx', 'frontend/packages/ui/src/entity/activity/entity-workspace-activity-row.tsx', 'frontend/packages/ui/src/entity/activity/entity-workspace-activity-tone.ts', 'frontend/packages/ui/src/entity/accounts/entity-workspace-consensus-panel.tsx', 'frontend/packages/ui/src/entity/settings/entity-workspace-display-panel.tsx', 'frontend/packages/ui/src/entity/profile/entity-workspace-profile-editor.tsx', 'frontend/packages/ui/src/entity/profile/entity-workspace-profile-panel.tsx', 'frontend/packages/ui/src/entity/entity-workspace-time-machine.tsx'], nextSlice: 'Finish remaining reachable Ops controls and shared Wallet action parity; preserve the public /embed layout boundary, then verify the complete candidate before authorized canonical cutover.' },
  { id: 'wallet-operation-parity', kind: 'implementation', capabilityIds: ['wallet-finance', 'wallet-payments-and-markets', 'wallet-shell-and-identity'], routeIds: ['wallet-app'], evidenceSources: ['plans/react-frontend-migration.md', 'frontend/apps/wallet/src/entity/wallet-entity-evidence.tsx', 'frontend/apps/wallet/src/manage/wallet-lending.tsx'], nextSlice: 'Finish Ownership commands, settlement approval/execution and cross-j commands; preserve the explicit backend admission and read-projection dependencies.' },
  { id: 'framework-isolation', kind: 'implementation', capabilityIds: ['wallet-browser-lifecycle'], routeIds: ['wallet-app'], evidenceSources: ['frontend/bridges/wallet/wallet-canonical-vault-runtime.ts', 'tests/frontend/tooling/frontend-shared-boundaries.test.ts'], nextSlice: 'Move retained canonical helpers and lifecycle stores to framework-neutral owners; direct bridge store reads are neutral, but transitive Svelte dependencies remain.' },
  { id: 'candidate-verification', kind: 'verification', capabilityIds: ['wallet-payments-and-markets'], routeIds: ['wallet-app'], evidenceSources: ['plans/react-frontend-migration.md', 'frontend/scripts/test-react-candidate.ts'], nextSlice: 'Resolve the Lending admission and Activity history dependencies, then rerun the complete candidate matrix and release checks on stable bytes.' },
] as const satisfies readonly ParityGap[];

export const CAPABILITY_PARITY = [
  { capabilityId: 'site-public-information', gapIds: [] },
  { capabilityId: 'docs-reader', gapIds: [] },
  { capabilityId: 'wallet-shell-and-identity', gapIds: ['wallet-operation-parity'] },
  { capabilityId: 'wallet-browser-lifecycle', gapIds: ['framework-isolation'] },
  { capabilityId: 'wallet-runtime-discovery', gapIds: [] },
  { capabilityId: 'wallet-recovery', gapIds: [] },
  { capabilityId: 'wallet-finance', gapIds: ['wallet-operation-parity'] },
  { capabilityId: 'wallet-payments-and-markets', gapIds: ['wallet-operation-parity', 'candidate-verification'] },
  { capabilityId: 'wallet-native-and-offline', gapIds: [] },
  { capabilityId: 'ops-health-and-qa', gapIds: [] },
  { capabilityId: 'ops-runs-scenarios-and-ai', gapIds: [] },
  { capabilityId: 'ops-workspace', gapIds: ['ops-workspace-route'] },
] as const;

export const CUTOVER_CHECKLIST = [
  { id: 'retained-route-parity', status: 'blocked-by-wp9', evidence: 'frontend/config/parity-audit.ts' },
  { id: 'per-surface-browser-evidence', status: 'blocked-by-wp9', evidence: 'frontend/scripts/test-react-candidate.ts' },
  { id: 'immutable-candidate-release', status: 'verified', evidence: 'frontend/scripts/release/candidate-release-verifier.ts' },
  { id: 'whole-release-rollback', status: 'verified', evidence: 'frontend/scripts/deployment/deployment-candidate.ts' },
  { id: 'canonical-commands-and-routing', status: 'owner-authorized-wp10', evidence: 'package.json' },
  { id: 'canonical-artifact-consumers', status: 'owner-authorized-wp10', evidence: 'frontend/config/platform-inventory.ts' },
  { id: 'svelte-source-dependencies-and-config', status: 'owner-authorized-wp10', evidence: 'frontend/package.json' },
  { id: 'production-activation', status: 'release-operation-wp11', evidence: 'scripts/deployment/deploy-platform.sh' },
] as const;
