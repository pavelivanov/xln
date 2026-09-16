# React health parity

The React Health page now owns bootstrap gates and timeline, Hub socket identities,
process lanes, reserve coverage and market-maker evidence. The existing selected-Runtime
Entity browser and event-flow view remain in place. QA and Runtime connection links lead
to their existing React owners. Evidence panels retain endpoint timings, budgets, errors,
targets and exact IDs; clipboard errors remain visible.

Missing fields are `unknown` or explicitly unreported; disabled capabilities are distinct
from failures. Refresh preserves the last failure until a new successful snapshot arrives.

## Actual endpoint boundary

`core/orchestrator/health/aggregated-health-projections.ts:183` emits relay `clientCount`,
`managedRuntimeIds`, `externalClientIds` and `marketSubscriptions`. It does not emit
`clientsDetailed` with age, last-seen and topics, even for operator-authorized responses.
The retained Svelte page expects those fields. React can render them if reported, but
does not infer individual online status from configured Runtime membership.

Full parity therefore still requires an owner decision: provide the detailed read or
accept explicit unavailability for those retained fields. Enabled market-maker/custody
and critical-event browser acceptance remain open. Model tests cover critical verdicts;
that is not equivalent to a real critical-event browser run.

## Verification

The isolated browser fixture starts real Anvil and the canonical Orchestrator with its
own ports, seed and database directory. It forwards actual health/RPC responses. It is
started and stopped explicitly by the Health test, so the existing 404 and authority-loss
cases retain their real failure boundary. No health responses are fabricated.

Evidence directory: `output/playwright/react-health-topology-20260915/`.
Early failures record fixture CLI arguments, missing seed, working directory, missing
client detail and browser clipboard permission. The laptop READY/refresh/stale flow then
passed in 13.27 seconds. All six Health browser cases then passed across mobile/laptop/wide in 39.24 seconds; screenshots were inspected. The migration plan records the exact remaining acceptance scope.
