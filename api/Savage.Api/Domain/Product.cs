namespace Savage.Api.Domain;

/// <summary>
/// A type of material in the catalog (e.g. "12\" Slit Coil"), not a physical piece.
/// Default prices pre-fill PO and SO lines; the purchaser can change them per line.
/// </summary>
public class Product
{
    public int Id { get; set; }
    public required string Name { get; set; }

    /// <summary>Scrap outputs of a work order carry $0 cost.</summary>
    public bool IsScrap { get; set; }

    public decimal? DefaultBuyPricePerLb { get; set; }
    public decimal? DefaultSellPricePerLb { get; set; }
    public bool IsActive { get; set; } = true;
}
