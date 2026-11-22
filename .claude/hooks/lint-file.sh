#!/usr/bin/env bash
# PostToolUse hook: runs after Claude edits or writes a file.
#
# 1. If the file is JS/TS, lint + format just that one file (fast, ~1s).
#    Uses whatever the project already has installed: Biome if present,
#    otherwise Prettier and/or ESLint. Problems -> exit 2, which sends the
#    error text straight back to Claude so it fixes them.
# 2. Records "this session changed code in <project>" so the Stop hook
#    (verify.sh) knows it has to run the full typecheck + tests.
#
# Claude Code passes the event as JSON on stdin, e.g.
#   {"session_id":"abc","tool_name":"Edit","tool_input":{"file_path":"/x/src/a.ts",...}}
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"

input="$(cat)"
need_jq "lint-file" || exit 0

file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"
session="$(printf '%s' "$input" | jq -r '.session_id // "unknown"')"

[ -n "$file" ] && [ -f "$file" ] || exit 0

# Project-local addition (SI-assignment): a C# edit marks the repo root dirty so the
# Stop hook runs the root typecheck/test scripts, which include dotnet build/test.
case "$file" in
  */bin/* | */obj/*) exit 0 ;;
  *.cs | *.csproj)
    root="$(git_root "$(dirname "$file")")"
    [ -n "$root" ] && [ -f "$root/package.json" ] && mark_dirty "$session" "$root"
    exit 0
    ;;
esac

case "$file" in
  */node_modules/* | */dist/* | */.next/*) exit 0 ;;
  *.ts | *.tsx | *.mts | *.cts | *.js | *.jsx | *.mjs | *.cjs) ;;
  *) exit 0 ;; # not code we know how to check
esac

fdir="$(cd "$(dirname "$file")" && pwd)"
pkg="$(nearest_pkg "$fdir")" || exit 0 # code outside any JS project: nothing to run
root="$(git_root "$fdir")"

# Mark dirty. Prefer the repo root when it has a package.json (monorepo root
# scripts usually check every package); otherwise the file's own package.
if [ -n "$root" ] && [ -f "$root/package.json" ]; then
  mark_dirty "$session" "$root"
else
  mark_dirty "$session" "$pkg"
fi

[ "${CLAUDE_LINT_ON_EDIT:-1}" = "1" ] || exit 0

# Is TOOL a declared dependency of this package or the repo root?
declared() {
  has_dep "$pkg" "$1" && return 0
  [ -n "$root" ] && [ -f "$root/package.json" ] && has_dep "$root" "$1"
}
eslint_configured() {
  local d="$pkg" f
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    for f in "$d"/eslint.config.* "$d"/.eslintrc*; do
      [ -e "$f" ] && return 0
    done
    [ -n "$root" ] && [ "$d" = "$root" ] && break
    d="$(dirname "$d")"
  done
  jq -e '.eslintConfig' "$pkg/package.json" >/dev/null 2>&1
}

out="$(mktemp)"
trap 'rm -f "$out"' EXIT
failed=""

if declared "@biomejs/biome" && bin="$(find_bin "$pkg" biome)"; then
  (cd "$pkg" && "$bin" check --write "$file") >"$out" 2>&1 || failed="biome"
else
  if declared prettier && bin="$(find_bin "$pkg" prettier)"; then
    (cd "$pkg" && "$bin" --write --log-level warn "$file") >>"$out" 2>&1 || failed="prettier"
  fi
  if [ -z "$failed" ] && declared eslint && eslint_configured && bin="$(find_bin "$pkg" eslint)"; then
    (cd "$pkg" && "$bin" --fix "$file") >>"$out" 2>&1 || failed="eslint"
  fi
fi

if [ -n "$failed" ]; then
  {
    echo "$failed found problems in $file that it couldn't auto-fix:"
    tail -n "$TAIL_LINES" "$out"
  } >&2
  exit 2
fi
exit 0
