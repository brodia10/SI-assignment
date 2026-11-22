using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Domain;
using Savage.Api.Features.Locations;
using Savage.Api.Features.Me;
using Savage.Api.Features.Products;
using Savage.Api.Features.Users;
using Savage.Api.Features.Vendors;
using Savage.Api.Tests.Data;
using static Savage.Api.Data.ReferenceData;

namespace Savage.Api.Tests.Features.Admin;

/// <summary>Lane A end to end over HTTP: real auth pipeline, real SQL Server, fake Firebase.</summary>
[Collection(SqlServerCollection.Name)]
public class AdminApiTests(SqlServerFixture sql)
{
    [Fact]
    public async Task Purchaser_can_read_the_catalog_but_not_change_it_or_see_users()
    {
        await using var api = await TestApi.StartAsync(sql);
        var purchaser = api.ClientFor(await api.AddUserAsync(UserRole.Purchaser));

        var products = await purchaser.GetFromJsonAsync<List<ProductResponse>>("/api/products");
        Assert.Contains(products!, p => p.Name == "Hot-Rolled Steel Coil" && p.DefaultBuyPricePerLb == 0.42m);
        Assert.Equal(HttpStatusCode.OK, (await purchaser.GetAsync("/api/locations")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await purchaser.GetAsync("/api/vendors")).StatusCode);

        var newProduct = new SaveProductRequest("Copper Wire", false, 3.10m, null);
        Assert.Equal(HttpStatusCode.Forbidden, (await purchaser.PostAsJsonAsync("/api/products", newProduct)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await purchaser.PutAsJsonAsync($"/api/locations/{LocationIds.Bay1}", new SaveLocationRequest("Bay 1", "Bay", false))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await purchaser.PostAsJsonAsync("/api/vendors", new SaveVendorRequest("Acme", "Supplier"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await purchaser.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await purchaser.PostAsJsonAsync("/api/users/invite", new InviteUserRequest("x@example.com", "Admin"))).StatusCode);
    }

    [Fact]
    public async Task Signed_in_but_never_invited_gets_403_everywhere()
    {
        await using var api = await TestApi.StartAsync(sql);
        var stranger = api.ClientFor("some-firebase-uid-not-in-sql");

        Assert.Equal(HttpStatusCode.Forbidden, (await stranger.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await stranger.GetAsync("/api/products")).StatusCode);
    }

    [Fact]
    public async Task Admin_creates_and_edits_a_product_and_prices_are_stored_exactly()
    {
        await using var api = await TestApi.StartAsync(sql);
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));

        var created = await admin.PostAsJsonAsync("/api/products", new SaveProductRequest("  Copper   Wire ", false, 3.125m, null));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var product = (await created.Content.ReadFromJsonAsync<ProductResponse>())!;
        Assert.Equal("Copper Wire", product.Name);

        var updated = await admin.PutAsJsonAsync($"/api/products/{product.Id}",
            new SaveProductRequest("Copper Wire", false, 3.125m, 4.50m, IsActive: false));
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);

        var row = await api.Fresh().Products.SingleAsync(p => p.Id == product.Id);
        Assert.Equal(3.125m, row.DefaultBuyPricePerLb);
        Assert.Equal(4.50m, row.DefaultSellPricePerLb);
        Assert.False(row.IsActive);

        // Inactive products drop out of pick lists, but the admin can still see them.
        Assert.DoesNotContain(await admin.GetFromJsonAsync<List<ProductResponse>>("/api/products") ?? [], p => p.Id == product.Id);
        Assert.Contains(await admin.GetFromJsonAsync<List<ProductResponse>>("/api/products?includeInactive=true") ?? [],
            p => p.Id == product.Id);
    }

    [Fact]
    public async Task Bad_input_returns_field_errors_and_duplicate_names_409()
    {
        await using var api = await TestApi.StartAsync(sql);
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));

        var invalid = await admin.PostAsJsonAsync("/api/products", new SaveProductRequest("", false, 0.4242m, null));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var problem = await invalid.Content.ReadAsStringAsync();
        Assert.Contains("DefaultBuyPricePerLb", problem);

        // SQL Server's collation ignores case, so this clashes with the seeded "Steel Scrap".
        var duplicate = await admin.PostAsJsonAsync("/api/products", new SaveProductRequest("steel scrap", true, null, 0.10m));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var duplicateLocation = await admin.PostAsJsonAsync("/api/locations", new SaveLocationRequest("Bay 2", "Bay"));
        Assert.Equal(HttpStatusCode.Conflict, duplicateLocation.StatusCode);

        Assert.Equal(HttpStatusCode.NotFound,
            (await admin.PutAsJsonAsync("/api/products/9999", new SaveProductRequest("X", false, null, null))).StatusCode);
    }

    [Fact]
    public async Task Invite_creates_a_working_account_with_a_set_password_link()
    {
        await using var api = await TestApi.StartAsync(sql);
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));

        var response = await admin.PostAsJsonAsync("/api/users/invite", new InviteUserRequest(" Pat@Example.com ", "Purchaser"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var invite = (await response.Content.ReadFromJsonAsync<InviteUserResponse>())!;
        Assert.Equal("pat@example.com", invite.User.Email);
        Assert.Equal("Purchaser", invite.User.Role);
        Assert.StartsWith("https://example.test/set-password", invite.SetPasswordLink);

        // Once they've set a password and signed in, the API knows them.
        var pat = api.ClientFor(api.Directory.UidsByEmail["pat@example.com"]);
        var me = await pat.GetFromJsonAsync<MeResponse>("/api/me");
        Assert.Equal("Purchaser", me!.Role);

        var again = await admin.PostAsJsonAsync("/api/users/invite", new InviteUserRequest("pat@example.com", "Admin"));
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);

        var link = await admin.PostAsync($"/api/users/{invite.User.Id}/set-password-link", null);
        Assert.Equal(HttpStatusCode.OK, link.StatusCode);
        Assert.NotEqual(invite.SetPasswordLink, (await link.Content.ReadFromJsonAsync<SetPasswordLinkResponse>())!.SetPasswordLink);
    }

    [Fact]
    public async Task Invite_that_saves_but_cannot_make_a_link_says_how_to_recover()
    {
        await using var api = await TestApi.StartAsync(sql);
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));
        api.Directory.FailLinks = true;

        var response = await admin.PostAsJsonAsync("/api/users/invite", new InviteUserRequest("sam@example.com", "Purchaser"));

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Contains("was added", await response.Content.ReadAsStringAsync());
        var sam = await api.Fresh().Users.SingleAsync(u => u.Email == "sam@example.com");

        api.Directory.FailLinks = false;
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"/api/users/{sam.Id}/set-password-link", null)).StatusCode);
    }

    [Fact]
    public async Task Invite_refuses_a_sign_in_that_already_belongs_to_someone()
    {
        await using var api = await TestApi.StartAsync(sql);
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));
        var existing = await api.AddUserAsync(UserRole.Purchaser);
        // Their Firebase email changed since they were invited; users are matched by UID.
        api.Directory.UidsByEmail["new-address@example.com"] = existing.FirebaseUid;

        var response = await admin.PostAsJsonAsync("/api/users/invite", new InviteUserRequest("new-address@example.com", "Admin"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task No_set_password_link_for_a_turned_off_account()
    {
        await using var api = await TestApi.StartAsync(sql);
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));
        var off = await api.AddUserAsync(UserRole.Purchaser, isActive: false);

        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsync($"/api/users/{off.Id}/set-password-link", null)).StatusCode);
    }

    [Fact]
    public async Task Deactivated_user_gets_403_on_their_next_request_and_reactivation_restores_access()
    {
        await using var api = await TestApi.StartAsync(sql);
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));
        var purchaserUser = await api.AddUserAsync(UserRole.Purchaser);
        var purchaser = api.ClientFor(purchaserUser);
        Assert.Equal(HttpStatusCode.OK, (await purchaser.GetAsync("/api/me")).StatusCode);

        var off = await admin.PutAsJsonAsync($"/api/users/{purchaserUser.Id}", new UpdateUserRequest("Purchaser", IsActive: false));
        Assert.Equal(HttpStatusCode.OK, off.StatusCode);

        // Same token as before: the role lookup in SQL is what turns them away.
        Assert.Equal(HttpStatusCode.Forbidden, (await purchaser.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await purchaser.GetAsync("/api/products")).StatusCode);

        await admin.PutAsJsonAsync($"/api/users/{purchaserUser.Id}", new UpdateUserRequest("Purchaser", IsActive: true));
        Assert.Equal(HttpStatusCode.OK, (await purchaser.GetAsync("/api/me")).StatusCode);
    }

    [Fact]
    public async Task Role_change_applies_on_the_next_request()
    {
        await using var api = await TestApi.StartAsync(sql);
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));
        var user = await api.AddUserAsync(UserRole.Purchaser);
        var client = api.ClientFor(user);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/users")).StatusCode);

        await admin.PutAsJsonAsync($"/api/users/{user.Id}", new UpdateUserRequest("Admin", IsActive: true));

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/users")).StatusCode);
    }

    [Fact]
    public async Task Admin_cannot_lock_themselves_out()
    {
        await using var api = await TestApi.StartAsync(sql);
        var me = await api.AddUserAsync(UserRole.Admin);
        var admin = api.ClientFor(me);

        var demote = await admin.PutAsJsonAsync($"/api/users/{me.Id}", new UpdateUserRequest("Purchaser", IsActive: true));
        var deactivate = await admin.PutAsJsonAsync($"/api/users/{me.Id}", new UpdateUserRequest("Admin", IsActive: false));

        Assert.Equal(HttpStatusCode.BadRequest, demote.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, deactivate.StatusCode);
        var row = await api.Fresh().Users.SingleAsync(u => u.Id == me.Id);
        Assert.Equal((UserRole.Admin, true), (row.Role, row.IsActive));
    }

    [Fact]
    public async Task Purchaser_quick_add_is_safe_to_repeat_and_flags_the_vendor_for_review()
    {
        await using var api = await TestApi.StartAsync(sql);
        var purchaser = api.ClientFor(await api.AddUserAsync(UserRole.Purchaser));
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));

        var first = await purchaser.PostAsJsonAsync("/api/vendors/quick-add", new QuickAddVendorRequest("Ohio Coil Co", "Supplier"));
        var second = await purchaser.PostAsJsonAsync("/api/vendors/quick-add", new QuickAddVendorRequest(" ohio  coil co", "Supplier"));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var vendor = (await first.Content.ReadFromJsonAsync<VendorResponse>())!;
        Assert.Equal(vendor.Id, (await second.Content.ReadFromJsonAsync<VendorResponse>())!.Id);
        Assert.True(vendor.AddedByPurchaser);

        // Quick-adding the seeded customer as a supplier makes it Both, so it appears in the supplier pick list.
        var customer = await purchaser.PostAsJsonAsync("/api/vendors/quick-add", new QuickAddVendorRequest("Buckeye Fabrication", "Supplier"));
        Assert.Equal("Both", (await customer.Content.ReadFromJsonAsync<VendorResponse>())!.Kind);
        var suppliers = await purchaser.GetFromJsonAsync<List<VendorResponse>>("/api/vendors?kind=Supplier");
        Assert.Contains(suppliers!, v => v.Name == "Buckeye Fabrication");
        Assert.Equal(HttpStatusCode.BadRequest, (await purchaser.GetAsync("/api/vendors?kind=Both")).StatusCode);

        // An admin save marks it reviewed; turning it off hides it and blocks quick-adding it again.
        var reviewed = await admin.PutAsJsonAsync($"/api/vendors/{vendor.Id}", new SaveVendorRequest(vendor.Name, "Supplier", IsActive: false));
        Assert.False((await reviewed.Content.ReadFromJsonAsync<VendorResponse>())!.AddedByPurchaser);
        Assert.DoesNotContain(await purchaser.GetFromJsonAsync<List<VendorResponse>>("/api/vendors?includeInactive=true") ?? [],
            v => v.Id == vendor.Id);
        var blocked = await purchaser.PostAsJsonAsync("/api/vendors/quick-add", new QuickAddVendorRequest("Ohio Coil Co", "Supplier"));
        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
    }

    [Fact]
    public async Task Locations_report_how_many_items_are_in_stock_there()
    {
        await using var api = await TestApi.StartAsync(sql);
        var admin = api.ClientFor(await api.AddUserAsync(UserRole.Admin));
        var creator = await api.AddUserAsync(UserRole.Purchaser);
        var po = new PurchaseOrder
        {
            VendorId = VendorIds.Supplier, CreatedByUserId = creator.Id,
            Lines = [new() { ProductId = ProductIds.HotRolledSteelCoil, WeightLbs = 40_000m, PricePerLb = 0.42m }],
        };
        api.Db.PurchaseOrders.Add(po);
        await api.Db.SaveChangesAsync();
        api.Db.InventoryItems.Add(new InventoryItem
        {
            ProductId = ProductIds.HotRolledSteelCoil, LocationId = LocationIds.Bay2, WeightLbs = 40_000m,
            TotalCost = 16_800m, SourcePurchaseOrderLineId = po.Lines[0].Id,
        });
        await api.Db.SaveChangesAsync();

        var locations = await admin.GetFromJsonAsync<List<LocationResponse>>("/api/locations");

        Assert.Equal(1, locations!.Single(l => l.Id == LocationIds.Bay2).ItemsInStock);
        Assert.Equal(0, locations!.Single(l => l.Id == LocationIds.Bay1).ItemsInStock);
    }
}
