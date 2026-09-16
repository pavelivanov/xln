# Finish the React frontend migration

Remaining work only. Assessed **2026-09-16** on `main` at `cc11c96158c9f413869424d9c74d022cbe0311ec`, including the existing tracked and untracked changes. This file replaces the previous execution queue. Historical receipts belong in [evidence history](../docs/frontend/react-frontend-migration-evidence-history.md), not in this queue.

**Finish line:** React is the default for development, builds, checks, preview and distribution; required behavior and platform acceptance pass against the final source/release; Svelte-only source/config/dependencies are removed; `bun run check` passes. Production activation (C03) is a separate release operation and is not part of this finish line.

## Execution contract

1. **One active task.** Take the lowest-numbered runnable task in the table. Finish its implementation and exit checks before switching. If a prerequisite is unavailable, record the exact dependency and take the next runnable task. Never stop all frontend work because one task needs a core owner or device.
2. **No reopening finished work without evidence.** Do not rebuild the four apps, migrate shared helpers again, redesign UI, rename every “candidate” file, or run a general audit. A new task must fix a demonstrated failure of an exit condition below; attach it to that task, rather than expanding the project.
3. **Each task has a binary exit.** `READY → ACTIVE → DONE`, or `ACTIVE → BLOCKED(reason)`. `WAIT(Tnn)` means an unfinished prerequisite. No “mostly done,” percentage completion, or pass counts added across different source revisions. Code presence, test registration and passing execution are different facts.
4. **Verify narrowly, then advance.** Fix the first failing boundary and add its smallest semantic regression. Run the named local checks. Browser changes need real flows, console/page-error checks and inspected screenshots at mobile 390×844, laptop 1366×900 and wide 1920×1080. Do not run the whole matrix after each small change. T12 and T18 own final integration.
5. **Preserve authority.** This plan is not permission to change protocol/product scope, delete Svelte, cut over or deploy. Prepare concrete reviewable work before requesting cutover authority. Previously authorized decisions stay authorized; do not ask twice. Continue all unaffected tasks while external decisions are pending.

Update only the task's status row and its receipt link. A receipt under `docs/frontend/` links commands, exit codes, durations, first failure, screenshots/browser errors, source identity (SHA plus working-diff and untracked-file hashes) and release ID under `output/`. Do not append chronological progress essays or maintain a second status table in the index.

### Boundaries and commands

Work on current `main`; preserve unrelated changes. Frontend implementation scope is `frontend/**`, frontend-owned tests, `plans/**`, `docs/frontend/**`, and minimal root/CI/native/distribution wiring. Runtime/Entity/Account transitions, crypto, contracts, custody, persistence and `frozen-core.json` remain protected. Never approve frozen-core changes or weaken checks.

Reuse existing owners: `packages/frontend-release/` for release routing/verification; `frontend/packages/runtime-client/` for validated reads/projections; `frontend/packages/browser/` and `frontend/bridges/` for effects; `frontend/packages/ui/` for shared presentation. Follow `createObservableStore` plus `useSyncExternalStore` as in `frontend/apps/ops/src/health/ops-health.tsx`. Preserve canonical financial calculations, positional output order, storage keys, same-origin authority, public routes, CSP and deep links.

Commands below run from repository root unless marked **frontend cwd**. Use pinned **Bun 1.4.0**. Before heavy browser/native runs, execute `bun run stand:status`; use `bun run stand:run --reason <task-id> -- <command>` unless the runner already acquires the lock. Run sequentially. Preserve existing approved time budgets; otherwise the default is 30 seconds. Split browser work into bounded cases; obtain an explicit longer budget when necessary. Poll the original process handle and clean up its exact children after timeout.

Common checks used below:

| Check              | Exact command                                                                                                                                                                            | Pass condition                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Wallet types       | **frontend cwd:** `bun scripts/check.ts --surface=wallet --level=local`                                                                                                                  | exit 0                                                                 |
| Ops types          | **frontend cwd:** `bun scripts/check.ts --surface=ops --level=local`                                                                                                                     | exit 0                                                                 |
| All React types    | **frontend cwd:** `bun scripts/check.ts --all --level=local`                                                                                                                             | exit 0                                                                 |
| Focused browser    | **frontend cwd, under stand lock:** `PLAYWRIGHT_REACT_SURFACE=<wallet-or-ops> bunx --no-install playwright test --config playwright.react.config.ts <spec> --project=<viewport-project>` | named case passes, expected browser errors only, screenshots inspected |
| Frontend aggregate | **frontend cwd:** `bun scripts/check.ts --all --level=frontend`                                                                                                                          | units, checks, preparation, four builds and assembly all exit 0        |
| Root integration   | `bun run check`; `git diff --check`                                                                                                                                                      | both exit 0; cancelled siblings are unverified                         |

Viewport project names are `mobile-390x844`, `laptop-1366x900`, `wide-1920x1080`. Browser spec paths below are relative to `frontend/tests/react-candidate/`; prepend `tests/react-candidate/` in the command.

## Strict queue

All 18 tasks below are unfinished. Rows T01–T11 close implementation or concrete integration gaps; T12–T16 accept the resulting candidate; T17–T18 perform and verify canonical cutover. No production deployment task is hidden in this queue.

| ID  | Deliverable                                                                   | Initial state / prerequisite                                            | Receipt |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| T01 | Remove test/tooling dependence on the Svelte deletion set                     | READY                                                                   | —       |
| T02 | Finish enabled-service and critical Health acceptance; register topology spec | READY                                                                   | —       |
| T03 | Prove actual React root-dev lifecycle on 8080                                 | READY; listener ownership checked before launch                         | —       |
| T04 | Wire authoritative batch reserve preflight into React                         | BLOCKED: complete Runtime read contract/authority                       | —       |
| T05 | Finish lossless Activity paging                                               | BLOCKED: B2 storage/query owner                                         | —       |
| T06 | Finish remote settlement approval and execution                               | BLOCKED: B3 authority-checked read                                      | —       |
| T07 | Reconcile Lending UI with production admission policy                         | BLOCKED: B1 product decision                                            | —       |
| T08 | Prove cross-j cancellation finality                                           | BLOCKED: B8 canonical Runtime fix/authority                             | —       |
| T09 | Close relay-client detail parity                                              | BLOCKED: detailed read or explicit scope decision                       | —       |
| T10 | Resolve the two intermittent Runtime fixture failures                         | BLOCKED: Runtime investigation authority                                | —       |
| T11 | Clear remaining root integration failures                                     | READY for frontend-owned failures; protected failures go to their owner | —       |
| T12 | Freeze the accepted version/source and pass the complete web matrix           | WAIT(T01–T11); release-version decision also required                   | —       |
| T13 | Accept immutable artifact, preview and installed npm launcher                 | WAIT(T12)                                                               | —       |
| T14 | Accept two-release PWA and isolated activation/rollback                       | WAIT(T13)                                                               | —       |
| T15 | Accept iOS, Android, desktop, extension and supported WebXR                   | WAIT(T13); device/toolchain readiness can be checked now                | —       |
| T16 | Pass hosted build/distribution CI for those exact inputs                      | WAIT(T12); closes after T13–T15                                         | —       |
| T17 | Make React canonical and remove Svelte                                        | WAIT(T01–T16); explicit C02 authority                                   | —       |
| T18 | Certify the post-cutover source and release                                   | WAIT(T17)                                                               | —       |

An external dependency is closed only by an accepted implementation/result or an explicit owner change to the requirement. A missing environment, disabled capability, skipped case or passing retry does not close it. Request the specific pending decision once while continuing READY work; do not create another planning phase.

## Task instructions

### T01 — Make retirement tests independent of Svelte

**Remaining boundary:** tests still read retiring files. Examples: `tests/frontend/onboarding/wallet-identity-entry.test.ts` reads `RuntimeCreation.svelte`; `tests/frontend/graph/graph3d-viewport-view.test.ts` reads Svelte facades; `core/__tests__/development/frontend/frontend-check-output.test.ts` requires Svelte commands/config. The shared-boundary test also requires a live Svelte consumer. Migrated helper implementations are not part of this task.

1. Find remaining dependencies with `rg -n 'frontend/src|\\.svelte|svelte\\.config' tests/frontend core/__tests__ frontend/config frontend/scripts`. Classify actual imports/file reads separately from intentional forbidden-path assertions and historical labels. Translate in this fixed order: identity/recovery/payment/runtime tests; graph/workspace/diagnostic tests; inventories/root frontend command tests. Preserve each behavioral assertion against its React/shared owner; do not merely delete source assertions.
2. Refresh `docs/frontend/react-frontend-retirement-guards.patch`, `react-frontend-cutover-commands.patch`, `react-frontend-retirement-files.txt` and `react-frontend-cutover-review.md`. Stage post-cutover-only test forms in the review patch while coexistence still needs the old commands. Preserve static assets, workers, generated-input owners and `copy-static-files.js --docs-only`.
3. In a disposable validation copy containing the **current working diff and untracked files**, apply the reviewed patches and remove only the listed paths. This is a scratch deletion rehearsal, not a new branch/worktree or live retirement. Run all frontend tests, all affected frontend-owned core tests, All React types and Frontend aggregate there. Exercise the root frontend command tests too. Repair the first failed dependency and repeat its check before the aggregate.

**Exit:** all named checks pass in the deletion rehearsal; no surviving executable import or file-read depends on the deletion set; every replaced semantic assertion has a mapping in the review. `git apply --check --unidiff-zero` succeeds for both refreshed patches in the live tree. An old 33-test inventory rehearsal is insufficient. Do not delete live Svelte until T17.

### T02 — Finish Health acceptance and include it in surface runs

**Remaining boundary:** `frontend/tests/react-candidate/fixtures/health-orchestrator-fixture.ts` starts a real Orchestrator, but enabled MM/custody and critical browser evidence are absent. `ops/ops-health-topology.spec.ts` exists but is **missing from `CANDIDATE_BROWSER_TEST_FILES.ops`** in `frontend/scripts/test-react-candidate.ts`; `--all` discovers it, the Ops-only runner omits it.

1. Add the topology spec to the Ops registry and its existing scope/registry assertion. Extend the isolated fixture using real supported service configuration to exercise enabled MM/custody and a controlled real failure producing a critical signal. No fabricated health response, production custody action or disabled-service-as-success test.
2. Prove enabled values, critical/degraded display, recovery, stale retention, refresh, selected-Runtime cleanup and expected failure errors. Modify `frontend/apps/ops/src/health/` only if these flows expose a missing behavior; do not rebuild bootstrap/Entity/event-flow panels.
3. Run `bun test tests/frontend/ops tests/frontend/tooling/frontend-browser-scope.test.ts`, Ops types, and the Health events/topology browser specs at all three viewports. Reconcile Health evidence in `frontend/config/{capabilities,parity-audit}.ts`, leaving the T09 relay gap explicit.

**Exit:** positive enabled-service and real critical flows pass; all Health specs are included in Ops-only execution; screenshots and error assertions are retained. If enabling a service requires protected changes, block only that subcase with its first failing boundary.

### T03 — Prove the actual root development lifecycle

**Files:** `scripts/dev/{supervise-dev.ts,run-dev.ts,run-dev-child.sh}`, `frontend/scripts/dev/`, `frontend/config/development-gateway.ts`.

1. Inspect the 8080 listener. Do not kill an unrelated service; obtain authority to stop/restore it if occupied. Run `XLN_DEV_FRONTEND=react bun run dev` under the appropriate process budget.
2. Visit Site, Docs, Wallet and Ops through 8080; prove route refresh, HMR, watched Runtime/worker bytes, configured TLS, authenticated API and WS. Exercise shutdown/restart and verify owned child/listener cleanup. An alternate-port gateway or unit-only result does not satisfy this task.
3. Fix only demonstrated startup/consumer wiring failures. Run `bun test tests/frontend/tooling/frontend-root-development.test.ts tests/frontend/tooling/frontend-development-gateway.test.ts` and the affected real lifecycle again.

**Exit:** one receipt covers canonical origin, four app routes, HMR/worker changes, TLS/API/WS and clean shutdown/restart. No change to Runtime financial behavior.

### T04 — Restore batch reserve preflight

**Verified boundary:** `frontend/apps/wallet/src/payments/commands/wallet-payment-batch.tsx` passes `pendingBatchReserveIssueText: null`. Its review uses a compact batch. `core/api/runtime-adapter/resolve.ts` bounds reserves, outgoing debt and operation lists; an issue-free compact simulation cannot certify the full draft.

1. Obtain the bounded read-only contract described in [batch preflight handoff](../docs/frontend/react-batch-preflight-handoff.md). Its implementation must use complete canonical state and existing `simulateDraftBatchReserveAvailability`; bind Runtime/height, Entity, exact draft and sent-batch identities. Require tests where the decisive debt is 21st, reserve token 101st, operation 51st or nested diff/pair lies beyond the projection limit. No duplicate financial formula or secret/proof exposure.
2. Wire the validated result through Wallet payment source/model and batch commands into warning text, truthful operation counts, disabled broadcast and action-time reread. Missing/stale/malformed reads prevent broadcast. Reject changed Runtime/Entity/draft; preserve LIVE-before-signer, retry/finality and clear-review guards. An advisory read does not make later enqueue atomic.
3. Extend `tests/frontend/payments/frontend-wallet-batch-preflight.test.ts` and source/action tests for debt priority, deficits, valid funding, withdrawal/settlement, changed context and both embedded/remote transports. Run `bun test tests/frontend/payments`, Wallet types, and affected account-workspace/transactions browser cases at three viewports.

**Exit:** unsafe/unresolved preflight makes zero submissions; the valid canonical batch reaches finality. Shared-helper tests alone do not close the UI task.

### T05 — Finish lossless Activity paging (B2 / W20)

**Verified boundary:** `core/storage/queries/history.ts` slices accumulated events to `limit`, then advances `nextBeforeHeight` below the entire frame. Events beyond the page limit within that frame can be lost.

1. Obtain the owner-approved lossless bounded query contract and its regression with more than one page of events in a single frame, exact ordered IDs, no duplicates/gaps and preserved partial-history floor. Do not invent a browser cursor or scan Account history.
2. Adopt that contract in `frontend/packages/runtime-client/src/` Activity queries and existing Wallet/Ops Activity consumers. Preserve filters and cancel/ignore stale pages on Runtime/Entity changes.
3. Run `bun test tests/frontend/account/activity-history-query.test.ts tests/frontend/ops/entity/frontend-ops-entity-activity-ledger.test.ts tests/frontend/runtime/query`, All React types, and new real Activity paging/filter/context-switch cases in the existing Wallet/Ops specs at three viewports.

**Exit:** consuming every page returns the exact canonical event sequence, including the overfull single frame; stale pages never appear in a new context.

### T06 — Finish remote settlement (B3 / W10–W11)

**Verified boundary:** `core/api/runtime-adapter/resolve.ts` removes `settlementWorkspace` from compact reads. The frontend cannot reconstruct an exact approval payload from that projection.

1. Obtain a bounded, authority-checked read of the exact approval payload from the owning API; do not expose the whole transient workspace.
2. Connect it to `frontend/bridges/wallet/wallet-canonical-account-context.ts` and the existing settlement decoders/actions. Preserve revision/hash, peer authority, designated executor, cancellation and duplicate guards.
3. Extend `wallet/wallet-settlement.spec.ts` with real remote peer approval → designated execution → chain finality, plus stale revision and non-executor rejection. Run `bun test tests/frontend/payments`, Wallet types and that spec at three viewports.

**Exit:** real remote settlement finalizes; invalid authority/stale review submits nothing. Local-only settlement evidence is insufficient.

### T07 — Resolve Lending scope and finish its UI (B1 / W19)

**Verified boundary:** `core/account/tx/admission-policy.ts` intentionally excludes six Lending mutations under D3/FX-2. The positive case in `wallet/account/wallet-account-workspace.spec.ts` contradicts this production profile.

1. Obtain one explicit product decision. Recommended: preserve the production exclusion and show Lending as unsupported, with a reason and no submitting control. Alternative: the owner separately authorizes protocol enablement.
2. Implement the selected behavior in `frontend/apps/wallet/src/manage/wallet-lending.tsx` and its projection. For unsupported behavior, replace the contradictory positive requirement with real unsupported-state/no-submit assertions **only after that decision**. For enablement, retain fund → borrow → repay on the selected Hub/asset and wait for the canonical implementation.
3. Run Wallet types and the affected account-workspace cases at three viewports; update `frontend/config/wallet-flow-audit.ts` and its test to the accepted behavior.

**Exit:** UI, production admission and browser requirements agree. No skipped positive test or removed admission guard.

### T08 — Close cross-j cancellation (B8 / W17–W18c)

**Boundary:** historical resting-order cancellation throws `ACCOUNT_SWAP_CANCEL_SCOPE_UNRESOLVED` at `core/entity/tx/handlers/account/committed-input.ts` when the offer is missing.

1. Under explicit Runtime scope, reproduce the first divergent frame and capture complete bilateral prior/input/result evidence. The canonical owner fixes the demonstrated cause and adds its named regression; do not infer scope from UI disappearance.
2. Run the original real cancellation in `wallet/wallet-transactions.spec.ts` at three viewports. Preserve actual resting-order setup and the final `cancelled` assertion.
3. Change frontend presentation only if the corrected canonical result exposes a UI defect; rerun its focused test.

**Exit:** owner regression and all three real cancellation cases pass through finality. Error suppression or a disappeared row does not count.

### T09 — Resolve detailed relay-client parity

**Verified boundary:** `core/orchestrator/health/aggregated-health-projections.ts:buildAggregatedRelayHealth` returns counts/IDs/subscriptions, not per-client age, last-seen or topics. React currently truthfully displays “Details not reported.”

1. Obtain either an authorized detailed read or an explicit decision accepting those unavailable fields. Do not infer online status from configured membership.
2. For the read, wire validated fields into `frontend/apps/ops/src/health/topology/` and prove real data plus omitted/stale states. For an accepted omission, retain the truthful unavailable UI and record the exact narrowed requirement.
3. Run `bun test tests/frontend/ops/health`, Ops types and `ops/ops-health-topology.spec.ts` at three viewports. Close the Health parity gap only after T02 also passes.

**Exit:** retained field requirements are fulfilled or explicitly changed; inventories and real browser evidence match that decision.

### T10 — Resolve intermittent Runtime fixture failures

Use [Runtime failure handoff](../docs/frontend/react-runtime-failure-handoff.md) for retained logs and the six-field handoff format. Scope is two observed errors: `RUNTIME_INPUT_INGRESS_AFTER_PERSISTENCE_PAUSE` in wide public embed/reset, and `RUNTIME_INPUT_COMMIT_TIMEOUT` while Hub discovery creates profiles.

1. The authorized Runtime owner captures the first failing boundary and supplies a causal repair plus focused regression. A later green retry is not a diagnosis; do not repeatedly run the full browser matrix hunting the failure.
2. Re-run the original `ops/ops-public-embed.spec.ts` reset/reload and `wallet/onboarding/wallet-hub-discovery.spec.ts` Runtime-switch cases unchanged. Verify no fatal watcher, refused connection, lost commit or unexpected browser error.
3. Lending's separate historical apply failure follows T07's accepted production behavior; do not enable Lending as a fixture workaround.

**Exit:** each error has an owner disposition supported by regression evidence, and the affected UI flows pass. An unresolved intermittent remains BLOCKED unless the owner explicitly accepts that outstanding risk.

### T11 — Clear root integration blockers

Previous receipts report folder-width failures and an intermittent TS Account worker parity timeout. Reproduce current failures with Bun 1.4.0; these are leads, not a request for broad cleanup. The 2026-09-16 planning run hit listener-start failures and was stopped at 30 seconds (exit 124); log: `/tmp/xln-react-plan-20260916-root-check.log`. It is not a passing root gate.

1. Run `bun run check:folder-width`. Repair only reported frontend/frontend-test ownership and generated-frontend-output classification within migration scope. Preserve semantic tests and limits; do not raise thresholds or suppress a real source violation.
2. Re-run the failing gate and affected tests. Protected/unrelated failures go to their owner with the first error; do not redesign core to make the migration plan green.
3. Run Root integration in an environment that permits required local listeners and with the approved duration. Resolve actual source failures in scope; report environment failures separately. No repeated full-root run without a changed failure condition.

**Exit:** root check and diff check pass on the integration candidate. This gate does not prevent T01–T09 frontend work.

### T12 — Accept one version and the complete web source

1. Obtain the release version decision: `VERSION`/frontend/extension currently say **0.1.31**, root/npm **0.1.32**. Synchronize approved mirrors with existing tooling; preserve pre-signing mismatch rejection. Recheck current values first.
2. Once T01–T11 close, capture the working source identity and run Frontend aggregate. Record the emitted verified release directory/ID; never select an inferred “latest” directory.
3. **frontend cwd:** list cases with `bunx --no-install playwright test --config playwright.react.config.ts --list`, then run `bun scripts/test-react-candidate.ts --all` under the stand lock and approved budget, or bounded partitions of that exact registry. Include new T02/T04–T09 cases and cross-surface flows. No skipped/unaccounted case, historical pass substitution or aggregation across source changes.
4. Run Root integration once on the unchanged accepted source. Update existing parity/capability/Wallet-flow metadata to match actual closure, and rerun their focused tests if edited.

**Exit:** every registered final-source case passes at all three viewports, including previously blocked requirements; units/types/build/assembly/root gates pass. Record a complete case ledger and exact release ID. Further relevant source changes invalidate the affected evidence.

### T13 — Accept actual release consumers

Use T12's explicit release directory. Do not recreate `packages/frontend-release/` or existing consumer wiring.

1. **frontend cwd:** run `bun scripts/release/candidate-release-verifier.ts <release-directory>`, `bun run test:react:artifact <release-directory>` and `bun run test:preview:react <release-directory>`. Prove routes/history/redirects/methods, every served-file hash, assets/workers/downloads, auth/storage and changed interactions. Include recovery/Ownership and Graph/history/Solvency/Live. Artifact tests must not import source modules.
2. Build current server/worker bytes, then run `bun scripts/release/build-xlnfinance-package.ts --frontend-release <release-directory> --skip-build --pack`. Install the tarball offline into isolation. Exercise the installed launcher's start/status/stop, authenticated API and admin WS, token issue/consume/replay, graceful shutdown and reopen at the canonical origin. Do not stop an unrelated 8080 service without authority.
3. Prove corrupt/missing release rejection **before** state/daemon contact. Reverify frontend bytes after consumer operations. Run `bun test tests/frontend/tooling/build/frontend-release-preview.test.ts tests/frontend/tooling/build/frontend-distribution-consumers.test.ts tests/frontend/tooling/build/frontend-candidate-release-verifier.test.ts`.

**Exit:** immutable interactions, preview and installed launcher lifecycle pass on current bundles. Direct-server SIGTERM or static wiring tests alone are insufficient.

### T14 — Accept PWA updates and isolated rollback

**frontend cwd**, under the stand lock:

1. Run `bun run test:pwa:candidate <install-release-directory> <update-release-directory>`.
2. Run `bun run test:deployment:candidate <install-release-directory> <update-release-directory>`.
3. Verify both release directories before/after. They must be distinct verified inputs and the final candidate must participate. Retain install/update/offline/cache rollback, corrupt/missing/stale-input rejection and whole-release activation/rollback evidence.

**Exit:** both lifecycle runners pass without changed release bytes. This is isolated verification, not production activation; deployed rollback bytes and edge/SSH/TLS belong to the later C03 release.

### T15 — Close supported platform acceptance

Check device/toolchain access early while other tasks run; do not spend implementation turns retrying an unavailable host. Build from T13's exact verified release via `bun scripts/native/build-platforms.ts <target> --frontend-release <release-directory>`; respect signing/package checks. Sync/copy alone does not satisfy launch acceptance.

- [ ] **iOS:** actual copied-shell build/install/launch, deep link, background/resume/reload and persisted storage.
- [ ] **Android:** the same on a configured SDK/emulator/device.
- [ ] **Desktop:** actual package launch, routes/deep links/CSP, storage, close/reopen and cleanup.
- [ ] **Extension:** final packaged ZIP identity, action opens Wallet, preferences/reload/browser reopen at three viewports; use `frontend/playwright.packaged.config.ts` with explicit `PLAYWRIGHT_PACKAGED_DIRECTORY` and `PLAYWRIGHT_STAGING_DIRECTORY`.
- [ ] **Supported WebXR:** headset enter/exit, controller select/drag/double-tap/scale, close/session teardown and restored desktop resources.

Run `bun test native/__tests__/native-build-options.test.ts native/__tests__/wallet-candidate-staging.test.ts`; verify payload identity before and after platform tools. **Exit:** every checkbox has final-byte evidence or an explicit owner scope change. Missing hardware and desktop “XR unsupported” are not passes.

### T16 — Verify hosted distribution

**Files:** `.github/workflows/{build-and-test,distribution-release}.yml`, `scripts/release/`, `scripts/native/`, `packages/npm/xlnfinance/`.

1. Run hosted checks against the reviewed source/version through the authorized PR/CI workflow. Transfer one verified frontend release from producer to npm/macOS/extension/Android consumers; record identical release identity and installed-package corruption rejection before signing.
2. Resolve the actual release-gate expectation mismatch if still present; preserve the checks it represents. Run `bun test tests/release-integrity/release-gate-order.test.ts tests/frontend/tooling/build/frontend-distribution-consumers.test.ts` before the affected hosted rerun.
3. Record hosted run URLs, source identity and artifact IDs in the cutover review. No static YAML-only or local-only acceptance.

**Exit:** required hosted jobs pass on the accepted inputs. Publishing packages or production deployment still requires release authority and is not implied by this task.

### T17 — Execute canonical cutover and retirement (C02)

After T01–T16, present the refreshed command/test patches, exact deletion list, version/release identity and acceptance receipts for **explicit C02 authority**. This is approval of the concrete result, not a preliminary planning checkpoint.

1. Apply the reviewed canonical command/guard changes and delete exactly the validated Svelte-only set. Remove Svelte dependencies/config and obsolete coexistence selectors with Bun lockfile updates; preserve shared assets and useful semantic tests.
2. Make root/frontend dev/build/check/preview, regular/release CI, npm/native/deployment consumers select React through the existing owners. Preserve root Runtime build semantics and one public 8080 entry; no Svelte fallback.
3. Update affected usage docs under `docs/frontend/` and README commands. Reconcile inventories to canonical owners; remove the temporary migration override when the migration is merged, as required by AGENTS.md.

**Exit:** default commands resolve to React, retirement matches the reviewed set, and no live source/dependency/config references require Svelte. T18 must still verify the changed tree; do not announce completion here.

### T18 — Certify the post-cutover result

1. From T17's actual tree, run the now-default frontend `bun run check`, `bun run build`, root `bun run check` and `git diff --check`. Re-run the default 8080 dev lifecycle and explicit-release preview. Any failure belongs to its first failing owner; do not restore a silent legacy fallback.
2. Assemble/verify the final release. Re-run the complete final-source browser registry; bind T13–T16 consumer/PWA/platform/hosted evidence to these bytes. If inputs changed, rerun affected acceptance; reuse evidence only with demonstrably identical relevant inputs and tested paths. Explicitly test changed default commands even if app bytes stayed identical.
3. Put one final source/release acceptance record in `docs/frontend/react-frontend-cutover-review.md`. It must identify the canonical command results, absence of Svelte dependencies, every required browser/platform result, hosted run and root pass. No required BLOCKED/WAIT row remains.

**Exit:** T01–T18 are DONE with valid evidence (or precisely recorded owner-approved requirement changes), React is canonical and Svelte is retired. Stop migration work. C03 production activation is separate.

## First execution

**Start T01.** Run its dependency search, translate the first real source-reading test, verify that test, then continue through the fixed retirement checkpoints. Ask for outstanding external decisions while proceeding with T01/T02/T03; do not restart assessment or open another roadmap.

This planning refresh changes no application code. It verified the cited source boundaries and command entry points, but did not rerun browser/native/hosted acceptance. The root-check attempt above is incomplete; existing historical receipts do not certify the current release.
