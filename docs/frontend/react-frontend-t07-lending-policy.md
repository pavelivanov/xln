# React frontend T07 — Lending admission policy

Status: **DONE**

## Accepted contract

- The owner accepted the recommended production policy: Lending stays outside the current Account admission profile.
- Wallet exposes a truthful read-only unsupported state with the production reason and no form, command builder or submission control.
- Payments exposes only the admitted reserve transfer, collateral funding and collateral withdrawal operations; removed frontend Lending variants cannot reach the Runtime command bus.
- Production admission guards remain unchanged. No protocol, persistence or financial transition was enabled.

## Verification

- Focused Wallet/model/audit units: **65 pass, 0 fail, 2,727 assertions** in `0.7 s`.
- Wallet local gate: **889 files, 0 unsafe-type findings**; React tooling and Wallet TypeScript green.
- Browser policy and stale-selection cases: **9/9 pass** across `390×844`, `1366×900` and `1920×1080` in `17.8 s`.
- Browser assertions prove Lending contains no `form`, `button`, `input` or `select`, Payments exposes no Lending operation, and neither `/api/lending/` nor a Lending command is requested.
- Browser page/console errors: none. Scoped `git diff --check`: pass.

## Browser evidence

- [Mobile unsupported policy](../../output/playwright/react-wallet/test-results/wallet-account-wallet-acco-d1b9d-without-submission-controls-mobile-390x844/lending-unsupported-policy.png)
- [Laptop unsupported policy](../../output/playwright/react-wallet/test-results/wallet-account-wallet-acco-d1b9d-without-submission-controls-laptop-1366x900/lending-unsupported-policy.png)
- [Wide unsupported policy](../../output/playwright/react-wallet/test-results/wallet-account-wallet-acco-d1b9d-without-submission-controls-wide-1920x1080/lending-unsupported-policy.png)

## Source identity

- Base SHA: `c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81`.
- Pre-receipt working-diff SHA-256: `907da1343286b6958a5d281de1c7f09cafd7dc8fe1a8ece8f3d3e27ab1e6888b`.
- Pre-receipt untracked-file ledger SHA-256: `2abdeeae2d355c529028438f955824cf970963cc4e9cf55e7f2cf93302171f44`.
- Browser artifact root: `output/playwright/react-wallet/test-results/`. No immutable frontend release was assembled for this task; T12 owns the release ID.
