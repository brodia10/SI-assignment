using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;
using Savage.Api.Features.Purchasing;
using Savage.Api.Features.Reports;

namespace Savage.Api.Tests.Data;

/// <summary>
/// The sample data is the whole assignment scenario run through the real handlers, so this is also the
/// end-to-end check: every number in the assignment, read back from the reports the admin sees.
/// </summary>
[Collection(SqlServerCollection.Name)]
public class ScenarioSeederTests(SqlServerFixture sql)
{
    [Fact]
    public async Task Seeding_an_empty_database_produces_the_assignment_scenario_exactly()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var purchaser = await AddPurchaserAsync(db);

        var result = await ScenarioSeeder.SeedAsync(db, purchaser.Id);

        Assert.Equal(new ScenarioSeeder.Result(2201, 1001, 5001, "C-1001"), result);

        // Step 2: PO #2201 for $23,550.00, now received.
        var po = await db.PurchaseOrders.SingleAsync();
        var poDetail = await PurchaseOrderQueries.GetAsync(db, po.Id);
        Assert.Equal((2201, 23_550.00m, PurchaseOrderStatus.Received), (poDetail!.Number, poDetail.Total, poDetail.Status));
        Assert.Equal([16_800.00m, 6_750.00m], poDetail.Lines.Select(l => l.LineTotal));

        // Step 3: C-1001 went to Bay 2, the aluminum to Rack 1.
        Assert.Equal(("C-1001", "Bay 2"), Placement(poDetail.Lines[0]));
        Assert.Equal(("C-1002", "Rack 1"), Placement(poDetail.Lines[1]));

        // Step 4: four slit coils at $4,200 each, scrap at $0.
        var outputs = await db.InventoryItems.Where(i => i.SourceWorkOrderId != null).OrderBy(i => i.Id).ToListAsync();
        Assert.Equal([4_200m, 4_200m, 4_200m, 4_200m, 0m], outputs.Select(o => o.TotalCost));

        // Step 5 and 6: SO #5001 cost $8,400, sold for $10,890, profit $2,490, about 22.9% margin.
        var sales = await ReportQueries.SalesAsync(db);
        var so = Assert.Single(sales.Orders);
        Assert.Equal((5001, 8_400.00m, 10_890.00m, 2_490.00m), (so.Number, so.Cost, so.Revenue, so.Profit));
        Assert.Equal(22.9m, Math.Round(so.Margin!.Value * 100, 1));

        // Step 6: inventory left by product and location.
        var inventory = await ReportQueries.InventoryAsync(db);
        Assert.Equal(
            [("12\" Slit Coil", "Rack 4", 2), ("Aluminum Sheet", "Rack 1", 1), ("Steel Scrap", "Scrap Bin", 1)],
            inventory.Products.Select(p => (p.ProductName, Assert.Single(p.Locations).LocationName, p.ItemCount)));
        Assert.Equal(15_150.00m, inventory.TotalCost);
    }

    [Fact]
    public async Task Seeding_again_adds_a_second_run_with_the_same_amounts()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var purchaser = await AddPurchaserAsync(db);
        await ScenarioSeeder.SeedAsync(db, purchaser.Id);

        var second = await ScenarioSeeder.SeedAsync(db, purchaser.Id);

        Assert.Equal((2202, 1002, 5002, "C-1008"),
            (second.PurchaseOrderNumber, second.WorkOrderNumber, second.SalesOrderNumber, second.CoilTag));
        var sales = await ReportQueries.SalesAsync(db);
        Assert.All(sales.Orders, o => Assert.Equal((8_400.00m, 10_890.00m), (o.Cost, o.Revenue)));
    }

    [Fact]
    public async Task Plan_skips_a_database_that_already_has_purchase_orders()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var purchaser = await AddPurchaserAsync(db);
        await ScenarioSeeder.SeedAsync(db, purchaser.Id);

        var plan = await ScenarioSeeder.PlanAsync(db, purchaser.Email, evenIfNotEmpty: false);

        Assert.Contains("already has 1 purchase order", plan.SkipReason);
        var forced = await ScenarioSeeder.PlanAsync(db, purchaser.Email, evenIfNotEmpty: true);
        Assert.Equal((purchaser.Id, false, (string?)null), (forced.PurchaserId, forced.DatabaseWasEmpty, forced.SkipReason));
    }

    [Fact]
    public async Task Plan_uses_exactly_the_named_purchaser_and_refuses_anyone_else()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var purchaser = await AddPurchaserAsync(db);
        db.Users.Add(new AppUser { FirebaseUid = "admin-uid", Email = "admin@test.local", Role = UserRole.Admin });
        await db.SaveChangesAsync();

        var plan = await ScenarioSeeder.PlanAsync(db, " Purchaser@Test.local ", evenIfNotEmpty: false);

        Assert.Equal((purchaser.Id, true), (plan.PurchaserId, plan.DatabaseWasEmpty));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ScenarioSeeder.PlanAsync(db, "nobody@test.local", evenIfNotEmpty: false));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ScenarioSeeder.PlanAsync(db, "admin@test.local", evenIfNotEmpty: false));
    }

    [Fact]
    public async Task Plan_refuses_before_writing_when_the_setup_data_changed()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var purchaser = await AddPurchaserAsync(db);
        // Two changes an admin can make that would break the scenario or its numbers.
        await db.Locations.Where(l => l.Id == ReferenceData.LocationIds.Rack4)
            .ExecuteUpdateAsync(s => s.SetProperty(l => l.IsActive, false));
        await db.Products.Where(p => p.Id == ReferenceData.ProductIds.SteelScrap)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsScrap, false));

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ScenarioSeeder.PlanAsync(db, purchaser.Email, evenIfNotEmpty: false));

        Assert.Contains("Rack 4 is missing or turned off.", error.Message);
        Assert.Contains("Steel Scrap should be marked as scrap.", error.Message);
        Assert.Equal(0, await db.PurchaseOrders.CountAsync());
    }

    [Fact]
    public async Task Verify_flags_a_run_that_did_not_get_the_scenario_numbers()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var purchaser = await AddPurchaserAsync(db);
        var result = await ScenarioSeeder.SeedAsync(db, purchaser.Id);

        Assert.Empty(await ScenarioSeeder.VerifyAsync(db, result, databaseWasEmpty: true));
        Assert.NotEmpty(await ScenarioSeeder.VerifyAsync(db, result with { PurchaseOrderNumber = 2202 }, databaseWasEmpty: true));
    }

    private static (string Tag, string Location) Placement(PurchaseOrderLineResponse line)
    {
        var item = Assert.Single(line.ReceivedItems);
        return (item.Tag, item.LocationName);
    }

    private static async Task<AppUser> AddPurchaserAsync(AppDbContext db)
    {
        var purchaser = new AppUser { FirebaseUid = "purchaser-uid", Email = "purchaser@test.local", Role = UserRole.Purchaser };
        db.Users.Add(purchaser);
        await db.SaveChangesAsync();
        return purchaser;
    }
}
