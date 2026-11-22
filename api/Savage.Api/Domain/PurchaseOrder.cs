namespace Savage.Api.Domain;

public enum PurchaseOrderStatus
{
    Open = 0,
    Received = 1,
    Voided = 2,
}

/// <summary>What we agreed to buy from a supplier. Editable while Open; locked once received.</summary>
public class PurchaseOrder : AuditedDocument
{
    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Open;

    public int? ReceivedByUserId { get; set; }
    public AppUser? ReceivedBy { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }

    /// <summary>Optimistic concurrency token: a PO can only be received (or edited) once per read.</summary>
    public byte[] RowVersion { get; set; } = null!;

    public List<PurchaseOrderLine> Lines { get; set; } = [];
}

/// <summary>One product on a PO. Line total (weight × price) is calculated, not stored.</summary>
public class PurchaseOrderLine
{
    public int Id { get; set; }
    public int PurchaseOrderId { get; set; }
    public PurchaseOrder PurchaseOrder { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public decimal WeightLbs { get; set; }
    public decimal PricePerLb { get; set; }
    public string? Grade { get; set; }
    public string? Notes { get; set; }
}
