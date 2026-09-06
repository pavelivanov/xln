# React ports and audit follow-up — 2026-09-06

Status: **historical evidence; current work is tracked only in the [refactor plan](../../plans/react-frontend-migration.md)**.
Base: `main` at `ab7d45f8c4ec562f9f0c67cc1b8cabfc880f9346`, plus the uncommitted changes described here.
This records the owner's “B, then A” increment followed by status/tooling reconciliation. Its counts and open-work descriptions are historical, not the current refactor backlog.

## B — retained UI and framework isolation

- Ops Gossip can open an exact Entity in a separate dock panel. A workspace-owned session shares one remote adapter; each Entity owns its query observer, Account/Activity pagination, navigation, and history. Closing a sibling releases its lease; final teardown disconnects. The default panel and generic operator panels retain their existing context.
- The real browser test selects two different Entities, reads historical state in one while the other remains live, reopens the same panel without duplicating it, closes it, and verifies server-side connection teardown. Mobile opens within the current group; wider screens split to the right.
- Docked Entity layouts now respond to panel width. Page-sized headings and two-column page layouts no longer clip narrow dock panels. History input IDs are unique per component.
- Wallet `#ownership` and `#settings/consensus` now mount shared committed board/Account-head projections. Entity switching and reload preserve the selected identity. Assets and Settings expose the new destinations. Ownership command forms are still unported.
- All eight active canonical wallet bridges use the existing `readStoreValue` contract instead of importing `svelte/store`. This removes their direct framework import; it does **not** remove transitive Svelte stores or the React apps' retained-helper imports.

## A — status and test tooling

- The typed route report now records **18 complete / 2 partial** routes, with wallet operations, framework isolation, candidate verification, and the full ops workspace tracked as explicit gaps. Browser parity is no longer marked verified merely because test files exist.
- Wallet requirement records distinguish partial implementation from completion and name unresolved positive-flow evidence, Lending admission, settlement approval/execution, cross-j commands, and Activity history dependencies. New Ownership/Consensus evidence routes are inventoried.
- The four missing shared-module owners are recorded in the capability inventory.
- The command-bus tests now exercise the current input schema and accepted/observed completion path. Retired server ingress receipt/URL expectations were replaced with assertions that those paths remain absent; no receipt API was restored. The consensus test fixture uses `certifiedFrameHead`.
- The all-app browser harness starts one real Runtime fixture. Worker helpers and the web-server process receive the same resolved fixture port, including custom-port runs.
- `check.ts` supports `local`, `slice`, `frontend`, and `--changed-from`. A slice requires one surface and one registered browser spec, then runs local checks, preparation, build, and that spec at the configured viewports. Frontend level retains the failing shared-boundary contract. Changed-file selection includes staged/unstaged changes against the requested commit and untracked files; shared/unclassified changes select all apps.

## Verification

| Evidence | Result | Log |
|---|---|---|
| Focused audit regressions, 10 files | 66 pass; 1 retained-source import boundary failure | `/tmp/xln-ports-focused-final.log` |
| Gateway and scoped-check tooling, 3 files | 16 pass, 0 fail | `/tmp/xln-ports-tooling-final.log` |
| Final wallet route/model audit | 12 pass, 0 fail | `/tmp/xln-ports-route-tests.log` |
| Ops slice command end to end | Typecheck, prepare, build, 3 viewport cases pass | `/tmp/xln-ports-ops-slice.log` |
| Existing ops panels plus new session flow | 12 pass; later layout/session refinements verified by the slice run | `/tmp/xln-ports-ops-browser.log` |
| Wallet Ownership/Consensus | 3 viewport cases pass | `/tmp/xln-ports-wallet-evidence-matrix.log` |
| All-app bootstrap: docs + wallet + ops, custom ports | 3 pass | `/tmp/xln-ports-all-bootstrap.log` |
| Frontend level | Four app typechecks pass; contracts 25 pass / 1 failure; stops before build as intended | `/tmp/xln-ports-frontend-gate.log` |
| Direct four-app preparation/build/assembly | Pass; 370 files | `/tmp/xln-ports-build.log` |
| Candidate byte verification | Pass | `/tmp/xln-ports-release-verify.log` |
| Root `bun run check`, disposable source snapshot | 26 pass / 100,156 assertions, then contract compiler cache-lock timeout | `/tmp/xln-ports-root-check.log` |
| Browser registration | 207 cases in 24 files; not a full-suite pass claim | `/tmp/xln-ports-browser-inventory.log` |

Candidate: `sha256-d12541b53c9fb20f0700db132b97ab8fc4ddfdd666180781993a164fadf7e01c`.
The root snapshot is `/tmp/xln-ports-check-nr4m9osn`; the active dev stack was not restarted or modified. Contract compilation failed waiting 60 seconds on `/Users/p/Library/Caches/hardhat-nodejs/compilers-v3/compiler-download-list`.

Screenshots at 390×844, 1366×900, and 1920×1080 were inspected. The initial dock split clipped content; panel-width layout fixes were applied and reverified. Final ops composition: 8/10; wallet evidence: 7/10 (readable, with room to reduce existing shell whitespace). Browser cases check console/page errors and horizontal page containment. These are Chromium viewport checks, not native iOS validation.

## Still open

1. Finish shared local/scenario ops context, visible vault-backed owner unlock, retained panels, Graph3D/playback, palette/localization/guide integration, and the complete public `/embed` path. The internal four-panel host deliberately does not overwrite the canonical persisted full-workspace layout.
2. Finish Ownership commands, settlement approval/execution, remaining wallet settings and cross-j actions. Lending mutations remain rejected by the backend profile; Activity same-frame pagination and remote settlement projection remain backend dependencies. No financial, consensus, custody or persistence policy was changed.
3. Extract the retained helpers and transitive stores into framework-neutral owners. The strict source-boundary test stays red until that work is complete.
4. After these gaps close, run the complete candidate matrix and release gates. Svelte remains canonical; nothing was committed, pushed, deployed or cut over in this follow-up.

## Active workspace-goal follow-up

The owner promoted the first open item to an active goal. Shared local session,
visible remote owner unlock, retained Console/I/O/Audit/J-State/LevelDB/Runtime
Manager, scenario/trail Graph3D and guide/locale integration have landed in the
uncommitted frontend. Remaining work is now tracked in the [current refactor plan](../../plans/react-frontend-migration.md).
The following registry and gate results describe this historical checkpoint. The internal registry has eleven real components and still
uses null layout storage. This does not close the public `/embed` goal, full
retained-panel parity or migration. Current root check repeats the Hardhat
compiler cache mutex timeout after 26 passing BrainVault tests.
