# React frontend cutover review

Status: **T17 DONE; T18 DONE; post-rebase R08 VERIFIED**

## Authority and boundary

The owner granted C02 authority on 2026-09-25 after accepting the reviewed
retirement list and command/guard patches. The cutover applies only to the
frontend and its smallest build, CI, native, development and release consumers.
It does not authorize C03 production activation or changes to Runtime, Entity,
Account, consensus, custody, contracts or persistence semantics.

The accepted retirement inputs were:

| Artifact | SHA-256 |
| --- | --- |
| `react-frontend-retirement-files.txt` | `313bc3c1ac671f5cf0f6004b1eb779f82e772afabca27a8e58fadc9f7ac20b9b` |
| `react-frontend-retirement-guards.patch` | `6253a841e060956bbfef857582ac3c2dcde3ee9b182b6568932b53dc2a1e6977` |
| `react-frontend-cutover-commands.patch` | `473cb8035b587216d14edc0738bb644040ecc73de6a1db4d5ad38b205932bb34` |

## T17 canonical cutover

- Applied both reviewed patches and removed exactly **262 paths**: all **256**
  files below `frontend/src`, four Svelte configuration files and two obsolete
  Svelte preview/build wrappers.
- Removed Svelte dependencies and their lockfile graph. Default frontend
  `dev`, `build`, `build:static`, `preview` and `check` now select the React
  four-surface toolchain; root development owns one public `localhost:8080`
  gateway with no Svelte selector or fallback.
- Retargeted regular CI, root development, production static serving, release
  checks, native consumers, policy scans and the isolated E2E runner to one
  verified React release. The E2E runner builds once, verifies and caches that
  immutable release, then gives each shard a dedicated React edge proxy.
- Preserved shared assets, browser/runtime-client/UI packages, workers,
  generated-input owners and every translated semantic assertion. No executable
  import or file read requires the retired tree.

The semantic migration remains the reviewed mapping: identity/recovery,
payments/markets, Runtime session/query ownership, graph/timeline, workspace,
diagnostics and route/inventory assertions now target their React app,
`frontend/bridges`, `frontend/packages/browser`,
`frontend/packages/runtime-client` or `frontend/packages/ui` owner.

## Post-rebase retirement correction

The T17 statement that every file below `frontend/src` had been removed was
true for source `66a5832312462d3152565374f6357c4969fb9052`, but it no longer
described the post-rebase tree. Three post-manifest upstream additions restored
`WalletPasswordForm.svelte`, `WalletUnlock.svelte`, and the
`entity-panel-types.ts` re-export after the accepted 262-path inventory had
been produced.

R04 moved the password enrollment, unlock, recovery, and authority-revocation
behavior to the canonical React wallet; its focused boundary completed 48/48
tests before removal. Source `c3893eecd` then removed the three unconsumed
files and made `check:no-legacy` reject every file beneath `frontend/src` with
an explicitly empty allowlist. The focused policy regression passes against an
empty tree and rejects a synthetic `frontend/src/resurrected.ts` fixture.

The corrected retirement inventory contains **265 paths** with SHA-256
`198a6bb0acccb8992c018ede51f34ed4d353e35fac05b900b670101c2c980566`.
This correction does not reuse the historical source or release receipts;
R08 must bind the repaired tree to one new exact source and release.

## Post-rebase R08 certification

R08 certifies source `24204d68a8d9b7865f4564dc6f28109be5c3c466`
with Bun **1.4.0**. The verified frontend release is
`sha256-b9100e9824673a5564f49c39d0c6b3a2bd2610faf93f642249bda26cef40201a`
(**652 files**) at
`frontend/.artifacts/releases/sha256-b9100e9824673a5564f49c39d0c6b3a2bd2610faf93f642249bda26cef40201a`.
Its `release-manifest.json` SHA-256 is
`f03cb30e263bbd2360dc26b1cd0b7692bb58cefab5522686137dca9a51a106d6`.

| Boundary | R08 result |
| --- | --- |
| Retained UI and source policy | PASS: `cd ui && bun run check`; no file remains beneath `frontend/src`, resurrection is rejected, and no production/scenario/Ops selector chooses BrowserVM |
| Frontend aggregate | PASS: `cd frontend && bun scripts/check.ts --all --level=frontend`; **1,586/1,586** unit tests and all four builds passed, reproducing the exact 652-file release |
| Root aggregate | PASS: `bun run check`; **3/3** root aggregates and **39/39** source gates passed, including frozen core unchanged |
| Browser inventory and matrix | PASS: `bunx --no-install playwright test --config playwright.react.config.ts --list` found **453 tests in 45 files**; `bun run stand:run --reason r08-react-browser-matrix --timeout-ms 3600000 -- bun frontend/scripts/testing/test-react-candidate.ts --all` passed **453/453**: mobile **151/151 in 12.0 min**, laptop **151/151 in 13.4 min**, wide **151/151 in 26.0 min** |
| Immutable artifact and preview | PASS: `cd frontend && bun scripts/testing/test-artifact-candidate.ts` passed **12/12 in 1.3 min**; `cd frontend && bun scripts/release/check-preview-consumer.ts --release .artifacts/releases/sha256-b9100e9824673a5564f49c39d0c6b3a2bd2610faf93f642249bda26cef40201a` verified all 652 hashes, four routes, corruption/missing-release rejection, and clean shutdown |
| iOS production package | PASS: `bun scripts/native/build-platforms.ts ios --frontend-release frontend/.artifacts/releases/sha256-b9100e9824673a5564f49c39d0c6b3a2bd2610faf93f642249bda26cef40201a` built the iPhone 17 Pro simulator target with production network values; native artifact `sha256-99e5b6dae6fd16591d3598b8d3ac2e33dab6e7dd46add7b22ddfa0db169e5d61`, manifest SHA-256 `bd564d4edce3fd5396e298010338c1ca28d0839bf374aedb17ad1df9397ac076` |
| iOS native sessions | PASS: stand-locked `bun scripts/native/session/run-session.ts ios-ui-swap` committed one economic swap (**1/1 in 126.039 s**) and `bun scripts/native/session/run-session.ts ios-ui-default` passed launch/background/activation lifecycle (**1/1 in 71.453 s**); both ended with `systemOk=true` and no health failures |
| Final hygiene | PASS: `git diff --check`; no Runtime/Entity/Account, contract, persistence, or `frozen-core.json` change; no push, deployment, publication, or history rewrite |

The browser matrix ran at source `8da6d9524`; the only subsequent changes before
the certified source were two unit-test-only edits: artifact-history expected
frame coverage and an explicit 30-second budget for the semantic UI source scan.
The current Playwright inventory is unchanged, and the frontend aggregate on the
certified source reproduced the exact release identity. Those edits therefore
invalidate only their affected unit evidence, which was rerun at the certified
source; production, browser, release, and native bytes are identical.

The production-network iOS package contains `native-network.json` with
`https://xln.finance` for both API and recovery. The local simulator session
used an isolated localhost-derived copy and Xcode `build-for-testing`. An
additional payment-session attempt reached wallet creation, funding, and the
camera-unavailable path, then stopped on the known XCTest accessibility audit
(`Dynamic Type font sizes are partially unsupported`) before payment commit;
the required native economic smoke is the passing swap session above. Physical
device execution and Apple signing remain owner/device gates. C03 production
activation remains separate and requires explicit release authority.

This R08 receipt supersedes the historical **444/444** browser and 493-file
release claims for the current tree. As with the original receipt, this section
is written after assembly because the public Docs catalog includes repository
Markdown; embedding its own release hash into the release it names would be
self-referential.

## T18 local certification

Pinned Bun is **1.4.0**.

| Boundary | Result |
| --- | --- |
| All React types | PASS for Site, Docs, Wallet and Ops |
| Default `bun run build` | PASS; all four Vite builds and release assembly |
| Default root development | PASS; `DEV_READY` in **17.317 s**, all four routes rendered, `/api/health` and `/rpc` returned 200, zero console/page errors, and clean owned-process shutdown |
| Explicit verified-release preview | PASS; Wallet rendered from the exact release with zero console/page errors and the identity endpoint matched all files |
| Retirement/policy checks | PASS: no-legacy, FinTS compiler policy, unused surface, failure taxonomy, swap cancellation, market codec, root-development and production-static wiring |
| Complete browser registry | PASS: **444/444 unique cases** across mobile, laptop and wide; mobile **148/148 in 10.3 min**, laptop **148/148 in 12.8 min**, and the unchanged wide ledger completed from **142 passing cases plus a 9/9 Wallet partition in 32.5 s** |
| Default frontend `bun run check` | Environment boundary: **1,529 pass / 15 fail / 11,610 assertions**; all 15 failures are Bun 1.4 nested-process `EBADF` cases already passing through direct/focused execution or hosted CI |
| Root `bun run check` | Environment boundary: short gates pass, then `check:src` stops at `/bin/bash: cargo: command not found`; the parallel frontend sibling reaches the same 15 local `EBADF` cases |
| `git diff --check` | PASS |

The final complete browser registry and hosted source result are recorded below
after their post-cutover rerun. This
receipt is necessarily written after assembly: the public Docs catalog includes
repository Markdown, so embedding a release hash inside the release that hash
names would be self-referential.

## Migration-platform acceptance

T15 remains narrowed by the owner to iOS and Chrome extension. The final-byte
post-cutover rerun covers both targets:

- iOS: the copied Capacitor shell builds for iPhone 17 Pro / iOS 26.3; payment
  and settings deep links work; Light persists through background/resume and a
  full terminate/relaunch; the clean WebKit container has **30 files** and one
  `xln-settings` record.
- Chrome extension: the packaged action opens the exact Wallet and Light
  persists through reload and a fresh browser context at mobile, laptop and
  wide viewports (**3/3 pass in 7.7 s**). The 99-file ZIP is **3,895,832 bytes**
  with SHA-256 `8257cd9cd5c4b54b0fce7640b80c7bca4c35c57dac242f452d880d6c01a4b8fb`.

Android, signed/notarized desktop and headset WebXR remain explicit
post-migration release gates. They are not claimed as passing and their build,
launch, lifecycle, signing or hardware requirements are not weakened.

## Final source and release acceptance

- Final verified release:
  `sha256-77b6fcdb1c59cd481380acb4e9790969fd212b3131e4e43bb1221ce9e79347f9`
  (**493 files**).
- Immutable artifact browser: **12/12 pass in 1.2 min**. Explicit preview
  reverified every file hash, four route owners, HTTP method/error behavior,
  corrupt-live/restart rejection, missing-release rejection and clean shutdown.
- npm package: **509 entries / 50,223,525 bytes**, SHA-256
  `4d4754554829e65085e7b6b2a6fe685535f0dd5cf6b765493692fd00887daddb`;
  its offline installed preflight and corruption suite passed **8/8** against
  the exact 493-file release without creating state.
- PWA update and rollback passed **1/1 in 11.0 s**; isolated deployment
  activation/rejection/rollback passed **1/1 in 4.7 s**, both from the accepted
  predecessor to the exact final release.
- The complete **444/444** final-source browser ledger passed. During the
  monolithic wide run Chromium emitted simultaneous `net::ERR_NETWORK_CHANGED`
  failures after 142 passing cases; the affected full Wallet file then passed
  **9/9** on the unchanged source, covering the interrupted case and all five
  cases that had not run. The target dynamic module itself returned HTTP 200.
- Final post-cutover source:
  `66a5832312462d3152565374f6357c4969fb9052`.
- Hosted [build-and-test 36148825115](https://github.com/pavelivanov/xln/actions/runs/36148825115)
  passed [Contracts 108116630162](https://github.com/pavelivanov/xln/actions/runs/36148825115/job/108116630162),
  [Frontend Build 108116630115](https://github.com/pavelivanov/xln/actions/runs/36148825115/job/108116630115)
  and [Runtime Checks 108116629886](https://github.com/pavelivanov/xln/actions/runs/36148825115/job/108116629886).
  The [E2E job 108120392357](https://github.com/pavelivanov/xln/actions/runs/36148825115/job/108120392357)
  passed the final React typecheck (**80.3s**), all source checks (**503.1s**)
  and release-integrity tests (**27.3s**) before reaching the two unchanged,
  protected-core `storage-frame-journal-retention`
  `entity_certification_invalid` failures and subsequent Bun 1.4.0 abort
  already recorded during T16. Under the frontend migration override, that
  unrelated existing Runtime boundary is evidence, not a migration blocker.
- The hosted cold-runner regression that killed a healthy final Ops typecheck
  at 60 seconds is fixed with a 180-second watchdog and a rendered-plan test.
  The final release bytes are unchanged because the fix touches only release
  orchestration and its regression test.
- No publishing or production deployment is part of this gate.

T01–T18 are complete. React is the canonical frontend, the Svelte application
is retired, and Android, signed/notarized desktop and headset WebXR remain
post-migration release gates. C03 production activation remains separate and
requires explicit release authority.
