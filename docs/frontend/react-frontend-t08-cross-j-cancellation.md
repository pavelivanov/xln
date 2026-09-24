# React frontend T08 — cross-j cancellation finality

Status: **DONE**

## Accepted contract

- `swap_cancel_request` remains the canonical `{ offerId }` Account transaction; no protocol field, durable state or duplicate financial formula was added.
- Entity classifies a committed cancellation from explicit authority only: a later transaction in the same committed frame, captured pre-transition Account scope, a live Account offer, or a matching parent cross-j route whose source-user/source-hub pair is the exact bilateral Account.
- An Account-authority result may reveal the committed transaction only after local proposal preparation. The matching parent route is therefore required evidence when neither the local pending envelope nor the final Account offer contains the cross-j row.
- Missing Account and parent-route evidence still throws `ACCOUNT_SWAP_CANCEL_SCOPE_UNRESOLVED`; output disappearance and missing same-j effects are never treated as proof of cross-j scope.

## First divergent boundary

- Prior: the source-user/source-hub Account admitted a resting cross-j offer and the parent Entity held the same canonical route.
- Input: the source user committed `swap_cancel_request` carrying only the exact order ID. On the failing authority path, preparation had neither a local pending frame nor an incoming proposal.
- Result: Account consensus returned the committed frame, but Entity follow-up looked only for the now-unavailable Account offer and halted the Runtime at `ACCOUNT_SWAP_CANCEL_SCOPE_UNRESOLVED`; the parent route remained `clear_requested`.
- Fix: carry bounded pre-transition scope when available, then classify an authority-only result against the exact live Account or the parent route plus both bilateral participants. The cross-j follow-up now runs and terminal close advances the route to `cancelled`.

## Verification

- Named Account/Entity owner regression plus same-j output regression: **3 pass, 0 fail, 18 assertions** in `0.2 s`.
- Original browser cancellation flow: **3/3 viewports pass** (`390×844`, `1366×900`, `1920×1080`) in `11.0 s`; the mobile first-boundary rerun passed in `5.9 s`.
- The flow creates a real resting order, proves a dismissed confirmation changes nothing, accepts the cancellation, tolerates the valid fast-finality skip over transient `clear_requested`, and requires the exact route to reach `cancelled` with its cancel action removed.
- Wallet local gate: unsafe types, React tooling and Wallet TypeScript green (`891` files, `0` unsafe-type findings) in `7.3 s`.
- Browser page/console errors: none. Scoped `git diff --check`: pass.

## Failure evidence

- Initial production replay halted in `committed-input.ts` with `ACCOUNT_SWAP_CANCEL_SCOPE_UNRESOLVED:<orderId>` and left the route `clear_requested`.
- The first pre-transition-only repair reproduced the same error because the Account authority result did not expose the transaction during local preparation.
- After the canonical repair, the production flow reached `cancelled`; the remaining assertion failure was a test race that required observing transient `clear_requested` even when finality completed first. The assertion now accepts either valid post-request state and still requires terminal cancellation.

## Browser evidence

- [Mobile cancelled route](../../output/playwright/react-wallet/test-results/wallet-wallet-transactions-37014-ct-cross-jurisdiction-order-mobile-390x844/wallet-market-cross-j-cancelled.png)
- [Laptop cancelled route](../../output/playwright/react-wallet/test-results/wallet-wallet-transactions-37014-ct-cross-jurisdiction-order-laptop-1366x900/wallet-market-cross-j-cancelled.png)
- [Wide cancelled route](../../output/playwright/react-wallet/test-results/wallet-wallet-transactions-37014-ct-cross-jurisdiction-order-wide-1920x1080/wallet-market-cross-j-cancelled.png)

## Source identity

- Base SHA: `c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81`.
- Pre-receipt working-diff SHA-256: `7363317ddae17460f07dceb5f848b09b4049020b5bc44a9d34ba8f806da3a869`.
- Pre-receipt untracked-file ledger SHA-256: `8e65935e3876a4be1320ea38d8bfd09fd8e25e2bec0fc35f37b2501dbdc1d193`.
- Browser artifact root: `output/playwright/react-wallet/test-results/`. No immutable frontend release was assembled for this task; T12 owns the release ID.
