# React frontend cutover review

Originally reviewed **2026-09-16** against `main` at
`c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81` with working-diff SHA-256
`f2e73f36faa574f84d60f7ed5266c427744ed817719dc963355908bac6b3a21b`
and no untracked inputs. This review closes T01 preparation only. It does not
authorize C02, apply either patch, remove a live Svelte file, or activate React
in production.

Path refresh on 2026-09-24: the parity and capability tests moved below
`tests/frontend/tooling/audit`, and the Wallet vault Runtime bridge moved below
`frontend/bridges/wallet/canonical`. The guard patch now follows both moves. A
fresh disposable copy applied both cutover patches with all 262 retirement
paths absent; **34 focused cases / 1,042 assertions** pass. The live tree still
contains every retirement target. C02 remains unauthorized.

The expanded current-suite rehearsal reached **1,531 pass / 13 fail / 11,626
assertions**. All 13 failures are Bun 1.4 `EBADF` errors from nested Bun, Bash,
or OpenSSL spawning under `bun:test`; the generated-input failure reproduces in
the unchanged live checkout, including with Bun's documented isolated
`--parallel=1` worker mode; Bun's Node-compatible `child_process.spawn`
delegates to the same failing primitive. This is retained environment evidence,
not a green current full-suite claim and not C02 acceptance.

## Current T17 handoff

The 2026-09-24 refresh started from the same Git HEAD,
`c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81`, with pre-review tracked-diff
SHA-256 `c09c036e4ec920422d443608602c929f87ae6056367bcce254d95675a0614115`
and **114** untracked paths whose sorted path-list SHA-256 is
`7f16903c5f7632b203db5710bb6160fbe5524436c61c712465f08f17dc232573`.
Those hashes identify the input to this documentation refresh; editing this
receipt intentionally changes the live working-diff hash.

The accepted version is **0.1.32**. The immutable frontend input is
`frontend/.artifacts/releases/sha256-018216b4f3761819a817cd37aee49b875acca15698ab45e112abebe90621172b`
with **492 files**. Its final web registry passed **444/444** cases across the
three required viewports, and the unchanged integration candidate passed
`bun run check`. Full evidence is in the [T12 receipt](react-frontend-t12-web-acceptance.md).

| Task | Current evidence | Remaining boundary |
| --- | --- | --- |
| T13 | DONE. Artifact browser 12/12; preview verifies 492 files; installed offline package dev lifecycle passes; installed testnet package restored the preserved owner, durably committed the authorized empty input at frame 4, restarted at exact head 4, rejected a non-durable frame-5 retry, and reverified the release. `xlnfinance-0.1.32.tgz` SHA-256 is `1df7596524e1ce7022513c0bbe4f1db1afa19656ee001ce81622c788732bc434`. | None. See [T13](react-frontend-t13-consumer-acceptance.md). |
| T14 | Final release passes PWA update/rollback and isolated deployment activation/rollback. | None; T14 is DONE. See [T14](react-frontend-t14-pwa-deployment-acceptance.md). |
| T15 | DONE for the owner-approved migration set: iOS lifecycle and the final Chrome extension pass. Extension ZIP SHA-256 is `3d6882c36296df07e555c49e2532da54331d5adffbee01673bd0836fc0e803b8`. | Android, signed/notarized desktop and headset WebXR remain explicit post-migration release gates and are not claimed as passing. See [T15](react-frontend-t15-readiness.md). |
| T16 | DONE. Hosted PR [#166](https://github.com/pavelivanov/xln/pull/166) at `53cf726788e737d0851a657d4eb5aaece17bf4fb` passed Frontend Build (1,544 tests / 252 files, including all four distribution-consumer cases), Contracts and Runtime Checks. The release-integrity phase passed 59 tests / 452 assertions including all six release-order cases. | The later broad E2E Runtime phase exposed two reproducible pre-existing protected-core failures and a Bun abort; recorded as unrelated under the frontend override. No publish or deployment occurred. See [T16](react-frontend-t16-hosted-readiness.md). |

T17 is now blocked only on explicit C02 authority. No command or guard patch is
applied, no retirement path is removed, and no C02 or C03 authority is implied
by this handoff.

## Retirement inputs

- `react-frontend-retirement-files.txt` contains **262 existing paths**: all
  **256** remaining files below `frontend/src` plus the four Svelte
  configuration files and two obsolete Svelte preview/build wrappers. All 262
  still exist in the live tree.
- `react-frontend-retirement-guards.patch` stages the post-retirement form of
  eight inventory, route, boundary, coverage, and root-command test owners.
  It does not promote a parity claim or hide an open gap.
- `react-frontend-cutover-commands.patch` stages the canonical React commands,
  dependency retirement, and CI command removal in `frontend/package.json`
  and `.github/workflows/build-and-test.yml`.
- Static assets, workers, `frontend/static`, React apps/packages/bridges,
  generated-input producers, deployment tools, and
  `copy-static-files.js --docs-only` are outside the deletion list.

Artifact SHA-256 values:

| Artifact | SHA-256 |
| --- | --- |
| `react-frontend-retirement-files.txt` | `313bc3c1ac671f5cf0f6004b1eb779f82e772afabca27a8e58fadc9f7ac20b9b` |
| `react-frontend-retirement-guards.patch` | `6253a841e060956bbfef857582ac3c2dcde3ee9b182b6568932b53dc2a1e6977` |
| `react-frontend-cutover-commands.patch` | `473cb8035b587216d14edc0738bb644040ecc73de6a1db4d5ad38b205932bb34` |

Both patches pass `git apply --check --unidiff-zero` in the live tree. The
disposable rehearsal applied both patches and removed exactly the 262 listed
paths; no file below `frontend/src` remained.

## Semantic assertion mapping

Every source-reading assertion translated during T01 retains its behavioral
subject. The table groups files that moved together; it does not replace their
individual test cases.

| Previous Svelte subject | Canonical React/shared subject | Preserved assertion families |
| --- | --- | --- |
| `RuntimeCreation.svelte`, wallet layout/page, address and testnet routes | `frontend/apps/wallet/src/identity/`, `runtime/`, `onboarding/`, `app-shell.tsx` and browser/runtime-client session boundaries | identity entry, progressive disclosure, deterministic creation input, consent, Runtime mode, remote import, wallet opening and shell state |
| Recovery panels, discovery/rehearsal helpers, vault creation and BrainVault view code | `frontend/apps/wallet/src/identity/recovery/`, `frontend/bridges/wallet/`, `frontend/packages/browser/src/vault/` and worker validator | recovery choice/discovery, receipt and peer evidence, lock/finalization, worker scheduling/validation, secret handling and service ownership |
| Payment panel, swap/order Svelte views and retained Entity financial surfaces | Wallet payment/market components plus `frontend/packages/ui/src/market/`, runtime-client command owners and canonical Account/Entity decoders | canonical payment modes, exact amounts/fees, order history, review invalidation, zero-submit rejection, token precision and retired-path rejection |
| `runtimeConnection.ts`, Runtime navigation/store/IO views and Svelte boot code | runtime-adapter session, query client/observer, Wallet embedded/remote Runtime, navigation projection and command bus | transport authority, hot swap, bootstrap/consent, current Runtime selection, query cancellation, lifecycle cleanup and no detached Runtime mutation |
| `Graph3DViewport.svelte`, graph panels, entity visuals and timeline facades | `frontend/packages/ui/src/graph/`, React Ops graph/workspace components and canonical projection owners | scene input, hit targets, camera/hover/lifecycle, visual parenting/effects, timeline projection and renderer cleanup |
| `DockRoot.svelte`, Entity workspace/panel tabs, command palette and user-mode panels | React Wallet/Ops workspaces, shared navigation/selection and entity/account bridges | dock layout, panel routing/model/display, context switching, user-mode selection and command ownership |
| Svelte diagnostics, settings, jurisdiction, gossip, architect and scenario panels | React Ops health/workspace/scenario components, Wallet diagnostics/settings and shared diagnostic projections | BigInt-safe diagnostics, panel evidence, jurisdiction/gossip/settings ownership, failure visibility and docs/landing diagnostics |
| Svelte route enumeration in parity/capability/platform inventories | `packages/frontend-release/surfaces.ts`, React app entrypoints, generated-input owners and exact route rules | unique route ownership, representative-route coverage, gap/owner/behavior preservation and retained static/worker inputs |
| Svelte `dev`, build, preview and check scripts | React development gateway, four-surface prepare/build/assemble/check and preview consumers | one gateway, isolated Vite caches, forwarded build failures, release verification and clean-checkout generated inputs |
| Svelte sources catalogued by `scripts/debug/gpt.cjs` | React apps, packages, bridges and operational owners | strict documentation catalog completeness without a retired source dependency |

The final executable scan over `tests/frontend`, `core/__tests__`,
`frontend/config`, and `frontend/scripts` found no import or file read into
the 262-path deletion set. The only matching source-read text left in that
scope is an intentional negative assertion that rejects imports from
`frontend/src/lib`.

## Disposable deletion rehearsal

The validation copy contained the recorded HEAD, working diff, and empty
untracked set. Its `.git` metadata pointed at the source repository only so
Git-based tests could read the same identity. The copy then applied the two
reviewed patches and removed exactly the retirement list.

Pinned Bun **1.4.0** results:

| Boundary | Result |
| --- | --- |
| Full frontend test suite | **1,537 pass / 0 fail / 11,697 assertions** |
| Affected frontend-owned core checks | **42 pass / 0 fail** across the focused deletion/root-command cases |
| All React types | exit **0** |
| Frontend aggregate | exit **0**; units, checks, prepare, four builds and assembly |
| Assembled release | `sha256-5b1836334f710f9582a33691cd4f31af9731d9da77fc8f32c4e5ec82cc101f51`, **478 files** |
| Static import scan after deletion | **0** edges into the deletion set |
| Live patch checks | both exit **0** with `--unidiff-zero` |
| Live diff whitespace check | exit **0** |

The general `e2e-runner-isolation.test.ts` file still cannot load because its
pre-existing import `batchPlaywrightTargetsByFile` has no production export
in `run-e2e-parallel-isolated.ts`. The T01 source-read was retargeted from the
deleted Vite config to `create-react-app-config.ts`; the unrelated runner API
gap is recorded for T11 and was not hidden, skipped, or converted to a warning.

## Browser evidence for the visible safety change

The real Wallet Runtime fixture produced a committed cross-jurisdiction route.
The final page reported zero console errors and zero warnings. The safety note
states that the wallet must stay online, execution can require up to 65,535
steps, and an unfilled remainder requires manual cancellation. Inspected
screenshots:

- `output/playwright/t01-wallet-cross-safety-390x844.png`
- `output/playwright/t01-wallet-cross-safety-1366x900.png`
- `output/playwright/t01-wallet-cross-safety-1920x1080.png`

## Cutover boundary

The live repository still runs coexistence commands and still contains every
retirement candidate. Apply the reviewed patches and delete the exact list only
during T17, after T01–T16 are accepted and the owner explicitly grants C02.
Production activation remains a separate C03 release operation.
