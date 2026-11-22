---
name: pr-summary
description: Write a pull request summary for the current branch - what changed, why, risks, how to test.
argument-hint: "[extra context, e.g. ticket link]"
disable-model-invocation: true
allowed-tools: Bash(bash .claude/skills/pr-summary/context.sh), Bash(git diff *), Bash(git log *), Read, Grep
---

Write a pull request description for the changes below.

## Git context

!`bash .claude/skills/pr-summary/context.sh`

## Extra context from the user

$ARGUMENTS

## Instructions

- Base it on the diff, not on guesses. If the diff was cut off, read the
  changed files you need before claiming anything about them.
- If there are no changes, say so and stop.
- Output only the PR description, in this shape:

```markdown
## What changed
<3-6 bullets, user-visible behavior first, then internals>

## Why
<1-3 sentences: the problem this solves>

## Risks
<what could break, migrations, config/env changes, anything reviewers should look at hard. "Low risk" is fine if true; say why>

## How to test
<numbered steps a reviewer can follow, including commands>
```
