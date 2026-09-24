# React frontend T05 — lossless Activity paging

Status: **DONE**

## Accepted contract

- Runtime Activity reads now return an opaque `cursor`/`nextCursor` pair. The cursor binds Runtime identity, normalized semantic filters, the anchored latest height, the current frame height and the intra-frame event offset.
- The first read remains height-bounded. Subsequent reads resume at the exact offset inside the frame, so reaching `limit` never advances below unconsumed events.
- Cursor/filter/Runtime mismatches, malformed offsets, an ahead-of-history anchor and simultaneous `cursor` plus `beforeHeight` fail loudly. The retained-history floor remains authoritative.
- Wallet, Ops, recorded-mode and graph-timeline consumers pass the cursor through without interpreting it. Filter, Entity and Runtime changes reset paging; in-flight React reads are aborted or superseded before publication.

## Implementation evidence

- `core/storage/queries/runtime-activity-cursor.ts` owns cursor encoding and validation; `core/storage/queries/history.ts` owns bounded same-frame continuation.
- Runtime adapter types, embedded reads, remote wire reads and the HTTP Activity endpoint carry the same cursor fields.
- Wallet History, financial health, Markets and network playback use opaque cursors. Ops paged, Infinite and recorded Activity use the same contract and allow a continuation whose `toHeight` is the previous page's `fromHeight`.
- The browser fixture commits 45 real `chatMessage` transactions in one Runtime frame and returns the producer's exact ordered IDs. Browser assertions compare all 45 IDs across pages and reject stale IDs after an Entity switch.

## Verification

- Focused Activity/unit/query command: **132 pass, 0 fail, 756 assertions**.
- Runtime adapter Activity resolver: **3 pass, 0 fail** (`58` unrelated cases filtered out).
- All React local types/tooling: **4 surfaces pass**, unsafe-type findings `0` across `891` files.
- Wallet Activity browser case: **3/3 viewports pass** (`390×844`, `1366×900`, `1920×1080`).
- Ops Activity browser case: **3/3 viewports pass** at the same viewports.
- Browser screenshots are under `output/playwright/react-candidate/test-results/`, including `ops-overfull-activity-paging` evidence.

One broader `radapter-part-1` run also reported 11 unrelated existing projection/fixture expectation failures. The three Activity resolver cases in that file pass in isolation; none of the 11 failures touches the Activity cursor path.
