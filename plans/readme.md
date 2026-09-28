# Frontend migration

[The post-rebase audit findings plan](post-rebase-audit-findings.md) completed
F04 on implementation source `1c28f85f` and release `sha256-c64f6f18…`. The
mixed release identity and React create/select-before-unlock regression are
repaired; browser `459/459`, artifact/preview, frontend/root, and iOS gates are
green. The native session harness also removed its stale simulator UUID:
deterministic discovery passed `4/4` focused cases and a no-override iOS
lifecycle passed `1/1` on the booted simulator.

[The post-rebase semantic recovery plan](post-rebase-semantic-recovery.md)
records R04, R08, and R09 as verified by the full F04 recertification.

[Execute the remaining migration tasks](react-frontend-migration.md).

The audit-findings ledger has **4/4 tasks complete** on **2026-09-28**. The
remaining gates are owner review/authorization, physical-device execution,
Apple signing, and separate C03 deployment/publication authority. No commit,
push, tag, signing, deployment, or publication was performed. The older
T01–T18 rows remain migration history.

Completion means canonical React commands and consumers, required acceptance, Svelte retirement and a passing root check. C02 cutover requires explicit authority; C03 production activation is a separate release operation.

Historical plans under `archive/` and receipts under `docs/frontend/` are reference material, not additional execution queues.
