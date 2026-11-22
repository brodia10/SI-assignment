using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Auth;
using Savage.Api.Data;

namespace Savage.Api.Features.Receiving;

public static class ReceivingEndpoints
{
    public static RouteGroupBuilder MapReceivingEndpoints(this RouteGroupBuilder api)
    {
        // Lane B (Purchasing + Receiving): receive a PO into inventory (one item per line, tag, location). Posting is one transaction.
        var group = api.MapGroup("/receipts")
            .WithTags("Receiving");

        // Where received material can go. Admin manages the list (Lane A); receiving only picks from it.
        // Bays, then racks, then bins. Sorted after loading: Kind is stored as text, so SQL would put "Bin" second.
        group.MapGet("/locations", async (AppDbContext db, CancellationToken ct) =>
                (await db.Locations.AsNoTracking().Where(l => l.IsActive).ToListAsync(ct))
                    .OrderBy(l => l.Kind).ThenBy(l => l.Name)
                    .Select(l => new LocationOption(l.Id, l.Name, l.Kind))
                    .ToList())
            .WithName("GetReceivingLocations");

        group.MapPost("/", async (
                ReceivePurchaseOrderRequest request, ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
                (await ReceivePurchaseOrderHandler.HandleAsync(db, user.AppUserId(), request, ct)).ToHttpResult())
            .WithName("ReceivePurchaseOrder")
            .Produces<ReceiptResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return api;
    }
}
