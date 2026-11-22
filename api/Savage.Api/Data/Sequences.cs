using Microsoft.EntityFrameworkCore;

namespace Savage.Api.Data;

/// <summary>
/// SQL Server sequences behind document numbers and floor tags. Column defaults draw from them,
/// so a new PO/WO/SO/item gets its number on insert without any app code.
/// Starting values make the assignment scenario produce PO #2201, SO #5001 and tag C-1001.
/// The DataModel migration also sets NO CACHE on each (EF has no API for it), so a server restart
/// doesn't skip a block of numbers. A rolled-back insert still uses up its number, so small gaps
/// are possible (normal for document numbering).
/// </summary>
public static class Sequences
{
    public const string PurchaseOrderNumbers = "PurchaseOrderNumbers";
    public const string SalesOrderNumbers = "SalesOrderNumbers";
    public const string WorkOrderNumbers = "WorkOrderNumbers";
    public const string InventoryTagNumbers = "InventoryTagNumbers";

    public static void AddSequences(this ModelBuilder modelBuilder)
    {
        modelBuilder.HasSequence<int>(PurchaseOrderNumbers).StartsAt(2201);
        modelBuilder.HasSequence<int>(SalesOrderNumbers).StartsAt(5001);
        modelBuilder.HasSequence<int>(WorkOrderNumbers).StartsAt(1001);
        modelBuilder.HasSequence<int>(InventoryTagNumbers).StartsAt(1001);
    }
}
