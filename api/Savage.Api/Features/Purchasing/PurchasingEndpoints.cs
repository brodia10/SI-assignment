using System.Security.Claims;
using Savage.Api.Auth;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Features.Purchasing;

public static class PurchasingEndpoints
{
    public static RouteGroupBuilder MapPurchasingEndpoints(this RouteGroupBuilder api)
    {
        // Lane B (Purchasing + Receiving): create purchase orders. Any app user (purchaser or admin) can use these.
        var group = api.MapGroup("/purchase-orders")
            .WithTags("Purchasing");

        // The pick lists for the New PO screen. Purchasing-specific on purpose: only active suppliers, and products
        // with their default buy price. Adding a supplier in the field uses the Vendors feature's
        // POST /api/vendors/quick-add, so there's one rule for new vendors.
        group.MapGet("/form-options", (AppDbContext db, CancellationToken ct) =>
                PurchaseOrderQueries.FormOptionsAsync(db, ct))
            .WithName("GetPurchaseOrderFormOptions");

        group.MapGet("/", (PurchaseOrderStatus? status, AppDbContext db, CancellationToken ct) =>
                PurchaseOrderQueries.ListAsync(db, status, ct))
            .WithName("ListPurchaseOrders");

        // Receiving's "Recently received" section: a way back to a receipt's tags and locations after the fact.
        group.MapGet("/recently-received", (AppDbContext db, CancellationToken ct) =>
                PurchaseOrderQueries.RecentlyReceivedAsync(db, ct: ct))
            .WithName("ListRecentlyReceivedPurchaseOrders");

        group.MapGet("/{id:int}", async (int id, AppDbContext db, CancellationToken ct) =>
                await PurchaseOrderQueries.GetAsync(db, id, ct) is { } po
                    ? Results.Ok(po)
                    : Results.Problem(detail: "That purchase order doesn't exist.", statusCode: StatusCodes.Status404NotFound))
            .WithName("GetPurchaseOrder")
            .Produces<PurchaseOrderResponse>()
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/", async (
                CreatePurchaseOrderRequest request, ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
                (await CreatePurchaseOrderHandler.HandleAsync(db, user.AppUserId(), request, ct)).ToHttpResult())
            .WithName("CreatePurchaseOrder")
            .Produces<PurchaseOrderResponse>()
            .ProducesValidationProblem();

        return api;
    }
}
