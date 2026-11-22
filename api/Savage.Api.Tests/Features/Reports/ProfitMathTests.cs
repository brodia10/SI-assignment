using Savage.Api.Features.Reports;

namespace Savage.Api.Tests.Features.Reports;

public class ProfitMathTests
{
    [Fact]
    public void Scenario_sales_order_makes_2490_at_about_22_9_percent_margin()
    {
        Assert.Equal(2_490.00m, ProfitMath.Profit(10_890.00m, 8_400.00m));

        var margin = ProfitMath.Margin(10_890.00m, 8_400.00m)!.Value;
        Assert.Equal(22.9m, Math.Round(margin * 100, 1));
    }

    [Fact]
    public void Margin_is_profit_over_revenue_not_markup()
    {
        // Markup (profit ÷ cost) would be 29.6%.
        var margin = ProfitMath.Margin(10_890m, 8_400m)!.Value;
        Assert.Equal(2_490m / 10_890m, margin);
        Assert.NotEqual(29.6m, Math.Round(margin * 100, 1));
    }

    [Fact]
    public void Margin_is_not_rounded_before_display()
    {
        // Exactly 22.849%. Rounding to 4 places first (0.2285) would then display as 22.9%
        // (the web rounds half away from zero, like Intl.NumberFormat).
        var margin = ProfitMath.Margin(100_000m, 77_151m)!.Value;
        Assert.Equal(0.22849m, margin);
        Assert.Equal(22.8m, Math.Round(margin * 100, 1, MidpointRounding.AwayFromZero));
    }

    [Fact]
    public void A_loss_gives_negative_profit_and_margin()
    {
        Assert.Equal(-50m, ProfitMath.Profit(100m, 150m));
        Assert.Equal(-0.5m, ProfitMath.Margin(100m, 150m));
    }

    [Fact]
    public void Scrap_sold_at_zero_cost_is_all_margin()
    {
        Assert.Equal(1m, ProfitMath.Margin(60m, 0m));
    }

    [Fact]
    public void No_revenue_has_no_margin()
    {
        Assert.Null(ProfitMath.Margin(0m, 0m));
        Assert.Null(ProfitMath.Margin(0m, 100m));
    }
}
