using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Features.Purchasing;

public sealed record CreatePurchaseOrderLine(int ProductId, decimal WeightLbs, decimal PricePerLb, string? Grade = null);

public sealed record CreatePurchaseOrderRequest(int VendorId, IReadOnlyList<CreatePurchaseOrderLine> Lines);

/// <summary>Checks a new PO's shape before touching the database. Messages are written for the purchaser.</summary>
public static class CreatePurchaseOrderValidator
{
    public const int MaxLines = 50;
    public const decimal MaxWeightLbs = 999_999.99m;
    public const decimal MaxPricePerLb = 999.9999m;
    public const int MaxGradeLength = 50;

    public static Dictionary<string, string[]> Validate(CreatePurchaseOrderRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        void Add(string field, string message) => errors[field] = [message];

        if (request.VendorId <= 0) Add("vendorId", "Pick the supplier.");

        var lines = request.Lines ?? [];
        if (lines.Count == 0) Add("lines", "Add at least one product.");
        if (lines.Count > MaxLines) Add("lines", $"A PO can have at most {MaxLines} products.");

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var at = $"lines[{i}]";
            var name = $"Line {i + 1}";
            if (line is null)
            {
                Add(at, $"{name} is empty. Remove it and add the product again.");
                continue;
            }

            if (line.ProductId <= 0) Add($"{at}.productId", $"{name}: pick the product.");

            if (line.WeightLbs <= 0)
                Add($"{at}.weightLbs", $"{name}: the weight must be more than 0 lbs.");
            else if (line.WeightLbs > MaxWeightLbs)
                Add($"{at}.weightLbs", $"{name}: the weight can't be more than {MaxWeightLbs:N2} lbs.");
            else if (!PurchaseOrderMath.FitsDecimals(line.WeightLbs, PurchaseOrderMath.WeightDecimals))
                Add($"{at}.weightLbs", $"{name}: the weight can have at most 2 decimal places.");

            if (line.PricePerLb < 0)
                Add($"{at}.pricePerLb", $"{name}: the price can't be negative.");
            else if (line.PricePerLb > MaxPricePerLb)
                Add($"{at}.pricePerLb", $"{name}: the price can't be more than ${MaxPricePerLb}/lb.");
            else if (!PurchaseOrderMath.FitsDecimals(line.PricePerLb, PurchaseOrderMath.PriceDecimals))
                Add($"{at}.pricePerLb", $"{name}: the price can have at most 4 decimal places.");

            if (line.Grade?.Trim().Length > MaxGradeLength)
                Add($"{at}.grade", $"{name}: the grade can be at most {MaxGradeLength} characters.");
        }

        return errors;
    }
}

/// <summary>Saves a new PO as Open. Its number (2201, 2202, …) comes from a SQL Server sequence on insert.</summary>
public static class CreatePurchaseOrderHandler
{
    public static async Task<Outcome<PurchaseOrderResponse>> HandleAsync(
        AppDbContext db, int userId, CreatePurchaseOrderRequest request, CancellationToken ct = default)
    {
        var errors = CreatePurchaseOrderValidator.Validate(request);
        if (errors.Count > 0) return Failure.Invalid(errors);

        var vendor = await db.Vendors.AsNoTracking().SingleOrDefaultAsync(v => v.Id == request.VendorId, ct);
        if (vendor is null || !vendor.IsActive || vendor.Kind == VendorKind.Customer)
            return Failure.Invalid("vendorId", "That supplier isn't available. Pick another one.");

        var productIds = request.Lines.Select(l => l.ProductId).Distinct().ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id) && p.IsActive)
            .ToDictionaryAsync(p => p.Id, ct);
        for (var i = 0; i < request.Lines.Count; i++)
        {
            if (!products.ContainsKey(request.Lines[i].ProductId))
                errors[$"lines[{i}].productId"] = [$"Line {i + 1}: that product isn't available. Pick another one."];
        }
        if (errors.Count > 0) return Failure.Invalid(errors);

        var po = new PurchaseOrder
        {
            VendorId = vendor.Id,
            CreatedByUserId = userId,
            Lines = request.Lines.Select(l => new PurchaseOrderLine
            {
                ProductId = l.ProductId,
                WeightLbs = l.WeightLbs,
                PricePerLb = l.PricePerLb,
                Grade = string.IsNullOrWhiteSpace(l.Grade) ? null : l.Grade.Trim(),
            }).ToList(),
        };
        db.PurchaseOrders.Add(po);
        await db.SaveChangesAsync(ct);

        return (await PurchaseOrderQueries.GetAsync(db, po.Id, ct))!;
    }
}
