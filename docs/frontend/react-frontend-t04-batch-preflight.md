# T04 authoritative batch preflight receipt

**Result:** DONE on 2026-09-20. React Wallet now reads one bounded,
authoritative batch preflight from complete committed Entity state, fails closed
when that evidence is unavailable or stale, and re-reads the evidence before
every batch action.

## Source identity and contract

- Git HEAD: `c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81` plus the preserved working changes.
- New read: `entity/<entityId>/batch-preflight?atHeight=<committed height>`.
- The Runtime response binds Runtime id, committed height, Entity id, exact
  encoded draft identity, exact sent-batch identity/hash/nonce, fixed operation
  counts, reserve/debt token counts and at most the first canonical reserve
  issue. It returns no batch operations, signatures, proofs or secrets.
- The read uses the existing `simulateDraftBatchReserveAvailability` and
  `getOpenOutgoingDebtTotals` implementations against the complete live
  committed Entity replica. No financial formula was copied into React.

The endpoint rejects a historical height instead of silently answering from a
different state. Both embedded and remote adapters transport the same response
through their existing read path and committed-read lease.

## React behavior

- The Wallet observer decodes an exact-key response and validates Runtime,
  height and Entity identity. Missing, malformed, stale or mismatched evidence
  leaves broadcast disabled and displays the preflight failure.
- Review identity now combines the compact display projection with exact draft
  and sent-batch identities. The UI displays complete operation counts and
  explicitly labels a truncated operation list.
- Every broadcast, rebroadcast and clear action performs a fresh read. A
  changed review identity or read failure throws before command preparation;
  unsafe broadcast throws the canonical formatted reserve issue before enqueue.
- This remains an advisory read followed by the existing Runtime command. It
  does not claim compare-and-submit atomicity and does not change Runtime
  admission, retry, finality or clear-confirmation rules.

## Verification

| Boundary | Evidence |
| --- | --- |
| Complete-state edge cases | 6 pass, 0 fail, 24 assertions: 21st debt, 101st reserve, 51st spend, nested pair/diff overflow, exact identities, embedded transport |
| Remote transport | 1 pass, 0 fail, 35 assertions in the real RPC-wire adapter test |
| Wallet payment suite | 57 pass, 0 fail, 237 assertions |
| Action rejection | changed identity, reserve issue and unresolved read each made zero submissions; one exact valid read submitted once |
| Wallet local gate | unsafe types, React tooling and Wallet TypeScript all green |
| Browser acceptance | 6 pass, 0 fail in 14.2 s: valid chain finality plus unsafe committed-debt block at 390×844, 1366×900 and 1920×1080 |
| Diff hygiene | `git diff --check` passed |

The browser debt fixture applies the production `DebtCreated` ledger observer
to both involved test Entities, then commits a harmless fixture message so the
real remote adapter publishes the new committed height. The Wallet subsequently
reads the production preflight endpoint; no response is mocked. The unsafe
broadcast is visibly disabled, then the exact draft is cleared through the
normal confirmed action. The valid companion case broadcasts real collateral
funding and observes Runtime and chain balances through finality.

## Browser evidence

- [Unsafe preflight, mobile](../../output/playwright/react-wallet/test-results/wallet-wallet-settlement-w-8dd56-nsafe-by-new-committed-debt-mobile-390x844/wallet-batch-authoritative-preflight-blocked.png)
- [Unsafe preflight, laptop](../../output/playwright/react-wallet/test-results/wallet-wallet-settlement-w-8dd56-nsafe-by-new-committed-debt-laptop-1366x900/wallet-batch-authoritative-preflight-blocked.png)
- [Unsafe preflight, wide](../../output/playwright/react-wallet/test-results/wallet-wallet-settlement-w-8dd56-nsafe-by-new-committed-debt-wide-1920x1080/wallet-batch-authoritative-preflight-blocked.png)
- [Valid draft, mobile](../../output/playwright/react-wallet/test-results/wallet-wallet-settlement-w-7203f-ast-and-real-chain-finality-mobile-390x844/wallet-collateral-draft-review.png)
- [Valid draft, laptop](../../output/playwright/react-wallet/test-results/wallet-wallet-settlement-w-7203f-ast-and-real-chain-finality-laptop-1366x900/wallet-collateral-draft-review.png)
- [Valid draft, wide](../../output/playwright/react-wallet/test-results/wallet-wallet-settlement-w-7203f-ast-and-real-chain-finality-wide-1920x1080/wallet-collateral-draft-review.png)
