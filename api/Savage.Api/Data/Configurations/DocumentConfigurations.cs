using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Savage.Api.Domain;

namespace Savage.Api.Data.Configurations;

/// <summary>Mapping shared by every posted document: sequence-assigned number and audit users.</summary>
internal static class AuditedDocumentMapping
{
    public static void MapAuditedDocument<T>(this EntityTypeBuilder<T> e, string sequence) where T : AuditedDocument
    {
        e.Property(d => d.Number).HasDefaultValueSql($"NEXT VALUE FOR {sequence}");
        e.HasIndex(d => d.Number).IsUnique();
        e.Property(d => d.VoidReason).HasMaxLength(500);
        e.HasOne(d => d.CreatedBy).WithMany().HasForeignKey(d => d.CreatedByUserId);
        e.HasOne(d => d.VoidedBy).WithMany().HasForeignKey(d => d.VoidedByUserId);
    }
}

public class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> e)
    {
        e.MapAuditedDocument(Sequences.PurchaseOrderNumbers);
        e.HasIndex(p => p.Status);
        // Receiving creates items, so there is no item status to check yet; this token stops a
        // double-tapped Receive from posting twice (the second save fails on a stale RowVersion).
        e.Property(p => p.RowVersion).IsRowVersion();
        e.HasOne(p => p.ReceivedBy).WithMany().HasForeignKey(p => p.ReceivedByUserId);
        e.HasMany(p => p.Lines).WithOne(l => l.PurchaseOrder).HasForeignKey(l => l.PurchaseOrderId);
    }
}

public class PurchaseOrderLineConfiguration : IEntityTypeConfiguration<PurchaseOrderLine>
{
    public void Configure(EntityTypeBuilder<PurchaseOrderLine> e)
    {
        e.Property(l => l.PricePerLb).HasPrecision(18, 4);
        e.Property(l => l.Grade).HasMaxLength(50);
        e.Property(l => l.Notes).HasMaxLength(1000);
        e.ToTable(t =>
        {
            t.HasCheckConstraint("CK_PurchaseOrderLines_Weight", "WeightLbs > 0");
            t.HasCheckConstraint("CK_PurchaseOrderLines_Price", "PricePerLb >= 0");
        });
    }
}

public class InventoryItemConfiguration : IEntityTypeConfiguration<InventoryItem>
{
    public void Configure(EntityTypeBuilder<InventoryItem> e)
    {
        e.Property(i => i.Tag)
            .HasMaxLength(20)
            .HasDefaultValueSql($"'C-' + CAST(NEXT VALUE FOR {Sequences.InventoryTagNumbers} AS nvarchar(18))");
        e.HasIndex(i => i.Tag).IsUnique();
        e.HasIndex(i => i.Status);
        e.Property(i => i.RowVersion).IsRowVersion();

        e.HasOne(i => i.SourcePurchaseOrderLine).WithMany().HasForeignKey(i => i.SourcePurchaseOrderLineId);
        e.HasOne(i => i.SourceWorkOrder).WithMany(w => w.Outputs).HasForeignKey(i => i.SourceWorkOrderId);

        e.ToTable(t =>
        {
            // An item comes from a PO line or a work order, never both and never neither.
            t.HasCheckConstraint(
                "CK_InventoryItems_OneSource",
                "(SourcePurchaseOrderLineId IS NOT NULL AND SourceWorkOrderId IS NULL)"
                + " OR (SourcePurchaseOrderLineId IS NULL AND SourceWorkOrderId IS NOT NULL)");
            t.HasCheckConstraint("CK_InventoryItems_Weight", "WeightLbs > 0");
            t.HasCheckConstraint("CK_InventoryItems_TotalCost", "TotalCost >= 0");
        });
    }
}

public class WorkOrderConfiguration : IEntityTypeConfiguration<WorkOrder>
{
    public void Configure(EntityTypeBuilder<WorkOrder> e)
    {
        e.MapAuditedDocument(Sequences.WorkOrderNumbers);
        e.HasIndex(w => w.Status);
        e.HasOne(w => w.InputItem).WithMany().HasForeignKey(w => w.InputItemId);
        // Database backstop: one item can be the input of only one completed work order.
        e.HasIndex(w => w.InputItemId).IsUnique().HasFilter("[Status] = 'Completed'");
    }
}

public class SalesOrderConfiguration : IEntityTypeConfiguration<SalesOrder>
{
    public void Configure(EntityTypeBuilder<SalesOrder> e)
    {
        e.MapAuditedDocument(Sequences.SalesOrderNumbers);
        e.HasIndex(s => s.Status);
        e.Property(s => s.ContainerNumber).HasMaxLength(50);
        e.HasOne(s => s.Customer).WithMany().HasForeignKey(s => s.CustomerVendorId);
        e.HasMany(s => s.Lines).WithOne(l => l.SalesOrder).HasForeignKey(l => l.SalesOrderId);
    }
}

public class SalesOrderLineConfiguration : IEntityTypeConfiguration<SalesOrderLine>
{
    public void Configure(EntityTypeBuilder<SalesOrderLine> e)
    {
        e.Property(l => l.PricePerLb).HasPrecision(18, 4);
        e.HasIndex(l => new { l.SalesOrderId, l.InventoryItemId }).IsUnique();
        e.ToTable(t =>
        {
            t.HasCheckConstraint("CK_SalesOrderLines_Weight", "WeightLbs > 0");
            t.HasCheckConstraint("CK_SalesOrderLines_Price", "PricePerLb >= 0");
            t.HasCheckConstraint("CK_SalesOrderLines_Revenue", "Revenue >= 0");
            t.HasCheckConstraint("CK_SalesOrderLines_Cost", "Cost >= 0");
        });
    }
}
