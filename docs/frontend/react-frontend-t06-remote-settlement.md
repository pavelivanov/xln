# React frontend T06 — remote settlement approval and execution

Status: **DONE**

## Accepted contract

- `entity/<entityId>/settlement-workspaces?atHeight=<height>` is the single bounded read for remote settlement actions. Remote callers need admin authority; inspect-only sessions receive no action-enabling workspace payload.
- Runtime validates the current committed height, Entity replica, bilateral Account ownership and canonical workspace hash before projecting a result. More than 100 active workspaces fails closed instead of truncating.
- The response carries only the exact proposal body and role evidence required by review and execution: counterparty, hash, operations, revision, phase, memo, proposer/approver/executor identities and Hanko-presence booleans. Hanko bytes, compiled diffs, settlement hashes, nonces and post-settlement dispute proofs remain private to Runtime.
- Wallet binds the response to Runtime, height, Entity and signer, independently checks the three authority identities, then feeds the existing approval/execution guards. Embedded and authorized remote sessions now use the same projection.

## Behavior evidence

- A real remote peer proposes revision 1; changing it to revision 2 invalidates and closes the first review without submitting approval.
- The selected peer authority approves revision 2. The non-executor sees a disabled `Awaiting designated executor` action and an empty jurisdiction batch.
- Switching to the designated executor produces exactly one bilateral settlement operation. Broadcasting it advances the on-chain Account nonce, removes the committed workspace and empties the Runtime batch without a manual clear.
- The three viewport screenshots were inspected: mobile approval remains contained, laptop shows the submitted executor batch, and wide shows the empty post-finality state.

## Verification

- Runtime projection/redaction/ownership: **2 pass, 0 fail, 10 assertions**.
- Runtime adapter auth gate: **1 pass, 0 fail**; inspect is rejected and admin succeeds.
- Wallet payment suite: **57 pass, 0 fail, 237 assertions**.
- Wallet local gate: unsafe types, React tooling and Wallet TypeScript all green (`891` files, `0` unsafe-type findings).
- Remote browser flow: **3/3 viewports pass** (`390×844`, `1366×900`, `1920×1080`) in `9.7 s`, with no page or console errors.
- Scoped `git diff --check`: pass.

## Browser evidence

- [Mobile approval](../../output/playwright/react-wallet/test-results/wallet-wallet-settlement-w-ef8bf-nated-executor-finalizes-it-mobile-390x844/wallet-remote-settlement-approval.png)
- [Laptop executor batch](../../output/playwright/react-wallet/test-results/wallet-wallet-settlement-w-ef8bf-nated-executor-finalizes-it-laptop-1366x900/wallet-remote-settlement-executor.png)
- [Wide finality](../../output/playwright/react-wallet/test-results/wallet-wallet-settlement-w-ef8bf-nated-executor-finalizes-it-wide-1920x1080/wallet-remote-settlement-finality.png)
