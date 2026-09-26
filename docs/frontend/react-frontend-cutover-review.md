# React frontend cutover review

Status: **T17 DONE; T18 DONE**

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
