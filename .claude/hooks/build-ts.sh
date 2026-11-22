#!/usr/bin/env bash
# Build a JS/TS project.
# Usage: build-ts.sh [project-dir]   (defaults to the current directory)
# Runs the `build` script. Skips quietly when there isn't one.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"

dir="$(cd "${1:-.}" 2>/dev/null && pwd)" || { log "build-ts: no such directory: ${1:-.}"; exit 1; }
[ -f "$dir/package.json" ] || { log "build-ts: skipped (no package.json in $dir)"; exit 0; }
command -v jq >/dev/null 2>&1 || { log "build-ts: jq is required (brew install jq)"; exit 1; }

has_script "$dir" build || { log "build-ts: skipped (no build script in $dir)"; exit 0; }
require_install "$dir" || exit 1
run_pm_script "$dir" build
