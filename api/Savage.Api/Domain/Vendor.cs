namespace Savage.Api.Domain;

public enum VendorKind
{
    Supplier = 0,
    Customer = 1,
    Both = 2,
}

/// <summary>
/// Someone we buy from (supplier) or sell to (customer). Never deleted once used on a PO or SO;
/// deactivate instead.
/// </summary>
public class Vendor
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public VendorKind Kind { get; set; }

    /// <summary>True when a purchaser quick-added it while writing a PO, so admin can review it.</summary>
    public bool AddedByPurchaser { get; set; }

    public bool IsActive { get; set; } = true;
}
