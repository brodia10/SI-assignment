#!/usr/bin/env bash
# Prints the git context /pr-summary needs: base branch, commits, files, diff.
# The skill runs this before Claude sees the prompt, so Claude starts with the facts.
set -u
MAX_DIFF_LINES="${PR_SUMMARY_MAX_DIFF_LINES:-800}"

git rev-parse --git-dir >/dev/null 2>&1 || { echo "Not a git repository."; exit 0; }

base=""
for b in "$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)" origin/main origin/master main master; do
  [ -n "$b" ] && git rev-parse --verify --quiet "$b" >/dev/null && { base="$b"; break; }
done
branch="$(git branch --show-current 2>/dev/null)"

echo "Branch: ${branch:-detached HEAD}"
if [ -z "$base" ] || [ "$(git rev-parse HEAD 2>/dev/null)" = "$(git rev-parse "$base" 2>/dev/null)" ]; then
  echo "Base: none found (or HEAD is the base). Showing uncommitted changes only."
  range=""
else
  mb="$(git merge-base "$base" HEAD)"
  echo "Base: $base (merge-base ${mb:0:10})"
  range="$mb"
fi

echo
echo "## Commits"
if [ -n "$range" ]; then git log --no-decorate --format='- %h %s' "$range..HEAD"; else echo "(none)"; fi

echo
echo "## Uncommitted changes"
git status --short || true

echo
echo "## Files changed"
if [ -n "$range" ]; then git diff --stat "$range"; else git diff --stat HEAD 2>/dev/null; fi

echo
echo "## Diff (first $MAX_DIFF_LINES lines)"
if [ -n "$range" ]; then git diff "$range"; else git diff HEAD 2>/dev/null; fi | head -n "$MAX_DIFF_LINES"
