namespace Savage.Api.Domain;

/// <summary>One output of a work order, as the allocator sees it.</summary>
public readonly record struct AllocationOutput(decimal WeightLbs, bool IsScrap);

/// <summary>
/// Splits a work order's input cost across its outputs.
/// <list type="bullet">
///   <item>Scrap outputs get $0.</item>
///   <item>Non-scrap outputs share the input's <c>TotalCost</c> in proportion to their weight.</item>
///   <item>Each share is rounded <b>down</b> to the cent; the leftover goes to the last non-scrap
///   output, so the outputs always add up to the input cost exactly.</item>
/// </list>
/// Rounding down (rather than to nearest) guarantees the leftover is never negative, so no output
/// can end up with a negative cost when there are many outputs and a tiny last one. The trade-off:
/// the last output can pick up as much as (n − 1)¢ more than its exact share, which is immaterial
/// at real amounts.
/// <para>The input cost must be whole cents: <c>TotalCost</c> is stored as <c>decimal(18,2)</c>, so a
/// sub-cent output would be silently rounded on save and the outputs would no longer add up.</para>
/// </summary>
public static class CostAllocator
{
    /// <returns>One cost per output, in the same order as <paramref name="outputs"/>.</returns>
    /// <exception cref="ArgumentException">
    /// No outputs, a negative input cost, an input cost with fractions of a cent, a weight that
    /// isn't positive, or no non-scrap output (the input cost would have nowhere to go).
    /// </exception>
    public static IReadOnlyList<decimal> Allocate(decimal inputTotalCost, IReadOnlyList<AllocationOutput> outputs)
    {
        ArgumentNullException.ThrowIfNull(outputs);
        if (outputs.Count == 0)
            throw new ArgumentException("A work order needs at least one output.", nameof(outputs));
        if (inputTotalCost < 0)
            throw new ArgumentException("Input cost can't be negative.", nameof(inputTotalCost));
        if (inputTotalCost != Math.Round(inputTotalCost, 2))
            throw new ArgumentException("Input cost must be a whole number of cents.", nameof(inputTotalCost));
        if (outputs.Any(o => o.WeightLbs <= 0))
            throw new ArgumentException("Every output must weigh more than 0 lbs.", nameof(outputs));

        var lastNonScrap = -1;
        var nonScrapWeight = 0m;
        for (var i = 0; i < outputs.Count; i++)
        {
            if (outputs[i].IsScrap) continue;
            lastNonScrap = i;
            nonScrapWeight += outputs[i].WeightLbs;
        }
        if (lastNonScrap < 0)
            throw new ArgumentException(
                "At least one output must be non-scrap to carry the input cost.", nameof(outputs));

        var costs = new decimal[outputs.Count];
        Array.Fill(costs, 0.00m); // scrap stays $0.00 (2 dp, like every other cost)
        var allocated = 0m;
        for (var i = 0; i < lastNonScrap; i++)
        {
            if (outputs[i].IsScrap) continue;
            // Multiply before dividing to keep decimal precision.
            var share = RoundDownToCent(inputTotalCost * outputs[i].WeightLbs / nonScrapWeight);
            costs[i] = share;
            allocated += share;
        }
        costs[lastNonScrap] = inputTotalCost - allocated;
        return costs;
    }

    private static decimal RoundDownToCent(decimal amount) =>
        Math.Round(amount, 2, MidpointRounding.ToZero);
}
