#!/usr/bin/env bash
# Stop hook: runs every time Claude is about to finish its turn.
#
# If this session changed code (lint-file.sh left a "dirty" marker), run
# typecheck -> tests -> (build, if CLAUDE_VERIFY_BUILD=1) in each changed
# project. Any failure -> exit 2, which blocks Claude from finishing and
# hands it the failure output to fix. All green -> clear the marker, exit 0.
#
# Turns that didn't touch code (questions, planning) exit immediately.
# Retries are capped (CLAUDE_VERIFY_MAX_ATTEMPTS, default 3) so Claude can't
# loop forever; at the cap it may stop, and you get a warning instead.
#
# stdin JSON: {"session_id":"abc","stop_hook_active":false,...}
# stop_hook_active is true when Claude is already continuing because this
# hook blocked it before.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"

input="$(cat)"
need_jq "verify" || exit 0

session="$(printf '%s' "$input" | jq -r '.session_id // "unknown"')"
active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false')"
marker="$(marker_file "$session")"
attempts="$(attempts_file "$session")"
max="${CLAUDE_VERIFY_MAX_ATTEMPTS:-3}"

[ -s "$marker" ] || exit 0 # nothing changed: free

# A fresh stop (not a retry we caused) starts the count over.
[ "$active" = "true" ] || rm -f "$attempts"
n="$(cat "$attempts" 2>/dev/null || echo 0)"

if [ "$n" -ge "$max" ]; then
  rm -f "$attempts"
  msg="verify: checks still failing after $max attempts, so Claude was allowed to stop. Run .claude/hooks/check-ts.sh and .claude/hooks/test-ts.sh to see the failures."
  jq -n --arg m "$msg" '{systemMessage: $m}'
  exit 0
fi

out="$(mktemp)"
remaining="$(mktemp)"
trap 'rm -f "$out" "$remaining"' EXIT

steps="check-ts test-ts"
[ "${CLAUDE_VERIFY_BUILD:-0}" = "1" ] && steps="$steps build-ts"

failure=""
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  if [ -n "$failure" ] || [ ! -d "$dir" ]; then
    [ -d "$dir" ] && printf '%s\n' "$dir" >>"$remaining"
    continue
  fi
  for step in $steps; do
    if ! bash "$HERE/$step.sh" "$dir" >"$out" 2>&1; then
      failure="$step|$dir"
      printf '%s\n' "$dir" >>"$remaining"
      break
    fi
  done
done <"$marker"

if [ -z "$failure" ]; then
  rm -f "$marker" "$attempts"
  exit 0
fi

cp "$remaining" "$marker"
echo $((n + 1)) >"$attempts"
step="${failure%%|*}"
dir="${failure#*|}"
{
  echo "Verification failed: $step in $dir (attempt $((n + 1)) of $max)."
  echo "Last $TAIL_LINES lines of output:"
  tail -n "$TAIL_LINES" "$out"
  echo
  echo "Fix the cause, then re-run: bash .claude/hooks/$step.sh \"$dir\""
} >&2
exit 2
