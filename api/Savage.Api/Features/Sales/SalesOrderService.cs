using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Features.Sales;

/// <summary>What happened when a sales order was posted.</summary>
public abstract record PostSalesOrderResult
{
    public sealed record Posted(SalesOrderCreated Order) : PostSalesOrderResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : PostSalesOrderResult;
    public sealed record Conflict(string Message) : PostSalesOrderResult;
}

/// <summary>Reads and posts sales orders. The rules live in <see cref="SalesOrderRules"/>.</summary>
public static class SalesOrderService
{
    public const string RaceMessage =
        "Someone else just shipped or processed one of these items.";

    public static Task<List<CustomerOption>> CustomersAsync(AppDbContext db, CancellationToken ct = default) =>
        db.Vendors.AsNoTracking()
            .Where(v => v.IsActive && (v.Kind == VendorKind.Customer || v.Kind == VendorKind.Both))
            .OrderBy(v => v.Name)
            .Select(v => new CustomerOption(v.Id, v.Name))
            .ToListAsync(ct);

    public static Task<List<AvailableItem>> AvailableItemsAsync(AppDbContext db, CancellationToken ct = default) =>
        db.InventoryItems.AsNoTracking()
            .Where(i => i.Status == InventoryItemStatus.InStock)
            .OrderBy(i => i.Product.Name).ThenBy(i => i.Location.Name).ThenBy(i => i.Id)
            .Select(i => new AvailableItem(
                i.Id, i.Tag, i.ProductId, i.Product.Name, i.Location.Name, i.WeightLbs,
                i.Product.DefaultSellPricePerLb))
            .ToListAsync(ct);

    /// <summary>
    /// Posts the order and marks its items Sold in one <c>SaveChanges</c>, which is one transaction.
    /// Items are checked for InStock here, and each item's RowVersion stops two posts that race on
    /// the same item from both winning.
    /// </summary>
    public static async Task<PostSalesOrderResult> PostAsync(
        AppDbContext db, int userId, CreateSalesOrderRequest request, CancellationToken ct = default)
    {
        var itemIds = (request.Lines ?? []).Where(l => l is not null).Select(l => l.InventoryItemId).Distinct().ToList();
        var items = await db.InventoryItems
            .Where(i => itemIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, ct);
        var customer = await db.Vendors.FindAsync([request.CustomerVendorId], ct);

        var check = SalesOrderRules.Check(request, customer, items);
        if (check.Errors.Count > 0) return new PostSalesOrderResult.Invalid(check.Errors);
        if (check.Conflict is not null) return new PostSalesOrderResult.Conflict(check.Conflict);

        var order = new SalesOrder
        {
            CustomerVendorId = request.CustomerVendorId,
            ContainerNumber = SalesOrderRules.NormalizeContainerNumber(request.ContainerNumber),
            CreatedByUserId = userId,
            Lines = [.. check.Lines],
        };
        foreach (var line in check.Lines)
            line.InventoryItem.Status = InventoryItemStatus.Sold;
        db.SalesOrders.Add(order);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            db.ChangeTracker.Clear();
            return new PostSalesOrderResult.Conflict(RaceMessage);
        }

        return new PostSalesOrderResult.Posted(new SalesOrderCreated(order.Id, order.Number));
    }

    /// <summary>Most recent first.</summary>
    public static Task<List<SalesOrderSummary>> ListAsync(AppDbContext db, int take = 50, CancellationToken ct = default) =>
        db.SalesOrders.AsNoTracking()
            .Where(s => s.Status == SalesOrderStatus.Shipped)
            .OrderByDescending(s => s.Number)
            .Take(take)
            .Select(s => new SalesOrderSummary(
                s.Id, s.Number, s.Customer.Name, s.ContainerNumber, s.CreatedAt,
                s.Lines.Count, s.Lines.Sum(l => l.WeightLbs), s.Lines.Sum(l => l.Revenue)))
            .ToListAsync(ct);

    public static async Task<SalesOrderDetail?> GetAsync(AppDbContext db, int id, CancellationToken ct = default)
    {
        var order = await db.SalesOrders.AsNoTracking()
            .Where(s => s.Id == id)
            .Select(s => new
            {
                s.Id, s.Number, Customer = s.Customer.Name, s.ContainerNumber, s.CreatedAt, s.CreatedBy.Email,
                Lines = s.Lines.OrderBy(l => l.Id).Select(l => new SalesOrderDetailLine(
                    l.InventoryItemId, l.InventoryItem.Tag, l.InventoryItem.Product.Name,
                    l.WeightLbs, l.PricePerLb, l.Revenue)).ToList(),
            })
            .SingleOrDefaultAsync(ct);
        if (order is null) return null;

        return new SalesOrderDetail(
            order.Id, order.Number, order.Customer, order.ContainerNumber, order.CreatedAt, order.Email,
            order.Lines.Sum(l => l.WeightLbs), order.Lines.Sum(l => l.Revenue), order.Lines);
    }
}
