using Microsoft.AspNetCore.Http.HttpResults;
using Savage.Api.Auth;
using Savage.Api.Data;

namespace Savage.Api.Features.Reports;

public static class ReportsEndpoints
{
    public static RouteGroupBuilder MapReportsEndpoints(this RouteGroupBuilder api)
    {
        // Lane D (Sales + Reports): inventory by product and location, profit and margin per SO, item lineage. The whole group is admin-only.
        var group = api.MapGroup("/reports")
            .WithTags("Reports")
            .RequireAuthorization(Policies.Admin);

        group.MapGet("/inventory", (AppDbContext db, CancellationToken ct) =>
                ReportQueries.InventoryAsync(db, ct))
            .WithName("GetInventoryReport");

        group.MapGet("/sales-orders", (AppDbContext db, CancellationToken ct) =>
                ReportQueries.SalesAsync(db, ct))
            .WithName("GetSalesReport");

        group.MapGet("/items", (AppDbContext db, CancellationToken ct) =>
                ReportQueries.TraceableItemsAsync(db, ct))
            .WithName("ListTraceableItems");

        group.MapGet("/items/{id:int}/lineage", async Task<Results<Ok<ItemLineage>, NotFound>> (
                int id, AppDbContext db, CancellationToken ct) =>
                await ReportQueries.LineageAsync(db, id, ct) is { } lineage
                    ? TypedResults.Ok(lineage)
                    : TypedResults.NotFound())
            .WithName("GetItemLineage");

        return api;
    }
}
