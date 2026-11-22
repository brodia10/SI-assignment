namespace Savage.Api.Features.Sales;

/// <summary>A customer the purchaser can sell to.</summary>
public record CustomerOption(int Id, string Name);

/// <summary>An in-stock item that can go on a sales order, with the product's default sell price.</summary>
public record AvailableItem(
    int Id,
    string Tag,
    int ProductId,
    string ProductName,
    string LocationName,
    decimal WeightLbs,
    decimal? DefaultSellPricePerLb);

/// <summary>Sell whole items: each line is one item at a $/lb. Weight comes from the item.</summary>
public record CreateSalesOrderRequest(
    int CustomerVendorId,
    string? ContainerNumber,
    IReadOnlyList<CreateSalesOrderLine> Lines);

public record CreateSalesOrderLine(int InventoryItemId, decimal PricePerLb);

public record SalesOrderCreated(int Id, int Number);

/// <summary>
/// A shipped sales order as the purchaser sees it. Cost and profit are left out on purpose:
/// they belong to the admin reports.
/// </summary>
public record SalesOrderSummary(
    int Id,
    int Number,
    string CustomerName,
    string? ContainerNumber,
    DateTimeOffset ShippedAt,
    int ItemCount,
    decimal WeightLbs,
    decimal Revenue);

public record SalesOrderDetail(
    int Id,
    int Number,
    string CustomerName,
    string? ContainerNumber,
    DateTimeOffset ShippedAt,
    string ShippedByEmail,
    decimal WeightLbs,
    decimal Revenue,
    IReadOnlyList<SalesOrderDetailLine> Lines);

public record SalesOrderDetailLine(
    int InventoryItemId,
    string Tag,
    string ProductName,
    decimal WeightLbs,
    decimal PricePerLb,
    decimal Revenue);
