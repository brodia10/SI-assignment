namespace Savage.Api.Features.Receiving;

public static class ReceivingEndpoints
{
    public static RouteGroupBuilder MapReceivingEndpoints(this RouteGroupBuilder api)
    {
        // Lane B (Purchasing + Receiving): receive a PO into inventory (one item per line, tag, location). Posting is one transaction.
        var group = api.MapGroup("/receipts")
            .WithTags("Receiving");

        return api;
    }
}
