# xln React frontend

The canonical frontend is a four-surface React release: public site, Docs,
Wallet, and Ops. The development gateway owns the public `localhost:8080`
entry point and routes each pathname to its declared surface.

## Development

Install the pinned dependencies and start all four surfaces:

```sh
bun install --frozen-lockfile
bun run dev
```

From the repository root, `bun run dev` starts the complete local stack and
the same canonical React gateway.

## Verification and build

```sh
bun run check
bun run build
```

`bun run check` typechecks, tests, prepares generated inputs, builds all four
surfaces, and assembles one verified content-addressed release. `bun run build`
performs the production preparation, build, and assembly steps without tests.

Preview requires an explicit verified release directory and never selects a
mutable build implicitly:

```sh
bun run preview -- .artifacts/releases/sha256-<release-id>
```

Production activation is a separate release-authority operation.
