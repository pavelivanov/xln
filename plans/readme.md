# Frontend migration

[Execute the post-rebase audit findings plan](post-rebase-audit-findings.md)
before relying on the previous R08/R09 certification or updating the remote.
The 2026-09-28 deep audit found two remaining publication blockers: mixed
`0.1.31`/`0.1.32` release identity and missing create/select-before-unlock
behavior in the React wallet.

[Execute the post-rebase semantic recovery plan](post-rebase-semantic-recovery.md)
before relying on the previous migration certification. The 2026-09-26 audit
found release-blocking gaps in retained `ui` imports, iOS headless packaging,
RPC-only jurisdiction selection, React local-password/lock behavior, and Svelte
retirement. Its R08 task owns current-source recertification.

[Execute the remaining migration tasks](react-frontend-migration.md).

The audit-findings plan is the current blocker ledger: **4 tasks**, assessed
**2026-09-28** against `main` at `fe74bbb44`. Start **F01** and finish the two
repairs before re-running F04 certification. The R01–R09 and older T01–T18
ledgers remain migration history; their final certification is stale until F04
passes on one unchanged source.

Completion means canonical React commands and consumers, required acceptance, Svelte retirement and a passing root check. C02 cutover requires explicit authority; C03 production activation is a separate release operation.

Historical plans under `archive/` and receipts under `docs/frontend/` are reference material, not additional execution queues.
