# Wallet settlement read projection

**Status: INACTIVE — outside the frontend-only scope reaffirmed by the owner
on 2026-09-05.** This proposal is retained as investigation history, not a pending
approval request or a required deliverable of the original refactor. No API
implementation has been made.

Base: `3cfcf11cb90e499215523a76700aabad22d844a0`, 2026-09-05.

The owner approved the caller-specific C2R bound correction and continuation of
settlement approval, execution and broadcast. The additional scope below is
needed because all Account read paths use `compactAccountDocForView`, which
deliberately excludes `settlementWorkspace` (`core/api/runtime-adapter/resolve.ts`).

## Proposed scope for owner approval

- Add one bounded, read-only path:
  `entity/{entityId}/account/{counterpartyId}/settlement`, using the existing
  adapter authorization, committed read lease, Account lookup and `atHeight`
  semantics. Keep aggregate Account reads and their redaction tests unchanged.
- Return the Runtime height, Account parties/status and either `workspace: null`
  or the exact workspace hash, revision, phase, proposer/executor roles, memo,
  complete typed operations and boolean signature-presence flags. No Hanko
  bytes, proof bodies, secrets, private keys, queues or alternate financial math.
  Refuse oversized operations/memo instead of silently truncating a proposal
  that a user is about to approve.
- Implement the projection in a small API module and wire one resolver branch.
  The wallet pins the point read to its visible Runtime height, displays the
  full operation list and rechecks the exact hash before `settle_approve`.
- Complete the read-only batch review contract in that scope: the current
  compact Entity core omits `recoveryBatches` and truncates R2C pairs at 50
  although the contract allows 64. Review must identify the actual next batch
  (recovered batches precede the draft), include its full bounded operations,
  and fail explicitly if it cannot represent them. No batch execution policy
  changes are proposed.
- Add narrow API tests for bounded output, redaction, null workspace and exact
  height; frontend tests for both roles, changed hashes and stale reads; real
  BrowserVM browser coverage for propose → approve → execute → broadcast →
  finalized reserve/collateral changes.

No changes to consensus, financial transitions, signing authority, contracts,
custody, persistence schemas, frozen files, production cutover or the active
development Runtime are included. This is an API projection of existing state.

Authorization: not requested further following the owner's scope clarification.
Existing frontend changes remain in the working tree for review; this proposal
does not authorize Runtime work.
