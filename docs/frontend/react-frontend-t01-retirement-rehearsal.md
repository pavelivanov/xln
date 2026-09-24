# T01 Svelte-retirement rehearsal receipt

**Result:** DONE on 2026-09-16. The live tree retains all 262 retirement
candidates; no cutover patch was applied.

## Source and artifact identity

- Git HEAD: `c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81`
- Rehearsed working-diff SHA-256: `f2e73f36faa574f84d60f7ed5266c427744ed817719dc963355908bac6b3a21b`
- Rehearsed untracked-file-list SHA-256:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
  (empty)
- Retirement list: 262 paths; SHA-256
  `313bc3c1ac671f5cf0f6004b1eb779f82e772afabca27a8e58fadc9f7ac20b9b`
- Guard patch SHA-256:
  `6253a841e060956bbfef857582ac3c2dcde3ee9b182b6568932b53dc2a1e6977`
- Command patch SHA-256:
  `473cb8035b587216d14edc0738bb644040ecc73de6a1db4d5ad38b205932bb34`
- Assembled release:
  `sha256-5b1836334f710f9582a33691cd4f31af9731d9da77fc8f32c4e5ec82cc101f51`,
  478 files

Path refresh on 2026-09-24: the parity and capability tests moved below
`tests/frontend/tooling/audit`, and the Wallet vault Runtime bridge moved below
`frontend/bridges/wallet/canonical`. The guard patch now follows both moves. A
fresh disposable copy applied both cutover patches with all 262 retirement
paths absent; **34 focused cases / 1,042 assertions** pass. The live tree still
contains every retirement target. Machine evidence:
[`receipt.json`](../../output/playwright/react-t01-path-refresh-20260924/receipt.json).

An expanded current-suite recheck reached **1,531 pass / 13 fail / 11,626
assertions**. Every failure is Bun 1.4 `EBADF` while `bun:test` tries to spawn
nested Bun, Bash, or OpenSSL processes; the generated-input failure reproduces
unchanged in the live checkout, including with Bun's documented isolated
`--parallel=1` worker mode; Bun's Node-compatible `child_process.spawn`
delegates to the same failing primitive. The retained
[`full-tests.log`](../../output/playwright/react-t01-path-refresh-20260924/full-tests.log)
is not presented as a passing current full-suite run and does not replace the
original green full rehearsal below.

The disposable copy was `/tmp/xln-react-t01.1oi1Od`. It contained the source
identity above, applied both reviewed patches, removed exactly the listed
paths, and shared only read-only repository metadata and installed dependencies
with the source checkout.

## Verification

All commands used pinned Bun 1.4.0 from
`/tmp/xln-bun-1.4.0/bun-darwin-aarch64/bun`.

| Boundary | Command | Exit / evidence | Duration |
| --- | --- | --- | --- |
| Full frontend tests after deletion | `bun test tests/frontend` | 0; 1,537 pass, 0 fail, 11,697 assertions | recorded by the rehearsal runner |
| Affected core group | `bun test` over frontend-check output, token metadata, J ingress, health isolation, canonical payment, and browser helper tests | 0; 35 pass | 1.38 s |
| Focused production startup wiring | two exact `--test-name-pattern` runs | 0; 5 pass | 0.09 s |
| Root frontend development assertions | exact dev-readiness and dev-startup-hardening patterns | 0; 2 pass | 0.10 s |
| All React types | `bun scripts/check.ts --all --level=local` from `frontend` | 0 | included in aggregate evidence |
| Frontend aggregate | `bun scripts/check.ts --all --level=frontend` from `frontend` | 0; units, checks, prepare, four builds, assembly | 41 s |
| Guard patch | `git apply --check --unidiff-zero docs/frontend/react-frontend-retirement-guards.patch` | 0 | <1 s |
| Command patch | `git apply --check --unidiff-zero docs/frontend/react-frontend-cutover-commands.patch` | 0 | <1 s |
| Working diff | `git diff --check` | 0 | <1 s |
| Deletion-set dependency scan | static imports plus explicit file-read scan after deletion | 0 executable edges | <1 s |

The direct file-read scan retains only negative assertions that reject imports
from `frontend/src/lib`. Every positive source assertion is mapped in
[the cutover review](react-frontend-cutover-review.md).

The general `core/__tests__/testing/runner/e2e-runner-isolation.test.ts` suite
has an unrelated pre-existing load error:
`Export named 'batchPlaywrightTargetsByFile' not found`. Its T01 assertion now
reads the surviving React app config rather than the deleted Svelte Vite config.
The production runner API gap is assigned to T11; it was not suppressed.

## Browser and F12 evidence

A real Wallet fixture and committed cross-jurisdiction route exercised
`data-testid="cross-j-safety-banner"`. The final console had **0 errors** and
**0 warnings**. All screenshots were inspected:

- [mobile 390×844](../../output/playwright/t01-wallet-cross-safety-390x844.png)
- [laptop 1366×900](../../output/playwright/t01-wallet-cross-safety-1366x900.png)
- [wide 1920×1080](../../output/playwright/t01-wallet-cross-safety-1920x1080.png)

The note is fully readable at each size. Mobile uses the existing bottom
navigation and stacked fields; laptop and wide layouts retain one aligned
cross-jurisdiction ticket without clipping.

## First failures repaired

1. The strict Docs catalog still named a retired `SwapPanel.svelte` owner.
   The catalog now follows the React/shared operational owners.
2. The first local listener attempt failed with sandbox `EPERM`; the owned
   alternate-port fixture was rerun with explicit local-listener permission
   under the stand lock.
3. Recovery-service assertions depended on Svelte formatting. They now assert
   the same behavior against the React owner without layout-sensitive source
   text.

The stand lock was free after cleanup. All 262 retirement candidates remain in
the live checkout. T17 still requires T01–T16 and explicit C02 authority.
