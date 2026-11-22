---
name: review-checklist
description: What a good code review checks, ordered by how much it matters. Preloaded into the code-reviewer subagent.
user-invocable: false
---

# Review checklist

Work top to bottom. The top sections matter most; don't let style nits
crowd out a real bug.

## 1. Correctness (must-fix)
- Does it do what the task asked? Any requirement missed?
- Edge cases: empty, null/undefined, zero, one, many, very large, unicode,
  duplicates, concurrent calls, timeouts.
- Error paths: are errors caught where they can be handled, and surfaced
  (not swallowed)? Are async calls awaited?
- Off-by-one, wrong comparison, inverted condition, wrong variable.
- State: stale caches, missing cleanup, race conditions, double submit.

## 2. Security & data (must-fix)
- Untrusted input validated at the boundary (forms, API params, webhooks).
- Auth checks on every new endpoint or server action, not just in the UI.
- No secrets, tokens, or personal data in code, logs, or error messages.
- SQL/HTML/shell built from strings with user input.
- Migrations: reversible? Safe on a table with existing rows?

## 3. Tests (should-fix)
- New behavior has tests. Bug fixes have a test that failed before.
- Tests check behavior, not implementation details. No sleeps or flaky timing.

## 4. Design (should-fix)
- Fits existing patterns in the codebase, or has a reason not to.
- No duplicated logic that already exists somewhere else.
- Names say what things are. Functions do one thing.
- No dead code, commented-out code, or leftover debug logging.

## 5. Nits (optional)
- Formatting the linter didn't catch, wording, small readability wins.
  Label these clearly as nits.

## How to report
For each finding: **severity** (must-fix / should-fix / nit), **file:line**,
**what's wrong**, **a concrete failure case or why it matters**, and **a
suggested fix**. If you're not sure something is a bug, say so. If the
change looks good, say that plainly. Don't invent problems to fill space.
