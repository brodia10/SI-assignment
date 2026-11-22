using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Savage.Api.Domain;

namespace Savage.Api.Auth;

/// <summary>
/// After the Firebase token is validated, look the user up by UID and add their role.
/// A valid Firebase account that was never invited (or is deactivated) gets no role,
/// so the authorization policies reject it with 403.
/// </summary>
public class RoleClaimsTransformation(AppDbContext db) : IClaimsTransformation
{
    public static readonly string[] AllRoles = Enum.GetNames<UserRole>();
    public const string AppUserIdClaim = "app_user_id";

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        var uid = principal.FindFirstValue("sub");
        if (uid is null || principal.HasClaim(c => c.Type == AppUserIdClaim))
            return principal;

        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.FirebaseUid == uid && u.IsActive);
        if (user is null)
            return principal;

        var identity = new ClaimsIdentity();
        identity.AddClaim(new Claim(ClaimTypes.Role, user.Role.ToString()));
        identity.AddClaim(new Claim(AppUserIdClaim, user.Id.ToString()));
        principal.AddIdentity(identity);
        return principal;
    }
}

public static class ClaimsPrincipalExtensions
{
    public static int AppUserId(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirstValue(RoleClaimsTransformation.AppUserIdClaim)
            ?? throw new InvalidOperationException("Not an app user"));
}
