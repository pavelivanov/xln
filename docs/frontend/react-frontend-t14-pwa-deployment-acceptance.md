# React frontend T14 — PWA and deployment lifecycle acceptance

Status: **DONE**

## Verified inputs

- Install release: `sha256-4abab19be337aecb87839a6723f9975a97cd6bb19a8103276a6bceae4d67a06c` — **491 files**.
- Update/final release: `sha256-77b6fcdb1c59cd481380acb4e9790969fd212b3131e4e43bb1221ce9e79347f9` — **493 files**.
- The candidate verifier passed for both distinct directories before and after both lifecycle runners. Neither runner changed release bytes.

## Acceptance evidence

- PWA lifecycle: **1/1 pass in 11.0 s**. One real service worker installs the predecessor, serves it offline, rejects an incomplete update without changing controller or cache, activates the final release as a whole, serves it offline, then rolls back to the predecessor.
- Deployment lifecycle: **1/1 pass in 4.7 s**. One origin serves the predecessor, rejects a corrupt candidate without changing active state, atomically activates the final release, rejects duplicate activation, then rolls the whole deployment back with exact route hashes.
- Focused PWA/deployment contracts: **13/13 pass**, **111 assertions**. Coverage includes distinct-input enforcement, after-acceptance byte changes, mutable-build isolation, stale activation, unknown routes, stored corruption, mixed/missing/symlinked candidates, malformed state, unavailable rollback and activation locking.

The lifecycle is isolated acceptance only. It does not activate production or claim the later C03 deployment, edge, SSH or TLS gates.
