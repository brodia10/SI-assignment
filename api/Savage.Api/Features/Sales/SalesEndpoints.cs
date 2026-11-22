namespace Savage.Api.Features.Sales;

public static class SalesEndpoints
{
    public static RouteGroupBuilder MapSalesEndpoints(this RouteGroupBuilder api)
    {
        // Lane D (Sales + Reports): sales orders shipped by container. Posting is one transaction.
        var group = api.MapGroup("/sales-orders")
            .WithTags("Sales");

        return api;
    }
}
