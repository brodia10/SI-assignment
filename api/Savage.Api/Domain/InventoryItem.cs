namespace Savage.Api.Domain;

public enum InventoryItemStatus
{
    InStock = 0,
    Consumed = 1,
    Sold = 2,
    Voided = 3,
}

/// <summary>
/// One physical piece or lot (e.g. coil C-1001) sitting at a location.
/// Cost is stored as <see cref="TotalCost"/>; $/lb is only ever calculated for display.
/// Lineage: exactly one of the source links is set, so following them back always reaches a PO.
/// </summary>
public class InventoryItem
{
    public int Id { get; set; }

    /// <summary>Floor tag like "C-1001", assigned by a SQL Server sequence on insert.</summary>
    public string Tag { get; set; } = null!;

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int LocationId { get; set; }
    public Location Location { get; set; } = null!;
    public decimal WeightLbs { get; set; }
    public decimal TotalCost { get; set; }
    public InventoryItemStatus Status { get; set; } = InventoryItemStatus.InStock;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Set when the item was created by receiving a PO line.</summary>
    public int? SourcePurchaseOrderLineId { get; set; }
    public PurchaseOrderLine? SourcePurchaseOrderLine { get; set; }

    /// <summary>Set when the item is an output of a work order.</summary>
    public int? SourceWorkOrderId { get; set; }
    public WorkOrder? SourceWorkOrder { get; set; }

    /// <summary>Optimistic concurrency token: two posts racing on the same item can't both win.</summary>
    public byte[] RowVersion { get; set; } = null!;
}
