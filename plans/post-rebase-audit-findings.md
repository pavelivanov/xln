# Implement the post-rebase audit findings

> **Executor instructions:** Follow this plan in order. Complete each checkbox
> and run its verification command before advancing. Do not push, force-push,
> tag, sign, publish, deploy, or edit frozen-core state. If a STOP condition
> occurs, report the exact command and first error instead of improvising.
>
> **Drift check (run first):**
> `git diff --stat fe74bbb44..HEAD -- VERSION package.json frontend/package.json packages/npm/xlnfinance/package.json native/extension/manifest.json frontend/packages/ui/src/releases/release-signature.ts frontend/bridges/wallet/canonical/wallet-canonical-local-password.ts frontend/apps/wallet/src/app-shell.tsx frontend/apps/wallet/src/security frontend/tests/react-candidate/wallet/security tests/frontend/security/wallet-local-password.test.ts tests/e2e/qa/e2e-local-password.spec.ts plans`
>
> If any in-scope file changed, compare the live implementation with the
> “Current state” section. If the release catalog now contains a signed
> `0.1.32`, or the React wallet already has the required pre-unlock chooser,
> STOP and report the drift before editing.

## Status

- **Priority:** P0 publication blocker
- **Effort:** M — approximately one focused implementation day plus browser/root verification
- **Risk:** HIGH — release identity and local wallet authority selection
- **Depends on:** none
- **Category:** correctness / migration / tests
- **Planned at:** commit `fe74bbb44`, 2026-09-28
- **Upstream evidence:** `0300429d6` and `1248f788e`

## Outcome

This plan closes the two semantic losses found after the React migration was
certified:

1. Every distributable and compiled release surface names the currently signed
   release, `0.1.31`. The plan does not create, sign, or imply a `0.1.32`
   release.
2. A locked React wallet first shows “Create a wallet” plus the saved-wallet
   chooser. No password input or Runtime authority is opened until the user
   chooses a saved wallet. Create and restore remain available without first
   unlocking the active saved wallet.
3. Focused tests, all three React viewports, frontend checks, and the root check
   pass against one unchanged source revision before publication readiness is
   restored.

## Why this matters

Upstream `0300429d6` deliberately reverted an unattested partial version bump,
but the rebased tree now mixes `0.1.31` and `0.1.32`; the canonical release
integrity test fails. Upstream `1248f788e` made wallet creation and saved-wallet
selection available before password entry. The retained `ui` preserves that
flow, while the React replacement immediately prompts for the currently active
wallet and exposes only restore. A publication from the current tree would
therefore carry inconsistent release identity and a known wallet-entry
regression.

## Current state

Reconfirm each fact after the drift check:

- `VERSION`, `frontend/package.json`, `native/extension/manifest.json`, and
  `CURRENT_XLN_RELEASE_VERSION` say `0.1.32`.
- Root `package.json`, `packages/npm/xlnfinance/package.json`, and the signed
  release catalog say `0.1.31`. There is no `docs/releases/0.1.32.md` or signed
  `docs/releases/data/0.1.32.json`.
- `tests/release-integrity/foundation-hanko.test.ts:48-58` requires all five
  distributable versions and `CURRENT_XLN_RELEASE_VERSION` to equal `VERSION`.
  It currently fails first at root `package.json`.
- `frontend/apps/wallet/src/app-shell.tsx:211-230` renders the password gate
  before the normal launcher. The create launcher is lower in the component at
  approximately line 262 and cannot be reached while a saved wallet is locked.
- `frontend/apps/wallet/src/security/wallet-local-password.tsx:106-108` exposes
  only “Restore wallet” as its secondary entry action.
- `frontend/tests/react-candidate/wallet/security/wallet-local-password.spec.ts`
  covers enrollment, reload, wrong password, unlock, lock, and restore, but not
  create-before-unlock or saved-wallet selection.
- `tests/e2e/qa/e2e-local-password.spec.ts:13-15,48-50` is the historical
  behavior contract: show “Create a wallet,” show no password field, and require
  selection of a saved wallet before password entry.
- `frontend/bridges/vault/vault-metadata-store.ts` already exposes persisted
  runtimes ordered newest-first through `allRuntimes`. Do not import that store
  into React; project a secret-free entry model through the canonical wallet
  bridge.
- `unlockCanonicalWalletRuntime(runtimeId, seed, ...)` already calls the
  canonical vault unlock and Runtime selection path. A UI-only preselection
  must remain transient until successful unlock.

## Repository constraints

- Work on current `main`; do not create a branch/worktree unless the owner asks.
- Use Bun `1.4.0`. Preserve unrelated changes.
- Never edit `frozen-core.json` or run `bun run frozen-core:approve`.
- Do not create a release tag, catalog entry, Hanko, attestation, or manifest
  for `0.1.32`. That is a separate owner-authorized release operation.
- Keep vault reads, Runtime selection, password operations, and persisted-state
  decoding in `frontend/bridges/**` or `frontend/packages/browser/**`. React
  receives secret-free projections and invokes typed bridge operations.
- Do not reintroduce `frontend/src`, Svelte code, compatibility aliases,
  fallback readers, or a second wallet-unlock implementation.
- No password, mnemonic, seed, protected-secret ciphertext, device key, or
  capability token may enter a React prop, DOM attribute, log, screenshot, or
  browser storage assertion output.
- Browser-visible changes require console/page-error checks and screenshots at
  390×844, 1366×900, and 1920×1080.
- Check `bun run stand:status` before each browser run and hold the stand lock
  for the complete run.

## Commands

Run from the repository root unless stated otherwise.

| Purpose | Command | Expected result |
| --- | --- | --- |
| Toolchain | `bun --version` | exactly `1.4.0` |
| Release regression | `bun test tests/release-integrity/foundation-hanko.test.ts tests/release-integrity/release-manifest.test.ts native/__tests__/native-build-options.test.ts` | all pass |
| Foundation catalog | `bun run foundation-release:verify` | verifies existing `0.1.31` Hanko/catalog; no writes |
| Wallet units | `bun test tests/frontend/security/wallet-local-password.test.ts` | all pass, including new entry-list cases |
| Wallet local gate | `cd frontend && bun scripts/check.ts --surface=wallet --level=local` | exit 0 |
| Stand availability | `bun run stand:status` | reports available before each browser run |
| Root integration | `bun run check` | exit 0 on a host permitting required loopback listeners |
| Diff hygiene | `git diff --check && git status --short` | no whitespace errors; only planned files changed |

## Scope

**In scope — modify only when required by the steps:**

- `VERSION`
- `package.json`
- `frontend/package.json`
- `packages/npm/xlnfinance/package.json`
- `native/extension/manifest.json`
- `frontend/packages/ui/src/releases/release-signature.ts`
- `tests/release-integrity/foundation-hanko.test.ts`
- `frontend/bridges/wallet/canonical/wallet-canonical-local-password.ts`
- `frontend/apps/wallet/src/app-shell.tsx`
- `frontend/apps/wallet/src/security/wallet-local-password.tsx`
- `frontend/apps/wallet/src/styles/security/wallet-local-password.css`
- `tests/frontend/security/wallet-local-password.test.ts`
- `frontend/tests/react-candidate/wallet/security/wallet-local-password.spec.ts`
- `plans/post-rebase-audit-findings.md`
- `plans/post-rebase-semantic-recovery.md` and `plans/readme.md` for status only

**Out of scope:**

- `docs/releases/**` and `frontend/static/docs-catalog/releases/**` — the plan
  consumes the existing signed `0.1.31`; it does not rewrite release evidence.
- `tests/e2e/qa/e2e-local-password.spec.ts` — preserve it as historical intent;
  port its guarantees into the React-specific spec instead of weakening it.
- `ui/**` — its `GateWelcome` already preserves the upstream behavior.
- Runtime, Entity, Account, consensus, financial formulas, contracts,
  persistence schemas, custody semantics, and `frozen-core.json`.
- Force-push, normal push, deployment, publication, signing, or tagging.

## Git workflow

- Stay on current `main`, matching the repository instruction.
- Use one logical commit per completed behavior if the owner asks for commits:
  `fix(release): restore canonical version identity` and
  `fix(frontend): restore wallet choice before unlock`.
- Do not commit, push, or open a PR unless explicitly instructed.

## Execution order and task list

| ID | Task | Priority | Depends on | Status |
| --- | --- | --- | --- | --- |
| F01 | Establish failing characterization and drift baseline | P0 | — | DONE |
| F02 | Restore the signed `0.1.31` release identity | P0 | F01 | DONE |
| F03 | Restore create/select-before-unlock in React | P0 | F01 | DONE |
| F04 | Re-certify the exact repaired source | P0 | F02, F03 | TODO |

### F01 — Establish failing characterization and drift baseline

- [x] Record `git rev-parse HEAD`, `git status --porcelain`, and
      `bun --version`. STOP if the worktree contains an overlapping user change
      or Bun is not `1.4.0`.
- [x] Confirm the remote boundary remains
      `origin/main=566c850b37f37b5d0c713a84070bfcb9a6bc6d22` with
      `git ls-remote origin refs/heads/main`. If it changed, STOP and repeat the
      upstream semantic audit before implementing this plan.
- [x] Confirm `docs/releases/manifest.json` has `latest: 0.1.31`, a signed
      `0.1.31` entry, and no `0.1.32` entry. STOP if a real `0.1.32` release now
      exists.
- [x] Run only the canonical-version test:
      `bun test tests/release-integrity/foundation-hanko.test.ts -t "keeps every distributable package on the canonical release version"`.
      Record the expected pre-fix failure (`0.1.31` versus `0.1.32`).
- [x] Add unit characterization to
      `tests/frontend/security/wallet-local-password.test.ts` for a secret-free,
      newest-first list of saved wallet entries. Cover two wallets, empty
      labels, per-wallet enrollment/locked/recovery states, and exclusion of
      seeds/protected-secret objects from the result.
- [x] Extend the React password browser specification with the upstream order:
      after creating and locking a saved wallet, reload shows “Create a wallet”
      and its saved-wallet row, with zero password inputs. Clicking that row is
      the only action that reveals its password form.

**Verify:**

1. Run the single release test above → it fails only on the version mismatch.
2. Run `bun test tests/frontend/security/wallet-local-password.test.ts` → the
   new entry-list characterization fails only because the bridge projection is
   absent or incomplete.
3. After `bun run stand:status`, run the laptop browser case under the stand
   lock with the F04 command → it fails at the new create/chooser assertion
   before any password submission. An unrelated startup, console, or Runtime
   failure is a STOP condition.

F01 evidence (2026-09-28): source `16de2e20408771599e81e6f3005a3dcc9c14b2bb`,
clean starting worktree, Bun `1.4.0`, and remote `main` at the required
`566c850b37f37b5d0c713a84070bfcb9a6bc6d22`. The release test failed only on
root package `0.1.31` versus `VERSION` `0.1.32`; the wallet unit failed only on
the absent `projectWalletLocalPasswordEntries` export; the locked laptop browser
case failed first on the absent “Create a wallet” chooser before password entry.

### F02 — Restore the signed `0.1.31` release identity

- [x] Set `VERSION`, root `package.json`, `frontend/package.json`,
      `packages/npm/xlnfinance/package.json`, and
      `native/extension/manifest.json` to exactly `0.1.31`.
- [x] Set `CURRENT_XLN_RELEASE_VERSION` in
      `frontend/packages/ui/src/releases/release-signature.ts` to `0.1.31`.
- [x] Do not create or edit release catalog rows, release snapshots, tags,
      attestations, frozen-core hashes, or generated release documents.
- [x] Run the release regression command from the Commands table.
- [x] Run `bun run foundation-release:verify`; it must verify the existing
      signed `0.1.31` evidence without changing tracked files.
- [x] Run
      `rg -n '0\.1\.32' VERSION package.json frontend/package.json packages/npm/xlnfinance/package.json native/extension/manifest.json frontend/packages/ui/src/releases/release-signature.ts`.
      Expected result: no matches.

**Verify:** all release/native tests pass, Foundation verification succeeds,
and `git status --short` shows only the six intended version files plus plan
status changes.

F02 evidence (2026-09-28): the regression set passed `26/26` tests and `217`
assertions when invoked with rooted `./` test paths to avoid Bun 1.4.0's macOS
test-filter descriptor leak. Foundation verification accepted signed release
`0.1.31` with envelope hash
`0xeb674f72c7f270ead0a7491834ff4e653ccece8b03bc28d4e63ebff7cd10f245`;
the `0.1.32` search returned no matches, and verification changed no release
catalog, snapshot, generated release document, or frozen-core file.

### F03 — Restore create/select-before-unlock in React

- [x] Extend the canonical local-password bridge with a read-only entry
      projection containing only `runtimeId`, display `label`, and gate `state`.
      Derive it from validated persisted vault metadata; order entries by the
      existing newest-first `createdAt` convention. Never return seed,
      `protectedSecrets`, password-vault bytes, signer data, or Runtime state.
- [x] Preserve `projectWalletLocalPasswordGate` as the single state-rule owner.
      Factor a small reusable per-runtime projection rather than duplicating its
      enrollment/locked/recovery decisions for the entry list.
- [x] Add an explicit welcome state to `WalletLocalPassword`. It must render
      “Create a wallet,” “Restore a wallet,” and one button per saved wallet.
      It must render no password field until a saved wallet is selected.
- [x] Keep saved-wallet selection transient in React. Clicking a row selects
      the entry for display only; it must not write `activeRuntimeId`, start a
      Runtime, restore a device key, or acquire command authority. The existing
      canonical unlock operation selects the Runtime only after password-vault
      decryption succeeds.
- [x] Route “Create a wallet” into `IdentityOnboarding` with no unlock target.
      Preserve the existing recovery entry as a separate explicit action.
      Back navigation must return to the chooser and clear password,
      confirmation, busy, and error state.
- [x] After successful enrollment/unlock, refresh the app-shell environment and
      proceed through the existing canonical Runtime lifecycle. Do not add a
      second boot or selection path.
- [x] Update the security CSS using the existing wallet identity tokens and
      responsive containment. Do not copy the retired Svelte inline styles.
- [x] Complete unit coverage for empty list, one wallet, multiple wallets,
      active/non-active selection, wrong password, successful unlock, create,
      restore, back, and remote-runtime exclusion.
- [x] Complete the React browser specification for create-before-unlock,
      saved-wallet selection, no premature password field, no premature Runtime
      UI, wrong-password rejection, successful unlock, explicit lock, create,
      restore, and absence of secrets in local/session storage.

**Verify:**

1. `bun test tests/frontend/security/wallet-local-password.test.ts` → all pass.
2. `cd frontend && bun scripts/check.ts --surface=wallet --level=local` → exit 0.
3. `rg -n "seed|protectedSecrets|ciphertext|deviceKey" frontend/apps/wallet/src/security/wallet-local-password.tsx` → no secret-bearing React contract.

F03 evidence (2026-09-28): the canonical bridge now returns only secret-free
`runtimeId`, display `label`, and per-wallet gate `state`, ordered newest-first
from validated vault metadata. Post-review correction removed the targetless
Runtime boot from saved-wallet enrollment: the bridge now decrypts only the
chosen device lease, persists its password vault, retires its bootstrap key,
then invokes the existing canonical unlock/select path. The two-wallet
regression proves the prior active wallet remains unchanged through restore,
password persistence, and key deletion. The post-review type correction makes
gate views a true discriminated union and makes chooser versus direct-enrollment
props mutually exclusive, so an `unlocked` view is no longer accepted by the
password component. The focused unit boundary passed
`11/11` tests and `33` assertions; the Wallet local gate passed all three steps with `674`
unsafe-type files and `0` findings; the React secret-contract search returned
no matches; and `git diff --check` passed. The laptop `1366×900` browser flow
passed `1/1` in `12.5s` under the stand lock with chooser/create/restore/back,
transient selection, wrong-password reset, canonical unlock, explicit lock,
containment, screenshots, storage secrecy, and zero unexpected browser errors.
The first sandboxed browser attempt could not bind `127.0.0.1:19080` (`EPERM`);
the required loopback-enabled rerun passed. All three viewport runs remain F04.

### F04 — Re-certify the exact repaired source

- [ ] Record the candidate SHA and confirm `git status --porcelain` contains
      only planned changes. Any implementation change after this point restarts
      F04.
- [ ] Run the complete focused unit set:
      `bun test tests/release-integrity/foundation-hanko.test.ts tests/release-integrity/release-manifest.test.ts native/__tests__/native-build-options.test.ts tests/frontend/security/wallet-local-password.test.ts tests/frontend/onboarding/brainvault/frontend-wallet-brainvault-derivation.test.ts`.
- [ ] Run the Wallet local gate and `git diff --check`.
- [ ] Run `bun run stand:status`. Then run the React local-password spec under
      the stand lock once per project: `mobile-390x844`,
      `laptop-1366x900`, and `wide-1920x1080`. Use this command with the project
      substituted, sequentially:

      `bun run stand:run --reason post-rebase-wallet-entry-<project> --timeout-ms 60000 -- sh -c 'cd frontend && PLAYWRIGHT_REACT_SURFACE=wallet bunx playwright test --config playwright.react.config.ts tests/react-candidate/wallet/security/wallet-local-password.spec.ts --project=<project>'`

      Each run must pass with containment screenshots and zero unexpected
      console/page errors. Poll the original process handle; do not start a
      second run while one is live.
- [ ] Run `cd frontend && bun run check`. It must pass. Socket/listener denial is
      an environment failure, not authorization to skip or weaken tests.
- [ ] Run `bun run check` on a host permitting required loopback listeners. It
      must exit 0 on the same source revision. Inspect `git status` afterward and
      reject unrelated generated changes.
- [ ] Update this task table and the reopened R04/R08/R09 status in
      `plans/post-rebase-semantic-recovery.md` only after recording exact command
      counts, source SHA, browser projects, and first red command (`none` only
      when all required gates passed).
- [ ] Produce a new six-field publication handoff: current SHA, last green
      command, first red command/error, exact release/artifact path, next single
      command, and remaining final gates. Do not push.

## Test plan

- Unit pattern: extend `tests/frontend/security/wallet-local-password.test.ts`.
  Keep projections pure and inject dependencies into operations as the file
  already does.
- Browser pattern: extend
  `frontend/tests/react-candidate/wallet/security/wallet-local-password.spec.ts`.
  Reuse `restoreLocalWallet`, storage secret checks, `expectPageContained`,
  screenshot evidence, and browser-error observation.
- Historical behavior source: preserve the assertions at
  `tests/e2e/qa/e2e-local-password.spec.ts:13-15,48-50`; do not rename a missing
  React behavior into apparent success.
- Release pattern: use the existing equality test in
  `tests/release-integrity/foundation-hanko.test.ts`; do not add a weaker second
  version check.

## Done criteria

- [ ] All six release-version owners read `0.1.31`.
- [ ] Existing signed catalog/Hanko verification passes without catalog edits.
- [ ] A locked React wallet initially shows create, restore, and saved wallets;
      it shows no password field until one saved wallet is selected.
- [ ] Selecting a saved wallet before unlock performs no persistent selection,
      Runtime start, key restoration, or authority acquisition.
- [ ] Create and restore are reachable without unlocking an existing wallet.
- [ ] Wrong-password, unlock, explicit lock, and secret-non-persistence
      assertions remain green.
- [ ] Focused units, Wallet local check, all three browser projects, frontend
      aggregate, and root `bun run check` pass on one unchanged source revision.
- [ ] `git diff --check` passes and no out-of-scope file is modified.
- [ ] R04/R08/R09 are recertified with new evidence; stale 2026-09-28 evidence
      is not reused.
- [ ] No push, force-push, tag, signing, deployment, or publication occurred.

## STOP conditions

Stop and report instead of improvising if:

- The owner requests `0.1.32`. That requires a separate authorized release plan
  with synchronized versions, snapshot, catalog, tag, Hanko, and attestation;
  this repair plan must not manufacture those artifacts.
- Remote `main` moved beyond `566c850b3` or any in-scope file materially drifted
  from the current-state evidence.
- Selecting a locked non-active wallet requires decrypting or restoring it
  before the password is submitted. Report the exact vault API boundary; do not
  persist a provisional active selection or add a fallback.
- React would need access to seed, ciphertext, protected-secret, device-key, or
  signer material.
- The fix requires Runtime/Entity/Account transitions, custody semantics,
  contracts, persistence schemas, or frozen-core changes.
- `FROZEN_CORE_VIOLATION` appears.
- A focused gate fails twice without new evidence, or a required browser/native
  environment is unavailable for final certification.

## Maintenance notes

- Future release bumps must update every version owner atomically and must not
  precede signed catalog/attestation readiness.
- Future wallet entry changes must preserve the separation between transient UI
  choice and canonical Runtime authority selection.
- Reviewers should scrutinize secret lifetime, whether clicking a saved row has
  side effects, and whether the browser evidence genuinely begins from a locked
  multi-wallet state.
- Any source change after F04 invalidates only affected evidence, but the final
  source/release binding and publication handoff must be regenerated.
