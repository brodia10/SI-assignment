namespace Savage.Api.Features.Vendors;

public static class VendorsEndpoints
{
    public static RouteGroupBuilder MapVendorsEndpoints(this RouteGroupBuilder api)
    {
        // Lane A (Admin): suppliers and customers. Purchasers can read and quick-add by name; edits and the full list are admin-only.
        var group = api.MapGroup("/vendors")
            .WithTags("Vendors");

        return api;
    }
}
