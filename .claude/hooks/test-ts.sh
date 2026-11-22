#!/usr/bin/env bash
# Run a JS/TS project's tests once (no watch mode).
# Usage: test-ts.sh [project-dir]   (defaults to the current directory)
# Runs the `test` script with CI=1, which tells Jest/Vitest not to watch.
# Skips quietly when there is no test script, or only npm's placeholder.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"

dir="$(cd "${1:-.}" 2>/dev/null && pwd)" || { log "test-ts: no such directory: ${1:-.}"; exit 1; }
[ -f "$dir/package.json" ] || { log "test-ts: skipped (no package.json in $dir)"; exit 0; }
command -v jq >/dev/null 2>&1 || { log "test-ts: jq is required (brew install jq)"; exit 1; }

body="$(script_body "$dir" test)"
if [ -z "$body" ]; then
  log "test-ts: skipped (no test script in $dir)"; exit 0
fi
if is_placeholder_test "$body"; then
  log "test-ts: skipped (test script is npm's placeholder)"; exit 0
fi

require_install "$dir" || exit 1
CI=1 run_pm_script "$dir" test
