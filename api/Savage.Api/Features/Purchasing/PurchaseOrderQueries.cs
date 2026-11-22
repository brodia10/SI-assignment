using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Features.Purchasing;

public sealed record PurchaseOrderLineResponse(
    int Id, int ProductId, string ProductName, decimal WeightLbs, decimal PricePerLb, decimal LineTotal, string? Grade);

public sealed record PurchaseOrderResponse(
    int Id,
    int Number,
    int VendorId,
    string VendorName,
    [property: JsonConverter(typeof(JsonStringEnumConverter<PurchaseOrderStatus>))] PurchaseOrderStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReceivedAt,
    decimal TotalWeightLbs,
    decimal Total,
    IReadOnlyList<PurchaseOrderLineResponse> Lines);

public sealed record PurchaseOrderSummary(
    int Id,
    int Number,
    string VendorName,
    [property: JsonConverter(typeof(JsonStringEnumConverter<PurchaseOrderStatus>))] PurchaseOrderStatus Status,
    DateTimeOffset CreatedAt,
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

    public static async Task<PurchaseOrderResponse?> GetAsync(AppDbContext db, int id, CancellationToken ct = default)
    {
        var po = await db.PurchaseOrders.AsNoTracking()
            .Include(p => p.Vendor)
            .Include(p => p.Lines).ThenInclude(l => l.Product)
            .SingleOrDefaultAsync(p => p.Id == id, ct);
        if (po is null) return null;

        var lines = po.Lines.OrderBy(l => l.Id).Select(l => new PurchaseOrderLineResponse(
            l.Id, l.ProductId, l.Product.Name, l.WeightLbs, l.PricePerLb,
            PurchaseOrderMath.LineTotal(l.WeightLbs, l.PricePerLb), l.Grade)).ToList();

        return new PurchaseOrderResponse(
            po.Id, po.Number, po.VendorId, po.Vendor.Name, po.Status, po.CreatedAt, po.ReceivedAt,
            lines.Sum(l => l.WeightLbs), lines.Sum(l => l.LineTotal), lines);
    }

    /// <summary>Newest first. Optionally only one status (receiving asks for Open).</summary>
    public static async Task<List<PurchaseOrderSummary>> ListAsync(
        AppDbContext db, PurchaseOrderStatus? status, CancellationToken ct = default)
    {
        var query = db.PurchaseOrders.AsNoTracking();
        if (status is not null) query = query.Where(p => p.Status == status);

        var rows = await query
            .OrderByDescending(p => p.Number)
            .Take(ListLimit)
            .Select(p => new
            {
                p.Id, p.Number, VendorName = p.Vendor.Name, p.Status, p.CreatedAt,
                Lines = p.Lines.Select(l => new { l.WeightLbs, l.PricePerLb }).ToList(),
            })
            .ToListAsync(ct);

        return rows.Select(p => new PurchaseOrderSummary(
            p.Id, p.Number, p.VendorName, p.Status, p.CreatedAt, p.Lines.Count,
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
