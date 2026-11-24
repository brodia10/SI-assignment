# Savage Innovations: Metal Processing App

An iPad-first inventory app for a metal processor. A purchaser writes purchase orders at the
supplier, receives the material into bays and racks, runs work orders that turn one coil into
many, and ships sales orders by container. An admin manages products, prices and users, and
sees inventory and margin reports. Every item can be traced from its PO, through work orders,
to the sales order it shipped on.

## For reviewers

**Live app:** https://si-assignment.web.app (best on an iPad, or a desktop browser at iPad size)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `SteelCoil-Admin-2201` |
| Purchaser | `purchaser@example.com` | `SteelCoil-Buyer-2201` |

These are demo-only accounts.

**The example scenario is already loaded as sample data.** Sign in as the admin and open
**Reports** to see it straight away: SO #5001 cost $8,400.00, sold for $10,890.00, profit
$2,490.00, margin 22.9%. Inventory is the aluminum in Rack 1, two slit coils in Rack 4 and the scrap.
**Trace an item** follows C-1003 back to PO #2201 and forward to SO #5001. The products, prices,
locations, supplier and customer are seeded too.

To walk the scenario yourself, follow the steps below. Because #2201 and #5001 already exist,
your run gets the next numbers (PO #2202, tag C-1008, WO #1002, SO #5002) with the same amounts.
On a fresh database (see [Setup](#setup)), `seed-scenario` or a manual run produces exactly
#2201, C-1001, WO #1001 and SO #5001.

### Walk the example scenario

| Step | Sign in as | Where | What you should see |
|---|---|---|---|
| 1. Products and prices; invite a purchaser | Admin | **Admin → Products & prices**, **Admin → Users** | The four scenario products at $0.42, $1.35, $0.55 and $0.15/lb. Inviting a user gives you a set-password link to pass on. |
| 2. Write the PO (#2201 in the sample data) | Purchaser | **Purchasing → New PO** | Pick Great Lakes Steel Supply, add 40,000 lbs Hot-Rolled Steel Coil (prices fill in from the product) and 5,000 lbs Aluminum Sheet. **PO total $23,550.00.** |
| 3. Receive | Purchaser | **Receiving** | Pick your PO. The coil goes into Bay 2 and gets the next tag (**C-1001** in the sample data). The aluminum goes into Rack 1. |
| 4. Work order | Purchaser | **Processing** | Input the steel coil you just received. Outputs: four 9,900 lb 12" Slit Coils into Rack 4, and 400 lbs of Steel Scrap into the Scrap Bin. Each slit coil carries **$4,200.00** (about $0.424/lb), and the scrap carries $0. |
| 5. Ship the sales order (#5001 in the sample data) | Purchaser | **Sales → New sales order** | Pick Buckeye Fabrication and two slit coils at $0.55/lb. **19,800 lbs, $10,890.00.** |
| 6. Reports | Admin | **Reports** | **Inventory** by product and location. **Sales & margin**: your sales order cost **$8,400.00**, sold for **$10,890.00**, profit **$2,490.00**, margin **22.9%**. **Trace an item**: pick one of the coils you sold to follow it back through the work order and receipt to the PO, and forward to the sales order. |

Every post (PO, receipt, work order, sale) shows a plain-English confirmation first, and posted
records are locked after that. Leaving a half-written PO, work order or sales order asks first,
and a removed line can be undone.

**Where to look in the code:** the whole scenario runs through the real handlers in
[`ScenarioSeederTests.cs`](api/Savage.Api.Tests/Data/ScenarioSeederTests.cs), which checks every
number in the assignment from the reports. The money rules are in
[`Domain/CostAllocator.cs`](api/Savage.Api/Domain/CostAllocator.cs) and
[`Features/Reports/ProfitMath.cs`](api/Savage.Api/Features/Reports/ProfitMath.cs). The reports and
the item trace are tested against a real SQL Server in
[`SalesAndReportsScenarioTests.cs`](api/Savage.Api.Tests/Features/SalesAndReportsScenarioTests.cs).

## What I built, and what I skipped

**Built:** everything in the requirements' core list, for both roles:

- **Purchasing:** POs with product pick lists, prices pre-filled from the product (editable), live
  line and PO totals, and quick-add for a new supplier. Lines can be changed or removed (with Undo)
  until you tap Create PO. Any PO opens to show what each line became: its tag, location, and
  whether it's in stock, processed or sold.
- **Receiving:** pick a PO, then pick a location for each line (the list folds once picked). The
  weight starts as the PO weight and can be changed to what the scale shows, with a warning if they
  differ. Each line becomes a tagged inventory item. "Recently received" brings a receipt's tags
  back after the fact.
- **Processing:** pick one item in, add many items out. A live balance bar shows the input weight
  against the outputs. Outputs heavier than the input are blocked, and lighter ones get a yield-loss
  warning. Cost is split automatically. The location is suggested: the Scrap Bin for scrap,
  otherwise wherever the last output went.
- **Sales:** pick a customer and in-stock items, enter the container number, and ship. The purchaser
  sees revenue but not cost.
- **Reports (admin):** inventory by product and location, sales with cost, profit and margin per
  order, and an item trace.
- **Admin:** products and prices, locations, vendors, and users (invite, change role, turn off).
  Roles are checked by the API on every request, not just hidden in the UI.
- **iPad design:** 48px+ touch targets, number pads instead of keyboards for weights and prices,
  pick lists instead of typing, the main action in the same bottom bar on every form, a
  plain-English confirmation before anything is posted, and the same success screen after.
  Leaving a half-written PO, work order or sales order asks first (in-app navigation, the back
  swipe and Sign out; Safari on iPad doesn't allow a prompt on reload).
- **Sample data:** the live app has the example scenario loaded (I ran it through the app's screens).
  For any other database, `seed-scenario` loads it through the same code the screens use, after
  checking that the setup data is as seeded.
- **Delivery:** CI on every PR (lint, typecheck, about 400 tests), preview deploys, and auto-deploy
  on merge (API to AWS Lambda, web to Firebase Hosting).

**Skipped, on purpose:**

| Skipped | Why |
|---|---|
| **Voids** (correcting a posted record) | The data model is ready for them: every document (PO, work order, sales order) records who voided it, when and why, and items have a `Voided` status. The screen and the "only if nothing downstream used it" check weren't needed for the scenario, so they're first on the next list. Until then a mistake needs a database fix. |
| **Partial receiving** | The scenario receives a whole PO at once. Partial deliveries add a "received so far" state to every line, which is worth asking the client about first. |
| **Selling part of an item** | Items are sold whole (one of my client questions). Splitting an item for sale can already be done with a work order. |
| **Photos, QR labels, offline** | The requirements list them as optional extras, to do only once the core is done. I spent that time on the iPad walkthrough and fixing what it found instead. |
| **Editing an Open PO** | A PO is checked on a confirmation screen before it's created. Changing it afterwards, before it's received, would come with voids. |
| **Single sign-on** | It depends on which accounts the client's users already have (see Sign-in below). |

## Data model

Each physical piece of metal is one `InventoryItem` with a floor tag. Every item has exactly
one source, a PO line or a work order, so following the links back from any item always ends
at a PO.

```
Vendor (supplier)
  └─ PurchaseOrder #2201 ─┬─ PurchaseOrderLine: Hot-Rolled Steel Coil, 40,000 lbs @ $0.42
                          └─ PurchaseOrderLine: Aluminum Sheet, 5,000 lbs @ $1.35
                                       → InventoryItem C-1002 (Rack 1, $6,750, InStock)
                                 │ steel coil line received as
                                 ▼
                          InventoryItem C-1001 (Bay 2, 40,000 lbs, TotalCost $16,800, Consumed)
                                 │ input of
                                 ▼
                          WorkOrder #1001 ── outputs (SourceWorkOrderId = #1001):
                                 C-1003 … C-1006  12" Slit Coil, 9,900 lbs, $4,200 each (Rack 4)
                                 C-1007           Steel Scrap, 400 lbs, $0 (Scrap Bin)
                                 │ C-1003, C-1004 sold on
                                 ▼
Vendor (customer)
  └─ SalesOrder #5001 ── SalesOrderLine per item: lbs, $/lb, Revenue, Cost (copied at posting)
```

- **Cost is stored as `TotalCost` on the item**, never as a rounded $/lb, so the report adds up
  to exactly $8,400.00. $/lb is only calculated for display.
- **Status** (`InStock`, `Consumed`, `Sold`) is what stops an item from being used twice. Posting
  checks it inside a transaction, and a row version catches two iPads racing for the same coil.
- **A sales line copies its cost and revenue at posting**, so the margin report reads stored
  numbers instead of recalculating them.
- **Document numbers and tags come from SQL Server sequences** that start at 2201, 1001 and 5001,
  so the demo produces the scenario's numbers.
- **Every document records who created it and when** (`AuditedDocument`), plus the void fields above.

## Code layout

```
api/Savage.Api/
  Domain/      entities + pure business rules (CostAllocator), no database code
  Features/    one folder per feature: Purchasing, Receiving, Processing, Sales, Reports, Users, …
               endpoints, plus services and rules in small testable classes where there's logic
  Data/        DbContext, EF configurations, migrations, seed data (ReferenceData)
api/Savage.Api.Tests/   xUnit: unit tests for every money rule, plus SQL Server tests (Testcontainers)
web/src/
  features/    one folder per screen group (admin covers products, locations, vendors and users)
  components/  shared touch UI: BigButton, PickList, WeightInput (number pad), ConfirmSummary, MoneyText
  api/         TypeScript types generated from the API's OpenAPI document, so the two can't drift
```

Each feature is a vertical slice: a change to sales touches `Features/Sales/` and
`features/sales/` and little else. Every rule that affects money is in a plain function or class
with its own unit tests (`CostAllocator`, `ProfitMath`, `PurchaseOrderMath`, `SalesOrderRules`,
`WorkOrderPlanner`).

## How I approached this

I start with the business, not the technology. My process:

1. **Understand the business and its goals.** I read the requirements end to end, then
   drew the business workflow by hand alongside the requirements (Purchase → Receive →
   Process → Sell/Ship → Report). I didn't know metal processing, so I wrote a
   [domain glossary](docs/domain-glossary.md) defining every term (PO, WO, SO, slitting,
   scrap, cost basis, margin, etc.) before making any design decisions.
2. **Find the known unknowns and resolve them.** Once I understand the business, or a part
   of it, my next goal is to list what I *know I don't know* and answer each item. I sort them
   into:
   - **Answered by the requirements**, directly or by clear implication (e.g., the scenario
     shows scrap carries $0 cost, and "pick lists instead of typing" means IDs are generated).
   - **Decisions I own**, made and documented below as assumptions.
   - **Questions for the client.** These are only the ones that change the data model or the report
     numbers. I emailed these to Joe English with my working assumption for each, so I wasn't
     blocked waiting on a reply.

A running record is in [docs/process-log.md](docs/process-log.md).

## Questions asked of the client

| Question | My working assumption | Answer |
|---|---|---|
| Can the purchaser change $/lb on a PO/SO from the product's default price? | Yes: defaults from the product, editable | _pending_ |
| If the received weight doesn't match the PO, or work order outputs don't add up to the input, block or allow? | Allow with a warning; record the difference | _pending_ |
| Can part of an inventory item be sold, or is an item always sold whole? | Always sold whole | _pending_ |

## Assumptions

- **Scrap costing:** I followed the example scenario. The good outputs of a work order carry
  the full input cost and scrap carries $0, so scrap sales are 100% margin. In production I'd
  discuss scrap-credit costing with the client.
- **Cost rounding:** each good output's share is rounded *down* to the cent and the leftover
  goes to the last good output, so the outputs always add up to the input cost exactly and no
  output can end up with a negative cost. A work order must have at least one non-scrap
  output; otherwise the input cost would have nowhere to go.
- **Margin** is profit ÷ sale price (matches the scenario's 22.9%).

### Making it hard to get wrong

I didn't know this industry's conventions, so I researched how ERP and warehouse systems
handle mistakes and followed them:

- **Prevent first.** Pick lists, prices and weights filled in from what's already known, live totals,
  and a plain-language confirmation screen before anything is saved ("Receive 40,000 lbs
  Hot-Rolled Steel Coil into Bay 2?").
- **Records are draft until posted, then locked.** A PO's lines can be changed until it's created
  (editing an Open PO afterwards isn't built yet). A receipt,
  a completed work order, or a shipped sales order is never edited or deleted. This is standard
  ERP practice because it keeps costs and the audit trail correct.
- **Corrections are voids, not edits** (designed into the data model, not built yet; see
  "What I skipped"). A mistake is fixed by voiding the transaction, which
  reverses its inventory effect and records who did it, when, and why. Then you redo it.
  A void is allowed only if nothing later has used the result (e.g., you can't void a
  work order if one of its slit coils has already shipped). That rule is how mainstream ERPs
  (Infor, Business Central) handle it, and it stops cost data from going inconsistent.
  Only admins can void, because corrections should be rare and authorized.
- **Weight checks.** At receiving, the weight starts as the PO weight and can be changed to what
  the scale shows. The app warns if they differ. The item records the scale weight, and the PO keeps
  the ordered weight, so the difference is on file. The item's **cost stays at the PO line total**
  (what was agreed with the supplier), because the requirements say each item "keeps its cost from
  the PO". They don't say whether cost should follow the scale weight instead (received lbs × PO
  $/lb), so that's worth confirming with the client. A work order **blocks** outputs that weigh more
  than the input (you can't create metal) and **warns** if they weigh less (yield loss).
- **Receiving is all or nothing.** A PO is received in one step, with every line at once. Partial
  deliveries aren't supported yet.
- **Every document (PO, work order, sales order) stores who created it and when.**

### Hosting

- **Front end:** Firebase Hosting. **API:** AWS Lambda (ASP.NET Core). **Database:** Amazon RDS for
  SQL Server Express, in the us-east-2 (Ohio) region.
- For a Microsoft-stack client I'd deploy to **Azure App Service + Azure SQL**. It's the same .NET 10
  + SQL Server code, so moving means changing the connection string and the hosting setup, not the
  application.
- **Security trade-off:** the database accepts connections from the internet, protected by a strong
  password and an encrypted connection, instead of sitting on a private network. A private network
  would need a paid NAT gateway so the API could still reach Google to check sign-in tokens.
  The connection is encrypted (`Encrypt=True`) but doesn't yet validate the RDS certificate
  (`TrustServerCertificate=True`). In production I'd keep the database private and turn certificate
  validation on.

### Sign-in

- **Email and password** via Firebase Authentication. It needs the least configuration, and I don't
  know which third-party accounts (Microsoft 365, Google, etc.) the client's users have.
- For "hard to get wrong," single sign-on with an account users already have would be better,
  because a field user can't forget a password they never created. It's also more secure: no
  passwords to reuse, phish, or guess, and users get whatever multi-factor authentication and
  account policies their organization already enforces. Firebase supports Microsoft and
  Google sign-in, so it's a configuration change once we know. Until then, the login screen has a
  "Forgot password?" link.

### Vendors and locations

- **Locations** (bays, racks, bins) are fixed physical places. Admin manages them (seeded),
  and the purchaser only picks from the list.
- **Vendors:** convention keeps vendor creation away from purchasers so no one can invent a
  supplier and pay it. But purchasing happens in person, sometimes at new suppliers, and this
  app doesn't pay anyone. So the purchaser can quick-add a vendor by name while writing a PO,
  and admin sees and manages the full vendor list.

## Setup

### Run it locally

Local runs use the real Firebase project for sign-in and a SQL Server container for data. No
Firebase admin key is needed. The API checks sign-in tokens against Google's public keys, and
the local database only needs a row for each demo account so the API knows its role.

**Prerequisites:** [.NET 10 SDK](https://dotnet.microsoft.com/download), Node 22+,
[pnpm](https://pnpm.io/installation), and Docker ([OrbStack](https://orbstack.dev) or Docker
Desktop). On Apple Silicon, SQL Server runs under Rosetta: OrbStack handles that automatically,
and in Docker Desktop you turn on "Use Rosetta" in settings.

From the repo root:

```sh
# 1. Dependencies and the pinned .NET tools (dotnet-ef)
pnpm install
dotnet restore api/SI.slnx
dotnet tool restore

# 2. SQL Server 2022 in a container (local-only password)
docker run -d --name si-sql -e ACCEPT_EULA=Y -e 'MSSQL_SA_PASSWORD=LocalDev_Passw0rd!' \
  -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest

# 3. Point the API at it (stored in dotnet user-secrets, outside the repo).
#    The unset clears a leftover RDS connection string from the Deploy steps, which would win.
unset ConnectionStrings__Default
dotnet user-secrets set ConnectionStrings:Default \
  'Server=localhost,1433;Database=SiAssignment;User Id=sa;Password=LocalDev_Passw0rd!;TrustServerCertificate=True' \
  --project api/Savage.Api

# 4. Create the schema and seed data, then link the demo sign-ins to the local database
dotnet ef database update --project api/Savage.Api
dotnet run --project api/Savage.Api -- seed-local-users

# 5. Web config: the public Firebase values, with the API pointed at localhost
#    (overwrites web/.env.local; vite build still uses .env.production, so deploys are unaffected)
grep -v '^VITE_API_BASE_URL=' web/.env.production > web/.env.local
echo 'VITE_API_BASE_URL=http://localhost:5080' >> web/.env.local
```

Then run the API and the web app in two terminals:

```sh
pnpm dev:api   # http://localhost:5080 (health check: /health, OpenAPI: /openapi/v1.json)
pnpm dev:web   # http://localhost:5173
```

Open http://localhost:5173 and sign in with a demo account from [For reviewers](#for-reviewers).

- SQL Server takes about 10–20 seconds to start. If step 4 can't connect, wait and run it again.
- If port 1433 is already in use, map another one (`-p 14330:1433`) and use `localhost,14330` in
  the connection string.
- Step 4's commands are safe to re-run. `seed-local-users` takes the demo UIDs from
  `appsettings.Development.json`. If a demo account is ever recreated in Firebase, its UID changes
  and local sign-in gets a 403 until that file is updated.

### Tests and checks

```sh
pnpm test        # vitest (web) + xUnit (API)
pnpm typecheck   # tsc (web) + dotnet build (API)
pnpm -C web lint # Biome
```

The API tests start their own throwaway SQL Server container (Testcontainers), so Docker must be
running. They don't use the database from step 2.

### What doesn't work locally

- **Inviting users** and `seed-demo-users`. Both create Firebase accounts, which needs the
  Firebase admin key, and that isn't shared. Everything else, including role checks, works with
  the two demo accounts.
- **Your local data is separate from the live app's**, but the sign-ins aren't: they're the real
  Firebase accounts. A password reset from the local login screen changes the live demo password.

## Deploy

Live app: https://si-assignment.web.app

```
iPad browser ──► Firebase Hosting (React app)
     │  signs in with Firebase Auth, gets an ID token
     ▼
AWS Lambda function URL (ASP.NET Core API) ──► RDS SQL Server Express (us-east-2)
     validates the token with Google's public keys, then looks up the user's role in SQL
```

### What's automated (GitHub Actions)

| When | What runs | Workflow |
|---|---|---|
| Every PR | Lint, typecheck, and tests (Vitest + xUnit, including the SQL Server tests via Testcontainers). A ruleset on `main` blocks merging until this passes. | `ci.yml` |
| Every PR | Web app built and deployed to a Firebase **preview channel**. The URL is commented on the PR and expires after 7 days. | `preview.yml` |
| Merge to `main` | The same checks, then **API → Lambda** (code only, then a `/health` smoke test), then **web → Firebase Hosting** (live). | `deploy.yml` |

- **No AWS keys are stored in GitHub.** The API job signs in with GitHub's OIDC token and assumes
  the IAM role `si-assignment-github-deploy` (ARN in the repo variable `AWS_DEPLOY_ROLE_ARN`). The
  role trusts only this repo's `production` environment, which only `main` can deploy to. Its IAM
  policy allows uploading code to the `si-assignment-api` function and reading it, and nothing
  else. It can't change memory, timeout, env vars or the execution role. Those stay manual (below).
- **What the role can see:** anything that can deploy code to the function can also read its
  secrets. AWS returns the function's env vars in the deploy response, and new code could read
  them anyway. So the real protection is *who can run the deploy*: only a merge to `main`. Moving
  the secrets to AWS Secrets Manager (see Secrets below) would take them out of the env vars.
- **API before web:** the web app never goes live ahead of the endpoints it calls.
- **Previews call the production API.** CORS allows this project's preview hostnames
  (`Cors:PreviewOriginPattern`) but not other `*.web.app` sites. Previews from forks are skipped,
  because forks don't get repo secrets.
- Firebase deploys use a service account that `firebase init hosting:github` created. Its key is in
  the repo secret `FIREBASE_SERVICE_ACCOUNT_SI_ASSIGNMENT`. It's a repo secret, not limited to the
  `production` environment, because PR previews need it too. So anyone who can push a branch to
  this repo could deploy the live site. That's fine for a one-person repo. With a team I'd switch
  to keyless Workload Identity Federation and separate preview and live identities.
- **Rollback:** revert the PR. The revert merges to `main` and deploys the previous code. The
  smoke test only checks that the API starts (`/health` doesn't touch the database), so a bad
  connection string or a missing migration shows up as API errors, not as a failed deploy.
- When several PRs merge quickly, a deploy waiting in the queue is replaced by the newest one. The
  newest deploy ships all the merged code, but its migration warning only covers its own merge.

### What's still manual

- **Database migrations.** A merge never changes the production schema on its own. When a PR
  adds a migration, apply it to RDS **before merging**. Keep migrations additive (new tables and
  columns) so the API that's still running keeps working until the deploy finishes. The deploy
  run shows a warning if a merge includes migration changes. Later this could become an EF
  migration bundle run behind a manual approval.
- **Demo users**, and Lambda configuration (env vars, memory, timeout).

Run these from the repo root. Prerequisites: the AWS CLI (signed in), the Firebase CLI
(`firebase-tools`, signed in with `firebase login`), and the .NET tools pinned in
`dotnet-tools.json` (`dotnet tool restore` once). The last two rows deploy code too, so they work
as a manual fallback if Actions is down.

| What | Command |
|---|---|
| Schema → RDS | `dotnet ef database update --project api/Savage.Api` |
| Demo users → Firebase + RDS | `dotnet run --project api/Savage.Api -- seed-demo-users` (safe to re-run) |
| Example scenario (sample data) → RDS | `dotnet run --project api/Savage.Api -- seed-scenario` runs the scenario's PO, receipt, work order and sales order through the app's own handlers, as the demo purchaser. It checks the setup data first and skips a database that already has POs (`--even-if-not-empty` to add it anyway). Run it once. |
| Lambda config (memory, timeout) | `dotnet lambda deploy-function --project-location api/Savage.Api` (settings in `aws-lambda-tools-defaults.json`; keeps the existing env vars; also deploys code) |
| Web → Firebase Hosting (fallback) | `pnpm -C web build && firebase deploy --only hosting` (project in `.firebaserc`, public config in `web/.env.production`) |

The first three read the RDS connection string from an env var. Set it so the password is read from
a file and never lands in shell history or process arguments:

```sh
export ConnectionStrings__Default="Server=<rds-host>,1433;Database=SiAssignment;User Id=<user>;Password=$(cat ~/secrets/si-rds-password.txt);Encrypt=True;TrustServerCertificate=True"
```

The seeder takes the demo emails and passwords from `dotnet user-secrets` (key `Demo:Users`), and
the Firebase service account from the file named by `Firebase:CredentialsPath` (kept outside the repo).

**One-time setup** (already done for the live app):

- **CI/CD:** a GitHub OIDC identity provider in IAM, plus the deploy role described above. A
  `production` environment in GitHub limited to `main`. A ruleset on `main` requiring the
  "Lint, typecheck, test" check. `firebase init hosting:github` for the Firebase service account
  secret.
- **Firebase:** email/password sign-in is on. Self sign-up and account deletion are turned off,
  because the app is invite-only. Users are created through the Admin SDK (the seeder for the demo accounts, and
  Admin → Users → Invite someone for everyone else).
- **Lambda env vars:** `ConnectionStrings__Default` (RDS) and `Firebase__CredentialsJson`
  (the service account the Admin SDK uses to invite users). Non-secret settings (Firebase
  project ID, CORS origins) are in `appsettings.json`.
- **Lambda function URL:** auth type `NONE`, so the API does its own auth (Firebase token +
  role in SQL) and its own CORS (only the Firebase Hosting origins, plus this project's preview
  channels via `Cors:PreviewOriginPattern`).
- **Secrets** never go in the repo. Locally they're in `dotnet user-secrets`. On Lambda they're
  env vars, which AWS encrypts at rest. In production I'd move them to AWS Secrets Manager.

## How I used AI tools

I used **Claude Code** for most of the work, but as a team I directed rather than as an autopilot.
The decisions in this README are mine. Claude did a lot of the typing and much of the checking.

- **Requirements interviewer.** Before any code, I had it read the assignment and interview me to
  find gaps and ambiguities, the way a client discovery session would. I told it not to build
  anything during this phase. That produced the [glossary](docs/domain-glossary.md), the three
  client questions, and the assumptions above.
- **Planning before building.** I wrote [the plan](docs/plan.md) with it: walking skeleton first,
  the scenario as an automated test that defines "done", then shared pieces, then parallel features.
  Every task became a GitHub issue with a "done when" checklist.
- **Parallel sessions in git worktrees.** Each task got its own worktree, branch, Claude Code
  session and PR. Once the schema, routes and shared components were in place, four feature lanes
  (admin, purchasing and receiving, processing, sales and reports) were built side by side, each
  staying in its own folders so they didn't conflict.
- **Guardrails, so the AI can't call broken work done.** The repo's [`.claude/`](.claude) folder has
  hooks that lint every edited file and block a session from finishing while the typecheck or tests
  fail, a `/feature` skill that explores and plans and then waits for my approval before building,
  and a `code-reviewer` agent that reviews each diff with fresh eyes before the PR. CI runs the same
  checks again, and `main` won't merge a red PR.
- **Review caught real mistakes, including the AI's.** For example, the reviewer flagged that I'd
  described the deploy role as unable to see secrets. That was wrong, because anything that can
  deploy code can read the function's env vars, so I corrected the README and the reasoning.
- **QA on the real thing.** I walked the scenario on the live app at iPad size as both roles and
  logged each problem as its own issue (number pads, confirm dialogs, trace statuses, PO detail,
  draft protection, polish), then fixed them in separate PRs.

**What I checked myself:** every number in the scenario, the cost-allocation and margin rules
(each has a unit test I read line by line), the data model, the security trade-offs, and every
PR before merging it. The commit history and PR descriptions show the steps.

## What I'd build next

1. **Voids**, so a posted mistake is corrected in the app, only when nothing downstream used it.
   The data model already has the fields.
2. **Single sign-on with the account the client's users already have** (Microsoft or Google via
   Firebase), so there are no passwords to forget and fewer password-related security risks.
3. **QR labels** for items and locations, so receiving and picking are a scan instead of a pick list.
4. **Partial receiving**, and selling part of an item, if the client confirms they need them.
5. **Works on a weak connection:** queue posts offline and send them when the iPad reconnects.
6. **Photos of graded material** on the PO.
7. **Production hardening:** move to Azure App Service + Azure SQL for a Microsoft shop, keep the
   database on a private network, validate its certificate, move secrets to a secrets manager, and
   run migrations from the pipeline behind an approval.
