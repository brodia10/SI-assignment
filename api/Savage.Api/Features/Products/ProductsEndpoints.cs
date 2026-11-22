namespace Savage.Api.Features.Products;

public static class ProductsEndpoints
{
    public static RouteGroupBuilder MapProductsEndpoints(this RouteGroupBuilder api)
    {
        // Lane A (Admin): the product catalog with buy/sell $/lb. Any app user can read (purchasers pick from it); add .RequireAuthorization(Policies.Admin) to writes.
        var group = api.MapGroup("/products")
            .WithTags("Products");

        return api;
    }
}
