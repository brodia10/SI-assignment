using Savage.Api.Domain;
using Savage.Api.Features.Locations;
using Savage.Api.Features.Products;
using Savage.Api.Features.Users;
using Savage.Api.Features.Vendors;

namespace Savage.Api.Tests.Features.Admin;

public class CatalogRulesTests
{
    [Theory]
    [InlineData("  Bay   2 ", "Bay 2")]
    [InlineData("12\" Slit\tCoil", "12\" Slit Coil")]
    [InlineData(null, "")]
    public void Names_are_trimmed_and_inner_whitespace_collapsed(string? raw, string expected) =>
        Assert.Equal(expected, CatalogRules.NormalizeName(raw));

    [Fact]
    public void Name_is_required_and_length_limited()
    {
        Assert.NotNull(CatalogRules.NameError("", 10));
        Assert.NotNull(CatalogRules.NameError(new string('x', 11), 10));
        Assert.Null(CatalogRules.NameError(new string('x', 10), 10));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("0")]
    [InlineData("0.42")]
    [InlineData("0.424")]
    [InlineData("1000")]
    public void Valid_prices_pass(string? price) =>
        Assert.Null(CatalogRules.PricePerLbError(price is null ? null : decimal.Parse(price)));

    [Theory]
    [InlineData("-0.01")]
    [InlineData("0.4242")] // more precise than the price pad and the $/lb display
    [InlineData("1000.01")]
    public void Invalid_prices_are_rejected_not_rounded(string price) =>
        Assert.NotNull(CatalogRules.PricePerLbError(decimal.Parse(price)));

    [Theory]
    [InlineData("Bay", true)]
    [InlineData("Bin", true)]
    [InlineData("bay", false)]
    [InlineData("1", false)] // Enum.TryParse would accept this
    [InlineData("99", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Enum_names_must_match_exactly(string? value, bool ok) =>
        Assert.Equal(ok, CatalogRules.TryParseExact<LocationKind>(value, out _));

    [Fact]
    public void Product_validation_reports_each_bad_field()
    {
        var errors = ProductsEndpoints.Validate(new SaveProductRequest(" ", false, -1m, 0.12345m));
        Assert.Equal(["Name", "DefaultBuyPricePerLb", "DefaultSellPricePerLb"], errors.Keys);
    }

    [Fact]
    public void Scenario_products_are_valid()
    {
        Assert.Empty(ProductsEndpoints.Validate(new SaveProductRequest("Hot-Rolled Steel Coil", false, 0.42m, null)));
        Assert.Empty(ProductsEndpoints.Validate(new SaveProductRequest("Steel Scrap", true, null, 0.15m)));
    }

    [Fact]
    public void Location_needs_a_known_kind() =>
        Assert.Equal(["Kind"], LocationsEndpoints.Validate(new SaveLocationRequest("Bay 9", "Shelf")).Keys);
}

public class VendorRulesTests
{
    [Theory]
    [InlineData(VendorKind.Supplier, VendorKind.Supplier, VendorKind.Supplier)]
    [InlineData(VendorKind.Customer, VendorKind.Supplier, VendorKind.Both)]
    [InlineData(VendorKind.Supplier, VendorKind.Customer, VendorKind.Both)]
    [InlineData(VendorKind.Both, VendorKind.Customer, VendorKind.Both)]
    public void Quick_add_on_the_other_side_makes_the_vendor_both(VendorKind existing, VendorKind requested,
        VendorKind expected) =>
        Assert.Equal(expected, VendorsEndpoints.MergeKind(existing, requested));

    [Fact]
    public void Quick_add_is_for_one_side_only() =>
        Assert.Equal(["Kind"], VendorsEndpoints.Validate(new QuickAddVendorRequest("Acme", "Both")).Keys);
}

public class UserRulesTests
{
    private static AppUser Admin(int id = 1) => new() { Id = id, FirebaseUid = "u", Email = "a@x.com", Role = UserRole.Admin };

    [Theory]
    [InlineData("  Pat@Example.COM ", "pat@example.com")]
    [InlineData(null, "")]
    public void Emails_are_trimmed_and_lower_cased(string? raw, string expected) =>
        Assert.Equal(expected, UserRules.NormalizeEmail(raw));

    [Theory]
    [InlineData("pat@example.com", true)]
    [InlineData("", false)]
    [InlineData("pat", false)]
    [InlineData("pat@localhost", false)]
    [InlineData("Pat <pat@example.com>", false)] // MailAddress accepts display names; an invite shouldn't
    public void Email_must_be_a_plain_address(string email, bool ok) =>
        Assert.Equal(ok, UserRules.EmailError(email) is null);

    [Fact]
    public void Admin_cannot_deactivate_or_demote_themselves()
    {
        Assert.NotNull(UserRules.ChangeError(Admin(), actingUserId: 1, UserRole.Admin, newIsActive: false));
        Assert.NotNull(UserRules.ChangeError(Admin(), actingUserId: 1, UserRole.Purchaser, newIsActive: true));
        Assert.Null(UserRules.ChangeError(Admin(), actingUserId: 1, UserRole.Admin, newIsActive: true));
    }

    [Fact]
    public void Admin_can_change_someone_else()
    {
        Assert.Null(UserRules.ChangeError(Admin(id: 2), actingUserId: 1, UserRole.Purchaser, newIsActive: false));
    }

    [Fact]
    public void The_last_active_admin_cannot_be_demoted_or_turned_off()
    {
        Assert.NotNull(UserRules.LastAdminError(Admin(), UserRole.Purchaser, newIsActive: true, otherActiveAdmins: 0));
        Assert.NotNull(UserRules.LastAdminError(Admin(), UserRole.Admin, newIsActive: false, otherActiveAdmins: 0));
        Assert.Null(UserRules.LastAdminError(Admin(), UserRole.Purchaser, newIsActive: true, otherActiveAdmins: 1));
    }

    [Fact]
    public void Changing_a_purchaser_never_trips_the_last_admin_rule()
    {
        var purchaser = new AppUser { Id = 3, FirebaseUid = "p", Email = "p@x.com", Role = UserRole.Purchaser };
        Assert.Null(UserRules.LastAdminError(purchaser, UserRole.Purchaser, newIsActive: false, otherActiveAdmins: 0));
    }

    [Fact]
    public void Invite_validation_checks_email_and_role()
    {
        Assert.Equal(["Email", "Role"], UsersEndpoints.Validate(new InviteUserRequest("nope", "Owner")).Keys);
        Assert.Empty(UsersEndpoints.Validate(new InviteUserRequest("pat@example.com", "Purchaser")));
    }
}
