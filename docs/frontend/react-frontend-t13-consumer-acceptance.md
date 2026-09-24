# React frontend T13 — release consumer acceptance

Status: **DONE — final installed package testnet restore/write/restart accepted**

## Accepted release

- Every current consumer check uses `frontend/.artifacts/releases/sha256-018216b4f3761819a817cd37aee49b875acca15698ab45e112abebe90621172b` directly.
- Candidate verification passes with **492 files** after browser, preview, package, PWA and native consumer operations. No consumer rewrote the release directory or manifest.

## Passing evidence

- Immutable artifact browser: **12/12 pass in 2.8 min** across mobile, laptop and wide. The built release proves exact routes/assets/workers/storage plus real Ownership release, recovery-service enrollment and Graph/history interactions.
- Preview consumer: **PASS** with **492 file hashes**, four route owners, HEAD/POST/404/redirect behavior, corrupt live bytes rejected, corrupt restart rejected, missing release rejected and clean shutdown on isolated port `48080`.
- npm distribution: `xlnfinance-0.1.32.tgz` contains **508 archive entries**, is **50,220,136 bytes**, and has SHA-256 `1df7596524e1ce7022513c0bbe4f1db1afa19656ee001ce81622c788732bc434`.
- Offline installed preflight: **8/8 cases pass** with no state created. Invalid pointers, a corrupt Wallet entry and a missing manifest fail before daemon contact; valid and restored package copies verify the same 492-file release. [Machine receipt](../../output/playwright/react-t13-consumers/npm-preflight.json).
- Isolated Docker install: Bun `1.4.0` installed the final tarball under `--offline --ignore-scripts --frozen-lockfile` with networking disabled. Its installed pointer is the accepted `sha256-018216…` release. A path-keyed Bun cache entry from the prior tarball was quarantined before the exact final install; it is not accepted evidence.
- Installed dev lifecycle: **PASS** with container networking disabled. The final package starts on container port `8080`, issues and consumes one local pairing token, rejects replay, authenticates the admin Runtime WebSocket, commits height `0 -> 1`, stops cleanly, reopens at height `1`, stops again, and leaves the preserved testnet owner unchanged. Candidate verification remains **492 files**. [Machine receipt](../../output/playwright/react-t13-consumers/npm-launcher-dev-container.json).
- Installed testnet lifecycle: **PASS** in isolated Docker against `https://xln.finance/rpc`. The final package restored the preserved BrainVault owner, submitted one empty Runtime input at head `3`, durably committed frame `4`, stopped, restored head `4`, proved frame `5` absent, stopped cleanly, and reverified the same **492 files**. Frame `4` contains only the server-owned command marker (`runtimeTxs=1`, `jInputs=0`, `entityInputs=0`, `entityTxs=0`); the owner file remained SHA-256 `a863d1a31cf7bcbbdbfc9f655e795ee71dea12b204841a3d89a122284239a062`. [Machine receipt](../../output/playwright/react-t13-consumers/npm-launcher-testnet-final-container.json).
- Focused release/preview/distribution contracts: **11/11 pass**, **93 assertions**.

## Lifecycle disposition

- The owner explicitly authorized the isolated external testnet mutation on 2026-09-25. No host service or host port was changed; Docker did not publish container port `8080`.
- Two pre-submit attempts produced no Runtime input: one paired before full server readiness, and one failed during testnet startup on a retryable upstream `502`.
- The authorized input committed at frame `4`. A later evidence-capture retry was admitted toward frame `5` but fail-stopped at storage with `RUNTIME_FRAME_STORAGE_NOT-COMMITTED`; the verification restart restored exact head `4` and `frame/5` returned not found. The non-durable retry is recorded rather than treated as a pass or hidden.
- A first final-package dev attempt intentionally preserved the earlier fixture and reproduced its stale writer-lock evidence from a pre-reaper container. The accepted run used a new dedicated dev-state root and proved its own clean restart; no stale lock was deleted or ignored.
- The existing `npm-launcher-container.json` receipt names the earlier 491-file release and is historical only; it is not acceptance of the 492-file final package.
- Host nginx on canonical host port `8080` was never interrupted.

T13 is `DONE` for the exact final package.
