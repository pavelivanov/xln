# T02 Health acceptance receipt

**Result:** DONE on 2026-09-16. The Ops-only registry now includes both Health
browser specs, and the real isolated stack passes enabled-service, failure,
recovery, selected-Runtime cleanup, refresh, and stale-evidence acceptance at
all three required viewports.

## Source identity

- Git HEAD: `c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81`
- Full pre-receipt working-diff SHA-256:
  `b9cf682a065e3bae96dd19464d2143c3de89cb496048c45f98c256e756db6cbb`
- T02-scoped diff SHA-256:
  `ba2d99c6d0de6a444c6186cba88db74dbbc831376a188c12c55bd1f617b1546a`
- Pre-receipt untracked-file-list SHA-256:
  `32d9c032874e938eea326859a1fdf67c8ac33082117e594181cda836e6cc4fd2`
- The only pre-receipt untracked file was the T01 receipt; its content SHA-256
  was `50fc3b74562156608ab3dc609108da84099bffba69772a2f35021a201bb0cf81`.
- Release ID: not generated. T02 is a browser-acceptance increment and does not
  assemble or activate a release; its immutable artifacts are under
  `output/playwright/react-candidate/test-results/`.

## Implemented boundary

- `ops-health-topology.spec.ts` is registered in the Ops-only candidate list,
  with the registry boundary asserted by `frontend-browser-scope.test.ts`.
- The fixture starts a real Orchestrator with enabled Market Maker and custody
  services. Each viewport owns a unique port block and database root.
- A live JSON-RPC proxy creates a controlled upstream 503 without fabricating
  `/api/health`. The canonical browser probe renders `FAIL` and `RPC down`;
  restoring the same upstream returns the page to `READY`.
- The flow also proves manual refresh, Runtime selection replacement and old
  selection cleanup, stale snapshot retention after fixture shutdown, and the
  expected 503/404 browser-console failures with zero page errors.

The attached live health payload reported `systemOk: true`,
`marketMaker.enabled: true`, `marketMaker.ok: true`,
`custody.enabled: true`, and `custody.ok: true`. Custody and MM same-chain
bootstrap gates both rendered `ready`.

## Verification

All commands used pinned Bun 1.4.0 from
`/tmp/xln-bun-1.4.0/bun-darwin-aarch64/bun`.

| Boundary | Command | Exit / evidence | Duration |
| --- | --- | --- | --- |
| Ops units and registry | `bun test tests/frontend/ops tests/frontend/tooling/frontend-browser-scope.test.ts` | 0; 119 pass, 0 fail, 1,907 assertions | 0.55 s |
| Ops types | `bun scripts/check.ts --surface=ops --level=local` from `frontend` | 0; unsafe types, React tooling and React Ops green | 8.2 s |
| Health browser matrix | both Health specs with mobile, laptop and wide projects under the stand lock | 0; 6 pass | 1.1 min |
| Capability/parity configuration | three focused tooling tests | 0 after this receipt existed; 19 pass | recorded below |
| Working diff | `git diff --check` | 0 | recorded below |

The final browser command was:

```text
bun ../tools/stand-lock.ts run --reason t02-health-isolated-matrix -- \
  bunx --no-install playwright test --config playwright.react.config.ts \
  tests/react-candidate/ops/ops-health-events.spec.ts \
  tests/react-candidate/ops/ops-health-topology.spec.ts \
  --project=mobile-390x844 --project=laptop-1366x900 --project=wide-1920x1080
```

## Browser and F12 evidence

All failure and recovery screenshots were inspected. The verdict, metrics,
topology, event evidence, and filters remain contained at every viewport.

| Viewport | Live failure | Recovered | Stale snapshot |
| --- | --- | --- | --- |
| 390×844 | [FAIL](../../output/playwright/react-candidate/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-mobile-390x844/health-critical-rpc-failure.png) | [READY](../../output/playwright/react-candidate/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-mobile-390x844/health-critical-recovered.png) | [stale](../../output/playwright/react-candidate/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-mobile-390x844/health-stale.png) |
| 1366×900 | [FAIL](../../output/playwright/react-candidate/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-laptop-1366x900/health-critical-rpc-failure.png) | [READY](../../output/playwright/react-candidate/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-laptop-1366x900/health-critical-recovered.png) | [stale](../../output/playwright/react-candidate/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-laptop-1366x900/health-stale.png) |
| 1920×1080 | [FAIL](../../output/playwright/react-candidate/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-wide-1920x1080/health-critical-rpc-failure.png) | [READY](../../output/playwright/react-candidate/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-wide-1920x1080/health-critical-recovered.png) | [stale](../../output/playwright/react-candidate/test-results/ops-ops-health-topology-He-34111-recovery-and-stale-evidence-wide-1920x1080/health-stale.png) |

Each browser case asserted zero page errors. Console failures were restricted to
the deliberate RPC 503 and post-shutdown health 404 boundaries.

## First failures repaired

1. The first real adapter-size failure produced the canonical client error but
   did not enter committed Runtime activity. T02 did not change protected
   Runtime semantics or fabricate an event; the accepted critical boundary is
   the real RPC dependency failure observed by the existing browser probe.
2. The Orchestrator retains its last enabled-service snapshot during a short
   RPC outage. Acceptance now binds failure to the live RPC probe while keeping
   MM/custody enablement bound to the real health payload.
3. Reusing service ports and databases across viewport projects left later
   fixture starts racing prior child shutdown. Each start now receives an
   isolated port block and database root; the single-command matrix passes.

Health capability evidence now records these accepted flows. Detailed active
relay-client data remains explicitly unresolved under T09; the UI continues to
show `Details not reported` rather than inventing that evidence.
