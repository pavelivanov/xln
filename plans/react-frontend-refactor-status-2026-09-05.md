# React frontend refactor status — 2026-09-05

Scope: split the existing frontend into separate React applications while
preserving existing behavior. No new product features, financial rules,
Runtime APIs, contracts, custody behavior or production deployment are part of
this status. Based on `main` at `3cfcf11cb90e499215523a76700aabad22d844a0` plus
the current uncommitted frontend work.

## Overall status

**The four-app split is implemented and builds. The replacement of the Svelte
frontend is partially complete.**

The remaining work is primarily porting and connecting existing UI, removing
framework dependencies, and making the React outputs the default frontend.
Counting route declarations does not measure how much of the UI is migrated;
the earlier “19 complete / 1 partial” headline overstates completion.

## Applications

| App | Status | Implemented | Remaining within the refactor |
| --- | --- | --- | --- |
| `site` | React implementation present | Seven public site routes, own Vite/TypeScript root and assets | Final regression check when switching default outputs |
| `docs` | React implementation present | Docs reader, catalog, search model and generated content | Complete interaction parity evidence for search, history and anchors |
| `wallet` | Partially migrated | React shell, setup/Formation/Hub Discovery, direct opening, focused Account details and appearance; paginated Account dropdown and six Account rail destinations; shared Entity selection across assets, health, payments and markets; activity, settings, recovery and canonical navigation | Move/Lending/History/Manage and Account/token/jurisdiction context across action forms and ops; live disputed/faucet, automatic hub join and remote-owner/reload evidence; Ownership and settings parity; retained Svelte store dependencies |
| `ops` | Partially migrated | Health, QA/HLT/quorum, runs, scenarios, AI and an internal dock hosting Entity read views, Gossip, Solvency and Runtime Diagnostics | Mount the complete existing workspace at `/embed`; finish its panel registry, local/scenario context, Graph3D and remaining actions; finish existing keyboard/localization behavior |

Evidence: [app ownership and routes](/Users/p/Projects/xln/frontend/config/surfaces.ts),
[wallet entry](/Users/p/Projects/xln/frontend/apps/wallet/src/app-shell.tsx),
[ops route resolver](/Users/p/Projects/xln/frontend/apps/ops/src/ops-model.ts),
[React workspace](/Users/p/Projects/xln/frontend/apps/ops/src/ops-entity-workspace.tsx).
`/embed` still resolves to the candidate's pending view; the Entity workspace
is reached through an internal candidate URL. Its dock now mounts four real
panels; the complete workspace and public route remain unfinished.

The React post-creation form uses the existing shared setup and hub commands.
Profile, policy/jurisdiction
preferences, recovery drafts, failed-discovery handling and manual completion
are verified against a real local Runtime. Incomplete setup resumes and gates
other wallet screens; completed wallets keep the existing bypass behavior.
Assets → Create Entity uses the retained Formation
command sequence shared with Svelte. Local numbered registration and a weighted
lazy board are verified, including duplicate rejection and exact preview/ID
agreement. Assets → Open Account now mounts manual Hub Discovery and opens a
real local Account through the retained command. Remote discovery verifies its
existing Account and loads actual fee/count/profile details through the existing
read API. Direct Open by ID now shares recipient parsing and the retained
command/validation with Svelte, opens a real local Account, rejects invalid/self/
unverified-role targets and duplicates, and preserves Entity selection through
`#accounts/open` and browser history. Assets → View Account now opens local and
exact remote Account details with canonical capacities/credit, expandable
token tables, dispute status and retained activity filters/formatting. Both
remote perspectives are checked against the portfolio projection. Active
disputed entries mount the same view, but a live dispute transition still
needs browser evidence. The shared faucet preserves the retained remote
missing-live-Runtime guard; local acceptance/commitment remains unverified.
Classic capacity bars and all five Apple styles now render through shared
display models. The existing appearance route exposes persisted layout, skin,
scale and effect controls. Keyboard expansion, preference reload and effects
triggered by a real isolated payment are verified. Six Account rail destinations
now navigate to existing React consumers; desktop/mobile keyboard behavior and
the empty-Account restriction are verified. A shell-owned UI context preserves
Entity selection across Assets, Health, Payments and Markets, and focused
Account selection through appearance/back. Assets now mounts the retained
Account dropdown above five Accounts, sharing name/avatar/status formatting
with Svelte and loading all remote Account pages. A real 26-Account flow
verifies selecting beyond the portfolio's first page, keyboard dismissal,
focused-view return, Entity changes and original Runtime restoration. Live
pending/disputed dropdown statuses are not browser-verified. Four remaining
rail destinations, full action-level Account/token/jurisdiction context and
Entity Activity presentation remain open. Successful automatic joining,
remote-owner integration and cold reload parity remain open. See the
[implementation checkpoints](wallet-ops-ui-ports.md).

Runtime Diagnostics now reads the existing storage head/timeline and runs the
existing integrity verification command through the shared ops session.
Its real persisted-storage flow and close/reopen cleanup pass. Local incident
details remain unavailable in this remote-only host and are labelled as such.

## Separation and integration

| Area | Status |
| --- | --- |
| Four React entry points, Vite configs, TypeScript projects and output directories | Implemented |
| Per-app dev/check/build/test commands | Implemented |
| Shared browser, Runtime-client and UI packages | Implemented; some wallet bridges retain Svelte dependencies |
| Same-origin development gateway and route/asset ownership | Implemented |
| Assembly into one release with isolated app assets | Implemented and previously verified |
| PWA/native/artifact-consumer preparation | Candidate tooling exists; default-consumer switch remains |
| Default frontend commands and CI use React | Not complete; canonical dev/build/check and frontend CI still use the Svelte path |
| Svelte source and dependencies retired | Not complete |

Separate apps intentionally share one frontend package manifest and dependency
installation. Each app has an independent build root and artifact directory;
the plan does not call for four unrelated repositories or separate production
deployments.

Evidence: [frontend commands](/Users/p/Projects/xln/frontend/package.json),
[assembly](/Users/p/Projects/xln/frontend/scripts/assemble.ts),
[CI](/Users/p/Projects/xln/.github/workflows/build-and-test.yml:96).
Seven files under `frontend/bridges/wallet-canonical-*` still import
`svelte/store`, and React wallet sources actively consume those bridges.

## Verification

- Latest dropdown/model/selection/navigation/read-source/observer/tooling checks:
  **58 tests pass**, 221 assertions across nine files:
  `/tmp/xln-account-dropdown-unit-final.log`.
  Previous selection/navigation/read-source/payment/market/health/tooling checks:
  **73 tests pass**, 304 assertions across ten files:
  `/tmp/xln-account-rail-unit-final.log`.
  Previous appearance/projection/navigation/tooling checks: **47 tests pass**,
  418 assertions across eight files: `/tmp/xln-account-appearance-unit-final.log`.
  Preceding focused Account checkpoint: **64 pass**, 639 assertions across
  11 files: `/tmp/xln-account-view-unit-final.log`.
  Earlier onboarding/parser/options/navigation/portfolio/tooling checkpoint:
  **254 pass**, 1,305 assertions across 35 files:
  `/tmp/xln-direct-account-unit-final2.log`.
- Latest targeted wallet browser checks: **12/12 pass in 1.1 minutes** across
  three viewports: new Account dropdown, existing rail and focused Account
  flows, including the local focused view:
  `/tmp/xln-account-dropdown-browser-final.log`. All **29 screenshots** were
  inspected and rated 8/10 at each viewport; artifacts are preserved in
  `output/playwright/react-account-dropdown-final`. Browser-error and
  containment assertions pass, including the mobile expanded dropdown above
  fixed navigation. The fixture uses a separate real Runtime for 26 Accounts
  so it cannot change the existing payment Runtime's Entity list. Fixture
  startup and isolation failures, their fixes and preserved evidence are in
  the [dropdown checkpoint](wallet-ops-ui-ports.md#account-dropdown-checkpoint--2026-09-05).
- Previous targeted wallet browser checks: **15/15 pass** across three viewports:
  six rail/context/direct-opening cases in 43.3 s and nine canonical-navigation/
  invoice/quote/payment cases in 14.8 s. Logs:
  `/tmp/xln-account-rail-browser-l2.log` and
  `/tmp/xln-account-rail-browser-navigation.log`. All 38 affected screenshots
  were inspected and rated 8/10; artifacts are preserved in
  `output/playwright/react-account-rail-l2` and
  `output/playwright/react-account-rail-navigation`. Browser-error and
  containment assertions pass. Full action context and remaining forms are
  still open; the new rail does not close W1/W3.
- Last full wallet browser matrix, **before the rail and dropdown increments**:
  **83 pass / 1 fail** in 5.0 minutes across
  mobile, laptop and wide desktop:
  `/tmp/xln-account-appearance-browser-matrix.log`. The failing existing laptop
  market/activity case exposes a backend pagination defect: a 25-event page
  truncates frame 6, then advances to frame 5, making the omitted `Account
  opened` event unreachable. Evidence and source references are recorded in
  the [Account appearance checkpoint](wallet-ops-ui-ports.md#account-capacity-bars-and-appearance-checkpoint--2026-09-05).
  No backend changes or weakened assertions were made. The preceding focused
  Account matrix was 78/78; that historical result does not supersede this
  unresolved failure. The registered matrix now has 90 cases; the full 90-case
  matrix has not been run.
- Previous focused appearance and Account browser checks: **12/12 pass** in 1.2 minutes:
  `/tmp/xln-account-appearance-browser-l2.log`. All corresponding full-matrix
  cases also pass. The 50 affected screenshots (34 appearance/effect, 13 focused
  Account and three portfolio) were inspected and rated 8/10 at each viewport.
  This covers all five Apple styles, Classic layouts, persisted settings,
  keyboard expansion, real committed-payment effects and cleanup, both Account
  perspectives, local opening and the retained remote Faucet rejection.
  Results and trace are preserved in
  `output/playwright/react-account-appearance-matrix`.
  Console/page-error assertions pass for these flows. Remote-owner mutation,
  successful local faucet funding, live disputed navigation and cold reload remain unproven;
  passing tests do not close incomplete UI rows.
- Latest ops browser checkpoint (not rerun for the wallet dropdown): **42/42 passed** in 46.0 seconds, covering
  the internal dock and existing ops routes. Six diagnostics screenshots
  inspected: `/tmp/xln-ops-diagnostics-browser-matrix.log`. Focused
  diagnostics/query/source tests: 49 passed, 418 assertions.
- Latest all-app build: **4/4 passed**. Site 825 ms, docs 349 ms,
  wallet 2.21 s, ops 2.07 s: `/tmp/xln-account-dropdown-build.log`.
  Existing chunk warnings remain.
- Latest strict React checks: **4/4 apps plus tooling passed**:
  `/tmp/xln-account-dropdown-react-final.log`; wallet/tooling were checked
  again after fixture isolation in `/tmp/xln-account-dropdown-react-isolation.log`.
  The check scans 759 files, with zero unsafe-type findings. Svelte has zero diagnostic
  errors/warnings: `/tmp/xln-account-dropdown-svelte-stable.log`; the scanner
  still prints configuration messages for the separate React Vite roots.
- Latest root `bun run check`: 26 tests / 100,156 assertions, contract sync and
  ten soundchecks pass; missing `cargo` stops the next gate (127):
  `/tmp/xln-account-dropdown-root-final.log`.
  Later root gates did not run. Root verification remains open.

Earlier verification logs: `/tmp/xln-settlement-react-final.log`,
`/tmp/xln-settlement-unit-final.log`,
`/tmp/xln-settlement-browser-matrix-final.log`,
`/tmp/xln-settlement-root-final.log`.

## Remaining work, in order

The first item now has an executable
[wallet/ops UI-port checklist](wallet-ops-ui-ports.md), with retained sources,
React targets, dependencies and behavioral acceptance checks. Planning does
not change the partial implementation status above.

1. Finish the existing wallet and ops UI ports. Next: selected
   Account/token/jurisdiction context across action forms and ops, and the remaining Manage/Move/Lending/History
   consumers. Then complete onboarding/settings/Ownership, ops local/scenario
   context and panels, Graph3D/playback and public `/embed` integration.
2. Move shared lifecycle/store adapters out of Svelte dependencies without
   changing storage, custody or Runtime behavior.
3. Verify the retained behavior in the React apps, especially the mounted
   workspace and wallet flows. Keep a concrete remaining-UI checklist.
4. Switch default frontend dev/build/check, CI and artifact consumers to the
   assembled React output, then retire Svelte. Production deployment is a
   separate operation, not additional feature work for this refactor.

## Scope correction

The follow-up expanded into collateral validation, financial lifecycle audits
and a proposed Runtime read API. Those are not additional deliverables of the
original frontend refactor and are not counted as refactor progress here.
Preserving an existing control remains UI migration work; redesigning or
extending its backend does not.

The Runtime API proposal is inactive following the owner's scope clarification.
No API changes have been made. Subsequent implementation has stayed within the
existing frontend ports and their verification. Work remains uncommitted; the
canonical Svelte application is still the production default.
