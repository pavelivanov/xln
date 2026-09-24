# React frontend T09 — relay-client detail scope

Status: **DONE**

## Accepted contract

- The owner accepted the current health endpoint boundary: detailed relay-client age, last-seen and per-client topics are not required.
- The canonical aggregate remains counts, managed/external Runtime IDs and subscription totals. These fields are evidence about relay inventory, not permission to infer per-client online status.
- React retains the truthful “Details not reported by this endpoint” state when `clientsDetailed` is absent. No wider or less-authorized read was added.
- With T02 already accepted, `/health` is now recorded as complete and covered; the resolved owner-decision gap was removed from parity metadata.

## Verification

- Health plus parity/capability units: **30 pass, 0 fail, 484 assertions**; final narrowed rerun: **18 pass, 0 fail, 429 assertions**.
- Ops local gate: **889 files, 0 unsafe-type findings**; React tooling and Ops TypeScript green.
- Real Health browser flow: **3/3 pass** across `390×844`, `1366×900` and `1920×1080` in `57.7 s`.
- Browser evidence verifies the real endpoint includes aggregate relay fields, omits `clientsDetailed`, renders the unavailable detail state, and still passes enabled-service, RPC failure/recovery, Runtime-switch and stale-snapshot assertions.
- Page errors: none. Expected console failures occur only after the fixture is deliberately stopped. `git diff --check`: pass.

## Browser evidence

- [Mobile Health ready](../../output/playwright/react-ops/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-mobile-390x844/health-ready.png)
- [Laptop Health ready](../../output/playwright/react-ops/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-laptop-1366x900/health-ready.png)
- [Wide Health ready](../../output/playwright/react-ops/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-wide-1920x1080/health-ready.png)

## Source identity

- Base SHA: `c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81`.
- Pre-receipt working-diff SHA-256: `0c49a77302e73e0c938adcd62e104934ead574582ca23eacfbcc2ae6df153911`.
- Pre-receipt untracked-file ledger SHA-256: `1e74961608efcee4888be0668d6be41b7b7be9d47d930755ac2dc644a1257b97`.
- Browser artifact root: `output/playwright/react-ops/test-results/`. No immutable frontend release was assembled for this task; T12 owns the release ID.
