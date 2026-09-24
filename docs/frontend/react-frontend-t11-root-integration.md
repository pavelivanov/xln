# React frontend T11 — root integration

Status: **DONE**

## First-failure repairs

- Split six batch-preflight regressions from `radapter-part-1.test.ts`; the original file is now 2,916 lines and the new focused suite is 268 lines. The source file-size gate passes without raising its 3,000-line limit.
- Finished the retained-Svelte Activity consumer's T05 cursor migration, used the approved serialization boundary for opaque cursor bytes, and extracted the Activity page resolver so production functions remain below 150 lines.
- Replaced the governance resolver's forbidden machine `structuredClone` with an explicit four-field board value projection. No Runtime, Entity or Account transition behavior changed.
- Classified generated `package-lock.json` metadata outside the first-party compatibility-vocabulary scan and removed first-party compatibility wording. No allowlist entry or alternate code path was added.
- Removed one unnecessary public batch issue type, one unnecessary Entity clone-helper export and two stale external-consumer exemptions. The same isolated-value clone remains on Entity output publication.

## Verification

- Final root integration: **PASS**. `check:src` completed in `52.9 s`; `check:frontend` completed in `42.3 s`; short and long parallel gates both exited `0`.
- Frozen core, soundcheck, Rust fmt/clippy/tests/parity, contract invariants, folder width, production function size, machine-clone policy, compatibility vocabulary and unused-surface checks all passed in the final run.
- Focused checks: batch preflight `6/6`; Activity query/storage `12/12`; ownership governance `4/4`; development/runtime lifecycle `47/47`; unused-surface plus batch-preflight `10/10`; Entity publication/cross-j `8/8`.
- All React local types/tooling passed for Site, Docs, Wallet and Ops with `891` files and `0` unsafe-type findings. Retained Svelte diagnostics reported `0` errors and `0` warnings.
- `git diff --check`: **PASS**.

## Source identity

- Base SHA: `c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81`.
- Pre-receipt working-diff SHA-256: `7dc206260da33358a3808caa6b8d0adb3e5f40d7bacecb964b8b90d7afc5ea45`.
- Pre-receipt untracked-file ledger SHA-256: `d394f715749dcbaaf4db3d30904a65da5b53e7e654c6b617889c08d1293fa39f`.
- No immutable frontend release was assembled; T12 owns the accepted release directory and ID.

## Remaining queue boundary

T12 still waits on T07's Lending product decision, T09's relay-detail scope decision and the release-version decision. T11 no longer contributes an integration blocker.
