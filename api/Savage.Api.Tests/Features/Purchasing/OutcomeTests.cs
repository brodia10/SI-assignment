using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Savage.Api.Features.Purchasing;

namespace Savage.Api.Tests.Features.Purchasing;

/// <summary>How a handler's result becomes an HTTP response. The screens show <c>detail</c>, so it must always be set.</summary>
public class OutcomeTests
{
    [Fact]
    public void Success_is_200_with_the_value()
    {
        Outcome<string> outcome = "PO #2201";

        var ok = Assert.IsType<Ok<string>>(outcome.ToHttpResult());
        Assert.Equal("PO #2201", ok.Value);
    }

    [Fact]
    public void Invalid_is_400_with_field_errors_and_the_first_message_as_detail()
    {
        Outcome<string> outcome = Failure.Invalid(new Dictionary<string, string[]>
        {
            ["vendorId"] = ["Pick the supplier."],
            ["lines"] = ["Add at least one product."],
        });

        var problem = Assert.IsType<ProblemHttpResult>(outcome.ToHttpResult());
        Assert.Equal(StatusCodes.Status400BadRequest, problem.StatusCode);
        Assert.Equal("Pick the supplier.", problem.ProblemDetails.Detail);
        var validation = Assert.IsType<HttpValidationProblemDetails>(problem.ProblemDetails);
        Assert.Equal(["Add at least one product."], validation.Errors["lines"]);
    }

    [Theory]
    [InlineData(FailureKind.NotFound, StatusCodes.Status404NotFound)]
    [InlineData(FailureKind.Conflict, StatusCodes.Status409Conflict)]
    public void Not_found_and_conflict_carry_the_message_as_detail(FailureKind kind, int status)
    {
        Outcome<string> outcome = new Failure(kind, "PO #2201 was already received. Nothing was changed.");

        var problem = Assert.IsType<ProblemHttpResult>(outcome.ToHttpResult());
        Assert.Equal(status, problem.StatusCode);
        Assert.Equal("PO #2201 was already received. Nothing was changed.", problem.ProblemDetails.Detail);
    }

    [Fact]
    public void Invalid_with_no_errors_still_has_a_message()
    {
        Assert.Equal("Check the details and try again.", Failure.Invalid(new Dictionary<string, string[]>()).Message);
    }
}
