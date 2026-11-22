using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Auth;
using Savage.Api.Data;

namespace Savage.Api.Features.Me;

public record MeResponse(int Id, string Email, string Role);

public static class MeEndpoints
{
    public static RouteGroupBuilder MapMeEndpoints(this RouteGroupBuilder api)
    {
        // Who am I? The web app calls this after sign-in to decide which screens to show.
        api.MapGet("/me", async (ClaimsPrincipal principal, AppDbContext db) =>
        {
            var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == principal.AppUserId());
            return new MeResponse(user.Id, user.Email, user.Role.ToString());
        })
        .WithName("GetMe")
        .WithTags("Me");

        return api;
    }
}
