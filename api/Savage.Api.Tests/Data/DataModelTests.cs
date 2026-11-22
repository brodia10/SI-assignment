using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;
using static Savage.Api.Data.ReferenceData;

namespace Savage.Api.Tests.Data;

[Collection(SqlServerCollection.Name)]
public class DataModelTests(SqlServerFixture sql)
{
    [Fact]
    public async Task Migrations_apply_cleanly_to_a_fresh_database()
    {
        await using var db = sql.CreateContextForNewDatabase();

        await db.Database.MigrateAsync();

        var applied = await db.Database.GetAppliedMigrationsAsync();
        Assert.Equal(db.Database.GetMigrations(), applied);
        Assert.False(db.Database.HasPendingModelChanges(), "Model changed without a migration");

        var cachedSequences = await db.Database
            .SqlQuery<string>($"SELECT name AS Value FROM sys.sequences WHERE is_cached = 1")
            .ToListAsync();
        Assert.Empty(cachedSequences);
    }

    [Fact]
    public async Task Seed_data_matches_the_assignment_scenario()
    {
        await using var db = await sql.CreateMigratedContextAsync();

        var products = await db.Products.AsNoTracking().OrderBy(p => p.Id).ToListAsync();
        Assert.Collection(products,
            p => AssertProduct(p, "Hot-Rolled Steel Coil", isScrap: false, buy: 0.42m, sell: null),
            p => AssertProduct(p, "Aluminum Sheet", isScrap: false, buy: 1.35m, sell: null),
            p => AssertProduct(p, "12\" Slit Coil", isScrap: false, buy: null, sell: 0.55m),
            p => AssertProduct(p, "Steel Scrap", isScrap: true, buy: null, sell: 0.15m));

        var locations = await db.Locations.AsNoTracking().Select(l => l.Name).ToListAsync();
        foreach (var name in new[] { "Bay 2", "Rack 1", "Rack 4", "Scrap Bin" })
            Assert.Contains(name, locations);

        Assert.Equal(VendorKind.Supplier, (await db.Vendors.FindAsync(VendorIds.Supplier))!.Kind);
        Assert.Equal(VendorKind.Customer, (await db.Vendors.FindAsync(VendorIds.Customer))!.Kind);
    }

    [Fact]
    public async Task First_documents_get_the_scenario_numbers_and_tag()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddUserAsync(db);

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

        var coil = NewItemFromLine(po.Lines[0], LocationIds.Bay2, 16_800m);
        var aluminum = NewItemFromLine(po.Lines[1], LocationIds.Rack1, 6_750m);
        db.InventoryItems.AddRange(coil, aluminum);
        await db.SaveChangesAsync();

        var wo = new WorkOrder { InputItemId = coil.Id, CreatedByUserId = user.Id };
        db.WorkOrders.Add(wo);
        await db.SaveChangesAsync();

        var slit = new InventoryItem
        {
            ProductId = ProductIds.SlitCoil12In, LocationId = LocationIds.Rack4,
            WeightLbs = 9_900m, TotalCost = 4_200m, SourceWorkOrderId = wo.Id,
        };
        db.InventoryItems.Add(slit);
        await db.SaveChangesAsync();

        var so = new SalesOrder
        {
            CustomerVendorId = VendorIds.Customer,
            CreatedByUserId = user.Id,
            Lines = [new() { InventoryItemId = slit.Id, WeightLbs = 9_900m, PricePerLb = 0.55m, Revenue = 5_445m, Cost = 4_200m }],
        };
        db.SalesOrders.Add(so);
        await db.SaveChangesAsync();

        Assert.Equal(2201, po.Number);
        Assert.Equal("C-1001", coil.Tag);
        Assert.Equal("C-1002", aluminum.Tag);
        Assert.Equal(1001, wo.Number);
        Assert.Equal("C-1003", slit.Tag);
        Assert.Equal(5001, so.Number);

        // Money round-trips exactly (no rounded per-lb cost anywhere).
        db.ChangeTracker.Clear();
        Assert.Equal(16_800.00m, (await db.InventoryItems.SingleAsync(i => i.Tag == "C-1001")).TotalCost);
    }

    [Fact]
    public async Task Next_purchase_order_continues_the_sequence()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddUserAsync(db);

        var first = new PurchaseOrder { VendorId = VendorIds.Supplier, CreatedByUserId = user.Id };
        var second = new PurchaseOrder { VendorId = VendorIds.Supplier, CreatedByUserId = user.Id };
        db.PurchaseOrders.Add(first);
        await db.SaveChangesAsync();
        db.PurchaseOrders.Add(second);
        await db.SaveChangesAsync();

        Assert.Equal([2201, 2202], new[] { first.Number, second.Number });
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public async Task Inventory_item_must_have_exactly_one_source(bool fromPoLine, bool fromWorkOrder)
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddUserAsync(db);
        var po = await AddReceivablePurchaseOrderAsync(db, user);
        var coil = NewItemFromLine(po.Lines[0], LocationIds.Bay2, 16_800m);
        db.InventoryItems.Add(coil);
        var wo = new WorkOrder { InputItem = coil, CreatedByUserId = user.Id };
        db.WorkOrders.Add(wo);
        await db.SaveChangesAsync();

        db.InventoryItems.Add(new InventoryItem
        {
            ProductId = ProductIds.SteelScrap, LocationId = LocationIds.ScrapBin, WeightLbs = 400m,
            SourcePurchaseOrderLineId = fromPoLine ? po.Lines[0].Id : null,
            SourceWorkOrderId = fromWorkOrder ? wo.Id : null,
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Double_receive_of_the_same_purchase_order_is_rejected()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddUserAsync(db);
        var po = await AddReceivablePurchaseOrderAsync(db, user);

        // A double tap: two requests both load the PO while it is still Open.
        await using var other = NewContextOnSameDatabase(db);
        var otherCopy = await other.PurchaseOrders.SingleAsync(p => p.Id == po.Id);

        po.Status = PurchaseOrderStatus.Received;
        await db.SaveChangesAsync();

        otherCopy.Status = PurchaseOrderStatus.Received;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => other.SaveChangesAsync());
    }

    [Fact]
    public async Task Removing_a_line_from_an_open_purchase_order_deletes_it()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddUserAsync(db);
        var po = await AddReceivablePurchaseOrderAsync(db, user);

        po.Lines.RemoveAt(0);
        await db.SaveChangesAsync();

        Assert.Equal(0, await db.PurchaseOrderLines.CountAsync());
    }

    [Fact]
    public async Task Stale_inventory_item_update_is_rejected()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        var user = await AddUserAsync(db);
        var po = await AddReceivablePurchaseOrderAsync(db, user);
        var item = NewItemFromLine(po.Lines[0], LocationIds.Bay2, 16_800m);
        db.InventoryItems.Add(item);
        await db.SaveChangesAsync();

        // Two requests load the same coil; the first one to save wins.
        await using var other = NewContextOnSameDatabase(db);
        var otherCopy = await other.InventoryItems.SingleAsync(i => i.Id == item.Id);

        item.Status = InventoryItemStatus.Consumed;
        await db.SaveChangesAsync();

        otherCopy.Status = InventoryItemStatus.Sold;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => other.SaveChangesAsync());
    }

    private static void AssertProduct(Product p, string name, bool isScrap, decimal? buy, decimal? sell)
    {
        Assert.Equal(name, p.Name);
        Assert.Equal(isScrap, p.IsScrap);
        Assert.Equal(buy, p.DefaultBuyPricePerLb);
        Assert.Equal(sell, p.DefaultSellPricePerLb);
        Assert.True(p.IsActive);
    }

    private static async Task<AppUser> AddUserAsync(AppDbContext db)
    {
        var user = new AppUser { FirebaseUid = "test-uid", Email = "purchaser@test.local", Role = UserRole.Purchaser };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static async Task<PurchaseOrder> AddReceivablePurchaseOrderAsync(AppDbContext db, AppUser user)
    {
        var po = new PurchaseOrder
        {
            VendorId = VendorIds.Supplier, CreatedByUserId = user.Id,
            Lines = [new() { ProductId = ProductIds.HotRolledSteelCoil, WeightLbs = 40_000m, PricePerLb = 0.42m }],
        };
        db.PurchaseOrders.Add(po);
        await db.SaveChangesAsync();
        return po;
    }

    private static AppDbContext NewContextOnSameDatabase(AppDbContext db) => new(
        new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(db.Database.GetConnectionString()).Options);

    private static InventoryItem NewItemFromLine(PurchaseOrderLine line, int locationId, decimal totalCost) => new()
    {
        ProductId = line.ProductId,
        LocationId = locationId,
        WeightLbs = line.WeightLbs,
        TotalCost = totalCost,
        SourcePurchaseOrderLineId = line.Id,
    };
}
