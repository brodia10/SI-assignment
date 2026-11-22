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

_TBD_

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
