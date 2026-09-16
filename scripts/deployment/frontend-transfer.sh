#!/usr/bin/env bash
# Frontend-only transfer/activation adapter for deploy-platform.sh. Runtime and
# checkout mutation belong to the caller; this adapter changes only release state.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
RELEASE=""
ROOT=""
EXPECTED=""
ORIGIN=""
REMOTE_HOST=""
MODE=activate
while [ "$#" -gt 0 ]; do
  case "$1" in
    --release|--root|--expected-active|--origin|--remote)
      [ "$#" -ge 2 ] && [ -n "$2" ] || { echo "FRONTEND_TRANSFER_VALUE_REQUIRED:$1" >&2; exit 1; }
      case "$1" in
        --release) RELEASE="$2" ;;
        --root) ROOT="$2" ;;
        --expected-active) EXPECTED="$2" ;;
        --origin) ORIGIN="$2" ;;
        --remote) REMOTE_HOST="$2" ;;
      esac
      shift 2 ;;
    --rollback|--verify)
      [ "$MODE" = activate ] || { echo FRONTEND_TRANSFER_MODE_CONFLICT >&2; exit 1; }
      MODE="${1#--}"; shift ;;
    *) echo "FRONTEND_TRANSFER_ARGUMENT_INVALID:$1" >&2; exit 1 ;;
  esac
done
[ -n "$ROOT" ] || { echo FRONTEND_TRANSFER_ROOT_REQUIRED >&2; exit 1; }
if [ "$MODE" != verify ]; then
  [[ "$EXPECTED" =~ ^sha256-[0-9a-f]{64}$ ]] || { echo FRONTEND_TRANSFER_EXPECTED_ACTIVE_REQUIRED >&2; exit 1; }
fi
if [ "$MODE" = activate ]; then
  [ -n "$RELEASE" ] || { echo FRONTEND_TRANSFER_RELEASE_REQUIRED >&2; exit 1; }
else
  [ -z "$RELEASE" ] || { echo FRONTEND_TRANSFER_RELEASE_FORBIDDEN >&2; exit 1; }
fi
WORK="$(mktemp -d "${TMPDIR:-/tmp}/xln-frontend-transfer.XXXXXX")"
trap 'rm -rf -- "$WORK"' EXIT
mkdir "$WORK/payload"
bun build "$REPO_ROOT/scripts/deployment/frontend-release.ts" --target=bun --outfile "$WORK/payload/frontend-deploy.mjs"
ID=""
if [ "$MODE" = activate ]; then
  bun "$WORK/payload/frontend-deploy.mjs" check "$RELEASE"
  RELEASE="$(cd "$RELEASE" && pwd -P)"
  ID="$(basename "$RELEASE")"
  cp -R "$RELEASE" "$WORK/payload/$ID"
  bun "$WORK/payload/frontend-deploy.mjs" check "$WORK/payload/$ID"
fi
invoke_local() {
  local args=("$MODE" "$ROOT")
  if [ "$MODE" = activate ]; then args+=("$WORK/payload/$ID"); fi
  if [ "$MODE" != verify ]; then
    args+=("$EXPECTED")
    if [ -n "$ORIGIN" ]; then args+=("$ORIGIN"); fi
  fi
  bun "$WORK/payload/frontend-deploy.mjs" "${args[@]}"
}
if [ -z "$REMOTE_HOST" ]; then
  invoke_local
  exit 0
fi
COPYFILE_DISABLE=1 tar -C "$WORK/payload" -czf "$WORK/transfer.tar.gz" .
REMOTE_ARCHIVE="/tmp/$(basename "$WORK").tar.gz"
scp "$WORK/transfer.tar.gz" "$REMOTE_HOST:$REMOTE_ARCHIVE"
printf -v REMOTE_ARGS '%q ' "$REMOTE_ARCHIVE" "$ROOT" "$MODE" "$ID" "$EXPECTED" "$ORIGIN"
ssh "$REMOTE_HOST" "bash -s -- $REMOTE_ARGS" <<'REMOTE'
set -euo pipefail
archive="$1"; root="$2"; mode="$3"; id="$4"; expected="$5"; origin="$6"
work="$(mktemp -d /tmp/xln-frontend-install.XXXXXX)"
trap 'rm -rf -- "$work"; rm -f -- "$archive"' EXIT
export PATH="$HOME/.bun/bin:$PATH"
tar -xzf "$archive" -C "$work"
args=("$mode" "$root")
if [ "$mode" = activate ]; then args+=("$work/$id"); fi
if [ "$mode" != verify ]; then
  args+=("$expected")
  if [ -n "$origin" ]; then args+=("$origin"); fi
fi
bun "$work/frontend-deploy.mjs" "${args[@]}"
REMOTE
