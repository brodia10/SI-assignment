using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;

namespace Savage.Api.Auth;

public static class Policies
{
    public const string Admin = "Admin";
    /// <summary>Any active user with a role (Admin or Purchaser).</summary>
    public const string AppUser = "AppUser";
}

public static class FirebaseAuthSetup
{
    /// <summary>
    /// Validates Firebase ID tokens as standard JWTs (Google's public signing keys, no secret needed),
    /// then adds the user's role from SQL as a role claim.
    /// </summary>
    public static IServiceCollection AddFirebaseAuth(this IServiceCollection services, IConfiguration config)
    {
        var projectId = config["Firebase:ProjectId"]
            ?? throw new InvalidOperationException("Missing config: Firebase:ProjectId");

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = $"https://securetoken.google.com/{projectId}";
                options.TokenValidationParameters.ValidIssuer = $"https://securetoken.google.com/{projectId}";
                options.TokenValidationParameters.ValidAudience = projectId;
                options.MapInboundClaims = false; // keep Firebase claim names ("sub", "email")
            });

        services.AddScoped<IClaimsTransformation, RoleClaimsTransformation>();

        services.AddAuthorizationBuilder()
            .AddPolicy(Policies.AppUser, p => p.RequireRole(RoleClaimsTransformation.AllRoles))
            .AddPolicy(Policies.Admin, p => p.RequireRole(nameof(Domain.UserRole.Admin)))
            // Secure by default: every endpoint needs an app user unless it opts out.
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireRole(RoleClaimsTransformation.AllRoles).Build());

        return services;
    }
}
