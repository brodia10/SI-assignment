namespace Savage.Api.Domain;

public enum LocationKind
{
    Bay = 0,
    Rack = 1,
    Bin = 2,
}

/// <summary>A fixed physical place in the warehouse where inventory sits. Admin-managed.</summary>
public class Location
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public LocationKind Kind { get; set; }
    public bool IsActive { get; set; } = true;
}
