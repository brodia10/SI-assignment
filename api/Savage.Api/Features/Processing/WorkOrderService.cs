using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Features.Processing;

public enum WorkOrderFailureKind
{
    /// <summary>The input item doesn't exist.</summary>
    NotFound,
    /// <summary>The input item isn't in stock any more (processed, sold or voided), e.g. a double tap.</summary>
    Conflict,
    /// <summary>The request breaks a rule; <see cref="WorkOrderFailure.Errors"/> says which.</summary>
    Invalid,
}

public sealed record WorkOrderFailure(WorkOrderFailureKind Kind, string Message, IReadOnlyList<string> Errors);

/// <summary>Either a value or a failure the endpoint turns into a 4xx.</summary>
public sealed record WorkOrderResult<T>(T? Value, WorkOrderFailure? Failure) where T : class
{
    public static implicit operator WorkOrderResult<T>(T value) => new(value, null);
    public static implicit operator WorkOrderResult<T>(WorkOrderFailure failure) => new(null, failure);
}

/// <summary>
/// Loads what a work order needs, runs <see cref="WorkOrderPlanner"/>, and posts it.
/// <para>Posting is a single <c>SaveChanges</c>, so EF wraps it in one database transaction: consume the input,
/// insert the work order, insert the outputs. Either all of it lands or none of it does.</para>
/// <para>Double tap: both requests may load the input while it is still InStock. The first save wins; the second
/// fails on the input's stale <c>RowVersion</c> (or on the one-completed-work-order-per-input unique index, if
/// its insert runs first) and rolls back. Either way the purchaser sees "already processed".</para>
/// </summary>
public static class WorkOrderService
{
    public static async Task<WorkOrderOptionsResponse> GetOptionsAsync(AppDbContext db, CancellationToken ct)
    {
        var inputs = await db.InventoryItems.AsNoTracking()
            .Where(i => i.Status == InventoryItemStatus.InStock)
            .OrderBy(i => i.Id) // oldest first; Tag order would put C-10000 before C-9999
            .Select(i => new WorkOrderInputOption(
                i.Id, i.Tag, i.ProductId, i.Product.Name, i.WeightLbs, i.TotalCost, i.Location.Name))
            .ToListAsync(ct);
        var products = await db.Products.AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.Name)
            .Select(p => new WorkOrderProductOption(p.Id, p.Name, p.IsScrap))
            .ToListAsync(ct);
        var locations = await db.Locations.AsNoTracking()
            .Where(l => l.IsActive)
            .OrderBy(l => l.Name)
            .Select(l => new WorkOrderLocationOption(l.Id, l.Name, l.Kind.ToString()))
            .ToListAsync(ct);
        return new WorkOrderOptionsResponse(inputs, products, locations);
    }

    /// <summary>
    /// What posting would do, without saving. Rule breaks (too heavy, no outputs…) come back inside the preview
    /// so the screen can show them; only a missing or already-used input, or an unknown product/location, fails.
    /// </summary>
    public static async Task<WorkOrderResult<WorkOrderPreviewResponse>> PreviewAsync(
        AppDbContext db, CreateWorkOrderRequest request, CancellationToken ct)
    {
        var loaded = await LoadAsync(db, request, track: false, ct);
        if (loaded.Failure is not null) return loaded.Failure;
        var (input, outputs, plan) = loaded.Value!;

        var previewOutputs = outputs
            .Select((o, i) => new WorkOrderPreviewOutput(
                o.Product.Id, o.Product.Name, o.Product.IsScrap, o.WeightLbs, o.Location.Id, o.Location.Name,
                plan.Costs?[i]))
            .ToList();
        return new WorkOrderPreviewResponse(
            input.Tag, input.WeightLbs, input.TotalCost, plan.OutputWeightLbs, plan.RemainingLbs,
            previewOutputs, plan.Errors, plan.Warnings, plan.CanPost);
    }

    public static async Task<WorkOrderResult<PostedWorkOrderResponse>> PostAsync(
        AppDbContext db, CreateWorkOrderRequest request, int userId, CancellationToken ct)
    {
        var loaded = await LoadAsync(db, request, track: true, ct);
        if (loaded.Failure is not null) return loaded.Failure;
        var (input, outputs, plan) = loaded.Value!;

        if (!plan.CanPost)
            return new WorkOrderFailure(WorkOrderFailureKind.Invalid, "This work order can't be posted yet.", plan.Errors);

        var workOrder = new WorkOrder { InputItem = input, CreatedByUserId = userId };
        var items = outputs
            .Select((o, i) => new InventoryItem
            {
                ProductId = o.Product.Id,
                LocationId = o.Location.Id,
                WeightLbs = o.WeightLbs,
                TotalCost = plan.Costs![i],
                SourceWorkOrder = workOrder,
            })
            .ToList();
        workOrder.Outputs.AddRange(items);
        input.Status = InventoryItemStatus.Consumed;
        db.WorkOrders.Add(workOrder);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (ex is DbUpdateConcurrencyException || IsOneWorkOrderPerInputViolation(ex))
        {
            // The save rolled back. Say what actually happened to the item (processed, or sold meanwhile).
            var status = await db.InventoryItems.AsNoTracking()
                .Where(i => i.Id == input.Id).Select(i => i.Status).FirstAsync(ct);
            return AlreadyUsed(input.Tag, status);
        }

        var posted = items
            .Select((item, i) => new PostedWorkOrderOutput(
                item.Id, item.Tag, outputs[i].Product.Name, outputs[i].Product.IsScrap, item.WeightLbs,
                outputs[i].Location.Name, item.TotalCost))
            .ToList();
        return new PostedWorkOrderResponse(workOrder.Id, workOrder.Number, input.Tag, posted, plan.Warnings);
    }

    private sealed record ResolvedOutput(Product Product, Location Location, decimal WeightLbs);

    private sealed record Loaded(InventoryItem Input, IReadOnlyList<ResolvedOutput> Outputs, WorkOrderPlan Plan);

    private static async Task<WorkOrderResult<Loaded>> LoadAsync(
        AppDbContext db, CreateWorkOrderRequest request, bool track, CancellationToken ct)
    {
        var requested = request.Outputs ?? [];
        if (requested.Any(o => o is null))
            return new WorkOrderFailure(WorkOrderFailureKind.Invalid, "An output is missing its details.", []);
        var items = track ? db.InventoryItems : db.InventoryItems.AsNoTracking();
        var input = await items.FirstOrDefaultAsync(i => i.Id == request.InputItemId, ct);
        if (input is null)
            return new WorkOrderFailure(WorkOrderFailureKind.NotFound, "That item isn't in inventory.", []);
        if (input.Status != InventoryItemStatus.InStock)
            return AlreadyUsed(input.Tag, input.Status);

        var productIds = requested.Select(o => o.ProductId).Distinct().ToList();
        var locationIds = requested.Select(o => o.LocationId).Distinct().ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => p.IsActive && productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);
        var locations = await db.Locations.AsNoTracking()
            .Where(l => l.IsActive && locationIds.Contains(l.Id))
            .ToDictionaryAsync(l => l.Id, ct);

        var errors = new List<string>();
        if (productIds.Any(id => !products.ContainsKey(id)))
            errors.Add("One of the products isn't available any more. Pick it again.");
        if (locationIds.Any(id => !locations.ContainsKey(id)))
            errors.Add("One of the locations isn't available any more. Pick it again.");
        if (errors.Count > 0)
            return new WorkOrderFailure(WorkOrderFailureKind.Invalid, "Some choices need another look.", errors);

        var outputs = requested
            .Select(o => new ResolvedOutput(products[o.ProductId], locations[o.LocationId], o.WeightLbs))
            .ToList();
        var plan = WorkOrderPlanner.Plan(
            input.Tag, input.WeightLbs, input.TotalCost,
            outputs.Select(o => new AllocationOutput(o.WeightLbs, o.Product.IsScrap)).ToList());
        return new Loaded(input, outputs, plan);
    }

    private static WorkOrderFailure AlreadyUsed(string tag, InventoryItemStatus status)
    {
        var what = status switch
        {
            InventoryItemStatus.Sold => "sold",
            InventoryItemStatus.Voided => "voided",
            _ => "processed",
        };
        return new WorkOrderFailure(
            WorkOrderFailureKind.Conflict, $"{tag} was already {what}, so it can't be processed. Pick another item.", []);
    }

    // 2601/2627: SQL Server duplicate key. Only the one-completed-work-order-per-input index means "already used";
    // any other duplicate (a tag or number) is a real bug and should surface as a 500, not be explained away.
    private const string OneWorkOrderPerInputIndex = "IX_WorkOrders_InputItemId";

    private static bool IsOneWorkOrderPerInputViolation(Exception ex) =>
        ex is DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 } sql }
        && sql.Message.Contains(OneWorkOrderPerInputIndex, StringComparison.Ordinal);
}
