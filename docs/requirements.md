# Assignment Requirements (source of truth)

Transcribed from the Savage Innovations assignment PDF (pp. 3–6, dated 11/10/2026). This is what the client
asked for. Everything in `README.md`, `docs/plan.md` and `docs/domain-glossary.md` is derived from it. When a
derived doc and this file disagree, this file wins. Keep what the assignment says separate from decisions we made.

## The business
A metal processor buys steel and aluminum from suppliers, stores it, processes it into the products its
customers need, and ships it out by the container. For example, a wide steel coil is slit into several narrow
coils, and the leftover edge trim becomes scrap. Profit depends on knowing what was bought, what it cost, where
it is, what it became, and what it sold for.

Most of the work is done by a purchaser in the field and on the floor, using an iPad. They may not be
comfortable with computers, and they are often standing next to the material. The software has to be
**simple, fast, and hard to get wrong.**

## Requirements
The application must:
- Be **deployed to a public URL**
- Use **.NET Core** for the back end (Web API)
- Use **React with TypeScript**, built with **Vite**
- Use **MUI** (Material UI) as the front-end component framework
- Use **Firebase Authentication**
- Use a **SQL database** (such as Azure SQL or SQL Server)
- Be **easy to use on an iPad** for a field user

## Users
**Purchaser** (field user on an iPad) handles the day-to-day work:
- Purchasing
- Receiving
- Processing
- Sales and shipping

**Admin** sets things up and watches the numbers:
- Configures products, with a purchase price and a sales price for each
- Views the reports
- Invites purchaser users and changes user roles

## The workflows
1. **Purchasing.** Purchasing happens in person. The purchaser visually inspects and grades the material, so
   they know exactly what is coming in. They create a purchase order (PO) for the vendor (supplier). A PO can
   have many different products, and each one must be accounted for with its weight and price.
2. **Receiving.** When the material arrives, the products on the PO become inventory. Each item is stored at a
   location, such as a bay or rack, and keeps its cost from the PO.
3. **Processing.** The purchaser runs a work order that transforms one product into many other products, such
   as one wide coil into four narrow coils plus scrap. Each new product is added to inventory and stored at a
   location, and the cost carries over from the original.
4. **Sales.** Inventory is sold and shipped in a container to a vendor (customer). A sales order records the
   products and quantities shipped and the sales price.
5. **Reports.** The owner wants to know how much inventory there is, where it is, and the profit margin between
   what was paid at purchase and what it sold for.

## Example scenario (must work start to finish)
1. The admin sets up products with prices: Hot-Rolled Steel Coil (buy $0.42/lb), Aluminum Sheet (buy
   $1.35/lb), 12" Slit Coil (sell $0.55/lb), and Steel Scrap (sell $0.15/lb). The admin invites a purchaser.
2. The purchaser visits the supplier, grades the material, and creates PO #2201: Hot-Rolled Steel Coil,
   40,000 lbs @ $0.42/lb ($16,800.00), and Aluminum Sheet, 5,000 lbs @ $1.35/lb ($6,750.00).
   PO total: $23,550.00.
3. The purchaser receives the PO. The steel coil is tagged C-1001 and stored in Bay 2. The aluminum is stored
   in Rack 1.
4. The purchaser runs a work order: C-1001 becomes four 12" Slit Coils of 9,900 lbs each, stored in Rack 4,
   plus 400 lbs of Steel Scrap in the Scrap Bin. The good coils carry the cost: $16,800 over 39,600 lbs is
   about $0.424/lb.
5. The purchaser creates sales order #5001 and ships a container to the customer with two Slit Coils
   (19,800 lbs @ $0.55/lb = $10,890.00).
6. The admin runs the reports and sees inventory by product and location, and that sales order #5001 cost
   $8,400.00 and sold for $10,890.00, a profit of $2,490.00 (about 22.9% margin).

## Keep it simple
- Get the example scenario working end to end first.
- Design for the iPad: **big buttons, pick lists instead of typing, and few steps.**
- Seed demo data is fine, as long as the admin can still manage products and prices in the app.
- AI tools (Cursor, Claude Code, ChatGPT, GitHub Copilot) are welcome. Be ready to explain what you used them
  for.

## Optional extras (only if the core is done)
- Photos of graded material on the PO
- Barcode or QR labels for items and locations
- Works on a weak or spotty connection

## What to submit
- Public URL for the deployed application
- Demo sign-ins for both roles and sample data for the example scenario
- GitHub repository with all source code and a commit history that shows the process
- README with setup steps, assumptions, how AI tools were used, and what you'd build next

## How it's evaluated
1. **It works.** Sign in as both roles, walk through the example scenario, and the report numbers are right.
2. **It is easy to use.** A purchaser with little computer experience could use it on an iPad.
3. **The code is clean.** Organized, readable, and easy to change.
4. **The design is sensible.** The data model tracks each product from PO, through work orders, to the sales
   order.
5. **You explain your thinking.** The README and demo cover what was built, what was skipped, and why.

Timeline: one week from receipt, followed by a demo and review meeting with the leads.
