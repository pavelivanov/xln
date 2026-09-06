# Finish the frontend refactor

Status: **in progress**. Four React apps exist; behavior parity and framework isolation are incomplete. Svelte remains canonical.

This is the only executable refactoring plan. Update task rows in place; do not append session histories, duplicate audits, or new completion ledgers.

## Target and boundaries

Deliver independently checkable, testable and buildable **site, docs, wallet and ops** apps using the existing React/Vite/TypeScript stack, assembled into one same-origin release with whole-release rollback. Preserve reachable behavior, routes, assets, storage and authority rules.

- Keep one frontend package/lockfile, four app roots and namespaced outputs. Shared browser effects, Runtime-client adapters and UI primitives keep separate owners; apps do not import another app's bootstrap.
- Work in `frontend/**`, frontend-owned tests, and the smallest required root/CI/native/artifact-consumer wiring. Follow `AGENTS.md` and `docs/fints.md`.
- Reuse canonical commands, financial helpers and vault lifecycle. Do not change Runtime/Entity/Account machines, consensus, financial formulas, custody policy, contracts or persistence schemas.
- Do not introduce new features, resurrect unreachable controls, redesign the product or add production compatibility paths. In particular, Architect's unreachable Build mode is outside this plan.
- Preserve `localhost:8080`, edge route precedence, redirects, CSP, storage origin, worker/service-worker scope and native deep links. `frontend/config/surfaces.ts` owns the exact route/asset map.
- Preserve `xln-workspace-layout` and the 14 default / 16 registered panel components. The internal four-panel host uses `storage: null`; it must never overwrite the public full-workspace layout. Retain compact selection only for `!embedMode && width <= 760`.
- Continue frontend work on the current checkout. No new branch, audit quorum, approval manifest or global clean baseline is required. Do not restart or mutate the user's live durable Runtime.
- Svelte deletion/canonical cutover and production activation require separate owner authorization. Ordinary frontend implementation does not.

## Already implemented — preserve, do not rebuild

| Foundation | Existing evidence / entry points |
|---|---|
| Four app roots, scoped checks/builds, gateway and candidate assembly | `frontend/apps/`, `frontend/scripts/`, `frontend/config/surfaces.ts` |
| Site routes and Docs reader/search implementation | `frontend/apps/site/`, `frontend/apps/docs/`; final interaction coverage remains below |
| Wallet identity/recovery, local Formation and Hub Connect, Account rail/tools, payments/markets, profile and owner lifecycle | `frontend/apps/wallet/src/`, `frontend/bridges/`; remaining operations are listed below |
| Shared local/remote/scenario Ops context, retained panels, real local/scenario Graph3D and playback | `frontend/apps/ops/src/workspace/`; remaining controls are listed below |
| Public `/embed`, layout restore/reset/focus, dynamic panels, palette drafts, locale store and guide offline handling | `ops-public-embed.spec.ts`, `ops-command-palette.spec.ts`, `ops-workspace-localization.spec.ts`, `ops-workspace-guide.spec.ts` |
| Candidate artifact verification, PWA/native/deployment and rollback tooling | `frontend/scripts/candidate-release-verifier.ts`, `frontend/config/platform-inventory.ts`; final acceptance remains below |

Four-app local checks and targeted browser flows have passed. This is not a full-suite or cutover claim. Route counts and mounted panels do not measure behavioral completion.

## How to execute one task

1. Pick the next ready row. Trace its reachable Svelte control, existing helper/command and current React consumer before editing. If already implemented, verify and close it; do not rewrite it.
2. Change one user operation or one dependency family. If a row needs multiple independent changes, split it into child IDs before coding. Keep one task per worktree and one implementer per area; independent tasks may run in parallel. The coordinator alone updates task rows during serial PR integration, after refreshing from the latest merged plan. Unrelated blocked rows do not stop ready work.
3. Reproduce the specific missing/broken behavior. Reuse real isolated Runtime/BrowserVM state; no fake success, mocks or alternate financial logic. Never read live state as historical evidence.
4. Run narrow model/command checks, then one exact browser flow for visible changes. Assert committed results, cancellation/rejection and context ownership as relevant. Inspect screenshots and browser errors at 390×844, 1366×900 and 1920×1080.
5. Mark the row `done` only with code and passing relevant evidence. Replace its status with `done — test/log path`; use `blocked Bn — exact failure` for dependencies. Keep evidence under `output/` or existing QA storage, not as another plan. Update typed inventories when their sources/capabilities change.

Do not add tests that merely mirror code. Preserve existing behavioral assertions. Do not relax import boundaries or convert failures into skips/warnings. Run broad gates after their narrow failures are resolved; do not rerun an unchanged known blocker.

## Execution order

**Start with W01.** Work down Wallet, then Ops, then framework isolation. Site/Docs and independent isolation rows can be used whenever the next behavior row is blocked. Finish integration verification only after implementation and isolation are ready. The former workspace goal is part of Ops, not a replacement for this plan.

Task dependencies are local to their row unless stated otherwise. `open` means work or verification remains, not that the entire implementation is absent.

### Wallet — one operation at a time

Sources: `frontend/src/lib/components/Entity/` is the retained reference; `frontend/apps/wallet/src/` and shared `frontend/packages/ui/src/` are the consumers. Browser specs below live in `frontend/tests/react-candidate/`.

| ID / status | Small task and starting point | Pass condition / focused evidence |
|---|---|---|
| W01 done — W01a/W01b | Finish Ownership share-balance/status refresh through canonical compact reads. | Real committed shares and action status refresh correctly, with stale Entity reads discarded. |
| W01a done — `output/plan-execution-20260906/w01-browser/` | Read the selected Entity's actual share reserves through retained catalog/projection helpers; refresh and discard stale reads across Entity reversal. | Real registered Entity releases and commits 80 control / 40 dividend shares. 6 browser cases pass across all three viewports with screenshots/F12 inspected; 12 model tests / 30 assertions pass. After fixture integration, Wallet 1/1 and Ops 2/2 laptop checks pass. Reload preserves canonical transient-selection behavior. Missing action status remains explicitly unavailable; actual remote action status is now verified by W01b. |
| W01b done — `output/plan-b6-b7-20260906/b7-browser/` | Preserve existing committed EntityProvider action state in compact remote reads. | Unchanged exact nonce-1 regression now passes. All 9 Ownership/entity-evidence browser cases pass across 3 viewports with screenshots and console/page errors inspected; 2 projection regressions / 12 assertions and 7 bridge tests / 18 assertions pass. Exact pending intent and detached snapshots are covered. |
| W02 open | Port Ownership share release through the retained builder. Depends W01. | Review/cancel submits nothing; submit reaches the committed release for the selected Entity. Extend W01 spec. |
| W03 open | Port Ownership proposal, including eligible takeover target selection. Depends W01. | Existing eligibility and authority checks hold; the proposed board is observed after submission. Extend W01 spec. |
| W04 open | Port Ownership activation. Depends W03. | Activation remains unavailable until the canonical conditions hold; the committed current board refreshes. Extend W01 spec. |
| W05 open | Finish successful automatic Hub joining from `onboarding/OnboardingPanel.svelte` and its helpers. | Visible onboarding joins a real Hub and reload preserves that connection without creating a second Runtime. `wallet-onboarding.spec.ts`. |
| W06 open | Finish remote-owner Formation using the existing formation bridge. | Wrong/locked owner is rejected; a supported creation commits to the selected remote Runtime. `wallet-formation.spec.ts`. |
| W07 open | Finish remote-owner Hub opening using the existing discovery bridge. | A new Account opens through visible controls; switching Runtime cannot submit to the previous one. `wallet-hub-discovery.spec.ts`. |
| W08a open | Verify retained Wallet settings/profile controls in `wallet-settings.tsx` and the shared Entity settings stage. | Direct load, edit, cancel, commit and reload preserve the selected identity. `wallet-navigation.spec.ts` and existing profile tests. |
| W08b open | Close Display settings parity with the retained display subview. | Existing appearance choices persist and apply to Wallet and docked Entity views. `wallet-account-appearance.spec.ts`. |
| W08c open | Close Recovery settings parity with the retained recovery subview. | Existing tower/service selection, save and error paths work without re-deriving an identity. Existing recovery-service tests and `wallet-onboarding.spec.ts`. |
| W08d open | Verify Consensus settings and mount the shared Stack Manager destination after O09–O10. | Both settings deep links use the selected Entity/Runtime and preserve canonical restrictions. `wallet-entity-evidence.spec.ts`. |
| W09 open | Complete settlement proposal review/edit from `payments/SettlementPanel.svelte`. | Review includes every field used by the retained action; cancel is inert and submit commits the intended proposal. `wallet-settlement.spec.ts`; remote reads depend on B3. |
| W10 open | Port settlement peer approval. Depends W09. | The proper peer can approve the selected proposal; stale/wrong-Entity approval is rejected. Extend W09 spec. |
| W11 open | Port designated-executor settlement execution. Depends W10. | Existing execution command reaches observed Runtime and chain finality; no duplicate submission on reopen. Extend W09 spec; B3 may block remote proof. |
| W12 open | Finish `payments/PendingBatchNotice.svelte` status/recovery controls. | Existing pending/failed/confirmed notices and retry/clear confirmation work without losing the selected batch. Preserve current broadcast/clear tests. |
| W13 open | Close hub collateral completion after the already-tested request/prepaid-fee commit. | Both Account sides and chain observation reach the expected result. `wallet-account-commands.spec.ts`. |
| W14 open | Close dispute-finalization controls/evidence after the existing dispute-start draft. | Existing clocks/roles stay authoritative; cancellation is inert and supported finalization is observed. `wallet-account-workspace.spec.ts`. |
| W15 open | Finish debt/dispute drill-down navigation from `assets/DebtPanel.svelte` and retained Account views. | The exact Entity, Account and token survive navigation and refresh; no invented balance calculation. `wallet-financial.spec.ts` and `wallet-account-view.spec.ts`. |
| W15b open | Port the retained debt Enforce/drain action from `assets/DebtPanel.svelte` through its existing parent handler. | Correct Entity/token is used, cancellation is inert and the supported result is observed; no alternate debt accounting. `wallet-financial.spec.ts`. |
| W16 open | Finish retained cross-j market route selection and quote review. | Source/target jurisdictions and assets match the existing route helper; changing selection invalidates the old quote. `wallet-transactions.spec.ts`. |
| W17 open | Finish cross-j order submission/cancellation. Depends W16. | Existing commands observe the correct order lifecycle; cancellation targets that order. Extend W16 spec; protocol failures become dependencies, not UI workarounds. |
| W18a open | Verify shared Ownership actions in the dock after W01–W04. | Local/remote owner and recorded restrictions hold; sibling selection does not leak. `ops-workspace-wallet.spec.ts`. |
| W18b open | Verify shared settlement actions in the dock after W09–W12. | Exact Account/batch context survives panel switching; no duplicate Runtime or submission. Extend W18a spec. |
| W18c open | Verify shared cross-j market actions in the dock after W16–W17. | The same route/order context is used and stale selections are rejected. Extend W18a spec. |
| W19 blocked B1 | Complete the existing Lending positive-flow regression once admission is available. | Pool, loan and repayment all commit. Keep the failing case in `wallet-account-workspace.spec.ts` registered. |
| W20 blocked B2 | Complete Activity same-frame pagination evidence once the read dependency is resolved. | Paging neither omits nor duplicates events; Entity/filter changes discard prior pages. `wallet-transactions.spec.ts`, `wallet-account-workspace.spec.ts`. |

### Ops — finish reachable controls

Sources: `frontend/src/lib/view/DockRoot.svelte`, `frontend/src/lib/view/panels/`, and `frontend/src/lib/components/Settings/`. Consumers: `frontend/apps/ops/src/workspace/`. Reuse the existing shared environment, owner session and playback; do not create another execution engine.

| ID / status | Small task and starting point | Pass condition / focused evidence |
|---|---|---|
| O01 open | Port Architect jurisdiction creation/selection from reachable Economy controls. | BrowserVM creation works; RPC import collects the contract metadata/deployment block required by the current API. Selected stack is exact; history blocks mutation. `ops-workspace-architect.spec.ts`. |
| O02 open | Port Architect's reachable hub/grid setup using its existing recipe. Depends O01. | The real expected topology appears; duplicate setup is rejected and the user's existing Runtime is not reset. Extend O01 spec. |
| O03 open | Port Architect debug reserve funding for one/all Entities. Depends O02. | Only the existing BrowserVM debug capability is used; exact raw amounts are observed and live/history restrictions hold. Extend O01 spec. |
| O04 open | Port Architect retained R2R transfer controls, including the existing demo selection recipes. Depends O03. | Each click uses the existing command builder and commits to the selected local context. No replacement financial math. Extend O01 spec. |
| O05a open | Port the reachable isolated demo stress/load control using its existing recipe. | Real expected Entities/commands are observed; history cannot start the action. `ops-workspace-architect.spec.ts`. |
| O05b open | Port any reachable recurring demo start/stop lifecycle; omit dead handlers after recording reachability evidence. | Stop and panel teardown cancel owned work; no background commands survive. Extend O05a spec. |
| O05c open | Port the reachable isolated demo reset control. | Only its owned demo is reset; a durable live Runtime is never cleared, restarted or replaced. Extend O05a spec. |
| O06 open | Finish Jurisdiction token registry labels and token selection. | Labels come from the exact selected stack; missing/failed metadata is visible and old selections are discarded. `ops-workspace-jurisdiction.spec.ts`. |
| O07 open | Port fresh external ERC20/native balance reads. Depends O06. | Reads use the selected stack; recorded views do not silently query or time-travel the live provider. Extend O06 spec. |
| O08 open | Port fresh on-chain debt reads. Depends O06. | Correct Entity/token debts render; late results cannot replace another selection. Extend O06 spec. |
| O09 open | Finish Stack Manager list/inspect/select; retained inspection is closed in O09a, configured-stack selection remains O09b. | Do not treat Runtime signer selection as configured-stack selection. |
| O09a done — `output/plan-execution-20260906/o09-browser/report/index.html` | Port retained daemon status, owned signer selection and exact RPC inspection into Ops Settings. | 6 browser cases pass across 390×844, 1366×900 and 1920×1080 with screenshots/F12 inspected; 6 client tests / 37 assertions pass. Real RPC/error, refresh, stale-probe clearing, reopen and embedded restrictions verified. No deploy action added. |
| O09b open | Add configured-stack list/inspect/shared selection using its actual jurisdiction/configuration owner. | Retained `StackManager.svelte` supplies deployment status/signers/RPC probes, not a configured-stack selector. Trace the existing jurisdiction selection consumer before defining shared selection; O09a does not close this requirement. |
| O10 open | Port Stack Manager deploy/register through the existing endpoint. Depends O09. | A real isolated test stack deploys and registers; errors are visible. Never deploy to the user's live infrastructure as part of a test. |
| O11 open | Finish remote BrainVault entry through the existing node derivation path. | Correct remote Runtime is targeted; worker/secret handling, cancellation and errors retain existing behavior. `ops-workspace-brainvault.spec.ts` and BrainVault tests under `tests/frontend/onboarding/`. |
| O12 open | Verify active incident rendering with a real isolated incident. | Active/resolved observations refresh correctly; private infrastructure is not copied into Runtime history. `ops-workspace-panels.spec.ts`; no fabricated incident success. |

### Graph, localization and guide

Graph reference: `frontend/src/lib/view/panels/graph3d/`; shared primitives: `frontend/packages/ui/src/graph3d-*`; React owner: `frontend/apps/ops/src/workspace/ops-graph-*`.

| ID / status | Small task | Pass condition / focused evidence |
|---|---|---|
| G01 open | Port remaining reachable transaction/lightning effects with existing projections and primitives. | Actual selected-frame events drive effects; speed/toggles and disposal work. `ops-workspace-graph.spec.ts`. |
| G02 open | Port remaining broadcast effects and their retained Settings controls. | Real events drive the selected style; disabling/closing removes effects and animation work. `ops-workspace-settings.spec.ts`, Graph spec. |
| G03 open | Finish retained renderer selection, including WebGPU where supported. | The chosen renderer is actually used; unsupported capability is explicit and reopen/disposal works. Graph spec plus real capability evidence. |
| G04 open | Port retained XR entry, input and scale controls using existing helpers. | Desktop behavior stays intact; headset input and teardown pass on a supported device. Record device verification separately from Chromium viewport tests. |
| G05 blocked B4 | Verify remote graph delivery after the codec dependency is fixed. | Real remote Entities/Accounts render; selection, frame updates and teardown pass. Preserve `ops-workspace-graph.spec.ts`. |
| L01 open | Match reachable Wallet labels/settings with the existing locale catalog. | Existing translations update reactively and survive reload; no second translator/storage key. `wallet-localization.spec.ts`. |
| L02 open | Match remaining Ops panel/control labels with the existing locale catalog. Split by panel family. | Existing translated behavior is preserved for new/open/restored panels; custom titles stay user-owned. `ops-workspace-localization.spec.ts`. Do not expand this into translating unrelated legacy English copy. |
| L03 blocked B5 | Verify successful guide streaming, stop/cancel and context changes with the real service. | A real answer streams; closing/aborting releases the request, and context stays bound to the selected frame. `ops-workspace-guide.spec.ts`. Offline handling already passes. |

### Framework isolation — move ownership, preserve behavior

Work from leaf modules toward lifecycle owners. Inspect importers first. Move one dependency family at a time, update both real consumers and keep one implementation. Do not hide Svelte behind a new facade or expand a forbidden-import allowlist merely to pass a test.

| ID / status | Small task and starting point | Pass condition / dependencies |
|---|---|---|
| I01 open | Move remaining framework-neutral display/format/navigation helper families into their shared owners; Entity input and mascot geometry are closed in I01a–I01b. | Split remaining families into separate task worktrees; update both consumers and remove each old implementation. |
| I01a done — `tests/frontend/assets/entity-input-model.test.ts`; `output/plan-execution-20260906/i01-model-tests.log` | Move Entity input parsing/display to `frontend/packages/ui/src/entity-input-model.ts`. | Implementation bytes preserved; retained and React consumers plus inventory use the shared owner. 7 tests / 324 assertions and strict helper typecheck pass. Wallet typecheck has 19 diagnostics identical to baseline; root integration remains blocked B6. |
| I01b done — `output/plan-execution-20260906/i01b-tests.log` | Move mascot dock geometry and placement types to their shared UI owner. | Geometry body and types preserved byte-for-byte; retained and React consumers plus capability inventory updated, old implementation removed. 19 tests / 272 assertions, strict helper typecheck and unsafe-type check pass. No visible behavior change. |
| I02 open | Move graph projection/layout/timeline helpers and neutral network stores to shared packages. | Graph/playback consumers no longer depend on the retained tree; scenario/trail tests preserve exact frames and cleanup. |
| I03 open | Move locale and display-preference state to a neutral owner; retain catalog and storage contracts. | Both UIs consume the same state; locale/preferences/reload tests pass without transitive Svelte stores in that family. |
| I04 open | Extract vault metadata/selection subscriptions from `vaultStore.ts`. | Stable snapshots and selection behavior remain; no secret persistence or schema change. Existing vault/selection tests pass. |
| I05 open | Extract vault unlock/lock/expiry lifecycle after I04. | Existing authority policy is unchanged; visible owner tests pass for wrong seed, expiry, restoration failure and relock. |
| I06a open | Move the existing vault derivation orchestration after I04–I05. | Exact derivation/reveal/validation tests pass; no key algorithm or custody-policy change. |
| I06b open | Move worker scheduling, cancellation and cleanup after I06a. | Existing worker resilience/scheduling tests pass; closing/restarting UI does not leak workers or secret material. |
| I06c open | Move durable restore/session opening after I04–I05. | Strict restore and restoration-failure tests pass; no missing-state fallback or duplicate Runtime. |
| I06d open | Move backup/recovery-service orchestration after I06c. | Existing backup, recovery selection and push-wake evidence passes with unchanged formats and storage. |
| I07 open | Extract active Runtime/controller/command bridge glue from `xlnStore.ts` and `runtimeControllerStore.ts` after I04–I06d. | Runtime switching and final teardown preserve one owner; commands use the canonical bus and reject stale context. |
| I08 open | Remove remaining app-to-retained-tree imports and React `$lib` alias after I01–I07. | `tests/frontend/tooling/frontend-shared-boundaries.test.ts` passes unchanged, including the core-import contract. Resolve current Solvency/DB decoder ownership properly. No transitive Svelte dependency remains in React artifacts. |
| I08a done — `tests/frontend/tooling/frontend-generated-inputs.test.ts` | Declare the canonical Account worker emitted alongside the Runtime bundle and publish both exact artifacts to Wallet/Ops. | Real Ops preparation passes; 26 generated-input/assembly/gateway tests (152 assertions) and React tooling typecheck pass. The strict undeclared-output rejection is preserved. |
| I08b done — `output/plan-execution-20260906/svelte-scope-after.log` | Bind the retained Svelte checker to its exact Svelte config while React tooling keeps checking all four Vite configs. | False React-config failures reduced 4 → 0; all 19 existing Svelte type errors remain byte-identical. 7 scope tests / 25 assertions and React tooling typecheck pass. |
| I08c done — `output/plan-execution-20260906/brainvault-imports-tests.log` | Point Wallet onboarding and derivation bridges at the canonical BrainVault source locations after its move. | 18 real identity/recovery/derivation tests / 98 assertions and full Wallet build pass (2,026 modules). Four frontend files only; no BrainVault implementation, crypto, or custody change. Wallet typecheck retains 14 unrelated errors. |

### Final verification — separate runs, concrete outputs

These rows close the original Site/Docs, platform and parity work; passing a build alone does not close them.

| ID / status | Bounded verification task | Pass condition |
|---|---|---|
| V01 open | Verify Site links, retained interactions, direct loads and downloads. | `site.spec.ts` and `site-routes.spec.ts` cover reachable behavior at all three viewports. |
| V02 open | Verify Docs search, document selection, anchors, browser Back/Forward, direct links and errors. | Extend `docs.spec.ts` for missing interactions; real generated docs inputs and all three viewports pass. |
| V03 open | Reconcile typed route/capability/platform/parity inventories after implementation. | Every reachable capability has an owner and actual evidence; remove stale completion claims. `tests/frontend/tooling/frontend-parity-audit.test.ts` and inventory tests pass. Counts alone never imply parity. |
| V04 open | Run all frontend contracts, build and assemble one candidate after I08/V03 and affected flow tests pass. | All-app frontend gate and exact candidate byte verification pass; route/asset/worker outputs have one owner. |
| V05 open | Run the complete registered candidate browser matrix after V04. | Site/Docs/Wallet/Ops and cross-surface flows pass; inspect screenshots and errors. B1–B5 must be resolved for their positive-flow claims. No skips or weakened checks. |
| V06 open | Verify PWA lifecycle against that candidate. | Install/offline/update, service-worker scope and push-wake tests pass. Use `frontend/tests/pwa-candidate/lifecycle.spec.ts`. |
| V07 open | Verify native/packaged consumers one platform at a time. | Existing iOS/Android/desktop/extension consumers load the same candidate; deep links and lifecycle work. Use `frontend/config/platform-inventory.ts` to enumerate actual consumers; record unavailable device evidence explicitly. |
| V08 open | Verify isolated activation and whole-release rollback. | Existing deployment lifecycle tests accept valid bytes, reject invalid bytes and restore the previous candidate. `frontend/tests/deployment-candidate/lifecycle.spec.ts`. |
| V09 blocked B6 | Run `bun run check` from repository root on the final candidate. | The complete root gate passes; later gates are not claimed when an earlier gate stops. |

### Authorized finish

| ID / status | Task | Pass condition / dependencies |
|---|---|---|
| C01 open | Prepare a concrete canonical-cutover diff/checklist after V01–V09. | Identify exact dev/build/check/package/CI/native/deploy consumers, Svelte removals and rollback artifact. No runtime activation. |
| C02 owner authorization | Apply canonical cutover and retire Svelte after C01 review. | Canonical commands and consumers use React; retired Svelte source/config/dependencies and temporary coexistence wiring are deleted. Rerun affected frontend/root/consumer gates. |
| C03 separate release authorization | Activate the verified prebuilt release. | Applicable production smoke and rollback checks pass. Never compile on production. |

The refactor is complete after C02 and its evidence pass. C03 is the separate production release, not permission to start normal frontend tasks.

## External dependencies — not backend implementation tasks

Keep each failure visible. Resolve frontend causes locally; ask before a protected backend change. A blocked dependency does not justify claiming the affected positive flow works. If the same behavior also fails in the retained UI, record that baseline; do not silently change acceptance or invent a replacement feature.

| ID | Current dependency | Work it blocks |
|---|---|---|
| B1 | Existing Account admission profile rejects the real Lending positive-flow test. | W19 and complete positive-flow verification. |
| B2 | Backend Activity pagination can lose events at a same-frame page boundary. | W20 and its full-matrix result. |
| B3 | Compact remote settlement reads omit fields needed for complete review/approval/execution. | Remote portions of W09–W11. Preserve local work and genuine existing restrictions; no new projection API is authorized here. |
| B4 | Remote `graph-frame` wire encoding rejects `PersistentAccountStateMap` with `XLN_BINARY_CODEC_UNSUPPORTED`. A narrow core adapter-projection fix awaits scope approval. | G05. |
| B5 | Canonical assistant proxy's local AI upstream is offline. | L03 successful streaming evidence; offline UI is verified. |
| B6 partially resolved — root verification | Original report file-size and contract artifact blockers are resolved. B6a–B6d repair browser categories and all 19 stale frontend type errors; combined Svelte check is 0 errors / 0 warnings. Runtime typecheck, dead-code, audit-registry and size gates pass independently. Root runs still exceed the 30-second command budget. A separately reproduced folder-width gate rejects 28 directories; a structural fix is in progress. Evidence: `output/root-blockers-20260906/`. | V09 remains incomplete. No canceled or failing gate is claimed green; broader Rust/contracts require completed evidence. |
| B6a resolved — browser category metadata | Added required functional/resilience metadata to 97 declarations expanding to 107 previously uncategorized browser cases. All 260 tests enumerate successfully: 195 functional / 65 resilience. Removing only added metadata reproduces original bytes across all 42 files; titles, callbacks and assertions are unchanged. | Root test-category gate now passes. No browser flow or assertion is skipped. |
| B6b resolved — frontend read contracts | Align HLT ledger/replay decoding, current swap counters, in-memory recording WAL bytes and Runtime I/O log typing with canonical producers. HLT/I/O units 16/85 assertions and focused scenario regressions pass; real QA browser evidence passes in 3 viewports with 33 ledger records, 20 chart points and zero browser errors. Broader narration regression remains a reproduced baseline failure. Evidence: `output/root-blockers-20260906/read-contracts/` and `read-browser/`. | Five Svelte diagnostics resolved. Required root run passes artifact/file-size before the 30-second limit; `read-root.log` records incomplete later gates. |
| B6c resolved — retained frontend consumers | Read Account ACK deadlines and invoice notes from canonical Paybook entries in both callers. Remove unreachable node mnemonic reveal while retaining active secret cleanup; remove obsolete onboarding prop. Focused units 14/51 assertions and real Account browser cases in 3 viewports pass, screenshots inspected and zero browser errors. Evidence: `output/root-blockers-20260906/retained-browser/`. | Seven Svelte diagnostics resolved. Required root run passes artifact/file-size before the 30-second limit; later gates remain incomplete in `retained-root.log`. |
| B6d resolved — supported storage controls | Remove unsupported common/history quota controls from retained and React Settings; preserve exact WAL epoch rollover and unrelated snapshot policy. Units 3/19 assertions, React Settings 3/3 viewports and retained Settings 3/3 viewports pass with zero browser errors. Retained mobile dock clipping remains visible. Evidence: `output/root-blockers-20260906/storage-browser/`. | Seven Svelte diagnostics resolved. Canonical Runtime bundle and existing Dockview activation are required for retained evidence. Root run passes artifact/file-size before the 30-second limit; see `storage-root.log`. |
| B6e resolved — localization fixture source | Encode 19 Cyrillic assertion literals as Unicode escapes without changing their independent expected Russian values. TypeScript comparison preserves all 144 parsed strings and 2,291 tokens/trivia. English-source check passes with its allowlist unchanged; browser enumeration remains 9 cases across 3 files. Evidence: `output/root-blockers-20260906/localization-fixtures/`. | English-source gate resolved; no assertion or browser behavior changed. Required bounded root evidence remains separate in `localization-root.log`. |
| B6f resolved — source vocabulary | Clarify retained UI, default values and test-fixture vocabulary; name the Jurisdiction metadata lookup `getCatalogTokenInfo` consistently without changing lookup order. Vocabulary gate passes for 3,168 files with its four allowances unchanged. Affected checks pass 155 tests; two shared-boundary failures are reproduced on unchanged main. Evidence: `output/root-blockers-20260906/source-vocabulary/`. | Source vocabulary gate resolved with all assertions retained. Required root evidence remains incomplete under the 30-second budget in `vocabulary-root.log`. |
| B6g resolved — canonical payment test owner | Inspect the shared payment implementation rather than its retained forwarding module. Preserve every invariant assertion and add exact forwarding verification. Payment-surface gate passes 7/7 tests and 87 assertions. Evidence: `output/root-blockers-20260906/payment-contract-tests/`. | Payment verification boundary repaired with no implementation or protocol change. Required bounded root run remains incomplete in `payment-root.log`. |
| B6h resolved — exact external consumer proofs | Update MarketCap and QA proof paths to their actual shared consumers; remove a constants proof whose unused-symbol set is empty. Validator, use checks, frozen surface and ratchet are unchanged. Gate passes with runtime debt 0, external Runtime symbols 41, non-Runtime debt 0, new 0 and stale 0; adversarial tests 3/3 pass. Evidence: `output/root-blockers-20260906/consumer-proofs/`. | Unused-surface gate resolved by real import/use evidence. Required bounded root results remain separate in `consumer-root.log`. |
| B7 resolved — owner-authorized adapter fix | `compactEntityCoreForRemote` now preserves existing optional `entityProviderActionState`; no schema or transition change. Real release reads show 80 control / 40 dividend shares, confirmed nonce 1, and no pending release. Two projection regressions pass; broader API slice has the same 4 failures reproduced on unchanged main (8 passing after fix versus 6 baseline). Evidence: `output/plan-b6-b7-20260906/b7-browser/`. | W01/W01b unblocked. Full root verification remains separately incomplete under B6/V09: integrated candidate passes artifact drift/file-size then reaches the 30-second budget; see `output/plan-b6-b7-20260906/b7-root-check.log`. |

## Commands

Run frontend commands from `frontend/`; run `bun test tests/frontend/...` and `bun run check` from the repository root. Browser flows require the existing isolated fixture/network permissions. Do not attach tests to the user's live dev stack.

```bash
# Normal task: smallest relevant model test from the repository root.
bun test tests/frontend/<family>/<exact-test>.test.ts

# Frontend directory: affected app, then its registered browser slice.
bun scripts/check.ts --surface=wallet --level=local
bun scripts/check.ts --surface=wallet --level=slice --spec=tests/react-candidate/wallet-entity-evidence.spec.ts

# Final integration, after narrow failures are resolved.
bun scripts/check.ts --all --level=frontend
bun scripts/candidate-release-verifier.ts <release-directory-printed-by-assembly>
bun scripts/test-react-candidate.ts --all
```

Use `bun scripts/build.ts --surface=<app>` for an isolated build. Existing PWA/deployment commands live in `frontend/package.json`; review their isolated configuration before running. Keep failing tests registered and preserve their assertions. Use the actual supported CLI arguments, not commands copied from deleted historical plans.
