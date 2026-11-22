namespace Savage.Api.Features.Reports;

/// <summary>Report math. Margin is profit ÷ revenue (not markup, which would be profit ÷ cost).</summary>
public static class ProfitMath
{
    public static decimal Profit(decimal revenue, decimal cost) => revenue - cost;

    /// <summary>
    /// Margin as a fraction (0.2287 = 22.87%), unrounded: it's rounded only for display, so a value like
    /// 22.849% can't round twice into 22.9%. Null when there's no revenue to divide by.
    /// </summary>
    public static decimal? Margin(decimal revenue, decimal cost) =>
        revenue == 0 ? null : (revenue - cost) / revenue;
}
