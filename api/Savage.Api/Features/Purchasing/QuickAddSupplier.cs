using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Features.Purchasing;

public sealed record QuickAddSupplierRequest(string Name);

/// <summary>
/// Lets a purchaser standing at a new supplier add it by name while writing the PO (see README, "Vendors and
/// locations"). It's flagged <see cref="Vendor.AddedByPurchaser"/> so an admin can review it later.
/// Adding a name that already exists returns the existing supplier instead of failing, so a double tap or a
/// second purchaser adding the same yard doesn't create a duplicate.
/// </summary>
public static partial class QuickAddSupplierHandler
{
    public const int MinNameLength = 2;
    public const int MaxNameLength = 200;

    /// <summary>Trims and collapses runs of spaces, so "Acme  Steel " and "Acme Steel" are the same supplier.</summary>
    public static string NormalizeName(string? name) => ExtraSpaces().Replace(name?.Trim() ?? "", " ");

    public static async Task<Outcome<SupplierOption>> HandleAsync(
        AppDbContext db, QuickAddSupplierRequest request, CancellationToken ct = default)
    {
        var name = NormalizeName(request.Name);
        if (name.Length < MinNameLength)
            return Failure.Invalid("name", "Type the supplier's name.");
        if (name.Length > MaxNameLength)
            return Failure.Invalid("name", $"The name can be at most {MaxNameLength} characters.");

        var existing = await FindAsync(db, name, ct);
        if (existing is null)
        {
            db.Vendors.Add(new Vendor { Name = name, Kind = VendorKind.Supplier, AddedByPurchaser = true });
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Most likely someone added the same name a moment ago (unique index on Name): use theirs.
                // If there's no such supplier, it was some other failure, so let it surface.
                db.ChangeTracker.Clear();
                existing = await FindAsync(db, name, ct);
                if (existing is null) throw;
            }
            existing ??= await FindAsync(db, name, ct)
                ?? throw new InvalidOperationException($"Supplier '{name}' vanished after saving.");
        }

        if (!existing.IsActive)
            return Failure.Conflict($"{existing.Name} has been turned off by an admin. Ask an admin to turn it back on.");

        // A customer we now also buy from becomes "Both", so it shows up in the supplier list.
        if (existing.Kind == VendorKind.Customer)
        {
            existing.Kind = VendorKind.Both;
            await db.SaveChangesAsync(ct);
        }

        return new SupplierOption(existing.Id, existing.Name);
    }

    // The column's collation is case-insensitive, so "acme steel" finds "Acme Steel".
    private static Task<Vendor?> FindAsync(AppDbContext db, string name, CancellationToken ct) =>
        db.Vendors.SingleOrDefaultAsync(v => v.Name == name, ct);

    [GeneratedRegex(@"\s+")]
    private static partial Regex ExtraSpaces();
}
