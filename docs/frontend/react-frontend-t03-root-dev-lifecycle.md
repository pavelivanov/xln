# T03 root development lifecycle receipt

**Result:** DONE on 2026-09-20. The canonical root command ran the React
frontend on port 8080, served all four surfaces, passed live readiness and
watch probes, and completed a clean shutdown/restart cycle before the user's
Homebrew nginx service was restored.

## Source identity

- Git HEAD: `c4ea8366a574c3197d87a8fe13e2b5d3f77c5e81`
- Runtime bundle SHA-256 before and after the transient watch probe:
  `ef094a6da053be89e733a479d98597dda59aa6f857c912ef89d86cb6eabce360`
- Account-worker bundle SHA-256 before and after the transient watch probe:
  `a9dbf027277fff4a67843b17347242fe468be9f2f265b3f9d4cd0697b8271a0b`
- No transient HMR or bundle-watch marker remains in source or generated
  artifacts.

## First failure repaired

The first canonical launch failed before binding port 8080:

```text
scripts/dev/process-owner.sh: line 63: missing_parts[@]: unbound variable
```

macOS Bash 3.2 treats an empty array expansion as unbound under `set -u`.
`canonical_dev_data_root` now handles the first missing path component without
expanding the empty array. The existing clean-checkout regression now runs with
`set -u`; it passes with pinned Bun 1.4.0.

## Live lifecycle evidence

The command was run twice after temporarily stopping the authorized Homebrew
nginx service:

```text
PATH=/tmp/xln-bun-1.4.0/bun-darwin-aarch64:$PATH \
  XLN_DEV_FRONTEND=react bun run dev
```

- First `DEV_READY`: 20,768 ms total; all four surfaces were then exercised.
- Restart `DEV_READY`: 26,554 ms total; Wallet loaded again with zero browser
  errors.
- The exported readiness probe returned `{ "ready": true }`. That probe checks
  the admin Runtime-import API, fresh Runtime bundle, watchtower, Wallet route,
  Runtime route, signed relay challenge for the 8080 and 5183 audiences, and
  the real faucet pipe.
- Site `/`, Docs `/docs`, Wallet `/app`, and Ops `/health` rendered and survived
  direct reload at 1366×900. Each had a complete document, expected title and
  heading, and zero console errors. Live `/api/health` and `/rpc` requests
  returned 200.
- A temporary Site heading marker appeared and disappeared without navigation,
  proving real HMR. Temporary diagnostic strings in the actual Runtime and
  Account-worker entry files rebuilt both generated bundles; 8080 served the
  changed bytes, then served marker-free bytes after source restoration.
- The default local configuration truthfully reported TLS disabled because no
  supported certificate/key pair was present. The focused gateway test created
  a real certificate, served HTTPS, completed WSS HMR, and proved that configured
  TLS does not silently fall back to HTTP.

Both shutdowns returned the expected interactive exit 130. After each one,
all 12 owned listeners were absent, `db/dev/pids` contained zero files, and
`db/dev/process-owner` was absent. Homebrew nginx was then restarted and again
owned port 8080 (PIDs 56251 and 56257 at receipt time).

## Verification

| Boundary | Evidence |
| --- | --- |
| Bash 3.2 regression | 1 pass, 0 fail; direct `/bin/bash -u` smoke also passed |
| Root/gateway tests | 10 pass, 0 fail, 82 assertions |
| Authenticated API/WS readiness | `{ "ready": true }` |
| Browser surfaces | 4 routes + 4 direct reloads; zero console errors |
| HMR | marker added and removed without navigation |
| Runtime/worker watchers | both changed bytes served, both original hashes restored |
| Shutdown/restart | two `DEV_READY` runs; two clean listener/PID-owner shutdowns |
| Service restoration | `nginx started`; two nginx listeners on `*:8080` |

## Browser evidence

- [Site](../../output/playwright/react-root-dev-t03-20260920/site-1366x900.png)
- [Docs](../../output/playwright/react-root-dev-t03-20260920/docs-1366x900.png)
- [Wallet](../../output/playwright/react-root-dev-t03-20260920/wallet-1366x900.png)
- [Ops](../../output/playwright/react-root-dev-t03-20260920/ops-1366x900.png)
