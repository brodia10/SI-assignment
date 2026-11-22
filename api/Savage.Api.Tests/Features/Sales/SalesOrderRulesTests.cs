using Savage.Api.Domain;
using Savage.Api.Features.Sales;

namespace Savage.Api.Tests.Features.Sales;

public class SalesOrderRulesTests
{
    private static readonly Vendor Customer = new() { Id = 2, Name = "Buckeye Fabrication", Kind = VendorKind.Customer };

    [Theory]
    [InlineData("9900", "0.55", "5445.00")] // one scenario slit coil
    [InlineData("400", "0.15", "60.00")] // the scrap
    [InlineData("1", "0.125", "0.13")] // half a cent rounds up
    [InlineData("1", "0.1249", "0.12")]
    [InlineData("1234.56", "0.4237", "523.08")] // 523.082...
    [InlineData("100", "0", "0.00")]
    public void Revenue_is_weight_times_price_rounded_to_the_cent(string weight, string price, string expected)
    {
        Assert.Equal(decimal.Parse(expected), SalesOrderRules.Revenue(decimal.Parse(weight), decimal.Parse(price)));
    }

    [Fact]
    public void Scenario_order_gets_revenue_and_cost_per_line()
    {
        var a = InStock(3, "C-1003", 9_900m, 4_200m);
        var b = InStock(4, "C-1004", 9_900m, 4_200m);

        var check = SalesOrderRules.Check(Request(Line(3, 0.55m), Line(4, 0.55m)), Customer, Items(a, b));

        Assert.True(check.IsOk);
        Assert.Equal(10_890.00m, check.Lines.Sum(l => l.Revenue));
        Assert.Equal(8_400.00m, check.Lines.Sum(l => l.Cost));
        Assert.All(check.Lines, l => Assert.Equal(9_900m, l.WeightLbs));
        Assert.Equal([3, 4], check.Lines.Select(l => l.InventoryItemId));
    }

    [Fact]
    public void Cost_is_the_items_total_cost_exactly_not_a_rounded_per_lb_cost()
    {
        // $16,800 / 39,600 lbs ≈ $0.424/lb; 9,900 × 0.424 would give $4,197.60.
        var item = InStock(3, "C-1003", 9_900m, 4_200.00m);

        var check = SalesOrderRules.Check(Request(Line(3, 0.55m)), Customer, Items(item));

        Assert.Equal(4_200.00m, Assert.Single(check.Lines).Cost);
    }

    [Theory]
    [InlineData(VendorKind.Customer, true, true)]
    [InlineData(VendorKind.Both, true, true)]
    [InlineData(VendorKind.Supplier, true, false)]
    [InlineData(VendorKind.Customer, false, false)]
    public void Only_active_customers_can_be_sold_to(VendorKind kind, bool active, bool allowed)
    {
        var vendor = new Vendor { Id = 9, Name = "V", Kind = kind, IsActive = active };

        var check = SalesOrderRules.Check(Request(Line(3, 0.55m)), vendor, Items(InStock(3)));

        Assert.Equal(allowed, check.IsOk);
        Assert.Equal(!allowed, check.Errors.ContainsKey(nameof(CreateSalesOrderRequest.CustomerVendorId)));
    }

    [Fact]
    public void Missing_customer_is_rejected()
    {
        var check = SalesOrderRules.Check(Request(Line(3, 0.55m)), null, Items(InStock(3)));

        Assert.Contains(nameof(CreateSalesOrderRequest.CustomerVendorId), check.Errors.Keys);
    }

    [Fact]
    public void An_order_needs_at_least_one_item()
    {
        var check = SalesOrderRules.Check(Request(), Customer, Items());

        Assert.Equal(["Pick at least one item to sell."], check.Errors[nameof(CreateSalesOrderRequest.Lines)]);
    }

    [Fact]
    public void The_same_item_cant_be_on_the_order_twice()
    {
        var check = SalesOrderRules.Check(Request(Line(3, 0.55m), Line(3, 0.60m)), Customer, Items(InStock(3)));

        Assert.False(check.IsOk);
        Assert.Contains(nameof(CreateSalesOrderRequest.Lines), check.Errors.Keys);
    }

    [Fact]
    public void Unknown_item_is_a_validation_error_on_its_line()
    {
        var check = SalesOrderRules.Check(Request(Line(3, 0.55m), Line(99, 0.55m)), Customer, Items(InStock(3)));

        Assert.Equal(["That item doesn't exist."], check.Errors["Lines[1]"]);
    }

    [Theory]
    [InlineData("-0.01", "Price can't be negative.")]
    [InlineData("0.55001", "Price can have at most 4 decimal places.")]
    [InlineData("1000", "Price can be at most $999.9999/lb.")]
    public void Bad_prices_are_rejected(string price, string message)
    {
        var check = SalesOrderRules.Check(Request(Line(3, decimal.Parse(price))), Customer, Items(InStock(3)));

        Assert.Equal([message], check.Errors["Lines[0]"]);
    }

    [Fact]
    public void A_null_line_is_a_validation_error_not_a_crash()
    {
        var request = new CreateSalesOrderRequest(Customer.Id, null, [Line(3, 0.55m), null!]);

        var check = SalesOrderRules.Check(request, Customer, Items(InStock(3)));

        Assert.Equal(["That line is empty."], check.Errors["Lines[1]"]);
    }

    [Fact]
    public void Four_decimal_price_is_allowed()
    {
        Assert.True(SalesOrderRules.Check(Request(Line(3, 0.5525m)), Customer, Items(InStock(3))).IsOk);
    }

    [Theory]
    [InlineData(InventoryItemStatus.Sold, "C-1003 was already sold.")]
    [InlineData(InventoryItemStatus.Consumed, "C-1003 was already used in a work order.")]
    [InlineData(InventoryItemStatus.Voided, "C-1003 was voided.")]
    public void Items_that_are_not_in_stock_are_a_conflict(InventoryItemStatus status, string message)
    {
        var item = InStock(3, "C-1003");
        item.Status = status;

        var check = SalesOrderRules.Check(Request(Line(3, 0.55m)), Customer, Items(item));

        Assert.False(check.IsOk);
        Assert.Empty(check.Errors);
        Assert.Equal(message, check.Conflict);
        Assert.Empty(check.Lines);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("   ", null)]
    [InlineData("  MSCU1234567 ", "MSCU1234567")]
    public void Container_number_is_trimmed_and_blank_means_none(string? input, string? expected)
    {
        Assert.Equal(expected, SalesOrderRules.NormalizeContainerNumber(input));
    }

    [Fact]
    public void Container_number_longer_than_the_column_is_rejected()
    {
        var request = Request(Line(3, 0.55m)) with { ContainerNumber = new string('X', 51) };

        var check = SalesOrderRules.Check(request, Customer, Items(InStock(3)));

        Assert.Contains(nameof(CreateSalesOrderRequest.ContainerNumber), check.Errors.Keys);
    }

    private static CreateSalesOrderLine Line(int itemId, decimal price) => new(itemId, price);

    private static CreateSalesOrderRequest Request(params CreateSalesOrderLine[] lines) =>
        new(Customer.Id, "MSCU1234567", lines);

    private static InventoryItem InStock(int id, string tag = "C-1003", decimal weight = 9_900m, decimal cost = 4_200m) =>
        new() { Id = id, Tag = tag, WeightLbs = weight, TotalCost = cost, Status = InventoryItemStatus.InStock };

    private static Dictionary<int, InventoryItem> Items(params InventoryItem[] items) => items.ToDictionary(i => i.Id);
}
