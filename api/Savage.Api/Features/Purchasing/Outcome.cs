using System.Diagnostics;

namespace Savage.Api.Features.Purchasing;

public enum FailureKind
{
    /// <summary>The request itself is wrong (400). <see cref="Failure.Errors"/> says which fields.</summary>
    Invalid,
    NotFound,
    /// <summary>The request was fine but the record's state doesn't allow it, e.g. a PO already received (409).</summary>
    Conflict,
}

/// <summary>Why a purchasing or receiving command didn't happen, in words the purchaser can act on.</summary>
public sealed record Failure(FailureKind Kind, string Message, IDictionary<string, string[]>? Errors = null)
{
    public static Failure Invalid(IDictionary<string, string[]> errors) =>
        new(FailureKind.Invalid, errors.Values.SelectMany(e => e).FirstOrDefault() ?? "Check the details and try again.",
            errors);

    public static Failure Invalid(string field, string message) =>
        Invalid(new Dictionary<string, string[]> { [field] = [message] });

    public static Failure NotFound(string message) => new(FailureKind.NotFound, message);
    public static Failure Conflict(string message) => new(FailureKind.Conflict, message);

    /// <summary>RFC 7807 problem details. <c>detail</c> always carries <see cref="Message"/> for the screen to show.</summary>
    public IResult ToHttpResult() => Kind switch
    {
        FailureKind.Invalid => Results.ValidationProblem(Errors!, detail: Message),
        FailureKind.NotFound => Results.Problem(detail: Message, statusCode: StatusCodes.Status404NotFound),
        FailureKind.Conflict => Results.Problem(detail: Message, statusCode: StatusCodes.Status409Conflict),
        _ => throw new UnreachableException($"No HTTP status for {Kind}."),
    };
}

/// <summary>
/// The result of a command handler: a value or a <see cref="Failure"/>. Keeps the handlers free of HTTP types,
/// so the tests can call them directly against SQL Server.
/// </summary>
public readonly record struct Outcome<T>(T? Value, Failure? Failure)
{
    public bool Succeeded => Failure is null;

    public static implicit operator Outcome<T>(T value) => new(value, null);
    public static implicit operator Outcome<T>(Failure failure) => new(default, failure);

    public IResult ToHttpResult() => Failure?.ToHttpResult() ?? Results.Ok(Value);
}
