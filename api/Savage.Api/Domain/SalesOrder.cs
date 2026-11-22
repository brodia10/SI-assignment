namespace Savage.Api.Domain;

public enum SalesOrderStatus
{
    Shipped = 0,
    Voided = 1,
}

/// <summary>Inventory sold and shipped to a customer, usually in one container.</summary>
public class SalesOrder : AuditedDocument
{
    public int CustomerVendorId { get; set; }
    public Vendor Customer { get; set; } = null!;
    public string? ContainerNumber { get; set; }
    public SalesOrderStatus Status { get; set; } = SalesOrderStatus.Shipped;

    public List<SalesOrderLine> Lines { get; set; } = [];
}

/// <summary>
/// One item on a sales order. Revenue and Cost are captured when posted, so the report never
/// changes if a product price is edited later. Profit = Revenue − Cost.
/// </summary>
public class SalesOrderLine
{
    public int Id { get; set; }
    public int SalesOrderId { get; set; }
    public SalesOrder SalesOrder { get; set; } = null!;
    public int InventoryItemId { get; set; }
    public InventoryItem InventoryItem { get; set; } = null!;
    public decimal WeightLbs { get; set; }
    public decimal PricePerLb { get; set; }
    public decimal Revenue { get; set; }
    public decimal Cost { get; set; }
}
