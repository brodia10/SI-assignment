# Process Log — Savage Innovations Technical Assignment

A running record of how I approached the assignment, written as I go. Source material
for the README ("assumptions", "how I used AI tools") and for the review-meeting walkthrough
("how you took in the requirements").

## Phase 1 — Understand the business before anything technical

**Goal:** understand the business, its goals, and its requirements before thinking about
technology.

1. **Read the requirements end to end.**
2. **Drew the business workflow by hand** in my notebook, with the requirements written
   next to it. That made the flow concrete before any technical decisions:
   Purchase (PO) → Receive (inventory at a location) → Process (work order: 1 → many)
   → Sell/Ship (sales order, container) → Report (inventory, cost, margin).
3. **Used Claude Code as a requirements interviewer.** I gave it the PDF and asked
   it to interview me to find gaps and ambiguities. I told it explicitly not to build
   anything yet. The point was to stress-test my understanding of the business the way
   a client discovery session would, before I committed to a data model or stack decisions.

4. **Admitted the domain gap and built a glossary first.** I don't know metal processing,
   so before answering any design questions I defined every business term (PO, WO, SO,
   receiving, coil, slitting, scrap, cost basis, margin, etc.) in `domain-glossary.md`.
   I can't make good decisions about a business I can't describe.
5. **Sorted the open questions** into three groups: ones the requirements already answer
   (directly or by implication), ones I'll decide and list as assumptions, and a short list worth
   asking the client (Savage's Product Partner). In the real job I'd take that last group to
   client discovery.
6. **Emailed the client.** I sent Joe English three questions, each with my
   working assumption so I'm not blocked: (a) can the purchaser edit $/lb on POs/SOs,
   (b) block or allow weight differences, (c) can part of an item be sold. Everything else
   was either answered by the requirements or is a decision I own and will document.

7. **Was honest about my own gap.** I last used .NET about 5 years ago, so the backend gets
   time first and stays conventional. Plain, standard code is also what "easy to change" means
   to a .NET shop.
8. **Researched industry conventions instead of guessing.** I didn't know how this kind of
   business handles mistakes, so I looked at how ERPs and warehouse systems do it and adopted their
   patterns: draft until posted, then locked; corrections by void/reversal only when nothing
   downstream has used the result; admin-only voids; every record stamped with who and when.
   Locations are admin-managed master data. Vendors can be quick-added by the purchaser,
   which is a deliberate trade-off against segregation-of-duties convention, explained in the
   README.

## Phase 2 — Plan the build

9. **Wrote the build plan before writing code** ([plan.md](plan.md)). Main decisions:
   - Build a walking skeleton first: deploy login + API + database before any features, so
     hosting surprises show up early.
   - Write the example scenario as an automated test that asserts every number in the PDF.
     That test is what "done" means.
   - Freeze the shared pieces (schema, routes, shared UI) first, then split the features into
     four lanes that run in parallel in separate git worktrees, each with its own Claude Code
     session.
10. **Reused my own agentic-workflows kit** (validation hooks, skills, review agents) and
    extended it for this project so the .NET side gets the same automatic build and test checks
    as the React side.

## Phase 3 — Set up and ramp up

11. **Refreshed on Firebase before building on it.** I hadn't used Firebase in a while. After
    creating the project, I watched some of Firebase's official videos and read their docs to
    get familiar with it again, so I'd understand the auth flow I was wiring up instead of
    copying it.
12. **Chose email/password sign-in for now, on purpose.** I don't know whether the client's
    users have Microsoft accounts (Microsoft 365 / Entra ID) or another account that would be
    easier to sign in with. Email/password needs the least configuration and works for everyone. Given
    "hard to get wrong," I'd prefer single sign-on with whatever account they already use:
    a field user can't forget a password they never had to make. It's also more secure (no
    passwords to reuse, phish, or guess, and it inherits their organization's MFA), so I'd
    push for it down the line. Firebase supports Microsoft
    and Google sign-in, so this is a configuration change once we know what they use. In the
    meantime, a "Forgot password?" link reduces the risk.

## Phase 4 — Build workflow

13. **One task = one git worktree = one branch = one Claude Code session = one PR.** I create
    each task's branch as its own worktree with CodeRabbit's worktree tool (`git gtr`), so several
    tasks can run side by side in separate folders without stashing or switching branches:
    - `git gtr new <branch>` creates the worktree and branch. The tool's config copies my local
      env file in and installs dependencies (`pnpm install`, `dotnet restore`).
    - `git gtr ai <branch>` starts Claude Code in that worktree. It gets the project's hooks,
      skills and agents automatically, because they're committed files.
    - Inside it: `/feature` explores, plans and waits for my approval before building. The
      validation hooks block finishing while the build or tests fail. The `code-reviewer` agent
      reviews the diff. `/pr-summary` writes the PR description, and `gh pr create` opens it.
    - I review and merge the PR, then `git gtr rm <branch>` cleans up the worktree.
    - Shared pieces (schema, routes, shared components) are built first, so parallel worktrees
      each stay in their own feature folder and don't conflict.

**My principle:** once I understand the business goals, or one part of them, my next goal is
to find the known unknowns and resolve them, by answering them myself or by asking the
client.

## Open questions / assumptions

_(Filled in during the interview. Each item is either an assumption to document in the README or
a question worth sending to Savage.)_
