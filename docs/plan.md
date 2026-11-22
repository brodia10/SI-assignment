# Build Plan

How the app gets built: stack and hosting, data model, and how the work is split so four
Claude Code sessions can build it in parallel without stepping on each other.

## Guiding rules

1. **Get the example scenario working end to end first.** The first thing they grade is
   "it works and the report numbers are right."
2. **Build a walking skeleton first.** Deploy a "hello world" with login, the API and the database
   before any features, so hosting and auth problems show up early, not at the end.
3. **Freeze the shared pieces before going parallel.** The data model, migrations, routes, nav and
   UI building blocks are built once, serially. Then each parallel lane only touches its own
   feature folder.
4. **Conventional over clever.** Standard ASP.NET Core and React patterns that a .NET shop can
   read at a glance.

## Stack and hosting

| Piece | Choice | Why |
|---|---|---|
| API | ASP.NET Core Web API on **.NET 10 (LTS)**, minimal-API endpoint groups per feature | Required. LTS is the safe default. One endpoint file per feature maps cleanly to parallel lanes. |
| Data access | **EF Core** with migrations | Standard for .NET. The DbContext already acts as the repository, so no extra repository layer. |
| Database | **Amazon RDS for SQL Server Express** (db.t3.micro, us-east-2 Ohio) in prod. **SQL Server 2022 in a local container** (OrbStack) for dev and tests. | Required SQL engine and their stack: real, managed SQL Server. |
| API hosting | **AWS Lambda** running the ASP.NET Core API (AWS Lambda hosting package), reached through a Lambda function URL | Well-known, the free tier covers demo traffic easily, and there are no servers to manage. Cost: a cold start of about 1–3 seconds after a quiet period. |
| Front end | **React + TypeScript + Vite + MUI** | Required. |
| Front-end data | **TanStack Query** + **React Router**. API types generated from the API's OpenAPI doc (`openapi-typescript` + `openapi-fetch`). | The generated types are the API contract, so parallel lanes can't drift out of sync. |
| Front-end hosting | **Firebase Hosting** (free Spark plan) | We already need the Firebase project for auth, its domains are approved for sign-in automatically, and the CLI can set up a GitHub Action with PR preview links. |
| Auth | **Firebase Authentication** (email + password). The API validates Firebase ID tokens with standard JWT bearer auth. | Required. |
| Roles | Stored in **SQL** (`AppUser.Role`), looked up by Firebase UID on each request | A role change takes effect immediately. Firebase custom claims would wait for the user's token to refresh. |
| Tests | **xUnit**: unit tests for cost logic, plus one end-to-end scenario test against real SQL Server (Testcontainers). **Vitest** for front-end logic. | The scenario test locks in the exact report numbers. |

### Network trade-off (for the README)
Lambda runs **outside** a VPC, and RDS is **publicly reachable** on port 1433. Access is limited by a strong
generated password and required TLS. The reason: the API has to reach Google to check Firebase
login tokens, and a Lambda inside a private VPC would need a NAT gateway (~$30/month) to do that.
In production I'd put the database in private subnets (or use Azure App Service with VNet integration).

## Data model

```
Product        Id, Name, IsScrap, DefaultBuyPricePerLb?, DefaultSellPricePerLb?, IsActive
Vendor         Id, Name, Kind (Supplier | Customer | Both), AddedByPurchaser
Location       Id, Name, Kind (Bay | Rack | Bin), IsActive
AppUser        Id, FirebaseUid, Email, Role (Admin | Purchaser), IsActive

PurchaseOrder      Id, Number (seq from 2201), VendorId, Status (Open | Received | Voided), audit
PurchaseOrderLine  Id, PurchaseOrderId, ProductId, WeightLbs, PricePerLb, Grade?, Notes?

InventoryItem  Id, Tag (seq, e.g. C-1001), ProductId, LocationId, WeightLbs, TotalCost,
               Status (InStock | Consumed | Sold | Voided),
               SourcePurchaseOrderLineId? | SourceWorkOrderId?        ← lineage
WorkOrder      Id, Number, InputItemId, Status (Completed | Voided), audit
               (outputs are the InventoryItems where SourceWorkOrderId = this)

SalesOrder     Id, Number (seq from 5001), CustomerVendorId, ContainerNumber?,
               Status (Shipped | Voided), audit
SalesOrderLine Id, SalesOrderId, InventoryItemId, WeightLbs, PricePerLb, Revenue, Cost

audit = CreatedByUserId, CreatedAt (+ VoidedByUserId, VoidedAt, VoidReason)
```

**Key rules, with where each comes from:**

- **Lineage is a chain of source links.** Each item points to the PO line or work order that
  created it, and a work order points to its input item. Following the links back from any item
  reaches its PO. (Graded: "tracks each product from PO, through work orders, to the sales order.")
- **Cost lives on the item as `TotalCost`, not as $/lb.** $/lb is calculated only when displayed.
  This is how the report gets exactly $8,400.00. The rounded $0.424/lb would give $8,395.20.
- **Work order cost allocation:** non-scrap outputs share the input's `TotalCost` in proportion to
  their weight. Scrap outputs get $0. Any leftover fraction of a cent goes to the last output, so
  the outputs always add up to the input's cost exactly.
- **Weight checks:** a work order blocks outputs that total more than the input weight and warns if
  they total less. At receiving, the weight starts as the PO weight and the app warns if it's changed.
- **Posted records are locked:** receiving, work orders and sales orders run in one database
  transaction. Each checks the item's status, so the same coil can't be processed or sold twice,
  even with a double tap.
- **Numbers and tags come from SQL Server `SEQUENCE`s,** seeded so the demo produces PO #2201,
  SO #5001 and tag C-1001.
- **Report math:** SO profit = sum of revenue − sum of cost. Margin = profit ÷ revenue.
  Inventory = in-stock items grouped by product and location, with weight and cost.

## Repo layout

```
api/
  Savage.Api/
    Features/{Products,Vendors,Locations,Users,Purchasing,Receiving,Processing,Sales,Reports}/
    Domain/          entities + CostAllocator (pure, unit-tested)
    Data/            DbContext, migrations, seed
  Savage.Api.Tests/
web/
  src/
    features/{admin,purchasing,receiving,processing,sales,reports}/
    components/      shared touch-friendly UI pieces
    api/             generated types + client with the Firebase token attached
docs/
.claude/             agentic-workflows kit
package.json         root scripts: typecheck/test run both web and api
```

## Agentic workflow setup

- Install the kit with `~/code/agentic-workflows/scripts/install.sh`. It gives us lint-on-edit, the
  Stop-hook validation loop, `/feature`, `/handoff`, `/catchup`, `/pr-summary`, and the
  `code-reviewer` and `verifier` agents.
- **Add .NET to the validation loop (small, local change):**
  - The root `package.json` gets `typecheck` = web typecheck + `dotnet build`, and `test` =
    web tests + `dotnet test`. The kit's existing hooks then check both halves without changes.
  - `lint-file.sh` gets one extra case: editing a `.cs` file marks the repo dirty, so a
    backend-only session still gets verified.
- **Worktrees (`git gtr`):**
  - `gtr.hook.postCreate` runs `pnpm install` and `dotnet restore`.
  - `gtr.copy.include` copies `.env*` and `appsettings.Development.json`.
  - Each worktree gets its own API port in its `.env`, so four dev servers can run at once.
- **CLAUDE.md** records the stack, the commands, and the lane rules:
  - Stay in your feature folder.
  - **No new EF migrations in a lane.** If the schema has to change, stop and tell Brook.
- Each lane ends with a PR whose description is written by `/pr-summary`. The PRs and merges
  make up the commit history they asked to see.

## Phases

### Phase 0 — Accounts and tools (Brook, by hand)
- Install the .NET 10 SDK and OrbStack (container runtime). Install the Firebase CLI when we
  first deploy the front end.
- Create the Firebase project, enable email/password sign-in, register the web app, and
  download the service account key (kept outside the repo).
- AWS: confirm the account's free plan or credits, install the AWS CLI and sign in, and set a $1 budget
  alert. Region: us-east-2 (Ohio).
- Create the public GitHub repo `SI-assignment`.

### Phase 1 — Foundation (serial, one session)
1. Scaffold `api/` and `web/`, install the kit, write CLAUDE.md, add the root scripts.
2. **Walking skeleton deployed:** log in with Firebase on Firebase Hosting → call an authenticated
   `/api/me` on Lambda → read the user's role from RDS SQL Server. Deploys run as one documented
   command each (`firebase deploy`, `dotnet lambda deploy-function`). CI only if time allows.
3. Full data model, one initial migration, seed data (products and prices from the scenario,
   locations, one supplier, one customer, demo admin and purchaser).
4. `CostAllocator` + unit tests. An **end-to-end scenario test** that walks steps 1–6 and asserts
   $23,550 / $4,200 per coil / $8,400 / $10,890 / $2,490 / 22.9%. It starts out failing, and it's
   how we know the parallel lanes are done.
5. App shell: MUI theme tuned for iPad (48px+ touch targets, large type), role-based nav and
   routes with placeholder pages for every lane, an empty endpoint file per feature already
   registered, and the shared pieces each lane reuses: `BigButton`, `PickList`, `WeightInput`
   (number pad), `ConfirmSummary` (the plain-English "are you sure"), and `MoneyText`.

### Phase 2 — Four parallel lanes (one worktree and terminal each)
Each lane is a vertical slice: endpoints, logic, tests and screens, in its own folders.

| Lane | Scope |
|---|---|
| **A: Admin** | Products and prices; locations and vendors; users (invite = create Firebase user + copyable set-password link; change role; deactivate) |
| **B: Purchasing + Receiving** | Create PO (vendor pick or quick-add, product lines, weight, price defaulted from product, live total, confirm). Receive PO → one item per line, auto tag, pick location, weight check. |
| **C: Processing** | Work order: pick an in-stock item, add outputs (product, weight, location), scrap marked automatically from the product, live weight balance and cost preview, confirm. Uses `CostAllocator`. |
| **D: Sales + Reports** | Sales order: pick customer, pick in-stock items, price defaulted, container #, confirm. Reports: inventory by product and location, profit and margin per SO, item lineage view (PO → WO → SO). |

Lanes C and D work against seeded and test data, so they don't wait on lane B.

### Phase 3 — Integrate (serial)
Merge the lanes in order A → B → C → D. The scenario test must pass. Then walk the scenario by hand
on an iPad (or Safari's iPad view), fix what feels clumsy, deploy, and seed prod.

### Phase 4 — Finish
- README: setup, assumptions, AI usage, what's next, and the demo sign-ins.
- If time allows, in this order:
  1. Admin "reset demo data" button.
  2. Voids (the status model already supports them).
  3. QR labels.
