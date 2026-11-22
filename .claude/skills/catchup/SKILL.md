---
name: catchup
description: Rebuild context at the start of a session - read the handoff note and recent git changes, then report where things stand.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git status *), Bash(git diff *), Bash(git log *)
---

You are starting fresh. Get up to speed before doing anything else.

## Handoff note

!`cat .claude/handoff.md 2>/dev/null || echo "(no .claude/handoff.md - rely on git below)"`

## Git state

!`git branch --show-current 2>/dev/null; git status --short 2>/dev/null; echo; git log --oneline -10 2>/dev/null; echo; git diff --stat HEAD 2>/dev/null`

## Instructions

1. Read the files the handoff note and the diff point to. Only what you need.
2. Check the note against reality: if git shows work the note doesn't
   mention (or the reverse), say so.
3. Reply with, at most ~15 lines:
   - **Task:** one line
   - **State:** done / in progress, in a few bullets
   - **Next:** the first concrete step you'd take
   - **Questions:** anything unclear (omit if none)
4. Stop and wait. Don't start the next step until the user says go.

$ARGUMENTS
