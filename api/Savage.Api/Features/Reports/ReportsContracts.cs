namespace Savage.Api.Features.Reports;

// ── Inventory: in-stock items by product, then location ─────────────────────────────

public record InventoryReport(
    IReadOnlyList<InventoryProductGroup> Products,
    int ItemCount,
    decimal WeightLbs,
    decimal TotalCost);

public record InventoryProductGroup(
    int ProductId,
    string ProductName,
    bool IsScrap,
    int ItemCount,
    decimal WeightLbs,
    decimal TotalCost,
    IReadOnlyList<InventoryLocationGroup> Locations);

public record InventoryLocationGroup(
    int LocationId,
    string LocationName,
    int ItemCount,
    decimal WeightLbs,
    decimal TotalCost,
    IReadOnlyList<InventoryReportItem> Items);

public record InventoryReportItem(int Id, string Tag, decimal WeightLbs, decimal TotalCost);

// ── Sales: profit and margin per sales order ─────────────────────────────────────────

/// <summary>Margin is a fraction (0.2287), unrounded; null when revenue is $0.</summary>
public record SalesReport(
    IReadOnlyList<SalesReportOrder> Orders,
    decimal Revenue,
    decimal Cost,
    decimal Profit,
    decimal? Margin);

public record SalesReportOrder(
    int Id,
    int Number,
    DateTimeOffset ShippedAt,
    string CustomerName,
    string? ContainerNumber,
    decimal WeightLbs,
    decimal Revenue,
    decimal Cost,
    decimal Profit,
    decimal? Margin,
    IReadOnlyList<SalesReportLine> Lines);

public record SalesReportLine(
    int InventoryItemId,
    string Tag,
    string ProductName,
    decimal WeightLbs,
    decimal PricePerLb,
    decimal Revenue,
    decimal Cost,
    decimal Profit);

// ── Lineage: PO → received item → work orders → sales orders ─────────────────────────

/// <summary>
/// Any item, in any status, that can be traced. <see cref="LocationName"/> is where the item was last
/// stored; once it's sold or used up, <see cref="SoldOnNumber"/> or <see cref="UsedInWorkOrderNumber"/>
/// says where it went instead.
/// </summary>
public record TraceableItem(
    int Id,
    string Tag,
    string ProductName,
    string LocationName,
    decimal WeightLbs,
    string Status,
    int? SoldOnNumber,
    int? UsedInWorkOrderNumber);

/// <summary>
/// The whole family of an item: the PO it was bought on, the item that PO line was received as
/// (<see cref="Root"/>), and everything that item became, down to where each piece was sold.
/// <see cref="ItemId"/> is the item that was asked about, so the screen can highlight it.
/// Assumes receiving turns one PO line into one item (as in the scenario); if a line were ever split
/// into several items, only the asked-about item's branch would show.
/// </summary>
public record ItemLineage(int ItemId, LineagePurchase PurchaseOrder, LineageNode Root);

public record LineagePurchase(
    int Id,
    int Number,
    string VendorName,
    DateTimeOffset OrderedAt,
    DateTimeOffset? ReceivedAt,
    string ProductName,
    decimal WeightLbs,
    decimal PricePerLb);

public record LineageNode(
    int Id,
    string Tag,
    string ProductName,
    string LocationName,
    decimal WeightLbs,
    decimal TotalCost,
    string Status,
    LineageWorkOrder? ProcessedBy,
    LineageSale? SoldOn);

/// <summary>The work order that consumed an item, and the items it produced.</summary>
public record LineageWorkOrder(int Id, int Number, DateTimeOffset ProcessedAt, IReadOnlyList<LineageNode> Outputs);

public record LineageSale(
    int SalesOrderId,
    int Number,
    string CustomerName,
    DateTimeOffset ShippedAt,
    decimal PricePerLb,
    decimal Revenue);
