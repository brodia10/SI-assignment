using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Features.Purchasing;

/// <summary>The inventory item a received PO line became, as it stands now (it may since have been processed or sold).</summary>
public sealed record ReceivedItemResponse(
    int InventoryItemId,
    string Tag,
    string LocationName,
    decimal WeightLbs,
    decimal TotalCost,
    [property: JsonConverter(typeof(JsonStringEnumConverter<InventoryItemStatus>))] InventoryItemStatus Status);

public sealed record PurchaseOrderLineResponse(
    int Id,
    int ProductId,
    string ProductName,
    decimal WeightLbs,
    decimal PricePerLb,
    decimal LineTotal,
    string? Grade,
    IReadOnlyList<ReceivedItemResponse> ReceivedItems);

public sealed record PurchaseOrderResponse(
    int Id,
    int Number,
    int VendorId,
    string VendorName,
    [property: JsonConverter(typeof(JsonStringEnumConverter<PurchaseOrderStatus>))] PurchaseOrderStatus Status,
    DateTimeOffset CreatedAt,
    string CreatedByEmail,
    DateTimeOffset? ReceivedAt,
    string? ReceivedByEmail,
    decimal TotalWeightLbs,
    decimal Total,
    IReadOnlyList<PurchaseOrderLineResponse> Lines);

public sealed record PurchaseOrderSummary(
    int Id,
    int Number,
    string VendorName,
    [property: JsonConverter(typeof(JsonStringEnumConverter<PurchaseOrderStatus>))] PurchaseOrderStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReceivedAt,
    int LineCount,
    decimal TotalWeightLbs,
    decimal Total);

public sealed record SupplierOption(int Id, string Name);

public sealed record ProductOption(int Id, string Name, decimal? DefaultBuyPricePerLb);

/// <summary>Everything the New PO screen needs to fill its pick lists.</summary>
public sealed record PurchaseOrderFormOptions(IReadOnlyList<SupplierOption> Suppliers, IReadOnlyList<ProductOption> Products);

/// <summary>Read side of purchasing. Totals are calculated with <see cref="PurchaseOrderMath"/>, never stored.</summary>
public static class PurchaseOrderQueries
{
    /// <summary>
    /// Newest 100 only. Plenty for one yard's open POs and recent history; paging or search comes when the list
    /// outgrows that.
    /// </summary>
    public const int ListLimit = 100;

    /// <summary>How many receipts the Receiving screen's "Recently received" section shows.</summary>
    public const int RecentlyReceivedLimit = 10;

    public static async Task<PurchaseOrderResponse?> GetAsync(AppDbContext db, int id, CancellationToken ct = default)
    {
        var po = await db.PurchaseOrders.AsNoTracking()
            .Include(p => p.Vendor)
            .Include(p => p.CreatedBy)
            .Include(p => p.ReceivedBy)
            .Include(p => p.Lines).ThenInclude(l => l.Product)
            .SingleOrDefaultAsync(p => p.Id == id, ct);
        if (po is null) return null;

        // What each line became when it was received. Receiving makes one item per line, but the contract doesn't
        // rely on that.
        var items = (await db.InventoryItems.AsNoTracking()
                .Where(i => i.SourcePurchaseOrderLine!.PurchaseOrderId == id)
                .OrderBy(i => i.Id)
                .Select(i => new
                {
                    LineId = i.SourcePurchaseOrderLineId!.Value,
                    Item = new ReceivedItemResponse(i.Id, i.Tag, i.Location.Name, i.WeightLbs, i.TotalCost, i.Status),
                })
                .ToListAsync(ct))
            .ToLookup(x => x.LineId, x => x.Item);

        var lines = po.Lines.OrderBy(l => l.Id).Select(l => new PurchaseOrderLineResponse(
            l.Id, l.ProductId, l.Product.Name, l.WeightLbs, l.PricePerLb,
            PurchaseOrderMath.LineTotal(l.WeightLbs, l.PricePerLb), l.Grade, items[l.Id].ToList())).ToList();

        return new PurchaseOrderResponse(
            po.Id, po.Number, po.VendorId, po.Vendor.Name, po.Status, po.CreatedAt, po.CreatedBy.Email,
            po.ReceivedAt, po.ReceivedBy?.Email, lines.Sum(l => l.WeightLbs), lines.Sum(l => l.LineTotal), lines);
    }

    /// <summary>Newest first. Optionally only one status (receiving asks for Open).</summary>
    public static Task<List<PurchaseOrderSummary>> ListAsync(
        AppDbContext db, PurchaseOrderStatus? status, CancellationToken ct = default)
    {
        var query = db.PurchaseOrders.AsNoTracking();
        if (status is not null) query = query.Where(p => p.Status == status);
        return SummariesAsync(query.OrderByDescending(p => p.Number).Take(ListLimit), ct);
    }

    /// <summary>The last few receipts, most recently received first, so a receipt can be looked up again later.</summary>
    public static Task<List<PurchaseOrderSummary>> RecentlyReceivedAsync(
        AppDbContext db, int take = RecentlyReceivedLimit, CancellationToken ct = default) =>
        SummariesAsync(db.PurchaseOrders.AsNoTracking()
            .Where(p => p.Status == PurchaseOrderStatus.Received)
            .OrderByDescending(p => p.ReceivedAt).ThenByDescending(p => p.Number)
            .Take(take), ct);

    /// <summary>Projects already ordered and limited POs to summaries, keeping their order.</summary>
    private static async Task<List<PurchaseOrderSummary>> SummariesAsync(
        IQueryable<PurchaseOrder> ordered, CancellationToken ct)
    {
        var rows = await ordered
            .Select(p => new
            {
                p.Id, p.Number, VendorName = p.Vendor.Name, p.Status, p.CreatedAt, p.ReceivedAt,
                Lines = p.Lines.Select(l => new { l.WeightLbs, l.PricePerLb }).ToList(),
            })
            .ToListAsync(ct);

        return rows.Select(p => new PurchaseOrderSummary(
            p.Id, p.Number, p.VendorName, p.Status, p.CreatedAt, p.ReceivedAt, p.Lines.Count,
            p.Lines.Sum(l => l.WeightLbs),
            PurchaseOrderMath.Total(p.Lines.Select(l => (l.WeightLbs, l.PricePerLb))))).ToList();
    }

    public static async Task<PurchaseOrderFormOptions> FormOptionsAsync(AppDbContext db, CancellationToken ct = default)
    {
        var suppliers = await db.Vendors.AsNoTracking()
            .Where(v => v.IsActive && v.Kind != VendorKind.Customer)
            .OrderBy(v => v.Name)
            .Select(v => new SupplierOption(v.Id, v.Name))
            .ToListAsync(ct);

        var products = await db.Products.AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.Name)
            .Select(p => new ProductOption(p.Id, p.Name, p.DefaultBuyPricePerLb))
            .ToListAsync(ct);

        return new PurchaseOrderFormOptions(suppliers, products);
    }
}
