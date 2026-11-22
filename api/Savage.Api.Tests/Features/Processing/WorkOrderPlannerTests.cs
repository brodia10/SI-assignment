using Savage.Api.Domain;
using Savage.Api.Features.Processing;

namespace Savage.Api.Tests.Features.Processing;

public class WorkOrderPlannerTests
{
    private static AllocationOutput Good(decimal lbs) => new(lbs, IsScrap: false);
    private static AllocationOutput Scrap(decimal lbs) => new(lbs, IsScrap: true);

    private static WorkOrderPlan PlanC1001(params AllocationOutput[] outputs) =>
        WorkOrderPlanner.Plan("C-1001", 40_000m, 16_800.00m, outputs);

    [Fact]
    public void Scenario_step_4_four_slit_coils_at_4200_and_scrap_at_zero()
    {
        var plan = PlanC1001(Good(9_900), Good(9_900), Good(9_900), Good(9_900), Scrap(400));

        Assert.True(plan.CanPost);
        Assert.Equal([4_200.00m, 4_200.00m, 4_200.00m, 4_200.00m, 0.00m], plan.Costs);
        Assert.Equal(16_800.00m, plan.Costs!.Sum());
        Assert.Equal(40_000m, plan.OutputWeightLbs);
        Assert.Equal(0m, plan.RemainingLbs);
        Assert.Empty(plan.Warnings);
    }

    [Fact]
    public void Outputs_heavier_than_the_input_are_blocked()
    {
        var plan = PlanC1001(Good(9_900), Good(9_900), Good(9_900), Good(9_900), Scrap(401));

        Assert.False(plan.CanPost);
        Assert.Null(plan.Costs);
        Assert.Equal(-1m, plan.RemainingLbs);
        Assert.Equal(
            "The outputs weigh 40,001 lbs, which is 1 lb more than C-1001 (40,000 lbs). Check the weights.",
            Assert.Single(plan.Errors));
    }

    [Fact]
    public void Outputs_lighter_than_the_input_warn_but_still_carry_the_full_cost()
    {
        var plan = PlanC1001(Good(9_900), Good(9_900), Good(9_900), Good(9_900), Scrap(300));

        Assert.True(plan.CanPost);
        Assert.Equal(100m, plan.RemainingLbs);
        Assert.Equal(16_800.00m, plan.Costs!.Sum());
        Assert.Equal(
            "The outputs weigh 100 lbs less than C-1001 (40,000 lbs). The outputs will still carry its full cost.",
            Assert.Single(plan.Warnings));
    }

    [Fact]
    public void Uneven_split_still_adds_up_to_the_input_cost_to_the_cent()
    {
        var plan = WorkOrderPlanner.Plan("C-2000", 3m, 100.00m, [Good(1), Good(1), Good(1)]);

        Assert.Equal([33.33m, 33.33m, 33.34m], plan.Costs);
    }

    [Fact]
    public void No_outputs_is_an_error()
    {
        var plan = PlanC1001();

        Assert.Equal("Add at least one output.", Assert.Single(plan.Errors));
        Assert.Empty(plan.Warnings); // nothing to be "lighter" about yet
    }

    [Fact]
    public void All_scrap_outputs_is_an_error()
    {
        var plan = PlanC1001(Scrap(40_000));

        Assert.Contains(plan.Errors, e => e.Contains("isn't scrap"));
        Assert.Null(plan.Costs);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void Output_weight_must_be_above_zero(decimal lbs)
    {
        var plan = PlanC1001(Good(39_000), Good(lbs));

        Assert.Contains("Every output needs a weight above 0 lbs.", plan.Errors);
    }

    [Fact]
    public void Output_weight_can_have_at_most_two_decimals()
    {
        var plan = PlanC1001(Good(39_999.995m));

        Assert.Contains("Weights can have at most 2 decimal places.", plan.Errors);
    }

    [Fact]
    public void An_absurd_weight_is_an_error_not_an_overflow()
    {
        var plan = PlanC1001(Good(decimal.MaxValue), Good(decimal.MaxValue));

        Assert.Contains("Each output can weigh at most 999,999.99 lbs.", plan.Errors);
        Assert.Null(plan.Costs);
    }

    [Fact]
    public void Too_many_outputs_is_an_error()
    {
        var outputs = Enumerable.Repeat(Good(1), WorkOrderPlanner.MaxOutputs + 1).ToArray();

        Assert.Contains(PlanC1001(outputs).Errors, e => e.Contains("at most 50 outputs"));
    }

    [Fact]
    public void A_zero_cost_input_gives_zero_cost_outputs()
    {
        var plan = WorkOrderPlanner.Plan("C-3000", 1_000m, 0.00m, [Good(600), Scrap(400)]);

        Assert.Equal([0.00m, 0.00m], plan.Costs);
    }
}
