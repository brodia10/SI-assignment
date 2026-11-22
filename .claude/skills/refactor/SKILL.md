---
name: refactor
description: Safely restructure code without changing behavior - green baseline first, small verified steps, no behavior changes. Use when asked to refactor, clean up, extract, rename, or reorganize code.
argument-hint: "<what to refactor and why>"
---

Refactor: **$ARGUMENTS**

A refactor changes how code is organized, never what it does. Every step
below protects that.

1. **Baseline.** Run `bash .claude/hooks/check-ts.sh` and
   `bash .claude/hooks/test-ts.sh` before touching anything.
   - If they fail, stop and tell the user. Don't refactor on red; you
     won't be able to tell what you broke.
   - If the code you're changing has no tests, say so and offer to add
     characterization tests first (tests that pin down current behavior,
     even odd behavior).
2. **Plan the steps.** List small moves (rename, extract function, move
   file...). Each one should leave the code working.
3. **One step at a time.** Make a step, run typecheck + tests, then the
   next step. If a step breaks things and the fix isn't obvious, undo it
   and take a smaller step.
4. **No behavior changes.** No bug fixes, new features, or changed outputs,
   even ones that look like improvements. If you spot a bug, note it for
   the user and keep it as is.
5. **Finish** with the list of steps taken, anything you noticed but didn't
   change, and final green check/test output.
