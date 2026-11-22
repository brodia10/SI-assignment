namespace Savage.Api.Features.Processing;

// ---- Requests ----

public record WorkOrderOutputRequest(int ProductId, decimal WeightLbs, int LocationId);

/// <summary>Same body for preview and post, so what the purchaser confirmed is exactly what gets posted.</summary>
public record CreateWorkOrderRequest(int InputItemId, IReadOnlyList<WorkOrderOutputRequest> Outputs);

// ---- Pick lists for the screen ----

public record WorkOrderInputOption(
    int Id, string Tag, int ProductId, string ProductName, decimal WeightLbs, decimal TotalCost, string LocationName);

public record WorkOrderProductOption(int Id, string Name, bool IsScrap);

public record WorkOrderLocationOption(int Id, string Name, string Kind);

public record WorkOrderOptionsResponse(
    IReadOnlyList<WorkOrderInputOption> Inputs,
    IReadOnlyList<WorkOrderProductOption> Products,
    IReadOnlyList<WorkOrderLocationOption> Locations);

// ---- Preview ----

/// <param name="TotalCost">Null while the plan has errors.</param>
public record WorkOrderPreviewOutput(
    int ProductId, string ProductName, bool IsScrap, decimal WeightLbs, int LocationId, string LocationName,
    decimal? TotalCost);

public record WorkOrderPreviewResponse(
    string InputTag,
    decimal InputWeightLbs,
    decimal InputTotalCost,
    decimal OutputWeightLbs,
    decimal RemainingLbs,
    IReadOnlyList<WorkOrderPreviewOutput> Outputs,
    IReadOnlyList<string> Errors,
    IReadOnlyList<string> Warnings,
    bool CanPost);

// ---- Posted ----

public record PostedWorkOrderOutput(
    int Id, string Tag, string ProductName, bool IsScrap, decimal WeightLbs, string LocationName, decimal TotalCost);

public record PostedWorkOrderResponse(
    int Id, int Number, string InputTag, IReadOnlyList<PostedWorkOrderOutput> Outputs, IReadOnlyList<string> Warnings);
