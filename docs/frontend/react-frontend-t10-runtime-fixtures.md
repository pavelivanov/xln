# React frontend T10 — Runtime fixture races

Status: **DONE**

## Watcher quiesce race

- The watcher already fenced authenticated range ingress, but its canonical header audit awaited external RPC before `commitScannedWatcherCursor`. Persistence quiesce could begin during that await, allowing `advanceJWatcherCursor` to reach the fail-stop input queue after the persistence fence.
- `runWatcherPoll` now rechecks cancellation and `persistenceQuiescing` immediately after the canonical audit, before pending-history work, cursor admission or authenticated range ingress. The input queue's fail-stop rejection remains unchanged.
- The named behavioral regression starts quiesce inside the asynchronous header read and proves no Runtime input or range ingress occurs; it also requires the `after-canonical-audit` pause diagnostic.

## Secondary Runtime fixture timeout

- The fixture imported 27 entities with their final `profileName`, then submitted 27 duplicate `profile-update` Entity transactions in a second large frame before opening Accounts.
- The redundant profile frame was the observed `RUNTIME_INPUT_COMMIT_TIMEOUT:after=1:latest=1` boundary. It provided no state absent from `importEntity`; removing it preserves all final names while avoiding duplicate consensus work.
- The original Runtime-switch browser flow still selects `Dropdown owner`, switches to the secondary Runtime, removes the prior Runtime's Account controls and reports no counterparties from the new owner context.

## Verification

- Watcher post-audit regression plus fail-stop queue suite: **6 pass, 0 fail, 16 assertions** in `0.34 s`.
- Original Ops wide reset/reload/internal-inspection flow: **1 pass** in `9.0 s`; no `RUNTIME_INPUT_INGRESS_AFTER_PERSISTENCE_PAUSE`, watcher fatal or refused connection.
- Original Wallet wide selected-Runtime switch flow: **1 pass** in `20.2 s`; no `RUNTIME_INPUT_COMMIT_TIMEOUT` and no browser error.
- All React local gate: Site, Docs, Wallet and Ops TypeScript/tooling green (`891` files, `0` unsafe-type findings) in `23.4 s`.
- Screenshots inspected; scoped `git diff --check` passes.

## Browser evidence

- [Ops restored layout](../../output/playwright/react-ops/test-results/ops-ops-public-embed-publi-ca130-ternal-inspection-and-reset-wide-1920x1080/ops-embed-restored-layout.png)
- [Wallet switched Runtime](../../output/playwright/react-wallet/test-results/wallet-onboarding-wallet-h-a4432-e-selected-Runtime-switches-wide-1920x1080/wallet-hub-discovery-runtime-switched.png)

## Source identity

- Base SHA: `c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81`.
- Pre-receipt working-diff SHA-256: `7393969fa7d119c3fa44b6fb070a21f5430cb568265779c30639a4138b4e092e`.
- Pre-receipt untracked-file ledger SHA-256: `07f0596759aae7c13b5d4600f872d8bbfe718214b90049bd5b51e49e4f05243a`.
- Browser artifact roots: `output/playwright/react-ops/test-results/` and `output/playwright/react-wallet/test-results/`. No immutable frontend release was assembled; T12 owns the release ID.
