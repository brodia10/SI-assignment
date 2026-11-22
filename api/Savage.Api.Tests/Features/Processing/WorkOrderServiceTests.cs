using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;
using Savage.Api.Features.Processing;
using Savage.Api.Tests.Data;
using static Savage.Api.Data.ReferenceData;

namespace Savage.Api.Tests.Features.Processing;

/// <summary>
/// Posting against real SQL Server. The input coil is inserted directly (no receiving screen needed), the way the
/// scenario leaves it after step 3: C-1001, 40,000 lbs of Hot-Rolled Steel Coil in Bay 2 costing $16,800.
/// </summary>
[Collection(SqlServerCollection.Name)]
public class WorkOrderServiceTests(SqlServerFixture sql)
{
    private static readonly WorkOrderOutputRequest SlitCoil = new(ProductIds.SlitCoil12In, 9_900m, LocationIds.Rack4);
    private static readonly WorkOrderOutputRequest Scrap = new(ProductIds.SteelScrap, 400m, LocationIds.ScrapBin);

    private static CreateWorkOrderRequest ScenarioRequest(int inputItemId) =>
        new(inputItemId, [SlitCoil, SlitCoil, SlitCoil, SlitCoil, Scrap]);

    [Fact]
    public async Task Scenario_step_4_posts_four_slit_coils_at_4200_and_scrap_at_zero()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);
        Assert.Equal("C-1001", coil.Tag);

        var result = await WorkOrderService.PostAsync(db, ScenarioRequest(coil.Id), user.Id, CancellationToken.None);

        Assert.Null(result.Failure);
        var posted = result.Value!;
        Assert.Equal(1001, posted.Number);
        Assert.Equal("C-1001", posted.InputTag);
        Assert.Equal(["C-1002", "C-1003", "C-1004", "C-1005", "C-1006"], posted.Outputs.Select(o => o.Tag));
        Assert.Equal([4_200.00m, 4_200.00m, 4_200.00m, 4_200.00m, 0.00m], posted.Outputs.Select(o => o.TotalCost));
        Assert.Empty(posted.Warnings);

        // Read back what's actually stored, not what's tracked.
        db.ChangeTracker.Clear();
        var input = await db.InventoryItems.SingleAsync(i => i.Id == coil.Id);
        Assert.Equal(InventoryItemStatus.Consumed, input.Status);

        var workOrder = await db.WorkOrders.Include(w => w.Outputs).SingleAsync();
        Assert.Equal(coil.Id, workOrder.InputItemId);
        Assert.Equal(user.Id, workOrder.CreatedByUserId);
        Assert.Equal(WorkOrderStatus.Completed, workOrder.Status);

        var outputs = workOrder.Outputs.OrderBy(o => o.Id).ToList();
        Assert.All(outputs, o => Assert.Equal(InventoryItemStatus.InStock, o.Status));
        Assert.All(outputs.Take(4), o =>
        {
            Assert.Equal(ProductIds.SlitCoil12In, o.ProductId);
            Assert.Equal(LocationIds.Rack4, o.LocationId);
            Assert.Equal(9_900m, o.WeightLbs);
            Assert.Equal(4_200.00m, o.TotalCost);
        });
        Assert.Equal(ProductIds.SteelScrap, outputs[4].ProductId);
        Assert.Equal(LocationIds.ScrapBin, outputs[4].LocationId);
        Assert.Equal(0.00m, outputs[4].TotalCost);
        Assert.Equal(16_800.00m, outputs.Sum(o => o.TotalCost));

        // Step 6 depends on this: two of these coils cost exactly $8,400.00.
        Assert.Equal(8_400.00m, outputs[0].TotalCost + outputs[1].TotalCost);
    }

    [Fact]
    public async Task Double_tap_processes_the_coil_only_once()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);

        // Two requests at the same moment, each with its own connection (as two HTTP requests would have).
        // Whichever way the race falls (the loser sees Consumed on load, or trips the RowVersion/unique index on
        // save), exactly one posts.
        await using var first = NewContextOnSameDatabase(db);
        await using var second = NewContextOnSameDatabase(db);

        var results = await Task.WhenAll(
            WorkOrderService.PostAsync(first, ScenarioRequest(coil.Id), user.Id, CancellationToken.None),
            WorkOrderService.PostAsync(second, ScenarioRequest(coil.Id), user.Id, CancellationToken.None));

        Assert.Single(results, r => r.Failure is null);
        var loser = Assert.Single(results, r => r.Failure is not null).Failure!;
        Assert.Equal(WorkOrderFailureKind.Conflict, loser.Kind);
        Assert.Equal("C-1001 was already processed, so it can't be processed. Pick another item.", loser.Message);

        db.ChangeTracker.Clear();
        Assert.Equal(1, await db.WorkOrders.CountAsync());
        Assert.Equal(5, await db.InventoryItems.CountAsync(i => i.SourceWorkOrderId != null));
    }

    [Fact]
    public async Task Item_sold_after_it_was_loaded_is_caught_by_the_row_version()
    {
        // No work order exists for C-1001, so the unique index can't help: only the RowVersion check catches this.
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);
        await using var stale = NewContextOnSameDatabase(db);
        await stale.InventoryItems.SingleAsync(i => i.Id == coil.Id); // tracked, InStock

        var sold = await db.InventoryItems.SingleAsync(i => i.Id == coil.Id);
        sold.Status = InventoryItemStatus.Sold; // e.g. a sales order on another iPad
        await db.SaveChangesAsync();

        var result = await WorkOrderService.PostAsync(stale, ScenarioRequest(coil.Id), user.Id, CancellationToken.None);

        Assert.Equal(WorkOrderFailureKind.Conflict, result.Failure?.Kind);
        Assert.Equal("C-1001 was already sold, so it can't be processed. Pick another item.", result.Failure!.Message);
        db.ChangeTracker.Clear();
        Assert.Equal(0, await db.WorkOrders.CountAsync());
        Assert.Equal(1, await db.InventoryItems.CountAsync());
    }

    [Fact]
    public async Task A_null_output_is_rejected_not_a_crash()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);

        var result = await WorkOrderService.PostAsync(
            db, new CreateWorkOrderRequest(coil.Id, [SlitCoil, null!]), user.Id, CancellationToken.None);

        Assert.Equal(WorkOrderFailureKind.Invalid, result.Failure?.Kind);
    }

    [Fact]
    public async Task A_stale_load_that_still_says_InStock_is_rejected_on_save()
    {
        // The second context's copy of C-1001 says InStock, but the row has moved on. (RowVersion or the
        // one-work-order-per-input index catches it, depending on the order EF runs the statements.)
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);
        await using var stale = NewContextOnSameDatabase(db);
        await stale.InventoryItems.SingleAsync(i => i.Id == coil.Id); // tracked, InStock

        var winner = await WorkOrderService.PostAsync(db, ScenarioRequest(coil.Id), user.Id, CancellationToken.None);
        var loser = await WorkOrderService.PostAsync(stale, ScenarioRequest(coil.Id), user.Id, CancellationToken.None);

        Assert.Null(winner.Failure);
        Assert.Equal(WorkOrderFailureKind.Conflict, loser.Failure?.Kind);
        db.ChangeTracker.Clear();
        Assert.Equal(1, await db.WorkOrders.CountAsync());
        Assert.Equal(5, await db.InventoryItems.CountAsync(i => i.SourceWorkOrderId != null));
    }

    [Fact]
    public async Task An_already_consumed_item_cannot_be_processed_or_previewed()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);
        await WorkOrderService.PostAsync(db, ScenarioRequest(coil.Id), user.Id, CancellationToken.None);

        var again = await WorkOrderService.PostAsync(db, ScenarioRequest(coil.Id), user.Id, CancellationToken.None);
        var preview = await WorkOrderService.PreviewAsync(db, ScenarioRequest(coil.Id), CancellationToken.None);

        Assert.Equal(WorkOrderFailureKind.Conflict, again.Failure?.Kind);
        Assert.Equal(WorkOrderFailureKind.Conflict, preview.Failure?.Kind);
    }

    [Fact]
    public async Task Outputs_heavier_than_the_input_are_not_posted()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);
        var tooHeavy = new CreateWorkOrderRequest(coil.Id, [SlitCoil, SlitCoil, SlitCoil, SlitCoil, Scrap with { WeightLbs = 500m }]);

        var result = await WorkOrderService.PostAsync(db, tooHeavy, user.Id, CancellationToken.None);

        Assert.Equal(WorkOrderFailureKind.Invalid, result.Failure?.Kind);
        Assert.Contains(result.Failure!.Errors, e => e.Contains("100 lbs more than C-1001"));
        db.ChangeTracker.Clear();
        Assert.Equal(0, await db.WorkOrders.CountAsync());
        Assert.Equal(InventoryItemStatus.InStock, (await db.InventoryItems.SingleAsync(i => i.Id == coil.Id)).Status);
    }

    [Fact]
    public async Task Lighter_outputs_post_with_the_warning()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);
        var lighter = new CreateWorkOrderRequest(coil.Id, [SlitCoil, SlitCoil, SlitCoil, SlitCoil, Scrap with { WeightLbs = 350m }]);

        var result = await WorkOrderService.PostAsync(db, lighter, user.Id, CancellationToken.None);

        Assert.Null(result.Failure);
        Assert.Contains("50 lbs less than C-1001", Assert.Single(result.Value!.Warnings));
        Assert.Equal(16_800.00m, result.Value.Outputs.Sum(o => o.TotalCost));
    }

    [Fact]
    public async Task Preview_shows_the_scenario_costs_without_saving()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (_, coil) = await AddScenarioCoilAsync(db);

        var result = await WorkOrderService.PreviewAsync(db, ScenarioRequest(coil.Id), CancellationToken.None);

        var preview = result.Value!;
        Assert.True(preview.CanPost);
        Assert.Equal([4_200.00m, 4_200.00m, 4_200.00m, 4_200.00m, 0.00m], preview.Outputs.Select(o => o.TotalCost));
        Assert.Equal([false, false, false, false, true], preview.Outputs.Select(o => o.IsScrap));
        Assert.Equal(0m, preview.RemainingLbs);
        Assert.Equal(0, await db.WorkOrders.CountAsync());
        Assert.Equal(InventoryItemStatus.InStock, (await db.InventoryItems.AsNoTracking().SingleAsync()).Status);
    }

    [Fact]
    public async Task Preview_returns_rule_breaks_instead_of_failing()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (_, coil) = await AddScenarioCoilAsync(db);

        var result = await WorkOrderService.PreviewAsync(db, new CreateWorkOrderRequest(coil.Id, []), CancellationToken.None);

        Assert.Null(result.Failure);
        Assert.False(result.Value!.CanPost);
        Assert.Equal("Add at least one output.", Assert.Single(result.Value.Errors));
    }

    [Fact]
    public async Task Inactive_product_or_location_is_rejected()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);
        (await db.Locations.FindAsync(LocationIds.Rack4))!.IsActive = false;
        await db.SaveChangesAsync();

        var result = await WorkOrderService.PostAsync(db, ScenarioRequest(coil.Id), user.Id, CancellationToken.None);

        Assert.Equal(WorkOrderFailureKind.Invalid, result.Failure?.Kind);
        Assert.Contains("One of the locations isn't available any more. Pick it again.", result.Failure!.Errors);
    }

    [Fact]
    public async Task Unknown_input_item_is_not_found()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, _) = await AddScenarioCoilAsync(db);

        var result = await WorkOrderService.PostAsync(db, ScenarioRequest(999_999), user.Id, CancellationToken.None);

        Assert.Equal(WorkOrderFailureKind.NotFound, result.Failure?.Kind);
    }

    [Fact]
    public async Task Options_list_only_in_stock_items_with_scrap_flags()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var (user, coil) = await AddScenarioCoilAsync(db);
        await WorkOrderService.PostAsync(db, ScenarioRequest(coil.Id), user.Id, CancellationToken.None);

        var options = await WorkOrderService.GetOptionsAsync(db, CancellationToken.None);

        Assert.DoesNotContain(options.Inputs, i => i.Tag == "C-1001"); // consumed
        Assert.Equal(5, options.Inputs.Count);
        var slit = options.Inputs.First();
        Assert.Equal(("C-1002", "12\" Slit Coil", 9_900m, 4_200.00m, "Rack 4"),
            (slit.Tag, slit.ProductName, slit.WeightLbs, slit.TotalCost, slit.LocationName));
        Assert.True(options.Products.Single(p => p.Id == ProductIds.SteelScrap).IsScrap);
        Assert.False(options.Products.Single(p => p.Id == ProductIds.SlitCoil12In).IsScrap);
        Assert.Contains(options.Locations, l => l is { Name: "Scrap Bin", Kind: "Bin" });
    }

    /// <summary>The scenario after step 3: PO #2201's steel line received as C-1001 into Bay 2.</summary>
    private static async Task<(AppUser User, InventoryItem Coil)> AddScenarioCoilAsync(AppDbContext db)
    {
        var user = new AppUser { FirebaseUid = "test-uid", Email = "purchaser@test.local", Role = UserRole.Purchaser };
        var po = new PurchaseOrder
        {
            VendorId = VendorIds.Supplier,
            CreatedBy = user,
            Status = PurchaseOrderStatus.Received,
            Lines = [new() { ProductId = ProductIds.HotRolledSteelCoil, WeightLbs = 40_000m, PricePerLb = 0.42m }],
        };
        var coil = new InventoryItem
        {
            ProductId = ProductIds.HotRolledSteelCoil,
            LocationId = LocationIds.Bay2,
            WeightLbs = 40_000m,
            TotalCost = 16_800.00m,
            SourcePurchaseOrderLine = po.Lines[0],
        };
        db.AddRange(user, po, coil);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear(); // each test starts like a fresh request
        return (user, coil);
    }

    private static AppDbContext NewContextOnSameDatabase(AppDbContext db) => new(
        new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(db.Database.GetConnectionString()).Options);
}
