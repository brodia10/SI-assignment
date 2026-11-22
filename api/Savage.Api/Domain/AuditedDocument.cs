namespace Savage.Api.Domain;

/// <summary>
/// Shared fields for posted paperwork (PO, work order, SO). Posted documents are never edited
/// or deleted; a correction is a void that records who, when and why.
/// This is a plain base class, not an EF inheritance hierarchy: each document has its own table.
/// </summary>
public abstract class AuditedDocument
{
    public int Id { get; set; }

    /// <summary>Human-facing number, assigned by a SQL Server sequence on insert.</summary>
    public int Number { get; set; }

    public int CreatedByUserId { get; set; }
    public AppUser CreatedBy { get; set; } = null!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public int? VoidedByUserId { get; set; }
    public AppUser? VoidedBy { get; set; }
    public DateTimeOffset? VoidedAt { get; set; }
    public string? VoidReason { get; set; }
}
