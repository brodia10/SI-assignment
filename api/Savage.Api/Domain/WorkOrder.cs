namespace Savage.Api.Domain;

public enum WorkOrderStatus
{
    Completed = 0,
    Voided = 1,
}

/// <summary>
/// Consumes one inventory item and produces many. The outputs are the items whose
/// SourceWorkOrderId points here; they share the input's TotalCost (see CostAllocator).
/// </summary>
public class WorkOrder : AuditedDocument
{
    public int InputItemId { get; set; }
    public InventoryItem InputItem { get; set; } = null!;
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Completed;

    public List<InventoryItem> Outputs { get; set; } = [];
}
