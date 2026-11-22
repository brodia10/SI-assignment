using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Savage.Api.Auth;
using Savage.Api.Data;

namespace Savage.Api.Features.Processing;

public static class ProcessingEndpoints
{
    public static RouteGroupBuilder MapProcessingEndpoints(this RouteGroupBuilder api)
    {
        // Lane C (Processing): work orders (one item in, many out; cost carried over by CostAllocator). Posting is one transaction.
        var group = api.MapGroup("/work-orders")
            .WithTags("Processing");

        // Everything the work order screen picks from: in-stock items, active products and locations.
        group.MapGet("/options", (AppDbContext db, CancellationToken ct) => WorkOrderService.GetOptionsAsync(db, ct))
            .WithName("GetWorkOrderOptions");

        group.MapPost("/preview", async Task<Results<Ok<WorkOrderPreviewResponse>, ProblemHttpResult>> (
                CreateWorkOrderRequest request, AppDbContext db, CancellationToken ct) =>
            {
                var result = await WorkOrderService.PreviewAsync(db, request, ct);
                return result.Failure is { } f ? ToProblem(f) : TypedResults.Ok(result.Value);
            })
            .WithName("PreviewWorkOrder")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/", async Task<Results<Created<PostedWorkOrderResponse>, ProblemHttpResult>> (
                CreateWorkOrderRequest request, ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
            {
                var result = await WorkOrderService.PostAsync(db, request, user.AppUserId(), ct);
                return result.Failure is { } f
                    ? ToProblem(f)
                    : TypedResults.Created((string?)null, result.Value); // no GET-by-id route (yet)
            })
            .WithName("PostWorkOrder")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return api;
    }

    /// <summary>The message goes in <c>detail</c> (shown to the purchaser); rule breaks in <c>errors</c>.</summary>
    private static ProblemHttpResult ToProblem(WorkOrderFailure failure) => TypedResults.Problem(
        statusCode: failure.Kind switch
        {
            WorkOrderFailureKind.NotFound => StatusCodes.Status404NotFound,
            WorkOrderFailureKind.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest,
        },
        detail: failure.Message,
        extensions: failure.Errors.Count > 0 ? new Dictionary<string, object?> { ["errors"] = failure.Errors } : null);
}
