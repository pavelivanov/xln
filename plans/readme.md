# React frontend migration — start here

The React frontend migration is active and may start from the current branch.
These documents are working implementation guidance, not approval gates:

- [Migration work plan](react-frontend-migration.md)
- [Finish wallet and ops UI ports](wallet-ops-ui-ports.md)
- [Scoped refactor status](react-frontend-refactor-status-2026-09-05.md)
- [Technical decisions](react-frontend-migration-decisions.md)

## Goal

Deliver these outcomes together:

1. Split the browser frontend into independently owned `site`, `docs`, `wallet`,
   and `ops` applications.
2. Rewrite retained Svelte UI in React, Vite, and strict TypeScript without
   intentionally changing product behavior.
3. Give each application fast, independent checks and build outputs while
   retaining repository and release checks at integration boundaries.

## Start now

Begin with the first ready work packages in the migration plan. Work does not
depend on Gate A/Gate B manifests, immutable approval records, a clean global
baseline, separate child plans, PR metadata, external reviewers, or a green
repository-wide check.

Use the current application and its tests as the behavior reference. Inventory
routes, capabilities, storage, workers, generated inputs, PWA/native consumers,
and browser tests as each surface is touched. An incomplete inventory is work
to finish, not a reason to block unrelated scaffolding or migration slices.

## Working agreement

- Keep changes inside the frontend migration scope.
- Prefer small, reviewable increments, but split or combine them when that makes
  the implementation safer or clearer.
- Run the narrowest useful checks for the changed surface. Record unrelated
  failures and continue frontend-only work.
- Do not weaken, skip, or delete an existing assertion to make React pass.
- Keep Svelte canonical while candidate React applications are incomplete.
- Treat canonical cutover, Svelte deletion, and production activation as
  separately authorized integration/release operations.

## Current status

| Artifact | Status | Next action |
|---|---|---|
| [Migration work plan](react-frontend-migration.md) | `IN PROGRESS — FOUR APP ROOTS BUILD; WALLET/OPS UI PARTIAL; DEFAULT FRONTEND STILL SVELTE` | Finish retained UI behavior using the focused checklist; route declarations do not measure completion. |
| [Wallet and ops UI ports](wallet-ops-ui-ports.md) | `IN PROGRESS — ACCOUNT DROPDOWN, SIX RAIL CONSUMERS AND SHARED WALLET ENTITY SELECTION; UI PARITY PARTIAL` | Latest targeted checks: 58 unit tests and 12 browser cases pass; 29 screenshots reviewed. Dropdown verifies 26 real Accounts across two pages. Last full wallet matrix, before rail/dropdown: 83 pass / 1 fail from a backend history-pagination defect; full registered 90 cases not run; latest ops checkpoint: 42/42. Next: Account/token action context and remaining forms, then onboarding/Ownership and remaining ops context/panels. |
| [Scoped refactor status](react-frontend-refactor-status-2026-09-05.md) | `CURRENT SCOPE BASELINE — 2026-09-05` | Keep backend extensions and financial follow-ups outside the frontend refactor. |
| [Technical decisions](react-frontend-migration-decisions.md) | `ACTIVE` | Use the recorded application, route, build, and coexistence decisions. |

WP9 parity follows application completion; WP10 cutover and WP11 production
activation remain separately owner-authorized.

Only stop for a decision when the work would change product behavior, cross
into Runtime/consensus/contracts/financial logic, remove a retained capability,
or activate production.
