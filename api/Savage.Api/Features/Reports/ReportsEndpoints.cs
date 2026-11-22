using Savage.Api.Auth;

namespace Savage.Api.Features.Reports;

public static class ReportsEndpoints
{
    public static RouteGroupBuilder MapReportsEndpoints(this RouteGroupBuilder api)
    {
        // Lane D (Sales + Reports): inventory by product and location, profit and margin per SO, item lineage. The whole group is admin-only.
        var group = api.MapGroup("/reports")
            .WithTags("Reports")
            .RequireAuthorization(Policies.Admin);

        return api;
    }
}
