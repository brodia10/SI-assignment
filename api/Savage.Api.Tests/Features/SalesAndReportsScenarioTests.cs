using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;
using Savage.Api.Features.Reports;
using Savage.Api.Features.Sales;
using Savage.Api.Tests.Data;
using static Savage.Api.Data.ReferenceData;

namespace Savage.Api.Tests.Features;

/// <summary>
/// Assignment scenario steps 5–6 against real SQL Server. Steps 1–4 (PO, receiving, work order) are
/// set up directly in the database so this lane doesn't depend on the purchasing and processing lanes.
/// </summary>
[Collection(SqlServerCollection.Name)]
public class SalesAndReportsScenarioTests(SqlServerFixture sql)
{
    [Fact]
    public async Task Step_5_sales_order_5001_ships_two_slit_coils_for_10890()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);

        var result = await SalesOrderService.PostAsync(db, s.User.Id, s.SellTwoSlitCoils());

        var posted = Assert.IsType<PostSalesOrderResult.Posted>(result);
        Assert.Equal(5001, posted.Order.Number);

        db.ChangeTracker.Clear();
        var order = await db.SalesOrders.Include(o => o.Lines).SingleAsync(o => o.Id == posted.Order.Id);
        Assert.Equal(VendorIds.Customer, order.CustomerVendorId);
        Assert.Equal("MSCU1234567", order.ContainerNumber);
        Assert.Equal(19_800m, order.Lines.Sum(l => l.WeightLbs));
        Assert.Equal(10_890.00m, order.Lines.Sum(l => l.Revenue));
        Assert.Equal(8_400.00m, order.Lines.Sum(l => l.Cost));
        Assert.All(order.Lines, l => Assert.Equal(0.55m, l.PricePerLb));

        var statuses = await db.InventoryItems.Where(i => i.Tag == "C-1003" || i.Tag == "C-1004")
            .Select(i => i.Status).ToListAsync();
        Assert.Equal([InventoryItemStatus.Sold, InventoryItemStatus.Sold], statuses);

        // The purchaser's view of the order: revenue, no cost.
        var detail = await SalesOrderService.GetAsync(db, order.Id);
        Assert.Equal(10_890.00m, detail!.Revenue);
        Assert.Equal(["C-1003", "C-1004"], detail.Lines.Select(l => l.Tag));
        Assert.Equal(10_890.00m, Assert.Single(await SalesOrderService.ListAsync(db)).Revenue);
    }

    [Fact]
    public async Task Step_6_sales_report_shows_cost_8400_revenue_10890_profit_2490_margin_22_9()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);
        await SalesOrderService.PostAsync(db, s.User.Id, s.SellTwoSlitCoils());

        var report = await ReportQueries.SalesAsync(db);

        var so = Assert.Single(report.Orders);
        Assert.Equal(5001, so.Number);
        Assert.Equal("Buckeye Fabrication", so.CustomerName);
        Assert.Equal(8_400.00m, so.Cost);
        Assert.Equal(10_890.00m, so.Revenue);
        Assert.Equal(2_490.00m, so.Profit);
        Assert.Equal(22.9m, Math.Round(so.Margin!.Value * 100, 1));
        Assert.All(so.Lines, l => Assert.Equal(1_245.00m, l.Profit));
        Assert.Equal(2_490.00m, report.Profit);
        Assert.Equal(so.Margin, report.Margin);
    }

    [Fact]
    public async Task Step_6_inventory_report_shows_what_is_left_by_product_and_location()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);
        await SalesOrderService.PostAsync(db, s.User.Id, s.SellTwoSlitCoils());

        var report = await ReportQueries.InventoryAsync(db);

        // C-1001 was consumed and two slit coils were sold: neither shows.
        Assert.Collection(report.Products,
            p => AssertGroup(p, "12\" Slit Coil", "Rack 4", ["C-1005", "C-1006"], 19_800m, 8_400.00m),
            p => AssertGroup(p, "Aluminum Sheet", "Rack 1", ["C-1002"], 5_000m, 6_750.00m),
            p => AssertGroup(p, "Steel Scrap", "Scrap Bin", ["C-1007"], 400m, 0.00m));
        Assert.Equal(4, report.ItemCount);
        Assert.Equal(25_200m, report.WeightLbs);
        Assert.Equal(15_150.00m, report.TotalCost);
    }

    [Fact]
    public async Task Lineage_of_a_sold_slit_coil_traces_back_to_PO_2201_and_forward_to_SO_5001()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);
        await SalesOrderService.PostAsync(db, s.User.Id, s.SellTwoSlitCoils());

        var lineage = await ReportQueries.LineageAsync(db, s.SlitCoils[0].Id);

        Assert.NotNull(lineage);
        Assert.Equal(s.SlitCoils[0].Id, lineage.ItemId);
        Assert.Equal(2201, lineage.PurchaseOrder.Number);
        Assert.Equal("Great Lakes Steel Supply", lineage.PurchaseOrder.VendorName);
        Assert.Equal("Hot-Rolled Steel Coil", lineage.PurchaseOrder.ProductName);
        Assert.Equal(0.42m, lineage.PurchaseOrder.PricePerLb);

        var coil = lineage.Root;
        Assert.Equal(("C-1001", "Bay 2", 16_800.00m, "Consumed"), (coil.Tag, coil.LocationName, coil.TotalCost, coil.Status));
        Assert.Null(coil.SoldOn);

        var wo = Assert.IsType<LineageWorkOrder>(coil.ProcessedBy);
        Assert.Equal(1001, wo.Number);
        Assert.Equal(["C-1003", "C-1004", "C-1005", "C-1006", "C-1007"], wo.Outputs.Select(o => o.Tag));
        Assert.Equal(16_800.00m, wo.Outputs.Sum(o => o.TotalCost));

        var sold = wo.Outputs.Where(o => o.SoldOn is not null).ToList();
        Assert.Equal(["C-1003", "C-1004"], sold.Select(o => o.Tag));
        Assert.All(sold, o => Assert.Equal((5001, "Buckeye Fabrication", 5_445.00m),
            (o.SoldOn!.Number, o.SoldOn.CustomerName, o.SoldOn.Revenue)));
        Assert.All(wo.Outputs, o => Assert.Null(o.ProcessedBy));
    }

    [Fact]
    public async Task Lineage_from_the_received_coil_is_the_same_family()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);

        var lineage = await ReportQueries.LineageAsync(db, s.Coil.Id);

        Assert.Equal(s.Coil.Id, lineage!.Root.Id);
        Assert.Equal(5, lineage.Root.ProcessedBy!.Outputs.Count);
        Assert.Null(await ReportQueries.LineageAsync(db, 999_999));
    }

    [Fact]
    public async Task Lineage_follows_an_output_that_was_processed_again()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);

        // A second work order cuts slit coil C-1005 in half: C-1008 and C-1009.
        var c1005 = await db.InventoryItems.SingleAsync(i => i.Id == s.SlitCoils[2].Id);
        c1005.Status = InventoryItemStatus.Consumed;
        var wo = new WorkOrder { InputItemId = c1005.Id, CreatedByUserId = s.User.Id };
        db.WorkOrders.Add(wo);
        await db.SaveChangesAsync();
        var halves = new List<InventoryItem>();
        foreach (var _ in new[] { 1, 2 })
        {
            var half = new InventoryItem
            {
                ProductId = ProductIds.SlitCoil12In, LocationId = LocationIds.Rack3,
                WeightLbs = 4_950m, TotalCost = 2_100m, SourceWorkOrderId = wo.Id,
            };
            db.InventoryItems.Add(half);
            await db.SaveChangesAsync();
            halves.Add(half);
        }

        var lineage = await ReportQueries.LineageAsync(db, halves[1].Id);

        Assert.Equal(2201, lineage!.PurchaseOrder.Number);
        Assert.Equal("C-1001", lineage.Root.Tag);
        var cut = lineage.Root.ProcessedBy!.Outputs.Single(o => o.Tag == "C-1005");
        Assert.Equal("Consumed", cut.Status);
        Assert.Equal(1002, cut.ProcessedBy!.Number);
        Assert.Equal(["C-1008", "C-1009"], cut.ProcessedBy.Outputs.Select(o => o.Tag));
        Assert.Equal(halves[1].Id, lineage.ItemId);
    }

    [Fact]
    public async Task Every_item_can_be_picked_for_tracing_with_its_status()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);
        await SalesOrderService.PostAsync(db, s.User.Id, s.SellTwoSlitCoils());

        var items = await ReportQueries.TraceableItemsAsync(db);

        Assert.Equal(7, items.Count);
        Assert.Equal("C-1007", items[0].Tag); // newest first
        Assert.Equal("Consumed", items.Single(i => i.Tag == "C-1001").Status);
        Assert.Equal("Sold", items.Single(i => i.Tag == "C-1003").Status);
        Assert.Equal("InStock", items.Single(i => i.Tag == "C-1005").Status);
    }

    [Fact]
    public async Task Selling_an_item_that_was_already_sold_is_a_conflict_and_changes_nothing()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);
        await SalesOrderService.PostAsync(db, s.User.Id, s.SellTwoSlitCoils());

        // C-1004 is sold; C-1005 is still in stock.
        var again = new CreateSalesOrderRequest(VendorIds.Customer, null,
            [new(s.SlitCoils[1].Id, 0.55m), new(s.SlitCoils[2].Id, 0.55m)]);
        var result = await SalesOrderService.PostAsync(db, s.User.Id, again);

        Assert.Equal("C-1004 was already sold.", Assert.IsType<PostSalesOrderResult.Conflict>(result).Message);
        db.ChangeTracker.Clear();
        Assert.Equal(1, await db.SalesOrders.CountAsync());
        Assert.Equal(InventoryItemStatus.InStock, (await db.InventoryItems.FindAsync(s.SlitCoils[2].Id))!.Status);
    }

    [Fact]
    public async Task Consumed_coil_cant_be_sold()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);

        var result = await SalesOrderService.PostAsync(db, s.User.Id,
            new CreateSalesOrderRequest(VendorIds.Customer, null, [new(s.Coil.Id, 0.55m)]));

        Assert.Equal("C-1001 was already used in a work order.", Assert.IsType<PostSalesOrderResult.Conflict>(result).Message);
    }

    [Fact]
    public async Task Two_posts_racing_for_the_same_coil_only_one_wins()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);

        // The second request read the coil while it was still in stock (a double tap, or two iPads).
        await using var other = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(db.Database.GetConnectionString()).Options);
        await other.InventoryItems.SingleAsync(i => i.Id == s.SlitCoils[0].Id);

        var first = await SalesOrderService.PostAsync(db, s.User.Id, s.SellTwoSlitCoils());
        var second = await SalesOrderService.PostAsync(other, s.User.Id,
            new CreateSalesOrderRequest(VendorIds.Customer, null, [new(s.SlitCoils[0].Id, 0.60m)]));

        Assert.IsType<PostSalesOrderResult.Posted>(first);
        Assert.Equal(SalesOrderService.RaceMessage, Assert.IsType<PostSalesOrderResult.Conflict>(second).Message);
        db.ChangeTracker.Clear();
        Assert.Equal(1, await db.SalesOrders.CountAsync());
        Assert.Equal(2, await db.SalesOrderLines.CountAsync());
    }

    [Fact]
    public async Task Invalid_request_is_rejected_before_anything_is_saved()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var s = await Scenario.ArrangeStepsOneToFourAsync(db);

        // Selling to the supplier.
        var result = await SalesOrderService.PostAsync(db, s.User.Id,
            new CreateSalesOrderRequest(VendorIds.Supplier, null, [new(s.SlitCoils[0].Id, 0.55m)]));

        Assert.Contains(nameof(CreateSalesOrderRequest.CustomerVendorId),
            Assert.IsType<PostSalesOrderResult.Invalid>(result).Errors.Keys);
        Assert.Equal(0, await db.SalesOrders.CountAsync());
    }

    [Fact]
    public async Task Pick_lists_offer_customers_and_in_stock_items_with_the_default_sell_price()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        await Scenario.ArrangeStepsOneToFourAsync(db);

        var customers = await SalesOrderService.CustomersAsync(db);
        var items = await SalesOrderService.AvailableItemsAsync(db);

        Assert.Equal(["Buckeye Fabrication"], customers.Select(c => c.Name));
        // The consumed coil isn't offered.
        Assert.Equal(["C-1003", "C-1004", "C-1005", "C-1006", "C-1002", "C-1007"], items.Select(i => i.Tag));
        Assert.All(items.Where(i => i.ProductName == "12\" Slit Coil"), i => Assert.Equal(0.55m, i.DefaultSellPricePerLb));
        Assert.Null(items.Single(i => i.Tag == "C-1002").DefaultSellPricePerLb);
    }

    private static void AssertGroup(
        InventoryProductGroup group, string product, string location, string[] tags, decimal weight, decimal cost)
    {
        Assert.Equal(product, group.ProductName);
        var at = Assert.Single(group.Locations);
        Assert.Equal(location, at.LocationName);
        Assert.Equal(tags, at.Items.Select(i => i.Tag));
        Assert.Equal((tags.Length, weight, cost), (group.ItemCount, group.WeightLbs, group.TotalCost));
        Assert.Equal((tags.Length, weight, cost), (at.ItemCount, at.WeightLbs, at.TotalCost));
    }

    /// <summary>The database as it stands after scenario steps 1–4.</summary>
    private sealed record Scenario(AppUser User, InventoryItem Coil, InventoryItem Aluminum, IReadOnlyList<InventoryItem> SlitCoils)
    {
        /// <summary>Step 5: two slit coils at the product's default $0.55/lb.</summary>
        public CreateSalesOrderRequest SellTwoSlitCoils() => new(
            VendorIds.Customer, "  MSCU1234567 ",
            [new(SlitCoils[0].Id, 0.55m), new(SlitCoils[1].Id, 0.55m)]);

        public static async Task<Scenario> ArrangeStepsOneToFourAsync(AppDbContext db)
        {
            var user = new AppUser { FirebaseUid = "purchaser-uid", Email = "purchaser@test.local", Role = UserRole.Purchaser };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            // Step 2: PO #2201.
            var po = new PurchaseOrder
            {
                VendorId = VendorIds.Supplier,
                CreatedByUserId = user.Id,
                Lines =
                [
                    new() { ProductId = ProductIds.HotRolledSteelCoil, WeightLbs = 40_000m, PricePerLb = 0.42m },
                    new() { ProductId = ProductIds.AluminumSheet, WeightLbs = 5_000m, PricePerLb = 1.35m },
                ],
            };
            db.PurchaseOrders.Add(po);
            await db.SaveChangesAsync();

            // Step 3: receive into Bay 2 and Rack 1. Cost comes from the PO line.
            po.Status = PurchaseOrderStatus.Received;
            po.ReceivedByUserId = user.Id;
            po.ReceivedAt = DateTimeOffset.UtcNow;
            var coil = Received(po.Lines[0], LocationIds.Bay2);
            db.InventoryItems.Add(coil);
            await db.SaveChangesAsync(); // separate saves so the tags come out in scenario order
            var aluminum = Received(po.Lines[1], LocationIds.Rack1);
            db.InventoryItems.Add(aluminum);
            await db.SaveChangesAsync();

            // Step 4: WO slits C-1001 into four 9,900 lb coils (Rack 4) and 400 lbs of scrap.
            var wo = new WorkOrder { InputItemId = coil.Id, CreatedByUserId = user.Id };
            coil.Status = InventoryItemStatus.Consumed;
            db.WorkOrders.Add(wo);
            await db.SaveChangesAsync();

            (int Product, int Location, decimal Weight, bool Scrap)[] outputs =
            [
                .. Enumerable.Repeat((ProductIds.SlitCoil12In, LocationIds.Rack4, 9_900m, false), 4),
                (ProductIds.SteelScrap, LocationIds.ScrapBin, 400m, true),
            ];
            var costs = CostAllocator.Allocate(coil.TotalCost, [.. outputs.Select(o => new AllocationOutput(o.Weight, o.Scrap))]);
            var made = new List<InventoryItem>();
            for (var i = 0; i < outputs.Length; i++)
            {
                var item = new InventoryItem
                {
                    ProductId = outputs[i].Product, LocationId = outputs[i].Location,
                    WeightLbs = outputs[i].Weight, TotalCost = costs[i], SourceWorkOrderId = wo.Id,
                };
                db.InventoryItems.Add(item);
                await db.SaveChangesAsync();
                made.Add(item);
            }

            Assert.Equal(2201, po.Number);
            Assert.Equal(["C-1001", "C-1002"], new[] { coil.Tag, aluminum.Tag });
            Assert.Equal(1001, wo.Number);
            Assert.Equal([4_200m, 4_200m, 4_200m, 4_200m, 0m], made.Select(m => m.TotalCost));

            db.ChangeTracker.Clear();
            return new Scenario(user, coil, aluminum, made.GetRange(0, 4));
        }

        private static InventoryItem Received(PurchaseOrderLine line, int locationId) => new()
        {
            ProductId = line.ProductId,
            LocationId = locationId,
            WeightLbs = line.WeightLbs,
            TotalCost = Math.Round(line.WeightLbs * line.PricePerLb, 2),
            SourcePurchaseOrderLineId = line.Id,
        };
    }
}
