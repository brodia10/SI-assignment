using Savage.Api.Auth;

namespace Savage.Api.Features.Users;

public static class UsersEndpoints
{
    public static RouteGroupBuilder MapUsersEndpoints(this RouteGroupBuilder api)
    {
        // Lane A (Admin): invite users, change roles, deactivate. The whole group is admin-only.
        var group = api.MapGroup("/users")
            .WithTags("Users")
            .RequireAuthorization(Policies.Admin);

        return api;
    }
}
