---
name: handoff
description: Save where this task stands to .claude/handoff.md so a fresh session (after /clear) can pick it up.
disable-model-invocation: true
allowed-tools: Write, Bash(git status *), Bash(git diff *), Bash(git log *)
---

Write `.claude/handoff.md` so that a new session with no memory of this one
can continue the work. Overwrite the file if it exists. It is gitignored.

Current git state, for reference:

!`git status --short 2>/dev/null; echo; git log --oneline -5 2>/dev/null`

Use exactly these sections, and keep the whole file under ~60 lines:

```markdown
# Handoff - <one-line task name>
_Written <date/time>, branch <branch>_

## Goal
<what we're trying to achieve and why, 1-3 sentences>

## Done
<bullets, with file paths>

## In progress
<what was half-finished when we stopped, exactly where>

## Next steps
<numbered, concrete, first step first>

## Decisions
<choices made and the reason, so they don't get re-argued>

## Gotchas
<things that surprised us, commands that failed, dead ends not to retry>
```

Facts only, from this conversation and the repo. No speculation. Then tell
the user: "Saved. Run /clear, then /catchup."
