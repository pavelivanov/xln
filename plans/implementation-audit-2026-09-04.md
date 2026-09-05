# React migration implementation audit — 2026-09-04

Audited commit: `3cfcf11cb90e499215523a76700aabad22d844a0` (`main`).
Scope: the three existing `plans/` documents, their frontend implementation,
retained Svelte behavior, migration tests, and build/release consumers.
This report changes no product source and grants no cutover authority.

## Verdict

**The migration has working foundations, but behavioral parity is materially
less complete than the headline suggests. It is not ready for canonical cutover.**

- Four independently built React applications are real. Current strict checks,
  all four production builds, assembly, and release integrity verification pass.
- `19 complete / 1 partial` is a manually maintained route classification.
  `/app` also has demonstrable parity gaps, so the claimed 19 complete routes
  cannot stand as a behavioral completion measure.
- Wallet onboarding, canonical deep links, cross-j command entry, and the full
  settlement lifecycle are unfinished. These are additional work beyond the
  latest checkpoint's “remaining Entity workspace commands.”
- `/embed` still renders a candidate placeholder. The internal Entity workspace
  has useful read views, but the complete Dockview/Graph3D/operator workspace
  has not been mounted in React. Owner unlock is also missing from the UI.
- The full repository gate is not green. Production activation, destructive
  Svelte removal, and canonical cutover remain separate owner decisions.

No defensible effort-completion percentage can be derived from route count:
one workspace route contains substantially more retained behavior than several
informational routes combined.

## Work-package status

| Package | Plan claim | Audited status | What remains |
|---|---|---|---|
| WP0 — Inventory | Done | Ownership inventory exists; behavior inventory needs reconciliation | Track nested flows, command completion, custody dependencies, and contradictory statuses |
| WP1 — Roots/tooling | Done | Four roots and local checks implemented | Planned slice/frontend/changed-file command interface is unfinished |
| WP2 — Routing/assets/assembly | Done | Implemented; fresh build and 354-file release verified | Preserve these contracts through remaining ports and cutover |
| WP3 — Site | Complete | Seven route implementations present; current builds/checks pass | Durable browser coverage is thinner than the historical interaction evidence |
| WP4 — Docs | Implemented | Shared reader/model and deterministic producer present | Current candidate browser spec checks rendering, not search/history/anchor/failure interactions |
| WP5 — Browser/Runtime boundaries | Done | Substantial shared lifecycle and query work implemented | Canonical custody bridges still depend on Svelte; isolation does not mean Svelte deletion is ready |
| WP6 — Wallet | Complete with dependencies | **Partial behavioral parity** | Canonical hash routes, post-creation onboarding, cross-j commands, full settlement/Account operations, successful command-flow evidence |
| WP7 — Ops | In progress | **Partial, substantial remaining integration** | Mount workspace/panels/Graph3D; preserve command palette/localization; finish Entity commands and owner unlock |
| WP8 — PWA/native/release | Complete | Candidate tooling implemented; release integrity freshly verified | Native/PWA/rollback browser results remain historical in this audit; canonical consumers remain WP10 |
| WP9 — Parity | One implementation gap | **Under-counted and internally inconsistent** | Expand gap ledger and tie completion to concrete retained behaviors |
| WP10 — Cutover | Owner authorization required | Not performed; prerequisites incomplete | Complete parity, eliminate framework dependencies safely, run applicable gates, obtain authorization |
| WP11 — Production | Separate release operation | Not performed | Fixed artifact, authorization, deployment smoke, and rollback readiness |

The current capability generator reports **12 accounted capabilities: seven
`implemented`, five `in_progress`, zero `verified`**. The five in progress are
wallet browser lifecycle, wallet Runtime discovery, wallet finance, ops
runs/scenarios/AI, and ops workspace. Some statuses may be stale; they must be
reconciled against evidence rather than treated as a second completion percentage.

Sources: [capabilities](/Users/p/Projects/xln/frontend/config/capabilities.ts:131),
[parity classifications](/Users/p/Projects/xln/frontend/config/parity-audit.ts:41),
[latest checkpoint](/Users/p/Projects/xln/plans/react-frontend-migration.md:3620).

## Prioritized findings

Priorities describe migration acceptance risk, not an incident in the current
canonical Svelte application. Effort includes verification: S = hours,
M = approximately a day, L = multiple days. All findings below have high
confidence from direct source inspection; F1 also has fresh browser reproduction.

| ID | Priority | Finding | Impact | Effort | Change risk |
|---|---|---|---|---|---|
| F1 | P1 | Retained wallet hash links select the wrong screen | Existing links lose their intended operation | M | Medium: routing and context selection |
| F2 | P1 | Wallet completeness includes unfinished onboarding and financial actions | Candidate cannot replace the retained wallet end to end | L | High: preserve canonical command/authority paths |
| F3 | P1 | Profile owner unlock exists only as a test invocation | Users cannot exercise the tested unlock-and-save flow | L | High: custody lifecycle and lock/expiry |
| F4 | P1 | Workspace extraction is not a mounted React workspace | Large retained operator surface remains unavailable | L | Medium/high: lifecycle and context integration |
| F5 | P2 | Parity tests validate declarations more strongly than behavior | Green metadata tests permit unsupported completion claims | M | Low: strengthen evidence without deleting assertions |
| F6 | P2 | Browser evidence omits important successful operations | Rendering and error-state coverage cannot close flow parity | L | Medium: isolated Runtime fixtures and authority |
| F7 | P2 | Remaining Svelte dependencies are not a deletion-only task | WP10 cannot safely be reduced to removing files/packages | L | High where canonical custody lifecycle is involved |
| F8 | P2 | Planned verification interface and React CI coverage are incomplete | Documented commands fail; CI does not run candidate build/typecheck/browser commands | M | Low/medium: tooling and CI wiring |
| F9 | P2 | Known verification failures remain unresolved | No current repository-wide completion evidence | M, scope-dependent | Medium: distinguish obsolete tests from real regressions |

### F1 — Restore canonical wallet deep links

The retained route model maps `accounts/send`, `accounts/swap`, `ownership`,
and `settings/recovery` to specific workspace sections. React's wallet resolver
recognizes only the invoice `#pay/` family and query flags; these other hashes
all fall through to `overview`. The shell subscribes to `popstate` but has no
`hashchange` subscription for direct hash changes.

Fresh read-only reproduction at
`http://127.0.0.1:19180/app#settings/recovery` displayed **Wallet overview**,
with no console warnings/errors. A direct comparison of the two pure route
resolvers reproduced the mismatch for all four examples above.

Evidence: [wallet resolver](/Users/p/Projects/xln/frontend/apps/wallet/src/app-shell-model.ts:20),
[shell subscription](/Users/p/Projects/xln/frontend/apps/wallet/src/app-shell.tsx:140),
[canonical mapping](/Users/p/Projects/xln/frontend/packages/runtime-client/src/entity-workspace-navigation.ts:95).
Restore the canonical URL contract and verify direct loading, hash navigation,
and back/forward behavior with the correct selected Runtime/Entity context.

### F2 — Reopen wallet parity at the operation level

Three concrete examples contradict the broad wallet-complete claim:

- **Onboarding:** the wallet requirement ledger explicitly defers post-creation
  profile, jurisdiction, and hub joining to WP9. The canonical user flow mounts
  `OnboardingPanel` after wallet creation; the React shell has no corresponding
  stage. Creating/opening a Runtime does not complete that retained onboarding.
- **Cross-j swaps:** React renders existing cross-j route status and builds
  same-j orders. Canonical Svelte additionally submits cross-j intent and
  clear/cancel operations. The requirement ledger nevertheless marks `cross-j`
  implemented through the markets/activity entry.
- **Settlement:** React's collateral withdrawal explicitly creates only a
  proposal. The retained settlement panel also executes settlement and provides
  explicit broadcast/rebroadcast controls. Those controls are not exposed as
  a complete React settlement workflow. React's external-deposit broadcast is
  a different operation and does not close this gap.

Evidence: [deferred onboarding and requirement claims](/Users/p/Projects/xln/frontend/config/wallet-flow-audit.ts:330),
[canonical onboarding stage](/Users/p/Projects/xln/frontend/src/lib/view/UserModePanel.svelte:872),
[React cross-j display](/Users/p/Projects/xln/frontend/apps/wallet/src/wallet-market-pane.tsx:178),
[canonical cross-j submission](/Users/p/Projects/xln/frontend/src/lib/components/Entity/swap/SwapPanel.svelte:2580),
[proposal-only React control](/Users/p/Projects/xln/frontend/apps/wallet/src/wallet-payment-operations.tsx:132),
[canonical settlement execution](/Users/p/Projects/xln/frontend/src/lib/components/Entity/payments/SettlementPanel.svelte:864).

Give these separate gap IDs and acceptance flows. Reuse canonical builders and
authority boundaries; this audit does not recommend new financial formulas or
protocol changes. Also enumerate credit, Account creation/configuration,
dispute actions, and Ownership commands before certifying the wallet.

### F3 — Preserve the owner-unlock limitation in all status reporting

The latest plan correction is accurate: `unlockOpsEntityWorkspaceOwner` has
no product UI caller. The browser test imports its source module through
`page.evaluate` and installs matching keys before clicking Save.
The test meaningfully exercises command submission/committed observation
after that setup, but cannot establish a user-accessible unlock flow.

Evidence: [owner adapter](/Users/p/Projects/xln/frontend/apps/ops/src/ops-entity-workspace-owner.ts:15),
[test-only unlock](/Users/p/Projects/xln/frontend/tests/react-candidate/ops.spec.ts:102),
[existing correction and required lifecycle](/Users/p/Projects/xln/plans/react-frontend-migration.md:3577).

This is a **known blocker confirmed by this audit**, not a newly discovered
authentication vulnerability. Resolve the canonical custody-adapter scope
before implementation. Acceptance must cover visible unlock, wrong-wallet
rejection, lock/expiry, unchanged remote Runtime selection, and committed save
without module-import key injection. Do not weaken owner-lane authentication.

### F4 — Treat the workspace as an integration program

Fresh browser inspection confirms `/embed` displays “Ops, independently
built.” Only `/__app/ops/entity-workspace` selects the React workspace.
`WorkspaceDock` is defined and source-tested but has no application consumer.
Graph3D renderer and panel projections are consumed by retained Svelte panels;
their extraction is useful work, but there is no mounted React equivalent of
the complete operator workspace.

The internal Entity shell renders read views and a limited Settings subset.
Other Settings selections reach `ProjectionBoundary`. Command palette and
localization remain explicitly assigned to a later workspace inventory entry;
the React xln-guide control persists a preference without a React mascot view.

Evidence: [route selection](/Users/p/Projects/xln/frontend/apps/ops/src/ops-model.ts:38),
[Dockview wrapper](/Users/p/Projects/xln/frontend/packages/ui/src/workspace-dock.tsx:28),
[retained Graph3D consumer](/Users/p/Projects/xln/frontend/src/lib/view/panels/graph3d/Graph3DPanel.svelte:43),
[Settings boundary](/Users/p/Projects/xln/frontend/packages/ui/src/entity-workspace-shell.tsx:219),
[unported registries](/Users/p/Projects/xln/frontend/config/platform-inventory.ts:631).

Split remaining work into mounted panels, Graph3D lifecycle, context/selection,
keyboard/localization, and command flows. Keep extraction milestones distinct
from user-visible implementation milestones.

### F5 — Make the status ledger reject unsupported completion

Parity tests verify route ownership, file existence, nonempty browser-test
arrays, and expected counts. They do not require each completed route to have
no deferred requirements or require `in_progress` capabilities to carry a gap.
Consequently all 22 focused audit tests pass while `/app` has F1/F2 gaps.

Evidence: [metadata checks](/Users/p/Projects/xln/tests/frontend/tooling/frontend-parity-audit.test.ts:30),
[hard-coded counts](/Users/p/Projects/xln/tests/frontend/tooling/frontend-parity-audit.test.ts:76),
[single gap](/Users/p/Projects/xln/frontend/config/parity-audit.ts:72),
[wallet deferrals](/Users/p/Projects/xln/frontend/config/wallet-flow-audit.ts:330).

Use behavior IDs with an exact replacement test and explicit implementation,
integration, and verification states. Keep file/ownership assertions, but add
cross-ledger consistency checks. Historical test counts and a filename alone
must not close a behavior gap. Maintain a short current backlog separate from
the 3,770-line migration history.

### F6 — Expand successful browser-flow coverage

The candidate payment browser test quotes a route and checks that Submit is
enabled; it does not submit that payment. Its operations check selects Lend
but does not execute it. The markets test reads an existing book/activity and
does not place, fill, or cancel an order. Docs has one rendering smoke case.
Health/QA/HLT/runs primarily exercise unavailable upstream states in the current
candidate matrix. These are useful checks with narrower meaning than parity.

Evidence: [payment and market browser tests](/Users/p/Projects/xln/frontend/tests/react-candidate/wallet-transactions.spec.ts:11),
[docs smoke](/Users/p/Projects/xln/frontend/tests/react-candidate/docs.spec.ts:10),
[ops unavailable states](/Users/p/Projects/xln/frontend/tests/react-candidate/ops.spec.ts:26).

Preserve the real recovery, external-transfer, reserve-deposit, scenario, and
profile-after-unlock coverage already present. Add isolated successful flows
for the omitted commands and their failure/retry states; assert committed
outcomes. The old Svelte E2Es alone cannot certify the React replacement.

### F7 — Schedule framework neutralization before destructive cutover

Four canonical wallet bridges import `svelte/store`. The vault bridge imports
`vaultStore` and the Runtime controller; the former also imports Svelte stores.
The current wallet build emits a `vaultStore` chunk. Deleting Svelte or
`frontend/src` at WP10 would therefore remove live candidate dependencies.

Evidence: [vault bridge](/Users/p/Projects/xln/frontend/bridges/wallet-canonical-vault-runtime.ts:1),
[vault store](/Users/p/Projects/xln/frontend/src/lib/stores/vault/vaultStore.ts:1),
[custody inventory](/Users/p/Projects/xln/frontend/config/platform-inventory.ts:110).

Coexistence is explicitly authorized and is not itself a defect. The finding is
that retiring it requires implementation and lifecycle verification, beyond
changing canonical commands or deleting dependencies. Coordinate this work
with F3 and prove the final candidate dependency graph is Svelte-free before
cutover. Preserve storage formats, protection, expiry, and Runtime ownership.

### F8 — Finish or accurately scope verification tooling

The documented `--level=slice`, `--level=frontend`, and `--changed-from` interface
does not exist. Current `check.ts` accepts only `--level=local` with explicit
surface selection. Fresh calls fail with `FRONTEND_CHECK_LEVEL_UNSUPPORTED`
and `FRONTEND_ARGUMENT_UNKNOWN` respectively. The frontend CI job runs the
canonical Svelte check/build; neither workflow invokes the React check/build/
candidate browser scripts.

Evidence: [documented interface](/Users/p/Projects/xln/plans/react-frontend-migration.md:150),
[implemented parser](/Users/p/Projects/xln/frontend/scripts/check.ts:18),
[CI commands](/Users/p/Projects/xln/.github/workflows/build-and-test.yml:123),
[canonical frontend check](/Users/p/Projects/xln/frontend/package.json:17).

Add candidate validation alongside the canonical pipeline without switching
production. Implement the planned selectors/levels or clearly record them as
unfinished deliverables. A green canonical CI run is insufficient evidence
for all four candidate applications.

### F9 — Keep current verification blockers explicit

The targeted 59-file suite initially produced 313 passes and three failures.
Two gateway failures were sandbox loopback restrictions: the isolated gateway
suite passes all five tests outside the sandbox. The remaining consensus-view
test fails independently: it expects lineage length two but receives zero.
Its fixture uses retired `certifiedFrameLineage`; the projection reads the
canonical `certifiedFrameHead`.

Evidence: [failing fixture/assertion](/Users/p/Projects/xln/tests/frontend/workspace/entity-consensus-settings.test.ts:70),
[current projection](/Users/p/Projects/xln/frontend/src/lib/components/Entity/workspace/entity-consensus-settings.ts:183).
Reconcile that test with current authority semantics; do not restore obsolete
durable lineage merely to make it pass. This is pre-existing baseline debt,
not a defect attributed to the newest profile change.

The required root check passed 26 tests / 100,156 assertions, then failed on
Hardhat's compiler-cache mutex in the sandbox. The focused artifact retry
outside the sandbox passed with no tracked artifact diff. Separately,
`bun run rscore:fmt` fails because `cargo` is unavailable. No full repository
pass is claimed, and later root gates were not inferred to be green.

## Fresh verification evidence

| Check | Result |
|---|---|
| Five focused parity/capability/workspace/profile files | 22 pass, 0 fail, 667 assertions |
| Tooling + workspace + ops, 59 files | 313 pass, 3 fail; two gateway failures isolated to sandbox; one baseline test remains |
| Isolated gateway retry outside sandbox | 5 pass, 0 fail, 58 assertions |
| Isolated consensus-settings baseline | 1 pass, 1 fail; expected 2, received 0 |
| Payment + market command/model tests | 12 pass, 0 fail, 57 assertions |
| React local check, all apps | Pass; 701 files scanned, zero unsafe-type findings; tooling and four TS projects pass |
| Four React production builds | Pass; site/docs/wallet/ops transform 401 / 35 / 1,860 / 1,652 modules |
| Build durations | 0.829 / 0.354 / 2.19 / 1.88 seconds respectively, warm local environment |
| Fresh assembly + independent verifier | Pass; 354 files in the release below |
| Browser audit | `/app#settings/recovery` incorrectly shows overview; `/embed` placeholder confirmed; internal workspace boundary confirmed; no captured warning/error logs |
| Root check | 26 tests pass, then Hardhat cache-lock failure |
| Focused contract-artifact retry | Pass outside sandbox; four immutable metadata checks; no tracked artifact diff |
| Rust format prerequisite | Fails: `cargo: command not found` |

Verified candidate:
`sha256-ccaed526113400ef1fb588a1cc150cf3090c21cd95b7c5391fa5af9520cae630`.
This establishes artifact integrity, not behavioral completeness or release approval.

Logs: [React checks](/tmp/xln-plans-audit-react-check.log),
[targeted suite](/tmp/xln-plans-audit-l2.log),
[gateway retry](/tmp/xln-plans-audit-gateway.log),
[builds](/tmp/xln-plans-audit-build.log),
[assembly](/tmp/xln-plans-audit-assembly.log),
[release verifier](/tmp/xln-plans-audit-verify.log),
[root gate](/tmp/xln-plans-audit-root-check.log),
[artifact retry](/tmp/xln-plans-audit-contract-retry.log).
These `/tmp` logs are local, temporary evidence.

## Recommended execution order

1. Reconcile the status ledger: mark `/app` partial, expand WP9 beyond its one
   umbrella gap, and bind every retained operation to explicit acceptance.
2. Restore canonical wallet routes and add direct-load/hash/history regressions.
3. Resolve the canonical custody-adapter scope for ops unlock and Svelte
   neutralization. This is the specific owner decision already identified by
   the latest plan; ordinary read-view work can proceed independently.
4. Finish wallet onboarding and command flows, and mount the React operator
   workspace on candidate routes. Reuse the extracted projections and canonical
   command helpers; preserve protocol and persistence boundaries.
5. Close successful browser-flow coverage, candidate CI, and baseline failures;
   then rerun all applicable browser/native/PWA/rollback and repository gates
   on one fixed candidate before requesting WP10 authority.

## Limits and rejected interpretations

- This is a deep audit of the migration plan's implementation and completion
  evidence, not a new cryptographic, consensus, contract, or custody security
  certification. Backend sources were read only where needed to understand
  frontend boundaries. No external model quorum was run.
- The full 1,364-test frontend baseline, full candidate browser matrix, native
  packaging, PWA upgrade/offline browser flow, and deployment rollback browser
  flow were not rerun. Their historical plan results are not fresh evidence.
  Fresh browser inspection used the default 1280×720 viewport; this report
  does not claim a new mobile/wide visual acceptance matrix.
- No production deployment, destructive cutover, or live Runtime restart was
  attempted. The isolated audit origin used port 19180; its server and browser
  tab were closed after inspection. Existing port 8080 processes were untouched.
- Intentionally retaining Svelte during migration is authorized. Refusing
  unauthenticated owner commands is correct. Neither is reported as a security
  flaw. The problem is incomplete replacement behavior and overstated evidence.
- Builds emit large-chunk warnings (wallet 686.75 kB; ops workspace Runtime
  757.03 kB). These are bundle observations, not measured user latency or a
  claim about live TPS; no performance optimization is proposed from them.

**Next:** reconcile the behavioral backlog, obtain the bounded custody scope
decision, and complete the missing vertical flows before cutover preparation.
