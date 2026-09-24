# React batch preflight read contract

Status: implemented and accepted by
[T04](./react-frontend-t04-batch-preflight.md) on 2026-09-20.

- Current SHA: `cc11c96158c9f413869424d9c74d022cbe0311ec` plus the preserved working changes.
- Last green command: `bun test tests/frontend/payments tests/frontend/assets/entity-input-projection.test.ts` with Bun 1.4.0: 60 tests, 305 assertions.
- First red boundary: `core/api/runtime-adapter/resolve.ts` compacts outgoing debt to 20 token buckets / 20 debts per bucket, reserves to 100 entries and each batch operation list to its last 50 entries. Nested settlement diffs and collateral pairs are also truncated. Both `view-frame` and `entity/<id>` reads use compaction. There is no completeness marker; an issue-free simulation on these projections does not prove an issue-free complete draft. React currently supplies a null warning, and its review key binds the compact batch rather than all operations.
- Artifact: `frontend/bridges/wallet/payments/pending-batch-preview.ts` now owns the unchanged retained preview/simulation adaptation. `tests/frontend/payments/frontend-wallet-batch-preflight.test.ts` covers debt priority, sufficient reserves, repaid/unrepaid deficits, settlement perspective, presentation order and input immutability using the real canonical simulation.
- Implemented boundary: `entity/<id>/batch-preflight` reads complete committed state under the existing read lease, uses the canonical reserve simulation and debt totals, and returns fixed summary/issue data bound to Runtime, height, Entity and exact draft/sent identities. React validates and displays that evidence, fails closed, and re-reads before enqueue. The read remains advisory rather than atomic with the later command.
- Accepted evidence: all compact-bound regressions, embedded and remote transports, malformed/context-changing/unresolved responses, zero-submission rejection, truthful counts, visible unsafe blocking and valid chain finality passed. See the T04 receipt for commands, counts and three-viewport screenshots.
