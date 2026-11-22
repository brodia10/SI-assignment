# SI-assignment

## What this is
An iPad-first inventory app for a metal processor. It covers purchase orders, receiving into
locations, work orders (one item becomes many, and the cost carries over), sales orders shipped
by container, and reports on inventory and margin. It's an interview take-home for Savage
Innovations.

**The requirements are the source of truth.** Read them before planning any feature. If a derived doc disagrees
with them, the requirements win. Keep what the assignment says separate from decisions we made.
@docs/requirements.md

Our decisions and design: `README.md` (questions, assumptions), `docs/plan.md`, `docs/domain-glossary.md`.

## Tech stack
- API: ASP.NET Core on .NET 10 (minimal APIs, one endpoint group per feature), EF Core, SQL Server
- Web: React 19 + TypeScript + Vite, MUI, TanStack Query, React Router, openapi-fetch
- Auth: Firebase Authentication. The API validates Firebase ID tokens with JWT bearer auth. Roles
  live in SQL (`AppUser.Role`), not Firebase custom claims.
- Hosting: API on AWS Lambda, DB on RDS SQL Server Express (us-east-2), web on Firebase Hosting
- Package manager: **pnpm** (workspace root + `web/`). Don't use npm or yarn.

## Where things live
- `api/Savage.Api/Features/<Feature>/`: endpoints + logic for one feature (vertical slice)
- `api/Savage.Api/Domain/`: entities and pure business logic (e.g. `CostAllocator`)
- `api/Savage.Api/Data/`: DbContext, migrations, seed data
- `api/Savage.Api.Tests/`: xUnit tests
- `web/src/features/<feature>/`: screens for one feature (entry page is wired in already; add sub-routes inside it)
- `web/src/app/`: shell: `navigation.ts` (which role sees which lane), routes, layout, home tiles
- `web/src/components/`: shared touch-friendly UI (BigButton, PickList, WeightInput, ConfirmSummary, MoneyText,
  PageHeader), imported from `components/index.ts`
- `web/src/api/`: generated OpenAPI types (`schema.d.ts`, don't hand-edit) + client

## How things get done
- Install: `pnpm install` (root) and `dotnet restore api/SI.slnx`
- Dev: `pnpm dev:api` and `pnpm dev:web`
- Typecheck (web + api build): `pnpm typecheck`
- Test (vitest + xUnit): `pnpm test`
- Lint/format web: `pnpm -C web lint`
- Regenerate API types (API must be running): `pnpm -C web gen:api`

## Conventions
- **Money:** `decimal`. Store `TotalCost` on inventory items. Calculate $/lb only for display. Never
  store a rounded per-lb cost (the report has to show exactly $8,400.00).
- **Margin = profit ÷ revenue.** Scrap outputs of a work order get $0 cost, and non-scrap outputs share the
  input cost by weight. Any leftover fraction of a cent goes to the last output.
- **Posted records are locked:** receipts, work orders and sales orders are never edited or deleted.
  Corrections are voids. Posting runs in a transaction that checks item status.
- **iPad first:** touch targets ≥ 48px, pick lists over typing, a plain-English confirmation
  before anything is posted.
- Business logic goes in testable classes/functions, not inline in endpoints. Every rule that affects money
  gets a unit test.
- The end-to-end scenario test (README / assignment scenario) must stay green.

## Parallel lanes (git worktrees)
- Stay inside your feature folders (`Features/<X>/`, `features/<x>/`).
- **Don't add EF migrations or change entities in a lane.** If the schema has to change, stop and say so.
- Shared files (`Program.cs`, routes, nav, theme, shared components) were set up in Phase 1. Only
  touch them if the lane brief says so.

## Don't
- Commit secrets: `~/secrets/`, `.env*` (except `web/.env.production`, public values only), Firebase admin JSON. Local API secrets live in `dotnet user-secrets` (shared by all worktrees).
- Commit or push without being asked.

## Validation loop
Hooks in `.claude/settings.json` lint each edited file and run typecheck +
tests before Claude finishes a turn. C# edits also trigger it: `pnpm typecheck`/`pnpm test` run
`dotnet build`/`dotnet test`. If they fail, fix the cause; don't disable the hook.
