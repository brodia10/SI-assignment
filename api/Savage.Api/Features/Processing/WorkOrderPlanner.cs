using System.Globalization;
using Savage.Api.Domain;

namespace Savage.Api.Features.Processing;

/// <summary>What a work order would do, before anything is saved. Preview and post both build one.</summary>
/// <param name="Costs">One cost per output, in order. Null when there are errors (nothing to allocate).</param>
/// <param name="RemainingLbs">Input weight minus output weight: positive = lighter, negative = heavier.</param>
/// <param name="Errors">Block posting. Plain English, shown to the purchaser as-is.</param>
/// <param name="Warnings">Shown on the confirmation, but the purchaser can still post.</param>
public sealed record WorkOrderPlan(
    IReadOnlyList<decimal>? Costs,
    decimal OutputWeightLbs,
    decimal RemainingLbs,
    IReadOnlyList<string> Errors,
    IReadOnlyList<string> Warnings)
{
    public bool CanPost => Errors.Count == 0;
}

/// <summary>
/// The work order rules, kept pure so they can be unit-tested:
/// <list type="bullet">
///   <item>Outputs can't weigh more than the input (blocked). Lighter is allowed with a warning: trim, burn-off
///   and scale differences happen, and the outputs still carry the whole input cost.</item>
///   <item>Every output weighs more than 0 lbs, to at most 2 decimals (the column's precision).</item>
///   <item>At least one output isn't scrap, so the input cost has somewhere to go.</item>
///   <item>Cost is split by <see cref="CostAllocator"/>: scrap $0, the rest by weight, cents add up exactly.</item>
/// </list>
/// </summary>
public static class WorkOrderPlanner
{
    /// <summary>A sanity cap. Real work orders have a handful of outputs; this stops a runaway request.</summary>
    public const int MaxOutputs = 50;

    /// <summary>Matches the screen's number pad. Also keeps a malformed request from overflowing the sum.</summary>
    public const decimal MaxOutputWeightLbs = 999_999.99m;

    public static WorkOrderPlan Plan(
        string inputTag, decimal inputWeightLbs, decimal inputTotalCost, IReadOnlyList<AllocationOutput> outputs)
    {
        var errors = new List<string>();
        var warnings = new List<string>();
        // Clamped so an absurd weight can't overflow decimal; it's reported as an error below either way.
        var outputWeight = outputs.Sum(o => Math.Min(o.WeightLbs, MaxOutputWeightLbs));
        var remaining = inputWeightLbs - outputWeight;

        if (outputs.Count == 0)
            errors.Add("Add at least one output.");
        if (outputs.Count > MaxOutputs)
            errors.Add($"A work order can have at most {MaxOutputs} outputs.");
        if (outputs.Any(o => o.WeightLbs <= 0))
            errors.Add("Every output needs a weight above 0 lbs.");
        if (outputs.Any(o => o.WeightLbs > MaxOutputWeightLbs))
            errors.Add($"Each output can weigh at most {Lbs(MaxOutputWeightLbs)}.");
        if (outputs.Any(o => o.WeightLbs != Math.Round(o.WeightLbs, 2)))
            errors.Add("Weights can have at most 2 decimal places.");
        if (outputs.Count > 0 && outputs.All(o => o.IsScrap))
            errors.Add("At least one output must be a product that isn't scrap, so it can carry the cost.");

        if (remaining < 0)
            errors.Add(
                $"The outputs weigh {Lbs(outputWeight)}, which is {Lbs(-remaining)} more than " +
                $"{inputTag} ({Lbs(inputWeightLbs)}). Check the weights.");
        else if (remaining > 0 && outputs.Count > 0)
            warnings.Add(
                $"The outputs weigh {Lbs(remaining)} less than {inputTag} ({Lbs(inputWeightLbs)}). " +
                "The outputs will still carry its full cost.");

        var costs = errors.Count == 0 ? CostAllocator.Allocate(inputTotalCost, outputs) : null;
        return new WorkOrderPlan(costs, outputWeight, remaining, errors, warnings);
    }

    private static string Lbs(decimal weight) =>
        weight.ToString("#,0.##", CultureInfo.InvariantCulture) + (weight == 1 ? " lb" : " lbs");
}
