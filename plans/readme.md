# Frontend refactor

[Open the current execution plan](react-frontend-migration.md).

Refreshed 2026-09-10 against `main` at `4301b1796`. Four React apps and framework
isolation are implemented. Remaining work is specific behavior gaps, verification
failures, native/device evidence and canonical cutover. Svelte remains canonical.

| Order | Work | Status / dependency |
|---|---|---|
| 1 | R01 activity cursor, R02 historical labels | Ready; first browser regressions |
| 2 | W08d2 shared Stack Manager | Ready; Ops prerequisites complete |
| 3 | R04 unit failures; R03 dual BrainVault entry | R04 ready; R03 needs the product choice described in the plan |
| 4 | Protected dependency closure; R05 built-artifact tests; R06 inventories | Preserve B1/B2/B3/B8/B9; frontend rows proceed independently |
| 5 | V01–V09, V05b, G04b | Full unit/browser, built bytes, PWA/native/XR, rollback and root evidence |
| 6 | C01 → C02 → C03 | Prepare consumer mapping now; owner-authorized cutover, then separately authorized release |

Fresh local checks pass for all four apps; ownership/inventory contracts pass 33/33.
The full unit run has eight remaining non-network failures after four sandbox-only
failures were disproved by an unsandboxed rerun. Root checks remain blocked by
missing `cargo`; no complete browser or release acceptance is claimed.

Work one bounded task at a time, preserve existing evidence and update its row.
This entry point and the linked plan are the only migration ledger. Do not rebuild
completed work or create competing audit/task catalogs.
