using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Savage.Api.Features.Sales;

namespace Savage.Api.Tests.Features.Sales;

public class SalesEndpointsTests
{
    [Fact]
    public void Posted_order_is_201_with_its_location()
    {
        var result = SalesEndpoints.ToHttpResult(new PostSalesOrderResult.Posted(new SalesOrderCreated(7, 5001))).Result;

        var created = Assert.IsType<Created<SalesOrderCreated>>(result);
        Assert.Equal("/api/sales-orders/7", created.Location);
        Assert.Equal(5001, created.Value!.Number);
    }

    [Fact]
    public void Invalid_request_is_400_with_field_errors()
    {
        var errors = new Dictionary<string, string[]> { ["CustomerVendorId"] = ["Pick a customer."] };

        var result = SalesEndpoints.ToHttpResult(new PostSalesOrderResult.Invalid(errors)).Result;

        var problem = Assert.IsType<ValidationProblem>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, problem.StatusCode);
        Assert.Equal(["Pick a customer."], problem.ProblemDetails.Errors["CustomerVendorId"]);
    }

    [Fact]
    public void Item_that_cant_be_sold_is_409_with_the_reason()
    {
        var result = SalesEndpoints.ToHttpResult(new PostSalesOrderResult.Conflict("C-1003 was already sold.")).Result;

        var problem = Assert.IsType<ProblemHttpResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, problem.StatusCode);
        Assert.Equal("C-1003 was already sold.", problem.ProblemDetails.Detail);
    }
}
