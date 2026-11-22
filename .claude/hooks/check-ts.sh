#!/usr/bin/env bash
# Typecheck a JS/TS project.
# Usage: check-ts.sh [project-dir]   (defaults to the current directory)
# Runs the `typecheck` script if package.json has one, otherwise `tsc --noEmit`.
# Skips quietly (exit 0) when there is nothing to check.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"

dir="$(cd "${1:-.}" 2>/dev/null && pwd)" || { log "check-ts: no such directory: ${1:-.}"; exit 1; }
[ -f "$dir/package.json" ] || { log "check-ts: skipped (no package.json in $dir)"; exit 0; }
command -v jq >/dev/null 2>&1 || { log "check-ts: jq is required (brew install jq)"; exit 1; }

if has_script "$dir" typecheck; then
  require_install "$dir" || exit 1
  run_pm_script "$dir" typecheck
elif [ -f "$dir/tsconfig.json" ]; then
  require_install "$dir" || exit 1
  tsc="$(find_bin "$dir" tsc)" || { log "check-ts: tsconfig.json found but typescript isn't installed"; exit 1; }
  log "\$ tsc --noEmit   (in $dir)"
  (cd "$dir" && "$tsc" --noEmit)
else
  log "check-ts: skipped (no typecheck script or tsconfig.json in $dir)"
  exit 0
fi
