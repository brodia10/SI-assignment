using System.Data;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Auth;
using Savage.Api.Data;
using Savage.Api.Domain;
using Savage.Api.Features.Products;

namespace Savage.Api.Features.Users;

/// <param name="Role">Admin or Purchaser.</param>
public record UserResponse(int Id, string Email, string Role, bool IsActive, DateTimeOffset CreatedAt);

/// <param name="Role">Admin or Purchaser.</param>
public record InviteUserRequest(string Email, string Role);

/// <param name="SetPasswordLink">Copy this to the person. It lets them choose a password, then sign in.</param>
public record InviteUserResponse(UserResponse User, string SetPasswordLink);

/// <param name="Role">Admin or Purchaser.</param>
/// <param name="IsActive">False turns the account off: every API call it makes gets 403 from then on.</param>
public record UpdateUserRequest(string Role, bool IsActive);

public record SetPasswordLinkResponse(string SetPasswordLink);

public static class UsersEndpoints
{
    public static RouteGroupBuilder MapUsersEndpoints(this RouteGroupBuilder api)
    {
        // Invite users, change roles, deactivate. The whole group is admin-only.
        var group = api.MapGroup("/users")
            .WithTags("Users")
            .RequireAuthorization(Policies.Admin);

        group.MapGet("/", async (AppDbContext db) =>
            await db.Users.AsNoTracking()
                .OrderByDescending(u => u.IsActive).ThenBy(u => u.Email)
                .Select(u => ToResponse(u))
                .ToListAsync())
        .WithName("ListUsers");

        group.MapPost("/invite", InviteAsync)
        .WithName("InviteUser")
        .WithSummary("Create the sign-in (no password yet) and the app user, and return a set-password link to share.")
        .Produces<InviteUserResponse>(StatusCodes.Status201Created)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status502BadGateway);

        group.MapPut("/{id:int}", UpdateAsync)
        .WithName("UpdateUser")
        .WithSummary("Change a user's role or turn their account off/on. Takes effect on their next request.")
        .Produces<UserResponse>()
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/{id:int}/set-password-link", NewLinkAsync)
        .WithName("CreateSetPasswordLink")
        .WithSummary("A fresh set-password link, e.g. when the first one expired.")
        .Produces<SetPasswordLinkResponse>()
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status502BadGateway);

        return api;
    }

    public static Dictionary<string, string[]> Validate(InviteUserRequest request) =>
        CatalogRules.Errors(
            (nameof(request.Email), UserRules.EmailError(UserRules.NormalizeEmail(request.Email))),
            (nameof(request.Role), RoleError(request.Role)));

    private static async Task<IResult> InviteAsync(InviteUserRequest request, AppDbContext db, IUserDirectory directory,
        CancellationToken ct)
    {
        var errors = Validate(request);
        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        var email = UserRules.NormalizeEmail(request.Email);
        CatalogRules.TryParseExact(request.Role, out UserRole role);

        var existing = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email, ct);
        if (existing is not null)
            return AlreadyInvited(existing);

        string uid;
        try
        {
            uid = await directory.GetOrCreateUserAsync(email, ct);
        }
        catch (UserDirectoryException)
        {
            return SignInServiceDown("Nothing was saved.");
        }

        // Users are matched by UID: the sign-in may already belong to an app user under an older email.
        var sameSignIn = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.FirebaseUid == uid, ct);
        if (sameSignIn is not null)
            return AlreadyInvited(sameSignIn);

        var user = new AppUser { FirebaseUid = uid, Email = email, Role = role };
        db.Users.Add(user);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (CatalogRules.IsUniqueViolation(e))
        {
            // A double tap on Invite: the first request already added this person.
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Already invited",
                detail: $"{email} was just invited. Tap them in the list to get a set-password link.");
        }

        // The user is saved before the link is made: if Firebase fails here, the admin can make a new link.
        try
        {
            var link = await directory.CreateSetPasswordLinkAsync(email, ct);
            return Results.Created($"/api/users/{user.Id}", new InviteUserResponse(ToResponse(user), link));
        }
        catch (UserDirectoryException)
        {
            return SignInServiceDown(
                $"{email} was added, but the set-password link couldn't be made. Tap them in the list to try again.");
        }
    }

    private static async Task<IResult> UpdateAsync(int id, UpdateUserRequest request, AppDbContext db, ClaimsPrincipal principal)
    {
        if (RoleError(request.Role) is { } roleError)
            return Results.ValidationProblem(new Dictionary<string, string[]> { [nameof(request.Role)] = [roleError] });
        CatalogRules.TryParseExact(request.Role, out UserRole role);

        // Serializable: the "another admin remains" check holds until this commits, so two admins demoting each other
        // at once can't both succeed (one gets a deadlock, is retried by the execution strategy, and then fails the check).
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

            var user = await db.Users.FindAsync(id);
            if (user is null)
                return Results.NotFound();

            if (UserRules.ChangeError(user, principal.AppUserId(), role, request.IsActive) is { } changeError)
                return Results.ValidationProblem(new Dictionary<string, string[]> { [""] = [changeError] });

            var otherAdmins = await db.Users.CountAsync(u => u.Role == UserRole.Admin && u.IsActive && u.Id != id);
            if (UserRules.LastAdminError(user, role, request.IsActive, otherAdmins) is { } lastAdminError)
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Last admin", detail: lastAdminError);

            // RoleClaimsTransformation reads the role and IsActive from SQL on every request, so this applies at once.
            user.Role = role;
            user.IsActive = request.IsActive;
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.Ok(ToResponse(user));
        });
    }

    private static async Task<IResult> NewLinkAsync(int id, AppDbContext db, IUserDirectory directory, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
            return Results.NotFound();
        if (!user.IsActive)
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Account is off",
                detail: $"Turn {user.Email} back on first, so the link is useful.");

        try
        {
            return Results.Ok(new SetPasswordLinkResponse(await directory.CreateSetPasswordLinkAsync(user.Email, ct)));
        }
        catch (UserDirectoryException)
        {
            return SignInServiceDown("Try again in a minute.");
        }
    }

    private static string? RoleError(string? role) =>
        CatalogRules.TryParseExact<UserRole>(role, out _) ? null : "Pick Purchaser or Admin.";

    private static IResult AlreadyInvited(AppUser user) =>
        Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Already invited",
            detail: user.IsActive
                ? $"{user.Email} already has an account. Tap them in the list to make a new set-password link."
                : $"{user.Email} already has an account, but it's turned off. Tap them in the list to turn it back on.");

    private static IResult SignInServiceDown(string whatNow) =>
        Results.Problem(statusCode: StatusCodes.Status502BadGateway, title: "Sign-in service error",
            detail: $"Couldn't reach the sign-in service. {whatNow}");

    private static UserResponse ToResponse(AppUser u) =>
        new(u.Id, u.Email, u.Role.ToString(), u.IsActive, u.CreatedAt);
}
