using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Savage.Api.Features.Products;

/// <summary>
/// Checks shared by the admin's master data (products, locations, vendors). Pure functions, unit-tested.
/// Each returns an error message in plain English, or null when the value is fine.
/// </summary>
public static partial class CatalogRules
{
    /// <summary>
    /// $/lb prices have at most 3 decimals ($0.424/lb), the same as the admin's price pad and every $/lb on screen,
    /// so a price can never differ from what the admin saw. (The columns are decimal(18,4), so nothing is rounded.)
    /// </summary>
    public const int MaxPriceDecimals = 3;

    /// <summary>Upper bound so a slip on the number pad ($4,200/lb) can't become a default price.</summary>
    public const decimal MaxPricePerLb = 1_000m;

    /// <summary>Trims and collapses inner whitespace, so "Bay  2 " and "Bay 2" are the same name.</summary>
    public static string NormalizeName(string? raw) => Whitespace().Replace(raw ?? "", " ").Trim();

    public static string? NameError(string normalizedName, int maxLength) =>
        normalizedName.Length == 0 ? "Enter a name."
        : normalizedName.Length > maxLength ? $"Keep the name to {maxLength} characters or fewer."
        : null;

    public static string? PricePerLbError(decimal? price) =>
        price switch
        {
            null => null,
            < 0 => "A price can't be negative.",
            > MaxPricePerLb => "That's more than $1,000/lb. Check the price.",
            _ when decimal.Round(price.Value, MaxPriceDecimals) != price.Value =>
                $"Use at most {MaxPriceDecimals} decimal places.",
            _ => null,
        };

    /// <summary>
    /// Parses an enum by its exact name ("Bay", "Supplier"). Unlike <c>Enum.TryParse</c>, numbers like "5" and
    /// other casings are rejected, so the API only accepts what the OpenAPI doc describes.
    /// </summary>
    public static bool TryParseExact<TEnum>(string? value, out TEnum result) where TEnum : struct, Enum
    {
        result = default;
        return value is not null && Enum.GetNames<TEnum>().Contains(value) && Enum.TryParse(value, out result);
    }

    /// <summary>True when an insert or update hit a unique index (e.g. two products with the same name).</summary>
    public static bool IsUniqueViolation(DbUpdateException e) =>
        e.InnerException is SqlException { Number: 2601 or 2627 };

    /// <summary>Collects field errors in the shape <c>Results.ValidationProblem</c> expects.</summary>
    public static Dictionary<string, string[]> Errors(params (string Field, string? Error)[] checks) =>
        checks.Where(c => c.Error is not null).ToDictionary(c => c.Field, c => new[] { c.Error! });

    public static IResult DuplicateName(string what, string name) =>
        Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Name already used",
            detail: $"There's already a {what} called “{name}”.");

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
