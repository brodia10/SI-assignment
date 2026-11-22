using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Savage.Api.Auth;

namespace Savage.Api.Tests;

/// <summary>
/// Guards the admin-only feature groups. A lane that maps an endpoint with <c>api.MapGet("/reports/...")</c>
/// instead of on the group would silently drop the Admin requirement; this test catches that.
/// Inspects the registered endpoints only, so it needs no database or Firebase token.
/// </summary>
public class AdminOnlyEndpointsTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly string[] AdminOnlyPrefixes = ["/api/users", "/api/reports"];

    private List<RouteEndpoint> ApiEndpoints()
    {
        var app = factory.WithWebHostBuilder(b =>
            b.UseSetting("ConnectionStrings:Default", "Server=unused;Database=unused"));
        return app.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText?.StartsWith("/api", StringComparison.OrdinalIgnoreCase) == true)
            .ToList();
    }

    [Fact]
    public void Endpoint_listing_sees_the_api()
    {
        // Proves the check below inspects real endpoints rather than passing on an empty list.
        Assert.Contains(ApiEndpoints(), e => e.RoutePattern.RawText == "/api/me");
    }

    [Fact]
    public void Users_and_reports_endpoints_require_the_admin_policy()
    {
        var adminOnly = ApiEndpoints().Where(e =>
            AdminOnlyPrefixes.Any(p => e.RoutePattern.RawText!.StartsWith(p, StringComparison.OrdinalIgnoreCase)));

        Assert.All(adminOnly, e =>
            Assert.Contains(e.Metadata.GetOrderedMetadata<IAuthorizeData>(), a => a.Policy == Policies.Admin));
    }
}
