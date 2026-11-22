using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Auth;
using Savage.Api.Data;
using Savage.Api.Domain;
using Savage.Api.Features.Products;

namespace Savage.Api.Features.Locations;

/// <param name="Kind">Bay, Rack or Bin.</param>
/// <param name="ItemsInStock">In-stock items sitting here now, so the admin sees what a deactivation leaves behind.</param>
public record LocationResponse(int Id, string Name, string Kind, bool IsActive, int ItemsInStock);

/// <param name="Kind">Bay, Rack or Bin.</param>
public record SaveLocationRequest(string Name, string Kind, bool IsActive = true);

public static class LocationsEndpoints
{
    public const int MaxNameLength = 100;

    public static RouteGroupBuilder MapLocationsEndpoints(this RouteGroupBuilder api)
    {
        // Any app user can read (pick lists). Writes are admin-only.
        var group = api.MapGroup("/locations")
            .WithTags("Locations");

        group.MapGet("/", async (AppDbContext db, ClaimsPrincipal user, bool includeInactive = false) =>
        {
            var showInactive = includeInactive && user.IsInRole(nameof(UserRole.Admin));
            return await db.Locations.AsNoTracking()
                .Where(l => showInactive || l.IsActive)
                .OrderBy(l => l.Name)
                .Select(l => new LocationResponse(l.Id, l.Name, l.Kind.ToString(), l.IsActive,
                    db.InventoryItems.Count(i => i.LocationId == l.Id && i.Status == InventoryItemStatus.InStock)))
                .ToListAsync();
        })
        .WithName("ListLocations")
        .WithSummary("Active locations, by name. Admins can pass includeInactive=true.");

        group.MapPost("/", async (SaveLocationRequest request, AppDbContext db) =>
            await SaveAsync(new Location { Name = "" }, request, db, isNew: true))
        .WithName("CreateLocation")
        .RequireAuthorization(Policies.Admin)
        .Produces<LocationResponse>(StatusCodes.Status201Created)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPut("/{id:int}", async (int id, SaveLocationRequest request, AppDbContext db) =>
        {
            var location = await db.Locations.FindAsync(id);
            return location is null ? Results.NotFound() : await SaveAsync(location, request, db, isNew: false);
        })
        .WithName("UpdateLocation")
        .RequireAuthorization(Policies.Admin)
        .Produces<LocationResponse>()
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        return api;
    }

    public static Dictionary<string, string[]> Validate(SaveLocationRequest request) =>
        CatalogRules.Errors(
            (nameof(request.Name), CatalogRules.NameError(CatalogRules.NormalizeName(request.Name), MaxNameLength)),
            (nameof(request.Kind), CatalogRules.TryParseExact<LocationKind>(request.Kind, out _) ? null : "Pick Bay, Rack or Bin."));

    // Deactivating a location only hides it from pick lists. Items already there keep it (reports still show them).
    private static async Task<IResult> SaveAsync(Location location, SaveLocationRequest request, AppDbContext db, bool isNew)
    {
        var errors = Validate(request);
        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        var name = CatalogRules.NormalizeName(request.Name);
        if (await db.Locations.AnyAsync(l => l.Name == name && l.Id != location.Id))
            return CatalogRules.DuplicateName("location", name);

        location.Name = name;
        CatalogRules.TryParseExact(request.Kind, out LocationKind kind);
        location.Kind = kind;
        location.IsActive = request.IsActive;
        if (isNew)
            db.Locations.Add(location);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException e) when (CatalogRules.IsUniqueViolation(e))
        {
            return CatalogRules.DuplicateName("location", name);
        }

        var itemsInStock = isNew ? 0 : await db.InventoryItems
            .CountAsync(i => i.LocationId == location.Id && i.Status == InventoryItemStatus.InStock);
        var response = new LocationResponse(location.Id, location.Name, location.Kind.ToString(), location.IsActive, itemsInStock);
        return isNew ? Results.Created($"/api/locations/{location.Id}", response) : Results.Ok(response);
    }
}
