using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;
using Savage.Api.Features.Purchasing;
using Savage.Api.Features.Receiving;
using Savage.Api.Tests.Data;
using static Savage.Api.Data.ReferenceData;

namespace Savage.Api.Tests.Features.Purchasing;

/// <summary>
/// Purchasing and receiving against real SQL Server, calling the same handlers the endpoints call.
/// Each test gets a fresh database, so the first PO is #2201 and the first tag is C-1001.
/// </summary>
[Collection(SqlServerCollection.Name)]
public class PurchasingAndReceivingTests(SqlServerFixture sql)
{
    private static readonly CreatePurchaseOrderRequest Po2201 = new(VendorIds.Supplier,
    [
        new(ProductIds.HotRolledSteelCoil, 40_000m, 0.42m, "Prime"),
        new(ProductIds.AluminumSheet, 5_000m, 1.35m),
    ]);

    // ---- Assignment scenario, steps 2–3 ----

    [Fact]
    public async Task Scenario_step2_purchaser_creates_PO2201_for_23550()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);

        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));

        Assert.Equal(2201, po.Number);
        Assert.Equal(PurchaseOrderStatus.Open, po.Status);
        Assert.Equal("Great Lakes Steel Supply", po.VendorName);
        Assert.Equal(23_550.00m, po.Total);
        Assert.Equal(45_000m, po.TotalWeightLbs);
        Assert.Collection(po.Lines,
            l =>
            {
                Assert.Equal("Hot-Rolled Steel Coil", l.ProductName);
                Assert.Equal(16_800.00m, l.LineTotal);
                Assert.Equal("Prime", l.Grade);
            },
            l =>
            {
                Assert.Equal("Aluminum Sheet", l.ProductName);
                Assert.Equal(6_750.00m, l.LineTotal);
            });

        var saved = await db.PurchaseOrders.AsNoTracking().SingleAsync();
        Assert.Equal(user.Id, saved.CreatedByUserId);
    }

    [Fact]
    public async Task Scenario_step3_receiving_PO2201_tags_the_coil_C1001_in_Bay2_and_the_aluminum_in_Rack1()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));

        // Through a context set up like production's (retry on transient errors), so the explicit transaction has to
        // run inside the execution strategy or this throws.
        await using var retrying = NewContextOnSameDatabase(db);
        var receipt = Value(await ReceivePurchaseOrderHandler.HandleAsync(retrying, user.Id, ScenarioReceipt(po)));

        Assert.Equal(2201, receipt.PurchaseOrderNumber);
        Assert.Collection(receipt.Items,
            i =>
            {
                Assert.Equal("C-1001", i.Tag);
                Assert.Equal("Hot-Rolled Steel Coil", i.ProductName);
                Assert.Equal("Bay 2", i.LocationName);
                Assert.Equal(16_800.00m, i.TotalCost);
            },
            i =>
            {
                Assert.Equal("C-1002", i.Tag);
                Assert.Equal("Aluminum Sheet", i.ProductName);
                Assert.Equal("Rack 1", i.LocationName);
                Assert.Equal(6_750.00m, i.TotalCost);
            });

        // What's in the database, not just what the handler returned.
        db.ChangeTracker.Clear();
        var items = await db.InventoryItems.AsNoTracking().Include(i => i.Location).OrderBy(i => i.Tag).ToListAsync();
        Assert.Collection(items,
            i => AssertItem(i, "C-1001", ProductIds.HotRolledSteelCoil, "Bay 2", 40_000m, 16_800.00m, po.Lines[0].Id),
            i => AssertItem(i, "C-1002", ProductIds.AluminumSheet, "Rack 1", 5_000m, 6_750.00m, po.Lines[1].Id));
        Assert.Equal(23_550.00m, items.Sum(i => i.TotalCost)); // the PO total, to the cent

        var received = await db.PurchaseOrders.AsNoTracking().SingleAsync();
        Assert.Equal(PurchaseOrderStatus.Received, received.Status);
        Assert.Equal(user.Id, received.ReceivedByUserId);
        Assert.NotNull(received.ReceivedAt);
    }

    // ---- Posting rules ----

    [Fact]
    public async Task A_received_PO_cant_be_received_again()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));
        Value(await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id, ScenarioReceipt(po)));

        var again = await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id, ScenarioReceipt(po));

        Assert.Equal(FailureKind.Conflict, again.Failure?.Kind);
        Assert.Equal("PO #2201 was already received. Nothing was changed.", again.Failure?.Message);
        Assert.Equal(2, await db.InventoryItems.CountAsync());
    }

    [Fact]
    public async Task Two_receives_racing_on_the_same_PO_post_once()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));

        // A double tap from two iPads: separate requests, separate contexts.
        await using var first = NewContextOnSameDatabase(db);
        await using var second = NewContextOnSameDatabase(db);
        var results = await Task.WhenAll(
            ReceivePurchaseOrderHandler.HandleAsync(first, user.Id, ScenarioReceipt(po)),
            ReceivePurchaseOrderHandler.HandleAsync(second, user.Id, ScenarioReceipt(po)));

        Assert.Single(results, r => r.Succeeded);
        Assert.Single(results, r => r.Failure?.Kind == FailureKind.Conflict);
        Assert.Equal(2, await db.InventoryItems.CountAsync());

        // The loser is stopped before it draws tag numbers, so the next receipt carries on from C-1003.
        var next = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));
        var nextReceipt = Value(await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id, ScenarioReceipt(next)));
        Assert.Equal(["C-1003", "C-1004"], nextReceipt.Items.Select(i => i.Tag));
    }

    [Fact]
    public async Task A_scale_weight_that_differs_is_recorded_but_the_cost_stays_the_PO_amount()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));

        var receipt = Value(await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id, new(po.Id,
        [
            new(po.Lines[0].Id, LocationIds.Bay2, 39_850m),
            new(po.Lines[1].Id, LocationIds.Rack1, 5_000m),
        ])));

        var coil = receipt.Items[0];
        Assert.Equal(39_850m, coil.WeightLbs);
        Assert.Equal(40_000m, coil.OrderedWeightLbs);
        Assert.Equal(16_800.00m, coil.TotalCost);
    }

    [Fact]
    public async Task Every_line_has_to_be_received_together()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));

        var partial = await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id,
            new(po.Id, [new(po.Lines[0].Id, LocationIds.Bay2, 40_000m)]));

        Assert.Equal(FailureKind.Conflict, partial.Failure?.Kind);
        await AssertNothingReceivedAsync(db);
    }

    [Fact]
    public async Task A_line_from_another_PO_is_rejected()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));
        var other = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));

        var mixed = await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id, new(po.Id,
        [
            new(po.Lines[0].Id, LocationIds.Bay2, 40_000m),
            new(other.Lines[1].Id, LocationIds.Rack1, 5_000m),
        ]));

        Assert.Equal(FailureKind.Conflict, mixed.Failure?.Kind);
        await AssertNothingReceivedAsync(db);
    }

    [Fact]
    public async Task An_inactive_location_is_rejected_and_nothing_is_written()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));
        var rack1 = await db.Locations.SingleAsync(l => l.Id == LocationIds.Rack1);
        rack1.IsActive = false;
        await db.SaveChangesAsync();

        var result = await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id, ScenarioReceipt(po));

        Assert.Equal(FailureKind.Invalid, result.Failure?.Kind);
        await AssertNothingReceivedAsync(db);
    }

    [Fact]
    public async Task A_voided_PO_cant_be_received()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));
        var saved = await db.PurchaseOrders.SingleAsync();
        saved.Status = PurchaseOrderStatus.Voided;
        await db.SaveChangesAsync();

        var result = await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id, ScenarioReceipt(po));

        Assert.Equal(FailureKind.Conflict, result.Failure?.Kind);
        Assert.Equal("PO #2201 was voided, so it can't be received.", result.Failure?.Message);
        Assert.Equal(0, await db.InventoryItems.CountAsync());
    }

    [Fact]
    public async Task Receiving_a_PO_that_doesnt_exist_is_not_found()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);

        var result = await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id,
            new(9_999, [new(1, LocationIds.Bay2, 40_000m)]));

        Assert.Equal(FailureKind.NotFound, result.Failure?.Kind);
    }

    [Fact]
    public async Task Receiving_tags_follow_the_line_order_on_a_long_PO()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var lines = Enumerable.Range(1, 6)
            .Select(i => new CreatePurchaseOrderLine(ProductIds.HotRolledSteelCoil, 1_000m * i, 0.42m)).ToList();
        var po = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, new(VendorIds.Supplier, lines)));

        var receipt = Value(await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id,
            new(po.Id, po.Lines.Select(l => new ReceiveLine(l.Id, LocationIds.Bay1, l.WeightLbs)).ToList())));

        Assert.Equal(["C-1001", "C-1002", "C-1003", "C-1004", "C-1005", "C-1006"], receipt.Items.Select(i => i.Tag));
        Assert.Equal(po.Lines.Select(l => l.WeightLbs), receipt.Items.Select(i => i.WeightLbs));
    }

    // ---- Creating a PO ----

    [Fact]
    public async Task A_PO_cant_be_written_to_a_customer()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);

        var result = await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201 with { VendorId = VendorIds.Customer });

        Assert.Equal(FailureKind.Invalid, result.Failure?.Kind);
        Assert.Contains("vendorId", result.Failure!.Errors!.Keys);
        Assert.Equal(0, await db.PurchaseOrders.CountAsync());
    }

    [Fact]
    public async Task An_inactive_product_is_rejected_on_its_line()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var aluminum = await db.Products.SingleAsync(p => p.Id == ProductIds.AluminumSheet);
        aluminum.IsActive = false;
        await db.SaveChangesAsync();

        var result = await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201);

        Assert.Equal(["Line 2: that product isn't available. Pick another one."],
            result.Failure!.Errors!["lines[1].productId"]);
    }

    [Fact]
    public async Task Open_POs_are_listed_newest_first_with_totals()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddPurchaserAsync(db);
        var received = Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));
        Value(await ReceivePurchaseOrderHandler.HandleAsync(db, user.Id, ScenarioReceipt(received)));
        Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));
        Value(await CreatePurchaseOrderHandler.HandleAsync(db, user.Id, Po2201));

        var open = await PurchaseOrderQueries.ListAsync(db, PurchaseOrderStatus.Open);
        var all = await PurchaseOrderQueries.ListAsync(db, status: null);

        Assert.Equal([2203, 2202], open.Select(p => p.Number));
        Assert.All(open, p => Assert.Equal(23_550.00m, p.Total));
        Assert.All(open, p => Assert.Equal(2, p.LineCount));
        Assert.Equal([2203, 2202, 2201], all.Select(p => p.Number));
    }

    [Fact]
    public async Task Form_options_offer_suppliers_only_and_products_with_their_buy_price()
    {
        await using var db = await sql.CreateMigratedContextAsync();

        var options = await PurchaseOrderQueries.FormOptionsAsync(db);

        Assert.Equal(["Great Lakes Steel Supply"], options.Suppliers.Select(s => s.Name));
        Assert.Equal(0.42m, options.Products.Single(p => p.Id == ProductIds.HotRolledSteelCoil).DefaultBuyPricePerLb);
        Assert.Equal(1.35m, options.Products.Single(p => p.Id == ProductIds.AluminumSheet).DefaultBuyPricePerLb);
    }

    // ---- Helpers ----

    private static ReceivePurchaseOrderRequest ScenarioReceipt(PurchaseOrderResponse po) => new(po.Id,
    [
        new(po.Lines[0].Id, LocationIds.Bay2, po.Lines[0].WeightLbs),
        new(po.Lines[1].Id, LocationIds.Rack1, po.Lines[1].WeightLbs),
    ]);

    private static T Value<T>(Outcome<T> outcome)
    {
        Assert.True(outcome.Succeeded, outcome.Failure?.Message);
        return outcome.Value!;
    }

    private static void AssertItem(
        InventoryItem item, string tag, int productId, string location, decimal weight, decimal cost, int lineId)
    {
        Assert.Equal(tag, item.Tag);
        Assert.Equal(productId, item.ProductId);
        Assert.Equal(location, item.Location.Name);
        Assert.Equal(weight, item.WeightLbs);
        Assert.Equal(cost, item.TotalCost);
        Assert.Equal(InventoryItemStatus.InStock, item.Status);
        Assert.Equal(lineId, item.SourcePurchaseOrderLineId);
        Assert.Null(item.SourceWorkOrderId);
    }

    private static async Task AssertNothingReceivedAsync(AppDbContext db)
    {
        db.ChangeTracker.Clear();
        Assert.Equal(0, await db.InventoryItems.CountAsync());
        Assert.All(await db.PurchaseOrders.AsNoTracking().ToListAsync(),
            p => Assert.Equal(PurchaseOrderStatus.Open, p.Status));
    }

    private static async Task<AppUser> AddPurchaserAsync(AppDbContext db)
    {
        var user = new AppUser { FirebaseUid = "test-uid", Email = "purchaser@test.local", Role = UserRole.Purchaser };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    /// <summary>A second connection, configured like Program.cs (retry on transient errors).</summary>
    private static AppDbContext NewContextOnSameDatabase(AppDbContext db) => new(
        new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(db.Database.GetConnectionString(), sql => sql.EnableRetryOnFailure())
            .Options);
}
