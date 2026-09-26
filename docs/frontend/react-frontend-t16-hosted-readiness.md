# React frontend T16 — hosted distribution readiness

Status: **DONE — scoped hosted build/distribution checks accepted**

## Hosted PR/CI acceptance

- Reviewed source: `53cf726788e737d0851a657d4eb5aaece17bf4fb`, based on
  `pavelivanov/xln` `main` at
  `082d85b374d16fca6c25bf584428e76edc84cc50`.
- Hosted PR: [pavelivanov/xln#166](https://github.com/pavelivanov/xln/pull/166).
  Hosted run: [build-and-test 36039225007](https://github.com/pavelivanov/xln/actions/runs/36039225007).
- [Frontend Build 107766914690](https://github.com/pavelivanov/xln/actions/runs/36039225007/job/107766914690)
  passed in **3m19s**. It ran **1,544 tests across 252 files**, passed all four
  `frontend-distribution-consumers` cases, emitted
  `FRONTEND_CHECK_OK surfaces=site,docs,wallet,ops level=frontend`, and built
  the frontend.
- [Contracts 107766914951](https://github.com/pavelivanov/xln/actions/runs/36039225007/job/107766914951)
  passed in **1m11s**. [Runtime Checks 107766915180](https://github.com/pavelivanov/xln/actions/runs/36039225007/job/107766915180)
  passed in **9m15s**.
- The [E2E job 107770501263](https://github.com/pavelivanov/xln/actions/runs/36039225007/job/107770501263)
  passed generated aliases, all **38** source checks and the release-integrity
  phase (**59 tests / 452 assertions**), including all six release-order cases.
  Its later broad Runtime unit phase failed on two pre-existing
  `storage-frame-journal-retention` cases with
  `entity_certification_invalid`, then Bun 1.4.0 aborted. The exact two cases
  reproduce locally (**0 pass / 2 fail**), and
  `git diff fork/main...HEAD` is empty for that protected-core test. Under the
  temporary frontend override this unrelated existing failure is recorded but
  does not invalidate the passing T16 checks.

Accepted artifact identities remain the exact consumer-tested inputs:

- frontend release
  `sha256-018216b4f3761819a817cd37aee49b875acca15698ab45e112abebe90621172b`
  (**492 files**);
- npm package `xlnfinance-0.1.32.tgz`, SHA-256
  `1df7596524e1ce7022513c0bbe4f1db1afa19656ee001ce81622c788732bc434`;
- Chrome extension `xln-finance-chrome-0.1.32.zip`, SHA-256
  `3d6882c36296df07e555c49e2532da54331d5adffbee01673bd0836fc0e803b8`.

The hosted distribution workflow was not dispatched: it includes publishing
and deferred signed desktop/Android work, neither authorized by T16. No package
was published and no production deployment occurred.

## Local boundary

- Release-gate order and frontend distribution-consumer contracts pass **10/10**, **104 assertions** on Bun `1.4.0`.
- The gate-order test now imports the pure rendered plan instead of spawning a nested Bun test process. This avoids Bun 1.4's `EBADF` test-runner subprocess failure while exercising the same production plan owner.
- The concrete recursive cross-j release family contains **27 tests** and matches the production plan exactly.
- The executable `--quick --plan` CLI still runs and prints the diff-whitespace and final frozen-core gates.
- Distribution workflows retain one verified frontend producer and explicit npm, macOS/desktop/Chrome and Android consumers; no local test publishes or deploys an artifact.

## Owner-approved platform boundary

The 2026-09-25 T15 decision makes iOS and Chrome extension the migration
platform set. T16 still requires hosted frontend/build checks, the exact
release identity through npm and Chrome extension consumers, and corruption
rejection. Android launch, signed/notarized desktop launch, and headset WebXR
are deferred post-migration release gates; their workflow wiring remains, but
their platform acceptance does not block T16.

## Integration boundary

The separate upstream integration PR
[xlnfinance/xln#67](https://github.com/xlnfinance/xln/pull/67) is not T16
evidence: current upstream `main` diverged by 143 commits and the merge conflict
set crosses protected Runtime, jurisdiction, storage and contract boundaries.
It remains untouched and is not a merge candidate without a separately owned
integration decision. This does not change the accepted fork PR source or the
hosted checks above.

## Post-cutover hosted confirmation

The final post-cutover source is
`66a5832312462d3152565374f6357c4969fb9052`. Hosted
[build-and-test 36148825115](https://github.com/pavelivanov/xln/actions/runs/36148825115)
recorded the following results against that exact SHA:

- [Contracts 108116630162](https://github.com/pavelivanov/xln/actions/runs/36148825115/job/108116630162)
  passed in **1m05s**;
- [Frontend Build 108116630115](https://github.com/pavelivanov/xln/actions/runs/36148825115/job/108116630115)
  passed in **2m36s**;
- [Runtime Checks 108116629886](https://github.com/pavelivanov/xln/actions/runs/36148825115/job/108116629886)
  passed in **10m02s**;
- [E2E Tests 108120392357](https://github.com/pavelivanov/xln/actions/runs/36148825115/job/108120392357)
  passed frontend React types in **80.3s**, source checks in **503.1s** and
  release-integrity tests in **27.3s**. Its subsequent protected Runtime unit
  phase reproduced the same two pre-existing
  `storage-frame-journal-retention` `entity_certification_invalid` failures
  already recorded above, followed by the same Bun 1.4.0 abort.

The prior 60-second React-type watchdog was raised to 180 seconds after hosted
evidence showed the cold runner had reached its final Ops typecheck before
being terminated. The rendered CI plan has a regression assertion for that
budget. The overall workflow remains red only at the recorded unrelated
protected-core boundary; all migration-owned hosted checks pass. No package
was published and no production deployment occurred.
