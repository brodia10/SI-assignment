using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;
using Savage.Api.Features.Purchasing;

namespace Savage.Api.Features.Receiving;

/// <summary>Where one PO line goes and what the scale says it weighs.</summary>
public sealed record ReceiveLine(int PurchaseOrderLineId, int LocationId, decimal WeightLbs);

public sealed record ReceivePurchaseOrderRequest(int PurchaseOrderId, IReadOnlyList<ReceiveLine> Lines);

public sealed record ReceivedItem(
    int InventoryItemId,
    string Tag,
    int PurchaseOrderLineId,
    string ProductName,
    string LocationName,
    decimal WeightLbs,
    decimal OrderedWeightLbs,
    decimal TotalCost);

public sealed record ReceiptResponse(
    int PurchaseOrderId, int PurchaseOrderNumber, DateTimeOffset ReceivedAt, IReadOnlyList<ReceivedItem> Items);

public sealed record LocationOption(
    int Id, string Name, [property: JsonConverter(typeof(JsonStringEnumConverter<LocationKind>))] LocationKind Kind);

/// <summary>Checks a receipt's shape before touching the database.</summary>
public static class ReceivePurchaseOrderValidator
{
    public static Dictionary<string, string[]> Validate(ReceivePurchaseOrderRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.PurchaseOrderId <= 0) errors["purchaseOrderId"] = ["Pick the purchase order."];

        var lines = request.Lines ?? [];
        if (lines.Count == 0) errors["lines"] = ["Every product on the PO needs a location."];

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var at = $"lines[{i}]";
            if (line is null)
            {
                errors[at] = [$"Line {i + 1} is empty. Go back and try again."];
                continue;
            }
            if (line.LocationId <= 0)
                errors[$"{at}.locationId"] = [$"Line {i + 1}: pick where it's stored."];
            if (line.WeightLbs <= 0)
                errors[$"{at}.weightLbs"] = [$"Line {i + 1}: the weight must be more than 0 lbs."];
            else if (line.WeightLbs > CreatePurchaseOrderValidator.MaxWeightLbs)
                errors[$"{at}.weightLbs"] = [$"Line {i + 1}: the weight can't be more than {CreatePurchaseOrderValidator.MaxWeightLbs:N2} lbs."];
            else if (!PurchaseOrderMath.FitsDecimals(line.WeightLbs, PurchaseOrderMath.WeightDecimals))
                errors[$"{at}.weightLbs"] = [$"Line {i + 1}: the weight can have at most 2 decimal places."];
        }

        if (lines.Where(l => l is not null).GroupBy(l => l.PurchaseOrderLineId).Any(g => g.Count() > 1))
            errors["lines"] = ["A product on the PO was listed twice. Go back and try again."];

        return errors;
    }
}

/// <summary>
/// Receives a whole PO: one inventory item per line, each with a floor tag (C-1001, … from a SQL Server
/// sequence), a location, the weight from the scale, and its cost from the PO.
/// <list type="bullet">
///   <item><b>Cost</b> is the PO line total (weight ordered × $/lb), even if the scale weight differs. That's the
///   amount agreed with the supplier; see README "Weight checks".</item>
///   <item><b>Weight</b> is what the scale shows. The PO line keeps the ordered weight, so the difference is
///   recorded without extra columns. A difference is allowed; the screen warns before posting.</item>
///   <item><b>All or nothing:</b> every line is received at once (no partial receipts), in one transaction.
///   The PO must still be Open, and its RowVersion stops two racing receives from both posting.</item>
///   <item><b>A lost commit acknowledgement</b> (the connection drops after SQL Server committed) makes the retry
///   see a Received PO and answer 409 "already received". The data is right; the purchaser sees the PO as
///   received when they look it up. Rare enough not to need a "did my own commit land?" check yet.</item>
/// </list>
/// </summary>
public static class ReceivePurchaseOrderHandler
{
    public static async Task<Outcome<ReceiptResponse>> HandleAsync(
        AppDbContext db, int userId, ReceivePurchaseOrderRequest request, CancellationToken ct = default)
    {
        var errors = ReceivePurchaseOrderValidator.Validate(request);
        if (errors.Count > 0) return Failure.Invalid(errors);

        try
        {
            // The context retries transient SQL errors, so a user transaction has to run inside its strategy.
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(() => PostAsync(db, userId, request, ct));
        }
        catch (DbUpdateConcurrencyException)
        {
            // The PO changed between reading it and marking it received. Say what it changed to.
            db.ChangeTracker.Clear();
            var now = await db.PurchaseOrders.AsNoTracking().Where(p => p.Id == request.PurchaseOrderId)
                .Select(p => new { p.Number, p.Status }).SingleOrDefaultAsync(ct);
            return now switch
            {
                null => Failure.NotFound("That purchase order was removed. Nothing was changed."),
                { Status: PurchaseOrderStatus.Received } =>
                    Failure.Conflict($"PO #{now.Number} was just received by someone else. Nothing was changed."),
                { Status: PurchaseOrderStatus.Voided } =>
                    Failure.Conflict($"PO #{now.Number} was just voided, so it wasn't received."),
                _ => Failure.Conflict($"PO #{now.Number} was just changed. Reload it and try again."),
            };
        }
    }

    private static async Task<Outcome<ReceiptResponse>> PostAsync(
        AppDbContext db, int userId, ReceivePurchaseOrderRequest request, CancellationToken ct)
    {
        // A retry starts over, so drop anything a failed attempt left tracked.
        db.ChangeTracker.Clear();
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var po = await db.PurchaseOrders
            .Include(p => p.Lines).ThenInclude(l => l.Product)
            .SingleOrDefaultAsync(p => p.Id == request.PurchaseOrderId, ct);
        if (po is null) return Failure.NotFound("That purchase order doesn't exist.");

        switch (po.Status)
        {
            case PurchaseOrderStatus.Received:
                return Failure.Conflict($"PO #{po.Number} was already received. Nothing was changed.");
            case PurchaseOrderStatus.Voided:
                return Failure.Conflict($"PO #{po.Number} was voided, so it can't be received.");
        }

        var requested = request.Lines.ToDictionary(l => l.PurchaseOrderLineId);
        if (!requested.Keys.Order().SequenceEqual(po.Lines.Select(l => l.Id).Order()))
            // Only an out-of-date screen sends a different set of lines, so this is a conflict, not bad input.
            return Failure.Conflict(
                $"Every product on PO #{po.Number} has to be received together. Reload the PO and try again.");

        var locationIds = request.Lines.Select(l => l.LocationId).Distinct().ToList();
        var locations = await db.Locations.AsNoTracking()
            .Where(l => locationIds.Contains(l.Id) && l.IsActive)
            .ToDictionaryAsync(l => l.Id, ct);
        if (locations.Count != locationIds.Count)
            return Failure.Invalid("lines", "One of those locations isn't available any more. Pick another one.");

        // Mark the PO received first. Its RowVersion check (and the row lock the UPDATE takes) stops a racing
        // receive here, before it draws any tag numbers, so a double tap can't leave a gap in the tags.
        var receivedAt = DateTimeOffset.UtcNow;
        po.Status = PurchaseOrderStatus.Received;
        po.ReceivedByUserId = userId;
        po.ReceivedAt = receivedAt;
        await db.SaveChangesAsync(ct);

        var items = po.Lines.OrderBy(l => l.Id).Select(line => new InventoryItem
        {
            ProductId = line.ProductId,
            LocationId = requested[line.Id].LocationId,
            WeightLbs = requested[line.Id].WeightLbs,
            TotalCost = PurchaseOrderMath.LineTotal(line.WeightLbs, line.PricePerLb),
            SourcePurchaseOrderLine = line,
        }).ToList();

        // Insert one at a time so tags follow the PO's line order (line 1 → C-1001). A batched insert of 4+ rows
        // becomes a MERGE, where SQL Server doesn't promise which row draws which sequence number.
        foreach (var item in items)
        {
            db.InventoryItems.Add(item);
            await db.SaveChangesAsync(ct);
        }

        await tx.CommitAsync(ct);

        return new ReceiptResponse(po.Id, po.Number, receivedAt, items.Select(i => new ReceivedItem(
            i.Id, i.Tag, i.SourcePurchaseOrderLine!.Id, i.SourcePurchaseOrderLine.Product.Name,
            locations[i.LocationId].Name, i.WeightLbs, i.SourcePurchaseOrderLine.WeightLbs, i.TotalCost)).ToList());
    }
}
