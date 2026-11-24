# Savage Innovations: Metal Processing App

_Work in progress._

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

A detailed, dated record is in [docs/process-log.md](docs/process-log.md).

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
- **Margin** is profit ÷ sale price (matches the scenario's 22.9%).

### Making it hard to get wrong

I didn't know this industry's conventions, so I researched how ERP and warehouse systems
handle mistakes and followed them:

- **Prevent first.** Pick lists, prices and weights filled in from what's already known, live totals,
  and a plain-language confirmation screen before anything is saved ("Receive 40,000 lbs
  Hot-Rolled Steel Coil into Bay 2?").
- **Records are draft until posted, then locked.** A PO can be edited until it's received. A receipt,
  a completed work order, or a shipped sales order is never edited or deleted. This is standard
  ERP practice because it keeps costs and the audit trail correct.
- **Corrections are voids, not edits.** A mistake is fixed by voiding the transaction, which
  reverses its inventory effect and records who did it, when, and why. Then you redo it.
  A void is allowed only if nothing later has used the result (e.g., you can't void a
  work order if one of its slit coils has already shipped). That rule is how mainstream ERPs
  (Infor, Business Central) handle it, and it stops cost data from going inconsistent.
  Only admins can void, because corrections should be rare and authorized.
- **Weight checks.** At receiving, the weight starts as the PO weight and can be changed to what
  the scale shows. The app warns if they differ. A work order **blocks** outputs that weigh more
  than the input (you can't create metal) and **warns** if they weigh less (yield loss).
- **Every record stores who created it and when.**

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

### Demo sign-ins

These work on the [live app](https://si-assignment.web.app) and locally. They're demo accounts only.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `SteelCoil-Admin-2201` |
| Purchaser | `purchaser@example.com` | `SteelCoil-Buyer-2201` |

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

Open http://localhost:5173 and sign in with a demo account above.

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

Every deploy is one command, run from the repo root. Prerequisites: the AWS CLI (signed in),
the Firebase CLI (`firebase-tools`, signed in with `firebase login`), and the .NET tools pinned
in `dotnet-tools.json` (`dotnet tool restore` once).

| What | Command |
|---|---|
| API → Lambda | `dotnet lambda deploy-function --project-location api/Savage.Api` (settings in `aws-lambda-tools-defaults.json`; keeps the existing env vars) |
| Web → Firebase Hosting | `pnpm -C web build && firebase deploy --only hosting` (project in `.firebaserc`, public config in `web/.env.production`) |
| Schema → RDS | `dotnet ef database update --project api/Savage.Api` |
| Demo users → Firebase + RDS | `dotnet run --project api/Savage.Api -- seed-demo-users` (safe to re-run) |

The last two read the RDS connection string from an env var. Set it so the password is read from
a file and never lands in shell history or process arguments:

```sh
export ConnectionStrings__Default="Server=<rds-host>,1433;Database=SiAssignment;User Id=<user>;Password=$(cat ~/secrets/si-rds-password.txt);Encrypt=True;TrustServerCertificate=True"
```

The seeder takes the demo emails and passwords from `dotnet user-secrets` (key `Demo:Users`), and
the Firebase service account from the file named by `Firebase:CredentialsPath` (kept outside the repo).

**One-time setup** (already done for the live app):

- **Firebase:** email/password sign-in is on. Self sign-up and account deletion are turned off,
  because the app is invite-only. Users are created through the Admin SDK (the seeder now, the
  admin's invite screen later).
- **Lambda env vars:** `ConnectionStrings__Default` (RDS) and `Firebase__CredentialsJson`
  (the service account the Admin SDK uses to invite users). Non-secret settings (Firebase
  project ID, CORS origins) are in `appsettings.json`.
- **Lambda function URL:** auth type `NONE`, so the API does its own auth (Firebase token +
  role in SQL) and its own CORS (only the Firebase Hosting origins).
- **Secrets** never go in the repo. Locally they're in `dotnet user-secrets`. On Lambda they're
  env vars, which AWS encrypts at rest. In production I'd move them to AWS Secrets Manager.

## How I used AI tools

- **Claude Code as a requirements interviewer.** Before writing any code, I had it read the
  assignment and interview me to find gaps and ambiguities, the way a client discovery
  session would. I told it not to build anything during this phase.

## What I'd build next

1. **Single sign-on with the account the client's users already have** (Microsoft or Google via
   Firebase), so there are no passwords to forget and fewer password-related security risks.
2. _More to come._
