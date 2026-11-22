using Savage.Api.Domain;

namespace Savage.Api.Features.Sales;

/// <summary>
/// The outcome of checking a sales order before it is posted. Exactly one of these holds:
/// <see cref="Errors"/> has entries (the request is wrong: 400), <see cref="Conflict"/> is set
/// (an item can't be sold any more: 409), or <see cref="Lines"/> is ready to save.
/// </summary>
public sealed record SalesOrderCheck(
    IReadOnlyList<SalesOrderLine> Lines,
    IReadOnlyDictionary<string, string[]> Errors,
    string? Conflict)
{
    public bool IsOk => Errors.Count == 0 && Conflict is null;
}

/// <summary>
/// Pure rules for a sales order: what may be sold, to whom, and what each line is worth.
/// Revenue and Cost are fixed on the line at posting, so reports never move when a price changes later.
/// </summary>
public static class SalesOrderRules
{
    public const int ContainerNumberMaxLength = 50;

    /// <summary>$/lb is stored as decimal(18,4); more places would be rounded silently on save.</summary>
    public const int PriceMaxDecimals = 4;

    /// <summary>Upper bound on $/lb, so weight × price can't overflow the Revenue column (decimal(18,2)).</summary>
    public const decimal PriceMax = 999.9999m;

    /// <summary>Line revenue: weight × $/lb, rounded to the cent (half a cent rounds up).</summary>
    public static decimal Revenue(decimal weightLbs, decimal pricePerLb) =>
        Math.Round(weightLbs * pricePerLb, 2, MidpointRounding.AwayFromZero);

    /// <summary>Blank becomes null; otherwise trimmed.</summary>
    public static string? NormalizeContainerNumber(string? containerNumber) =>
        string.IsNullOrWhiteSpace(containerNumber) ? null : containerNumber.Trim();

    /// <param name="request">What the purchaser asked to post.</param>
    /// <param name="customer">The vendor named by the request, or null if it doesn't exist.</param>
    /// <param name="items">The requested items that exist, by id.</param>
    public static SalesOrderCheck Check(
        CreateSalesOrderRequest request,
        Vendor? customer,
        IReadOnlyDictionary<int, InventoryItem> items)
    {
        var errors = new Dictionary<string, string[]>();
        void Fail(string key, string message) => errors[key] = [message];

        if (customer is null || !customer.IsActive || customer.Kind == VendorKind.Supplier)
            Fail(nameof(request.CustomerVendorId), "Pick a customer.");

        var container = NormalizeContainerNumber(request.ContainerNumber);
        if (container is { Length: > ContainerNumberMaxLength })
            Fail(nameof(request.ContainerNumber), $"Container number can be at most {ContainerNumberMaxLength} characters.");

        var requested = request.Lines ?? [];
        if (requested.Count == 0)
            Fail(nameof(request.Lines), "Pick at least one item to sell.");
        var ids = requested.Where(l => l is not null).Select(l => l.InventoryItemId).ToList();
        if (ids.Distinct().Count() != ids.Count)
            Fail(nameof(request.Lines), "The same item is on the order twice.");

        for (var i = 0; i < requested.Count; i++)
        {
            var line = requested[i];
            var key = $"{nameof(request.Lines)}[{i}]";
            if (line is null)
                Fail(key, "That line is empty.");
            else if (!items.ContainsKey(line.InventoryItemId))
                Fail(key, "That item doesn't exist.");
            else if (line.PricePerLb < 0)
                Fail(key, "Price can't be negative.");
            else if (line.PricePerLb > PriceMax)
                Fail(key, $"Price can be at most ${PriceMax}/lb.");
            else if (line.PricePerLb != Math.Round(line.PricePerLb, PriceMaxDecimals))
                Fail(key, $"Price can have at most {PriceMaxDecimals} decimal places.");
        }

        if (errors.Count > 0)
            return new SalesOrderCheck([], errors, null);

        var unavailable = requested
            .Select(l => items[l.InventoryItemId])
            .FirstOrDefault(item => item.Status != InventoryItemStatus.InStock);
        if (unavailable is not null)
            return new SalesOrderCheck([], errors, NotInStockMessage(unavailable));

        var lines = requested.Select(l =>
        {
            var item = items[l.InventoryItemId];
            return new SalesOrderLine
            {
                InventoryItemId = item.Id,
                InventoryItem = item,
                WeightLbs = item.WeightLbs,
                PricePerLb = l.PricePerLb,
                Revenue = Revenue(item.WeightLbs, l.PricePerLb),
                Cost = item.TotalCost,
            };
        }).ToList();
        return new SalesOrderCheck(lines, errors, null);
    }

    public static string NotInStockMessage(InventoryItem item) => item.Status switch
    {
        InventoryItemStatus.Sold => $"{item.Tag} was already sold.",
        InventoryItemStatus.Consumed => $"{item.Tag} was already used in a work order.",
        InventoryItemStatus.Voided => $"{item.Tag} was voided.",
        _ => $"{item.Tag} isn't in stock.",
    };
}
