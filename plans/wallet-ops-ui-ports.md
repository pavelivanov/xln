# Finish the existing wallet and ops UI ports

**Status:** IN PROGRESS — Account dropdown, six Account rail consumers and shared wallet Entity selection mounted, alongside four dock panels, setup, Formation, opening, focused Account details and appearance; UI parity remains incomplete.
**Scope:** the existing wallet and ops screens, rewritten and connected in React.
**Prepared:** 2026-09-05, `main` at `3cfcf11cb90e499215523a76700aabad22d844a0`
plus the uncommitted frontend changes already present in this checkout.
**Effort:** large; several independently verifiable increments. No percentage
estimate is justified by the current evidence.

This is the focused execution checklist for the UI-port portion of
[the migration work plan](react-frontend-migration.md). It does not replace the
larger migration or declare it finished when these ports are complete.

## Outcome and boundaries

Users can reach and operate the retained wallet and workspace screens through
the React apps, using the same URLs, selected Runtime/Entity/Account context,
existing commands, permissions, storage and error behavior.

- Modify `frontend/apps/wallet/**`, `frontend/apps/ops/**`, shared frontend
  packages/bridges, frontend-owned tests and inventories, and `plans/**`.
  Extract existing frontend helpers unchanged where both renderers need them.
- Use the current checkout; preserve its uncommitted work. Compare both
  `git diff -- frontend tests/frontend plans` and subsequent commits before
  executing. Reconcile drift against actual code; a dirty tree is not a gate.
- Preserve Runtime APIs, transitions, financial formulas, contracts, custody
  policy and persistence schemas. The proposal in
  `wallet-settlement-read-projection.md` remains inactive. No new backend
  endpoint or financial feature is a deliverable of this plan.
- Existing lifecycle/store bridges may support the port. Render screens in
  React; do not mount Svelte components or embed the retained app in an iframe.
  Removing all Svelte store dependencies is a later migration increment.
- Canonical tooling/CI cutover, Svelte deletion and production activation remain
  separate. Do not restart or reset the user's live Runtime stack to verify UI.

## Current implementation evidence

The four React app roots and builds already exist. Preserve the working wallet
identity, portfolio, payments, markets, activity, settings and recovery work.
The remaining task is behavior parity, not another app scaffold.

Three code locations show why the UI ports cannot be called complete:

1. `frontend/apps/ops/src/ops-model.ts` resolves only the internal workspace URL:

   ```ts
   : pathname === '/__app/ops/entity-workspace'
     ? { kind: 'workspace', pathname }
     : { kind: 'pending', pathname };
   ```

   `/embed` therefore reaches the pending screen. The internal Entity page
   does not provide the complete docked workspace.
2. `frontend/packages/ui/src/entity-workspace-shell.tsx` mounts reserves,
   account/activity reads, an Ownership projection and some settings panels.
   Other settings reach `ProjectionBoundary`; Account lists and Ownership
   projections do not provide all retained actions.
3. `frontend/config/wallet-flow-audit.ts` keeps full onboarding parity open.
   The React post-creation form now commits profile/preferences/recovery and
   manual completion. Formation now creates local numbered and weighted lazy
   Entities; manual Hub Discovery opens a real local Account and reads remote
   Hub details. Successful automatic joining and remote Formation integration
   remain. Track individual screens/actions instead of
   treating broad “implemented” labels as completion.

Reuse `frontend/packages/ui/src/workspace-dock.tsx` and the extracted
`graph3d-*` modules. They are implementation ingredients, not mounted-workspace
evidence. `ops-entity-workspace-source.ts` is the existing read-source pattern;
its current session opener requires a remote admin session and cannot simply
be reused as the complete local/scenario workspace host.

## Finish sequence from the current checkpoint

Keep each increment limited to an existing screen or connected flow. The
W/O ledger below defines the retained sources and complete acceptance scope.

| Order | Deliverable | Evidence required to close it |
|---|---|---|
| 1 | Selected Account/token/jurisdiction context across action forms and ops; remaining Manage, Move, Lending and History destinations; settlement and debt/activity controls | Reuse the mounted dropdown and rail; reach each retained action through its real route, preserve selection and permissions, observe committed results, cancellation and errors on isolated state |
| 2 | Remaining onboarding, identity/settings and Ownership controls | Successful automatic join, remote-owner and reload flows; visible lock/unlock/recovery controls; existing Ownership actions through retained helpers |
| 3 | Complete ops context and panel registry | Independent local/remote/scenario and Entity panel contexts, remaining real panels, retained restrictions, subscriptions and close/reopen cleanup |
| 4 | Graph3D/playback, `/embed`, layout restoration, keyboard and localization | Real graph interactions and scenario/trail URLs; stored layout and focus behavior; all retained locale/keyboard controls |
| 5 | Final UI parity verification and evidence update | Every W1–W10/O1–O10 row names a mounted consumer and passing behavior cases; complete wallet/ops matrices, app checks/builds and recorded root gate result |

Start with order 1 using the existing rail and wallet selection; do not rebuild
their scaffolding. Within order 3, finish the session/context boundary before
adding panels that require local or scenario state. Order 4's `/embed` route
switch belongs to the React candidate; default-frontend cutover is separate.

Three recorded verification gaps stay visible throughout: backend Activity
pagination, the two unlocalized network-trail failures, and missing `cargo`
for later root gates. They do not stop independent UI ports. Resolve only
frontend-owned causes under this plan and record exact external dependencies;
do not weaken existing tests or extend backend scope to make them pass.

## Wallet parity ledger

All rows are open for completion/verification. “Partial” means a React consumer
exists; it does not mean every action is missing. Paths below are relative to
`frontend/` unless stated otherwise. Follow each retained component's child
components and command handlers when implementing its row.

| ID | Existing surface and source | React work remaining | Current state |
|---|---|---|---|
| W1 | `src/lib/view/UserModePanel.svelte`; `components/Entity/workspace/shell/ContextSwitcher.svelte` under `src/lib/` | Complete Runtime/signer/jurisdiction and action-level Account/token context, including ops; empty/locked/disconnected/history states and remaining retained routes | Entity selection shared across Assets, Health, Payments and Markets; focused Account survives appearance round trip; full context parity remains partial |
| W2 | `src/lib/components/Entity/onboarding/OnboardingPanel.svelte`, `FormationPanel.svelte`, `HubDiscoveryPanel.svelte` | Finish successful automatic hub joining, remote-owner Formation/Hub Discovery integration and full reload parity; preserve mounted setup, Formation and manual discovery | Local setup, Formation and Hub Connect verified against a real Runtime; remote Hub reads verified; W2 remains partial |
| W3 | `src/lib/components/Entity/workspace/AccountWorkspaceView.svelte`, `AccountWorkspaceRail.svelte`; `account/ui/AccountPanel.svelte`, `AccountDropdown.svelte` under `src/lib/components/Entity/` | Selected Account/token wiring across action forms and ops; mount Move/Lending/History/Manage as their consumers land; remaining Entity Activity and live disputed/faucet evidence | Wallet Assets dropdown preserves the >5 threshold, full paginated Account list and retained status formatting; six real rail tabs, focused details/activity, Classic/Apple bars, appearance and disputed-entry action mounted; complete workspace parity remains open |
| W4 | `src/lib/components/Entity/account/ui/AccountConfigurePanel.svelte` and its children | Extend/request credit, collateral, add token, existing load-testing controls and dispute prepare/finalize UI; retain live/auth restrictions and confirmations | Some operations present; complete configuration UI missing |
| W5 | `src/lib/components/Entity/MoveWorkspace.svelte`; `payments/LendingPanel.svelte` under the same Entity directory | Existing Move selectors, pointer/touch interaction, allowance controls, lending and their command/result wiring | Partial payment-operation coverage |
| W6 | `src/lib/components/Entity/payments/SettlementPanel.svelte`, `PendingBatchNotice.svelte` | Port remaining settlement proposal/review/approval/execution controls and batch notices using existing data/command paths; preserve implemented draft broadcast/clear work | Normal batch controls present; settlement parity incomplete |
| W7 | `src/lib/components/Entity/ownership/OwnershipWorkspacePanel.svelte`, `OwnershipPanel.svelte`, `ownership-flow.ts` | Share balances/release, eligible takeover selection, status refresh, proposal and activation controls through the existing helper functions | Read projection only |
| W8 | `src/lib/components/Entity/assets/DebtPanel.svelte`; retained assets and activity panels | Close missing debt/dispute drill-downs and actions; verify full asset/Account history navigation and filters | React portfolio/health/activity present |
| W9 | `src/lib/components/Entity/payments/PaymentPanel.svelte`, `ReceivePanel.svelte`; `swap/SwapPanel.svelte` | Preserve existing send/receive/invoice/quote/order/cancel behavior; close any missing retained cross-jurisdiction selection and interaction | Substantial React implementation; needs parity verification |
| W10 | `src/lib/components/Entity/workspace/shell/EntitySettingsProjectionPanel.svelte`; retained wallet settings/recovery children | Complete reachable settings subviews, profile editing, lock/unlock and recovery interactions with the existing vault lifecycle | Partial; verify through user controls |

## Ops workspace parity ledger

`src/lib/view/DockRoot.svelte` is the panel registry and behavior reference.
There are 14 default panel IDs plus dynamic `entity-panel` and `brainvault`
components. Preserve IDs used by the stored layout and panel-opening events.

| ID | Existing source, under `frontend/` | Required React consumer | Current state |
|---|---|---|---|
| O1 | `src/routes/embed/+page.svelte`; `src/lib/view/View.svelte`; `DockRoot.svelte` | Workspace host, Dockview registry, sidebar, layout restore/reset, pinned wallet tab, dynamic Entity panels and panel focus events | Internal dock host mounts Entity/Gossip/Solvency/Runtime Diagnostics; full registry and local/scenario contexts remain |
| O2 | `src/lib/view/panels/graph3d/Graph3DPanel.svelte` and its viewport/controls; `src/lib/view/core/TimeMachine.svelte` | Mounted Graph3D, Entity/Account interaction, hover, camera controls, pointer/XR controls, timeline/playback/captions and cleanup | Modules extracted; React consumer missing |
| O3 | `src/lib/view/UserModePanel.svelte`; `panels/wrappers/EntityPanelWrapper.svelte` | `wallet-main` and dynamic `entity-panel`; reuse the W1–W10 feature components with explicit workspace context | Internal Entity read page partial |
| O4 | `src/lib/view/panels/GossipPanel.svelte`, `solvency/SolvencyPanel.svelte`, `DockEntityAuditPanel.svelte`, `RuntimeDiagnosticsPanel.svelte` | `gossip`, `solvency`, `entity-audit`, `runtime-diagnostics`, including filters, expansion, links, refresh and export where retained | Gossip, Solvency and Runtime Diagnostics mounted against the existing remote session; Entity Audit, local incident details and local integration remain |
| O5 | `src/lib/view/panels/ConsolePanel.svelte`, `RuntimeIOPanel.svelte` | `console`, `runtime-io`: frame logs, filters, copy/export, console command history/completion and existing commands | Models extracted |
| O6 | `src/lib/view/panels/ArchitectPanel.svelte`, `JurisdictionPanel.svelte`, `JMachineInspectorPanel.svelte` | `architect`, `jurisdiction`, `jmachine-inspector`: existing configuration/scenario/inspection controls, including bytecode read | Models partly extracted |
| O7 | `src/lib/view/panels/SettingsPanel.svelte`; `src/lib/components/Runtime/RemoteRuntimeManager.svelte` | `settings`, `runtime-manager`: preferences plus attach/bulk-attach/retry and selection | Settings partial; full panels missing |
| O8 | `src/lib/components/Settings/IndexedDbInspector.svelte`; `src/lib/components/Views/RuntimeCreation.svelte` | `leveldb-inspector` database/store selection, paging/search; `brainvault` existing creation/recovery entry | React wallet identity exists; dock consumers missing |
| O9 | `src/lib/components/shared/CommandPalette.svelte`, `command-palette-view.ts`; `src/lib/i18n/index.ts` and locale catalogs | Existing keyboard commands, focus/escape behavior, translations and persisted locale selection in wallet/ops | Retained Svelte consumers |
| O10 | Existing React `/health`, `/qa`, `/qa/hlt`, `/qa/quorum`, `/runs`, `/scenarios`, `/ai` routes | Regression verification after shared integration, including links into the workspace | Implemented; retain |

The exact default IDs are `graph3d`, `wallet-main`, `architect`, `jurisdiction`,
`runtime-io`, `settings`, `console`, `gossip`, `solvency`, `entity-audit`,
`jmachine-inspector`, `runtime-manager`, `leveldb-inspector`,
`runtime-diagnostics`. This count is not a completion metric. Dynamic registry
components `entity-panel` and `brainvault` also need real consumers.

## Execution order

### Implementation checkpoint — 2026-09-05

The internal Entity workspace route now mounts `workspace/ops-workspace.tsx`
with real Entity, Gossip and Solvency panels. The new panel readers share the
existing Runtime connection, subscribe to changes and dispose on close or
session release. Gossip includes filtering, canonical avatars, address links
and copy feedback; Solvency renders the existing adapter result without new
calculations. The Entity view retains its existing history/navigation behavior.

This is a partial host: `/embed`, the 14-panel default registry, local/scenario
contexts, dynamic Entity selection and Graph3D are still open. Persistent
layout writes are disabled in this internal three-panel host so it cannot
overwrite the user's complete canonical layout. Enable the established layout
session when the full registry and restore behavior are implemented.

The browser fixture now exposes its live RPC connection count for teardown
evidence. This is test-only instrumentation, not a Runtime API extension.
Cold-load Vite dependency invalidation was reproduced and corrected with
explicit prebundling of the workspace/owner-session dependencies.

Checkpoint evidence:

- 38 focused tests, 213 assertions across eight files pass
  (`/tmp/xln-ops-dock-unit-final.log`).
- Full ops browser matrix: 39/39 pass in 41.9 seconds, including six new
  panel cases across 390×844, 1366×900 and 1920×1080. New cases assert search,
  copy, exact address links, real reserve/collateral values, repeated close/
  reopen, one shared connection and server-observed teardown. Log:
  `/tmp/xln-ops-dock-matrix-final.log`.
- Twelve panel screenshots under `output/playwright/react-ops/test-results`
  reviewed: 8/10 for each mobile, laptop and wide set. Labels/controls are
  legible and contained; overflowing panel content scrolls inside the dock.
  The existing Entity screen still needs its remaining feature ports.
- All four React checks/builds pass. Build log:
  `/tmp/xln-ops-dock-build.log`. Existing large-chunk warnings remain.
- Root `bun run check`: 26 tests / 100,156 assertions, contract sync and ten
  soundcheck gates pass, then the Rust gate stops at missing `cargo` (127).
  Later checks did not run. Log: `/tmp/xln-ops-dock-root.log`.

Next implementation: complete the existing onboarding/selection controls and
extend the host with the remaining real panels and local/scenario contexts.
The new query observer is reusable for the remaining adapter-backed panels;
it must not become a substitute for the missing local/scenario context.

### Runtime Diagnostics checkpoint — 2026-09-05

The internal dock now also mounts
`apps/ops/src/workspace/ops-runtime-diagnostics-panel.tsx`. Its storage head,
checkpoint and 40-entry timeline reads reuse the existing query client and
shared Runtime session. Refresh and `verify-chain` call the retained adapter
paths. Verification results are bound to that session; closing the panel or
changing the Runtime discards pending results. The panel preserves full
verification JSON with canonical BigInt-safe serialization.

The current host is remote-only. Incident details belong to the retained local
Runtime infrastructure and are not exported by the existing remote reads;
the panel explicitly says they are unavailable instead of claiming a clear
security status. Local incident rendering remains part of O1/O4 integration.
No Runtime API or backend/storage implementation changed.

- 49 focused diagnostics/query/source tests pass, 418 assertions across four
  files: `/tmp/xln-ops-diagnostics-unit.log`.
- The focused laptop panel flow passes 3/3, then the full ops matrix passes
  42/42 in 46.0 seconds across all three viewports:
  `/tmp/xln-ops-diagnostics-browser-l1.log`,
  `/tmp/xln-ops-diagnostics-browser-matrix.log`. The new flow verifies real
  persisted frames, a successful storage integrity result with checked frames,
  refresh, close/reopen state reset, one shared connection and server-observed
  teardown. Unavailable Runtime state disables verification.
- Six timeline/verification screenshots under
  `output/playwright/react-ops/test-results` were inspected: 8/10 for each
  mobile, laptop and wide set. The timeline scrolls within the dock and the
  complete result remains readable on mobile.
- All four React checks plus tooling and all four builds pass; unsafe-type
  scan: 722 files, zero findings. Logs:
  `/tmp/xln-ops-diagnostics-react-final.log`,
  `/tmp/xln-ops-diagnostics-build-final.log`. Large-chunk warnings remain.
- Root `bun run check` passes 26 tests / 100,156 assertions, contract sync
  and ten soundchecks, then stops at missing `cargo` (127). Later gates did
  not run: `/tmp/xln-ops-diagnostics-root-final.log`. No core, contract or
  frozen-core changes remain in the worktree.

The four-panel host is still internal. `/embed`, the complete registry,
local/scenario contexts, Entity Audit and the other listed consumers remain
open. The existing full-layout storage remains untouched.

### Onboarding preparation checkpoint — 2026-09-05

The retained onboarding implementation now shares five frontend modules under
`frontend/src/lib/components/Entity/onboarding/`:

- `onboarding-runtime-projection.ts`: the same committed Entity/signers,
  jurisdiction, profile-role and counterparty projection formerly inside
  `UserModePanel.svelte`; the retained parent now calls this function.
- `onboarding-targets.ts` and `onboarding-hub-discovery.ts`: existing target
  resolution, public-response validation, jurisdiction matching and role
  evidence checks. Explicit committed `false` still rejects stale Hub claims.
- `onboarding-hub-join.ts`: existing discovery request, timeout, selection and
  sequential Account-opening commands, with live projection getters supplied
  by the caller. Credit and rebalance behavior is unchanged.
- `onboarding-setup.ts`: existing profile → recovery → hub join → completion
  ordering and preferences. `OnboardingPanel.svelte` delegates to this helper
  and retains its form, validation, recovery controls and visible errors.

This extraction checkpoint preceded the rendered React form described below
and did not close W2. It established the shared helpers and the retained
`requiresOnboarding` and completed-sibling rules used by the next increment.

Verification for this extraction:

- 218 targeted onboarding/recovery tests pass, 911 assertions across 29 files:
  `/tmp/xln-onboarding-extraction-targeted-final.log`. A previously missing
  recovery-failure test selector was added to the existing error labels; the
  assertion was retained.
- Svelte check reports zero errors/warnings. Its config loader still logs
  discovery messages about the React Vite configs lacking Svelte plugins:
  `/tmp/xln-onboarding-extraction-svelte-final2.log`.
- Wallet React/tooling checks pass:
  `/tmp/xln-onboarding-extraction-react.log`. The final unsafe-type scan reports
  718 files and zero findings:
  `/tmp/xln-onboarding-extraction-unsafe-final.log`.
- A normalized source comparison confirms 29 moved function bodies and the
  projection/setup statement sequences match the retained implementation:
  `/tmp/xln-onboarding-extraction-equivalence.log`. This is extraction evidence,
  not a substitute for the future React browser-flow checks.
- No visible behavior changed; no new browser/screenshot evidence is claimed
  for this increment.
- Root `bun run check`: the sandboxed run could not acquire Hardhat's cache
  lock. The run outside the sandbox passed 26 tests / 100,156 assertions,
  contract artifact sync and all ten soundchecks, then stopped at missing
  `cargo` (127). Later gates did not run:
  `/tmp/xln-onboarding-extraction-root-final.log`. No core, contract-source,
  generated contract-artifact or frozen-core changes remain in the worktree.

### React post-creation form checkpoint — 2026-09-05

`apps/wallet/src/wallet-onboarding.tsx` now mounts after identity opening and
resumes for an incomplete local wallet when returning to Identity. The form
uses the shared setup/projection/hub commands through
`bridges/wallet-canonical-onboarding.ts`; it commits the existing profile
command, saves collateral/jurisdiction preferences and recovery-service drafts,
and marks completion only after the shared sequence succeeds. Choosing manual
setup completes with zero automatic hub joins; it is not a manual Hub Discovery
screen. Already-completed and demo wallets retain their existing bypass rules.

Commands are bound to the current Runtime/Entity and abort on unmount. Pending
setup gates other wallet screens; completion releases the gate and the
“Continue to assets” link uses in-app navigation. No new backend API, financial
calculation, custody rule or persistence schema was introduced.

Evidence for this increment:

- 225 focused onboarding/recovery/tooling tests pass, 1,134 assertions across
  31 files: `/tmp/xln-onboarding-form-unit-final.log`.
- Full wallet browser matrix: 57/57 pass in 2.3 minutes across 390×844,
  1366×900 and 1920×1080: `/tmp/xln-onboarding-wallet-matrix-final.log`.
  The new flow verifies jurisdiction/terms validation, recovery draft saving,
  a visible discovery error without completion, route gating/resume, manual
  completion and the committed public name in Assets. Existing recovery,
  transfer, deposit, settlement and navigation assertions remain in the suite.
- History assertions now follow the existing pagination to the original
  expected events instead of assuming they remain on page one after other
  real transactions. Eight focused history/settlement cases pass:
  `/tmp/xln-onboarding-history.log`.
- Twelve profile/advanced/error/completion screenshots were inspected across
  the three viewports: 8/10 per set, with contained fields and readable labels.
  A fixed-nav overlap in the mobile full-page error capture prompted a focused
  viewport check: the complete error is readable above navigation after
  scrolling. All three focused cases pass in 30.2 seconds:
  `/tmp/xln-onboarding-visual-final.log`; screenshot evidence is under
  `output/playwright/react-onboarding-visual/test-results`.
- All four React checks plus tooling and all four builds pass:
  `/tmp/xln-onboarding-react-final2.log`,
  `/tmp/xln-onboarding-build-final.log`. Unsafe-type scan: 721 files, zero
  findings. Existing large-chunk build warnings remain.
- Root `bun run check`: 26 tests / 100,156 assertions, contract sync and all
  ten soundchecks pass, then missing `cargo` stops the Rust gate (127).
  Later gates did not run: `/tmp/xln-onboarding-form-root.log`. No core,
  contract-source/generated-artifact or frozen-core changes remain.

W2 is still open: the fixture's real relay has no public Hub HTTP endpoint, so
the browser flow proves failed automatic discovery and successful manual
completion, not a successful automatic join. The current public Hub response
also lacks the `roleSource` expected by the existing strict frontend decoder;
do not invent role evidence or change that backend contract in this UI port.
At this checkpoint Formation/manual Hub Discovery consumers and full persisted-Runtime reload
parity remained unverified; the Formation increment follows below. The isolated relay also lacks the jurisdiction HTTP
endpoint required by a cold reload; in-app navigation is covered separately.

### Formation checkpoint — 2026-09-05

Assets now opens a React Create Entity form with jurisdiction, numbered/lazy
identity, personal/shared board, ordered members, weights, threshold and the
existing canonical lazy-ID preview. The retained Svelte command sequence and
Runtime projection are shared by both renderers. Numbered registration and
lazy import still use their existing commands; no backend or board algorithm
was introduced. The bridge checks the selected Runtime, signer and vault
authority at asynchronous boundaries and releases subscriptions on unmount.

The real BrowserVM flow creates a numbered Entity, rejects an existing lazy
board, rejects an invalid member, then creates a two-member weighted lazy
Entity. Its preview equals the committed ID and the new Entity is selectable
in Assets. Mobile error bounds are checked above the fixed navigation.

- Focused onboarding/Formation/portfolio/tooling checks: 219 tests pass,
  1,127 assertions, 31 files: `/tmp/xln-formation-unit-final2.log`.
- Formation plus onboarding browser flows: 6/6 pass across all viewports:
  `/tmp/xln-formation-browser-l2.log`. The final mobile Formation/recovery
  checks pass 2/2 in 16.6 seconds: `/tmp/xln-formation-browser-l1-final.log`.
- Final full wallet matrix on stable artifacts: 60/60 pass in 2.7 minutes:
  `/tmp/xln-formation-browser-matrix-stable.log`. Existing recovery, payments,
  settlement and history assertions remain. Twelve Formation screenshots
  plus the mobile duplicate-error viewport were inspected across 390×844,
  1366×900 and 1920×1080: 8/10 per viewport, readable controls and errors,
  contained fields. Evidence: `output/playwright/react-wallet/test-results`.
- All four React checks and tooling pass; 726 files, zero unsafe findings:
  `/tmp/xln-formation-react-final.log`. Svelte reports zero errors/warnings:
  `/tmp/xln-formation-svelte-final.log`.
- All four builds pass: `/tmp/xln-formation-build-final.log`. Final wallet
  copy passes its own check/build in `/tmp/xln-formation-react-wallet-final2.log`
  and `/tmp/xln-formation-build-wallet-final2.log`; existing chunk warnings remain.
- Root check passes 26 tests / 100,156 assertions, contract sync and ten
  soundchecks, then stops on missing `cargo` (127); later gates did not run:
  `/tmp/xln-formation-root-final.log`.

The first full matrix recorded 59 passes and one mobile recovery timeout while
root contract regeneration caused repeated Vite hot updates. Its trace is
preserved at `output/playwright/react-formation-hot-update-failure/trace.zip`.
The unchanged recovery assertion passed once artifact writes finished; run
artifact-producing checks and builds before browser tests, never concurrently.
The subsequent full matrix above passes without changing that assertion or
its timeout. This evidence does not establish general hot-reload correctness.

Formation remains partial for remote-owner and cold-reload integration: this
bridge requires the matching vault and canonical Runtime projection. A remote
read session alone does not establish that binding. Successful automatic hub
joining and the manual Hub Discovery consumer remain separate W2 work.

### Manual Hub Discovery checkpoint — 2026-09-05

Assets → Open Account now mounts the React Hub Discovery list with existing
jurisdiction/role filtering, connection state, expand/hide, details, raw profile,
refresh, Connect and return navigation. React and Svelte share the retained
command sequence, including profile readiness, fresh context/role checks,
existing credit/rebalance inputs and signer selection. React uses the existing
command identity/retry path and releases observers on unmount.

The real browser flow restores a separate two-signer backup, selects its source
Entity, connects to its Hub, observes the committed Account, refreshes, returns
to Assets and reopens discovery with the Account still open. The remote flow
uses the selected Runtime and sees its already-open Account. Remote command
submission and cold reload are not proven by these read checks.

Two concrete projection defects were exposed and corrected within frontend:

- The retained connection helper rejected canonical persistent Account maps
  because they are not native `Map` instances. It now uses their existing
  read interface, so committed Accounts display Open.
- Entity summaries do not contain full Hub metadata. Expanded React cards now
  read the existing bounded `view-frame` for that Hub and show its configured
  fee, total Account count, profile and real Entity timestamp. Details load on
  expansion; an advertised Entity without a hosted detail projection is labelled
  unavailable. Summary zeros and frame heights are no longer presented as fees,
  peer counts or dates. No backend endpoint was added.

Verification on this increment:

- 229 tests pass, 1,186 assertions across 32 onboarding/payment/portfolio/tooling
  files: `/tmp/xln-hub-discovery-unit-details-final.log`.
- Initial local/remote flows pass 6/6 across all three viewports:
  `/tmp/xln-hub-discovery-browser-l2.log`. After the metadata correction, both
  laptop flows pass 2/2 in 12.3 seconds, including exact fee/count assertions:
  `/tmp/xln-hub-discovery-details-browser-l1.log`.
- Hub Discovery followed by the existing onboarding case passes 3/3 on mobile
  after isolating the Hub recovery tower:
  `/tmp/xln-hub-discovery-isolation-browser-l1.log`. The extra viewport capture
  verifies the full remote Runtime ID stays above mobile navigation.
- Final full wallet matrix on stable artifacts passes **66/66 in 3.2 minutes**:
  `/tmp/xln-hub-discovery-browser-matrix-stable.log`. Nine local/remote Hub
  screenshots plus the mobile detail viewport were inspected across 390×844,
  1366×900 and 1920×1080: 8/10 per viewport. Controls and IDs are contained;
  the viewport capture verifies details above the fixed mobile navigation,
  which can overlay the middle of a full-page screenshot during capture.
  Current evidence: `output/playwright/react-wallet/test-results`.
- All four React checks plus tooling pass; final wallet check scans 729 files
  with zero unsafe findings: `/tmp/xln-hub-discovery-react-final3.log`,
  `/tmp/xln-hub-discovery-wallet-details-check.log`. Svelte reports zero errors
  and warnings: `/tmp/xln-hub-discovery-svelte-final.log`.
- All four builds pass (site 0.782 s, docs 0.328 s, wallet 2.11 s, ops 2.02 s):
  `/tmp/xln-hub-discovery-build-final.log`. Final wallet build also passes in
  2.14 s after preserving advertised Runtime IDs from Entity summaries:
  `/tmp/xln-hub-discovery-build-wallet-final2.log`. Existing chunk warnings remain.
- Latest root check passes 26 tests / 100,156 assertions, contract sync and
  ten soundchecks, then stops on missing `cargo` (127):
  `/tmp/xln-hub-discovery-root-outside-final.log`. Later root gates did not run.
  The initial sandboxed run stopped at a Hardhat compiler-cache mutex timeout
  (`/tmp/xln-hub-discovery-root-final.log`); rerunning with cache access passed
  that step. Root verification remains incomplete.

Fixture investigation stayed outside protocol implementation. An initial
weighted single-validator fixture imported its Entity but did not commit its
Hub profile; a numbered fixture rejected the profile command with
`ENTITY_COMMAND_CERTIFIED_BOARD_REQUIRED`. These are isolated setup results,
not general protocol verdicts. Logs are
`/tmp/xln-hub-discovery-fixture-l1b.log` and
`/tmp/xln-hub-discovery-fixture-numbered2.log`; the first preserves full public
Runtime state at `/tmp/xln-hub-discovery-fixture-state.json`. The passing fixture
uses the existing two-signer vault topology and real committed commands, with
a separate backup and a separate real tower. The first full wallet matrix was
63 pass / 3 fail: opening the Hub backup uploaded a newer appointment to the
shared tower under the same mnemonic lookup key, so subsequent ordinary
onboarding saw two Entities. Separating that tower resolves the exact sequence
without changing the original onboarding assertions or test order. Failure
traces are preserved at `output/playwright/react-hub-discovery-fixture-failure`;
the initial matrix log is `/tmp/xln-hub-discovery-browser-matrix-final.log`.

At that checkpoint the next UI ports were direct Open Account by Entity ID and the retained Account
workspace/configuration controls, alongside the remaining real ops panels.
W2/W3 remain partial; automatic joining, remote-owner integration and cold
reload still need their own evidence.

### Direct Account opening checkpoint — 2026-09-05

The Open Account page now composes Hub Discovery with the retained direct
Recipient selector and Open action. The selector shares its parser with
Svelte `EntityInput`: full IDs, invoice suffixes, names, short IDs and numbered
IDs keep their existing resolution precedence. Known options exclude the
source Entity and existing Accounts. The selected full ID remains readable
below the input; invalid/unresolved input cannot fabricate a recipient.

React and Svelte share `account/account-open-commands.ts`, extracted from
`EntityPanelTabs.svelte`. The same full-ID, self, jurisdiction, duplicate and
LIVE checks precede the existing `buildDirectOpenAccountRuntimeInput`. Both
roles must come from committed Entity profiles. Runtime/Entity/signer and
roles are reread after profile warmup. Remote reads select the exact Account
and load the target's committed view at the source frame height. Commands use
the existing submission/identity/retry path; pending errors survive input
changes, while outdated validation messages clear when the recipient changes.

`#accounts/open` and its retained `#accounts` alias now open this form in the
React wallet. Assets → Open Account and Back use wallet navigation, preserving
the selected Entity through browser back/forward. This is in-app navigation
evidence, not cold Runtime reload parity.

- L1 local/remote direct flows: 2/2 pass on laptop in 10.7 seconds:
  `/tmp/xln-direct-account-browser-l1.log`.
- Direct opening plus Hub Discovery: 12/12 pass across all three viewports in
  1.1 minutes: `/tmp/xln-direct-account-browser-l2.log`. A screenshot exposed
  an outdated validation message after changing recipients; after correction,
  both mobile flows pass 2/2 in 13.6 seconds, including error placement above
  navigation: `/tmp/xln-direct-account-browser-l1-final.log`.
- Final full wallet matrix passes **72/72 in 3.7 minutes** on stable artifacts:
  `/tmp/xln-direct-account-browser-matrix-final.log`. All 16 direct-opening
  screenshots were inspected: self rejection, recipient picker, resolved ID,
  committed/duplicate state and remote existing Account across mobile
  390×844, laptop 1366×900 and wide desktop 1920×1080, plus the mobile error
  viewport. Visual review: 8/10 at each size; readable IDs and errors, contained
  picker, consistent controls, no visible clipping or navigation overlap in
  the viewport evidence. Browser console/page-error assertions pass.
- Focused onboarding/parser/options/navigation/portfolio/tooling checks:
  254 tests pass, 1,305 assertions, 35 files:
  `/tmp/xln-direct-account-unit-final2.log`.
- Four React apps plus tooling pass; final wallet check scans 734 files with
  zero unsafe findings: `/tmp/xln-direct-account-react-final.log`,
  `/tmp/xln-direct-account-react-wallet-final.log`. Svelte reports zero errors
  and warnings: `/tmp/xln-direct-account-svelte-final.log`.
- Four builds pass (site 0.769 s, docs 0.348 s, wallet 2.13 s, ops 1.98 s):
  `/tmp/xln-direct-account-build-final.log`; existing chunk warnings remain.
- Root check passes 26 tests / 100,156 assertions, contract sync and ten
  soundchecks, then stops on missing `cargo` (127):
  `/tmp/xln-direct-account-root-final.log`. Later root gates did not run.

The browser's local flow opens a real Account after rejecting malformed IDs,
self and missing committed role evidence. It verifies picker/short-ID
resolution, duplicate detection and back/forward state. Remote coverage proves
self rejection and detection of an already-open Account; it does not prove
remote-owner mutation. No Runtime, contract, financial formula or custody
change was introduced.

At the direct-opening checkpoint, the disputed Account entry list and its
focused view were still unmounted. The focused-view checkpoint below mounts
both; the Account rail and configuration/appearance/activity parity remain
open. W3 is still incomplete.

### Focused Account view checkpoint — 2026-09-05

Assets → View Account now mounts `wallet-account-view.tsx`, reading the selected
local Account or the exact remote Account through the existing view-frame API.
The selected Entity's canonical `buildAccountTokenDetails`/`deriveDelta`
projection supplies capacity, credit components, collateral, hold deductions,
delta, offdelta and ondelta. Token details expand/collapse independently.

Svelte and React now share `account-focused-view.ts` and
`account-activity-presentation.ts`: observed on-chain deadlines use Unix
seconds; pending secret-ACK status, draft/mempool/optional-history rows,
status/type filters and transaction parameter formatting retain their source
behavior. This preserves the optional `frameHistory` limitation; it does not
provide a new persisted Account history reader or claim history parity.

The faucet HTTP request is extracted into `account-faucet-command.ts` and
consumed by both UIs. It retains amounts, the three-second timeout, readiness,
jurisdiction and live-Runtime-id guards, with abort cleanup at the React
lifecycle boundary. `UserModePanel.svelte` supplies no live env in remote mode;
the React bridge preserves the resulting missing-Runtime-id rejection before
HTTP. No remote faucet capability has been added. Local faucet acceptance and
committed funding still need browser evidence against an isolated real service.

The Open Account page now renders retained active/finalized disputed entries.
Active entries open the focused view; finalized entries have no Open action.
Navigation uses the retained `openDisputedAccountNavigation`,
`selectAccountNavigation` and `returnToAccountsWorkspace` helpers. Back reaches
the existing `#accounts/activity` consumer; the disputed view's workspace
action returns to `#accounts/open`. Full Entity/Account/token selection across
the separate consumers, the Account rail/dropdown and the retained Entity
Activity presentation remain open. A real live dispute transition has not yet
verified the new disputed-entry action.

- Focused unit/projection/navigation/tooling suite: **64 pass**, 639 assertions,
  11 files: `/tmp/xln-account-view-unit-final.log`. The three new tests cover
  deadline units/rounding, large BigInt display and pre-HTTP faucet guards.
- Focused laptop browser: **2/2 in 14.2 seconds**, after explicit Status/Action
  labels corrected the initial selector failure:
  `/tmp/xln-account-view-browser-l1-label.log`.
- Focused plus direct-opening flows: **12/12 in 1.2 minutes**, across mobile,
  laptop and wide desktop: `/tmp/xln-account-view-browser-l2.log`. Both remote
  Account perspectives compare capacity and credit against the existing
  portfolio projection; the local case opens a real Account through Hub Connect.
- Final full wallet matrix: **78/78 in 4.4 minutes**:
  `/tmp/xln-account-view-browser-matrix-final.log`. This includes the preserved
  remote faucet guard and mobile details-table viewport bounds. Matrix
  artifacts are retained at `output/playwright/react-account-view-matrix`.
  Screenshot review then found an unstyled View Account button. Applying the
  existing wallet button class was the only subsequent UI change; the rebuilt
  portfolio flow passes **3/3 in 4.9 seconds** across all three viewports:
  `/tmp/xln-account-view-browser-button.log`.
- All **16 screenshots** were inspected: 13 focused Account states covering
  summary, expanded details, both perspectives, local opening and a mobile
  viewport, plus the three corrected portfolio views. Visual review: **8/10**
  at mobile 390×844, laptop 1366×900 and wide desktop 1920×1080. IDs and tables
  are readable, controls are consistent, and the mobile viewport proves the
  expanded table clears fixed navigation. Console/page-error assertions pass.
  The installed Playwright required Chromium revision 1234, absent from the
  shared cache; matching binaries were installed under
  `/tmp/xln-account-view-browsers`. No dependency changes or live-stack restart
  were needed. The earlier missing-browser attempt failed before UI launch.
- Svelte reports **zero errors/warnings**:
  `/tmp/xln-account-view-svelte-final.log`. Four React apps plus tooling pass;
  the check scans 742 files with zero unsafe findings:
  `/tmp/xln-account-view-react-stable.log`.
- Final builds after button styling: **4/4 pass** (site 0.837 s, docs 0.327 s,
  wallet 2.24 s, ops 2.20 s): `/tmp/xln-account-view-build-button.log`.
  Existing chunk warnings remain.
- Root check again passes 26 tests / 100,156 assertions, contract sync and ten
  soundchecks, then stops on missing `cargo` (127):
  `/tmp/xln-account-view-root-final2.log`. Later root gates did not run.

At that checkpoint, capacity bars/skins and appearance settings were still
unmounted. The following checkpoint adds them; shared workspace selection/rail
and remaining configuration/activity consumers are still open. Do not close
W3 from focused-read tests.

### Account capacity bars and appearance checkpoint — 2026-09-05

The React focused Account now renders the retained Classic bar layout and
Apple skin. `delta-capacity-bar-model.ts`, `delta-apple-model.ts` and
`delta-token-format.ts` extract the existing display geometry/rounding and are
consumed by Svelte and React. Financial capacities still come from
`buildAccountTokenDetails`/`deriveDelta`; USD hints retain `buildTokenVisualScale`
and existing indicative prices. No new financial formula or price source was
introduced. Detail tables now use the retained number-only formatting.

`#accounts/appearance` mounts the existing layout, skin, five Apple styles,
scale and six effect controls. The port uses the existing framework-neutral
settings store and persistence operations. It reloads stored preferences
before a write to preserve keys written by other preferences consumers.
Appearance is reachable from Assets and the focused Account, and the focused
Entity/Account survives the in-page round trip. Reload restores preferences;
this does not claim full Account-selection reload parity.

Classic bars support keyboard expansion, the retained credit fade and smooth
resize, sweep, glow, ripple and delta flash. Effects start from committed
capacity changes, and timers are cleaned up at the React lifecycle boundary.
Apple retains Hairline, Pips, Twin, Capsule and Thread plus its expanded
credit/collateral/hold summary. The focused Account's Faucet stays reachable
under either skin; its previously documented authority limitations remain.

- Narrow projection/navigation checks: **24 pass**, 79 assertions, three files:
  `/tmp/xln-account-appearance-unit-l1.log`. The affected flow/tooling suite:
  **43 pass**, 398 assertions, seven files:
  `/tmp/xln-account-appearance-unit-l2.log`.
  Final suite including browser-scope checks: **47 pass**, 418 assertions,
  eight files: `/tmp/xln-account-appearance-unit-final.log`.
- The initial browser attempt found an implicit-label selector problem at
  Bar style; explicit label association fixes it. The same laptop flow passes
  **1/1 in 8.9 seconds**: `/tmp/xln-account-appearance-browser-l1-label.log`.
  The failure trace remains in `output/playwright/react-account-appearance-l1-failure`.
- A separate real one-unit direct payment between isolated test Accounts
  produces the expected `-1` capacity flash and effect cleanup: **1/1 in
  8.7 seconds**, `/tmp/xln-account-appearance-browser-l1-animation.log`.
- Focused appearance plus Account reads pass **12/12 in 1.2 minutes** across
  all three viewports: `/tmp/xln-account-appearance-browser-l2.log`. This
  includes live sweep/glow/ripple activation, expiration, both perspectives,
  local Account opening, every style, all preference controls and reload.
- Full wallet matrix: **83 pass / 1 fail in 5.0 minutes**:
  `/tmp/xln-account-appearance-browser-matrix.log`. All new appearance and
  focused Account cases pass. The existing laptop market/activity test exposes
  the persisted-history pagination defect described below; the matrix is not
  green. Results, HTML report and failure trace are preserved in
  `output/playwright/react-account-appearance-matrix`.
- All **50 affected screenshots** inspected: 34 appearance/effect captures,
  13 focused Account captures and three portfolio captures. Mobile 390×844,
  laptop 1366×900 and wide 1920×1080 each score **8/10** for this increment.
  No clipping or unusable controls found. Actual mobile viewport captures
  confirm expanded details and effects remain clear of fixed navigation;
  tall full-page captures contain the known fixed-navigation stitching effect.
  The visible remote Faucet rejection is the expected retained error case,
  not successful faucet funding. Browser error assertions pass in these flows.
- Four-app React checks plus tooling pass: **751 files, zero unsafe-type
  findings**. Svelte reports **zero diagnostic errors/warnings**:
  `/tmp/xln-account-appearance-react-stable.log`,
  `/tmp/xln-account-appearance-svelte-l1.log`. The Svelte scanner also prints
  its existing configuration messages for the separate React Vite roots.
- Final all-app builds: **4/4 pass** (site 0.885 s, docs 0.369 s, wallet
  2.40 s, ops 2.46 s): `/tmp/xln-account-appearance-build-final.log`.
  Existing chunk-size warnings remain.
- Root check passes 26 tests / 100,156 assertions, contract sync and ten
  soundchecks before missing `cargo` stops it at 127:
  `/tmp/xln-account-appearance-root.log`. Later gates did not run.

**Open backend dependency exposed by the full matrix:**
`wallet-transactions.spec.ts:55` follows Activity pages to the original
`Account opened` and `extendCredit` entries. In the laptop trace, the second
page returns 25 events across heights 24 through 6, with `AccountOpening` as
its last event and `nextBeforeHeight: 5`. The input-derived `Account opened`
event from frame 6 is absent. The next page returns heights 5 through 1 and
`nextBeforeHeight: null`, so the test reaches disabled Older before finding it.

The existing reader in `core/storage/queries/history.ts:576` scans complete
frames, then applies `.slice(0, limit)` at line 584 while returning the already
decremented frame cursor at line 599. When the event limit cuts a frame, the
remaining events in that frame become unreachable through Older. The wallet
uses the existing `limit: 25`/height cursor at
`frontend/apps/wallet/src/wallet-market-source.ts:248`; the retained event
mapping creates `Account opened` at `core/api/public/activity-history.ts:469`.
The new real-payment test changes fixture event counts and exposes this
existing boundary defect. No backend edit, larger-page workaround or weakened
assertion was made. Preserve the failure and localize its backend regression
before another broad rerun intended to close it; unrelated frontend ports can
continue. The trace is under the preserved matrix's
`test-results/wallet-transactions-wallet-0d020-book-and-persisted-activity-laptop-1366x900/trace.zip`.

W3 remains partial. Finish the Account rail/dropdown and Entity/Account/token
selection across workspace consumers, then the remaining configuration and
Entity Activity controls. Live disputed-entry navigation and positive local
faucet acceptance/commitment still need their own evidence.

### Account rail and shared wallet selection checkpoint — 2026-09-05

The wallet shell now owns one in-memory `WalletWorkspaceSelection`. Assets,
Health, Payments and Markets bind their existing read sources to it, so a
nondefault Entity survives route changes and browser back/forward. Changing
Runtime clears its selection; changing Entity clears Account focus. An explicit
Entity read rejects a projection for a different Entity. This UI context adds
no persistence, Runtime connection or command authority.

The React Account rail mounts the existing Open Account, Pay, Receive, Swap,
Activity and Appearance consumers at their retained hashes. Desktop links and
the mobile fold support keyboard activation, Escape and focus restoration.
Before an Account exists it exposes only Open Account. Shared tab metadata
preserves all ten retained tab IDs, labels and their order in Svelte. Move,
Lending, History and Manage remain unregistered until their actual React
consumers are ported; the six tabs do not close W3.

Focused Account selection also uses the shell context. Appearance/back retains
the focused counterparty, and returning to the workspace retains the Entity.
The remembered workspace Account is not yet connected to all action forms.
The Account dropdown/status, action-level token/jurisdiction selection and ops
context remain open. Send/Receive form state keeps its existing ownership.

Implementation: `frontend/apps/wallet/src/wallet-workspace-selection.ts`,
`wallet-account-rail.tsx`, `app-shell.tsx`, the four wallet read sources and
their React consumers; shared UI in
`frontend/packages/ui/src/account-workspace-rail.tsx` and tab metadata in
`frontend/packages/runtime-client/src/account-workspace-tabs.ts`.

**Verification of this increment:**

- Selection/navigation/read-source/payment/market/health/tooling checks:
  **73 pass, 304 assertions, ten files** in 434 ms:
  `/tmp/xln-account-rail-unit-final.log`. Unit coverage includes Runtime/Entity
  isolation, stable snapshots, unsubscribe, projection mismatch and empty rail.
- Real isolated browser flows: **6/6 pass** in 43.3 s for the new rail/context
  case and existing direct Account opening; **9/9 pass** in 14.8 s for existing
  canonical links, invoices, quote invalidation and committed payment Activity.
  Both runs cover 390×844, 1366×900 and 1920×1080, with browser-error and
  containment assertions. Logs: `/tmp/xln-account-rail-browser-l2.log` and
  `/tmp/xln-account-rail-browser-navigation.log`.
- All **38 affected screenshots inspected**, with each rated 8/10 for layout,
  visible states and focus presentation: 23 rail/opening and 15 navigation/
  payment images. Preserved under `output/playwright/react-account-rail-l2`
  and `output/playwright/react-account-rail-navigation`. Mobile checks include
  the expanded rail, Escape/focus return and error clearance above fixed nav.
- All four React apps plus tooling typecheck; **755 files, zero unsafe-type
  findings**: `/tmp/xln-account-rail-react-stable.log`. Svelte diagnostics:
  zero errors/warnings, with the existing React-root configuration messages:
  `/tmp/xln-account-rail-svelte.log`. All four builds pass:
  `/tmp/xln-account-rail-build.log`; wallet was rebuilt after final Health
  wiring in 2.63 s: `/tmp/xln-account-rail-build-wallet-final.log`.
- Root `bun run check`: **26 tests / 100,156 assertions**, contract sync and
  ten soundchecks pass, then missing `cargo` stops execution at 127:
  `/tmp/xln-account-rail-root-final.log`. Later gates did not run.

The last full wallet matrix remains the **83 pass / 1 fail** appearance run
above, before this increment. The registered wallet matrix now contains 87
cases; it has not been rerun in full. The backend Activity page-boundary defect
is still open. Passing targeted navigation/payment cases do not resolve it.
The historical ops result remains 42/42; ops was not rerun for this increment.

**Next at that checkpoint:** port `account/ui/AccountDropdown.svelte` and its
status/selection behavior into the wallet workspace, consuming the existing
shell selection. Connect selected Account/token/jurisdiction to the retained
forms as they are mounted; preserve each form's selection semantics. Verify
multiple counterparties, Entity and Runtime changes, deep links, focused-view
return and stale reads. Include rapid A → B → A selection while a read is in
flight; ordinary route tests do not prove that case. Then finish the four
remaining rail destinations and their existing actions. No new backend API is
part of this increment.

### Account dropdown checkpoint — 2026-09-05

Wallet Assets now mounts the retained Account dropdown when the Entity has
more than five Accounts. React and Svelte share the existing name/avatar,
status-label and pending-count presentation through
`frontend/src/lib/components/Entity/account/account-dropdown-model.ts`.
The React control preserves Account order and provides a scrollable list,
keyboard activation, Escape/focus return, outside-pointer dismissal and
close-on-focus-leave. Selection opens the existing exact focused Account view
through the shell's UI selection; Back to Entity returns to the same Entity.

`wallet-account-dropdown-source.ts` reuses the parent Runtime adapter. Remote
reads follow the existing 25-Account page cursors, rejecting repeated cursors,
duplicate Account identities and mismatched Entity/height pages. Reads abort
on teardown and check Runtime identity before publishing. Local reads use the
existing live replica bridge. The remote compact view retains its existing
status semantics; it does not expose the local pending mempool. No Runtime
API, financial formula or persistent UI field was added.

Implementation: `frontend/apps/wallet/src/wallet-account-dropdown.tsx`,
`wallet-account-dropdown-source.ts`, `wallet-portfolio.tsx`,
`frontend/bridges/wallet-canonical-hub-discovery.ts` and
`frontend/packages/ui/src/account-dropdown.tsx` / `account-dropdown.css`.
The candidate test registry and wallet flow inventory include the new flow.

**Verification of this increment:**

- Focused model, selection, navigation, Account read, observer and tooling
  checks: **58 pass / 221 assertions / nine files** in 264 ms:
  `/tmp/xln-account-dropdown-unit-final.log`. These include retained status
  precedence, pending-count formatting and the exact >5 threshold.
- Final combined browser run: **12/12 pass in 1.1 minutes**, covering the new
  dropdown plus the existing rail and focused Account cases at 390×844,
  1366×900 and 1920×1080: `/tmp/xln-account-dropdown-browser-final.log`.
  A real independent Runtime opens 26 Accounts; the case selects an Account
  beyond the portfolio's first 25-item page, checks READY labels, keyboard and
  outside dismissal, focused-view return, a one-Account Entity and restoration
  of the original Runtime. Existing local focused Account checks also pass.
  Console/page-error and containment assertions pass.
- All **29 screenshots inspected**, rated **8/10 at each viewport**: six
  dropdown, ten rail and thirteen focused Account captures. Artifacts:
  `output/playwright/react-account-dropdown-final`. The mobile expanded menu
  fits above the fixed navigation; its viewport screenshot and the focused
  details viewport verify legibility without full-page fixed-nav stitching.
- All four React apps plus tooling typecheck; **759 files / zero unsafe-type
  findings**: `/tmp/xln-account-dropdown-react-final.log`. Wallet/tooling were
  checked again after fixture isolation:
  `/tmp/xln-account-dropdown-react-isolation.log`. Svelte reports zero
  errors/warnings: `/tmp/xln-account-dropdown-svelte-stable.log`, with existing
  React-root configuration messages. All four builds pass: site 825 ms, docs
  349 ms, wallet 2.21 s, ops 2.07 s:
  `/tmp/xln-account-dropdown-build.log`. Existing chunk warnings remain.
- Final root `bun run check`: **26 tests / 100,156 assertions**, contract sync
  and ten soundchecks pass; missing `cargo` stops the next gate at 127:
  `/tmp/xln-account-dropdown-root-final.log`. Later gates did not run.

Two introduced fixture problems were corrected before that final run. A
static Runtime import initialized storage before `XLN_DB_PATH` was set,
causing a later frame-storage conflict. The helper now imports Runtime lazily
after configuration, and startup rejects an unexpected storage root. The
accidental test-only `frontend/db-tmp` directory had no open handles and was
moved intact to
`output/playwright/react-account-dropdown-fixture-startup-failure/db-tmp`;
`frontend/db-tmp` remains absent after the final run. Adding the new Entities
to the existing payment Runtime initially changed its default selection and
broke five existing cases. The dropdown now owns a separate real Runtime,
database namespace and BrowserVM behind the isolated test fixture's
`/dropdown-rpc`. Failure evidence is retained in
`output/playwright/react-account-dropdown-shared-fixture-failure`.
Existing rail assertions were preserved. The user's live stack was untouched.

The registered wallet matrix now has **90 cases**; the full 90-case matrix was
not run. Its latest full result remains the earlier **83 pass / 1 fail** with
the open backend Activity page-boundary defect. Ops remains at its historical
42/42 checkpoint and was not rerun here. Browser evidence proves READY
dropdowns; live pending/disputed transitions and a local 26-Account dropdown
are not claimed. W1/W3 remain partial.

**Next increment:** connect selected Account/token/jurisdiction to the existing
action forms and ops consumers, then mount Manage/Move/Lending/History with
their retained commands. Reuse the mounted dropdown and shared selection.
Verify rapid A → B → A selection while reads are in flight; ordinary Entity
switching and Runtime restoration do not prove that concurrency case.

### 1. Establish the mounted workspace context and routing foundation — W1/O1

Extend the existing `frontend/apps/ops/src/workspace/ops-workspace.tsx` and its
source/session boundary. Preserve `View.svelte` ownership of local, remote and
scenario/history context at an explicit frontend boundary. Use stable snapshots
and subscription cleanup, following `ops-entity-workspace-source.ts` and
`ops-entity-workspace.tsx`; use `useSyncExternalStore` for external state.

Wire the existing `WorkspaceDock` to real ported panels incrementally behind
the internal candidate route. Register panels as their implementations land;
do not create empty placeholder implementations for the registry. Keep the
public `/embed` switch for step 7. Extend wallet routing from
`apps/wallet/src/wallet-navigation-model.ts` using the canonical
`packages/runtime-client/src/entity-workspace-navigation.ts` and retained
Account navigation helper; do not invent route names.

**Verify:** existing `embed-boot-model`, `workspace-dock-layout`,
`account-workspace-navigation` and `entity-panel-routing` tests; add
`tests/frontend/ops/frontend-ops-workspace-session.test.ts` for selection,
stale responses, teardown and independent dock contexts. Then the ops local
typecheck. Expected: all affected tests pass, no cross-Runtime frame mixing.

### 2. Complete onboarding and user-facing identity/settings controls — W2/W10

The post-creation, Formation and manual Hub Discovery forms are mounted
(checkpoints above). Complete remote-owner integration and positive automatic
join/reload evidence using existing paths.
Preserve the second screen's ownership: it configures an existing identity and
must not derive a seed or create another Runtime.

Connect the existing vault unlock/lock UI for wallet and workspace consumers.
Call the established lifecycle, including matching-wallet validation,
protection, expiry and queued-command resume. `ops-entity-workspace-owner.ts`
only installs journal keys; exposing that helper as the whole unlock flow is
insufficient. Do not change vault policy or require a new custody design to
port an already-supported flow.

**Verify:** focused tests under `tests/frontend/onboarding/`, particularly
`onboarding-runtime-input.test.ts` and `frontend-wallet-identity-onboarding.test.ts`.
Extend `frontend/tests/react-candidate/wallet-onboarding.spec.ts` and add
`ops-owner-unlock.spec.ts`: complete via visible controls, reject a wrong
wallet, preserve locks/expiry, observe committed profile/join results. Fixture
setup may provision identities; the action under test may not inject keys.

### 3. Finish the Account workspace and existing action forms — W3–W6/W8/W9

Hub Discovery, direct Open by ID, focused Account details/activity,
capacity-bar skins/appearance controls and the disputed-entry action are
mounted (checkpoints above), along with the Account dropdown, six rail
destinations and shared wallet Entity selection. Reuse the dropdown and finish
selected Account/token/jurisdiction wiring across action forms and ops consumers.
Prove live disputed-entry navigation and local faucet funding. Connect the
remaining configuration and Entity Activity subviews below.

Port the remaining configure/move/lending/history/settlement forms and register
their real rail destinations, composing the current wallet payment, market and portfolio
features instead of replacing them. Trace handlers from the retained parents
to their existing frontend builders and submission functions. Share UI/models
between wallet and docked Entity panels only where both actually consume them;
do not import another app's bootstrap or start a second Runtime.

Preserve selected Account/token/jurisdiction across navigation, pending states,
confirmations, error reporting and refresh after commitment. Derive displays
through existing helpers, including `deriveDelta`; porting a form does not
authorize changing transaction semantics or financial math.

There is a known distinction to preserve: compact remote settlement reads do
not expose all fields used by local retained controls. Trace the canonical
local/remote behavior per action. Reuse an existing complete path where one
exists; preserve genuine canonical restrictions. Do not present incomplete
batch data as a full review or relabel a missing React action as intentionally
unavailable. Any unsatisfied parity dependency remains open in W6.

**Verify:** affected `tests/frontend/account/`, `move/`, `payments/`, `assets/`
tests first. Extend `wallet-account-dropdown.spec.ts` and
`wallet-account-rail.spec.ts` for action context/deep links and
add `wallet-account-workspace.spec.ts` for configuration; extend `wallet-settlement.spec.ts` and
`wallet-transactions.spec.ts` for the newly ported actions. Use real isolated
Runtime/BrowserVM state; assert command submission and the corresponding
committed result, cancellation and rejection, not only a success message.

### 4. Port Ownership and finish shared Entity controls — W7/O3

Implement a React Ownership panel and frontend command adapter using
`src/lib/components/Entity/ownership/ownership-flow.ts` unchanged. Preserve
eligible targets, active/live checks, current/proposed board status and
activation timing from the retained workspace. Mount the completed shared
Entity features in wallet and the dock registry with their own selected
contexts. Reuse existing asset/activity/consensus reads.

**Verify:** `tests/frontend/workspace/entity-workspace-ownership.test.ts` plus
a new `frontend/tests/react-candidate/wallet-ownership.spec.ts` using isolated
real state. Cover selection, restricted states, refresh and the retained
actions; retain protocol checks in existing code. Do not alter consensus or
contracts to make a UI test convenient.

### 5. Port the remaining dock panels — O4–O8

Create app-owned React panels under `apps/ops/src/workspace/`. Reuse
`packages/runtime-client/src/{gossip,solvency,console,runtime-io,jurisdiction,
architect,settings,runtime-diagnostics}-panel-view.ts` where applicable.
Port the remaining Svelte orchestration, forms and controls, not just headings
or JSON summaries. Add the actual components to the registry from step 1.

Preserve the existing remote boundary in `DockRoot.svelte`:
`architect`, `console`, `runtime-io`, `jurisdiction` and `jmachine-inspector`
are blocked in remote mode there. Do not add a Runtime API to remove that
restriction. Other panels retain their own current capability checks.

**Verify:** the corresponding `tests/frontend/runtime/*-panel-view.test.ts`
and diagnostics tests. Extend `ops-workspace-panels.spec.ts` to exercise each
panel's controls and context changes; cover genuine remote restrictions and
local behavior separately. Database inspector tests use only isolated browser
storage. Runtime-manager tests attach only isolated fixture Runtimes.

### 6. Mount Graph3D and full workspace playback — O2

Port the retained Graph3D component and viewport/control composition onto
`packages/ui/src/graph3d-*` and runtime-client graph projections. Keep rendering,
camera/selection, overlays, resizing, timeline and interaction lifecycles
separate. Preserve disposal of renderer resources, listeners and animation
work on panel close/reopen. Reuse the existing network timeline and demo
operations; do not implement another scenario engine or history store.

Reproduce the two known trail failures at L1, then determine whether the
frontend serializer/fixture disagrees with the existing frame contract. Fix
within frontend scope if possible; do not weaken validation or rewrite core.
The recorded failure is not proof of its cause or ownership.

**Verify:** affected `tests/frontend/graph/` tests, with
`network-timeline-source.test.ts` passing both JSON-safe-frame and URL
round-trip cases. Add `ops-workspace-graph.spec.ts`: real graph, node/Account
selection, resize, close/reopen and timeline changes; inspect screenshots.
Record a separate device check for retained XR interactions if the browser
runner cannot exercise them; do not count unit coverage as device proof.

### 7. Connect public routes, keyboard and localization — O1/O9

Switch the React `ops-model.ts`, `main.tsx` and `ops-app.tsx` workspace branch
to the complete host at `/embed`. Reuse `parseEmbedBootRequest`: plain embed,
scenario, autoplay and speed, and `#trail=` precedence must match
`src/routes/embed/+page.svelte`. Trail replay needs no wallet or connected
Runtime. Display boot errors visibly. Complete palette, focus restoration,
Escape/keyboard behavior and retained locale selection without adding a new
translation system.

Preserve the `xln-workspace-layout` key/envelope, restored panel IDs, requested
panel focus and the exact responsive rule: retained compact dock selection is
`!embedMode && window.innerWidth <= 760`. Test embed and wallet dock contexts
separately rather than imposing one invented mobile layout on both.

**Verify:** add `ops-workspace.spec.ts` for real `/embed` URLs, layout restore,
corrupt-layout diagnosis/reset, panel focus and scenario/trail semantics;
add keyboard/locale checks there and in wallet navigation tests. Update
`frontend/scripts/test-react-candidate.ts` with every new spec so the scoped
runner actually executes them. Run `tests/frontend/command-palette-view.test.ts`
and the tooling runner-scope tests.

### 8. Close the ledger with behavior evidence — all rows

For each W/O row, record the mounted React entry, actual user actions,
local/remote/history restrictions and named passing browser cases. Replace
broad audit labels in `frontend/config/wallet-flow-audit.ts` and relevant
platform inventories with evidence reflecting the complete behavior. Keep
still-missing behavior open. Update this plan, the migration status and index
without rewriting historical test results as current proof.

**Verify:** complete wallet and ops scoped browser matrices, React checks and
all-app build, followed by the repository integration gate once on the final
candidate. Preserve existing site/docs and non-workspace ops route tests. Do
not claim repository checks passed if an environment failure stops later gates.

## Verification commands and evidence

Run commands from the repository root unless `cd frontend` is shown. Select
the exact affected test file at L1, then one focused browser flow at L2; run
the final matrices only after those pass. Checkpoint sections identify existing
passing specs; proposed additional specs are not current test evidence.

Finish build/prepare and root checks that regenerate watched artifacts before
starting browser tests. Do not run them concurrently: the Formation matrix
recorded a recovery timeout during repeated Vite hot updates. Preserve any
failure trace and rerun its exact case on stable artifacts before a full matrix.

```sh
# Current narrow foundation baseline; expected final result: all pass.
bun test tests/frontend/runtime/embed-boot-model.test.ts tests/frontend/workspace/workspace-dock-layout.test.ts tests/frontend/account/account-workspace-navigation.test.ts tests/frontend/workspace/entity-panel-routing.test.ts tests/frontend/graph/network-timeline-source.test.ts

# Local typechecks; run the affected surface while iterating.
cd frontend
bun scripts/check.ts --surface=wallet --level=local
bun scripts/check.ts --surface=ops --level=local

# Example L2 after creating this spec; all required viewport projects at closure.
PLAYWRIGHT_REACT_SURFACE=ops bunx playwright test --config playwright.react.config.ts tests/react-candidate/ops-workspace.spec.ts --project=laptop-1366x900 --reporter=line

# Final frontend verification, still from frontend/.
bun run check:react
bun run build:react

# Final integration evidence; finish artifact writes before browser tests.
cd ..
bun run check

# Browser matrices against stable artifacts, from frontend/.
cd frontend
bun run test:react:wallet
bun run test:react:ops
```

The candidate browser config uses isolated gateway/fixture ports 19080/19092,
one worker and three viewports: 390×844, 1366×900 and 1920×1080. Use the real
BrowserVM fixture in `frontend/tests/react-candidate/wallet-runtime-fixture.ts`.
Do not fabricate successful submissions or alter the user's running stack.
Capture console/page errors and inspect screenshots at meaningful before,
pending, success and failure states. No unexplained errors or visible defects
may be hidden by skipped assertions.

Planning baseline on 2026-09-05: **37 pass, 2 fail, 154 assertions** across the
five foundation files above. Both failures are in `network-timeline-source`:
JSON-safe scenario frames and the URL round trip (`NETWORK_TRAIL_FRAME_INVALID:1`).
Log: `/tmp/xln-wallet-ops-plan-baseline.log`. Existing status evidence records
four app builds passing and the root check stopping because `cargo` is absent;
those earlier runs are not new verification of future ports.

## Completion and dependency handling

- [ ] Every W1–W10 and O1–O10 row has a reachable React consumer and behavioral
  evidence for all retained controls; no row is closed by a route count,
  extracted helper, missing-feature notice or test-only module invocation.
- [ ] `/embed`, scenario/trail URLs, wallet deep links and history navigation
  work from their real React routes; panel context and existing restrictions
  are preserved. The internal Entity page alone does not satisfy this.
- [ ] Wallet/ops checks, builds and scoped browser matrices pass. Required
  screenshots and any device-specific checks are reviewed. Repository gate
  results are recorded honestly, including any external environment limit.
- [ ] No new backend API, financial implementation, custody policy or durable
  representation was introduced; source changes stay within the UI port scope.
- [ ] The status and inventory name any remaining dependency explicitly.
  “UI ports finished” does not mean default-tooling cutover, Svelte removal or
  production release has happened.

An unavailable **existing** UI data/command path is a specific dependency to
trace, not permission to invent another one. Preserve baseline restrictions;
if parity really requires an out-of-scope change, leave that action open,
record the exact retained handler and missing input/output, and continue
independent rows. Escalate only the concrete scope decision. Do not hold all
wallet/ops work behind the inactive settlement API proposal or a root tooling
failure. Do not claim the full UI-port objective complete while parity rows
or required behavior checks remain unresolved.
