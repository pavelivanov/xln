# react frontend cutover review

Prepared at source `7a603c4b5021c924a2ce852abdbefda9b605bf95` for C01 in
[the migration plan](../../plans/react-frontend-migration.md). This is an unapplied
review package. C02 and C03 have not been authorized or executed.

## Original reviewed candidate and rollback identity

- Original reviewed release: `sha256-c6a559bf37c43a6e26bc3b0b99e9af40180faec821b674d70912222592abf517`,
  470 files under `frontend/.artifacts/releases/`.
- Native Wallet stage: the same release ID under `native/dist/candidates/`, 94 files.
- Desktop/extension workspace: that release under `native/dist/packaged-candidates/`,
  child `sha256-a6d4b234ee417d85a8555df66e5ca61225406e5ab1352245e1b0670892dbeaa6`,
  197 files. Extension opening, settings, reload and reopen pass at all three viewports.
- Previous verified immutable candidate:
  `sha256-dfba1e753b429f2a80fa00519849c2d0877c53de122cd95e739022f294ed0910`.
  Its PWA and isolated activation/rollback checks passed before the extension fix.
  This is a local candidate rollback identity; the currently deployed production
  release has not been inspected or selected as a production rollback target.

Every consumer must take an explicit verified directory and carry its release ID.
Never choose the newest directory by timestamp or recreate the frontend on a
production host. Verify exact bytes before copying and after installation.

## Prepared root development consumer

Run `XLN_DEV_FRONTEND=react bun run dev` from the repository root to exercise the React selection through the existing capability-protected supervisor. This replaces both Svelte listeners with four internal app servers and one public gateway at 8080. The existing TLS certificate selection controls that gateway; readiness, relay audiences, custody Wallet links and manager origins use the selected scheme. Runtime/worker requests read the canonical watched outputs rather than a stale prepared copy. Backend barriers, unrelated `ui/` and owned cleanup remain in place. Remove the temporary selection and retired roles during C02.

The frontend plus affected supervisor suite passes 1,542 tests / 11,814 assertions. A real Node gateway passes HTTPS and active WebSocket shutdown checks; all app/tooling typechecks pass. The attempted actual root launch stops before mutation because an unrelated Homebrew nginx service owns 8080. Temporary stop/restore authorization is pending. Full-stack HMR/auth/shutdown acceptance remains open. Evidence and executed browser runner: `output/playwright/react-dev-consumer-20260914/`.

## Prepared native and distribution consumers

`bun scripts/native/build-platforms.ts <target> --frontend-release <directory>` consumes one verified release. Mobile sync and signing run in disposable copies of the canonical verified shells; desktop signing checks the copied payload first; extension packaging preserves the verified `app.html` entry. Inputs and mobile payload/configuration are verified again after platform tools. `--no-build` and implicit Svelte rebuilding/sanitization are retired. Signing credentials, signer identity, native CSP and package integrity guards remain.

Actual iOS and Android sync passes in the copied workspaces. Extension action → Settings → preferences → reload/reopen passes all three viewports; all 97 ZIP files match the copied layout. The archive is exploratory: its old 0.1.32 filename conflicts with the embedded 0.1.31 version. Packaging now fails before signing until VERSION/frontend/extension and root/npm versions agree; the owner decision is pending. No platform binary build, device lifecycle or signed release is claimed.

The distribution workflow now prepares one React release, exports the assembler-selected ID, transfers a tar archive and verifies it in each platform job. npm and native commands receive the same explicit directory. All existing release/tag/signing gates remain. This is prepared workflow source and local transfer evidence, not a hosted Actions run. The focused workflow contracts pass; the broader release-gate suite still has an unrelated count mismatch (25 expected cross-j tests, 26 present).

Native tooling is included in the regular frontend tooling typecheck. The obsolete `bundledWebRuntime: false` setting was removed as documented in [Capacitor's migration guide](https://capacitorjs.com/docs/next/updating/7-0). Evidence and exact runners: `output/playwright/react-native-consumer-20260914/`.

## Implemented consumer preparation

The owner requested implementation of the recommended completion order on 2026-09-14.
Current source is `cc11c96158c9f413869424d9c74d022cbe0311ec` plus the working diff.

- `bun run preview:react <release-directory>` (frontend cwd) verifies one explicit release and serves it at `127.0.0.1:8080`. `XLN_REACT_GATEWAY_PORT`, `XLN_REACT_EDGE_TARGET` (default `http://127.0.0.1:8082`) and `XLN_REACT_EDGE_WEBSOCKET_TARGET` configure isolated checks or the existing backend. Only Node server tooling is bundled; application bytes are not rebuilt.
- `bun run test:preview:react <release-directory>` verifies every served file, four app routes, redirects, HEAD/method handling, missing/corrupt input rejection and clean shutdown using a disposable copy. The recorded 470-file release passes; this is consumer evidence, not acceptance of final application bytes.
- `packages/frontend-release/` owns the canonical route contract, manifest types, verifier, public redirects and verified HTTP serving. Preview, artifact tests, native staging and production static serving consume that owner. The frontend verifier filename remains a CLI entry, with its implementation in the neutral package.
- `bun scripts/release/build-xlnfinance-package.ts --frontend-release <release-directory> --skip-build --pack` packages that explicit verified release with the current server/worker bundles. `--skip-build` skips the separate root Runtime build; it never permits missing frontend bytes. The package contains `app/<release-id>/` plus `dist/frontend-release.json`. The launcher passes `--frontend-release` to the actual server, which verifies before Runtime initialization and never falls through to Svelte/check-out files when that option is selected.

Evidence: `output/playwright/react-consumers-20260914/`. The package is local only;
canonical dev/check commands, native distribution, CI and deployment integration
are still being prepared. C02/C03 acceptance and production activation are outstanding.

## Reviewable command patch

[react-frontend-cutover-commands.patch](react-frontend-cutover-commands.patch)
contains the canonical frontend command/dependency changes and the ordinary build
CI verification step. `git apply --check --unidiff-zero` passes against the preparation source.
The patch is deliberately unapplied and must land atomically with the consumer
changes and retirement below. It is not a standalone working cutover.

The patch makes `dev` use the existing four-root gateway; `build` prepares all
inputs, builds all roots and assembles the immutable release; `check` runs the
frontend gate and the complete `tests/frontend` suite from the repository root.
It removes Svelte-only commands and dependencies. Lockfiles must be regenerated by
Bun after the reviewed retirement, never edited by hand. The updated patch restores canonical preview using the implemented explicit-release consumer.

## Consumer changes and acceptance

| Consumer / exact owner                                                                                                                    | Required cutover change                                                                                                                                                                                                                                                                                                                                                                                                                                                | Evidence needed before C02                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `package.json` (`dev`, `build`, `check:frontend`, `build:static`)                                                                    | Keep Runtime build/check ownership. Existing frontend delegates must resolve to the patched canonical frontend commands. Keep the dev singleton, capability and owned shutdown in `scripts/dev/run-dev.ts`.                                                                                                                                                                                                                                                            | Root check green; one canonical frontend listener at `localhost:8080`; clean owned shutdown.                                                                                                                                                                                                                                                                |
| `scripts/dev/run-dev-child.sh:122` and `scripts/dev/supervise-dev.ts:9`                                                                   | Replace the two Svelte Vite children with one supervised React `scripts/dev.ts --all` child. Point `XLN_REACT_EDGE_TARGET` at the existing API port and the relay WebSocket target at its existing owner. Remove the obsolete Svelte child role only in the same change; preserve unrelated `ui/`, backend readiness and process ownership. Reconcile the existing HTTPS listener with the React gateway's single port.                                                | Real dev bootstrap, HTTP/WS auth, RPC, relay, HMR for all four roots, signal cleanup; no second process using port 8080. Current root launch rejects the unrelated nginx listener on 8080; stopping/restoring it needs the pending owner decision. Rust/Cargo 1.94.1 are installed and available through the pinned toolchain PATH.                         |
| `scripts/release/build-xlnfinance-package.ts:26,84`                                                                                       | Replace implicit `frontend/build` discovery with a required verified release input. Copy the complete declared release, manifest and generated inputs into the package's `app/`; remove the old Docs/LLM asset filter because the release now owns `/docs`. Keep server/worker build and signed release policy intact.                                                                                                                                                 | Pack and launch the real npm artifact, request Site/Docs/Wallet/Ops and nested routes, check exact returned hashes and existing API behavior.                                                                                                                                                                                                               |
| `core/api/server/static-assets.ts:60` and `core/api/server/index.ts:964`                                                                  | The current static owner falls back to a single root `index.html`; the release has four `apps/<surface>/index.html` entries. Integrate canonical route ownership and verified release serving, including exact generated assets, unknown-path rejection and no Runtime bundle fallback. The existing `packages/frontend-release/serve.ts` establishes the tested semantics, but production ownership must be resolved without a Runtime-to-frontend layering shortcut. | Implemented under the owner’s request to implement the recommended sequence: the explicit `--frontend-release` option verifies before Runtime initialization and consumes the neutral release HTTP owner. Offline installed-package route/API proof passes; remaining final launcher/lifecycle acceptance is open.                                          |
| `scripts/native/build-platforms.ts:282`                                                                                                   | Implemented explicit verified release → Wallet stage → copied native workspaces, replacing implicit build/sanitization. Complete version reconciliation, actual binaries and platform acceptance.                                                                                                                                                                                                                                                                      | The exact candidate must pass each actual platform build/launch/lifecycle gate. Copy/hash tests alone cannot replace these gates.                                                                                                                                                                                                                           |
| `frontend/capacitor.config.ts`, `frontend/ios`, `frontend/android`                                                                        | Consume the generated config and `www` from `copy-capacitor-shell-candidate.ts`; do not repoint the live workspace to mutable `frontend/build`. Resolve workspace package dependencies only in disposable execution copies.                                                                                                                                                                                                                                            | iOS deep link, background/resume, reload/storage; equivalent Android cases. iOS build exceeded 30 seconds; Android SDK/ADB absent.                                                                                                                                                                                                                          |
| `native/desktop/main.cjs`, `native/extension/*`                                                                                           | Consume `copy-packaged-shell-candidate.ts` output; keep desktop sandbox/context isolation/CSP and extension manifest restrictions. Wallet extension entry mapping is fixed and verified. Desktop must use the copied root and real Electron binary.                                                                                                                                                                                                                    | Desktop launch, deep link, reload/storage and close/reopen are outstanding. Extension route/storage lifecycle is green; this does not certify Runtime consensus or unavailable cross-surface native pages.                                                                                                                                                  |
| `scripts/deployment/deploy-platform.sh`, `frontend-release.ts`, `frontend-transfer.sh`, `packages/frontend-release/deployment{,-http}.ts` | Implemented explicit prebuilt transfer and whole-release activation/rollback with expected-active guards and live route hashes. Frontend-only activation preserves checkout and Runtime processes. The orchestrator follows the verified store through its HTTP boundary; the prepared nginx template proxies frontend routes to it.                                                                                                                                   | Real isolated nginx install/update/corruption/stale-state/rollback and failed-edge automatic recovery pass against explicit 473/470-file releases. Actual deployed edge/TLS/API/WS and SSH transport acceptance remain open; the read-only host inspection failed host-key verification. Production rollback identity must come from the actual deployment. |
| `.github/workflows/build-and-test.yml:104`                                                                                                | Apply the supplied command patch; canonical frontend check includes all units and assembly. Upload the exact release plus manifest if downstream jobs consume it.                                                                                                                                                                                                                                                                                                      | Complete frontend units/browser matrix, immutable artifact flows at all three viewports.                                                                                                                                                                                                                                                                    |
| `.github/workflows/distribution-release.yml:53,79,109,125`                                                                                | Prepared one frontend producer and explicit verified transfers to each platform consumer. Existing integrity/signing gates remain; execute the hosted workflow after final scope/version and release readiness.                                                                                                                                                                                                                                                        | Same release ID in npm/macOS/extension/Android outputs, actual platform smoke and signed artifact integrity; no per-platform frontend rebuild.                                                                                                                                                                                                              |
| PWA and public redirects                                                                                                                  | Use the current generated service-worker plan and release identity. Preserve `/admin`, `/radapter`, `/resetdb`, API/WS and generated assets from the existing route policy.                                                                                                                                                                                                                                                                                            | Final-candidate install/offline/update/rejected update/cache rollback/push wake, plus direct/nested/Back/Forward navigation.                                                                                                                                                                                                                                |

## Retirement and retained code

[react-frontend-retirement-files.txt](react-frontend-retirement-files.txt) names
**274 existing paths**: **268 retained-source files**, four Svelte configurations and two obsolete preview/build wrappers selected from the preparation source. This is a reviewed
candidate deletion list, not a deletion command. Do not remove `frontend/src`
wholesale: shared helpers and retained tests still use it.

Preserve `frontend/apps`, `frontend/packages`, `frontend/bridges`, the React
configs/tooling, `frontend/static`, generated-input producers and canonical
Runtime/worker inputs. In particular, `copy-static-files.js --docs-only` remains a
React Docs producer, and contract/static assets are not Svelte build output.

The previously identified bridge relocations are complete: `frontend/bridges/vault/vault-metadata-store.ts` reads the neutral runtime-client boundary, and `frontend/bridges/vault/wallet-runtime-opening-adapter.ts` reads `frontend/bridges/runtime/remote-runtime-validation.ts`. Keep their current owners. All previously identified direct test imports are migrated in the latest continuation below; retained-source-reading assertions still require separate reconciliation before retirement.

Retarget useful tests to canonical React/shared owners before deleting retained
source. `frontend-shared-boundaries.test.ts` currently requires live Svelte
consumers; replace that coexistence assertion with the final dependency boundary
only during C02. Retain its domain-purity and browser-effect assertions.
`frontend-parity-audit.test.ts`, `frontend-wallet-flow-audit.test.ts` and platform
inventory checks reference retained owners and must be updated to the final
routes/evidence. Preserve positive financial, recovery, pagination and signature
assertions. No test may be deleted to hide B1/B2/B3/B8/B9 or R03.

After accepted parity and deletion, remove candidate placeholder shells and
coexistence-only scripts/styles with no remaining consumers, retain useful React
browser tests under their canonical command, and remove the temporary override
from `AGENTS.md` as the plan requires. Regenerate locks and rerun affected checks.

## What prevents final binding

Consumer preparation is implemented in the working diff, but final acceptance still requires the real root dev/npm launcher lifecycle, protected B1/B2/B3/B8 decisions and evidence, complete final-source browser coverage, actual iOS/Android/desktop/headset execution, version reconciliation, and a green root gate. R03 BrainVault acceptance is 24/24 and B9 signed-data verification is complete; neither is an unresolved implementation choice. Rust/Cargo 1.94.1 are installed. The shared governance dependency is repaired; the latest root integration remains blocked by folder-width violations.

The last built 477-file live-recovery release, which predates the current Move allowance, shared batch and Health event changes, has passing results for all 12 immutable browser cases across bounded runs, PWA/isolated deployment lifecycle, verified native copies, and three actual copied-extension viewports. These are recorded with source/release provenance in section 7 of `plans/react-frontend-migration.md`; they do not certify the remaining platform or launcher requirements. This cutover-review update follows that build and will change generated Docs inputs at final assembly. The command patch remains unapplied; C02 source retirement and C03 production activation still require explicit authority.

### Verified deployment consumer commands

The frontend deployment commands consume an existing verified release store. Initial production cutover must identify the actual rollback baseline and prepare the backend/edge under separate C02/C03 authority. Do not initialize a production store using an arbitrary historical candidate. For an isolated store only, `bun scripts/deployment/frontend-release.ts initialize <absolute-store> <verified-baseline-directory>` refuses an already initialized store.

```bash
bash scripts/deployment/deploy-platform.sh --frontend-only \
  --frontend-release <absolute-verified-release-directory> \
  --frontend-root <absolute-store> \
  --expected-frontend-active <sha256-current-id> \
  --frontend-origin <http-or-https-origin>

bash scripts/deployment/deploy-platform.sh --frontend-rollback \
  --frontend-root <absolute-store> \
  --expected-frontend-active <sha256-current-id> \
  --frontend-origin <http-or-https-origin>
```

For an authorized remote operation add `--remote <user@host>`. The store path is on that host; the release directory is local. Existing clean-source and optional push guards remain. The portable controller is bundled locally, and only its verified release payload and controller are transferred. No frontend app compilation, checkout reset, or Runtime restart occurs in frontend-only mode. `--runtime-only --production` verifies the selected store before Runtime work and exports `XLN_FRONTEND_DEPLOYMENT_ROOT` to the existing process launcher. Ordinary local Runtime-only mode may retain the Svelte default until C02.

Before/after checks require the exact release ID and SHA-256 body for `/`, `/docs`, `/app`, `/health`, `/runtime.js`, and `/account-worker.js`. Failed post-activation checks attempt a guarded whole-release rollback and verify the former live release; original failure evidence is printed. The controller does not undo another operator's concurrent activation. Active or rollback store corruption fails closed and requires restoring verified bytes before another transition.

The prepared `frontend/nginx-example.conf` preserves its existing API/RPC proxies, reset response, frame-ancestor policy and TLS paths while proxying frontend routes to the verified backend. It is not an automatic replacement for the unknown deployed configuration, which can also contain custody/custom routes. The local lifecycle derives isolated HTTP listeners from this template; it proves nginx routing and byte selection, not production TLS or complete-stack authentication.

Evidence: `output/playwright/react-deployment-consumer-20260914/{check-deployment.ts,lifecycle-receipts.json,lifecycle.log}`; **8 operations / 12.15 s**, source releases **473/470 files** unchanged. Frontend units **1,521 pass**, four-app/tooling check **25.05 s**, and focused deployment tests pass. Broader startup failures and the final root gate are recorded in the migration plan.

### Installed npm preflight and server evidence

The shipped launcher now calls the bundled neutral release verifier before creating state or querying a daemon. The obsolete `app/app.html` requirement is removed; the exact `dist/frontend-release.json` identity selects `app/<release-id>`. The standalone server still independently verifies this release before Runtime initialization.

```bash
bun scripts/release/check-xlnfinance-frontend.ts \
  --archive <absolute-local-npm-tgz> --output <absolute-receipt-json>
```

This check offline-installs the real archive and tests an owned copy so mutations cannot affect Bun's hard-linked cache. Eight cases cover valid/restored preflight, malformed/path-escape/extra-field pointers, corrupted Wallet HTML and missing manifest. All rejection cases execute the real CLI and prove that no state was created. Prepared CI runs this check after `release:launcher:verify` and before signing.

`output/playwright/react-npm-launcher-20260914/` retains the local **486-file** archive receipt and **8-case** preflight proof. A separate actual installed-server run verifies six exact release routes, pairing authority/origin/replay guards, admin WebSocket reads and termination on an isolated port. Signal exit **143** and WebSocket close **1006** are recorded; graceful persistence shutdown/recovery is not claimed. Full CLI startup/status/stop still needs canonical port 8080, currently occupied by unrelated nginx. This is historical-release consumer acceptance, not final-version or final-application acceptance.

### Refreshed Svelte retirement dependencies

`react-frontend-retirement-files.txt` now lists **274** existing retirement candidates: all **268** remaining tracked files under `frontend/src`, four Svelte configuration files, and the obsolete preview/build-check wrappers. The earlier 177-line list omitted retained-source helpers/styles and obsolete wrappers; the current list reflects subsequent shared-owner relocations. The list is a conditional C02 deletion proposal; none of these files have been deleted. Preserve `frontend/static`, shared packages/bridges, generated-input producers, security configuration and Docs copying.

Six direct imports through existing forwarding modules were retargeted in six frontend-owned test files to their canonical owners. One old BrainVault test also imported telemetry exports that had moved to the browser worker validator and asserted worker code still lived in the Svelte view. Its unchanged telemetry cases now call the real validator; its input-panel and handler-cleanup assertions now inspect the React form and current browser derivation owner. All **26 focused cases / 1,171 assertions** pass. The active shared-boundary graph check also follows neutral `packages/frontend-release` imports, preventing a forwarding hop outside `frontend/` from hiding a Svelte dependency.

`react-frontend-retirement-guards.patch` is an **unapplied** seven-file companion to the command cutover patch. It retargets capability/platform sources and shared-package liveness to React, replaces the Svelte-page enumeration with exact coverage of canonical app route rules plus distinct representative cases, and preserves every gap/owner/behavior claim. No acceptance status is promoted. It passes **33 tests / 1,044 assertions** across shared-boundary, parity, capability, platform, route and Wallet-flow inventories in a disposable copy with all 274 proposed paths absent. Latest evidence: `output/playwright/react-health-events-20260915/without-svelte-receipts.json`. This is a focused guard proof, not the full frontend suite after retirement.

```bash
git apply --check --unidiff-zero docs/frontend/react-frontend-retirement-guards.patch
# The executable preparation and disposable verification scripts are retained in:
# output/playwright/react-retirement-20260915/{prepare-retirement.py,verify-retirement.py}
```

The following **11 remaining direct import edges** require deliberate adapter/test migration before deletion. Identical exported names are not proof of equivalent interfaces. The Solvency test now composes the canonical calculator with the neutral display projection, preserving its exact amounts and malformed-input rejection; its wiring assertions target the React live/recorded reads and cleanup. The focused two-file run passes 6 tests / 32 assertions. Preserve the existing semantic assertions when moving the remaining tests. Current import evidence is in `output/playwright/react-health-events-20260915/import-report.json`. Health event classification now has one shared UI owner, consumed by both retained Svelte and the restored React event feed; its original assertions are preserved. Real filters, details, authority loss and reconnect pass on all three viewports. Remaining Health panels and positive aggregate endpoint acceptance are still open. Pending-batch actions now use one browser runner in retained Svelte and React, preserving exact-review and canonical submission guards. The real clear, broadcast/finality and local settlement retry flows pass 9/9 across three viewports in `react-batch-actions-20260915/`. Count/state/eligibility and action payloads have a shared runtime-client owner; the exact existing global-bar and React clear reasons are preserved. The retained reserve-preview/preflight owner remains in place and its migration is still open. The Move allowance helper is now shared by React and retained Svelte, with its body unchanged; existing assertions and real insufficient/sufficient approval coverage are preserved. Recovery coverage now has one shared projection owner in `frontend/bridges/wallet/recovery-coverage.ts`, consumed by retained Svelte and React; its existing receipt/failure/peer tests are preserved. Source-text assertions elsewhere also still read Svelte files; these are not covered by the direct-import count or the focused guard patch. Retarget their UI/effect boundaries individually, preserving the existing React browser evidence; do not delete whole suites or treat negative-path strings as live imports.

| Consumer test                                                                  | Retained module                                                             |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `core/__tests__/development/frontend/token-metadata-rendering.test.ts`         | `frontend/src/lib/components/Entity/swap/swap-order-history.ts`             |
| `core/__tests__/entity/consensus/invariants/entity-consensus-settings.test.ts` | `frontend/src/lib/components/Entity/workspace/entity-consensus-settings.ts` |
| `core/__tests__/payments/orderbook/orderbook-relay-url.test.ts`                | `frontend/src/lib/components/Trading/orderbook-relay-url.ts`                |
| `tests/frontend/assets/entity-shared-formatters.test.ts`                       | `frontend/src/lib/view/components/entity/shared/formatters.ts`              |
| `tests/frontend/graph/timeline/runtime-graph-projection.test.ts`               | `frontend/src/lib/network3d/ImmersiveWalletSurface.ts`                      |
| `tests/frontend/runtime/runtime-navigation-view.test.ts`                       | `frontend/src/lib/components/Navigation/runtime-navigation-view.ts`         |
| `tests/frontend/swap/swap-order-history.test.ts`                               | `frontend/src/lib/components/Entity/swap/swap-order-history.ts`             |
| `tests/frontend/swap/swap-order-math.test.ts`                                  | `frontend/src/lib/components/Entity/swap/swap-order-math.ts`                |
| `tests/frontend/workspace/entity-consensus-settings.test.ts`                   | `frontend/src/lib/components/Entity/workspace/entity-consensus-settings.ts` |
| `tests/frontend/workspace/entity-workspace.test.ts`                            | `frontend/src/lib/components/Entity/core/entity-workspace.ts`               |
| `tests/frontend/workspace/panels/entity-panel-model.test.ts`                   | `frontend/src/lib/components/Entity/core/account-list-view.ts`              |

## Health and helper continuation — 2026-09-15

Health topology and real READY/stale browser evidence now exist. See [Health parity](react-health-parity.md) for the remaining endpoint/acceptance boundary. This does not authorize cutover.

### Semantic helper migration

All 11 direct test import edges into nine retained owners are removed without dropping their assertions. The two transitive helpers were moved too. The retained Svelte components import the shared implementations; no financial formulas changed.

| Previous owner                                                              | New owner                                                                                |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `frontend/src/lib/view/components/entity/shared/formatters.ts`              | `frontend/packages/ui/src/entity/shared/formatters.ts`                                   |
| `frontend/src/lib/components/Entity/workspace/entity-consensus-settings.ts` | `frontend/bridges/entity/consensus/entity-consensus-settings.ts`                         |
| `frontend/src/lib/components/Entity/core/entity-consensus-payment-view.ts`  | `frontend/bridges/entity/consensus/entity-consensus-payment-view.ts`                     |
| `frontend/src/lib/components/Entity/swap/swap-order-history.ts`             | `frontend/packages/ui/src/market/history/swap-order-history.ts`                          |
| `frontend/src/lib/components/Entity/swap/swap-order-math.ts`                | `frontend/packages/ui/src/market/orders/swap-order-math.ts`                              |
| `frontend/src/lib/components/Entity/swap-formatting.ts`                     | `frontend/packages/ui/src/market/format/swap-formatting.ts`                              |
| `frontend/src/lib/components/Trading/orderbook-relay-url.ts`                | `frontend/packages/browser/src/market/orderbook-relay-url.ts`                            |
| `frontend/src/lib/components/Navigation/runtime-navigation-view.ts`         | `frontend/packages/ui/src/navigation/runtime-navigation-view.ts`                         |
| `frontend/src/lib/components/Entity/core/entity-workspace.ts`               | `frontend/packages/runtime-client/src/runtime/projection/runtime-projection-identity.ts` |
| `frontend/src/lib/components/Entity/core/account-list-view.ts`              | `frontend/bridges/entity/accounts/account-list-view.ts`                                  |

`ImmersiveWalletSurface.ts` retains its Three renderer; its button geometry and `immersiveWalletActionAt` moved to `frontend/packages/ui/src/graph/immersive/immersive-wallet-actions.ts`. `NavigationSelection` moved to `frontend/packages/ui/src/navigation/navigation-selection.ts`; the retained store consumes that single type.

The existing formatting/amount, consensus ceiling/hashlock, order lifecycle/fee/math, relay URL trust, navigation/Runtime switch, Account paging and immersive hit-target tests now import these owners. Source-reading tests for retained components still run in coexistence and must be translated before C02. The Docs generator's strict file catalog follows the moved paths.

Verification: 82 focused tests / 1,528 assertions; full frontend suite 1,540 tests / 11,719 assertions; four-app/tooling typecheck and retained Svelte checks pass. Resolved imports retain the no-Svelte/no-retained-source boundary for apps, bridges and packages.

The current retirement list has **262 existing paths** (256 retained-source files plus six configuration/wrapper files). Refreshed command and seven-file inventory patches pass `git apply --check --unidiff-zero`. **33 tests / 1,055 assertions** pass with the proposed deletion set absent in a disposable copy. Receipts: `output/react-health-helpers-20260915/without-svelte-receipts.json`. Earlier counts above are historical; this focused proof is still not a full post-retirement frontend test/build run.
