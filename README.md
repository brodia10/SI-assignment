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
| Lambda config (memory, timeout) | `dotnet lambda deploy-function --project-location api/Savage.Api` (settings in `aws-lambda-tools-defaults.json`; keeps the existing env vars; also deploys code) |
| Web → Firebase Hosting (fallback) | `pnpm -C web build && firebase deploy --only hosting` (project in `.firebaserc`, public config in `web/.env.production`) |

The first two read the RDS connection string from an env var. Set it so the password is read from
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
  because the app is invite-only. Users are created through the Admin SDK (the seeder now, the
  admin's invite screen later).
- **Lambda env vars:** `ConnectionStrings__Default` (RDS) and `Firebase__CredentialsJson`
  (the service account the Admin SDK uses to invite users). Non-secret settings (Firebase
  project ID, CORS origins) are in `appsettings.json`.
- **Lambda function URL:** auth type `NONE`, so the API does its own auth (Firebase token +
  role in SQL) and its own CORS (only the Firebase Hosting origins, plus this project's preview
  channels via `Cors:PreviewOriginPattern`).
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
