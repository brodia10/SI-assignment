using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Auth;
using Savage.Api.Data;
using Savage.Api.Domain;
using Savage.Api.Features.Products;

namespace Savage.Api.Features.Vendors;

/// <param name="Kind">Supplier, Customer or Both.</param>
/// <param name="AddedByPurchaser">Quick-added in the field and not yet reviewed by an admin.</param>
public record VendorResponse(int Id, string Name, string Kind, bool AddedByPurchaser, bool IsActive);

/// <param name="Kind">Supplier, Customer or Both.</param>
public record SaveVendorRequest(string Name, string Kind, bool IsActive = true);

/// <param name="Kind">Supplier or Customer: which side the purchaser is adding it for.</param>
public record QuickAddVendorRequest(string Name, string Kind);

public static class VendorsEndpoints
{
    public const int MaxNameLength = 200;

    public static RouteGroupBuilder MapVendorsEndpoints(this RouteGroupBuilder api)
    {
        // Purchasers can read and quick-add by name; edits and the full list (inactive too) are admin-only.
        var group = api.MapGroup("/vendors")
            .WithTags("Vendors");

        group.MapGet("/", async (AppDbContext db, ClaimsPrincipal user, string? kind = null, bool includeInactive = false) =>
        {
            VendorKind? side = null;
            if (kind is not null)
            {
                if (!CatalogRules.TryParseExact(kind, out VendorKind parsed) || parsed == VendorKind.Both)
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                        { ["kind"] = ["Filter by Supplier or Customer."] });
                side = parsed;
            }

            var showInactive = includeInactive && user.IsInRole(nameof(UserRole.Admin));
            var vendors = await db.Vendors.AsNoTracking()
                .Where(v => showInactive || v.IsActive)
                .Where(v => side == null || v.Kind == side || v.Kind == VendorKind.Both)
                .OrderBy(v => v.Name)
                .Select(v => ToResponse(v))
                .ToListAsync();
            return Results.Ok(vendors);
        })
        .WithName("ListVendors")
        .WithSummary("Active vendors, by name. kind=Supplier or Customer also includes vendors marked Both.")
        .Produces<List<VendorResponse>>()
        .ProducesValidationProblem();

        group.MapPost("/", async (SaveVendorRequest request, AppDbContext db) =>
            await SaveAsync(new Vendor { Name = "" }, request, db, isNew: true))
        .WithName("CreateVendor")
        .RequireAuthorization(Policies.Admin)
        .Produces<VendorResponse>(StatusCodes.Status201Created)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPut("/{id:int}", async (int id, SaveVendorRequest request, AppDbContext db) =>
        {
            var vendor = await db.Vendors.FindAsync(id);
            return vendor is null ? Results.NotFound() : await SaveAsync(vendor, request, db, isNew: false);
        })
        .WithName("UpdateVendor")
        .WithSummary("Edit a vendor. Saving also marks a purchaser's quick-add as reviewed.")
        .RequireAuthorization(Policies.Admin)
        .Produces<VendorResponse>()
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/quick-add", QuickAddAsync)
        .WithName("QuickAddVendor")
        .WithSummary("Purchaser adds a vendor by name while writing a PO or SO. Returns the existing vendor if the name is taken.")
        .Produces<VendorResponse>()
        .Produces<VendorResponse>(StatusCodes.Status201Created)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status409Conflict);

        return api;
    }

    public static Dictionary<string, string[]> Validate(SaveVendorRequest request) =>
        CatalogRules.Errors(
            (nameof(request.Name), CatalogRules.NameError(CatalogRules.NormalizeName(request.Name), MaxNameLength)),
            (nameof(request.Kind), CatalogRules.TryParseExact<VendorKind>(request.Kind, out _)
                ? null
                : "Pick Supplier, Customer or Both."));

    public static Dictionary<string, string[]> Validate(QuickAddVendorRequest request) =>
        CatalogRules.Errors(
            (nameof(request.Name), CatalogRules.NameError(CatalogRules.NormalizeName(request.Name), MaxNameLength)),
            (nameof(request.Kind), CatalogRules.TryParseExact(request.Kind, out VendorKind kind) && kind != VendorKind.Both
                ? null
                : "Pick Supplier or Customer."));

    /// <summary>
    /// A vendor we already sell to that the purchaser now buys from (or the reverse) becomes Both,
    /// so it shows up in the pick list they're working in.
    /// </summary>
    public static VendorKind MergeKind(VendorKind existing, VendorKind requested) =>
        existing == requested || existing == VendorKind.Both ? existing : VendorKind.Both;

    private static async Task<IResult> QuickAddAsync(QuickAddVendorRequest request, AppDbContext db)
    {
        var errors = Validate(request);
        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        var name = CatalogRules.NormalizeName(request.Name);
        CatalogRules.TryParseExact(request.Kind, out VendorKind kind);

        // Same name (SQL Server's default collation ignores case) = same vendor. This also makes a double tap safe.
        var existing = await db.Vendors.FirstOrDefaultAsync(v => v.Name == name);
        if (existing is null)
        {
            var vendor = new Vendor { Name = name, Kind = kind, AddedByPurchaser = true };
            db.Vendors.Add(vendor);
            try
            {
                await db.SaveChangesAsync();
                return Results.Created($"/api/vendors/{vendor.Id}", ToResponse(vendor));
            }
            catch (DbUpdateException e) when (CatalogRules.IsUniqueViolation(e))
            {
                // Another request added the same name a moment ago: use that one.
                db.Entry(vendor).State = EntityState.Detached;
                existing = await db.Vendors.FirstAsync(v => v.Name == name);
            }
        }

        if (!existing.IsActive)
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Vendor turned off",
                detail: $"“{existing.Name}” was turned off by an admin. Ask an admin to turn it back on.");

        var merged = MergeKind(existing.Kind, kind);
        if (merged != existing.Kind)
        {
            existing.Kind = merged;
            existing.AddedByPurchaser = true; // an admin should see that this vendor's role changed
            await db.SaveChangesAsync();
        }

        return Results.Ok(ToResponse(existing));
    }

    private static async Task<IResult> SaveAsync(Vendor vendor, SaveVendorRequest request, AppDbContext db, bool isNew)
    {
        var errors = Validate(request);
        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        var name = CatalogRules.NormalizeName(request.Name);
        if (await db.Vendors.AnyAsync(v => v.Name == name && v.Id != vendor.Id))
            return CatalogRules.DuplicateName("vendor", name);

        CatalogRules.TryParseExact(request.Kind, out VendorKind kind);
        vendor.Name = name;
        vendor.Kind = kind;
        vendor.IsActive = request.IsActive;
        vendor.AddedByPurchaser = false; // an admin has now looked at it
        if (isNew)
            db.Vendors.Add(vendor);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException e) when (CatalogRules.IsUniqueViolation(e))
        {
            return CatalogRules.DuplicateName("vendor", name);
        }

        var response = ToResponse(vendor);
        return isNew ? Results.Created($"/api/vendors/{vendor.Id}", response) : Results.Ok(response);
    }

    private static VendorResponse ToResponse(Vendor v) =>
        new(v.Id, v.Name, v.Kind.ToString(), v.AddedByPurchaser, v.IsActive);
}
