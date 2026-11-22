using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Savage.Api.Auth;
using Savage.Api.Data;

namespace Savage.Api.Features.Sales;

public static class SalesEndpoints
{
    public static RouteGroupBuilder MapSalesEndpoints(this RouteGroupBuilder api)
    {
        // Lane D (Sales + Reports): sales orders shipped by container. Posting is one transaction.
        var group = api.MapGroup("/sales-orders")
            .WithTags("Sales");

        group.MapGet("/customers", (AppDbContext db, CancellationToken ct) =>
                SalesOrderService.CustomersAsync(db, ct))
            .WithName("ListSalesCustomers");

        group.MapGet("/available-items", (AppDbContext db, CancellationToken ct) =>
                SalesOrderService.AvailableItemsAsync(db, ct))
            .WithName("ListSellableItems");

        group.MapGet("/", (AppDbContext db, CancellationToken ct) =>
                SalesOrderService.ListAsync(db, ct: ct))
            .WithName("ListSalesOrders");

        group.MapGet("/{id:int}", async Task<Results<Ok<SalesOrderDetail>, NotFound>> (
                int id, AppDbContext db, CancellationToken ct) =>
                await SalesOrderService.GetAsync(db, id, ct) is { } order
                    ? TypedResults.Ok(order)
                    : TypedResults.NotFound())
            .WithName("GetSalesOrder");

        group.MapPost("/", async Task<Results<Created<SalesOrderCreated>, ValidationProblem, ProblemHttpResult>> (
                CreateSalesOrderRequest request, ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
                ToHttpResult(await SalesOrderService.PostAsync(db, user.AppUserId(), request, ct)))
            .WithName("PostSalesOrder");

        return api;
    }

    /// <summary>Posted → 201, a bad request → 400 with field errors, an item that can't be sold → 409.</summary>
    public static Results<Created<SalesOrderCreated>, ValidationProblem, ProblemHttpResult> ToHttpResult(
        PostSalesOrderResult result) => result switch
    {
        PostSalesOrderResult.Posted p => TypedResults.Created($"/api/sales-orders/{p.Order.Id}", p.Order),
        PostSalesOrderResult.Invalid i => TypedResults.ValidationProblem(i.Errors.ToDictionary()),
        PostSalesOrderResult.Conflict c => TypedResults.Problem(
            c.Message, statusCode: StatusCodes.Status409Conflict, title: "Can't ship these items"),
        _ => throw new InvalidOperationException($"Unhandled result {result}"),
    };
}
