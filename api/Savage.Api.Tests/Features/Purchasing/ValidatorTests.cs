using Savage.Api.Features.Purchasing;
using Savage.Api.Features.Receiving;
using static Savage.Api.Data.ReferenceData;

namespace Savage.Api.Tests.Features.Purchasing;

public class CreatePurchaseOrderValidatorTests
{
    private static CreatePurchaseOrderRequest Po(params CreatePurchaseOrderLine[] lines) =>
        new(VendorIds.Supplier, lines);

    private static CreatePurchaseOrderLine Coil(decimal weight = 40_000m, decimal price = 0.42m, string? grade = null) =>
        new(ProductIds.HotRolledSteelCoil, weight, price, grade);

    [Fact]
    public void Scenario_PO2201_is_valid()
    {
        var po = Po(Coil(), new(ProductIds.AluminumSheet, 5_000m, 1.35m));

        Assert.Empty(CreatePurchaseOrderValidator.Validate(po));
    }

    [Fact]
    public void Needs_a_supplier_and_at_least_one_line()
    {
        var errors = CreatePurchaseOrderValidator.Validate(new CreatePurchaseOrderRequest(0, []));

        Assert.Equal(["Pick the supplier."], errors["vendorId"]);
        Assert.Equal(["Add at least one product."], errors["lines"]);
    }

    [Theory]
    [InlineData("0", "Line 1: the weight must be more than 0 lbs.")]
    [InlineData("-5", "Line 1: the weight must be more than 0 lbs.")]
    [InlineData("1000000", "Line 1: the weight can't be more than 999,999.99 lbs.")]
    [InlineData("40000.001", "Line 1: the weight can have at most 2 decimal places.")]
    public void Rejects_bad_weights(string weight, string message)
    {
        var errors = CreatePurchaseOrderValidator.Validate(Po(Coil(weight: decimal.Parse(weight))));

        Assert.Equal([message], errors["lines[0].weightLbs"]);
    }

    [Theory]
    [InlineData("-0.01", "Line 1: the price can't be negative.")]
    [InlineData("1000", "Line 1: the price can't be more than $999.9999/lb.")]
    [InlineData("0.42001", "Line 1: the price can have at most 4 decimal places.")]
    public void Rejects_bad_prices(string price, string message)
    {
        var errors = CreatePurchaseOrderValidator.Validate(Po(Coil(price: decimal.Parse(price))));

        Assert.Equal([message], errors["lines[0].pricePerLb"]);
    }

    [Fact]
    public void A_zero_price_is_allowed()
    {
        Assert.Empty(CreatePurchaseOrderValidator.Validate(Po(Coil(price: 0m))));
    }

    [Fact]
    public void Errors_name_the_line_they_belong_to()
    {
        var errors = CreatePurchaseOrderValidator.Validate(Po(Coil(), new(0, 5_000m, 1.35m)));

        Assert.Equal(["Line 2: pick the product."], errors["lines[1].productId"]);
        Assert.Single(errors);
    }

    [Fact]
    public void Grade_has_a_length_limit()
    {
        var errors = CreatePurchaseOrderValidator.Validate(Po(Coil(grade: new string('A', 51))));

        Assert.Contains("lines[0].grade", errors.Keys);
    }

    [Fact]
    public void A_null_line_is_rejected_instead_of_crashing()
    {
        var errors = CreatePurchaseOrderValidator.Validate(Po(Coil(), null!));

        Assert.Contains("lines[1]", errors.Keys);
    }

    [Fact]
    public void Too_many_lines_are_rejected()
    {
        var lines = Enumerable.Repeat(Coil(), CreatePurchaseOrderValidator.MaxLines + 1).ToArray();

        Assert.Contains("lines", CreatePurchaseOrderValidator.Validate(Po(lines)).Keys);
    }
}

public class ReceivePurchaseOrderValidatorTests
{
    [Fact]
    public void A_complete_receipt_is_valid()
    {
        var request = new ReceivePurchaseOrderRequest(1,
            [new(1, LocationIds.Bay2, 40_000m), new(2, LocationIds.Rack1, 5_000m)]);

        Assert.Empty(ReceivePurchaseOrderValidator.Validate(request));
    }

    [Fact]
    public void Needs_lines()
    {
        Assert.Contains("lines", ReceivePurchaseOrderValidator.Validate(new(1, [])).Keys);
    }

    [Fact]
    public void Rejects_the_same_line_twice()
    {
        var request = new ReceivePurchaseOrderRequest(1,
            [new(1, LocationIds.Bay2, 20_000m), new(1, LocationIds.Bay1, 20_000m)]);

        Assert.Equal(["A product on the PO was listed twice. Go back and try again."],
            ReceivePurchaseOrderValidator.Validate(request)["lines"]);
    }

    [Fact]
    public void A_null_line_is_rejected_instead_of_crashing()
    {
        var request = new ReceivePurchaseOrderRequest(1, [new(1, LocationIds.Bay2, 40_000m), null!]);

        Assert.Contains("lines[1]", ReceivePurchaseOrderValidator.Validate(request).Keys);
    }

    [Theory]
    [InlineData(0, "40000", "lines[0].locationId")]
    [InlineData(LocationIds.Bay2, "0", "lines[0].weightLbs")]
    [InlineData(LocationIds.Bay2, "40000.001", "lines[0].weightLbs")]
    public void Rejects_a_missing_location_or_bad_weight(int locationId, string weight, string field)
    {
        var request = new ReceivePurchaseOrderRequest(1, [new(1, locationId, decimal.Parse(weight))]);

        Assert.Contains(field, ReceivePurchaseOrderValidator.Validate(request).Keys);
    }
}

public class QuickAddSupplierNameTests
{
    [Theory]
    [InlineData("  Acme   Steel  ", "Acme Steel")]
    [InlineData("Acme\tSteel", "Acme Steel")]
    [InlineData(null, "")]
    public void Normalizes_spacing(string? input, string expected)
    {
        Assert.Equal(expected, QuickAddSupplierHandler.NormalizeName(input));
    }
}
