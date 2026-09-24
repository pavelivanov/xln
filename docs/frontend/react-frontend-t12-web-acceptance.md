# React frontend T12 — web source acceptance

Status: **DONE**

## Accepted version and release

- Release version `0.1.32` is synchronized across `VERSION`, root/frontend/npm metadata, the extension manifest and `CURRENT_XLN_RELEASE_VERSION`; mismatch rejection remains enabled.
- Accepted release: `frontend/.artifacts/releases/sha256-018216b4f3761819a817cd37aee49b875acca15698ab45e112abebe90621172b` — **492 files**.
- The candidate verifier passed again after all local consumer operations. The accepted directory and manifest were not modified after assembly.
- This receipt was written after assembly and is evidence about the named immutable bytes; it is not itself an input to that release.

## Complete web matrix

- Playwright discovery registered **444 tests in 44 files**: **148 cases × 3 projects** (`mobile-390x844`, `laptop-1366x900`, `wide-1920x1080`).
- The unchanged final source passed **148/148 mobile** in `12.6 min`, **148/148 laptop** in `13.5 min`, and **148/148 wide** in `15.0 min`: **444/444**, with no skipped or unaccounted case.
- Every registered flow owns page-error and console-error assertions. Expected unavailable-service states remain visible; no browser failure was hidden or converted to a warning.
- Full case ledgers and attachments are retained in the [mobile report](../../output/playwright/react-candidate-mobile-390x844/report/index.html), [laptop report](../../output/playwright/react-candidate-laptop-1366x900/report/index.html) and [wide report](../../output/playwright/react-candidate-wide-1920x1080/report/index.html).

## Final repairs and integration evidence

- Wallet initializes Capacitor routing once at startup, registers `appUrlOpen` before UI interaction, consumes cold-launch URLs, and maps a targetless `#pay?...` route to Payments / Send.
- Graph3D current-head reads now use the live projection instead of a 32–74 second historical replay. A head/graph race falls back to the exact historical query; split reader pools retain independent 30-second live and 60-second historical budgets.
- Focused Graph timeline/cache regressions pass **31/31**, **101 assertions**. Native build/staging/deep-link regressions pass **17/17**, **66 assertions**.
- Repository integration is **PASS** on the final working source: `check:src` completed in `54.978 s`, `check:frontend` in `44.569 s`, and `bun run check` exited `0`. The first sandboxed attempt was environment-only (`Operation not permitted` on ephemeral listeners); the unchanged gate passed with loopback permission.
- `git diff --check` passes. Bun is `1.4.0`; Rust/Cargo is `1.94.1-aarch64-apple-darwin`.

## Browser evidence

- [Mobile workspace and real guide stream](../../output/playwright/react-candidate-mobile-390x844/test-results/ops-panels-ops-workspace-g-3ed7a-nd-aborts-on-context-change-mobile-390x844/ops-guide-real-stream.png)
- [Laptop reconstructed Wallet preview](../../output/playwright/react-candidate-laptop-1366x900/test-results/cross-surface-hub-collapse-e334d-nstructs-the-wallet-preview-laptop-1366x900/wallet-scenario-preview.png)
- [Wide Ops scenario player](../../output/playwright/react-candidate-wide-1920x1080/test-results/cross-surface-hub-collapse-e334d-nstructs-the-wallet-preview-wide-1920x1080/ops-scenarios.png)

## Consumer boundary

T13–T16 must consume the exact accepted release directory above. They may not select another directory by recency or rebuild the release as a substitute for consumer verification.
