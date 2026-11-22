using Savage.Api.Domain;

namespace Savage.Api.Tests.Domain;

public class CostAllocatorTests
{
    private static AllocationOutput Good(decimal lbs) => new(lbs, IsScrap: false);
    private static AllocationOutput Scrap(decimal lbs) => new(lbs, IsScrap: true);

    // ---- Assignment scenario (step 4 → step 6) ----

    [Fact]
    public void Scenario_C1001_slit_into_four_coils_plus_scrap()
    {
        // $16,800 coil → 4 × 9,900 lb slit coils + 400 lb scrap. Good coils carry the cost.
        var costs = CostAllocator.Allocate(16_800.00m,
            [Good(9_900), Good(9_900), Good(9_900), Good(9_900), Scrap(400)]);

        Assert.Equal([4_200.00m, 4_200.00m, 4_200.00m, 4_200.00m, 0m], costs);
        Assert.Equal(16_800.00m, costs.Sum());
    }

    [Fact]
    public void Scenario_two_slit_coils_sold_on_SO5001_cost_exactly_8400()
    {
        var costs = CostAllocator.Allocate(16_800.00m,
            [Good(9_900), Good(9_900), Good(9_900), Good(9_900), Scrap(400)]);

        Assert.Equal(8_400.00m, costs[0] + costs[1]);
    }

    // ---- Sharing by weight ----

    [Fact]
    public void Single_non_scrap_output_gets_the_whole_cost()
    {
        Assert.Equal([1_234.56m], CostAllocator.Allocate(1_234.56m, [Good(500)]));
    }

    [Fact]
    public void Non_scrap_outputs_share_cost_in_proportion_to_weight()
    {
        var costs = CostAllocator.Allocate(1_000.00m, [Good(3_000), Good(1_000)]);

        Assert.Equal([750.00m, 250.00m], costs);
    }

    [Fact]
    public void Output_order_is_preserved()
    {
        var costs = CostAllocator.Allocate(1_000.00m, [Good(1_000), Scrap(50), Good(3_000)]);

        Assert.Equal([250.00m, 0m, 750.00m], costs);
    }

    // ---- Scrap ----

    [Fact]
    public void Scrap_gets_zero_even_when_it_is_the_heaviest_output()
    {
        var costs = CostAllocator.Allocate(500.00m, [Scrap(10_000), Good(100)]);

        Assert.Equal([0m, 500.00m], costs);
    }

    [Fact]
    public void Scrap_weight_does_not_dilute_the_good_outputs()
    {
        // Same good outputs with and without scrap → same costs for the good outputs.
        var withoutScrap = CostAllocator.Allocate(900.00m, [Good(100), Good(200)]);
        var withScrap = CostAllocator.Allocate(900.00m, [Good(100), Scrap(5_000), Good(200)]);

        Assert.Equal(withoutScrap[0], withScrap[0]);
        Assert.Equal(withoutScrap[1], withScrap[2]);
    }

    // ---- Rounding remainder ----

    [Fact]
    public void Leftover_fraction_of_a_cent_goes_to_the_last_output()
    {
        var costs = CostAllocator.Allocate(100.00m, [Good(1), Good(1), Good(1)]);

        Assert.Equal([33.33m, 33.33m, 33.34m], costs);
    }

    [Fact]
    public void Shares_are_rounded_down_so_one_cent_lands_on_the_last_output()
    {
        var costs = CostAllocator.Allocate(0.01m, [Good(1), Good(1), Good(1)]);

        Assert.Equal([0m, 0m, 0.01m], costs);
    }

    [Fact]
    public void Leftover_goes_to_the_last_non_scrap_output_when_the_list_ends_with_scrap()
    {
        var costs = CostAllocator.Allocate(100.00m, [Good(1), Good(1), Good(1), Scrap(5)]);

        Assert.Equal([33.33m, 33.33m, 33.34m, 0m], costs);
    }

    [Fact]
    public void Many_outputs_with_a_tiny_last_one_never_get_a_negative_cost()
    {
        // With round-to-nearest, each ≈0.0055 share would round up to 0.01 and the last output
        // would get 0.05 − 0.09 = −0.04. Rounding down keeps every cost ≥ 0.
        AllocationOutput[] outputs = [.. Enumerable.Repeat(Good(1), 9), Good(0.01m)];

        var costs = CostAllocator.Allocate(0.05m, outputs);

        Assert.All(costs, c => Assert.True(c >= 0, $"cost {c} is negative"));
        Assert.Equal(0.05m, costs.Sum());
    }

    [Fact]
    public void Every_cost_is_whole_cents_so_it_survives_a_decimal_18_2_column()
    {
        var costs = CostAllocator.Allocate(1_234.57m, [Good(7), Scrap(3), Good(13), Good(17)]);

        Assert.All(costs, c => Assert.Equal(Math.Round(c, 2), c));
    }

    public static TheoryData<decimal, decimal[], bool[]> AwkwardSplits => new()
    {
        { 16_800.00m, [9_900, 9_900, 9_900, 9_900, 400], [false, false, false, false, true] },
        { 100.00m, [1, 1, 1], [false, false, false] },
        { 1_234.57m, [7, 13, 17, 19, 23, 29, 31], [false, false, true, false, false, false, false] },
        { 0.07m, [3, 3, 3, 3, 3, 3, 3, 3], [false, false, false, false, false, false, false, false] },
        { 9_999_999.99m, [1.5m, 2.25m, 3.125m], [false, false, false] },
        { 6_750.00m, [1_666.67m, 1_666.67m, 1_666.66m], [false, false, false] },
    };

    [Theory]
    [MemberData(nameof(AwkwardSplits))]
    public void Outputs_always_add_up_to_the_input_cost_exactly(decimal cost, decimal[] weights, bool[] isScrap)
    {
        var outputs = weights.Zip(isScrap, (w, s) => new AllocationOutput(w, s)).ToArray();

        var costs = CostAllocator.Allocate(cost, outputs);

        Assert.Equal(cost, costs.Sum());
        Assert.All(costs, c => Assert.True(c >= 0));

        // Each share tracks its exact weight-based share: the others are rounded down by < 1¢,
        // and the last non-scrap output gets at least its exact share (it absorbs the leftover).
        var goodWeight = outputs.Where(o => !o.IsScrap).Sum(o => o.WeightLbs);
        var last = Array.FindLastIndex(outputs, o => !o.IsScrap);
        for (var i = 0; i < outputs.Length; i++)
        {
            if (outputs[i].IsScrap)
            {
                Assert.Equal(0m, costs[i]);
                continue;
            }
            var exact = cost * outputs[i].WeightLbs / goodWeight;
            if (i == last)
                Assert.True(costs[i] >= exact, $"last share {costs[i]} < exact {exact}");
            else
                Assert.InRange(exact - costs[i], 0m, 0.0099999999m);
        }
    }

    [Fact]
    public void Zero_input_cost_gives_zero_to_every_output()
    {
        var costs = CostAllocator.Allocate(0m, [Good(100), Good(200), Scrap(10)]);

        Assert.All(costs, c => Assert.Equal(0m, c));
        Assert.Equal(0m, costs.Sum());
    }

    // ---- Validation ----

    [Fact]
    public void Throws_when_there_are_no_outputs()
    {
        Assert.Throws<ArgumentException>(() => CostAllocator.Allocate(100m, []));
    }

    [Fact]
    public void Throws_when_input_cost_is_negative()
    {
        Assert.Throws<ArgumentException>(() => CostAllocator.Allocate(-0.01m, [Good(1)]));
    }

    [Fact]
    public void Throws_when_input_cost_has_fractions_of_a_cent()
    {
        // TotalCost is stored as decimal(18,2); a sub-cent output would be rounded on save and
        // the outputs would no longer add up to the input.
        Assert.Throws<ArgumentException>(() => CostAllocator.Allocate(100.005m, [Good(1), Good(1)]));
    }

    [Fact]
    public void Accepts_whole_cent_input_written_with_extra_zero_decimals()
    {
        // 40,000 lb × $0.4200/lb has scale 4 but is whole cents.
        Assert.Equal([16_800.00m], CostAllocator.Allocate(40_000m * 0.4200m, [Good(39_600)]));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void Throws_when_an_output_weight_is_not_positive(int lbs)
    {
        Assert.Throws<ArgumentException>(() => CostAllocator.Allocate(100m, [Good(10), Good(lbs)]));
    }

    [Fact]
    public void Throws_when_a_scrap_output_weight_is_not_positive()
    {
        Assert.Throws<ArgumentException>(() => CostAllocator.Allocate(100m, [Good(10), Scrap(0)]));
    }

    [Fact]
    public void Throws_when_every_output_is_scrap_because_the_cost_would_vanish()
    {
        Assert.Throws<ArgumentException>(() => CostAllocator.Allocate(100m, [Scrap(10), Scrap(20)]));
    }

    [Fact]
    public void Throws_when_outputs_is_null()
    {
        Assert.Throws<ArgumentNullException>(() => CostAllocator.Allocate(100m, null!));
    }
}
