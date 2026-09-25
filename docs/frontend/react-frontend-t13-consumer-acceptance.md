# React frontend T13 — release consumer acceptance

Status: **DONE — post-cutover release consumers accepted**

## Accepted release

- Every post-cutover consumer check uses `frontend/.artifacts/releases/sha256-77b6fcdb1c59cd481380acb4e9790969fd212b3131e4e43bb1221ce9e79347f9` directly.
- Candidate verification passes with **493 files** after browser, preview, package, PWA and native consumer operations. No consumer rewrote the release directory or manifest.

## Passing evidence

- Immutable artifact browser: **12/12 pass in 1.2 min** across mobile, laptop and wide. The built release proves exact routes/assets/workers/storage plus real Ownership release, recovery-service enrollment and Graph/history interactions.
- Preview consumer: **PASS** with **493 file hashes**, four route owners, HEAD/POST/404/redirect behavior, corrupt live bytes rejected, corrupt restart rejected, missing release rejected and clean shutdown on isolated port `48080`.
- npm distribution: `xlnfinance-0.1.32.tgz` contains **509 archive entries**, is **50,223,525 bytes**, and has SHA-256 `4d4754554829e65085e7b6b2a6fe685535f0dd5cf6b765493692fd00887daddb`.
- Offline installed preflight: **8/8 cases pass** with no state created. Invalid pointers, a corrupt Wallet entry and a missing manifest fail before daemon contact; valid and restored package copies verify the same 493-file release. [Machine receipt](../../output/playwright/react-t13-consumers/npm-preflight-post-cutover.json).
- The default post-cutover development and production-static owners both served the verified React surface on the canonical `localhost:8080` boundary. The exact preview separately proved the immutable release path; neither path used a legacy fallback.
- Focused release/preview/distribution contracts: **11/11 pass**, **93 assertions**.

## Lifecycle disposition

- The owner explicitly authorized the earlier isolated external testnet mutation on 2026-09-25. No host service or host port was changed; Docker did not publish container port `8080`.
- Two pre-submit attempts produced no Runtime input: one paired before full server readiness, and one failed during testnet startup on a retryable upstream `502`.
- The authorized input committed at frame `4`. A later evidence-capture retry was admitted toward frame `5` but fail-stopped at storage with `RUNTIME_FRAME_STORAGE_NOT-COMMITTED`; the verification restart restored exact head `4` and `frame/5` returned not found. The non-durable retry is recorded rather than treated as a pass or hidden.
- A first final-package dev attempt intentionally preserved the earlier fixture and reproduced its stale writer-lock evidence from a pre-reaper container. The accepted run used a new dedicated dev-state root and proved its own clean restart; no stale lock was deleted or ignored.
- The prior installed dev/testnet receipts name the 492-file pre-cutover release and remain lifecycle evidence for unchanged launcher/Runtime behavior only. The external mutation was not repeated for the post-cutover package; acceptance of its exact bytes comes from the 493-file offline installation, verifier and corruption suite above.
- Host nginx on canonical host port `8080` was never interrupted.

T13 is `DONE` for the exact post-cutover package. No package was published.
