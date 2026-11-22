using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Features.Reports;

/// <summary>
/// Read-only report queries. Totals are added up from the stored decimals (item TotalCost, line
/// Revenue and Cost); nothing is derived from a $/lb, so the numbers match the paperwork to the cent.
/// Grouping happens in memory after one query, which is plenty at a single warehouse's volume.
/// </summary>
public static class ReportQueries
{
    public static async Task<InventoryReport> InventoryAsync(AppDbContext db, CancellationToken ct = default)
    {
        var rows = await db.InventoryItems.AsNoTracking()
            .Where(i => i.Status == InventoryItemStatus.InStock)
            .Select(i => new
            {
                i.Id, i.Tag, i.WeightLbs, i.TotalCost,
                i.ProductId, ProductName = i.Product.Name, i.Product.IsScrap,
                i.LocationId, LocationName = i.Location.Name,
            })
            .ToListAsync(ct);

        var products = rows
            .GroupBy(r => new { r.ProductId, r.ProductName, r.IsScrap })
            .OrderBy(p => p.Key.IsScrap).ThenBy(p => p.Key.ProductName)
            .Select(p =>
            {
                var locations = p
                    .GroupBy(r => new { r.LocationId, r.LocationName })
                    .OrderBy(l => l.Key.LocationName)
                    .Select(l => new InventoryLocationGroup(
                        l.Key.LocationId, l.Key.LocationName, l.Count(),
                        l.Sum(r => r.WeightLbs), l.Sum(r => r.TotalCost),
                        [.. l.OrderBy(r => r.Id).Select(r => new InventoryReportItem(r.Id, r.Tag, r.WeightLbs, r.TotalCost))]))
                    .ToList();
                return new InventoryProductGroup(
                    p.Key.ProductId, p.Key.ProductName, p.Key.IsScrap, p.Count(),
                    p.Sum(r => r.WeightLbs), p.Sum(r => r.TotalCost), locations);
            })
            .ToList();

        return new InventoryReport(products, rows.Count, rows.Sum(r => r.WeightLbs), rows.Sum(r => r.TotalCost));
    }

    /// <summary>Shipped sales orders, newest first. Voided orders are left out.</summary>
    public static async Task<SalesReport> SalesAsync(AppDbContext db, CancellationToken ct = default)
    {
        var orders = await db.SalesOrders.AsNoTracking()
            .Where(s => s.Status == SalesOrderStatus.Shipped)
            .OrderByDescending(s => s.Number)
            .Select(s => new
            {
                s.Id, s.Number, s.CreatedAt, Customer = s.Customer.Name, s.ContainerNumber,
                Lines = s.Lines.OrderBy(l => l.Id).Select(l => new
                {
                    l.InventoryItemId, l.InventoryItem.Tag, ProductName = l.InventoryItem.Product.Name,
                    l.WeightLbs, l.PricePerLb, l.Revenue, l.Cost,
                }).ToList(),
            })
            .ToListAsync(ct);

        var report = orders.Select(o =>
        {
            var revenue = o.Lines.Sum(l => l.Revenue);
            var cost = o.Lines.Sum(l => l.Cost);
            return new SalesReportOrder(
                o.Id, o.Number, o.CreatedAt, o.Customer, o.ContainerNumber,
                o.Lines.Sum(l => l.WeightLbs), revenue, cost,
                ProfitMath.Profit(revenue, cost), ProfitMath.Margin(revenue, cost),
                [.. o.Lines.Select(l => new SalesReportLine(
                    l.InventoryItemId, l.Tag, l.ProductName, l.WeightLbs, l.PricePerLb,
                    l.Revenue, l.Cost, ProfitMath.Profit(l.Revenue, l.Cost)))]);
        }).ToList();

        var totalRevenue = report.Sum(o => o.Revenue);
        var totalCost = report.Sum(o => o.Cost);
        return new SalesReport(
            report, totalRevenue, totalCost,
            ProfitMath.Profit(totalRevenue, totalCost), ProfitMath.Margin(totalRevenue, totalCost));
    }

    /// <summary>Every item, newest tag first, for the "trace an item" pick list.</summary>
    public static Task<List<TraceableItem>> TraceableItemsAsync(AppDbContext db, CancellationToken ct = default) =>
        db.InventoryItems.AsNoTracking()
            .OrderByDescending(i => i.Id)
            .Select(i => new TraceableItem(
                i.Id, i.Tag, i.Product.Name, i.Location.Name, i.WeightLbs, i.Status.ToString()))
            .ToListAsync(ct);

    /// <summary>
    /// Walks back from the item to the item its PO line was received as, then loads everything that
    /// item became, one work-order generation per query. Null if the item doesn't exist.
    /// </summary>
    public static async Task<ItemLineage?> LineageAsync(AppDbContext db, int itemId, CancellationToken ct = default)
    {
        var start = await db.InventoryItems.AsNoTracking()
            .Where(i => i.Id == itemId)
            .Select(i => new { i.Id, i.SourceWorkOrderId, i.SourcePurchaseOrderLineId })
            .SingleOrDefaultAsync(ct);
        if (start is null) return null;

        // Up: follow "made by work order → that work order's input" until we reach a received item.
        var rootId = start.Id;
        var poLineId = start.SourcePurchaseOrderLineId;
        var sourceWorkOrderId = start.SourceWorkOrderId;
        for (var depth = 0; sourceWorkOrderId is { } woId; depth++)
        {
            if (depth > 100) throw new InvalidOperationException($"Lineage of item {itemId} doesn't end at a PO.");
            var parent = await db.WorkOrders.AsNoTracking()
                .Where(w => w.Id == woId)
                .Select(w => new { w.InputItem.Id, w.InputItem.SourceWorkOrderId, w.InputItem.SourcePurchaseOrderLineId })
                .SingleAsync(ct);
            rootId = parent.Id;
            poLineId = parent.SourcePurchaseOrderLineId;
            sourceWorkOrderId = parent.SourceWorkOrderId;
        }

        // The check constraint guarantees an item without a source work order has a PO line.
        var purchase = await db.PurchaseOrderLines.AsNoTracking()
            .Where(l => l.Id == poLineId)
            .Select(l => new LineagePurchase(
                l.PurchaseOrder.Id, l.PurchaseOrder.Number, l.PurchaseOrder.Vendor.Name,
                l.PurchaseOrder.CreatedAt, l.PurchaseOrder.ReceivedAt,
                l.Product.Name, l.WeightLbs, l.PricePerLb))
            .SingleAsync(ct);

        // Down: load the family one generation at a time.
        var items = new Dictionary<int, ItemRow>();
        var workOrderByInput = new Dictionary<int, WorkOrderRow>();
        List<int> frontier = [rootId];
        items[rootId] = await ItemRows(db, i => i.Id == rootId).SingleAsync(ct);
        while (frontier.Count > 0)
        {
            var ids = frontier;
            var workOrders = await db.WorkOrders.AsNoTracking()
                .Where(w => ids.Contains(w.InputItemId) && w.Status == WorkOrderStatus.Completed)
                .Select(w => new WorkOrderRow(w.Id, w.Number, w.CreatedAt, w.InputItemId))
                .ToListAsync(ct);
            foreach (var wo in workOrders) workOrderByInput[wo.InputItemId] = wo;

            var woIds = workOrders.Select(w => w.Id).ToList();
            var outputs = woIds.Count == 0
                ? []
                : await ItemRows(db, i => i.SourceWorkOrderId != null && woIds.Contains(i.SourceWorkOrderId.Value)).ToListAsync(ct);
            foreach (var output in outputs) items[output.Id] = output;
            frontier = [.. outputs.Select(o => o.Id)];
        }

        var allIds = items.Keys.ToList();
        var sales = await db.SalesOrderLines.AsNoTracking()
            .Where(l => allIds.Contains(l.InventoryItemId) && l.SalesOrder.Status == SalesOrderStatus.Shipped)
            .Select(l => new
            {
                l.InventoryItemId,
                Sale = new LineageSale(
                    l.SalesOrder.Id, l.SalesOrder.Number, l.SalesOrder.Customer.Name,
                    l.SalesOrder.CreatedAt, l.PricePerLb, l.Revenue),
            })
            .ToDictionaryAsync(l => l.InventoryItemId, l => l.Sale, ct);

        var outputsByWorkOrder = items.Values
            .Where(i => i.SourceWorkOrderId is not null)
            .ToLookup(i => i.SourceWorkOrderId!.Value);

        LineageNode Build(ItemRow item)
        {
            LineageWorkOrder? processedBy = null;
            if (workOrderByInput.TryGetValue(item.Id, out var wo))
                processedBy = new LineageWorkOrder(
                    wo.Id, wo.Number, wo.CreatedAt,
                    [.. outputsByWorkOrder[wo.Id].OrderBy(o => o.Id).Select(Build)]);
            return new LineageNode(
                item.Id, item.Tag, item.ProductName, item.LocationName, item.WeightLbs, item.TotalCost,
                item.Status.ToString(), processedBy, sales.GetValueOrDefault(item.Id));
        }

        return new ItemLineage(itemId, purchase, Build(items[rootId]));
    }

    private sealed record ItemRow(
        int Id, string Tag, string ProductName, string LocationName, decimal WeightLbs, decimal TotalCost,
        InventoryItemStatus Status, int? SourceWorkOrderId);

    private sealed record WorkOrderRow(int Id, int Number, DateTimeOffset CreatedAt, int InputItemId);

    private static IQueryable<ItemRow> ItemRows(AppDbContext db, System.Linq.Expressions.Expression<Func<InventoryItem, bool>> where) =>
        db.InventoryItems.AsNoTracking()
            .Where(where)
            .Select(i => new ItemRow(
                i.Id, i.Tag, i.Product.Name, i.Location.Name, i.WeightLbs, i.TotalCost, i.Status, i.SourceWorkOrderId));
}
