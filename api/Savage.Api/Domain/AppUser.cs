namespace Savage.Api.Domain;

public enum UserRole
{
    Purchaser = 0,
    Admin = 1,
}

/// <summary>
/// A person allowed to use the app. Identity (email + password) lives in Firebase;
/// the role lives here so a change takes effect on the user's next request.
/// Users are always matched by Firebase UID, never by email.
/// </summary>
public class AppUser
{
    public int Id { get; set; }
    public required string FirebaseUid { get; set; }
    public required string Email { get; set; }
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
