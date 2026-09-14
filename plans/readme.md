# Frontend refactor

[Open the current execution plan](react-frontend-migration.md).

Refreshed **2026-09-14**, against `main` at `3b2d1cc2eae5d1676c1e88b875429f30ce10cdb4`
plus existing BrainVault working changes. Four React apps, shared framework isolation,
full-unit check wiring and explicit-release lifecycle tooling are implemented. Svelte
remains canonical. This index and the linked plan are the only migration ledger.

| Order | Work                            | State / dependency                                                                                                                                                                |
| ----- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | R03 dual BrainVault destination | Existing implementation and new tests; complete browser acceptance and late-completion safety.                                                                                    |
| 2     | V01–V03 / V05a                  | Complete unaffected web cases, especially wide autoplay and shared Graph/history; reconcile stale inventory text.                                                                 |
| 3     | B1/B2/B3/B8                     | B1 conflicts with intentional Lending exclusion; obtain scope reconciliation. Activity paging, remote settlement and cross-j finality need authorized owner work. B9 is resolved. |
| 4     | C01b / B13                      | Prepare complete dev/preview/npm/native/deploy/CI/retirement change; core static-serving integration is conditional on scope authority.                                           |
| 5     | V04–V09 / G04b                  | Final source/release acceptance; start native/device readiness early.                                                                                                             |
| 6     | C02                             | Owner-authorized canonical switch and Svelte retirement; post-cutover verification.                                                                                               |
| 7     | C03                             | Separate production release authority; verified activation and actual rollback.                                                                                                   |

Fresh baseline: **1,510/1,510 units**, **42/42 ownership/inventory/check contracts**,
all four React local checks, **874 scanned files / zero unsafe-type findings**.
Browser registry: **423 cases / 41 files**, not a passing matrix. Historical 473-file
release verifies; B9 reports **0 pending migrations / verified=true**.
`bun run check` remains **exit 127: cargo not found**. No fresh browser, native,
production build or deployment acceptance is claimed.

Preserve existing user changes. Work one bounded task at a time; update the existing
rows with exact command/source/release evidence. Do not rebuild completed ports,
reopen B9 or treat intentional Lending rejection as a frontend bug.
