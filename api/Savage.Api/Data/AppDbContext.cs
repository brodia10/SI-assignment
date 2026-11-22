using Microsoft.EntityFrameworkCore;
using Savage.Api.Domain;

namespace Savage.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderLine> PurchaseOrderLines => Set<PurchaseOrderLine>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<SalesOrder> SalesOrders => Set<SalesOrder>();
    public DbSet<SalesOrderLine> SalesOrderLines => Set<SalesOrderLine>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Money and weights: two decimal places. $/lb columns override this with 4 (see configurations).
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
        configurationBuilder.Properties<decimal?>().HavePrecision(18, 2);

        // Enums are stored as readable strings, matching AppUser.Role.
        configurationBuilder.Properties<VendorKind>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<LocationKind>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<PurchaseOrderStatus>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<InventoryItemStatus>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<WorkOrderStatus>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<SalesOrderStatus>().HaveConversion<string>().HaveMaxLength(20);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(e =>
        {
            e.HasIndex(u => u.FirebaseUid).IsUnique();
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.FirebaseUid).HasMaxLength(128);
            e.Property(u => u.Email).HasMaxLength(256);
            e.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.AddSequences();
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Posted records are never deleted, so nothing cascades. This also avoids SQL Server's
        // "multiple cascade paths" error on the audit-user foreign keys.
        foreach (var fk in modelBuilder.Model.GetEntityTypes().SelectMany(t => t.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.Restrict;

        // Exception: an Open PO is a draft, so removing a line (or the whole draft) deletes its lines.
        // Received POs still can't be deleted: their lines are referenced by inventory items (Restrict).
        modelBuilder.Entity<PurchaseOrder>()
            .HasMany(p => p.Lines).WithOne(l => l.PurchaseOrder)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
