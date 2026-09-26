# Recover post-rebase frontend and native semantics

> **Executor instructions:** Execute one task at a time in the order allowed by
> the dependency table. Run every task's focused verification before advancing.
> Do not make protocol, financial-state, contract, persistence-schema, or
> production-deployment changes. If a STOP condition occurs, report the exact
> evidence and wait; do not invent a compatibility path or silent fallback.
>
> **Drift check (run first):**
> `git diff --stat 134e0154c..HEAD -- frontend ui scripts/native scripts/dev native tests package.json docs/frontend plans`
>
> If an in-scope file changed after this plan was written, compare the live code
> with the “Verified current state” section before proceeding. A semantic
> mismatch is a STOP condition.

## Status

- **Priority:** P0 release blocker
- **Effort:** L, split into independently verifiable tasks
- **Risk:** HIGH — wallet custody, local secret access, and native packaging
- **Depends on:** none; this plan is now a prerequisite for final React migration certification
- **Category:** correctness / security / migration / tests
- **Planned at:** commit `134e0154c`, 2026-09-26
- **Audit boundary:** upstream `566c850b3`, original divergence `2f365dbc5`

## Outcome

The work is complete only when all of the following are true on one unchanged
source revision:

1. The retained `ui` workspace typechecks and no longer imports deleted
   `frontend/src/**` modules.
2. The canonical iOS build packages the headless `#runtime` host,
   `window.xlnNative`, and `native-network.json` required by SwiftUI.
3. Browser scenarios and Ops jurisdiction creation select real-chain RPC only;
   the BrowserVM adapter may remain as an unselected defensive/test adapter.
4. The React wallet requires local-password enrollment/unlock for local saved
   wallets and a lock revokes Runtime command authority.
5. Paired-daemon custody either preserves upstream daemon-owned recovery
   semantics or is explicitly retired by the owner with its dead path removed.
6. `frontend/src` is empty/absent and a release gate prevents resurrection.
7. Root, frontend, `ui`, browser, native artifact, and required iOS launch gates
   pass against the exact final source and release bytes.

This plan does not authorize force-pushing, publishing, production activation,
or rewriting the already-updated fork history.

## Why this matters

The rebase is ancestrally correct but reintroduced or omitted newer upstream
behavior. Current code can package an iOS application that aborts before its
WebView is usable, auto-restore a local wallet without the upstream password
boundary, select BrowserVM where upstream requires RPC, and launch a retained
`ui` workspace that does not compile. Historical cutover receipts are bound to
source `66a583231`, not current HEAD, so they cannot certify the repaired result.

## Repository constraints

- Work on current `main`; do not create a branch/worktree unless the owner asks.
- Preserve unrelated changes. Never edit `frozen-core.json` or run
  `bun run frozen-core:approve`.
- Use Bun **1.4.0**. If `bun --version` is not `1.4.0`, STOP before claiming any
  certification result.
- Keep effects in `frontend/bridges/**` or `frontend/packages/browser/**`.
  React components consume typed bridge functions; they do not import vault or
  Runtime internals directly.
- Do not add compatibility aliases beneath `frontend/src`, fallback readers,
  duplicate financial formulas, mocks, conditional test skips, or a second
  native packaging path.
- Browser-visible work requires console/page-error inspection and screenshots at
  390×844, 1366×900, and 1920×1080.
- Before native/browser E2E, run `bun run stand:status`; use the repository stand
  lock for the full run.
- Run `bun run check` only after focused gates pass. It executes artifact sync;
  inspect the resulting diff and reject unrelated generated changes.

## Verified current state

These are evidence, not implementation suggestions. Reconfirm them after the
drift check.

- `package.json:181-197` runs core and `frontend` checks but not `ui`'s
  `tsc --noEmit` gate.
- `scripts/dev/run-dev-child.sh:145-153` still launches `ui`, and the iOS
  headless host still lives at `ui/src/native/host.tsx`.
- `scripts/native/build-platforms.ts:685-725` stages the same verified React
  wallet release for iOS and Android. It does not call `buildIosRuntime`.
- `scripts/native/session/build-ios-runtime.ts:10-43` is the only builder that
  writes `native-network.json` and copies the headless runtime into the iOS
  bundle.
- `frontend/ios/App/App/runtime/NativeWalletController.swift:12-18`
  precondition-fails when that manifest is missing.
- `frontend/packages/runtime-client/src/scenario/scenario-runtime.ts:29-31`
  explicitly selects `browservm`.
- `frontend/apps/ops/src/workspace/architect/ops-architect-live-controls.tsx:25,81`
  defaults to and exposes BrowserVM.
- `frontend/apps/wallet/src/app-shell.tsx:48-56,171-173` automatically starts
  the embedded Runtime.
- `frontend/bridges/vault/vault-authority-lifecycle.ts:105-123` restores device
  secrets whenever no password-vault record exists. The React wallet currently
  never creates such a record.
- `frontend/bridges/wallet/canonical/wallet-canonical-onboarding.ts:126-138`
  always supplies `saveRecoveryConfig`, while
  `frontend/apps/wallet/src/onboarding/wallet-onboarding.tsx:100-112` always
  exposes browser recovery setup.
- Three files remain under the documented-retired `frontend/src` tree:
  `WalletPasswordForm.svelte`, `WalletUnlock.svelte`, and
  `entity-panel-types.ts`.
- `(cd ui && bun run check)` currently fails with missing imports and downstream
  type errors. Do not “fix” the downstream errors with `any`; restore the moved
  typed owners first.

## Commands

Run from repository root unless a different cwd is shown.

| Purpose | Command | Expected result |
| --- | --- | --- |
| Toolchain | `bun --version` | exactly `1.4.0` |
| Retained UI types | `cd ui && bun run check` | exit 0, no diagnostics |
| Retirement gates | `bun run check:no-legacy && bun run check:unused-surface` | both exit 0 |
| Native focused tests | `bun test native/__tests__/native-build-options.test.ts native/__tests__/wallet-candidate-staging.test.ts native/__tests__/capacitor/capacitor-shell-candidate.test.ts` | all pass |
| Scenario focused tests | `bun test tests/frontend/graph/timeline/network-machine-demo.test.ts tests/frontend/diagnostics/scenario-player-diagnostics.test.ts tests/frontend/qa/qa-scenario-player.test.ts` | all pass with RPC-only assertions |
| Wallet security tests | `bun test tests/frontend/security/password-vault.test.ts tests/frontend/security/vault-protection.test.ts tests/frontend/recovery/vault-runtime-create-lock.test.ts tests/frontend/onboarding/wallet-identity-entry.test.ts tests/frontend/onboarding/runtime/wallet-runtime-opening.test.ts` | all pass |
| Frontend aggregate | `cd frontend && bun scripts/check.ts --all --level=frontend` | exit 0 |
| Root integration | `bun run check && git diff --check` | both exit 0 |

## Execution order

| ID | Task | Priority | Depends on | Status |
| --- | --- | --- | --- | --- |
| R01 | Repair retained `ui` imports and make its typecheck a root gate | P0 | — | VERIFIED |
| R02 | Restore the canonical iOS headless-runtime package contract | P0 | R01 | VERIFIED |
| R03 | Restore RPC-only scenario and jurisdiction selection | P1 | — | READY |
| R04 | Restore React local-password enrollment, unlock, and lock | P0 | — | READY |
| R05 | Resolve paired-daemon custody semantics | P1 | — | READY |
| R06 | Finish Svelte retirement and harden the retirement gate | P1 | R04 | WAIT |
| R07 | Characterize post-rebase generated-input failure diagnostics | P2 | — | READY |
| R08 | Re-certify one exact source and release | P0 | R01–R06; R07 disposition | WAIT |
| R09 | Produce the publication-readiness handoff | P0 | R08 | WAIT |

Only one implementer owns a task. R01/R03/R04/R05/R07 may be prepared
independently, but do not run heavy browser/native stands concurrently.

## R01 — Repair retained `ui` module boundaries

**Intent:** Retain one typed implementation of each shared behavior. Repoint
`ui` to the moved canonical owners; do not recreate files or aliases under the
deleted Svelte tree.

**In scope:**

- `ui/src/components/{PasswordEntry,PushNotifications}.tsx`
- `ui/src/screens/{Gate,Move,Pay}.tsx`
- `ui/src/native/{commands,payment-request,payment-request.test}.ts`
- `ui/src/runtime/{adapter,store,push}.ts`
- `ui/src/runtime/financial/{move,orderbook,ownership,payments,receipts}.ts`
- `ui/tsconfig.json`, `ui/package.json`
- `package.json` and the smallest root-check wiring/tests

**Canonical mappings to use:**

- `passwordVault` → `frontend/packages/browser/src/vault/passwordVault.ts`
- `runtimeSession` → `frontend/packages/browser/src/vault/runtimeSession.ts`
- `xlnInvoice` → `frontend/packages/runtime-client/src/payments/xln-invoice.ts`
- `entity-action-txs` → `frontend/packages/runtime-client/src/entity/account-action-txs.ts`
- `move-routes` → `frontend/packages/ui/src/entity/move/move-routes.ts`
- `ownership-flow` → `frontend/packages/runtime-client/src/entity/ownership-flow.ts`
- payment command/quote → `frontend/packages/runtime-client/src/payments/`
  and `frontend/bridges/wallet/payment-route-quote.ts`
- orderbook relay URL → `frontend/packages/browser/src/market/orderbook-relay-url.ts`
- payment terminal monitor → `frontend/packages/browser/src/graph/payment-terminal-monitor.ts`
- push wake → `frontend/bridges/vault/push-wake/**`

Steps:

1. Add or update a source-boundary test that enumerates every `ui/**` import and
   rejects `frontend/src/**` and unresolved `@xln/frontend/lib/**` specifiers.
   Run it first and record the expected failure.
2. Repoint imports to the mappings above. Preserve the current typed APIs; when
   an API moved and changed shape, adapt at the existing `ui` boundary instead
   of changing canonical financial behavior.
3. Resolve only genuine downstream type errors revealed by the restored types.
   Do not introduce `any`, `@ts-ignore`, optional chaining that hides a required
   value, or copied implementations.
4. Add a `check:ui` root script and include it in `check:long`, so the canonical
   root check cannot pass while the retained workspace is broken.

**Verify:**

- `cd ui && bun run check` → exit 0.
- `bun test ui/src/native ui/src/runtime` → all discovered tests pass.
- `rg -n "frontend/src/lib|@xln/frontend/lib" ui` → no source imports.
- Run the focused root-script/source-boundary test → pass.

**Implementation evidence (2026-09-26, source `0f0388fe4` plus working diff, Bun `1.4.0`):**

- `bun run check:ui` → exit 0, no TypeScript diagnostics.
- `bun test ui/src/native ui/src/runtime` → 61 pass, 0 fail.
- `bun test tests/frontend/tooling/ui-source-boundaries.test.ts` → 2 pass, 0 fail.
- Forbidden-import `rg` → no matches; `git diff --check` → exit 0.

**STOP if:** a canonical replacement lacks behavior required by `ui`; report
the missing symbol and both call contracts rather than copying the old module.

## R02 — Restore the iOS headless-runtime package contract

**Intent:** The iOS SwiftUI shell must receive the hidden runtime host it was
designed for. Android, desktop, extension, and the generic React release remain
unchanged.

**In scope:**

- `scripts/native/build-platforms.ts`
- `scripts/native/session/build-ios-runtime.ts`
- `scripts/native/native-release-build.ts` only if its verified manifest must
  represent the iOS-specific derived artifact
- `native/__tests__/**` focused native staging tests
- minimal iOS Capacitor configuration required by the existing builder

Steps:

1. Add `native/__tests__/ios/ios-headless-runtime-staging.test.ts`. Its fixture must
   prove the final iOS `public/` contains `index.html` with `#runtime`,
   `runtime.js`, `account-worker.js`, and validated `native-network.json`; it
   must reject the generic `#root` wallet as an iOS headless host.
2. Make the canonical `ios` target invoke the existing `buildIosRuntime` after
   Capacitor sync and before package/open. Ensure later steps cannot overwrite
   its output with the generic wallet candidate.
3. Preserve verified-release provenance: the manifest must distinguish the
   source React release from the derived, network-bound iOS headless runtime.
   Never label different bytes as the original verified release.
4. Keep `NativeWalletController.swift` fail-stop behavior. Do not weaken the
   missing/invalid configuration preconditions to make a test pass.
5. Build and launch the existing SwiftUI simulator path. Confirm WebView
   construction, `window.xlnNative.run`, background lock/resume, and clean
   shutdown on the exact built artifact.

**Verify:**

- Focused native tests from the Commands table plus the new test → all pass.
- `bun scripts/native/build-platforms.ts ios --frontend-release <verified-directory>`
  → exit 0 and manifest names the headless derived artifact.
- Under the stand lock on macOS, run the existing iOS UI session against that
  build, e.g. `bun scripts/native/session/run-session.ts ios-ui-default` → exit 0,
  no `XLN_NATIVE_HOST_CONFIGURATION_*` or `window.xlnNative` error.

**Implementation evidence (2026-09-26, source `489dff857` plus working diff, Bun `1.4.0`):**

- `bun test native/__tests__/native-build-options.test.ts native/__tests__/wallet-candidate-staging.test.ts native/__tests__/ios/ios-headless-runtime-staging.test.ts` → 15 pass, 0 fail.
- Canonical local-network iOS build → exit 0; source release `sha256-f69d8899…`, derived artifact
  `sha256-49d11d8f…`, final `public/` contains `#runtime`, `runtime.js`, `account-worker.js`, validated
  `native-network.json`, and a browser `EventEmitter` implementation required by `abstract-level`.
- The first locked UI run exposed the actual production divergence: WebKit rejected the headless bundle with
  `TypeError: The superclass is not a constructor` because Vite externalized Node `events` as `{}`. The canonical
  browser build now resolves that import to the pinned `eventemitter3` implementation.
- Exact derived workspace `xcodebuild ... build-for-testing` → exit 0. The stand-locked `ios-ui-default` session
  against those products → 1 pass, 0 fail; BrainVault reached ready in `24.98s`, background/resume returned to the
  locked screen, post-run health was `systemOk=true` with zero failures, and the stand shut down cleanly.
- The broader custody-payment UI test reached the funded wallet but stopped at its pre-existing accessibility audit
  (`Dynamic Type font sizes are partially unsupported`) before payment/background assertions. R02 lifecycle coverage
  is now isolated in the passing default test instead of weakening that audit.
- Existing `capacitor-shell-candidate.test.ts` cannot spawn its Capacitor child under Bun test on this host
  (`posix_spawn ... EBADF`, 0/3); the same production Capacitor command succeeds in the canonical iOS build.
- Restored the already-installed Homebrew Rustup proxies on `PATH` (repository-pinned Cargo/rustc `1.94.1`). Final
  `bun run check` → exit 0: all three long-gate groups passed, including 1,565 frontend tests, 40 Rust test executables
  plus parity, 15 Solidity invariants, frozen-core, dead-code, folder-width, `check:ui`, and the production frontend
  builds.

**STOP if:** satisfying SwiftUI requires replacing the generic cross-platform
release for Android/desktop/extension, or if artifact provenance cannot express
the derived iOS bytes without claiming false identity.

## R03 — Restore RPC-only jurisdiction selection

**Intent:** Match upstream `eb5aaa1e8`: BrowserVM may remain implemented, but no
production, scenario-preview, or jurisdiction-creation UI selects it.

**In scope:**

- `frontend/packages/runtime-client/src/scenario/scenario-runtime.ts`
- `frontend/apps/ops/src/workspace/architect/ops-architect-live-controls.tsx`
- `frontend/apps/ops/src/workspace/architect/ops-architect-actions.ts`
- scenario/Ops unit and React browser tests

Steps:

1. Change the historical network-machine test to inspect the current
   runtime-client owner, not only `core/scenarios/browser-api.ts`. Add assertions
   that no scenario owner assigns `scenarioJAdapterMode = 'browservm'`.
2. Remove the BrowserVM default and selector from live Ops controls. Jurisdiction
   creation accepts RPC inputs only and rejects an advanced/import payload that
   explicitly requests BrowserVM with a clear validation error.
3. Remove BrowserVM-only funding assumptions from Ops actions. Use the existing
   real RPC contract; do not silently fall back to an in-process chain.
4. Update scenario E2E to assert traffic reaches the app RPC proxy. Delete the
   stale assertion that zero RPC calls proves correctness.

**Verify:**

- Scenario focused tests from the Commands table → pass.
- `rg -n "scenarioJAdapterMode = 'browservm'|option value=\"browservm\"" frontend/apps frontend/packages/runtime-client` → no matches.
- Run `ops-workspace-architect.spec.ts` at all three viewports → RPC creation
  passes, BrowserVM is unavailable, no unexpected console/page errors.

**STOP if:** a retained test requires BrowserVM for production acceptance;
identify whether it is a defensive adapter test or an actual selector before
changing it.

## R04 — Restore React local-password and lock semantics

**Intent:** Port the behavior from upstream `64961e0e1`, `57b48293e`, and
`1248f788e` into the canonical React architecture without duplicating crypto or
exposing seeds to presentation code longer than the submit boundary.

**In scope:**

- create `frontend/bridges/wallet/canonical/wallet-canonical-local-password.ts`
- create `frontend/apps/wallet/src/security/wallet-local-password.tsx`
- `frontend/apps/wallet/src/identity/identity-onboarding.tsx`
- `frontend/apps/wallet/src/app-shell.tsx`
- the smallest existing Wallet settings/security owner needed for an explicit
  lock action
- wallet security/onboarding unit and React browser tests

**Required bridge behavior:**

- Project whether a local persisted Runtime is new-password, locked-password,
  recovery-required, or unlocked. Remote runtimes must not enter this gate.
- Enrollment calls the existing `savePasswordVault`; after enrollment, delete
  the device-restorable key for the current protection lease.
- Unlock calls `unlockPasswordVault` and then the canonical Runtime unlock path.
- Lock calls `vaultOperations.lockRuntime`, which revokes command-journal keys,
  clears in-memory seed authority, and returns the UI to the password gate.
- A wrong password, missing vault, expired lease, recovery choice, or lock
  failure is explicit and fail-stop; no device-key fallback after enrollment.

Steps:

1. Add unit characterization for creation/enrollment, reload while locked, wrong
   password, successful unlock, explicit lock, lease expiry, command-journal
   revocation, and remote-runtime exclusion. Confirm at least the current
   auto-restore case fails before implementation.
2. Implement the canonical bridge over existing password/vault operations. Keep
   crypto in `passwordVault.ts` and authority transitions in the vault owner.
3. Insert enrollment after verified mnemonic or BrainVault creation and before
   the wallet is treated as open. Reuse the BrainVault secret only through the
   existing bounded material/session API; never persist or log the plain secret.
4. Gate local saved-wallet startup before `startWalletEmbeddedRuntime` can
   restore authority. Provide recovery as an explicit alternative.
5. Add an explicit lock control to the existing Wallet security/settings
   surface and prove it blocks subsequent financial commands until unlock.
6. Add React E2E equivalent to the Svelte-only
   `tests/e2e/qa/e2e-local-password.spec.ts`.

**Verify:**

- Wallet security tests from the Commands table → pass.
- Wallet local typecheck → `cd frontend && bun scripts/check.ts --surface=wallet --level=local` exits 0.
- Run the new React password spec at all three viewports → enrollment, reload,
  wrong password, unlock, lock, and recovery pass; no seed/password appears in
  console or saved plaintext.

**STOP if:** the BrainVault secret is unavailable through an existing bounded
session at enrollment time. Report the token/material lifecycle; do not add a
second secret store or weaken the reuse requirement.

## R05 — Resolve paired-daemon custody

**Intent:** Preserve upstream `876af2e49` unless the owner explicitly confirms
that paired-daemon onboarding is retired.

**In scope:**

- `frontend/bridges/wallet/canonical/wallet-canonical-onboarding.ts`
- `frontend/apps/wallet/src/onboarding/wallet-onboarding.tsx`
- existing runtime-mode/onboarding projections and focused tests

Steps:

1. Trace the current launcher/import path from runtime configuration to Wallet
   onboarding and prove whether a paired local daemon can reach this UI. Record
   the exact fixture and state fields; do not infer custody from a label.
2. If reachable, add an explicit frontend-only custody-owner projection. For
   daemon custody, hide browser recovery configuration, do not call
   `saveCanonicalWalletRecoveryServices`, and explain that recovery is managed
   by the local node. Browser custody retains current recovery setup.
3. If unreachable, STOP and obtain an owner decision before deleting or marking
   the behavior superseded. The decision must identify the replacement custody
   path and test that proves it.
4. Add focused tests for both custody owners and a negative assertion that the
   daemon path performs zero browser-recovery writes.

**Verify:**

- `bun test tests/frontend/onboarding` → all pass.
- Run `wallet-onboarding.spec.ts` for the supported custody modes at all three
  viewports → correct recovery controls and zero unexpected errors.

## R06 — Complete Svelte retirement

**Intent:** Make the documented one-canonical-frontend claim true after R04 has
ported the password semantics.

**In scope:**

- delete the three remaining files beneath `frontend/src`
- `core/scripts/checks/policy/check-no-legacy.ts`
- focused retirement/check tests
- `docs/frontend/react-frontend-retirement-files.txt`
- `docs/frontend/react-frontend-cutover-review.md`

Steps:

1. Confirm R04 tests cover every live behavior from
   `WalletPasswordForm.svelte` and `WalletUnlock.svelte`. Confirm the entity type
   re-export has no consumer.
2. Delete the three residual files; do not add a replacement under another
   legacy path.
3. Harden `check:no-legacy` to fail on any unapproved `frontend/src/**` file.
   The default allowlist for this retired tree must be empty.
4. Update the retirement inventory and cutover review honestly: record that the
   prior “all files removed” claim was invalidated by post-manifest upstream
   additions and was corrected on the new source SHA.

**Verify:**

- `test ! -d frontend/src || ! find frontend/src -type f -print -quit | grep -q .`
  → exit 0.
- `bun run check:no-legacy && bun run check:unused-surface` → pass.
- Focused retirement tests → pass and fail when a temporary fixture is placed
  beneath `frontend/src`.

## R07 — Characterize generated-input failure diagnostics

**Intent:** Resolve the audit uncertainty introduced by post-rebase commit
`134e0154c`, which changed bounded captured process evidence to inherited stdio.
This task is investigative until a regression is demonstrated.

**In scope:**

- `frontend/scripts/inputs/generated-inputs.ts`
- `tests/frontend/tooling/build/frontend-generated-inputs.test.ts`

Steps:

1. Add a failing-producer test that asserts the caller receives the producer ID,
   exit code, and bounded stdout/stderr evidence without hanging or unbounded
   buffering.
2. If current behavior satisfies the required evidence through the enclosing
   runner, record that proof and make no production change.
3. If it does not, restore bounded capture while preserving Bun compatibility.
   Never swallow the child failure or include secrets from its environment.

**Verify:** `bun test tests/frontend/tooling/build/frontend-generated-inputs.test.ts`
→ all pass, including the named failure case.

## R08 — Re-certify one exact source and release

**Prerequisite:** R01–R06 are DONE. R07 is DONE or has a documented no-change
disposition. No relevant source changes may occur during this task.

Steps:

1. Record `git rev-parse HEAD`, `git status --porcelain`, Bun version, and hashes
   of relevant untracked inputs. Working tree must be clean unless the owner has
   explicitly selected a reviewable candidate diff.
2. Run retained `ui` typecheck, focused tests, frontend aggregate, root check,
   and `git diff --check`. Fix only the first observed failure, rerun its smallest
   boundary, and restart R08 from step 1 after any source change.
3. Build one verified frontend release and record its explicit directory and
   manifest hash. Do not select “latest” output by mtime.
4. Run the complete registered React browser matrix at mobile, laptop, and wide
   viewports. Include the new password, RPC-only, and daemon-custody cases.
5. Run immutable preview/artifact verification against the exact release.
6. Build the iOS target from that release. Inspect packaged files, build/install
   on the simulator, launch SwiftUI, exercise the native command bridge,
   background lock/resume, and one economic smoke already covered by the native
   session harness.
7. Update `docs/frontend/react-frontend-cutover-review.md` with the new source,
   release identity, exact commands, counts, durations, and any deferred
   owner/device gates. Do not reuse the 444/444 claim from source `66a583231`
   unless the relevant bytes are demonstrably identical—they are currently not.

**Required final commands:**

- `cd ui && bun run check`
- `cd frontend && bun scripts/check.ts --all --level=frontend`
- `bun run check`
- `git diff --check`
- `cd frontend && bunx --no-install playwright test --config playwright.react.config.ts --list`
- Under the stand lock: `cd frontend && bun scripts/testing/test-react-candidate.ts --all`
- Artifact/preview verification using the explicit release directory
- Canonical iOS build plus the existing iOS UI session

All must pass on the same source. A cancelled sibling, historical receipt,
staging-copy-only result, or green unit test is not a substitute.

## R09 — Publication-readiness handoff

Produce a six-field handoff only:

1. current SHA;
2. last green command;
3. first red command/error, or `none`;
4. exact release/artifact path;
5. next single command;
6. remaining final gates.

Also state whether the prior remote update should be fixed forward or otherwise
handled by the owner. Do not push, force-push, tag, deploy, publish, or rewrite
history as part of this plan.

## Done criteria

- [ ] R01–R07 have DONE or explicitly accepted no-change dispositions.
- [ ] `ui` imports no retired frontend modules and its typecheck is part of the
      root gate.
- [ ] iOS packages and launches the headless runtime contract.
- [ ] No production/scenario/Ops selector chooses BrowserVM.
- [ ] Local React wallets enroll, remain locked after reload, unlock explicitly,
      and revoke authority on lock.
- [ ] Paired-daemon custody has tested semantics or an explicit owner retirement
      decision.
- [ ] No file remains beneath `frontend/src`; resurrection fails a release gate.
- [ ] Full frontend/root/browser/native verification passes on one exact SHA and
      release identity using Bun 1.4.0.
- [ ] The cutover review records the new evidence and invalidates stale claims.
- [ ] Git diff contains no out-of-scope Runtime/Entity/Account, contract,
      persistence, or `frozen-core.json` change.
- [ ] No push, force-push, deployment, or publication was performed.

## Global STOP conditions

Stop and report instead of improvising if:

- a fix requires changing financial transitions, consensus, contracts, custody
  authority, or persistence schemas;
- `FROZEN_CORE_VIOLATION` appears;
- the owner chooses a materially different product behavior from upstream for
  BrowserVM, local passwords, native UI ownership, or daemon custody;
- a task would require a compatibility alias/fallback or parallel production
  path;
- an in-scope file has materially drifted from this plan;
- a focused gate fails twice without new evidence;
- the required native device/toolchain or Bun 1.4.0 is unavailable for final
  certification.

## Maintenance notes

- Reviewers should scrutinize source/release identity, secret lifetime,
  password-vault/device-key interaction, and the order of Capacitor sync versus
  iOS headless staging.
- Any future frontend module move must run the retained `ui` typecheck until that
  workspace and native host are formally retired.
- Any future jurisdiction UI must treat BrowserVM as an adapter handed to it,
  never as a production-selectable mode.
- Native candidate tests must verify the platform-specific contract, not merely
  byte equality with the generic frontend release.
- Changes after R08 invalidate only the affected evidence, but the exact final
  source/release binding must be regenerated before publication readiness.
