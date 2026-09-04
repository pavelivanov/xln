# React frontend migration work plan

**Status:** `IN PROGRESS — WP0–WP6 COMPLETE; WP7 HEALTH + QA + HLT + RUNS + SCENARIOS + AI IMPLEMENTED, WORKSPACE STATE LAYER SVELTE-FREE, PANEL PORTS THROUGH ARCHITECT, REACT DOCKVIEW WRAPPER READY, GRAPH3D LIFECYCLE + RENDERER/PRIMITIVES/EFFECTS/ENTITY/ACCOUNT VISUAL FACTORY/INTERACTION/SELECTION/CAMERA/POINTER+XR DRAG + HOVER MECHANICS + VIEW/SCENE INPUT MODELS EXTRACTED, ENTITY WORKSPACE REACT SHELL/TABS + LIVE RUNTIME CONTEXT + READ-ONLY ASSETS/OWNERSHIP/ACCOUNTS/CONSENSUS/PROFILE READY; WP8 COMPLETE; WP9 HAS 19 COMPLETE / 1 PARTIAL IMPLEMENTATION, 19 COVERED / 1 PARTIAL BROWSER ROUTE, AND 1 AUTHORIZED IMPLEMENTATION GAP; ENTITY ASSETS + ACCOUNT COMMITMENT EVIDENCE + CONSENSUS EVIDENCE + DISPLAY THEME + TIME MACHINE + XLN GUIDE PREFERENCE + HUB POLICY + SETTINGS SUMMARY + PERSISTED ACTIVITY PAGINATION/FILTERING/CLEAR/REFRESH/PAGE-SIZE/TIMESTAMPS COMPLETE`

This is the executable work plan for splitting the Svelte frontend into React
applications. It is intentionally lightweight and should be updated as live
code, tests, and migration evidence refine the sequence.

Implementation does not wait for Gate A/Gate B, approval manifests, immutable
review records, child plans, a clean global baseline, or a green root gate.
Those retired governance prerequisites are not part of this plan.

## Outcomes

1. Create independently owned `site`, `docs`, `wallet`, and `ops` applications.
2. Rewrite retained UI in React 19, Vite 7, and strict TypeScript without an
   intentional product-behavior change.
3. Make each application independently checkable, testable, buildable, and
   runnable.
4. Assemble the application outputs into one same-origin release and preserve
   an atomic rollback path.

## Scope

### In scope

- `frontend/**` application roots, UI/client packages, configuration, checks,
  assets, build/assembly, and eventual Svelte removal;
- `tests/frontend/**`, `tests/e2e/**`, and `tests/sites/**` for behavior and
  frontend tooling coverage;
- root package scripts and CI entries needed to expose frontend commands;
- frontend artifact consumers in `native/**`, deployment scripts, and release
  tooling when integration reaches those consumers;
- planning and frontend documentation needed to keep the migration executable.

### Out of scope

- Runtime, Entity/Account transitions, consensus, financial formulas, custody,
  contracts, market-maker behavior, and persistence-schema changes;
- product redesign, route renaming, origin/storage migration, feature removal,
  SSR, a new router/state framework, or independent production releases;
- unrelated cleanup and weakening or skipping tests to fit the candidate.

If a slice unexpectedly needs an out-of-scope change, isolate that dependency
and continue other frontend work. Ask before crossing the boundary.

## Technical direction

The active decisions live in
[`react-frontend-migration-decisions.md`](react-frontend-migration-decisions.md).
The target package shape is:

```text
frontend/
  apps/
    site/{index.html,src/,tsconfig.json,vite.config.ts}
    docs/{index.html,src/,tsconfig.json,vite.config.ts}
    wallet/{index.html,src/,tsconfig.json,vite.config.ts}
    ops/{index.html,src/,tsconfig.json,vite.config.ts}
  packages/
    browser/
    runtime-client/
    ui/
  config/
    surfaces.ts
    capabilities.ts
    verification.ts
  scripts/
    check.ts
    prepare.ts
    build.ts
    dev-gateway.ts
    assemble.ts
    assets/
  .artifacts/<application>/
  build/
```

Keep one `frontend/package.json` and lockfile. Each app gets its own Vite root,
TypeScript project, output directory, and tests. `assemble.ts` alone produces
the canonical `frontend/build` from validated application artifacts.

### Shared modules

- `packages/browser` owns validated storage access, browser/worker lifecycle,
  service-worker integration, and external-store snapshots.
- `packages/runtime-client` owns UI-facing validation, subscriptions, queries,
  and commands. It must not implement Runtime transitions or financial rules.
- `packages/ui` owns design tokens and primitives with real shared consumers.
- Wallet-only finance components stay in the wallet app.
- External mutable state exposes stable subscription/snapshot APIs for
  `useSyncExternalStore`.

## Route ownership

Encode the route table in `frontend/config/surfaces.ts`:

| Application | Routes and outputs |
|---|---|
| `site` | `/`, `/install`, `/rcpan`, `/releases`, `/reviews`, `/unicast`, `/market-cap` |
| `docs` | `/docs`, docs catalog/static content, `llms*` |
| `wallet` | `/app`, `/address`, `/address/**`, `/testnet` |
| `ops` | `/health`, `/qa`, `/qa/hlt`, `/runs`, `/scenarios`, `/ai`, `/ai/**`, `/embed` |
| edge/server | `/admin`, `/radapter`, `/resetdb`, `/api/**`, `/api/tower/**`, `/rpc*`, `/relay`, `/runtime.js`, static dispatch |

Applications use same-origin links and do not import one another's entry points.
The gateway keeps `localhost:8080` as the public development origin and routes
to independent app servers and existing API/Runtime services.

## Working method

- Work packages express useful sequencing, not approval gates. Start any ready,
  non-overlapping package and run independent work in parallel when practical.
- Prefer complete vertical slices over bulk file conversion. A slice should
  leave the candidate runnable and should preserve its named behavior.
- Capture ownership and tests as the relevant code is touched; do not wait for
  a perfect global inventory before scaffolding or migrating an independent
  route.
- Extract shared modules when a second real consumer appears or when doing so
  first clearly reduces migration risk.
- Keep candidate artifacts separate from canonical Svelte output until cutover.
- Update package status, discoveries, and changed assumptions in this file.

Suggested size targets are one surface or shared concern and one or two flows,
but maintainers may split or combine increments based on cohesion. File count,
LOC, missing PR fields, and missing external review are not stop conditions.

## Verification

Use the narrowest useful evidence for each change:

| Level | When | Evidence |
|---|---|---|
| local | normal edit | affected TypeScript project, unit tests, or policy check |
| slice | user-flow change | local checks, one app build, exact browser scenario |
| frontend | shared boundary or app milestone | affected apps plus route, asset, storage, and assembly contracts |
| repository/release | integration, cutover, release | existing repository, CI, native, and release gates as applicable |

Rules:

- Do not turn failures into warnings or hide them with skips.
- An unrelated root-gate failure is recorded and assigned separately; it does
  not block frontend-only implementation.
- Run `bun run check` when integration wiring changes and before a merge or
  completion claim that depends on repository-wide health, not before every
  frontend edit.
- Run browser console/page/request checks and relevant viewport screenshots for
  visible behavior changes. They are unnecessary for non-visual scaffolding.
- Use isolated test state; do not restart or mutate the user's durable Runtime.

The scoped command interface should converge on:

```bash
bun frontend/scripts/check.ts --surface=site --level=local
bun frontend/scripts/check.ts --surface=wallet --level=slice --spec=<spec>
bun frontend/scripts/check.ts --changed-from=<sha> --level=local
bun frontend/scripts/check.ts --surface=docs --level=frontend
bun frontend/scripts/check.ts --all --level=frontend
bun frontend/scripts/build.ts --surface=ops
bun frontend/scripts/assemble.ts
```

These commands are deliverables, not prerequisites for starting the migration.
Use existing direct commands until their replacements exist.

## Capability tracking

Create `frontend/config/capabilities.ts` incrementally. Each capability should
eventually identify:

- application, route, current source, and retained behavior;
- happy, failure, loading, and empty states where applicable;
- storage, worker, service-worker, asset, PWA, and native consumers;
- existing and replacement tests;
- migration and verification status.

Use simple statuses such as `unstarted`, `in_progress`, `implemented`,
`verified`, and `blocked`. A blocked capability prevents its application from
being declared complete, but does not block unrelated capabilities.

Capture a baseline inventory from live source and tests, including routes,
registered panels/commands, persisted keys and IndexedDB schemas, workers,
generated assets, localization keys, native/PWA entries, and release consumers.
The inventory may evolve when discoveries are corrected; review meaningful
behavior changes rather than treating metadata hashes as authorization.

## Generated inputs

Replace the all-purpose copy step incrementally:

| Input family | Producer/owner |
|---|---|
| docs catalog, docs-static, `llms*` | docs |
| public release/install/static content | site |
| wallet PWA icons, manifest, push-wake worker, route mode | wallet |
| Runtime browser bundle, BrainVault worker, contract browser artifacts | wallet; ops only if consumed |
| scenario catalog/media | ops |
| route map, artifact hashes, release manifest | assembly |

Producers must be deterministic, must not edit backend or contract source, and
must write only their declared artifact directories.

## Work packages

Packages may overlap when ownership and files do not conflict. Dependencies
describe technical order only.

### WP0 — Discover the live baseline

**Status:** `DONE — LIVE OWNERSHIP, PLATFORM INTERFACES, CONSUMERS, AND CHECKS INVENTORIED`

- Inventory routes, edge exclusions, static assets, generated inputs, storage,
  workers, native/PWA consumers, tests, and major capability registries.
- Measure current frontend counts and commands; treat old plan counts only as
  hints.
- Record existing narrow and root check results without attempting unrelated
  backend repairs.
- Add route/capability configuration as soon as enough live data is known.

**Done:** touched areas have clear owners and known behavior references; open
questions are recorded without blocking unrelated work.

The typed baseline now covers route and edge ownership, capability registries,
deterministic generated/static inputs, browser storage families, tab
coordination, Workers, service workers, native and packaged consumers,
workspace registries, release consumers, and verification commands. Every
record names live source, consumer, and evidence paths; deferred concerns are
owned explicitly by WP7, WP8, or WP9. The current measured baseline is 25 site,
5 docs, 58 wallet, and 1 ops React source files; 25 browser-boundary, 17
Runtime-client, and 3 shared-UI source files; 156 retained Svelte components;
20 retained Svelte page routes; and 164 frontend test files, including 20
frontend-tooling files. Scoped check, prepare, build, assembly, and gateway
commands are recorded in the live package scripts rather than duplicated here.
The final canonical frontend check reports zero Svelte errors and zero warnings;
the four React local checks also pass.

### WP1 — Add scoped tooling and React roots

**Status:** `DONE — FOUR ISOLATED ROOTS AND LOCAL CHECK/BUILD COMMANDS VERIFIED`

- Add the React/Vite/TypeScript configuration needed by the four app roots.
- Create independent minimal roots and separate `.artifacts/<application>`
  outputs while leaving canonical Svelte commands/output unchanged.
- Implement per-surface check, prepare, and build entry points.
- Add affected-application selection and tests that prove a local app command
  does not invoke unrelated applications or broad repository gates.

**Done:** all four minimal roots can be checked and built independently and
candidate output cannot overwrite `frontend/build`.

### WP2 — Establish routing, assets, and assembly

**Status:** `DONE — ROUTING, GATEWAY, ALL GENERATED INPUTS, AND VERSIONED ASSEMBLY VERIFIED`

- Materialize the route/asset table and edge exclusions.
- Implement the same-origin development gateway and per-app HMR paths.
- Split generated-input producers and add collision checks.
- Assemble validated app artifacts into a versioned candidate release.
- Capture current redirect, deep-link, missing-asset, CSP, proxy, and fallback
  behavior as focused tests while touching those paths.

**Done:** development routing and candidate assembly cover the four apps without
shadowing edge/API routes or changing canonical production selection.

All seven generated-input families now have concrete deterministic producers.
The canonical Runtime browser build publishes a 6,063,783-byte `/runtime.js`
with SHA-256 `33234b94dbbb0e4f84ba789a60c285862c073704996fa7e09c8f1029a35de51b`;
wallet contract inputs use source-controlled bundled artifacts rather than
optional local compiler output. The docs producer no longer requires the
retired `docs-static` tree or a deleted serialization test. Same-origin HTTP,
edge precedence, redirects, per-app HMR WebSockets, exact output-route checks,
manifest validation, corruption detection, and destination collisions pass
focused tests. All four apps build and the candidate assembles without touching
`frontend/build` as release
`sha256-f25b8454817b2dcaa66fd613eacf615724f16074a373ae07044bec75abf3a5a1`
with 305 validated files.

Candidate browser verification is now independently wired from the canonical
Svelte Playwright configuration. `playwright.react.config.ts` boots the four
React roots behind an isolated same-origin gateway using a deterministic port
offset, and tests site, docs, wallet, ops, plus the lazy ops HLT chunk at
390x844, 1366x900, and 1920x1080. The final matrix passes 15/15 with zero page
or console errors and no horizontal overflow; the existing Svelte `webServer`
remains unchanged.

### WP3 — Migrate site

**Status:** `COMPLETE — ALL SEVEN SITE ROUTES IMPLEMENTED`

- Use `/` and `/install` as the architecture pilot.
- Migrate `/rcpan`, `/unicast`, `/releases`, `/reviews`, and `/market-cap`.
- Preserve live data, links, assets, responsive states, and failure behavior.
- Refine shared UI conventions based on real second consumers.

**Pilot evidence:** the React site candidate now resolves `/`, `/install`,
`/rcpan`, `/unicast`, `/releases`, `/reviews`, and `/market-cap` with
route-specific metadata, preserves the wallet-open marker and version-pinned
local launcher, publishes all five install channels, and keeps unknown paths at
the explicit pending-route boundary without changing canonical Svelte
production selection. `/rcpan` consumes the existing deterministic microscope
timeline and settlement model rather than reproducing account or financial
logic. `/unicast` preserves the canonical 100-participant device mix, paused
1–1,000 TPS control, capacity thresholds, broadcast degradation, constant
one-TPS settlement claim, and responsive comparison while making node placement
deterministic. `/releases` keeps the Foundation trust anchor and Hanko policy
unchanged, verifies all 22 canonical manifest entries and source snapshots
before rendering any chart metric, and shares one strict decoder, signature
binding, chart model, and sanitized Markdown loader with the canonical Svelte
route. `/reviews` preserves the canonical five-prompt, four-model response
matrix through one shared Svelte/React content source and keeps prompt changes
synchronized across all four responses. `/market-cap` shares its strict relay
response decoder, request builder, integer-tick formatting, and ranking presets
with Svelte while preserving all five rankings, seven filters, direction,
250ms search debounce, stale/no-price labels, abort-safe loading, and fail-loud
retry behavior without adding estimates. Sixty-five focused tooling tests,
three canonical market-cap invariant tests, thirteen Foundation Hanko tests,
all four application builds, loading/success/failure/jurisdiction states, route
interactions, reduced-motion behavior, exact document widths, and 390×844,
1366×900, and 1920×1080 screenshots are green. The normal market flow has zero
console errors or warnings; the injected failure flow emits only its expected
HTTP 503 before recovering. The four-app candidate assembles as
`sha256-420fba14d39f37003d5ebef852baf83dd1ca1044ab5337a489d77906aa2f3d67`
with 351 files. The site-only typecheck still reaches unrelated core unused
import, `.ts` extension, and proof-builder type blockers, and the legacy Svelte
workspace check at that checkpoint reported 30 errors in 16 unrelated files;
the route build and focused source checks are green. The required root gate passes all 26
BrainVault checks before the existing contract-sync environment stops at
Hardhat `HH19` under unsupported Node 25.

**Done:** every site route is served by the site candidate and its relevant
behavior/browser checks pass.

### WP4 — Migrate docs

**Status:** `IMPLEMENTED — CATALOG, READER, SEARCH, AND GENERATED INPUTS GREEN`

- Move the docs catalog/static producer to docs ownership.
- Migrate navigation, reader, deep links, anchors, search, and sanitization.
- Preserve deterministic `llms*` and catalog output.

The React docs app now owns `/docs` and consumes the same strict manifest
decoder, search/filter model, link and image resolution, heading extraction,
and sanitized Markdown renderer as the canonical Svelte reader. It preserves
the 102 live / 34 archive catalog, three reading paths, featured documents,
direct document URLs, internal Markdown navigation, catalog-owned HTML assets,
browser history, anchors, raw-source links, visible loading/failure states, and
fail-loud retry. The docs
producer publishes 294 deterministic files; the catalog manifest is
`sha256-8754e6fc6b1224a080a8a1d8248ef6398b3f908584713880190a71f1d88d811d`
and `llms.txt` is
`sha256-174223c25cb65b065dbe0a6055e84f77cbd7c6f4e535ea8058f716caeec20122`.
Seventy tooling tests (462 assertions), the focused sanitization/diagnostic checks, the docs
typecheck, all four app builds, and same-origin browser flows are green. Browser
evidence covers search, empty results, live/archive scope, deep links, 76px
anchor landing, back navigation, injected catalog failure and retry, and
malicious Markdown rejection at 390×844, 1366×900, and 1920×1080 with exact
document widths. Normal flows have zero console errors or warnings; the
injected failure emits only its expected HTTP 503 before recovery. The
four-app candidate assembles as
`sha256-795c0b047b60b813a17bcf4ce229c985b5d0b68d7a9d61ca7cd5e72c3a7ce924`
with 351 files. At that checkpoint the legacy Svelte workspace reported 30
errors and one warning in 16 unrelated files, with no docs diagnostics. The required
root gate passes all 26 BrainVault checks before the existing contract-sync
environment stops at Hardhat `HH19` under unsupported Node 25.

**Done:** docs builds independently and current public docs URLs and content
behavior pass focused checks.

### WP5 — Establish browser and Runtime-client boundaries

**Status:** `DONE — SHARED BOUNDARIES AND REACT EMBEDDED RUNTIME BOOT VERIFIED`

- Extract validated storage, subscriptions, listener cleanup, workers, and
  service-worker integration into `packages/browser`.
- Extract UI-facing Runtime/RPC projections and commands into
  `packages/runtime-client`.
- Move no transition, consensus, persistence, or financial formula into the
  frontend. Use canonical helpers such as `deriveDelta`.
- Keep APIs usable by Svelte during coexistence when that makes extraction
  safer; migrate React consumers incrementally.

**Done:** shared boundaries have real consumers, focused lifecycle/persistence
tests, and no duplicate writer or financial implementation.

The first `packages/browser` slice now owns explicit reset confirmation,
single-flight execution, cross-tab hard-reset publication, the settle window,
IndexedDB/cache/service-worker/storage deletion, and redirect ordering. The
canonical Svelte wallet and the React `/testnet` route consume that boundary;
Runtime suspension remains injected by the Svelte adapter and no Runtime or
financial logic moved into the package. Six focused reset tests cover durable
deletion, blocked deletion, lifecycle ordering, duplicate execution,
confirmation, cross-tab publication, and the existing hash-reset integration.

The first `packages/runtime-client` slice now owns framework-neutral WebSocket
URL normalization, remote Runtime hash decoding, forbidden query detection,
import-parameter removal, capability-role validation, and the pure consent
decision. The canonical Svelte wallet remains the live adapter for
history replacement, RuntimeController activation, and recovery imports; no
Runtime state or transition logic moved into the package. Seven direct boundary
tests cover URL normalization, authenticated and stored-authority links,
missing capability prompts, query rejection before authority resolution,
import stripping, and consent. The wallet local check covers 425 files with
zero unsafe-type findings.

The next `packages/browser` slice now owns validated Runtime adapter session
selection: durable mode, endpoint, and access metadata; tab-confined capability
authority; embedded-mode cleanup; rollback snapshots; and per-tab remote-link
acceptance. Canonical Svelte boot, import, connection, selection, and restored
authority paths delegate storage mutations to this framework-neutral boundary,
while the saved Runtime registry remains in its existing Svelte adapter. Eight
direct tests cover validation-before-mutation, authority confinement and
restoration, stale cleanup, embedded selection, rollback, acceptance failure,
and canonical-consumer wiring. The wallet local check covers 425 files with
zero unsafe-type findings.

The next `packages/runtime-client` slice now owns the pure Runtime handle
projection: normalized selected and pending identity, adapter/config identity,
endpoint, permissions, connection status, height, authenticated access,
command readiness, and current-config comparison. The canonical Svelte store
still owns adapter creation, connection, disconnection, subscriptions, and
publication; it delegates handle construction and identity comparison to the
framework-neutral boundary. Seven direct tests cover embedded defaults, remote
admin and inspect projections, height bounds, stable fallback identity,
explicit Runtime identity matching, canonical WebSocket matching, and thin
Svelte wiring. The wallet local check covers 426 files with zero unsafe-type
findings.

The next `packages/browser` slice now owns the injected wallet boot lifecycle:
settings and tab initialization, remote-preference branching, pre-Runtime local
vault restore, Runtime initialization, post-Runtime local vault rebind, render
settlement, time-store activation, and cancellation checks at every boundary.
The canonical Svelte app supplies the stores, Runtime initializer, current
Runtime mode, render tick, and generation/active-tab guard; no Svelte store or
Runtime implementation moved into the package. Eleven direct tests cover local
and remote order, a local boot that resolves remote, cancellation before work
and after every asynchronous phase, failure propagation, and thin Svelte
wiring. The wallet local check covers 427 files with zero unsafe-type findings.

The next `packages/browser` slice now owns active-tab Runtime coordination:
exclusive Web Lock acquisition, a non-evicting availability probe,
BroadcastChannel and storage reset handling, per-tab standby state,
quiesce-before-release takeover, same-document adoption, and deterministic
listener/channel cleanup. The canonical Svelte module only publishes controller
state and preserves its existing imports. Eight direct tests cover standby,
acquisition/release, denied probes, takeover ordering, hard reset, malformed
storage evidence, reset publication, and thin Svelte wiring. The wallet local
check covers 429 files with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns one-writer Runtime selection
coordination: monotonic leases, queued serialization, immediate stale-intent
invalidation, superseded queued-intent elision, active-lease validation, and
queue recovery after failure. The canonical Svelte Runtime store still owns
adapter switching, session persistence, rollback, target verification, and
store publication; it delegates only concurrency control to the shared
boundary. Five direct tests cover serialization, latest-intent behavior, lease
invalidation, forged/expired lease rejection, failure recovery, and thin Svelte
wiring. The wallet local check covers 430 files with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns injected Runtime adapter
activation. Remote activation persists the session before switching, publishes
pending identity, avoids reconnecting an already-current target, restores the
session and pending identity on switch failure, asserts the selected target,
and reaffirms the session after success. Embedded activation publishes pending
identity before switching, avoids reconnecting a current registered target,
restores pending identity on failure, and persists embedded mode only after
success. The canonical Svelte store supplies browser storage, controller state,
adapter switching, and target comparison. Eleven direct tests cover both modes,
ordering, reconnect elision, unavailable persistence, rollback, mismatch,
unregistered targets, endpoint validation, and thin Svelte wiring. The wallet
local check covers 431 files with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns the framework-neutral
RuntimeView query, pagination, historical-height, committed-height tracking,
live-command assertion, and history-scan default model. The canonical Svelte
store still owns the live RuntimeView state, core projection types, adapter
reads, race guards, catch-up scheduling, and store publication. Eleven direct
tests cover identity normalization, page derivation and navigation, height and
query selection, frame matching, committed-height tracking, live assertions,
history defaults, and thin Svelte wiring. The wallet local check covers 432
files with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns injected Runtime projection
reads, stable query identity, Runtime- and height-scoped caching, lagging live
response handling, historical pinning, bounded eviction, path construction,
and request validation. The canonical Svelte adapter still owns concrete core
result types, active adapter/height/Runtime resolution, cache invalidation
subscriptions, debug-surface publication, and reactive query stores. Ten direct
tests cover stable keys, live invalidation, lagging responses, historical reads,
Runtime partitioning, validated paths, uncached receipt/recovery reads, missing
adapters, eviction, and thin Svelte wiring. The wallet local check covers 433
files with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns the framework-neutral Runtime
query observer: stable external-store snapshots, latest-read publication,
loading and error state, injected height/adapter subscriptions, refresh
recovery, and deterministic teardown. The canonical Svelte adapter still owns
Runtime source wiring and adapts the observer to Svelte immediate subscriptions;
the existing Gossip and Solvency panels keep their public store API. Ten direct
tests cover initial/success state, stale success and failure suppression,
current errors, recovery, both source notifications, subscriber cleanup,
snapshot identity, destruction, and thin Svelte wiring. The wallet local check
covers 434 files with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns framework-neutral RuntimeView
committed-height catch-up: pending-height coalescing, single-flight refresh,
lagging-frame retry, bounded exponential backoff, loud timeout publication,
refresh-error reporting, reset, and teardown. The canonical Svelte store still
owns Runtime source subscriptions, projection reads, timer construction, and
live store publication; it injects those effects into the coordinator. Ten
direct tests cover retry delays, ignored heights, initial-frame queuing,
in-flight coalescing, newer targets, timeout, read failures, reset, destruction,
and thin Svelte wiring. The wallet local check covers 435 files with zero
unsafe-type findings.

The next `packages/runtime-client` slice now owns framework-neutral RuntimeView
selection state: stable snapshots and subscriptions, normalized Entity/page/
historical-height updates, monotonic revisions, navigation reset, complete
selection matching, and generation-aware publication guards. The canonical
Svelte adapter exposes the same Entity and page values as derived readable
stores and still owns query refresh invalidation and live RuntimeView
publication. Ten direct tests cover defaults, Entity normalization, same-Entity
pagination, page normalization, historical height, navigation reset, ABA
selection, publication identity, subscriptions, and thin Svelte wiring. The
wallet local check covers 436 files with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns framework-neutral RuntimeView
refresh leases: monotonic latest-read generations, exact Runtime identity and
mode matching, complete selection matching, explicit invalidation, and
selection invalidation before subscriber notification. The canonical Svelte
adapter still owns typed projection reads, RuntimeView result construction,
page metadata, catch-up scheduling, and live store publication. Ten direct
tests cover target capture, latest-read precedence, explicit invalidation,
Runtime identity and mode changes, complete and ABA selection changes,
subscriber ordering, Runtime ABA invalidation, and thin Svelte wiring. The
wallet local check covers 437 files with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns deterministic RuntimeView
snapshot transitions: empty, loading, disconnected, successful, and failed
states; live committed-height resolution; historical-height pinning; Entity
identity normalization; selection clearing; and monotonic live-height advance.
The canonical Svelte adapter still owns concrete typed reads, writable
publication, page metadata, Runtime subscriptions, and catch-up effects. Ten
direct tests cover live and historical empty states, retained loading data,
disconnection, live and historical success, error normalization, height
selection, committed-height advance, and thin Svelte wiring. The wallet local
check covers 438 files with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns detached RuntimeView
projection reads: normalized and verified Entity projections, bounded Entity
page limits, Account identity validation, swap-history bounds and cursors, and
live or historical selection scoping. The canonical Svelte adapter still owns
the concrete typed query client, active RuntimeView store, and public wrapper
API. Ten direct tests cover missing, live, historical, summary/core, mismatched,
and absent Entity evidence; Account validation and scoping; swap-history
pagination; and thin Svelte wiring. The wallet local check covers 439 files
with zero unsafe-type findings.

The next `packages/runtime-client` slice now owns injected RuntimeView load
outcomes: disconnected short-circuiting, concurrent head and frame reads,
exact historical-frame validation, tagged success and error results, and
latest-handle error capture during a Runtime switch. The canonical Svelte
adapter still owns refresh leases, loading and writable publication, page
metadata, subscriptions, and catch-up effects. Ten direct tests cover
disconnection, read concurrency, live and historical success, exact-height
rejection, head and frame failures, Runtime-switch handle semantics, and thin
Svelte wiring. The wallet local check covers 440 files with zero unsafe-type
findings.

The next `packages/runtime-client` slice now owns framework-neutral RuntimeView
publication coordination: refresh-lease capture, selected-height query pinning,
loading-before-read ordering, latest-wins suppression, and tagged success or
unavailable outcome routing. The canonical Svelte adapter still owns concrete
typed reads, writable stores, page metadata, subscriptions, and catch-up
effects through injected callbacks. Ten direct tests cover live, historical,
disconnected, error, invalidated, target-changed, and overlapping refreshes;
per-caller results; and thin Svelte wiring. The wallet local check covers 441
files with zero unsafe-type findings.

The final `packages/browser` slice owns the same-origin versioned Runtime module
loader, one document-scoped embedded Runtime session, and the injected shutdown
sequence. The React adapter restores the canonical persisted Runtime inputs,
boots through the public Runtime module API, exposes the same typed RuntimeView
reads and commands as remote mode, and quiesces ingress, accepted work, the
Runtime loop, transport, and persistence in their required order. Both React
and Svelte delegate module loading and Runtime suspension to these boundaries.
React initializes the session once per document, subscribes through stable
external-store snapshots, conditionally loads the 4.00 kB bootstrap chunk, and
gates every financial surface when another tab owns the Runtime.

Boundary evidence covers all 42 shared modules (25 browser and 17
Runtime-client): every module is in the typed ownership inventory, both the
legacy Svelte tree and React apps are live consumers of both packages, and the
packages remain independent from application entry points. Boundary policy
tests prove there are no Runtime, Entity, Account, consensus, or persistence
implementation imports; the only core import is public remote-Runtime
configuration. Runtime-client contains no storage, Worker, service-worker,
BroadcastChannel, or Web Lock effects and neither package contains Account
transition or bilateral credit-field implementations. The final affected batch
passes 110 tests with 1,016 assertions; the complete tooling suite passes 94
tests with 846 assertions; and the React local check covers 512 files with zero
unsafe-type findings. All four React builds and the canonical Svelte production
build pass. The exact 305-file candidate boots the real `/runtime.js`, reads an
empty committed H0 portfolio, and transfers ownership between tabs without
stale financial content. Mobile, laptop, and wide browser evidence has zero
console errors or warnings. The root gate passes all 26 BrainVault/runtime tests
with 100156 expectations before the existing contract-sync environment stops at
Hardhat `HH19` under Node 24.18.0.

Coexistence hardening now makes the package boundary structural instead of
conventional: React apps have zero imports from `frontend/src` or `$lib`, the
React Vite configuration no longer defines a `$lib` alias, and shared packages
have zero imports back into application or legacy-Svelte source trees.
Framework-neutral docs, releases, reviews, market-cap, onboarding, RCPAN,
health, QA, invoice, failure, and command-journal modules live under
`packages/{ui,runtime-client,browser}`; their former Svelte paths are thin
re-export adapters until authorized cutover. Permanent boundary tests scan all
apps, packages, and aliases. The final relocation evidence is 109 focused tests
green, all four local checks green across 577 files with zero unsafe findings,
all four production builds green, and the 15-case candidate browser matrix
green at the three mandated viewports.

### WP6 — Migrate wallet by flow

**Status:** `COMPLETE WITH EXPLICIT CROSS-WP DEPENDENCIES — TESTNET LAUNCHER, SHARED WALLET LIFECYCLE BOUNDARIES, REACT /APP SHELL, IDENTITY ENTRY/REHEARSAL, SETTINGS, DIAGNOSTICS, ASSETS/ACCOUNTS, FINANCIAL HEALTH, PAYMENTS, MARKETS/ACTIVITY, AND REQUIREMENT AUDIT IMPLEMENTED`

Migrate coherent flows in roughly this order:

1. boot, shell, identity, onboarding, recovery, settings, diagnostics;
2. assets, accounts, credit, collateral, debt, solvency, disputes, history;
3. payments, receive, invoices, moves, lending, settlement, reconnect, failures;
4. quotes, routing, orders, orderbook, cancel/fill, cross-j, and activity.

Preserve canonical Runtime projections and persisted state. A flow is complete
when success and important failure states pass focused tests; incomplete later
flows do not block earlier wallet slices.

The React wallet now owns `/testnet` while `/app` and `/address` remain explicit
pending routes. It preserves the wallet, custody, health, docs, GitHub, and
social destinations; the five session-randomized disposable Brain Vault entry
links; destructive confirmation; successful reset-to-`/app`; and a visible,
retriable failure when durable deletion is blocked. Eighteen focused tests (141
assertions), strict wallet/tooling typechecks across 422 files with zero unsafe
type findings, and the wallet production build are green. The broader batch
passed 80/82 tests in the sandbox; the two localhost-binding gateway cases then
passed 5/5 outside it. The wallet artifact is 202.40 kB JavaScript / 64.17 kB
gzip and 6.45 kB CSS / 2.02 kB gzip. Browser
evidence covers cancellation, success, and blocked-database failure at 390×844,
1366×900, and 1920×1080; normal flows have zero console errors or warnings, and
the injected failure emits only the expected blocked-deletion error. The
four-app candidate assembles as
`sha256-74038d2cade7da80c14faea3596707d788a701f77ad4789b9429b2ed4742d71b`
with 351 files. The required root gate passes all 26 BrainVault checks before
the existing contract-sync environment stops at Hardhat `HH19` under
unsupported Node 25.

The next wallet slice now owns framework-neutral shell phase derivation for
remote Runtime consent, inactive-tab standby, scenario preview, lock-test
readiness, initialization errors, Runtime loading, and ready content. The
canonical Svelte `/app` shell consumes the shared precedence without changing
its effects, UI, or route ownership; a future React shell can consume the same
snapshot decision without mirrored effect state. Eleven direct tests cover all
phases and precedence edges, 47 affected shell/lifecycle/capability tests pass
with 278 expectations, both wallet and canonical Svelte production builds pass,
and the wallet local check covers 442 files with zero unsafe-type findings.

The next wallet slice now owns one-shot Runtime bootstrap ordering: local
pairing, remote import, consent evaluation, accepted-request persistence, URL
cleanup, and stop-on-failure semantics. The same coordinator handles initial
mount and later hash import changes while the Svelte shell retains concrete
pairing/import implementations, loading/error publication, and pending-consent
UI state. Eight direct tests cover explicit-input detection, exact effect
ordering, consent and accepted paths, pairing/import/persistence failures, and
thin Svelte wiring. The direct and existing remote-import suites pass 43 tests
with 171 expectations. The broader affected request/session/boot/security/
capability batch passes 103 tests with 469 expectations, both wallet and
canonical Svelte production builds pass, and the wallet local check covers 443
files with zero unsafe-type findings.

The next wallet slice now owns framework-neutral recovery-candidate choice:
selected-id lookup with first-candidate fallback, single-pass peer-backup
counting, immutable file-candidate replacement ordered by Runtime height then
creation time, and backup-before-local-before-fresh continuation precedence.
The canonical Svelte flow retains recovery discovery, file parsing, discovery
status persistence, local unlock, backup restore, and fresh Runtime creation.
Eight direct tests plus the affected identity, rehearsal, import, workspace,
and capability suites pass 80 tests with 572 expectations; both wallet and
canonical Svelte production builds pass, and the wallet local check covers 447
files with zero unsafe-type findings. This covers selection, empty results,
deduplication, ordering, stable ties, continuation, immutability, and thin
wiring.

The next wallet slice now owns framework-neutral Runtime opening plans:
explicit local unlock precedence, default existing-Runtime lookup, forced-fresh
and recovery-candidate creation, fallback labels, interoperability mnemonic
normalization, device-passphrase presence, onboarding policy, and recovery
restore flags. Local Runtime lookup remains short-circuited for explicit
local, fresh, and backup actions. The canonical Svelte event flow retains
vault reads and mutations, active signer publication, sensitive cleanup,
navigation, diagnostics, and failure handling. Eight direct tests plus the
affected recovery, vault protection, creation-lock, shell, bootstrap, consent,
import, workspace, and capability suites pass 134 tests with 757 expectations;
both wallet and canonical Svelte production builds pass, and the wallet local
check covers 448 files with zero unsafe-type findings.

The next wallet slice now owns generation-safe recovery discovery
coordination: each request receives a new generation, only the latest success
or failure is accepted, and reset or unmount explicitly invalidates outstanding
work. Stale successes and failures return cancelled without clearing the
newest request's loading state. The canonical Svelte event flow retains seed
and Runtime preconditions, concrete tower and peer discovery sources, local
Runtime lookup, candidate and failure publication, phase changes, and status
persistence. Six direct tests plus the affected identity, rehearsal, opening,
import, workspace, vault, shell, and capability suites pass 140 tests with 782
expectations. The broader recovery batch passes 167 of 169 tests with 913
expectations; its two failures are pre-existing stale source-shape assertions
for the preserved-corrupt-storage diagnostic and the recovery-failure wrapper.
Both wallet and canonical Svelte production builds pass, and the wallet local
check covers 449 files with zero unsafe-type findings.

The next wallet slice now owns generation-safe node mnemonic reveal
coordination: only the latest overlapping success or failure is accepted,
reset invalidates outstanding work, and captured phase, derivation-result, and
adapter ownership must still match after the async reveal. A cancelled latest
generation clears its own loading state, while an older cancelled generation
cannot clear a newer request's loading state. The canonical Svelte event flow
retains the cheap connection and node-ready guards, concrete admin adapter
call, secret mnemonic publication, loading state, and user-visible errors.
Seven direct tests plus the affected identity, recovery, import, workspace,
capability, worker, and native-custody suites pass 99 tests with 649
expectations. Both wallet and canonical Svelte production builds pass, and the
wallet local check covers 450 files with zero unsafe-type findings.

The next wallet slice now owns deterministic Runtime preference policy: exact
auth-scheme decoding with dark fallback, ten-minute/day/forever unlock-duration
resolution, and positive-integer BrainVault worker-cap parsing plus the
existing floor/minimum serialization policy. The canonical Svelte event flow
retains concrete localStorage reads and writes, initialization timing, reactive
state publication, and the existing scalar storage keys; no wallet secret,
Runtime state, or browser storage handle enters the shared boundary. Six direct
tests plus the affected identity, recovery, opening, import, workspace,
capability, worker, and native-custody suites pass 121 tests with 726
expectations. Both wallet and canonical Svelte production builds pass, and the
wallet local check covers 451 files with zero unsafe-type findings.

The next wallet slice now owns deterministic node BrainVault validation:
connected-remote and admin-access gating, inclusive progress bounds for the
expected shard count, exact result spec/shard matching, and the existing 70/30
shard-time smoothing. The canonical Svelte event flow retains adapter lookup,
the concrete derivation call and passphrase, abort ownership, progress and
receipt publication, cleanup, and user-visible failure effects. Eight direct
tests plus the affected identity, recovery, opening, import, workspace,
capability, worker, native-custody, and remote-reconnect suites pass 130 tests
with 800 expectations. Both wallet and canonical Svelte production builds
pass, and the wallet local check covers 452 files with zero unsafe-type
findings.

The next wallet slice now owns fail-closed browser BrainVault worker protocol
validation: message-envelope classification, exact readiness spec matching,
probe and shard timing normalization, worker-error normalization, and shard
index, active-worker ownership, result-length, and duplicate checks. The
canonical Svelte event flow retains Worker creation and handlers, watchdog
timers, retry and dispatch state, result byte decoding, secret inputs, cleanup,
diagnostics, and UI publication. Nine direct tests plus the affected identity,
recovery, opening, import, workspace, capability, worker, native-custody,
node-validation, and remote-reconnect suites pass 139 tests with 831
expectations. Both wallet and canonical Svelte production builds pass, and the
wallet local check covers 453 files with zero unsafe-type findings.

The next wallet slice now owns deterministic browser BrainVault worker
scheduling decisions: pending-work detection, completed-shard retry
suppression, three-attempt retry queuing and exact terminal failure, retry-first
dispatch with completed-head cleanup, fresh-shard cursor advancement, and
cap-aware worker drain/add decisions. The canonical Svelte event flow retains
retry-map and queue mutation, Worker creation and draining, watchdogs,
postMessage payloads and secret input, diagnostics, and UI publication. Nine
direct tests plus the affected validation, identity, recovery, opening, import,
workspace, capability, worker, native-custody, node-validation, and
remote-reconnect suites pass 148 tests with 860 expectations. Both wallet and
canonical Svelte production builds pass, and the wallet local check covers 454
files with zero unsafe-type findings.

The next wallet slice now owns deterministic browser BrainVault worker sizing
and resilience policy: conservative CPU/RAM/WebKit caps, persisted lower caps,
Wasm-memory failure recognition, halved fallback caps, five-to-ten-minute shard
watchdogs, live memory-pressure reduction, four-attempt initialization retry
eligibility, and exact terminal initialization copy. The previous Svelte-only
worker helper is removed. The canonical Svelte event flow retains timers,
Worker teardown and recreation, cap persistence, diagnostics, phase/error
publication, postMessage, and secret input. Eight direct resilience tests plus
the migrated sizing test and affected scheduling, validation, identity,
recovery, opening, import, workspace, capability, native-custody,
node-validation, and remote-reconnect suites pass 156 tests with 883
expectations. Both wallet and canonical Svelte production builds pass, and the
wallet local check covers 454 files with zero unsafe-type findings.

The next wallet slice now owns deterministic browser BrainVault finalization
policy: completion-trigger ownership, exact ascending shard membership,
current-run atomic commit eligibility, and canonical recovery labels. The
canonical Svelte event flow retains shard bytes, Worker termination, every
cryptographic await, derived-secret publication, zeroization, recovery
persistence, navigation, and user-visible state. Ordered-set failures now pass
through the existing finalizer cleanup so collected shards are zeroized before
the error returns. Nine direct finalization tests plus the affected onboarding,
workspace, capability, worker, native-custody, and remote-reconnect suites pass
195 tests with 1110 expectations across 23 files. Both wallet and canonical
Svelte production builds pass, and the wallet local check covers 455 files with
zero unsafe-type findings.

The React wallet now owns the `/app` overview shell. It reads the canonical
stored Runtime adapter mode, endpoint, access, and tab-confined authority
without exposing the capability secret; reports actual browser connectivity;
and links only to working testnet, network-health, and documentation surfaces.
Remote configuration without a complete admin session fails visibly instead
of presenting command readiness. The shell is responsive at phone, laptop,
and wide-desktop viewports, while identity and financial controls remain
absent until their dedicated vertical increments. Focused model, route,
metadata, storage-boundary, and listener-cleanup coverage accompanies the
wallet typecheck, production build, and browser evidence.

The React `/app` shell now owns the identity-entry stage for both canonical
Brain Vault and mnemonic modes. It preserves session-randomized testnet demo
prefill, exact-name/passphrase/factor validation, 12/24-word seed validation
plus canonical checksum/address derivation before review,
keyboard-native tab selection, sensitive-field clearing on mode changes, and
a secret-free recovery-requirements review. Invalid input is announced
in-place and the review states explicitly that no wallet has been created;
derivation and persistence are not simulated. Focused success, invalid, demo,
unknown-demo, routing, keyboard-policy, and secret-boundary coverage accompanies
responsive browser evidence for entry, errors, and review.

The React identity flow now owns mnemonic recovery rehearsal after its
secret-free review. Beginning rehearsal retains only the normalized public
address and clears the first seed; the second entry is cryptographically
validated, a different valid wallet is rejected without replacing the expected
address, and a match clears both seed entries before publishing a verified
state. Cancellation resets the canonical rehearsal policy and clears the
current input. The verified state explicitly makes no wallet-creation or
persistence claim. Focused policy, real-address mismatch/match, error mapping,
source-boundary, wallet typecheck, build, and responsive browser evidence cover
the increment. Brain Vault rehearsal remains coupled to its dedicated browser
derivation stage and is not simulated here.

The React `/app` shell now owns browser-local wallet preferences at
`?settings=1`. It reads and writes the existing canonical auth-scheme and
BrainVault worker-cap keys, applies identity appearance immediately, restores
automatic worker selection by removing only the cap key, bounds explicit caps
to the browser policy range, and reports storage failures without claiming a
save. The light appearance is scoped to identity, recovery, and settings rather
than changing financial workspace presentation. Recovery secrets, Runtime
state, and authority remain outside the preference boundary. Focused default,
invalid, persistence, reset, failure, route, and secret-boundary coverage
accompanies wallet typecheck, build, and responsive dark/light browser evidence.

The React `/app` shell now owns redacted device diagnostics at
`?diagnostics=1`. It reports the selected Runtime configuration without
claiming a live handshake or exposing the tab-confined capability, reads actual
browser connectivity and platform support, and compares the stored deploy
version with the canonical no-cache `/api/jurisdictions` response. Offline,
blocked-storage, malformed-payload, deploy-change, and endpoint-unavailable
states remain explicit; the report never reads identity secrets, Runtime state,
or financial data. Five direct diagnostics tests plus the affected shell,
identity, preference, deploy-version, and capability checks pass 38 tests with
271 expectations. The wallet local check covers 476 files with zero unsafe-type
findings; the production artifact is 230.81 kB JavaScript / 72.18 kB gzip plus
26.11 kB CSS / 5.30 kB gzip. Responsive browser evidence covers local and
remote configuration, offline and blocked-storage states, explicit endpoint
failure, refresh, and cleanup at phone, laptop, and wide-desktop viewports.

The React `/app` shell now owns the first committed financial projection at
`?portfolio=1`: bounded Entity selection, raw reserves, Account spendable and
inbound capacity, collateral, and both bilateral credit directions. It reads
the real remote adapter through the shared query client and latest-wins query
observer, validates the complete RuntimeView boundary, formats known tokens
through canonical helpers, and derives every bilateral value through
`deriveDelta`; it sends no Runtime inputs and never substitutes sample or
estimated values. Embedded mode remains explicitly unavailable until the React
Runtime boot flow owns a live adapter. Focused projection, perspective,
rejection, route, and teardown coverage accompanies wallet typecheck, build,
and real two-Entity Runtime browser evidence at phone, laptop, and wide-desktop
viewports with zero console errors or warnings. The focused batch passes 16
tests with 52 expectations, and the wallet local check covers 479 files with
zero unsafe-type findings. The production entry is 250.47 kB JavaScript /
77.40 kB gzip plus 31.82 kB CSS / 6.09 kB gzip; the canonical adapter remains
isolated in a route-only 722.07 kB / 223.29 kB gzip lazy chunk.

The React `/app` shell now owns the remaining read-only financial-health flow
at `?health=1`: bounded open debt ledgers, Runtime-wide conservation evidence,
committed Account dispute lifecycle gates, and persisted activity history.
Solvency reads pin the Entity view to the exact reported Runtime height;
`null` Depository evidence remains visibly unchecked rather than green. Debt
amounts and perspective, conservation arithmetic, Account ownership, activity
amounts, pagination, and every unknown adapter payload are validated before
rendering. The shared remote-read boundary now disconnects failed initial
adapters, and both financial sources unlatch after failure so visible retry is
bounded and functional. Five direct tests plus the affected portfolio, shell,
and identity suites pass 21 tests with 84 expectations; the wallet local check
covers 486 files with zero unsafe-type findings. The production entry is
272.78 kB JavaScript / 82.09 kB gzip plus 40.25 kB CSS / 7.07 kB gzip, while
the canonical adapter remains in the 722.07 kB / 223.29 kB gzip lazy chunk.
Real persisted-Runtime evidence covers two Entities, one bilateral Account,
three asset lanes, Entity switching, on/off-chain history, and explicit
connection failure/retry. Success has zero console errors or warnings at
390×844, 1366×900, and 1920×1080; the unavailable endpoint emits only its two
Strict Mode connection attempts, adds exactly one on explicit retry, and stays
quiet afterward.

The React `/app` shell now owns payments at `?payments=1` and canonical invoice
deep links at `#pay/`: strictly decoded Runtime-owned route quotes; direct,
trusted, instant, and async command construction through one shared helper;
caller-owned idempotent command identity with encrypted durable journaling when
the owner vault is unlocked and same-command memory retry otherwise; canonical
invoice, app-link, and QR generation; plus bounded reserve transfer, collateral
funding, collateral-withdrawal proposal, lending-offer, and borrow operations.
Pending commands block Entity switching and duplicate submission; unknown
outcomes stay explicit and external-wallet moves remain excluded until the
provider boundary is live. Twenty-one focused compatibility, shell, capability,
and payment tests pass with 217 expectations; the wallet local check covers
497 files with zero unsafe-type findings. The production build transforms 1551
modules and emits 308.71 kB / 92.51 kB gzip entry JavaScript plus 51.44 kB /
8.87 kB gzip CSS; command-journal dependencies remain lazy. Real persisted-
Runtime browser evidence covers a committed-capacity quote, one direct payment
observed at Runtime height 12 after explicit same-identity retry, generated QR,
and the complete Account-operation selector. Success has zero console errors
or warnings at 390×844, 1366×900, and 1920×1080.

The React `/app` shell now owns markets and persisted activity at `?markets=1`:
strictly decoded compact Runtime order books, committed hub Accounts and fee
policy, canonical pair dimensions, Account-specific spend capacity, deterministic
same-j GTC/IOC/FOK order construction, maker-owned cancellation, cross-j lifecycle
evidence, and paginated all/off-chain/on-chain Runtime history. Order and cancel
commands retain one caller-owned identity across explicit retry until the Runtime
height observes them; Entity, hub, and pair selection cannot drift while a command
is pending. Twenty-four focused market, payment, shell, and capability tests pass
with 240 expectations; the wallet local check covers 504 files with zero
unsafe-type findings. The production build transforms 1562 modules and emits a
342.14 kB / 99.85 kB gzip entry plus 63.37 kB / 10.49 kB gzip CSS; Runtime market
dependencies remain lazy. Real persisted-Runtime browser evidence covers a
resting ask, a bid observed after same-identity retry, cancellation observed after
same-identity retry, both activity filters, and logical Runtime timestamps at
390×844, 1366×900, and 1920×1080 with zero console errors or warnings. The root
gate passes all 26 BrainVault/runtime tests with 100156 expectations before the
existing contract-sync environment stops because Hardhat rejects Node 25.6.1.

The final WP6 audit now maps all 30 named flow requirements to ten concrete
React surfaces or an explicit cross-work-package dependency. Twenty-eight are
implemented across WP5 and WP6, including canonical embedded Runtime boot;
irreversible wallet creation/onboarding and full durable recovery remain with
WP9 parity. The same typed inventory keeps the
retained `/address` route, external-wallet provider/native integration, and
canonical cutover visibly assigned to WP9, WP8, and WP10 rather than claiming
them as React behavior. Three focused audit tests validate every route, source,
focused test, requirement link, deferral owner, and exact user-visible boundary
marker with 108 expectations. The complete focused WP6 matrix passes 60 tests
with 497 expectations; the wallet local check covers 505 files with zero
unsafe-type findings, and the final production build emits a 342.66 kB / 99.92
kB gzip entry plus 63.52 kB / 10.52 kB gzip CSS. The browser audit exercises
all nine React routes, corrects false wallet-creation and local-Runtime readiness
claims, and is visually clean at 390×844, 1366×900, and 1920×1080. Normal pages
finish with zero console errors or warnings; diagnostics renders its expected
`/api/jurisdictions` 502 as an explicit unavailable state. The root gate again
passes 26 tests with 100156 expectations before the known Node 25.6.1 contract-
sync boundary. Capability statuses remain `in_progress` or `unstarted` where
those later work packages still own product parity.

The next wallet slice now owns remote Runtime consent decisions and effect
ordering: capability selection and validation, accepted-request persistence,
URL cleanup, activation, and embedded cancellation. The canonical Svelte
shell retains concrete storage, session, history, UI-state, and Runtime boot
effects through injected callbacks; its event handlers now delegate without
mirroring the policy. Nine direct tests cover existing and pasted capabilities,
invalid input, stop-on-failure boundaries, embedded cancellation, and thin
Svelte wiring. The direct, bootstrap, capability, and focused legacy consent
checks pass 25 tests with 216 expectations. The broader affected batch passes
128 of 129 tests with 980 expectations; its sole failure is the pre-existing
outdated `xlnEnvironment` source-shape assertion. Both wallet and canonical
Svelte production builds pass, and the wallet local check covers 444 files with
zero unsafe-type findings.

The next wallet slice now owns the canonical identity-entry modes and their
deterministic interaction policy: Brain Vault and mnemonic are the only
choices, mode changes are input-phase and rehearsal guarded, the departing
mode's sensitive field is cleared, password visibility is reset, and Home,
End, and wrapping arrow navigation resolve without DOM access. The canonical
Svelte view retains field publication, focus, and derivation effects; no
BrainVault derivation or cryptographic logic moved into the boundary. Eleven
direct tests plus the existing wallet-entry surface tests cover the complete
selection and keyboard matrix. The direct, surface, and capability checks pass
19 tests with 178 expectations. The broader affected identity, recovery-import,
workspace, and capability batch passes 65 tests with 529 expectations. Both
wallet and canonical Svelte production builds pass, and the wallet local check
covers 445 files with zero unsafe-type findings.

The next wallet slice now owns the mnemonic recovery-rehearsal transition
policy: an unrequested rehearsal is skipped, a requested rehearsal captures a
normalized public address, a mismatch remains active with an explicit retry
error, a match clears the rehearsal, and cancellation/reset returns canonical
idle state. The canonical Svelte event flow retains seed and derived-material
cleanup, phase/error publication, field mutation, and all derivation and
cryptographic effects. Seven direct tests plus the existing identity-entry and
wallet-entry surface suites cover skip, begin, mismatch, case-insensitive
match, option changes during an active rehearsal, reset, and thin wiring. The
direct, identity-entry, surface, and capability checks pass 26 tests with 197
expectations. The broader affected identity, recovery-import, workspace, and
capability batch passes 72 tests with 548 expectations. Both wallet and
canonical Svelte production builds pass, and the wallet local check covers 446
files with zero unsafe-type findings.

The next wallet slice now owns validated deploy-version payload decoding,
storage, action selection, initial persistence, post-boot refresh, ephemeral
testnet reset coordination, explicit unavailable outcomes, and fail-closed
persistent-data recovery decisions. The canonical Svelte `/app` shell still
owns the concrete no-cache fetch, diagnostic publication, loading/error stores,
and destructive reset implementation through injected dependencies. Eleven
direct tests cover payload aliases and rejection, all policy branches, fetch
and validation failure, storage/reset propagation, refresh persistence, and
thin Svelte wiring. Eighty affected boot/import/security/capability tests pass
with 384 expectations, both wallet and canonical Svelte production builds pass,
and the wallet local check covers 442 files with zero unsafe-type findings.

### WP7 — Migrate ops by flow

**Status:** `IN PROGRESS — REACT HEALTH + QA + HLT + RUNS + SCENARIOS + AI IMPLEMENTED; WORKSPACE STATE LAYER SVELTE-FREE, PANEL PORTS THROUGH ARCHITECT, REACT DOCKVIEW WRAPPER READY, GRAPH3D LIFECYCLE + RENDERER/PRIMITIVES/EFFECTS/ENTITY/ACCOUNT VISUAL FACTORY/INTERACTION/SELECTION/CAMERA/POINTER+XR DRAG STATE + VIEW/SCENE INPUT MODELS EXTRACTED, ENTITY WORKSPACE REACT SHELL/TABS + SHARED CONTEXT PROJECTION READY`

- Migrate health, QA/HLT, evidence, runs, scenarios, AI, embed, and their
  authority/error states.
- Migrate Dockview, Graph3D, Architect, Jurisdiction, Runtime I/O, console,
  solvency, Time Machine, and render/worker teardown.
- Preserve real controls and data; do not replace working operator functions
  with static placeholders.

The first React ops slice owns `/health` route resolution, strict decoding of
the real `/api/health` projection, bounded `/rpc` readiness probes, parallel
refresh, stale-evidence retention, explicit unavailable states, and pagehide
teardown. Its operator ledger renders readiness, process, owner, and storage
evidence without synthetic fallback data. Focused health, RPC, and shared QA
projection tests pass 27 tests with 358 expectations. Ops local TypeScript and
unsafe-type checks pass; the isolated ops and canonical Svelte production
builds pass; browser evidence covers live READY, refresh controls, stale FAIL,
and 390x844, 1366x900, and 1920x1080 viewports without horizontal overflow.
The `/qa/hlt` slice now owns the complete HLT operator flow: canonical preview
math, exact record/replay/abort requests, strict snapshot decoding, active-run
polling, teardown, run diagnostics, process profiles, payment/swap results, and
the authoritative TPS ledger. It is loaded as a separate React chunk so health
does not pay for HLT controls or chart code. Thirteen focused HLT and health
tests pass with 62 expectations; ops local checks and the isolated production
build pass. The exact built artifact resolves the real read-only HLT endpoint
with zero console warnings/errors and no horizontal overflow at 393x852,
1280x800, and 1600x900 viewports. Mutation wiring is verified by exact request
tests; the browser preview deliberately did not start or abort a live public
run. The `/qa` slice now owns the operator cockpit: six independent evidence
reads load in parallel, selected-run detail is the only dependent request,
authorization is explicit, protected evidence URLs are revoked on teardown,
and restart, abort, backfill, and retention use the canonical typed
confirmations. The ledger, system verdict, user-story evidence, scenario video,
suites, benchmarks, persistent history, and run/shard detail remain data-driven
and fail loudly when their source is unavailable. Thirty-five focused ops,
shared-QA, capability, and platform tests pass with 384 expectations; the ops
check scans 577 files with zero unsafe-type findings. The isolated production
build emits the QA view as a 52.18 kB route chunk (14.41 kB gzip) and its source
runtime as 21.18 kB (7.23 kB gzip), leaving the eager shell at 215.12 kB.
Browser evidence covers the explicit unavailable state at 393x852, 1366x900,
and 1920x1080 with zero console warnings/errors and no horizontal overflow;
exact request and populated-data behavior is covered by boundary/action tests
because no local QA evidence service was active. All four React surface checks
and production builds pass, the canonical Svelte build passes, and the
four-app candidate assembles as
`sha256-28ec3ebbb4b6edbd7aacee02479f27738d5f315242335d81a702518c33f38fa2`
with 312 files. The required root `bun run check` passes its
26 BrainVault/startup tests with 100,156 expectations, then stops at the known
contract-sync environment gate because Node 25.6.1 is outside Hardhat's
supported runtime.

The `/runs` slice now owns strict `/api/qa/runs?limit=50` decoding, QA-token
authority, URL-backed selection, filtering, sorting, bounded refresh,
generation-safe abort, and explicit unavailable evidence. The `/scenarios`
slice loads the real prepared `/runtime.js`, records externally owned committed
frame traces, tears down Runtime and jurisdiction watchers, and reconstructs an
exact wallet preview from only the scenario identity and frame index without
replacing live wallet state or adding persistence. The development gateway now
serves declared generated inputs from their prepared owner ahead of SPA
fallback while production `/runtime.js` remains edge-owned.

The canonical `ahb`, `settle`, `swap`, and hub-collapse runners now retain the
supplied fresh Runtime and are traceable. The scenario boundary rejects a
runner that replaces the supplied Runtime, while the shared harness rejects a
non-fresh supplied replica instead of silently mutating prior state. Two narrow
core regressions prove exact replica retention and replacement rejection.
Hub-collapse records 23 real committed frames and reconstructs its final wallet
preview at frame 23 with two entities; no synthetic history or alternate
frontend Runtime path was added.

The final affected batch passes 38 tests with 392 assertions; all four React
local checks scan 588 files with zero unsafe-type findings and all four builds
pass. Ops emits runs as a 7.34 kB chunk and scenarios as 6.61 kB UI plus
11.08 kB Runtime-source chunks; wallet preview remains split into 2.24 kB UI
and 9.63 kB runtime chunks. The candidate matrix passes 21/21 in 29.7 seconds at
390x844, 1366x900, and 1920x1080 with no page errors or horizontal overflow.
Ordinary surfaces and scenario execution have zero console errors; the isolated
runs test asserts the one expected 502 resource error together with the visible
`OPS_RUNS_HTTP_502` failure state because no QA upstream was active. The
validated candidate assembles 323 files as
`sha256-d3588e546b3ca4289e570fb84063b1adab59deb9c40296ed7aaae31209146f31`.

The `/ai` slice now owns the local AI console: strict decoding of every
consumed AI-server field (null-tolerant MLX slots, extra-field-tolerant by
recorded decision because ai/server.ts evolves independently), the canonical
`data: `-line stream parser, council three-stage deliberation messages,
agent tool-call evidence loops, chat save/load/delete with localStorage pins,
entity-context handoff consumption with URL/storage cleanup, system-stats
polling with generation-safe teardown, MLX load/eject control, voice-paste
config, and the full browser effect boundary (Web Speech wake-word auto-start
with defensive restart, microphone analyser visualizer, camera vision loop,
TTS playback, clipboard paste, image drag/drop). Service unavailability is an
explicit visible banner with retry instead of console-only failures, and the
2,365-line canonical Svelte page remains untouched as the behavior reference.
The shared `compareStableText` comparator moved to
`packages/ui/src/stable-compare.ts` with the Svelte path as a thin re-export
adapter; the canonical Svelte production build stays green. Thirteen focused
tests (72 assertions) cover decoding, stream parsing, entity handoff,
streaming/council/agent sends, pins, vision dedupe, routing, metadata, and
runtime wiring; the ops check and production build pass with `/ai` split into
16.24 kB view plus 17.67 kB runtime lazy chunks; and the browser matrix grows
to 24/24 at 390x844, 1366x900, and 1920x1080 — `/ai` renders its heading,
visible unavailable-service banner, and a live Playwright-fake-microphone
`Listening...` session with zero page errors, no horizontal overflow, and only
the expected refused localhost:3031 connections in the console.

`/embed` is deliberately not claimed by the React candidate yet: the route is
a thin shell whose entire body is the canonical Svelte workspace
(`frontend/src/lib/view/View.svelte` → DockRoot → Graph3D, Architect, Runtime
I/O, console, Time Machine), and the permanent boundary tests forbid React
imports from `frontend/src`. React `/embed` ownership therefore arrives with
the workspace-tree migration itself (capability `ops-workspace`, `unstarted`;
the stale `frontend/src/lib/components/Workspace` source path is corrected to
the live `View.svelte` route pair). Until then the React pending shell is the
honest state and the canonical Svelte route keeps serving `/embed`.

The first workspace slice extracts the boot boundary both frameworks will
consume: `packages/runtime-client/src/embed-boot-model.ts` now owns the exact
`?scenario` / `?autoplay=1` / `?speed` / `#trail` contract (trim, strict
autoplay string, the `Number(v || 1) || 1` speed fallback, trail-wins
precedence, document title, and failure copy) and
`packages/runtime-client/src/demo-playback-intent.ts` owns the one-shot
autoplay/speed intent store with value-stable snapshots for
`useSyncExternalStore`. The canonical Svelte `/embed` route and the
`networkMachineDemoStore` are now thin facades over these boundaries with
their public APIs unchanged; five focused model/store tests plus the updated
demo-pins test (68 assertions across both files) pin the semantics, all four
React checks and the canonical Svelte production build stay green, and the
`ops-workspace-boot-boundary` inventory entry records both consumers.

The second workspace slice makes the timeline data layer framework-free:
`src/lib/utils/observableStore.ts` provides the store contract (synchronous
current-value emission, set/update/subscribe, one-shot reads) without svelte,
and both `network3d/runtimeGraphFrameCache.ts` (the only svelte-importing
network3d file) and `stores/network/networkMachineRuntimeStore.ts` now use it
— `network3d/**` is 100% svelte-free and the machine-runtime operations keep
their exact API and pinned source semantics. The canonical Svelte check
(svelte-check plus vite build) and all four React checks stay green; the
323-line frame-cache test, the time-machine contract, and two new observable
L1 tests pass unchanged. A slice-1 regression was caught and fixed by the
canonical check: the demo-intent store must pass the value to subscribers and
emit it on subscribe, or svelte `get()` types collapse to `unknown` in
`NetworkMachineTimeline.svelte`. The whole workspace state layer
(`network3d/**`, `stores/network/**`, `settingsStore`) is now svelte-free;
remaining svelte-store usage lives in the store facades the panels still own
(`xlnStore`, `runtimeStore`, `runtimeViewStore`, `errorLogStore`,
`toastStore`, `appStateStore`) and in the `.svelte` components themselves.

The third workspace slice completes the store-layer neutralization: every
remaining `stores/network/` module (`networkMachineStore`,
`runtimeGraphControlStore`, `routePreviewStore`, `paymentSpotlightStore`,
`jmachineStore`) and `stores/settingsStore.ts` now use the observable store —
the whole workspace state layer (`network3d/**` plus all of
`stores/network/` plus settings) is svelte-free while every public store and
operations API is unchanged, svelte `get()`/`$` consumers keep working
against the value-carrying contract, and theme/UI DOM application stays at
the operations boundary where the UI owns it. The canonical Svelte check
plus production build is green and the complete 1,102-test frontend tree
shows an identical 13-failure set with and without this slice — all
pre-existing collateral from the in-flight `core/scenarios`/entity stream,
zero regressions.

The first panel slice ports the console panel's logic: the frame-log
projection (tolerant `logs`/`frameLogs` decode, level normalization,
`[F<i>]` prefixes, newest-bounded window), level/search filtering,
copy/download text, level colors, and the whitelist command REPL
(help/clear/state/entities/inspect/scenario with tab completion) now live in
`packages/runtime-client/src/console-panel-view.ts`, and the canonical Svelte
`ConsolePanel.svelte` is a thin consumer with its props, keyboard history,
debounce, and clipboard effects unchanged. Four focused tests (34 assertions)
pin the semantics including canonical quirks (unknown `help()` topic lists
commands; `inspect()` of a missing entity returns a message instead of
throwing). The unsafe-types gate rejected an early double assertion in favor
of the shared `isUnknownRecord` boundary guard; canonical check plus build,
all four React checks, and the full 1,102-test frontend tree (identical
13-failure pre-existing baseline) are green. RuntimeIOPanel's projection
helpers follow the same pattern next.

The second panel slice ports the Runtime I/O projections: Map-or-Record
normalization (`mapToArray`/`valuesOf`/`isReadonlyMap`), tolerant bigint
display math (`toBigIntValue`/`formatBigInt`), gossip profile and entry
counting, Time Machine frame selection (negative or absent index selects
nothing; out-of-range clamps to the newest frame), level/category/search log
filtering, level colors and category icons, and the reserves/collateral
conservation sums now live in
`packages/runtime-client/src/runtime-io-panel-view.ts`. The canonical Svelte
panel keeps its expansion state, toggles, and markup and delegates every
projection; the compact-projections-only contract stays pinned by the
existing source test. Five focused tests (45 assertions across both panel
view models) cover Map/Record equivalence, bigint coercion, frame selection
edges, filtering, and the conservation sums over mixed Map/Record frames.
The boundary gate now allows `@xln/core/types/logging` — a 23-line pure-type
module — for panel view models; the no-implementation rule is unchanged.
Canonical check plus build, all four React checks, and the full frontend
tree (identical 13-failure pre-existing baseline) are green.

The third panel slice ports the Solvency presentation projection: stable
stack/token ordering, three-state conservation status, canonical status copy,
raw bigint formatting, and Depository address shortening now live in
`packages/runtime-client/src/solvency-panel-view.ts`. Runtime-owned
`calculateSolvency` remains behind the thin legacy facade, so the shared
package imports only the public result type and no financial or state-machine
implementation. The canonical Svelte panel preserves its props, adapter-first
query, injected-frame fallback, error states, markup, and styling while
delegating display logic. Three focused tests pass with 8 expectations; the
affected legacy contract passes its two non-collateral checks and retains only
the recorded `pendingCollateral` baseline failure. The final unsafe-types gate
covers 603 files with zero findings, Svelte diagnostics are 0 errors / 0
warnings, the canonical build transforms 6,403 client modules, all four React
surfaces pass the local matrix, and the full frontend failure-name diff is
empty against the exact 13-test baseline. Pre-push root evidence reached 26
BrainVault tests / 100,156 expectations, 28 compiled Solidity files, 92
generated TypeChain files, 4 immutable-metadata parity checks, and 10 soundcheck
gates. The unrelated remainder is host-blocked before Rust checks because
`cargo` is not installed; the separate frontend-size policy also reports the
out-of-scope `core/qa/report.ts` at 3,001 / 3,000 lines. This slice changes
neither surface.

The fourth panel slice ports the Runtime Diagnostics presentation model:
immutable newest-first incident ordering with deterministic id ties, active
incident selection, the canonical 20-row bound, embedded/remote adapter labels,
timeline graph/snapshot/frame precedence, ISO timestamps, and thrown-value
error text now live in
`packages/runtime-client/src/runtime-diagnostics-panel-view.ts`. The Svelte
facade retains parallel head/checkpoint/timeline reads, connected-adapter
authority, `verify-chain` control, auto-refresh, loading state, and all markup
and copy; no Runtime transition or persistence logic enters the package. Four
focused tests pass with 21 expectations, including source assertions that keep
effects in the facade. The unsafe-types gate covers 604 files with zero
findings, Svelte diagnostics are 0 errors / 0 warnings, the canonical build
transforms 6,404 client modules, all four React surfaces pass the local matrix,
and the full frontend failure-name diff is empty against the exact 13-test
baseline. Because no markup, styling, copy, or interaction changed, this slice
requires no new screenshot evidence. Pre-push root evidence again passes 26
BrainVault tests / 100,156 expectations, 28 Solidity compiles, 92 TypeChain
outputs, 4 immutable-metadata checks, and all 10 soundcheck gates before the
unchanged host-only `cargo` absence stops Rust checks; the separate size policy
still reports only out-of-scope `core/qa/report.ts` at 3,001 / 3,000 lines.

The fifth panel slice ports the Gossip directory presentation model: typed
profile and Runtime-summary projection, blocked-counterparty normalization,
hub-first stable ordering, counts and refresh evidence, case-insensitive
search across name/Entity/Runtime/jurisdiction, and display-name fallback now
live in `packages/runtime-client/src/gossip-panel-view.ts`. The canonical
Svelte panel retains the Runtime query store, controller handle, teardown,
markup, copy, and styling; the former Entity-workspace model path is a 9-line
re-export facade with its public API intact. Seven focused and legacy contract
tests pass with 44 expectations. The unsafe-types gate covers 605 files with
zero findings, Svelte diagnostics are 0 errors / 0 warnings, the canonical
build transforms 6,404 client modules, all four React surfaces pass the local
matrix, and the valid outside-sandbox full frontend run has an empty diff
against the exact 13-test baseline. The three apparent sandbox additions were
local-server bind failures only: both gateway cases and the QA ETag case pass
in their exact six-test batch outside the sandbox with 54 expectations. No
markup, styling, copy, or interaction changed, so no screenshot evidence is
required for this slice. Pre-push root evidence passes 26 BrainVault/runtime
tests with 100,156 expectations, compiles 28 Solidity files, regenerates 92
TypeChain files, verifies 4 immutable-metadata contracts, and passes all 10
soundcheck gates before the unchanged host-only `cargo` absence stops Rust
checks. The separate size policy still reports only out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

The sixth panel slice ports the remote Time Machine transport model: complete
Runtime/history context normalization, immutable bounded height merging,
one-height `history-frame-batch` query construction, exact unavailable-frame
evidence, Entity/page selection validation, and loading/success/failure scan
projections now live in
`packages/runtime-client/src/time-machine-transport.ts`. The 196-line Svelte
store facade retains adapter/config resolution, live writable stores,
generation and selection supersession, active-Entity publication, wall-clock
timing, and the public history-store API consumed by the canonical workspace.
Seven focused transport tests pass with 31 expectations; the complete affected
history/query/hot-swap batch passes 83 tests with 931 expectations. The
unsafe-types gate covers 606 files with zero findings, Svelte diagnostics are
0 errors / 0 warnings, the canonical build transforms 6,405 client modules,
all four React surfaces pass the local matrix, and the full frontend
failure-name diff is empty against the exact 13-test baseline. This transport
slice changes no markup, styling, copy, or interaction and therefore requires
no new screenshot evidence. Pre-push root evidence passes 26 BrainVault/runtime
tests with 100,156 expectations, compiles 28 Solidity files, regenerates 92
TypeChain files, verifies 4 immutable-metadata contracts, and passes all 10
soundcheck gates before the unchanged host-only `cargo` absence stops Rust
checks. The separate size policy still reports only out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

The seventh panel slice ports the Jurisdiction presentation model: BrowserVM
debug-adapter recognition, historical bigint display coercion, Entity and
state-root formatting, compact balance and precision-bounded ETH formatting,
BrowserVM-first token-option assembly, stable token selection and metadata
fallback, and token-scoped row filtering now live in
`packages/runtime-client/src/jurisdiction-panel-view.ts`. The canonical Svelte
panel retains Runtime/JAdapter reads, time travel, token-registry authority,
panel events, markup, copy, and styling. Six focused tests pass with 42
expectations. The unsafe-types gate covers 607 files with zero findings,
Svelte diagnostics are 0 errors / 0 warnings, the canonical build transforms
6,406 client modules, all four React surfaces pass the local matrix, and the
valid outside-sandbox full frontend run has an empty diff against the exact
13-test baseline. No visible behavior changed, so no screenshot evidence is
required for this slice. Pre-push root evidence passes 26 BrainVault/runtime
tests with 100,156 expectations, compiles 28 Solidity files, regenerates 92
TypeChain files, verifies 4 immutable-metadata contracts, and passes all 10
soundcheck gates before the unchanged host-only `cargo` absence stops Rust
checks. The separate size policy still reports only out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

The eighth panel slice ports the Settings state model: independent canonical
defaults, partial persisted-setting normalization, malformed-value rejection,
storage serialization, live-camera snapshot merging, entity-open-mode
normalization, and operator-facing error text now live in
`packages/runtime-client/src/settings-panel-view.ts`. The canonical Svelte
panel retains browser storage effects, Dockview import/export, Graph3D events,
NetworkMachine operations, lifecycle, markup, copy, and styling. Six focused
tests pass with 39 expectations, and the complete affected Settings/Dock batch
passes 20 tests with 158 expectations. The unsafe-types gate covers 608 files
with zero findings, Svelte diagnostics are 0 errors / 0 warnings, the
canonical build transforms 6,407 client modules, all four React surfaces pass
the local matrix, and the valid outside-sandbox full frontend run has an empty
diff against the exact 13-test baseline. Nominal UI behavior is unchanged;
malformed persisted settings now reach the existing loud storage-error path,
so no new visual feature or screenshot evidence is required. Pre-push root
evidence passes 26 BrainVault/runtime tests with 100,156 expectations, compiles
28 Solidity files, regenerates 92 TypeChain files, verifies 4
immutable-metadata contracts, and passes all 10 soundcheck gates before the
unchanged host-only `cargo` absence stops Rust checks. The separate size policy
still reports only out-of-scope `core/qa/report.ts` at 3,001 / 3,000 lines.

The ninth panel slice ports only Architect presentation helpers: stable unique
Entity-id projection for form controls, scenario-frame line lookup and scroll
positioning, LIVE frame labels and mutation-block text, error display, and
post-action jurisdiction/Entity form-name progression now live in
`packages/runtime-client/src/architect-panel-view.ts`. Account dispute
construction, Runtime ingress, JAdapter reads and debug actions, scenario
execution, timers, panel events, and every financial action remain in the
canonical Svelte panel. Six focused tests pass with 33 expectations; the
complete non-baseline Architect/time-machine/scenario batch passes 22 tests
with 161 expectations, while the separately included Solvency projection test
remains one of the exact recorded baseline failures. The unsafe-types gate
covers 609 files with zero findings, Svelte diagnostics are 0 errors / 0
warnings, the canonical build transforms 6,408 client modules, all four React
surfaces pass the local matrix, and the valid outside-sandbox full frontend run
has an empty diff against the exact 13-test baseline. No markup, styling, copy,
or protocol behavior changed, so no screenshot evidence is required. Pre-push
root evidence passes 26 BrainVault/runtime tests with 100,156 expectations,
compiles 28 Solidity files, regenerates 92 TypeChain files, verifies 4
immutable-metadata contracts, and passes all 10 soundcheck gates before the
unchanged host-only `cargo` absence stops Rust checks. The separate size policy
still reports only out-of-scope `core/qa/report.ts` at 3,001 / 3,000 lines.

The Dockview slice adds a React-native `DockviewReact` adapter without claiming
the incomplete `/embed` route. A framework-neutral workspace controller now
validates the full serialized Dockview tree at the browser boundary, restores
the existing `xln-workspace-layout` envelope, adds only missing registered
panels, debounces canonical autosaves, reports restore/save failures, and
disposes both pending timers and layout subscriptions. The same parser and
serializer now own Svelte DockRoot persistence, including compatibility with
Settings-enriched envelopes, and DockRoot now disposes its previously leaked
layout-change subscription. Three focused contract tests plus the affected
DockRoot and inventory checks pass as a 21-test / 374-expectation batch. The
unsafe-types gate covers 611 files with zero findings, Svelte diagnostics are
0 errors / 0 warnings, the canonical build transforms 6,409 client modules,
all four React surfaces pass the local matrix, and the valid outside-sandbox
full frontend run has an empty diff against the exact 13-test baseline. No
route, markup, styling, or panel behavior changed, so screenshot evidence is
not required. Root evidence passes 26 BrainVault/runtime tests with 100,156
expectations and all 10 soundcheck gates; contract sync is currently stopped by
the host Hardhat compiler-cache mutex after two isolated attempts, Rust remains
unavailable because `cargo` is absent, and the separate size policy still
reports only out-of-scope `core/qa/report.ts` at 3,001 / 3,000 lines.

The first Graph3D slice extracts the browser/Three.js lifecycle that both
frameworks require. Canvas mouse/touch listeners, window and ResizeObserver
updates, OrbitControls events, debug registration, animation cancellation,
scene traversal disposal, renderer disposal, and active WebXR session shutdown
now have explicit ownership and idempotent cleanup. The canonical Svelte panel
uses the shared lifecycle immediately and guards asynchronous initialization
and animation against teardown; no renderer, projection, interaction, markup,
copy, or styling behavior changed. Three focused lifecycle contracts plus the
affected Graph3D/time-machine batch pass 29 tests with 208 expectations. The
unsafe-types gate covers 612 files with zero findings, Svelte diagnostics are
0 errors / 0 warnings, the canonical build transforms 6,410 client modules,
all four React surfaces pass the local matrix, and the valid outside-sandbox
full frontend run has an empty diff against the exact 13-test baseline. This
is a nonvisual lifecycle extraction, so screenshot evidence is not required.
Root evidence passes 26 BrainVault/runtime tests with 100,156 expectations and
all 10 soundcheck gates; contract sync remains stopped by the host Hardhat
compiler-cache mutex, Rust remains unavailable because `cargo` is absent, and
the separate size policy still reports only out-of-scope `core/qa/report.ts`
at 3,001 / 3,000 lines.

The second Graph3D slice extracts the compact entity panel's deterministic
presentation model: live-versus-historical frame selection, bounded history
indices, exact Entity replica lookup, serialized Map/Record normalization,
USDC reserve and Account collateral projections, fail-fast bigint coercion,
and the three-row Account preview now live in
`packages/runtime-client/src/graph3d-entity-panel-view.ts`. The canonical
Svelte component keeps its stores, token formatting, positioning, markup, and
action dispatch while delegating those projections. Five focused tests pin 17
expectations; the affected boundary/time-machine batch passes 33 tests with
428 expectations. The unsafe-types gate covers 613 files with zero findings,
Svelte diagnostics are 0 errors / 0 warnings, the canonical build transforms
4,660 SSR and 6,411 client modules, all four React surfaces pass, and the full
frontend failure-name diff is empty against the exact 13-test baseline. This
is a nonvisual behavior-preserving extraction, so screenshot evidence is not
required. Root verification passes 26 BrainVault/runtime tests with 100,156
expectations and all 10 soundcheck gates; contract sync remains stopped by the
same host Hardhat compiler-cache mutex, Rust remains unavailable because
`cargo` is absent, and the separate size policy still reports only the
out-of-scope `core/qa/report.ts` at 3,001 / 3,000 lines.

The third Graph3D slice extracts the remaining viewport-chrome presentation
state into `packages/runtime-client/src/graph3d-viewport-view.ts`: the five
canonicity options, source/desynchronization status grammar, accessible Runtime
node summary, timeline visibility and ISO evidence, FPS severity thresholds,
numeric labels, bars-position copy, and rounded VR stats. The canonical Svelte
viewport, FPS overlay, and VR HUD keep their DOM, events, props, styling, and
conditional structure while consuming the shared model. Five focused tests
pin 16 expectations; the affected Graph3D/time-machine/boundary batch passes
72 tests with 589 expectations. The unsafe-types gate covers 614 files with
zero findings, Svelte diagnostics are 0 errors / 0 warnings, the canonical
build transforms 4,661 SSR and 6,412 client modules, all four React surfaces
pass, and the full frontend failure-name diff remains empty against the exact
13-test baseline. This is a nonvisual behavior-preserving extraction, so
screenshot evidence is not required. Root verification passes 26
BrainVault/runtime tests with 100,156 expectations and all 10 soundcheck gates;
contract sync remains stopped by the same host Hardhat compiler-cache mutex,
Rust remains unavailable because `cargo` is absent, and the separate size
policy still reports only out-of-scope `core/qa/report.ts` at 3,001 / 3,000
lines.

The fourth Graph3D slice extracts the deterministic scene-input boundary into
`packages/runtime-client/src/graph3d-scene-input.ts`: Runtime scope options,
cross-projection desynchronization counts, active Jurisdiction selection,
Jurisdiction position/capacity/height/mempool/provenance views, and recursive
transaction-envelope normalization are now framework-neutral. Malformed
Jurisdiction mempools fail loudly at the boundary. The canonical Svelte panel
keeps Three.js object creation, animation, interaction, browser effects, and
unchanged viewport props while consuming the shared projection; the viewport
accepts the resulting immutable option list. Four focused tests pin 11
expectations; the affected Graph3D/time-machine/boundary batch passes 76 tests
with 601 expectations. The unsafe-types gate covers 615 files with zero
findings, Svelte diagnostics are 0 errors / 0 warnings, the canonical build
transforms 4,662 SSR and 6,413 client modules, all four React surfaces pass,
and the full frontend failure-name diff remains empty against the exact
13-test baseline. This is a nonvisual behavior-preserving extraction, so
screenshot evidence is not required. Root verification passes 26
BrainVault/runtime tests with 100,156 expectations and all 10 soundcheck gates;
contract sync remains stopped by the same host Hardhat compiler-cache mutex,
Rust remains unavailable because `cargo` is absent, and the separate size
policy still reports only out-of-scope `core/qa/report.ts` at 3,001 / 3,000
lines.

The fifth Graph3D slice relocates renderer creation, the canonical palette,
and explicit Three.js GPU-resource teardown from the legacy panel tree into
`packages/ui/src/graph3d-renderer.ts`. The canonical Svelte panel and its
visual factory now consume the shared renderer API, while WebGPU selection,
WebGL fallback, markup, interaction, scene content, and styling remain
unchanged. Four focused tests pin seven expectations across palette ownership,
nested geometry/material/texture disposal, and detach-before-dispose behavior;
the affected lifecycle/ownership batch passes 21 tests with 349 expectations.
The unsafe-types gate covers 615 files with zero findings, Svelte diagnostics
are 0 errors / 0 warnings, the canonical build transforms 4,662 SSR and 6,413
client modules, all four React surfaces pass, and the full frontend
failure-name diff remains empty against the exact 13-test baseline. This is a
nonvisual ownership relocation, so screenshot evidence is not required. Root
verification passes 26 BrainVault/runtime tests with 100,156 expectations and
all 10 soundcheck gates; contract sync remains stopped by the same host
Hardhat compiler-cache mutex, Rust remains unavailable because `cargo` is
absent, and the separate size policy still reports only out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

The sixth Graph3D slice extracts the runtime-agnostic grid, Jurisdiction mesh,
proportional broadcast animation, and deterministic degree/id radial layout
into `packages/ui/src/graph3d-scene-primitives.ts`. The canonical Svelte panel
consumes those shared Three.js primitives while account bars, Delta views,
entity projection, interaction, markup, scene content, and styling remain
unchanged. Four focused tests pin 15 expectations across radial order/geometry,
Jurisdiction metadata and label placement, zero-transaction broadcast
suppression, and ownership. The affected graph/lifecycle/ownership batch
passes 31 tests with 400 expectations; the legacy visual factory drops from
702 to 578 lines. The unsafe-types gate covers 616 files with zero findings,
Svelte diagnostics are 0 errors / 0 warnings, the canonical build transforms
4,663 SSR and 6,414 client modules, all four React surfaces pass, and the full
frontend failure-name diff remains empty against the exact 13-test baseline.
This is a nonvisual behavior-preserving extraction, so screenshot evidence is
not required. Root verification passes 26 BrainVault/runtime tests with
100,156 expectations and all 10 soundcheck gates; contract sync remains
stopped by the same host Hardhat compiler-cache mutex, Rust remains unavailable
because `cargo` is absent, and the separate size policy still reports only
out-of-scope `core/qa/report.ts` at 3,001 / 3,000 lines.

The seventh Graph3D slice extracts live directional-lightning and
transaction-ripple meshes into `packages/ui/src/graph3d-visual-effects.ts`
using structural visual inputs only. The canonical Svelte panel keeps effect
selection, particle animation, scene insertion/removal, and transaction flow;
Account/Delta rendering, markup, and styling remain unchanged. The unused
random ambient-ripple helper is removed rather than carried into the shared
surface. Four focused tests pin 18 expectations across connection geometry,
amount-based radius/color tiers, transaction color mapping, orientation, and
ownership. The affected lifecycle/ownership batch passes 29 tests with 388
expectations; the legacy visual factory drops from 578 to 509 lines. The
unsafe-types gate covers 617 files with zero findings, Svelte diagnostics are
0 errors / 0 warnings, the canonical build transforms 4,664 SSR and 6,415
client modules, all four React surfaces pass, and the full frontend
failure-name diff remains empty against the exact 13-test baseline. This is a
nonvisual behavior-preserving extraction, so screenshot evidence is not
required. Root verification passes 26 BrainVault/runtime tests with 100,156
expectations and all 10 soundcheck gates; contract sync remains stopped by the
same host Hardhat compiler-cache mutex, Rust remains unavailable because
`cargo` is absent, and the separate size policy still reports only
out-of-scope `core/qa/report.ts` at 3,001 / 3,000 lines.

The eighth Graph3D slice extracts entity labels, mempool indicators, label/badge
positioning, and entity-node construction into
`packages/ui/src/graph3d-entity-visuals.ts` using structural profile/replica
inputs. Position precedence, Jurisdiction offsets, federal/hub styling, scale,
label metadata, and fail-loud size validation remain unchanged. The canonical
Svelte panel keeps live label text, badge canvas updates, entity selection,
scene insertion, Account/Delta rendering, interaction, markup, and styling.
Four focused tests pin 20 expectations; the affected graph/lifecycle/ownership
batch passes 33 tests with 416 expectations, and the legacy visual factory
drops from 509 to 349 lines. The unsafe-types gate covers 618 files with zero
findings, Svelte diagnostics are 0 errors / 0 warnings, the canonical build
transforms 4,665 SSR and 6,416 client modules, all four React surfaces pass,
and the full frontend failure-name diff remains empty against the exact
13-test baseline. This is a nonvisual behavior-preserving extraction, so
screenshot evidence is not required. Root verification passes 26
BrainVault/runtime tests with 100,156 expectations and all 10 soundcheck gates;
contract sync remains stopped by the same host Hardhat compiler-cache mutex,
Rust remains unavailable because `cargo` is absent, and the separate size
policy still reports only out-of-scope `core/qa/report.ts` at 3,001 / 3,000
lines.

The ninth Graph3D slice extracts normalized-device-coordinate projection,
scene-root-bounded entity hit resolution, and canonical entity/connection
highlight reset into `packages/ui/src/graph3d-interaction.ts`. Mouse, touch,
double-click, and XR selection now share those mechanics while the canonical
Svelte panel retains gesture state, dragging, camera controls, selection,
wallet actions, tooltips, and event effects. The highlight reset uses Three.js
material capability flags so it remains correct when application and shared
package imports have distinct module identities. Five focused tests pin 18
expectations; the affected Graph3D batch passes 93 tests with 358 expectations.
The unsafe-types gate covers 619 files with zero findings, Svelte diagnostics
are 0 errors / 0 warnings, the canonical build transforms 4,666 SSR and 6,417
client modules, all four React surfaces pass, and the full frontend
failure-name diff remains empty against the exact 13-test baseline (1,174
passes and 6,519 expectations). This is a nonvisual behavior-preserving
extraction, so screenshot evidence is not required. Root verification passes
26 BrainVault/runtime tests with 100,156 expectations and all 10 soundcheck
gates; contract sync remains stopped by the same host Hardhat compiler-cache
mutex, Rust remains unavailable because `cargo` is absent, and the separate
size policy still reports only out-of-scope `core/qa/report.ts` at 3,001 /
3,000 lines.

The tenth Graph3D slice extracts Account mempool-box geometry, transaction-cube
caps, observed-side placement, and committed/proposal coloring into
`packages/ui/src/graph3d-account-visuals.ts`. The canonical Svelte-owned visual
adapter still classifies bilateral state and retains all Account bar and
financial derivation; the shared package receives only presentation-ready
state labels and structural Account views. Three focused tests pin 17
expectations; the affected Graph3D batch passes 96 tests with 375 expectations,
and the legacy visual factory drops from 349 to 265 lines. The unsafe-types
gate covers 620 files with zero findings, Svelte diagnostics are 0 errors / 0
warnings, the canonical build transforms 4,667 SSR and 6,418 client modules,
all four React surfaces pass, and the full frontend failure-name diff remains
empty against the exact 13-test baseline (1,177 passes and 6,536 expectations).
This is a nonvisual behavior-preserving extraction, so screenshot evidence is
not required. Root verification passes 26 BrainVault/runtime tests with
100,156 expectations and all 10 soundcheck gates; contract sync remains
stopped by the same host Hardhat compiler-cache mutex, Rust remains unavailable
because `cargo` is absent, and the separate size policy still reports only
out-of-scope `core/qa/report.ts` at 3,001 / 3,000 lines.

The eleventh Graph3D slice relocates the immutable first-select, second-select,
and drag-end gesture reducer from the Svelte-owned `network3d` tree into
`packages/ui/src/graph3d-interaction.ts`, alongside shared selection-ring
creation, replacement, and deterministic GPU-resource cleanup. The canonical
Svelte panel retains live dragging, camera controls, hover/tooltips, wallet
actions, and event emission. Six direct interaction tests plus the existing
gesture contract pass; the affected Graph3D batch passes 97 tests with 383
expectations, and the obsolete `graphSelectionGesture.ts` module is deleted.
The unsafe-types gate covers 619 files with zero findings, Svelte diagnostics
are 0 errors / 0 warnings, the canonical build transforms 4,666 SSR and 6,417
client modules, all four React surfaces pass, and the full frontend
failure-name diff remains empty against the exact 13-test baseline (1,178
passes and 6,544 expectations). This is a nonvisual behavior-preserving
relocation, so screenshot evidence is not required. Root verification passes
26 BrainVault/runtime tests with 100,156 expectations and all 10 soundcheck
gates; contract sync remains stopped by the same host Hardhat compiler-cache
mutex, Rust remains unavailable because `cargo` is absent, and the separate
size policy still reports only out-of-scope `core/qa/report.ts` at 3,001 /
3,000 lines.

The twelfth Graph3D slice relocates the Account visual factory into
`packages/ui/src/graph3d-account-visuals.ts` behind injected canonical
classification, bar-visual, and bar-render functions. The shared factory now
owns only lexicographic side lookup, exact frame-height selection,
confirmed/pending presentation projection, dispute projection, and Account
mempool placement. `AccountBarRenderer.ts`, `derivedAccount.ts`, token metadata,
bilateral classification, and every financial formula remain unchanged in
their canonical owners. Five focused tests pin 35 expectations, including
reversed draw direction, mismatched Account heights, exact classification call
order, the real canonical renderer, and the empty-delta short circuit; the
affected Graph3D batch passes 99 tests with 401 expectations. The legacy visual
adapter drops from 265 to 221 lines, while the shared module remains within the
300-line policy at 290 lines. The unsafe-types gate covers 619 files with zero
findings, Svelte diagnostics are 0 errors / 0 warnings, the canonical build
transforms 4,666 SSR and 6,417 client modules, all four React surfaces pass,
and the full frontend failure-name diff remains empty against the exact
13-test baseline (1,180 passes and 6,562 expectations). This is a nonvisual,
behavior-preserving relocation, so screenshot evidence is not required. Root
verification passes 26 BrainVault/runtime tests with 100,156 expectations,
contract artifact sync compiles 28 Solidity files and passes immutable-metadata
parity for four contracts, and all 10 soundcheck gates pass; the repository
check then stops at the unchanged host limitation that `cargo` is unavailable.
The separate size policy still reports only out-of-scope `core/qa/report.ts` at
3,001 / 3,000 lines.

The thirteenth Graph3D slice extracts target updates, persisted pose restore,
and entity-bound camera fitting into `packages/ui/src/graph3d-camera.ts`. The
shared 69-line module operates on injected Three.js camera/control refs, keeps
the exact minimum distance, aspect floor, preferred-entity threshold, and
`(0, 1, 1)` view direction, and updates the projection matrix only when a zoom
value is present. The Svelte panel retains camera ownership, bridge events,
settings persistence, and OrbitControls lifecycle while dropping 27 lines
(2,594 to 2,567). Five focused tests pin 25 expectations; the affected Graph3D
batch passes 104 tests with 426 expectations. The unsafe-types gate covers 620
files with zero findings, Svelte diagnostics are 0 errors / 0 warnings, the
canonical build transforms 4,667 SSR and 6,418 client modules, all four React
surfaces pass, and the full frontend failure-name diff remains empty against
the exact 13-test baseline (1,185 passes and 6,587 expectations). This is a
nonvisual, behavior-preserving extraction, so screenshot evidence is not
required. Root verification passes 26 BrainVault/runtime tests with 100,156
expectations, contract artifact sync compiles 28 Solidity files and passes
immutable-metadata parity for four contracts, and all 10 soundcheck gates pass;
the repository check then stops at the unchanged host limitation that `cargo`
is unavailable. The separate size policy still reports only out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

The fourteenth Graph3D slice moves the duplicated mouse/touch drag-plane
setup, pointer intersection, mesh-position synchronization, and drag emissive
transitions into `packages/ui/src/graph3d-interaction.ts`. The Svelte panel
retains input events, raycast hit selection, gesture state, controls enablement,
pinning, spacing enforcement, position persistence, click suppression, and
connection updates. The shared interaction module remains within policy at 198
lines, and the Svelte panel drops 23 lines (2,567 to 2,544). Seven focused tests
pin 41 expectations, including the exact plane normal, initial grab offset,
projected movement, mesh synchronization, and begin/end colors; the affected
Graph3D batch passes 105 tests with 441 expectations. The unsafe-types gate
covers 620 files with zero findings, Svelte diagnostics are 0 errors / 0
warnings, the canonical build transforms 4,667 SSR and 6,418 client modules,
all four React surfaces pass, and the full frontend failure-name diff remains
empty against the exact 13-test baseline (1,186 passes and 6,602 expectations).
This is a nonvisual, behavior-preserving extraction, so screenshot evidence is
not required. Root verification passes 26 BrainVault/runtime tests with 100,156
expectations, contract artifact sync compiles 28 Solidity files and passes
immutable-metadata parity for four contracts, and all 10 soundcheck gates pass;
the repository check then stops at the unchanged host limitation that `cargo`
is unavailable. The separate size policy still reports only out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

The fifteenth Graph3D slice moves XR controller-ray construction, immutable
grab snapshots, per-frame controller projection into graph-local coordinates,
mesh synchronization, and the strict `> 0.5` release threshold into
`packages/ui/src/graph3d-interaction.ts`. The Svelte panel retains controller
lifecycle, immersive-wallet priority, hit selection, gesture outcomes, pinning,
position persistence, spacing enforcement, and connection updates. The shared
interaction module remains within policy at 241 lines, and the Svelte panel
drops eight lines (2,544 to 2,536). Nine focused tests pin 58 expectations;
the affected Graph3D batch passes 107 tests with 458 expectations. The
unsafe-types gate covers 620 files with zero findings, Svelte diagnostics are 0
errors / 0 warnings, the canonical build transforms 4,667 SSR and 6,418 client
modules, all four React surfaces pass, and the full frontend failure-name diff
remains empty against the exact 13-test baseline (1,188 passes and 6,619
expectations). This is a nonvisual, behavior-preserving extraction, so
screenshot evidence is not required. Root verification passes 26
BrainVault/runtime tests with 100,156 expectations, contract artifact sync
compiles 28 Solidity files and passes immutable-metadata parity for four
contracts, and all 10 soundcheck gates pass; the repository check then stops at
the unchanged host limitation that `cargo` is unavailable. The separate size
policy still reports only out-of-scope `core/qa/report.ts` at 3,001 / 3,000
lines.

The sixteenth Graph3D slice extracts entity-first raycast resolution and exact,
fail-loud entity/connection hover coloring into
`packages/ui/src/graph3d-hover.ts`. The Svelte panel retains tooltip payloads,
screen coordinates, visibility, Account display formatting, drag short-circuit,
and highlight-reset timing, including the existing direct-target transition
behavior. The shared hover module is 88 lines, and the Svelte panel drops 21
lines (2,536 to 2,515). Six focused tests pin 18 expectations; the affected
Graph3D batch passes 113 tests with 476 expectations. The unsafe-types gate
covers 621 files with zero findings, Svelte diagnostics are 0 errors / 0
warnings, the canonical build transforms 4,668 SSR and 6,419 client modules,
all four React surfaces pass, and the full frontend failure-name diff remains
empty against the exact 13-test baseline (1,194 passes and 6,637 expectations).
This is a nonvisual, behavior-preserving extraction, so screenshot evidence is
not required. Root verification passes 26 BrainVault/runtime tests with 100,156
expectations, contract artifact sync compiles 28 Solidity files and passes
immutable-metadata parity for four contracts, and all 10 soundcheck gates pass;
the repository check then stops at the unchanged host limitation that `cargo`
is unavailable. The separate size policy still reports only out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

The required read-only Entity workspace sizing gate covers
`frontend/src/lib/components/Entity/**`: 112 files and 43,268 lines, comprising
58 Svelte files / 32,453 lines, 53 TypeScript files / 8,993 lines, and one CSS
file / 1,822 lines. The largest areas are `workspace` (20 files / 8,992 lines),
`swap` (11 / 7,119), `payments` (12 / 6,857), and `account` (19 / 6,249); the
largest individual files are `EntityPanelTabs.svelte` (2,930),
`SwapPanel.svelte` (2,873), `PaymentPanel.svelte` (1,963), and `SwapPanel.css`
(1,822). This tree is mounted by both the wallet shell and Dockview
`EntityPanelWrapper`; no Entity source was changed. Starting its React port was
an explicit owner checkpoint, authorized by the owner on 2026-09-02. The owner
separately authorized the narrowly scoped Graph3D Account visual-factory
relocation recorded above; that authority
did not extend to changing Account state, consensus, or financial derivation.

The first Entity workspace slice relocates the complete hash/query deep-link
contract, top-level section registry, and compact identity display helpers into
`packages/runtime-client/src/entity-workspace-navigation.ts` and
`packages/ui/src/entity-workspace-display.ts`. One-line legacy facades preserve
all existing Svelte imports while the canonical `EntityPanelTabs` now derives
its Assets / Accounts / Ownership / Settings order and labels from the shared
registry that React will consume. The legacy Entity tree drops 271 lines
(43,268 to 42,997); the shared modules are 191 and 19 lines. Ten direct tests
pin 58 expectations, and the targeted routing, workspace projection, context
switching, and Account-navigation batch passes 35 tests with 350 expectations.
The unsafe-types gate covers 623 files with zero findings, Svelte diagnostics
are 0 errors / 0 warnings, the canonical build transforms 4,670 SSR and 6,421
client modules, all four React surfaces pass, and the full frontend failure-name
diff remains empty against the exact 13-name baseline (1,197 passes and 6,676
expectations). This is a nonvisual, behavior-preserving relocation, so
screenshot evidence is not required. Root verification passes 26
BrainVault/runtime tests with 100,156 expectations, contract artifact sync
compiles 28 Solidity files and passes immutable-metadata parity for four
contracts, and all 10 soundcheck gates pass; the repository check then stops at
the unchanged host limitation that `cargo` is unavailable. The separate size
policy still reports only out-of-scope `core/qa/report.ts` at 3,001 / 3,000
lines.

The next visual Entity slice adds a 99-line shared React shell and 182-line
responsive stylesheet plus a 22-line ops adapter. The shell consumes the same
section registry and deep-link parser as Svelte, presents explicit unattached
Runtime / jurisdiction / Entity context, and changes sections through canonical
hash routes without inventing projection data or command availability. It is
mounted only at the internal candidate preview path
`/__app/ops/entity-workspace`; the production `/embed` route remains unclaimed
by React and canonical in Svelte. Three direct tests pass 16 expectations; the
targeted Entity/ops/Dockview/gateway batch passes 37 tests with 230 expectations.
The unsafe-types gate covers 625 files with zero findings, Svelte diagnostics
are 0 errors / 0 warnings, the build transforms 4,670 SSR and 6,421 client
modules, all four React surfaces pass, and the exact 13-name failure baseline
remains unchanged (1,200 passes and 6,692 expectations). The React browser
candidate passes 27 / 27 at 390×844, 1366×900, and 1920×1080; the shell tab
flow has zero page errors, zero console errors, no horizontal overflow, and all
three screenshots pass visual review. Root verification again passes 26
BrainVault/runtime tests with 100,156 expectations, compiles 28 Solidity files,
passes immutable parity for four contracts and all 10 soundchecks, then stops
only because `cargo` is unavailable. The size policy still reports only the
pre-existing out-of-scope `core/qa/report.ts` 3,001 / 3,000 overage.

The following nonvisual slice extracts the exact Entity workspace context from
an untrusted Runtime adapter frame into the 111-line
`packages/runtime-client/src/entity-workspace-context.ts`. Its strict union
represents only empty or selected identity, Runtime id, committed height,
signer, jurisdiction, and bounded account count; malformed height, identity,
identity disagreement, or page metadata fails loudly. Committed Entity core
profile and jurisdiction fields retain precedence over adapter summaries. The
legacy `EntityPanelView` projection now consumes this shared boundary, and the
React shell accepts the same type while its candidate adapter publishes an
explicit empty context until a real browser Runtime session is connected. Five
direct tests pass 14 expectations, and the Entity model/routing/React-shell
batch passes 28 tests with 230 expectations. Unsafe-types covers 626 files with zero findings,
Svelte diagnostics are 0 / 0, the build transforms 4,671 SSR and 6,422 client
modules, all four React surfaces pass, and the exact 13-name baseline diff is
empty (1,205 passes and 6,707 expectations). Current rendered behavior is
unchanged, so new screenshot evidence is not required. Root verification again
passes 26 BrainVault/runtime tests with 100,156 expectations, compiles 28
Solidity files, passes immutable parity for four contracts and all 10
soundchecks, then stops only because `cargo` is unavailable; the size policy
still reports only `core/qa/report.ts` at 3,001 / 3,000.

The next Entity workspace slice connects that shared projection to the real,
tab-confined remote Runtime session already selected by the wallet. The ops
route dynamically loads a 233-line read-only source only for the internal
candidate path, opens the canonical `RemoteRuntimeAdapter`, and observes one
bounded `view-frame` query (`accountsLimit: 1`, `booksLimit: 1`) through the
shared query client/observer. It exposes explicit unavailable, connecting,
loading, selected/empty-ready, and fail-loud retry states, disconnects on page
exit, and contains no command/send path. A process-local Vite cache root keeps
concurrent isolated browser runs from invalidating optimizer output. Seventeen
focused tests pass with 99 expectations. Unsafe-types covers 628 files with
zero findings, Svelte diagnostics are 0 / 0, the canonical build transforms
4,671 SSR and 6,422 client modules, and all four React projects pass. The full
frontend failure-name diff remains empty against the exact 13-name baseline
(1,209 passes and 6,730 expectations). The candidate browser matrix passes
27 / 27, and a new strict-health isolated E2E connects to real H1 in 19.0s,
publishes H1 / Testnet / committed height and account count, and captures clean
390×844, 1366×900, and 1920×1080 selected-state screenshots with no horizontal
overflow. Canonical Svelte `/embed` remains unchanged and production cutover
is still out of scope. Root verification passes 26 BrainVault/runtime tests
with 100,156 expectations, compiles 28 Solidity files, passes immutable parity
for four contracts and all 10 soundchecks, then stops only because `cargo` is
unavailable. The size policy still reports only the pre-existing out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

The first read-only section slice adds a strict 121-line committed-board
projection in `packages/runtime-client/src/entity-workspace-ownership.ts` and
renders it only for the React candidate's Ownership tab. The projection accepts
the existing bounded `view-frame` response, preserves canonical validator
order, and exposes only board mode, threshold, total shares, validator shares,
and whether the attached replica signer is a board member. Malformed modes,
empty or duplicate validators, non-positive or oversized power, foreign or
missing shares, unreachable thresholds, and active-Entity disagreement fail
loudly. It introduces no command path and does not reproduce proposer,
certificate, quorum, or handover logic; share issuance and board actions remain
on canonical Svelte `/embed`. The direct context/ownership/source/shell batch
passes 17 tests with 64 expectations, and the affected typed inventory batch
passes 19 tests with 395 expectations. Unsafe-types covers 629 files with zero
findings, Svelte diagnostics are 0 / 0, the canonical build transforms 4,671
SSR and 6,422 client modules, and all four React projects pass. The full
frontend failure-name diff is empty against the exact 13-name baseline (1,214
passes and 6,744 expectations). The candidate browser matrix passes 27 / 27,
and the strict-health isolated real-H1 flow passes in 18.5s with nonzero board
member and threshold evidence plus clean 390×844, 1366×900, and 1920×1080
screenshots and no horizontal overflow. Root verification passes 26
BrainVault/runtime tests with 100,156 expectations, compiles 28 Solidity files,
generates 92 TypeChain files, passes immutable parity for four contracts and
all 10 soundchecks, then stops only because `cargo` is unavailable. The size
policy still reports only the pre-existing out-of-scope `core/qa/report.ts` at
3,001 / 3,000 lines.

The next read-only Entity slice adds a strict 122-line bounded Account-page
projection plus a 54-line React panel and 54-line responsive stylesheet. It
preserves the adapter's canonical Account order and exposes only counterparty
identity, committed Account frame height/state hash, and exact page metadata.
The source requests at most eight Accounts and supports validated read-only
page navigation; the panel labels shown and total counts separately. Malformed
or incomplete page metadata, invalid frame headers, foreign/self Accounts, and
duplicate counterparties fail loudly. No delta, credit, balance, capacity, or
financial formula is read or reproduced; payments, swaps, credit, and Account
lifecycle commands remain on canonical Svelte `/embed`. The direct
context/ownership/Accounts/source/shell batch passes 23 tests with 84
expectations, and the typed inventory batch passes 19 tests with 396
expectations. Unsafe-types covers 631 files with zero findings, Svelte
diagnostics are 0 / 0, the canonical build transforms 4,671 SSR and 6,422
client modules, and all four React projects check and build. The ops workspace
chunk is 12.78 kB and its lazy Runtime chunk is 15.41 kB. The full frontend
failure-name diff remains empty against the exact 13-name baseline (1,220
passes and 6,765 expectations). The candidate browser matrix passes 27 / 27,
and the strict-health isolated real-H1 flow passes in 20.1s, renders two real
Accounts, and captures clean 390×844, 1366×900, and 1920×1080 screenshots with
no horizontal overflow. Root verification passes 26 BrainVault/runtime tests
with 100,156 expectations, compiles 28 Solidity files, passes immutable parity
for four contracts and all 10 soundchecks, then stops only because `cargo` is
unavailable. The size policy still reports only the pre-existing out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

The final read-only Entity section slice adds an 83-line committed public
profile projection plus a 58-line React panel and 44-line responsive
stylesheet. It reuses the same bounded `view-frame`, verifies the active
Entity identity, preserves committed sector order, and exposes only name,
hub/user role, Entity kind, sectors, avatar reference, bio, and website.
Missing optional classification and empty public fields remain visibly
undeclared or unpublished; malformed identity, role, field types, oversized
sector lists, and duplicate sectors fail loudly. The profile renders only for
the Settings landing and `settings/entity` deep link; every save, recovery,
network, display, data, and consensus command remains on canonical Svelte
`/embed`. Existing Account screenshot coverage remains in the same real-H1
flow. The direct context/Accounts/Ownership/profile/source/shell batch passes
28 tests with 104 expectations, and the inventory-expanded affected batch
passes 51 tests with 523 expectations. Unsafe-types covers 633 files with zero
findings, Svelte diagnostics are 0 / 0, and the canonical build transforms
4,671 SSR and 6,422 client modules. The full frontend failure-name diff remains
empty against the exact 13-name baseline (1,225 passes and 6,786
expectations). The candidate browser matrix passes 27 / 27. The strict-health
real-H1 flow passes in 18.8s, verifies H1 as a committed Hub profile, retains
two real Accounts, and captures six clean Settings/Profile and Accounts
screenshots at 390×844, 1366×900, and 1920×1080 with no horizontal overflow.
Root verification passes 26 BrainVault/runtime tests with 100,156
expectations, compiles 28 Solidity files, passes immutable parity for four
contracts and all 10 soundchecks, then stops only because `cargo` is
unavailable. The size policy still reports only the pre-existing out-of-scope
`core/qa/report.ts` at 3,001 / 3,000 lines.

Workspace port order recorded from the live tree (View 487 lines, DockRoot
790, panels 11,630; the data layer — `network3d` minus the frame cache,
`panelBridge`, `perfMonitor`, `command-palette-view`,
`paymentTerminalMonitor`, and all of `packages/{browser,runtime-client}` — is
already framework-neutral): neutralize `runtimeGraphFrameCache` (the only
Svelte-importing network3d file) and the `networkMachineRuntimeStore` /
`settingsStore` facades next; panel ports are complete through Console →
RuntimeIO → Solvency → Runtime Diagnostics → Gossip → Time Machine transport →
Jurisdiction → Settings → Architect; the React Dockview wrapper now preserves
the canonical Svelte layout JSON; Graph3D browser/Three.js lifecycle, renderer
resource ownership, scene primitives/effects/entity/Account visual factory,
interaction/selection/camera/pointer+XR-drag and hover mechanics, entity mini-panel, viewport-chrome
presentation, and scene-input projections are framework-neutral.
Treat the sized 112-file / 43,268-line Entity workspace
tree behind `entity-panel` and the wallet shell as its own owner-approved
sub-program before any `/embed` route flip. `tests/frontend/graph/*`,
`time-machine-current-env`, and
`tests/sites/dockview.spec.ts` are the acceptance contract throughout.

**Done:** ops routes and operator flows pass focused checks with correct cleanup
and authority behavior.

### WP8 — Integrate PWA, native, deployment, and rollback

**Status:** `COMPLETE — VERIFIED RELEASE + NATIVE/PACKAGED CONSUMERS + ISOLATED PWA/DEPLOYMENT ACTIVATION AND ROLLBACK`

- Point PWA/native/deployment consumers at the assembled candidate artifact.
- Preserve service-worker scope, storage origin, CSP, deep links, and packaging.
- Exercise corrupt, missing, duplicate, and mixed-artifact rejection.
- Prove atomic activation and immediate whole-release rollback in an isolated
  environment while Svelte remains canonical in production.

The wallet now owns one deterministic `wallet-pwa-static` input containing the
touch icon, both Android icons, manifest, push-wake service worker, and route
mode bootstrap. Exact asset routes keep those files with the wallet surface;
the React wallet entry consumes its icons, manifest, and route mode without
embedding executable code. Focused ownership, copy, assembly, CSP, and gateway
tests pass, and the current four-app candidate assembles as
`sha256-40f02e7074a7a3965faa04ff09baf7464d9deadd1539296c41379dbdc8480cc2`
with 333 files. This captures inputs only: canonical Svelte activation,
service-worker registration, native packaging, deployment, and cutover remain
unchanged.

The candidate now has a fail-closed consumer verifier that reads only the
assembled directory and requires the current schema, exact application and
edge-route topology, canonical manifest bytes and path ordering, matching
directory/release identity, a complete regular-file set, and exact SHA-256 and
size metadata. It rejects unsafe or duplicate paths, missing/extra/mixed files,
symlinks, and copied manifests under the wrong identity. A real prepare, build,
assemble, and CLI verification passes for the 333-file candidate above. The
assembler also uses the repository's locale-independent text comparator, with
mixed-case chunk-name regression coverage. No consumer activation or canonical
output changed in this slice.

Verification evidence is 19 / 19 focused assembly, verifier, and inventory
tests (131 expectations), all four React local checks with 634 files and zero
unsafe-type findings, and a successful self-contained verification of the real
333-file directory. The complete frontend suite remains at its exact known
13-name baseline (1,230 passes, 14 reported failures, 6,796 expectations across
1,244 tests / 202 files); the three apparent localhost failures from the first
restricted run pass 6 / 6 when ephemeral loopback listeners are available. The
canonical frontend check reports zero Svelte errors/warnings and builds 4,671
SSR plus 6,422 client modules. The repository gate passes 26 deterministic
tests / 100,156 expectations, compiles 28 Solidity files, publishes 92 TypeChain
files, confirms four-contract immutable metadata parity, and passes all ten
soundchecks before the established missing-`cargo` environment stop. Frozen
core is unchanged. File-size policy still reports only the known
`core/qa/report.ts` 3,001 / 3,000 overage; both new handwritten files are below
300 lines.

The first native consumer now accepts only an independently verified whole
candidate and materializes a content-addressed wallet web root under that exact
release identity. It selects the wallet application entry, Vite manifest,
`assets/wallet/**`, and only generated inputs whose manifest owner is `wallet`;
site, docs, and ops application/input files are absent. The stage is written in
a private temporary directory, verified by canonical manifest, exact file set,
SHA-256, and size, then renamed into place. An exact existing stage is reused;
corrupt existing bytes, source corruption, extra files, symlinks, unsafe paths,
or plan drift fail loudly and are never repaired or overwritten.

The root `native:candidate:stage` command created and then reused a 51-file
wallet stage from the verified 333-file
`sha256-40f02e7074a7a3965faa04ff09baf7464d9deadd1539296c41379dbdc8480cc2`
candidate. Focused native staging, build-option, Capacitor configuration, and
inventory coverage passes 19 / 19 with 154 expectations. The canonical
`frontend/build`, Capacitor `webDir=build`, `localhost` storage origin, Android
security settings, and both `xln` deep-link declarations remain unchanged; no
Capacitor sync or native shell write ran. All ten soundchecks and four script
entrypoint tests (509 expectations) pass, and dead-code analysis passes with its
existing Dockview hint. The full frontend suite remains at the exact known
13-name baseline (1,230 passes, 14 reported failures, 6,796 expectations).
The broader native suite exposes three unrelated existing watchtower/Runtime
fixture failures: one oversized Runtime machine-graph recovery row and two
non-Map Account `.set` calls. This frontend-native slice does not change those
Runtime, Account, watchtower, or storage paths. At that checkpoint native
candidate CSP parity was not yet claimed and remained the next explicit gate.

Native candidate CSP parity and isolated Capacitor consumption are now explicit.
One canonical directive map feeds SvelteKit hash-mode CSP and the React wallet's
production HTML; the native verifier requires exactly one byte-canonical CSP
meta tag and rejects inline scripts. The `native:candidate:capacitor:smoke`
command creates a content-addressed two-file Capacitor workspace beside the
verified wallet stage, inherits the canonical app/security configuration, and
points `webDir` at that exact release. Capacitor 8's real `copy web` path then
loads the isolated configuration and validates the web root without an iOS or
Android project directory, so it cannot mutate either checked-in native shell.
Exact workspaces are reused; corrupt config, manifest drift, extra files,
missing/mismatched CSP, inline scripts, symlinks, and candidate corruption fail
loudly without repair.

A real four-app candidate now verifies as
`sha256-ea173909e635649b5f4ed9eee848015f82d4db7a47ef22730c5ae6a7f3275e3a`
with 333 files, stages 51 wallet files, and passes the Capacitor smoke twice
(`created`, then `reused`). Focused CSP, candidate, Capacitor, native config,
build-option, and inventory coverage passes 34 / 34 with 313 expectations. All
four React local checks pass with 635 files and zero unsafe findings; canonical
Svelte remains at zero errors/warnings and builds 4,671 SSR plus 6,422 client
modules. The real browser loads the staged wallet with zero console errors or
warnings and all 5 / 5 static requests at HTTP 200. The full frontend suite is
back at the exact known 13-name baseline; the two new CSP tests pass in addition
to that baseline. Canonical `frontend/build`, iOS, Android, `webDir=build`,
`localhost`, and both `xln` deep-link declarations remain unchanged. No iOS or
Android copy/sync, package, signing, activation, deployment, or cutover ran.

Capacitor now copies the verified wallet into disposable replicas of both
checked-in native shells. Replica identity binds the full wallet release, the
canonical iOS and Android shell digests, and the generated configuration hash;
the entire 188-file result is then recorded and verified by path, SHA-256, size,
and mode. Verification independently proves each 54-file native web root is the
52-file staged candidate plus only Capacitor's two empty Cordova shims, checks
the generated configuration and ten iOS plugin classes, preserves every
non-generated shell byte, and reasserts `localhost` plus both `xln` deep links.
Exact replicas are reused, while byte corruption, extra files, symlinks, source
shell drift, or manifest drift fails without repair.

The root `native:candidate:capacitor:copy` command created and then reused
workspace
`sha256-60d3164c3fde1062c328e9732a306be6f42673f5827b4772c5b6a21100020497`
from the real `sha256-ea173909e635649b5f4ed9eee848015f82d4db7a47ef22730c5ae6a7f3275e3a`
release. Focused native/CSP/config/inventory coverage passes 37 / 37 with 330
expectations; all four React checks pass with 635 files and zero unsafe
findings, all 513 entrypoint expectations pass, and dead-code analysis retains
only its existing Dockview hint. The broad native suite reaches only the same
three unrelated watchtower/Runtime fixture failures already recorded above.
The canonical shell trees have zero diff. This is Capacitor `copy` evidence in
isolated replicas only: dependency sync, IDE open, compilation, package,
signing, activation, deployment, and production cutover remain untouched.

The verified release now also has an isolated real-browser PWA lifecycle
consumer. Its generated Service Worker is byte-bound to one release, uses the
fixed root scope, names its cache `xln-react-candidate:<releaseId>`, and
pre-caches all 333 declared files plus the canonical release manifest from
immutable release-qualified URLs. Install validates SHA-256 and size before
activation; an incomplete install deletes only its partial candidate cache and
cannot replace the active worker. Previous complete content-addressed caches
remain available for immediate rollback, and fetches expose the exact serving
release identity without mixing paths or falling through for wallet-owned
routes.

Chromium exercised one registration through install
`sha256-ea173909e635649b5f4ed9eee848015f82d4db7a47ef22730c5ae6a7f3275e3a`,
an offline-rejected update, successful update
`sha256-7547d498beafd9f139b00030e006a28626691388f2bda277e43710ede88b6f66`,
and offline rollback to the original release. Both caches contain exactly 334
verified files; the controller, response identity, and wallet entry hash match
at every accepted phase, with zero page errors or console warnings/errors.
The affected release/PWA/ownership batch passes 54 / 54 with 455 expectations,
all four React local checks pass with 637 files and zero unsafe findings, and
all 513 entrypoint expectations pass. The full frontend suite remains at the
exact 13-name baseline (1,235 passes, 14 reported failures, 6,828 expectations
across 1,249 tests / 204 files). Canonical `push-wake-sw.js`, Svelte service-
worker registration, deployment, and production activation are unchanged.

Desktop and browser-extension consumers now accept the same independently
verified wallet stage in a disposable, content-addressed workspace. The desktop
replica contains the exact canonical Electron shell, generated package manifest,
and all 52 staged files. The extension replica maps the wallet entry to
`app.html`, preserves wallet assets, replaces the Vite manifest with the exact
Manifest V3 shell manifest, and derives `icon-128.png` from the staged wallet
icon. It excludes candidate metadata from the extension payload.

Workspace identity binds the release, complete desktop and extension shell
digests, package bytes, and the canonical 111-file layout (57 desktop, 54
extension), including SHA-256, size, and mode. Verification reasserts the wallet
CSP, Manifest V3 permissions/CSP/external origins, Electron isolation, and both
shells' `xln` deep-link ownership. Existing exact bytes are reused; corruption,
extra files, symlinks, missing icons, manifest drift, or weakened policy fail
loudly without repair. Canonical shells and source stage stay byte-identical.

The root `native:candidate:packaged:copy` command created and reused workspace
`sha256-0e309f6db3508c9a953be65091c335046a454513fe2c8f90c60f043aa5469660`
from release
`sha256-ea173909e635649b5f4ed9eee848015f82d4db7a47ef22730c5ae6a7f3275e3a`.
Focused native, shell-policy, configuration, and inventory coverage passes 48 /
48 with 441 expectations. All four React local checks pass with 637 files and
zero unsafe findings; canonical Svelte remains at zero errors/warnings and
builds 4,671 SSR plus 6,422 client modules. Chromium renders the copied
extension entry with zero console warnings/errors and 7 / 7 static requests at
HTTP 200. The full frontend suite remains at the exact 13-name baseline (1,235
passes, 14 reported failures, 6,829 expectations across 1,249 tests / 204
files). All four entrypoint tests pass with 515 expectations, and dead-code
analysis retains only its existing Dockview hint. The repository gate passes 26
deterministic tests / 100,156 expectations, compiles 28 Solidity files,
publishes 92 TypeChain files, confirms four-contract immutable metadata parity,
and passes all ten soundchecks before the established missing-`cargo`
environment stop. File-size policy still reports only the known
`core/qa/report.ts` 3,001 / 3,000 overage. No Electron launch, extension install,
package, signature, activation, deployment, canonical shell write, or
production cutover ran.

Deployment selection now has its own isolated consumer rather than changing the
canonical production script. It copies only independently verified complete
releases into an immutable store, rejects a duplicate active selection, and
publishes one canonical active/rollback state file under an exclusive lock via
write, file fsync, atomic rename, and directory fsync. Activation verifies the
current release before retaining it as rollback; rollback verifies both releases
and swaps the whole-release identities in one state replacement.

The real browser harness built and staged two 334-file releases:
`sha256-ea173909e635649b5f4ed9eee848015f82d4db7a47ef22730c5ae6a7f3275e3a`
and
`sha256-76016a7271fb23d0c050739d001c48071989d75b887300355568d3766e30c554`.
Chromium rejected a corrupt release without changing selection, activated the
update, rejected duplicate activation, then rolled back to the original at one
origin. Wallet/docs response headers and entry hashes matched the selected
release throughout, with zero page/console failures. The state-focused unit
suite passes 4 / 4 with 25 expectations; the affected release/inventory batch
passes 22 / 22 with 332 expectations.

All four React local checks pass with 640 files and zero unsafe findings;
canonical Svelte remains at zero errors/warnings and builds 4,671 SSR plus 6,422
client modules. The full frontend suite remains at the exact 13-name baseline
(1,239 passes, 14 reported failures, 6,858 expectations across 1,253 tests / 205
files). All four entrypoint tests pass with 517 expectations, and dead-code
analysis retains only its existing Dockview hint. Canonical
`scripts/deployment/deploy-platform.sh`, `frontend/build`, service wiring, and
production remain unchanged; those release consumers are explicitly retained
under owner-authorized WP10 cutover. The repository gate passes 26 deterministic
tests / 100,156 expectations, compiles 28 Solidity files, publishes 92
TypeChain files, confirms four-contract immutable metadata parity, and passes
all ten soundchecks before the established missing-`cargo` environment stop.
File-size policy still reports only the known `core/qa/report.ts` 3,001 / 3,000
overage; every new handwritten file is below 300 lines.

**Done:** all consumers use one candidate release identity and isolated smoke
tests can activate, reject invalid candidates, and roll back.

### WP9 — Close parity and prepare cutover

**Status:** `IN PROGRESS — 19 COMPLETE / 1 PARTIAL IMPLEMENTATION; 19 COVERED / 1 PARTIAL BROWSER ROUTE; 1 AUTHORIZED IMPLEMENTATION GAP`

- Confirm all retained routes and capabilities have React owners and tests.
- Run all-frontend checks and representative browser flows at required
  viewports.
- Resolve genuine parity gaps; do not narrow baseline assertions.
- Produce a cutover checklist covering canonical commands, artifact consumers,
  Svelte dependencies/source, rollback, and release evidence.

The deterministic `frontend:parity:audit` command now accounts for all 20
retained Svelte page routes and all 12 capability groups. Sixteen routes have a
complete React implementation; `/app`, `/address`, `/address/:entityId`, and
`/embed` are partial; no retained route is missing a React owner. Sixteen routes
have covered candidate-browser evidence and four have partial evidence. The
capability ledger remains truthful at three implemented, eight in progress,
and one unstarted.

`/qa/quorum` is now owned by the React ops candidate. A framework-neutral pure
model projects the versioned audit registry, current verified history, filters,
score summaries, explicit review chains, and selected evidence for both React
and the retained Svelte route. The registry boundary rejects malformed required
fields, unsupported versions, duplicate IDs, unknown reviewers, invalid scores,
and invalid run dates instead of inventing fallback evidence. Six typed gaps
remain; `/embed` stays behind the explicit Entity-workspace owner decision and
canonical command/routing, artifact-consumer, and Svelte retirement work stays
WP10-only.

The quorum-focused and ownership batch passes 29 / 29 with 641 expectations.
All four React local checks pass with 650 files and zero unsafe findings; the
canonical Svelte check remains at zero errors/warnings and builds 4,674 SSR plus
6,425 client modules. The React candidate browser gate passes 30 / 30 across
mobile, laptop, and wide viewports; all three quorum screenshots were inspected,
including a corrected stacked mobile leaderboard. The isolated ops production
build transforms 1,614 modules; the lazy quorum chunk is 144.08 kB / 28.30 kB
gzip. The full frontend suite
preserves the exact known 13-name baseline with 1,249 passes, 14 reported
failures, one error, and 7,185 expectations across 1,263 tests / 207 files.
File-size policy still reports only `core/qa/report.ts` at 3,001 / 3,000 lines;
every new handwritten file is below 150 lines. The repository gate passes 26
deterministic tests / 100,156 expectations, compiles 28 Solidity files,
publishes 92 TypeChain files, confirms immutable metadata parity for four
contracts, and passes all ten soundchecks before the established missing-`cargo`
environment stop.

Direct same-origin failure-state evidence now covers `/health`, `/qa`, and
`/qa/hlt` without network interception or response mocks. The focused parity
and route batch passes 19 / 19 with 496 expectations. The first nine-case
browser run reproduced a mobile HLT overflow caused by the long proxy error;
the alert now wraps and stacks its action below the message. The corrected
matrix passes 9 / 9 across mobile, laptop, and wide viewports, with all nine
screenshots inspected, zero page errors, and only the expected surfaced HTTP
502 console failures. The complete candidate browser matrix passes 39 / 39.
The isolated ops production build transforms 1,614 modules. The full frontend
suite preserves the same known 13-name baseline with 1,249 passes, 14 reported
failures, one error, and 7,177 expectations across 1,263 tests / 207 files; the
canonical frontend check remains at zero errors/warnings and builds 4,674 SSR
plus 6,425 client modules. The repository gate repeats the 26-test, contract,
immutable-metadata, and ten-soundcheck evidence above before the established
missing-`cargo` stop. File-size policy still reports only `core/qa/report.ts`
at 3,001 / 3,000 lines.

Direct route evidence now covers all six secondary site pages. The focused
site and parity batch passes 27 / 27 with 431 expectations. The 18-case browser
matrix verifies the pinned install command, the deterministic RCPAN settlement
waterfall, signed release code-root evidence, synchronized review selection,
the 1,000 TPS unicast state, and the real market-feed failure across mobile,
laptop, and wide viewports. All 18 screenshots were inspected. That review
found and corrected a contradictory market hero that claimed `FEED VERIFIED`
while the relay request had failed; loading, verified, and unavailable status
now derive from the same feed state, and the unavailable state is visibly
amber. The only browser console errors are the expected surfaced market HTTP
502 failures. The complete candidate browser matrix passes 57 / 57. The
isolated site production build transforms 401 modules in 778 ms and emits the
route-specific review, market-cap, and release chunks. All four React surfaces
pass the local integration gate with 650 files and zero unsafe findings. The
canonical frontend check remains at zero errors/warnings and builds 4,674 SSR
plus 6,425 client modules. The full frontend suite preserves the same known
13-name baseline with 1,249 passes, 14 reported failures, one error, and 7,167
expectations across 1,263 tests / 207 files. The repository gate repeats 26
deterministic tests / 100,156 expectations, 28 Solidity files, 92 TypeChain
files, four immutable metadata checks, and all ten soundchecks before the
established missing-`cargo` environment stop. File-size policy still reports
only `core/qa/report.ts` at 3,001 / 3,000 lines; both new browser evidence files
are below 60 lines.

Candidate browser preparation and execution are now independently scoped per
surface. `test:react:site`, `test:react:docs`, `test:react:wallet`, and
`test:react:ops` start only the selected Vite root plus the same-origin gateway;
the full command remains an explicit four-surface mode. Generated release
catalog and Runtime bundle inputs declare their real development consumers, so
site `/releases` and ops `/scenarios` keep their public URLs without launching
the docs or wallet applications. Production input ownership, assembly, and the
canonical Svelte route remain unchanged. The four isolated browser runs pass
21 / 21, 3 / 3, 6 / 6, and 30 / 30 respectively, and the complete candidate
matrix passes 63 / 63. Six new direct `/app` and isolated `/scenarios`
screenshots were inspected across 390×844, 1366×900, and 1920×1080; there are
zero page errors, console errors, or horizontal-overflow failures. The focused
tooling batch passes 45 / 45 with 498 expectations. All four React surfaces
pass the local integration gate with 651 files and zero unsafe findings; the
canonical frontend check remains at zero errors/warnings and builds 4,674 SSR
plus 6,425 client modules. Production builds transform 401 site, 35 docs, 1,669
wallet, and 1,614 ops modules. The full frontend suite preserves the exact known
13-name baseline with 1,254 passes, 14 reported failures, one error, and 7,129
expectations across 1,268 tests / 208 files. The repository gate repeats 26
deterministic tests / 100,156 expectations, 28 Solidity files, 92 TypeChain
files, four immutable metadata checks, and all ten soundchecks before the
established missing-`cargo` environment stop. File-size policy still reports
only `core/qa/report.ts` at 3,001 / 3,000 lines; every new handwritten file is
below 150 lines.

The React wallet now owns `/address` and `/address/:entityId` without changing
canonical Svelte routing. Strict pure decoders validate directory and detail
projections, preserve Runtime affinity, sort hubs deterministically, reject
malformed or duplicate Entity evidence, and reuse the certified activity
decoder. The read source stays behind the existing selected-Runtime adapter,
refreshes at committed heights, releases its adapter boundary, surfaces detail
and history failures separately, and refuses to fake a cross-Runtime detail
read. The polished directory and explicit not-found states pass 12 / 12 wallet
browser cases across 390x844, 1366x900, and 1920x1080; all six new screenshots
were inspected with zero page, console, or overflow failures. The focused
address/parity batch passes 17 / 17 with 385 expectations, the wallet local gate
checks 654 files with zero unsafe findings, and the isolated production build
transforms 1,674 modules with a 32.02 kB / 12.76 kB gzip address chunk. The full
frontend suite preserves the exact 13-name baseline with 1,259 passes, 14
reported failures, one error, and 7,174 expectations across 1,273 tests / 209
files. The repository gate passes 26 deterministic tests / 100,156
expectations, compiles 28 Solidity files, publishes 92 TypeChain files,
confirms immutable metadata parity for four contracts, and passes all ten
soundchecks before the established missing-`cargo` environment stop. Production
function size passes across 1,047 files; file-size policy reports only the known
`core/qa/report.ts` 3,001 / 3,000 overage.

The wallet address surface now resolves imported Runtime affinity before it
connects. The canonical stored-import registry lives in `packages/browser`,
with the legacy Svelte utility retained as a thin facade. A connected Runtime
must exactly match the requested Runtime before the tab token and durable
endpoint are updated; absent or stale imports leave the previous session
untouched and surface a visible error. A real isolated Runtime browser fixture
commits a lazily created Entity and `profile-update`, then serves the production
Runtime adapter protocol without request interception or projection mocks.
The resulting populated directory, detail, and committed-history flow passes
15 / 15 browser cases across 390x844, 1366x900, and 1920x1080. All nine new
screenshots were inspected with zero page, console, clipping, or overflow
failures. The affected test batch passes 61 / 61 with 735 expectations; local
checks cover 656 files with zero unsafe findings; and the wallet build
transforms 1,679 modules while holding the address chunk at 32.02 kB / 12.76 kB
gzip. The full frontend suite preserves the exact known 13-name baseline with
1,261 passes, 14 reported failures, one error, and 7,178 expectations across
1,275 tests / 209 files. The repository gate repeats 26 deterministic tests /
100,156 expectations, compiles 28 Solidity files, publishes 92 TypeChain files,
confirms immutable metadata parity for four contracts, and passes all ten
soundchecks before the established missing-`cargo` environment stop. Parity is
now 18 complete and covered routes, two partial routes (`/app` and `/embed`),
and five exact gaps.

The `/app` identity surface now has full browser-depth evidence for its safe
mnemonic recovery rehearsal without crossing into identity creation or
persistence. The scenario waits for the real local Runtime, rejects a
checksum-invalid phrase, derives the canonical public address, rejects a second
valid phrase that resolves to another wallet, accepts the matching phrase, and
proves neither phrase entered local or session storage. Screenshot review found
that the secondary review action could sit behind mobile navigation; the
responsive action layout now keeps both review controls in the viewport. The
focused identity/recovery batch passes 17 / 17 with 53 expectations. The new
browser flow passes 3 / 3 and the complete wallet matrix passes 18 / 18 across
390x844, 1366x900, and 1920x1080; all nine new screenshots were inspected with
zero page, console, clipping, or overflow failures. All four React surfaces
pass the local integration gate with 656 files and zero unsafe findings, and
the wallet production build transforms 1,679 modules. The canonical frontend
check remains at zero errors/warnings and builds 4,675 SSR plus 6,426 client
modules. The full frontend suite preserves the exact known 13-name baseline
with 1,261 passes, 14 reported failures, one error, and 7,177 expectations
across 1,275 tests / 209 files. The repository gate repeats 26 deterministic
tests / 100,156 expectations, 28 Solidity files, 92 TypeChain files, four
immutable metadata checks, and all ten soundchecks before the established
missing-`cargo` environment stop.

The portfolio and financial-health views now have durable browser-depth
evidence against one isolated, persisted Runtime. The fixture registers two
deterministic local signer keys, imports two lazy Entities through WAL-backed
Runtime inputs, commits both profiles, opens one canonical bilateral Account,
and extends 250 USDC of credit in both directions. It uses the production
Runtime adapter and contains no request interception, projection mock, direct
state mutation, or UI-side Runtime input. The resulting views expose two
Entities, two Account views, three canonical token lanes, bilateral credit and
capacity, unchecked Depository evidence, Account lifecycle state, and
persisted activity. Screenshot review caught a clipped four-column asset table
at 390px; the mobile layout now presents those values as an explicit two-column
facts grid. The focused projection/audit batch passes 13 / 13 with 184
expectations, and the new browser flow passes 6 / 6 while the complete wallet
matrix passes 24 / 24 across 390x844, 1366x900, and 1920x1080 with zero page or
console errors. All six final finance screenshots were inspected with no
remaining clipping or overflow. All four React surfaces pass the local gate
across 656 files with zero unsafe findings, and the wallet build transforms
1,679 modules. The canonical frontend check remains at zero errors/warnings
and builds 4,675 SSR plus 6,426 client modules. The full frontend suite keeps
the exact known 13-name baseline with 1,261 passes, 14 reported failures, one
error, and 7,184 expectations across 1,275 tests / 209 files. The repository
gate passes 26 deterministic tests / 100,156 expectations; a transient
Hardhat compiler-cache mutex stopped its first contract-sync attempt, while
the focused retry compiled 28 Solidity files, published 92 TypeChain files,
and confirmed four immutable metadata checks. All ten soundchecks pass before
the established missing-`cargo` environment stop. Production function size
passes across 1,047 files; file-size policy reports only the known
`core/qa/report.ts` 3,001 / 3,000 overage.

Payment and market browser depth now runs against the same isolated committed
Runtime. The fixture certifies and publishes both local profiles through a
process-local P2P instance, enables the counterparty with canonical
`setHubConfig` and `initOrderbookExt` transactions, and places one real resting
order through `placeSwapOffer`; it never mutates Entity or Account state
directly. The payment flow proves a Runtime-owned one-hop direct quote without
submitting it, canonical invoice and QR generation, and all Account-operation
choices. The market flow reads the committed USDC/WETH book, hub fee, live
maker-owned order, empty cross-j lifecycle, and persisted activity. The focused
source and browser-scope batch passes 15 / 15 with 74 expectations, and the
complete wallet matrix passes 30 / 30 in 30.8 seconds across 390×844, 1366×900,
and 1920×1080 with zero page errors, console errors, or horizontal overflow.
All 15 new screenshots were inspected. The `wallet-app-browser-depth` gap is
closed: browser parity is now 19 covered / 1 partial route, while implementation
parity remains 18 complete / 2 partial and four exact gaps remain. All four
React surfaces pass the local gate across 656 files with zero unsafe findings,
and the wallet production build transforms 1,679 modules. The canonical
frontend check remains at zero errors/warnings and builds 4,675 SSR plus 6,426
client modules. The full 209-file frontend suite keeps the exact known 13-name
baseline with 1,261 passes, 14 reported failures, one error, and 7,172
expectations across 1,275 tests. Pre-push root evidence passes 26 deterministic
tests / 100,156 expectations and all ten soundchecks. Contract synchronization
is host-blocked by the existing Hardhat compiler-cache mutex after the required
root attempt and one focused retry; Rust checks remain unavailable because
`cargo` is not installed. Production function size passes across 1,047 files,
while file-size policy reports only the known out-of-scope `core/qa/report.ts`
3,001 / 3,000 overage.

Canonical local-unlock and Runtime-creation execution now lives behind the
framework-neutral `wallet-runtime-opening` boundary. The executor owns the
conditional existing-Runtime lookup, the already-reviewed opening plan, and
the single unlock-or-create effect choice; it imports neither Svelte nor the
Runtime/protocol implementation. `RuntimeCreation.svelte` supplies the existing
`vaultOperations` effects and retains recovery discovery, sensitive-material
cleanup, navigation, diagnostics, and failure publication. The complete
onboarding suite passes 177 / 177 with 704 expectations, and the wallet local
gate covers 656 files with zero unsafe findings. This nonvisual extraction
changes no markup, copy, styling, or user interaction, so screenshot evidence
is not required. The irreversible-identity gap remains open until React invokes
this shared executor through the canonical vault adapter. The authoritative
frontend baseline remains exact at 1,261 pass / 14 fail / 1 error across 1,275
tests; all 14 failures are the previously recorded unrelated baseline. Root
verification passed 26 / 26 BrainVault/runtime tests with 100,156 expectations
and all 10 soundchecks, then reproduced only the shared Hardhat compiler-cache
mutex, missing local `cargo`, and known `core/qa/report.ts` 3,001 / 3,000
file-size environment/baseline stops.

The canonical Svelte Runtime-creation flow now consumes a dedicated vault
adapter instead of binding `vaultOperations` at the component boundary. The
adapter is the single concrete bridge from the framework-neutral opening
executor to existing Runtime lookup, unlock, creation, and persistence; the
Svelte view retains recovery authorization, secret cleanup, navigation, and
error publication. This is a nonvisual dependency extraction with no user-
visible behavior change. React can dynamically load the same adapter next,
but only after its recovery-discovery flow has authorized local unlock or
fresh creation. The onboarding suite passes 177 / 177 with 707 expectations,
the all-surface local gate covers 657 files with zero unsafe findings, and the
authoritative frontend baseline remains exact at 1,261 pass / 14 fail / 1
error with 7,181 expectations across 1,275 tests. Root evidence again passes
26 / 26 BrainVault/runtime tests and all 10 soundchecks before the same shared
Hardhat mutex, missing local `cargo`, and known 3,001 / 3,000 file-size stops.

React mnemonic identity now crosses the irreversible boundary only after the
second seed entry reproduces the expected public address and canonical recovery
discovery reports zero backups. An inventoried migration bridge outside the
React application roots dynamically loads the same vault adapter used by
Svelte, preserving the rule that React sources do not import the legacy
`src/lib` tree. It opens or unlocks through the shared Runtime-opening executor,
persists the canonical vault state, and restores that state on later React
boots. Discovery results remain loud and block fresh creation whenever a backup
exists; React recovery-candidate selection is the next slice. Opening
replaces the ambient embedded Runtime under its existing active-tab lease. If
the canonical boot fails, the session transactionally restores the ambient
Runtime before returning the original inline error, so the verified screen is
not unmounted and secrets remain cleared. The focused opening/session batch
passes 27 / 27 with 113 expectations, and the complete onboarding directory
passes 178 / 178 with 730 expectations. The wallet local gate covers 658 files
with zero unsafe findings, and the production wallet build transforms 1,798
modules. The canonical frontend gate remains at zero errors/warnings and builds
4,677 SSR plus 6,428 client modules. The full 209-file suite preserves the exact
14 known failures with 1,264 passes, one error, and 7,230 expectations across
1,278 tests; its loopback server checks pass 6 / 6 outside the filesystem
sandbox. Browser evidence at 390×844, 1366×900, and 1920×1080 confirms the
verified consent state without horizontal overflow. The isolated real-backend
boundary intentionally had no API process; its HTTP 502 reproduced and then
proved the retained, fail-loud error state with the ambient Runtime restored.
Root evidence passes 26 / 26 BrainVault/runtime tests with 100,156 expectations
and all ten soundchecks before the same shared Hardhat compiler-cache mutex,
missing local `cargo`, and known `core/qa/report.ts` 3,001 / 3,000 file-size
stops.

React mnemonic recovery now renders every canonical tower/peer candidate as a
display-safe summary, blocks fresh creation while candidates exist, and passes
only the selected full candidate back to the canonical vault executor. The
decrypted candidates remain transient inside the migration bridge; an exact-
once generation token binds selection to one Runtime and is invalidated by
consumption, reset, unmount, a newer discovery, or replacement failure. No
candidate, token, or recovery metadata is added to durable Runtime state. A
real browser fixture creates a signed height-1 Runtime snapshot through an
authorized Runtime-adapter command, encrypts it, uploads it to the production
standalone watchtower implementation, and proves discovery, selection,
decryption, persistence, and restore at 390×844, 1366×900, and 1920×1080. The
focused recovery/session batch passes 34 / 34 with 276 expectations, the full
onboarding directory passes 182 / 182 with 747 expectations, and the complete
wallet browser matrix passes 33 / 33 in 44.7 seconds. All candidate/opened
screenshots were inspected with no clipping or horizontal overflow. The
authoritative 210-file frontend suite preserves the exact 14 known failures
with 1,268 passes, one error, and 7,250 expectations across 1,282 tests. The
wallet-local gate scans 659 files with zero unsafe-type findings, the production
wallet build transforms 1,799 modules in 1.92 seconds, and the canonical
frontend gate has zero errors/warnings while building 4,677 SSR and 6,428
client modules. Root evidence passes 26 / 26 BrainVault/runtime tests with
100,156 expectations before the documented shared Hardhat compiler-cache mutex
stops contract-artifact drift after 60 seconds; this slice changes no contract
source or artifact. The irreversible-identity gap remains partial only for
React Brain Vault derivation; the typed inventory still reports four exact
gaps.

React Brain Vault now derives through the versioned canonical WebAssembly
worker and the shared validation, scheduling, resilience, and finalization
boundaries. Derived mnemonics and the device passphrase remain inside a
bridge-owned exact-once material session; React receives only progress, the
public Runtime address, recovery summaries, and opaque generation tokens. The
passphrase field is cleared before the asynchronous derivation completes, and
cancel, unmount, replacement, stale generations, or opening failure invalidate
both material and recovery sessions. The real browser flow reproduces the
frozen factor-1 Runtime address, discovers its signed height-1 snapshot on the
production standalone watchtower implementation, and restores it through the
canonical vault executor at 390×844, 1366×900, and 1920×1080. That flow passes
3 / 3 in 14.3 seconds and the complete wallet browser matrix passes 36 / 36 in
58.4 seconds; all deriving, candidate, and opened screenshots were inspected
without clipping or horizontal overflow. The full onboarding batch passes 189
/ 189 with 781 expectations, and the four typed inventory audits pass 21 / 21
with 643 expectations. The authoritative 212-file frontend suite preserves the
exact 14 known failures with 1,275 passes, one error, and 7,287 expectations
across 1,289 tests. The wallet-local gate scans 663 files with zero unsafe-type
findings, the production wallet build completes in 1.98 seconds, and the
canonical frontend gate has zero errors/warnings while building 4,677 SSR plus
6,428 client modules. Root evidence passes 26 / 26 BrainVault/runtime tests
with 100,156 expectations before the documented shared Hardhat compiler-cache
mutex stops contract-artifact drift after 60 seconds; this slice changes no
contract source or artifact. The irreversible-identity gap is closed; the typed
inventory now reports three exact gaps.

React identity recovery now imports canonical encrypted Runtime backup files
for both verified mnemonic and Brain Vault identities. File parsing,
decryption, full candidates, and derived Brain Vault seed material stay inside
the migration bridge; React receives only display-safe summaries and the exact
selected candidate id. The bridge validates the active recovery token and the
seed-derived Runtime id before atomically merging a file candidate. Reset,
unmount, or a newer import generation invalidates in-flight discovery and
prevents stale publication. The real browser fixture serializes genuine signed
height-1 encrypted Runtime bundles, proves malformed JSON is rejected loudly,
imports and restores the Brain Vault file, and imports a mnemonic file before
deliberately reselecting and restoring its tower backup. The focused
session/bridge batch passes 17 / 17 with 70 expectations, the full onboarding
batch passes 196 / 196 with 812 expectations, and the four typed inventory
audits pass 21 / 21 with 656 expectations. The complete wallet browser matrix
passes 36 / 36 in 1.0 minute across 390×844, 1366×900, and 1920×1080; all
changed error and candidate screenshots were inspected without clipping or
horizontal overflow. The authoritative 213-file frontend suite preserves the
exact 14 known failures with 1,282 passes, one error, and 7,331 expectations
across 1,296 tests. The wallet-local and canonical gates scan 664 files with
zero unsafe-type findings and zero errors/warnings, the production wallet
build completes in 2.08 seconds, and the canonical build transforms 4,677 SSR
plus 6,428 client modules. Root evidence passes 26 / 26 BrainVault/runtime
tests with 100,156 expectations before the documented shared Hardhat
compiler-cache mutex stops contract-artifact drift after 60 seconds; this
slice changes no contract source or artifact. The recovery capability moves
from unstarted to in progress; recovery-service enrollment and push wake are
the next slice while the typed inventory remains at three exact gaps.

React identity completion and Wallet Settings now provide canonical recovery-
service onboarding. React owns only public mode and service drafts; a dedicated
migration bridge resolves the official tower, validates every URL and role,
binds preview/save calls to the exact active Runtime id, checks the live vault
authority lease, and persists through the existing
`vaultOperations.updateRuntimeRecovery` path. The shared recovery utility now
owns mode inference for both frameworks, preventing Svelte/React drift without
changing the persisted recovery schema. The real signed-backup browser path
restores a Runtime, rejects an invalid service URL, selects backup-only mode,
adds a last-resort manual service, saves it, and proves the exact normalized
configuration reached canonical vault storage. Focused recovery, shell, and
inventory evidence passes 45 / 45 with 748 expectations. The targeted browser
flow passes 3 / 3 in 19.3 seconds and the complete wallet matrix passes 36 / 36
in 1.1 minutes across 390×844, 1366×900, and 1920×1080; every saved-state
screenshot was inspected with no clipping or horizontal overflow. The
authoritative 214-file frontend suite reports 1,282 passes, 17 known or
environmental failures, one error, and 7,337 expectations across 1,299 tests:
the prior 14-failure baseline remains, while two development-gateway tests and
the QA cache test independently reproduce `EADDRINUSE` because this host cannot
allocate their ephemeral test ports. No new recovery-service test fails. The
wallet-local gate scans 667 files with zero unsafe-type findings, the production
wallet build transforms 1,814 modules in 2.13 seconds, and the canonical
frontend gate has zero errors/warnings while transforming 4,677 SSR plus 6,428
client modules. Root evidence again passes 26 / 26 BrainVault/runtime tests with
100,156 expectations before the documented 60-second Hardhat compiler-cache
mutex; downstream soundcheck passes all ten gates before the documented missing
local `cargo`, and file-size checking reaches only the existing
`core/qa/report.ts` 3001/3000 violation. This slice changes no Runtime protocol,
contract, persistence schema, or artifact. Push-wake controls are next; the
typed inventory remains at three exact gaps.

React Wallet Settings now provides canonical device push-wake registration and
disable controls beside the saved recovery-service configuration. React owns
only redacted Runtime, Entity, service, platform, and status projections; the
migration bridge keeps raw device tokens, owner signatures, live Runtime state,
and watchtower requests outside React. Each operation binds the unchanged
Runtime, Entity, authority lease, and recovery-service set across asynchronous
token/signing boundaries, surfaces partial failures loudly, and persists only
the token hash after server acceptance. Native Capacitor dependencies are
loaded only after the desktop provider declines, preventing runtime dependency
rediscovery and keeping the desktop path split. The real browser fixture
restores an Entity-bearing signed Runtime backup, serves BrowserVM's canonical
block hashes, receipt roots, blooms, receipts, and logs through an isolated RPC
boundary, and proves signed register, redacted local status, health count, and
signed unregister against the production standalone watchtower. That flow
passes 3 / 3 in 20.1 seconds and the complete wallet matrix passes 36 / 36 in
1.1 minutes across 390×844, 1366×900, and 1920×1080; every registered-state
screenshot was inspected without clipping or horizontal overflow. The focused
push-wake/inventory batch passes 15 / 15 with 150 expectations and the four
typed inventories pass 21 / 21 with 667 expectations. The authoritative
215-file frontend suite improves the previous 17-failure baseline to 1,286
passes, 16 known or environmental failures, one error, and 7,366 expectations
across 1,302 tests. The wallet-local gate scans 670 files with zero unsafe-type
findings, the production wallet build transforms 1,847 modules in 2.09 seconds,
and the canonical frontend gate has zero errors/warnings while transforming
4,677 SSR plus 6,428 client modules. Root evidence passes 26 / 26
BrainVault/runtime tests with 100,156 expectations before the documented
60-second Hardhat compiler-cache mutex; downstream soundcheck passes all ten
gates before the documented missing local `cargo`, and file-size checking
reaches only the existing `core/qa/report.ts` 3001/3000 violation. This slice
changes no Runtime protocol, contract, persistence schema, or artifact. At
that checkpoint, wallet recovery and push wake were complete, the typed parity
audit reported two exact gaps, and external-provider integration was next.

React Payments now binds the recovered wallet signer to the canonical external-
wallet and native authority boundary. React receives only redacted binding,
balance, allowance, and finalized-operation projections; the bridge retains the
private key, live Runtime, Entity, jurisdiction adapter, and pre-send authority
revalidation. Real native/ERC20 transfers and exact ERC20 approvals execute on
the selected chain, while reserve deposits and withdrawals enter the existing
`e2r`, `r2e`, and `j_broadcast` Runtime input path. Embedded commands enqueue
once without inventing remote sequencing; remote commands retain their
fingerprint, sequence, and idempotent retry authority. Same-origin wallet
navigation now preserves the restored live Runtime rather than reloading it.

The BrowserVM fixture exposes the real signed RPC transaction, receipt, block,
balance, allowance, and log path and runs with the canonical local relay. The
external-wallet flow passes 3 / 3 in 25.4 seconds across 390×844, 1366×900, and
1920×1080, proving a signed ERC20 transfer, exact Depository approval, one
embedded reserve deposit, and committed Runtime height advance; every key-state
screenshot was inspected without clipping or horizontal overflow. The complete
wallet matrix remains 39 / 39. The final focused payment/parity batch passes 27
/ 27 with 606 expectations; the React-local gate scans 675 files with zero
unsafe findings, and the canonical frontend gate reports zero errors/warnings
while transforming 4,677 SSR plus 6,428 client modules. All four React
production surfaces build; wallet transforms 1,857 modules in 2.03 seconds and
keeps the external CSS, UI, and authority bridge isolated at 3.67 / 13.47 /
12.36 kB respectively.

The authoritative 216-file frontend suite reports 1,291 passes, 16 failures,
one error, and 7,392 expectations across 1,307 tests in the restricted sandbox.
The two development-gateway tests and QA cache test pass 6 / 6 with host
networking, leaving the exact established 13-name repository baseline and no
failure owned by this slice. Root evidence passes 26 / 26 deterministic tests
with 100,156 expectations before the documented 60-second Hardhat compiler-
cache mutex. Downstream soundcheck passes all ten gates before the documented
missing local `cargo`; file-size checking reaches only the existing
`core/qa/report.ts` 3001/3000 violation. This slice changes no Runtime protocol,
contract, persistence schema, or artifact. Wallet payment and native parity are
complete.

The authorized Entity-workspace subprogram now includes a strict, read-only
Assets projection. The React candidate reads only the active Entity's committed
reserve `Map`, preserves its canonical insertion order, and renders exact token
IDs plus raw nonnegative bigint units without inventing metadata, prices,
aggregates, or financial conversions. The source rejects malformed containers,
unsafe token IDs, negative amounts, oversized pages, and Entity-authority
mismatches. Focused model/source/shell coverage passes 17 / 17 with 91
expectations; inventory and boundary coverage passes 24 / 24 with 593
expectations. A real isolated H1 Runtime renders three committed reserve rows at
390×844, 1366×900, and 1920×1080; all three screenshots were inspected without
clipping or horizontal overflow, and the complete ops candidate matrix passes
30 / 30. The React-local gate scans 678 files with zero unsafe findings. The
217-file frontend suite reports 1,295 passes, 16 restricted-sandbox failures,
one error, and 7,411 expectations across 1,311 tests; the three network-binding
fixtures pass 6 / 6 with host networking, leaving the unchanged 13-name
repository baseline and no slice-owned failure. All four React production
surfaces build; ops transforms 1,618 modules and isolates the Entity workspace
view/runtime chunks at 15.65 / 17.79 kB. The canonical frontend check remains
at zero errors/warnings while transforming 4,677 SSR plus 6,428 client modules.
Root evidence passes 26 / 26 deterministic tests with 100,156 expectations
before the documented 60-second Hardhat compiler-cache mutex. Downstream
soundcheck passes all ten gates before the documented missing local `cargo`;
file-size checking reaches only the existing `core/qa/report.ts` 3001/3000
violation. This slice changes no Runtime protocol, contract, persistence schema,
or artifact.

The next authorized Entity slice composes the already strict context, board,
and bounded Account-page projections into a read-only `settings/consensus`
evidence panel. It publishes committed Runtime height, board mode and threshold,
validator shares, and exact Account frame heads while explicitly withholding
validator-local proposals, votes, locks, and certificates from the remote
projection. Cross-Entity or partial composition fails loudly; no consensus
transition, quorum formula, proposal handling, or command path is reproduced.
The focused context/board/Account/source/shell batch passes 26 / 26 with 117
expectations, and typed inventory coverage passes 18 / 18 with 473 expectations.
The isolated real-H1 flow passes in 19.6 seconds (21.0 seconds total) and renders
one committed validator plus two Account heads at 390×844, 1366×900, and
1920×1080. Screenshot review caught and corrected a desktop summary truncation;
all three final screenshots are readable with no clipping or horizontal
overflow. The complete ops candidate matrix passes 30 / 30. The React-local
gate scans 680 files with zero unsafe findings, all four React production
surfaces build, and ops transforms 1,621 modules with 18.30 / 18.74 kB
workspace view/runtime chunks. The canonical frontend check remains at zero
errors/warnings while transforming 4,677 SSR plus 6,428 client modules. The
218-file frontend suite reports 1,298 passes, 16 restricted-sandbox failures,
one error, and 7,426 expectations across 1,314 tests; the three network-binding
fixtures pass 6 / 6 with host networking, leaving the unchanged 13-name
repository baseline and no slice-owned failure. Root evidence passes 26 / 26
deterministic tests with 100,156 expectations before the documented 60-second
Hardhat compiler-cache mutex. Downstream soundcheck passes all ten gates before
the documented missing local `cargo`; production function-size policy passes
1,047 files with zero overage, and file-size checking reaches only the existing
`core/qa/report.ts` 3001/3000 violation. This slice changes no Runtime protocol,
contract, persistence schema, or artifact.

The Entity Settings stage now shares the canonical seven-theme model and
`xln-settings` storage boundary between Svelte and React. The React Display
panel applies the selected palette immediately and writes only the `theme`
field, preserving concurrent and unknown settings; malformed persisted data is
removed with a visible, logged error. At that checkpoint, Time Machine and
mascot controls remained read-only projections of their canonical Svelte-owned
values, and the shared
Settings navigation maps the historical `settings/entity` alias to Wallet.
Theme-aware workspace CSS keeps Assets, Consensus, Accounts, Profile, and
Display readable across dark and light palettes without changing product
authority.

Focused display/source/shell coverage passes 12 / 12 with 89 expectations;
the inventory-focused batch passes 25 / 25 with 552 expectations. The final
isolated real-H1 flow passes in 22.4 seconds (23.7 seconds total) with candidate
`6231a6458b15`, preserves unrelated storage fields, and renders all five key
workspace states at 390×844, 1366×900, and 1920×1080. All 15 named screenshots
were inspected without clipping or horizontal overflow; review caught and
corrected the settings-alias highlight before the final run. The complete ops
candidate matrix passes 30 / 30. The React-local gate scans 686 files with zero
unsafe findings, all four React production surfaces build, and ops transforms
1,629 modules with 25.08 / 18.74 / 25.68 kB workspace CSS/runtime/view chunks.
The canonical frontend check reports zero errors/warnings while transforming
4,680 SSR plus 6,431 client modules.

The 219-file frontend suite reports 1,302 passes, 16 restricted-sandbox
failures, one error, and 7,462 expectations across 1,318 tests; the three
network-binding fixtures pass 6 / 6 with host networking, leaving the unchanged
13-name repository baseline and no slice-owned failure. Root evidence passes
26 / 26 deterministic tests with 100,156 expectations before the documented
60-second Hardhat compiler-cache mutex. Downstream soundcheck passes all ten
gates before the documented missing local `cargo`; production function-size
policy passes 1,047 files with zero overage, and file-size checking reaches only
the existing `core/qa/report.ts` 3001/3000 violation. This slice changes no
Runtime protocol, contract, persistence schema, or artifact.

The next authorized Entity Settings slice makes Time Machine a real React
consumer of the shared remote-history transport. The Display toggle performs a
field-scoped `xln-settings` update, and hiding the rail always returns the
workspace to live state. The responsive operator rail reads one exact committed
height, replaces every Entity projection from that single frame, exposes live
and historical mode, steps backward or forward, restores live state explicitly,
and round-trips canonical Runtime/Entity/height deep links. Latest-wins request
ownership suppresses stale overlapping reads; Runtime, Entity, page, and height
drift fail loudly without publishing partial history.

The existing replayed Entity-view read now preserves the same exact pagination
metadata as its live counterpart so the frontend never invents Account totals
or page positions. This is read-only storage/adapter projection wiring: it
changes no Runtime transition, durable representation, protocol authority,
financial formula, contract, or persistence schema. The shared hash parameter
definition moved out of core configuration into `packages/runtime-client`, and
both the canonical Svelte view and React candidate consume that single frontend
definition.

Focused Time Machine, display, Runtime-read, and inventory coverage passes
22 / 22 with 259 expectations; the shared-boundary plus Time Machine batch
passes 10 / 10 with 138 expectations. The replay-pagination regression passes
1 / 1, Runtime types are green, and the React-local gate scans 690 files with
zero unsafe findings. The complete ops candidate matrix passes 30 / 30 across
390×844, 1366×900, and 1920×1080. The final isolated real-H1 flow passes in
25.4 seconds (26.6 seconds total) with candidate `2862afd96fbd`, proves exact
historical selection plus both return-live paths, preserves unrelated settings,
and emits no browser-console errors. All 18 final screenshots were inspected;
the three unchanged Assets images are byte-identical to the prior passing set,
and every data-bearing frame is readable without clipping or horizontal
overflow.

All four React production surfaces build. The final ops build transforms 1,636
modules in 2.46 seconds and isolates the workspace CSS/view/runtime chunks at
28.93 / 26.03 / 29.55 kB. Production function-size policy passes 1,047 files
with zero overage. The canonical frontend check reports zero errors/warnings
while transforming 4,681 SSR plus 6,432 client modules. The 220-file frontend
suite reports 1,307 passes, the unchanged 16-failure plus one-error repository
baseline, and 7,483 expectations across 1,323 tests; the slice-owned shared-
boundary regression is absent.
Root evidence passes 26 / 26 deterministic tests with 100,156 expectations
before the documented 60-second Hardhat compiler-cache mutex.

The next Display slice makes `showXlnMascot` a real React-owned preference
write while preserving the canonical Svelte guide implementation. The React
toggle updates only that field in the shared `xln-settings` object, preserves
unknown and concurrent settings, and recovers loudly from malformed storage.
It does not reproduce guide, assistant, drag, or local-model behavior; the
canonical workspace continues to consume the same setting and owns those
effects.

Focused storage/source/shell coverage passes 13 / 13 with 93 expectations.
The React-local gate scans 690 files with zero unsafe findings, all four React
production surfaces build, and ops transforms 1,636 modules with 28.16 / 26.61
/ 29.55 kB workspace CSS/view/runtime chunks. The canonical frontend check
reports zero errors/warnings while transforming 4,681 SSR plus 6,432 client
modules. The isolated real-H1 flow passes in 27.8 seconds (30.2 seconds total)
with candidate `9849deba2424`, preserves an unrelated future setting, and
proves theme, Time Machine, and guide preference round trips. The three changed
Display screenshots at 390×844, 1366×900, and 1920×1080 were inspected with no
clipping or horizontal overflow.

The 220-file frontend suite reports 1,308 passes, the unchanged 16-failure plus
one-error repository baseline, and 7,488 expectations across 1,324 tests. Its
network-server failures remain restricted-sandbox behavior, and no slice-owned
test fails. Root evidence passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Frozen core is unchanged; file-size checking reaches only the existing
`core/qa/report.ts` 3001/3000 violation. This slice changes no canonical guide
behavior, Runtime protocol, contract, persistence schema, financial formula,
or artifact.

The next Entity Settings slice projects the active Entity's committed Hub
policy into the React profile overview. Its strict boundary accepts only the
canonical policy keys and exact strategy, safe-integer, and bigint field
types; it distinguishes an absent Entity from an Entity with no Hub policy and
fails loudly on malformed or schema-drifted data. The panel exposes the raw
committed strategy, policy version, routing fee ppm, base-fee units, liquidity
fee bps, and rebalance timeout milliseconds. It performs no calculation and
offers no mutation command.

Focused Hub-policy, Runtime-read, workspace, Time Machine, and parity coverage
passes 21 / 21 with 294 expectations; the corrected ownership/parity inventory
batch passes 11 / 11 with 304 expectations. The React-local gate scans 691
files with zero unsafe findings, all four React production surfaces build, and
the ops build transforms 1,637 modules with 28.61 kB workspace CSS, 27.86 kB
view, and 31.43 kB Runtime chunks. The canonical frontend check reports zero
errors/warnings while transforming 4,681 SSR plus 6,432 client modules.

The isolated real-H1 flow passes in 27.2 seconds (29.6 seconds total) with
candidate `b0bdd41945b7`, renders nonzero committed Hub policy, and emits no
browser-console error. Its changed profile screenshots at 390×844, 1366×900,
and 1920×1080 were inspected with no clipping or horizontal overflow. The
221-file frontend suite reports 1,312 passes, the unchanged 16-failure plus
one-error repository baseline, and 7,508 expectations across 1,328 tests; no
slice-owned test fails. This read-only slice changes no Runtime transition,
protocol authority, financial formula, contract, persistence schema, or
artifact.

Root evidence passes 26 / 26 deterministic tests with 100,156 expectations
before the documented 60-second Hardhat compiler-cache mutex. Downstream
soundcheck passes all ten gates before the documented missing local `cargo`;
frozen core is unchanged, diff hygiene is clean, and file-size checking reaches
only the existing `core/qa/report.ts` 3001/3000 violation.

The next read-only Entity Settings slice composes the already validated
context, profile, reserves, and Time Machine projections into one committed
Runtime summary. It exposes the exact Runtime height and identifiers,
jurisdiction, live/history mode, Hub role, exact Account total, and an
explicitly labeled visible-reserve count. Empty and selected projection states
must agree, and cross-Entity composition fails loudly. No command surface,
adapter change, financial calculation, Runtime transition, or persistence is
introduced.

Focused projection, wiring, Runtime-read, shared-boundary, and parity coverage
passes 23 / 23 with 407 expectations; the final state/layout regression passes
8 / 8 with 71 expectations. The all-surface React-local gate scans 692 files with
zero unsafe findings. All four React production surfaces build; site/docs/
wallet/ops transform 401 / 35 / 1,860 / 1,638 modules, and the ops workspace
CSS/view/Runtime chunks are 28.70 / 30.61 / 31.43 kB. The canonical frontend
check reports zero errors/warnings while transforming 4,681 SSR plus 6,432
client modules.

The final isolated real-H1 flow passes in 26.1 seconds (27.4 seconds total)
with candidate `8c35f97afbdc`, proves nonzero live height, Account, and visible
reserve values, and emits no browser-console error. Its changed Settings
screenshots at 390×844, 1366×900, and 1920×1080 were inspected after correcting
the laptop signer wrap; the final images have no clipping or horizontal
overflow. The 222-file frontend suite reports 1,317 passes, the unchanged
16-failure plus one-error repository baseline, and 7,523 expectations across
1,333 tests; no slice-owned test fails.

Root evidence passes 26 / 26 deterministic tests with 100,156 expectations
before the documented 60-second Hardhat compiler-cache mutex. Downstream
soundcheck passes all ten gates before the documented missing local `cargo`;
frozen core is unchanged, diff hygiene is clean, and file-size checking reaches
only the existing `core/qa/report.ts` 3001/3000 violation.

The next read-only Account slice expands each already bounded Account row into
an exact committed-frame evidence view. It exposes the Account frame height,
timestamp, jurisdiction height, bounded frame transaction count, previous-frame
link, Account state root, and state hash in adapter order. The strict projection
rejects negative or fractional heights/timestamps, more than the adapter's 20
visible frame transactions, missing roots, invalid previous-frame links, and
the existing foreign/self/duplicate bilateral perspectives. It performs no
delta derivation or balance, credit, capacity, payment, or swap calculation and
adds no command or adapter path.

Focused Account projection, Runtime-read, workspace, Time Machine, and typed
inventory coverage passes 38 / 38 with 612 expectations. The all-surface
React-local gate scans 692 files with zero unsafe findings. All four React
production surfaces build; site/docs/wallet/ops transform 401 / 35 / 1,860 /
1,638 modules, and the ops workspace CSS/view/Runtime chunks are 29.33 / 31.55 /
31.99 kB. The canonical frontend check reports zero errors/warnings while
transforming 4,681 SSR plus 6,432 client modules. The complete ops candidate
matrix passes 30 / 30 across the required mobile, laptop, and wide viewports.

The final isolated real-H1 flow passes in 28.0 seconds (29.3 seconds total) with
candidate `caa8696ee865`, verifies nonempty Account roots and exact numeric
jurisdiction heights, and emits no browser-console error. Its changed Account
screenshots at 390×844, 1366×900, and 1920×1080 were inspected with no clipping
or horizontal overflow. The 223-file frontend suite reports 1,320 passes, the
unchanged 16-failure plus one-error repository baseline, and 7,535 expectations
across 1,336 tests; no slice-owned test fails.

Root evidence passes 26 / 26 deterministic tests with 100,156 expectations
before the documented 60-second Hardhat compiler-cache mutex. Downstream
soundcheck passes all ten gates; local `cargo` remains unavailable, frozen core
is unchanged, production function sizing passes 1,047 files, diff hygiene is
clean, and file-size checking reaches only the existing out-of-scope
`core/qa/report.ts` 3001/3000 violation.

The following read-only Account slice adds an exact persisted Entity activity
ledger beside the bounded Account page. Its query is pinned to the displayed
committed frame, including Time Machine history, with an eight-event / 160-frame
bound. The strict projection validates Runtime and Entity ownership, filter and
page bounds, coherent scan/cursor metadata, unique event ids, canonical event
enums, timestamps, and frame ranges while preserving adapter order. It exposes
event descriptions and committed heights without calculating balances, credit,
capacity, routing, payment amounts, or swap amounts and adds no command path.

Focused Activity, Runtime-read, workspace, Time Machine, shared-boundary, and
typed-inventory coverage passes 82 / 82 with 849 expectations. The all-surface
React-local gate scans 694 files with zero unsafe findings. All four React
production surfaces build; site/docs/wallet/ops transform 401 / 35 / 1,860 /
1,641 modules, and the ops workspace CSS/view/Runtime chunks are 33.54 / 33.65 /
36.87 kB. The canonical frontend check reports zero errors/warnings while
transforming 4,681 SSR plus 6,432 client modules. The complete ops candidate
matrix passes 30 / 30 across the required mobile, laptop, and wide viewports.

The final isolated real-H1 flow passes in 26.9 seconds (28.2 seconds total) with
candidate `cd08be8f6437`, reads eight persisted events through Runtime h24 from
an eleven-frame scan, verifies the strict activity metadata, and emits no
browser-console error. Its changed Account/activity screenshots at 390×844,
1366×900, and 1920×1080 were inspected with no clipping or horizontal overflow.
The 224-file frontend suite reports 1,324 passes, the unchanged 16-failure plus
one-error repository baseline, and 7,557 expectations across 1,340 tests; no
slice-owned test fails.

Root evidence passes 26 / 26 deterministic tests with 100,156 expectations
before the documented 60-second Hardhat compiler-cache mutex. Downstream
soundcheck passes all ten gates; frozen core remains at
`0x4eccf4492e5d085b24162f86d327e003c36b7e2a90ad527db1653fde391946a7`,
production function sizing passes 1,047 files, diff hygiene is clean, and file
size checking reaches only the existing out-of-scope `core/qa/report.ts`
3001/3000 violation.

The persisted Activity follow-up adds strict Earlier / Latest navigation over
the same bounded Runtime history adapter. The controller accepts only the
adapter-certified `nextBeforeHeight`, resets the cursor when Time Machine
selection or the Runtime connection changes, refreshes only the active
transport, and preserves every
event in adapter order. It adds no write command, financial derivation, second
history source, or compatibility path.

Focused Entity workspace coverage passes 85 / 85 with 868 expectations. The
all-surface React-local gate scans 695 files with zero unsafe findings. All four
React production surfaces build; site/docs/wallet/ops transform 401 / 35 /
1,860 / 1,642 modules, and the ops workspace CSS/view/Runtime chunks are 33.95 /
34.07 / 38.41 kB. The canonical frontend check reports zero errors/warnings
while transforming 4,681 SSR plus 6,432 client modules. The complete ops
candidate matrix passes 30 / 30 across the required viewports.

The isolated real-H1 pagination flow passes in 25.6 seconds (28.0 seconds
total) with candidate `fbf0d37223f7`. It loads an earlier persisted page,
observes a lower committed through-height, restores Latest, and emits no
browser-console error. Mobile 390x844, laptop 1366x900, and wide 1920x1080
screenshots were inspected with legible controls and no clipping or horizontal
overflow. The 224-file frontend suite reports 1,327 passes, the unchanged
16-failure plus one-error repository baseline, and 7,576 expectations across
1,343 tests; no slice-owned test fails.

Root evidence again passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Downstream soundcheck passes all ten gates; frozen core remains unchanged,
production function sizing passes 1,047 files, and file-size checking reaches
only the existing out-of-scope `core/qa/report.ts` 3001/3000 violation.

The following persisted Activity slice adds the adapter's canonical All, Off-chain,
and On-chain filters. The selected kind is part of the strict page projection:
returned filter metadata and every event kind must match the request. Changing
kind resets only the activity page cursor, preserves the displayed live or
Time Machine frame, and refreshes only that active transport. This remains one
read-only history source with no command, amount, or financial derivation.

Focused Entity workspace coverage passes 86 / 86 with 883 expectations. The
all-surface React-local gate scans 695 files with zero unsafe findings. All four
React production surfaces build; site/docs/wallet/ops transform 401 / 35 /
1,860 / 1,642 modules, and the ops workspace CSS/view/Runtime chunks are 34.72 /
34.58 / 39.32 kB. The canonical frontend check reports zero errors/warnings
while transforming 4,681 SSR plus 6,432 client modules. The complete ops
candidate matrix passes 30 / 30 across the required viewports.

The exact isolated real-H1 filter flow passes in 27.2 seconds (28.4 seconds
total) with candidate `37719b0c8e47`. It verifies All, Off-chain, and On-chain
requests return only matching persisted rows, restores All and Latest, and
emits no browser-console error. Mobile 390x844, laptop 1366x900, and wide
1920x1080 screenshots show legible filter controls with no clipping or
horizontal overflow. The 224-file frontend suite reports 1,328 passes, the
unchanged 16-failure plus one-error repository baseline, and 7,591 expectations
across 1,344 tests; no slice-owned test fails.

Root evidence again passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Downstream soundcheck passes all ten gates; frozen core remains at
`0x4eccf4492e5d085b24162f86d327e003c36b7e2a90ad527db1653fde391946a7`,
production function sizing passes 1,047 files, and file-size checking reaches
only the existing out-of-scope `core/qa/report.ts` 3001/3000 violation.

The following Activity filter slice adds the canonical legacy event-type
choices: Payments, Swaps, Cross-j, HTLC, Settlement, Accounts, J-events,
Batches, and Errors. Multi-selection order is preserved in the exact adapter
query. The strict boundary rejects unknown or duplicate requested types,
returned filter drift, and events outside the selected types. Toggling a type
resets only the Activity cursor and preserves the active kind and displayed
live or historical frame.

Focused Entity workspace coverage passes 87 / 87 with 897 expectations. The
all-surface React-local gate scans 695 files with zero unsafe findings. All four
React production surfaces build; site/docs/wallet/ops transform 401 / 35 /
1,860 / 1,642 modules, and the ops workspace CSS/view/Runtime chunks are 35.07 /
35.32 / 40.66 kB. The canonical frontend check reports zero errors/warnings
while transforming 4,681 SSR plus 6,432 client modules. The complete ops
candidate matrix passes 30 / 30 across the required viewports.

The isolated real-H1 event-type flow passes in 27.9 seconds (30.3 seconds
total) with candidate `93f9eebf2592`. It verifies the J-events selection returns
only `j_event` rows, restores the unfiltered page, and emits no browser-console
error. Mobile 390x844, laptop 1366x900, and wide 1920x1080 screenshots show all
nine controls with no clipping or horizontal overflow. The 224-file frontend
suite reports 1,329 passes, the unchanged 16-failure plus one-error repository
baseline, and 7,605 expectations across 1,345 tests; no slice-owned test fails.

Root evidence again passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Downstream soundcheck passes all ten gates; frozen core remains at
`0x4eccf4492e5d085b24162f86d327e003c36b7e2a90ad527db1653fde391946a7`,
production function sizing passes 1,047 files, and file-size checking reaches
only the existing out-of-scope `core/qa/report.ts` 3001/3000 violation.

The following Activity navigation slice adds the legacy view's incremental
Newer action without changing the canonical adapter query. The ops controller
retains only the null Latest marker and adapter-certified `nextBeforeHeight`
cursors in a transient UI stack. Earlier appends or reuses the exact certified
cursor; Newer walks back one observed page; Latest and every kind, type, or
Time Machine context change reset the stack. Live and historical reads still
refresh only their active transport.

The direct React workspace chain passes 72 / 72 tests with 479 expectations,
and the narrower Activity boundary passes 9 / 9 with 59 expectations. The
all-surface React-local gate scans 695 files with zero unsafe findings. All four
React production surfaces build; site/docs/wallet/ops transform 401 / 35 /
1,860 / 1,642 modules, and the ops workspace CSS/view/Runtime chunks are 35.12 /
35.69 / 41.14 kB. The canonical frontend check reports zero errors/warnings
while transforming 4,681 SSR plus 6,432 client modules. The complete ops
candidate matrix passes 30 / 30 across the required viewports.

The isolated real-H1 bidirectional-pagination flow passes in 29.4 seconds
(31.8 seconds total) with candidate `d8f2fc4cef1b`. It exercises Earlier,
Newer, Earlier, and Latest against persisted H1 evidence and emits no
browser-console error. Mobile 390x844, laptop 1366x900, and wide 1920x1080
screenshots show the paired Latest/Newer controls with no clipping or
horizontal overflow. The 224-file frontend suite reports 1,330 passes, the
unchanged 16-failure plus one-error repository baseline, and 7,611 expectations
across 1,346 tests; no slice-owned test fails.

Root evidence again passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Downstream soundcheck passes all ten gates; frozen core remains at
`0x4eccf4492e5d085b24162f86d327e003c36b7e2a90ad527db1653fde391946a7`,
production function sizing passes 1,047 files, and file-size checking reaches
only the existing out-of-scope `core/qa/report.ts` 3001/3000 violation.

The following Activity search slice adds the legacy view's exact 250ms
debounce over the canonical adapter `q/query` filter. The browser keeps only
the draft input; the ops controller owns the normalized active query, resets
only its certified page cursor stack, and refreshes the active live or Time
Machine transport. The strict projection requires returned query metadata to
match exactly and rejects any event whose canonical searchable evidence does
not contain the requested text.

The direct React workspace chain passes 73 / 73 tests with 490 expectations,
and the narrower Activity boundary passes 10 / 10 with 70 expectations. The
all-surface React-local gate scans 695 files with zero unsafe findings. All four
React production surfaces build; site/docs/wallet/ops transform 401 / 35 /
1,860 / 1,642 modules, and the ops workspace CSS/view/Runtime chunks are 35.95 /
36.40 / 42.33 kB. The canonical frontend check reports zero errors/warnings
while transforming 4,681 SSR plus 6,432 client modules. The complete ops
candidate matrix passes 30 / 30 across the required viewports.

The isolated real-H1 search flow passes in 31.3 seconds (33.7 seconds total)
with candidate `e649b5787b26`. It debounces `ReserveUpdated`, projects only the
three exact matching persisted rows, restores the unfiltered page when
cleared, and emits no browser-console error. Mobile 390x844, laptop 1366x900,
and wide 1920x1080 screenshots show a legible search control with no clipping
or horizontal overflow. The 224-file frontend suite reports 1,331 passes, the
unchanged 16-failure plus one-error repository baseline, and 7,622 expectations
across 1,347 tests; no slice-owned test fails.

Root evidence again passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Downstream soundcheck passes all ten gates; frozen core remains at
`0x4eccf4492e5d085b24162f86d327e003c36b7e2a90ad527db1653fde391946a7`,
production function sizing passes 1,047 files, and file-size checking reaches
only the existing out-of-scope `core/qa/report.ts` 3001/3000 violation.

The following Activity control slice adds the legacy view's dedicated Clear
filters action. One controller transition clears the normalized search, all
selected event types, and the transient certified cursor stack while
preserving the selected All, Off-chain, or On-chain kind and the current live
or Time Machine context. An already-clear latest page is a no-op; no adapter
write, financial derivation, or parallel history source is introduced.

The direct React workspace chain passes 73 / 73 tests with 496 expectations,
and the narrower Activity boundary passes 10 / 10 with 76 expectations. The
all-surface React-local gate scans 695 files with zero unsafe findings. All four
React production surfaces build; site/docs/wallet/ops transform 401 / 35 /
1,860 / 1,642 modules, and the ops workspace CSS/view/Runtime chunks are 36.09 /
36.76 / 42.67 kB. The canonical frontend check remains green, and the complete
ops candidate matrix passes 30 / 30 across the required viewports.

The exact isolated real-H1 combined-filter flow passes in 28.6 seconds (30.0
seconds total) with candidate `93fa4c4b807c`. It combines J-events with the
debounced `ReserveUpdated` query, captures the three exact matching rows, then
clears both filters atomically and restores the complete latest page. Strict
browser health emits no console error. Mobile 390x844, laptop 1366x900, and
wide 1920x1080 active-filter plus post-clear screenshots were inspected with
legible controls and no clipping or horizontal overflow. The 224-file frontend
suite reports 1,331 passes, the unchanged 16-failure plus one-error repository
baseline, and 7,628 expectations across 1,347 tests; no slice-owned test fails.

Root evidence again passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Downstream soundcheck passes all ten gates; frozen core remains at
`0x4eccf4492e5d085b24162f86d327e003c36b7e2a90ad527db1653fde391946a7`,
production function sizing passes 1,047 files, and file-size checking reaches
only the existing out-of-scope `core/qa/report.ts` 3001/3000 violation.

The following Activity control slice adds an explicit refresh action. It
reissues the exact currently selected persisted Activity read through the
active live or Time Machine transport while preserving the kind, normalized
query, event types, and adapter-certified page cursor. It does not mutate
workspace state, write through the adapter, or introduce a parallel history
source.

The direct React workspace chain passes 74 / 74 tests with 501 expectations,
and the narrower Activity boundary passes 11 / 11 with 81 expectations. The
all-surface React-local gate scans 695 files with zero unsafe findings. All four
React production surfaces build; site/docs/wallet/ops transform 401 / 35 /
1,860 / 1,642 modules, and the ops workspace CSS/view/Runtime chunks are 36.58 /
37.06 / 42.86 kB. The canonical frontend check remains green, and the complete
ops candidate matrix passes 30 / 30 across the required viewports.

The exact isolated real-H1 refresh flow passes in 30.1 seconds (31.4 seconds
total) with candidate `3a6f0c910882`. It refreshes the active filtered Activity
page without changing its count or filter context, then completes the existing
clear and pagination flow. Strict browser health emits no console error.
Mobile 390x844, laptop 1366x900, and wide 1920x1080 active-filter plus
post-refresh screenshots were inspected with a restrained, legible action and
no clipping or horizontal overflow. The 224-file frontend suite reports 1,332
passes, the unchanged 16-failure plus one-error repository baseline, and 7,633
expectations across 1,348 tests; no slice-owned test fails.

Root evidence again passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Downstream soundcheck passes all ten gates; frozen core remains at
`0x4eccf4492e5d085b24162f86d327e003c36b7e2a90ad527db1653fde391946a7`,
production function sizing passes 1,047 files, and file-size checking reaches
only the existing out-of-scope `core/qa/report.ts` 3001/3000 violation.

The following Activity control slice adds explicit page sizing. It preserves
the React workspace's compact eight-row default while exposing the legacy
40/80/160 choices through one strict page-size decoder. A size change resets
only the adapter-certified cursor stack, preserves kind/query/type filters,
and reaches the active live or Time Machine read without adding any write or
parallel history path.

The direct React workspace chain passes 75 / 75 tests with 513 expectations,
and the narrower Activity boundary passes 12 / 12 with 93 expectations. The
all-surface React-local gate scans 695 files with zero unsafe findings. All four
React production surfaces build; site/docs/wallet/ops transform 401 / 35 /
1,860 / 1,642 modules, and the ops workspace CSS/view/Runtime chunks are 37.42 /
37.61 / 43.70 kB. The canonical frontend check reports zero errors/warnings
while transforming 4,681 SSR plus 6,432 client modules. The complete ops
candidate matrix passes 30 / 30 across the required viewports.

The exact isolated real-H1 flow passes in 28.1 seconds (29.4 seconds total)
with candidate `6d7c5313e03a`. It proves 8→40→8 against persisted H1 evidence,
including the event-count expansion and contraction, then retains refresh,
filters, search, clear, and bidirectional pagination.
Strict browser health emits no console error. The first dedicated 40-row
screenshots exposed a 3,443–6,409px workspace expansion; the corrected list is
a bounded internal scroll region whose overflow is asserted in-browser.
Mobile 390x844, laptop 1366x900, and wide 1920x1080 corrected screenshots were
inspected with aligned Account evidence, footer controls, and no clipping or
horizontal overflow. The 224-file frontend suite reports 1,333 passes, the
unchanged 16-failure plus one-error repository baseline, and 7,645 expectations
across 1,349 tests; no slice-owned test fails.

Root evidence again passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Downstream soundcheck passes all ten gates; frozen core remains at
`0x4eccf4492e5d085b24162f86d327e003c36b7e2a90ad527db1653fde391946a7`,
production function sizing passes 1,047 files, and file-size checking reaches
only the existing out-of-scope `core/qa/report.ts` 3001/3000 violation.

The following Activity presentation slice replaces raw epoch-only labels with
deterministic UTC timestamps while retaining the exact Runtime millisecond
value in the semantic `time` title and the lossless ISO value in `datetime`.
The shared formatter accepts only nonnegative safe integers inside the complete
JavaScript Date range, including expanded years, and the Activity projection
rejects invalid timestamp evidence before rendering. It reads no wall clock,
changes no Runtime semantics, and adds no financial derivation or write path.

Focused Entity workspace coverage passes 113 / 113 tests with 772 expectations,
and the narrower Activity boundary passes 13 / 13 with 100 expectations. The
all-surface React-local gate scans 695 files with zero unsafe findings. All four
React production surfaces build; site/docs/wallet/ops transform 401 / 35 /
1,860 / 1,642 modules, and the ops workspace CSS/view/Runtime chunks are 37.51 /
38.03 / 43.81 kB. The canonical frontend check reports zero errors/warnings
while transforming 4,681 SSR plus 6,432 client modules. The complete ops
candidate matrix passes 30 / 30 across the required viewports.

The final isolated real-H1 flow passes in 30.8 seconds (33.1 seconds total)
with candidate `a22df053c6f9`. It verifies readable UTC text, lossless ISO
metadata, and retained raw epoch evidence before completing the existing
refresh, filter, search, clear, page-size, and pagination flow. Strict browser
health emits no console error. Mobile 390x844, laptop 1366x900, and wide
1920x1080 screenshots were inspected with aligned timestamps, no clipping, and
no horizontal overflow. The 224-file frontend suite reports 1,334 passes, the
unchanged 16-failure plus one-error repository baseline, and 7,652 expectations
across 1,350 tests; no slice-owned test fails.

Root evidence again passes 26 / 26 deterministic tests with 100,156
expectations before the documented 60-second Hardhat compiler-cache mutex.
Downstream soundcheck passes all ten gates; frozen core remains at
`0x4eccf4492e5d085b24162f86d327e003c36b7e2a90ad527db1653fde391946a7`,
production function sizing passes 1,047 files, diff hygiene is clean, and
file-size checking reaches only the existing out-of-scope `core/qa/report.ts`
3001/3000 violation.

**Current checkpoint:** all retained routes have React application owners;
wallet parity is complete. `/embed` is the sole partial implementation/browser
route, and its authorized Entity workspace is the sole remaining WP9
implementation gap before WP10; display-theme, exact Time Machine, and shared
xln-guide preference, exact Account commitment evidence, persisted Activity
with strict bidirectional pagination, kind filters, nine event-type filters,
debounced search, atomic filter clearing, explicit Activity refresh,
compact plus legacy Activity page sizing, deterministic UTC Activity timestamps,
committed Hub-policy, and committed Settings-summary parity are now complete.

### WP10 — Authorized canonical cutover

**Status:** `OWNER AUTHORIZATION REQUIRED`

- Freeze the chosen candidate and obtain explicit destructive cutover approval.
- Switch canonical dev/build/check/package/deploy paths atomically.
- Delete retired Svelte source, configuration, dependencies, and candidate-only
  coexistence wiring; leave no production framework selector.
- Run all-frontend, repository, CI, release, browser, native, activation, and
  rollback checks applicable to the cutover.

**Done:** canonical commands use one complete React release, Svelte is absent,
and the same candidate passes cutover and rollback evidence.

### WP11 — Production activation

**Status:** `SEPARATE RELEASE OPERATION`

Use explicit release authority, immutable prebuilt artifacts, current release
policy, backup/rollback ownership, production smoke, and immediate rollback on
any mismatch. Never compile on production.

## Done criteria

- [x] Four independent React/Vite/TypeScript application roots exist.
- [x] Every retained browser route and capability has one application owner.
- [x] Each app checks, tests, builds, and runs targeted browser flows without
      building unrelated apps.
- [x] Shared packages preserve storage/lifecycle and Runtime-client boundaries.
- [x] Generated inputs have deterministic producers and collision-free outputs.
- [x] Same-origin routing, redirects, proxies, assets, CSP, storage, PWA, deep
      links, native consumers, activation, and rollback are proven.
- [ ] Existing behavior tests were preserved or replaced with equivalent
      behavior coverage, not weakened to fit React.
- [ ] No Runtime, protocol, consensus, financial, or alternate persistence logic
      was introduced into frontend code.
- [ ] Authorized cutover removes Svelte and leaves one canonical production path.
- [ ] Production activation is separately authorized.

## Current next actions

1. Continue the authorized Entity workspace subprogram behind the internal
   candidate route while `/embed` remains canonical.
2. Owner to assign: two `network-timeline-source` failures
   (`NETWORK_TRAIL_FRAME_INVALID:1` in the JSON-safe-frame and trail
   round-trip tests) appeared with the in-flight `core/scenarios` runner
   changes in the working tree and are collateral from that stream, not the
   frontend migration.
3. After remaining workspace parity closes, request explicit WP10 cutover
   authority and prepare the canonical-consumer change separately.
4. Keep WP11 as a separately authorized production operation using immutable
   prebuilt artifacts.

## WP5 closure record

1. The canonical Runtime browser build is restored without a Runtime change,
   and `wallet-runtime-bundle` is a deterministic candidate input. The earlier
   `computeFrameHash` blocker was stale because the symbol is exported.
2. Close the remaining typed WP6 audit deferrals only in their owning work
   packages. WP5 restored and now consumes the canonical browser Runtime bundle;
   WP9 closed the external-provider/native boundary and owns irreversible wallet
   creation, full durable recovery, `/address`, and retained-capability parity;
   WP10 owns the
   authorized canonical cutover. Keep Runtime projections in shared client
   adapters and do not move transition logic into the frontend. Remote link
   decoding and consent are
   ready in `packages/runtime-client`, and adapter session storage is ready in
   `packages/browser`; wallet boot sequencing, active-tab Runtime ownership,
   Runtime selection concurrency, adapter activation, and Runtime handle
   projection are shared; cached Runtime projection reads plus the RuntimeView
   query, pagination, height model, committed-height catch-up, and RuntimeView
   selection snapshots, refresh leases, snapshot transitions, detached
   projections, injected loading outcomes, and latest-wins publication
   coordination are also shared. Wallet shell phase precedence is shared while
   validated deploy-version persistence, reset, and recovery decisions are
   injected through a shared browser coordinator; one-shot Runtime pairing,
   import, consent, persistence, and URL cleanup ordering are shared as well.
   Remote consent validation, accepted-request persistence, activation, and
   embedded cancellation ordering are shared through injected browser effects.
   Canonical Brain Vault/mnemonic identity-mode selection, sensitive-field
   clearing, and keyboard navigation decisions are also shared without moving
   derivation or cryptographic effects.
   Mnemonic recovery-rehearsal skip, begin, mismatch, match, cancel, and reset
   decisions are shared while sensitive cleanup and derivation remain with the
   concrete wallet event flow.
   Recovery candidate selection, peer counting, immutable file-candidate merge
   ordering, and backup/local/fresh continuation are shared while discovery,
   storage, and Runtime effects remain concrete.
   Runtime local-unlock and creation plans, input normalization, onboarding
   flags, and recovery-restore intent are shared while vault mutation,
   sensitive cleanup, navigation, diagnostics, and failure handling remain
   concrete.
   Recovery discovery generation ownership, stale-result suppression, error
   normalization, and reset/unmount invalidation are shared while concrete
   discovery sources and UI, vault, and persistence effects remain concrete.
   Node mnemonic reveal generation ownership, captured-context validation,
   stale-result suppression, and error normalization are shared while adapter
   access, secret publication, loading, and error effects remain concrete.
   Runtime auth-scheme, unlock-duration, and worker-cap preference policy is
   shared while concrete localStorage access and reactive publication remain
   in the canonical Svelte event flow.
   Node BrainVault access, progress, result, and timing validation are shared
   while adapter calls, abort ownership, passphrase input, and result
   publication remain concrete.
   Browser BrainVault worker message, readiness, timing, failure, and shard
   completion validation are shared while Worker lifecycle, watchdogs,
   dispatch, result-byte decoding, secret input, and publication remain
   concrete.
   Browser BrainVault retry, next-shard dispatch, and worker-scaling decisions
   are shared while retry state mutation, Worker creation and draining,
   watchdogs, postMessage, secret input, diagnostics, and publication remain
   concrete.
   Browser BrainVault worker sizing, watchdog, memory-reduction,
   initialization-retry, and terminal-error decisions are shared while timers,
   Worker teardown and recreation, cap persistence, diagnostics, postMessage,
   secret input, and publication remain concrete.
   Browser BrainVault completion triggering, exact shard membership, current-run
   atomic commit, and recovery-label decisions are shared while shard bytes,
   cryptography, zeroization, persistence, navigation, and UI publication
   remain concrete.
   The existing Svelte shell retains its concrete lifecycle effects during
   coexistence. The React wallet is now a complete consumer of the shared
   loader, tab-ownership, suspension, Runtime query, and stable external-store
   snapshot boundaries without importing transition logic.
3. WP8 wires PWA/native consumers to the assembled candidate; the React `/app`
   boot flow and wallet static/PWA input ownership are verified and do not
   require production activation.
4. Attach scenario media only when scenario-specific browser-safe artifacts are
   checked in. The generated catalog currently records an empty media inventory
   and never publishes the 46 TypeScript scenario files.
