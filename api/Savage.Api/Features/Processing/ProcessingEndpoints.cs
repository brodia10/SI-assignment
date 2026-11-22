namespace Savage.Api.Features.Processing;

public static class ProcessingEndpoints
{
    public static RouteGroupBuilder MapProcessingEndpoints(this RouteGroupBuilder api)
    {
        // Lane C (Processing): work orders (one item in, many out; cost carried over by CostAllocator). Posting is one transaction.
        var group = api.MapGroup("/work-orders")
            .WithTags("Processing");

        return api;
    }
}
