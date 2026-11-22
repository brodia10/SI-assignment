#!/usr/bin/env bash
# Shared helpers for the hook scripts. Other scripts `source` this file;
# you never run it directly. Kept bash 3.2-safe (the macOS default shell).

# Where hooks keep per-session notes ("this session changed code").
STATE_DIR="${CLAUDE_VERIFY_STATE_DIR:-${TMPDIR:-/tmp}/claude-verify}"
# How many lines of failure output to hand back to Claude.
TAIL_LINES="${CLAUDE_VERIFY_TAIL_LINES:-60}"

log() { printf '%s\n' "$*" >&2; }

# git_root DIR -> top of the git repo containing DIR (empty if none).
git_root() { git -C "$1" rev-parse --show-toplevel 2>/dev/null; }

# nearest_pkg DIR -> closest directory at or above DIR with a package.json.
nearest_pkg() {
  local d="$1"
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    [ -f "$d/package.json" ] && { printf '%s\n' "$d"; return 0; }
    d="$(dirname "$d")"
  done
  return 1
}

# detect_pm DIR -> npm | pnpm | yarn | bun, from the nearest lockfile.
detect_pm() {
  local d="$1"
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    [ -f "$d/pnpm-lock.yaml" ] && { echo pnpm; return; }
    [ -f "$d/yarn.lock" ] && { echo yarn; return; }
    { [ -f "$d/bun.lock" ] || [ -f "$d/bun.lockb" ]; } && { echo bun; return; }
    [ -f "$d/package-lock.json" ] && { echo npm; return; }
    d="$(dirname "$d")"
  done
  echo npm
}

# script_body DIR NAME -> the package.json script text (empty if missing).
script_body() { jq -r --arg n "$2" '.scripts[$n] // empty' "$1/package.json" 2>/dev/null; }
has_script() { [ -n "$(script_body "$1" "$2")" ]; }

# npm init writes a placeholder test script that always fails. Treat it as "no tests".
is_placeholder_test() { case "$1" in *"no test specified"*) return 0 ;; esac; return 1; }

# has_dep DIR NAME -> true if package.json in DIR lists NAME in any deps block.
has_dep() {
  jq -e --arg n "$2" \
    '[.dependencies, .devDependencies, .peerDependencies, .optionalDependencies]
     | map(select(. != null) | has($n)) | any' "$1/package.json" >/dev/null 2>&1
}

# find_bin DIR NAME -> path to node_modules/.bin/NAME at or above DIR (stops at git root).
find_bin() {
  local d="$1" stop
  stop="$(git_root "$1")"
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    [ -x "$d/node_modules/.bin/$2" ] && { printf '%s\n' "$d/node_modules/.bin/$2"; return 0; }
    [ -n "$stop" ] && [ "$d" = "$stop" ] && break
    d="$(dirname "$d")"
  done
  return 1
}

# require_install DIR -> fails with a clear message when dependencies aren't installed.
require_install() {
  local d="$1" stop
  stop="$(git_root "$1")"
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    [ -d "$d/node_modules" ] && return 0
    [ -n "$stop" ] && [ "$d" = "$stop" ] && break
    d="$(dirname "$d")"
  done
  log "Dependencies are not installed in $1. Run: (cd \"$1\" && $(detect_pm "$1") install)"
  return 1
}

# run_pm_script DIR NAME -> runs `<pm> run NAME` inside DIR, passing its exit code through.
run_pm_script() {
  local pm
  pm="$(detect_pm "$1")"
  log "\$ $pm run $2   (in $1)"
  (cd "$1" && "$pm" run "$2")
}

# Per-session "dirty" marker: a file listing the project roots changed this session.
marker_file() { printf '%s/%s.dirty\n' "$STATE_DIR" "$1"; }
attempts_file() { printf '%s/%s.attempts\n' "$STATE_DIR" "$1"; }

mark_dirty() {
  local f
  mkdir -p "$STATE_DIR" || return 0
  f="$(marker_file "$1")"
  grep -qxF "$2" "$f" 2>/dev/null || printf '%s\n' "$2" >>"$f"
}

need_jq() {
  command -v jq >/dev/null 2>&1 && return 0
  log "$1: jq is not installed, so this hook is skipped. Install it with: brew install jq"
  return 1
}
