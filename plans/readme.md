# Frontend migration

[Execute the post-rebase semantic recovery plan](post-rebase-semantic-recovery.md)
before relying on the previous migration certification. The 2026-09-26 audit
found release-blocking gaps in retained `ui` imports, iOS headless packaging,
RPC-only jurisdiction selection, React local-password/lock behavior, and Svelte
retirement. Its R08 task owns current-source recertification.

[Execute the remaining migration tasks](react-frontend-migration.md).

The post-rebase plan is the current status ledger: **9 recovery and
recertification tasks**, assessed **2026-09-26** against `main` at `134e0154c`.
Start **R01**; take the lowest-numbered runnable task and finish its exit checks
before moving on. The older T01–T18 ledger remains the detailed migration
history, but its final certification is stale until R08 passes.

Completion means canonical React commands and consumers, required acceptance, Svelte retirement and a passing root check. C02 cutover requires explicit authority; C03 production activation is a separate release operation.

Historical plans under `archive/` and receipts under `docs/frontend/` are reference material, not additional execution queues.
