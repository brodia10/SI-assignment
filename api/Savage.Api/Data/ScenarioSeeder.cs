using Microsoft.EntityFrameworkCore;
using Savage.Api.Domain;
using Savage.Api.Features.Processing;
using Savage.Api.Features.Purchasing;
using Savage.Api.Features.Receiving;
using Savage.Api.Features.Reports;
using Savage.Api.Features.Sales;
using static Savage.Api.Data.ReferenceData;

namespace Savage.Api.Data;

/// <summary>
/// Sample data for the assignment's example scenario, so the reports have something to show the moment the admin
/// signs in. It runs steps 2–5 through the same handlers the app's screens call (create PO, receive, post work
/// order, ship), as the demo purchaser. Step 1 (products, prices, the purchaser) is already seeded.
/// On an empty database this produces exactly PO #2201, tags C-1001/C-1002, WO #1001 and SO #5001.
/// <para>Run with: <c>dotnet run --project api/Savage.Api -- seed-scenario [--as purchaser@example.com]</c>.
/// Without <c>--as</c> it uses the Purchaser in <c>Demo:Users</c>. It skips a database that already has purchase
/// orders, unless <c>--even-if-not-empty</c> is passed (numbers then continue from what's there; amounts match).</para>
/// <para>Posted records can't be voided yet, so everything that could make a step fail or the numbers come out
/// differently is checked before the first write.</para>
/// </summary>
public static class ScenarioSeeder
{
    public const string ForceFlag = "--even-if-not-empty";
    public const string AsFlag = "--as";
    public const string ContainerNumber = "MSCU1234567";

    public sealed record Result(int PurchaseOrderNumber, int WorkOrderNumber, int SalesOrderNumber, string CoilTag);

    /// <summary>What an empty database produces, and what the assignment shows.</summary>
    public static readonly Result OnEmptyDatabase = new(2201, 1001, 5001, "C-1001");

    public static async Task RunAsync(IServiceProvider services, string[] args)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        var email = ArgAfter(args, AsFlag) ?? DemoPurchaserEmail(config)
            ?? throw new InvalidOperationException($"Say who the purchaser is: {AsFlag} <email>, or a Purchaser in Demo:Users.");

        var plan = await PlanAsync(db, email, args.Contains(ForceFlag));
        if (plan.SkipReason is { } skip)
        {
            Console.WriteLine($"Skipped: {skip}");
            return;
        }

        var result = await SeedAsync(db, plan.PurchaserId);
        Console.WriteLine(
            $"Scenario ready as {email}: PO #{result.PurchaseOrderNumber} → {result.CoilTag} → " +
            $"WO #{result.WorkOrderNumber} → SO #{result.SalesOrderNumber}.");

        foreach (var problem in await VerifyAsync(db, result, plan.DatabaseWasEmpty))
            Console.WriteLine($"WARNING: {problem}");
    }

    public sealed record Plan(int PurchaserId, bool DatabaseWasEmpty, string? SkipReason);

    /// <summary>
    /// Everything checked before the first write: the guard against a non-empty database, the purchaser (by exact
    /// email), and the reference data the scenario depends on. Throws when the scenario can't run correctly.
    /// </summary>
    public static async Task<Plan> PlanAsync(AppDbContext db, string purchaserEmail, bool evenIfNotEmpty, CancellationToken ct = default)
    {
        var existing = await db.PurchaseOrders.CountAsync(ct);
        if (existing > 0 && !evenIfNotEmpty)
            return new Plan(0, false,
                $"the database already has {existing} purchase order(s). Pass {ForceFlag} to add the scenario anyway.");

        var email = purchaserEmail.Trim().ToLowerInvariant();
        var purchaser = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Email == email, ct)
            ?? throw new InvalidOperationException($"No user {email}. Run seed-demo-users or seed-local-users first.");
        if (purchaser.Role != UserRole.Purchaser || !purchaser.IsActive)
            throw new InvalidOperationException($"{email} isn't an active purchaser.");

        var problems = await ReferenceDataProblemsAsync(db, ct);
        if (problems.Count > 0)
            throw new InvalidOperationException(
                "Nothing was written. The scenario's setup data has changed: " + string.Join(" ", problems));

        return new Plan(purchaser.Id, existing == 0, null);
    }

    /// <summary>The products, prices' scrap flags, vendors and locations the scenario uses, as seeded.</summary>
    public static async Task<List<string>> ReferenceDataProblemsAsync(AppDbContext db, CancellationToken ct = default)
    {
        var problems = new List<string>();

        var products = await db.Products.AsNoTracking().ToDictionaryAsync(p => p.Id, ct);
        foreach (var expected in ReferenceData.Products)
        {
            if (!products.TryGetValue(expected.Id, out var p) || !p.IsActive)
                problems.Add($"Product {expected.Name} is missing or turned off.");
            else if (p.IsScrap != expected.IsScrap)
                problems.Add($"{p.Name} should{(expected.IsScrap ? "" : "n't")} be marked as scrap.");
        }

        var vendors = await db.Vendors.AsNoTracking().ToDictionaryAsync(v => v.Id, ct);
        foreach (var expected in ReferenceData.Vendors)
            if (!vendors.TryGetValue(expected.Id, out var v) || !v.IsActive || v.Kind != expected.Kind)
                problems.Add($"{expected.Kind} {expected.Name} is missing, turned off or changed.");

        var activeLocations = await db.Locations.AsNoTracking().Where(l => l.IsActive).Select(l => l.Id).ToListAsync(ct);
        foreach (var id in new[] { LocationIds.Bay2, LocationIds.Rack1, LocationIds.Rack4, LocationIds.ScrapBin })
            if (!activeLocations.Contains(id))
                problems.Add($"{ReferenceData.Locations.Single(l => l.Id == id).Name} is missing or turned off.");

        return problems;
    }

    /// <summary>Steps 2–5 of the scenario, each through its real handler. Throws if any step is refused.</summary>
    public static async Task<Result> SeedAsync(AppDbContext db, int purchaserUserId, CancellationToken ct = default)
    {
        // Each ChangeTracker.Clear() stands in for a new request, so every step reads the database fresh.

        // Step 2: PO #2201, 40,000 lbs Hot-Rolled Steel Coil @ $0.42 and 5,000 lbs Aluminum Sheet @ $1.35.
        var po = Expect(await CreatePurchaseOrderHandler.HandleAsync(db, purchaserUserId, new CreatePurchaseOrderRequest(
            VendorIds.Supplier,
            [
                new(ProductIds.HotRolledSteelCoil, 40_000m, 0.42m),
                new(ProductIds.AluminumSheet, 5_000m, 1.35m),
            ]), ct), "create the PO");
        db.ChangeTracker.Clear();

        // Step 3: the coil goes into Bay 2, the aluminum into Rack 1, at the PO weights.
        var receipt = Expect(await ReceivePurchaseOrderHandler.HandleAsync(db, purchaserUserId, new ReceivePurchaseOrderRequest(
            po.Id,
            [.. po.Lines.Select(l => new ReceiveLine(
                l.Id,
                l.ProductId == ProductIds.HotRolledSteelCoil ? LocationIds.Bay2 : LocationIds.Rack1,
                l.WeightLbs))]), ct), "receive the PO");
        db.ChangeTracker.Clear();
        var coilLineId = po.Lines.Single(l => l.ProductId == ProductIds.HotRolledSteelCoil).Id;
        var coil = receipt.Items.Single(i => i.PurchaseOrderLineId == coilLineId);

        // Step 4: the coil becomes four 9,900 lb slit coils in Rack 4 plus 400 lbs of scrap in the Scrap Bin.
        var workOrder = await WorkOrderService.PostAsync(db, new CreateWorkOrderRequest(
            coil.InventoryItemId,
            [
                .. Enumerable.Repeat(new WorkOrderOutputRequest(ProductIds.SlitCoil12In, 9_900m, LocationIds.Rack4), 4),
                new WorkOrderOutputRequest(ProductIds.SteelScrap, 400m, LocationIds.ScrapBin),
            ]), purchaserUserId, ct);
        if (workOrder.Failure is { } woFailure)
            throw new InvalidOperationException(
                $"Couldn't post the work order: {woFailure.Message} {string.Join(" ", woFailure.Errors)}");
        db.ChangeTracker.Clear();
        var slitCoils = workOrder.Value!.Outputs.Where(o => !o.IsScrap).Take(2).ToList();

        // Step 5: SO #5001 ships two slit coils at $0.55/lb in one container.
        var sale = await SalesOrderService.PostAsync(db, purchaserUserId, new CreateSalesOrderRequest(
            VendorIds.Customer, ContainerNumber, [.. slitCoils.Select(c => new CreateSalesOrderLine(c.Id, 0.55m))]), ct);
        db.ChangeTracker.Clear();
        var posted = sale switch
        {
            PostSalesOrderResult.Posted p => p,
            PostSalesOrderResult.Invalid invalid => throw new InvalidOperationException(
                "Couldn't ship the sales order: " + string.Join(" ", invalid.Errors.Values.SelectMany(e => e))),
            PostSalesOrderResult.Conflict conflict => throw new InvalidOperationException(
                $"Couldn't ship the sales order: {conflict.Message}"),
            _ => throw new InvalidOperationException($"Couldn't ship the sales order: {sale}"),
        };

        return new Result(po.Number, workOrder.Value.Number, posted.Order.Number, coil.Tag);
    }

    /// <summary>
    /// Reads the run back from the sales report: anything that doesn't match the assignment. On a database that was
    /// empty, the numbers must be exactly #2201, C-1001, #1001 and #5001 too.
    /// </summary>
    public static async Task<List<string>> VerifyAsync(AppDbContext db, Result result, bool databaseWasEmpty, CancellationToken ct = default)
    {
        var problems = new List<string>();
        if (databaseWasEmpty && result != OnEmptyDatabase)
            problems.Add($"Expected {OnEmptyDatabase} on an empty database but got {result}.");

        var so = (await ReportQueries.SalesAsync(db, ct)).Orders.SingleOrDefault(o => o.Number == result.SalesOrderNumber);
        if (so is null || (so.Cost, so.Revenue, so.Profit) != (8_400.00m, 10_890.00m, 2_490.00m))
            problems.Add(
                $"SO #{result.SalesOrderNumber} should cost $8,400.00 and sell for $10,890.00, " +
                $"but the report shows {so?.Cost:C} and {so?.Revenue:C}.");
        return problems;
    }

    private static string? ArgAfter(string[] args, string flag)
    {
        var i = Array.IndexOf(args, flag);
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    private static string? DemoPurchaserEmail(IConfiguration config) =>
        config.GetSection("Demo:Users").GetChildren()
            .FirstOrDefault(u => string.Equals(u["Role"], nameof(UserRole.Purchaser), StringComparison.OrdinalIgnoreCase))
            ?["Email"];

    private static T Expect<T>(Outcome<T> outcome, string step) =>
        outcome.Succeeded
            ? outcome.Value!
            : throw new InvalidOperationException(
                $"Couldn't {step}: {outcome.Failure!.Message} " +
                string.Join(" ", outcome.Failure.Errors?.Values.SelectMany(e => e) ?? []));
}
