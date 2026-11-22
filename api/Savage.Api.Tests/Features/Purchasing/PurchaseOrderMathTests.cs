using Savage.Api.Features.Purchasing;

namespace Savage.Api.Tests.Features.Purchasing;

public class PurchaseOrderMathTests
{
    // ---- Assignment scenario, step 2: PO #2201 ----

    [Fact]
    public void Scenario_PO2201_line_totals_and_total()
    {
        Assert.Equal(16_800.00m, PurchaseOrderMath.LineTotal(40_000m, 0.42m));
        Assert.Equal(6_750.00m, PurchaseOrderMath.LineTotal(5_000m, 1.35m));
        Assert.Equal(23_550.00m, PurchaseOrderMath.Total([(40_000m, 0.42m), (5_000m, 1.35m)]));
    }

    // ---- Rounding ----

    [Theory]
    [InlineData("1", "0.005", "0.01")] // half a cent rounds up, like a calculator
    [InlineData("1", "0.0049", "0.00")]
    [InlineData("1234.57", "0.4235", "522.84")] // 522.840395
    [InlineData("0.01", "0.0001", "0.00")]
    public void Line_total_rounds_to_the_cent_half_away_from_zero(string weight, string price, string expected)
    {
        Assert.Equal(decimal.Parse(expected), PurchaseOrderMath.LineTotal(decimal.Parse(weight), decimal.Parse(price)));
    }

    [Fact]
    public void Total_adds_the_rounded_line_totals_so_it_matches_the_received_item_costs()
    {
        // Each line is $0.005 → $0.01 once rounded. Rounding the sum instead would give $0.02 for three lines,
        // a cent less than the three items' costs add up to.
        var lines = new[] { (1m, 0.005m), (1m, 0.005m), (1m, 0.005m) };

        Assert.Equal(0.03m, PurchaseOrderMath.Total(lines));
        Assert.Equal(lines.Sum(l => PurchaseOrderMath.LineTotal(l.Item1, l.Item2)), PurchaseOrderMath.Total(lines));
    }

    [Fact]
    public void Total_of_no_lines_is_zero()
    {
        Assert.Equal(0m, PurchaseOrderMath.Total([]));
    }

    [Theory]
    [InlineData("40000", 2, true)]
    [InlineData("40000.25", 2, true)]
    [InlineData("40000.255", 2, false)]
    [InlineData("0.4235", 4, true)]
    [InlineData("0.42351", 4, false)]
    public void Fits_decimals_matches_the_column_scale(string value, int decimals, bool expected)
    {
        Assert.Equal(expected, PurchaseOrderMath.FitsDecimals(decimal.Parse(value), decimals));
    }
}
