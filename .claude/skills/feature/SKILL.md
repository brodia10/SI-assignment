---
name: feature
description: Build a feature end to end - explore, plan, get approval, implement, verify, review, PR summary.
argument-hint: "<what to build>"
disable-model-invocation: true
---

Build this feature: **$ARGUMENTS**

If that's empty, ask what to build and stop.

Work through these phases in order. Don't skip ahead.

## 1. Explore
- Read CLAUDE.md, then the code this feature touches. Find an existing
  feature that works similarly and follow its patterns.
- Note the commands for typecheck/test/build (CLAUDE.md or package.json).

## 2. Plan, then wait
- Write a short plan: files to add or change, the approach, how it will be
  tested, and open questions.
- **Stop and wait for the user to approve the plan.** If you're in plan
  mode, present it with ExitPlanMode. Change the plan if they push back.

## 3. Implement
- Small steps. Add or update tests alongside the code, not at the end.
- Match the existing style. Don't refactor unrelated code.

## 4. Verify
- Run `bash .claude/hooks/check-ts.sh` and `bash .claude/hooks/test-ts.sh`
  (or delegate to the `verifier` subagent to keep long output out of this
  conversation). Fix failures until both are green.
- The Stop hook will also block you from finishing while they fail.

## 5. Review
- Ask the `code-reviewer` subagent to review the diff.
- Fix every finding marked must-fix. For the rest, fix or explain why not.

## 6. Wrap up
- Summarize what you built in a few lines, then write a PR description in
  the `/pr-summary` format: What changed / Why / Risks / How to test.
- Don't commit or push unless the user asks.
