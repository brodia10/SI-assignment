namespace Savage.Api.Features.Purchasing;

/// <summary>
/// Money on a purchase order. Line totals aren't stored; they're always calculated here, so the PO screen,
/// the PO list and receiving can't disagree.
/// <list type="bullet">
///   <item>A line total is weight × $/lb, rounded to the cent (half away from zero, like a calculator).</item>
///   <item>The PO total is the sum of the <b>rounded</b> line totals, so it equals the cost of the
///   inventory items the PO becomes, to the cent.</item>
/// </list>
/// </summary>
public static class PurchaseOrderMath
{
    /// <summary>Weights are stored with 2 decimals (decimal(18,2)).</summary>
    public const int WeightDecimals = 2;

    /// <summary>$/lb is stored with 4 decimals (decimal(18,4)).</summary>
    public const int PriceDecimals = 4;

    public static decimal LineTotal(decimal weightLbs, decimal pricePerLb) =>
        Math.Round(weightLbs * pricePerLb, 2, MidpointRounding.AwayFromZero);

    public static decimal Total(IEnumerable<(decimal WeightLbs, decimal PricePerLb)> lines) =>
        lines.Sum(l => LineTotal(l.WeightLbs, l.PricePerLb));

    /// <summary>True when the value has no more decimals than the column stores, so saving won't round it.</summary>
    public static bool FitsDecimals(decimal value, int decimals) => value == Math.Round(value, decimals);
}
