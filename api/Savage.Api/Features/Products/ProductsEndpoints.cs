using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Auth;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Features.Products;

public record ProductResponse(
    int Id,
    string Name,
    bool IsScrap,
    decimal? DefaultBuyPricePerLb,
    decimal? DefaultSellPricePerLb,
    bool IsActive);

/// <summary>Create or replace a product. Prices are $/lb defaults for new PO and SO lines; null means "no default".</summary>
public record SaveProductRequest(
    string Name,
    bool IsScrap,
    decimal? DefaultBuyPricePerLb,
    decimal? DefaultSellPricePerLb,
    bool IsActive = true);

public static class ProductsEndpoints
{
    public const int MaxNameLength = 200;

    public static RouteGroupBuilder MapProductsEndpoints(this RouteGroupBuilder api)
    {
        // Any app user can read (purchasers pick from it). Writes are admin-only.
        var group = api.MapGroup("/products")
            .WithTags("Products");

        group.MapGet("/", async (AppDbContext db, ClaimsPrincipal user, bool includeInactive = false) =>
        {
            var showInactive = includeInactive && user.IsInRole(nameof(UserRole.Admin));
            return await db.Products.AsNoTracking()
                .Where(p => showInactive || p.IsActive)
                .OrderBy(p => p.Name)
                .Select(p => ToResponse(p))
                .ToListAsync();
        })
        .WithName("ListProducts")
        .WithSummary("Active products, by name. Admins can pass includeInactive=true.");

        group.MapPost("/", async (SaveProductRequest request, AppDbContext db) =>
        {
            var product = new Product { Name = "" };
            return await SaveAsync(product, request, db, isNew: true);
        })
        .WithName("CreateProduct")
        .RequireAuthorization(Policies.Admin)
        .Produces<ProductResponse>(StatusCodes.Status201Created)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPut("/{id:int}", async (int id, SaveProductRequest request, AppDbContext db) =>
        {
            var product = await db.Products.FindAsync(id);
            return product is null ? Results.NotFound() : await SaveAsync(product, request, db, isNew: false);
        })
        .WithName("UpdateProduct")
        .RequireAuthorization(Policies.Admin)
        .Produces<ProductResponse>()
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        return api;
    }

    public static Dictionary<string, string[]> Validate(SaveProductRequest request) =>
        CatalogRules.Errors(
            (nameof(request.Name), CatalogRules.NameError(CatalogRules.NormalizeName(request.Name), MaxNameLength)),
            (nameof(request.DefaultBuyPricePerLb), CatalogRules.PricePerLbError(request.DefaultBuyPricePerLb)),
            (nameof(request.DefaultSellPricePerLb), CatalogRules.PricePerLbError(request.DefaultSellPricePerLb)));

    // Changing a default price or the scrap flag only affects documents written afterwards: PO/SO lines copy the
    // price, and inventory items store their own TotalCost.
    private static async Task<IResult> SaveAsync(Product product, SaveProductRequest request, AppDbContext db, bool isNew)
    {
        var errors = Validate(request);
        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        var name = CatalogRules.NormalizeName(request.Name);
        if (await db.Products.AnyAsync(p => p.Name == name && p.Id != product.Id))
            return CatalogRules.DuplicateName("product", name);

        product.Name = name;
        product.IsScrap = request.IsScrap;
        product.DefaultBuyPricePerLb = request.DefaultBuyPricePerLb;
        product.DefaultSellPricePerLb = request.DefaultSellPricePerLb;
        product.IsActive = request.IsActive;
        if (isNew)
            db.Products.Add(product);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException e) when (CatalogRules.IsUniqueViolation(e))
        {
            return CatalogRules.DuplicateName("product", name);
        }

        var response = ToResponse(product);
        return isNew ? Results.Created($"/api/products/{product.Id}", response) : Results.Ok(response);
    }

    private static ProductResponse ToResponse(Product p) =>
        new(p.Id, p.Name, p.IsScrap, p.DefaultBuyPricePerLb, p.DefaultSellPricePerLb, p.IsActive);
}
