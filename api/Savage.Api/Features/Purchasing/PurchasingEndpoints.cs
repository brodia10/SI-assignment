namespace Savage.Api.Features.Purchasing;

public static class PurchasingEndpoints
{
    public static RouteGroupBuilder MapPurchasingEndpoints(this RouteGroupBuilder api)
    {
        // Lane B (Purchasing + Receiving): create and edit purchase orders until they're received.
        var group = api.MapGroup("/purchase-orders")
            .WithTags("Purchasing");

        return api;
    }
}
