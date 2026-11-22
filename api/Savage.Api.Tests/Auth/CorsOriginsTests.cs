using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Savage.Api.Auth;

namespace Savage.Api.Tests.Auth;

/// <summary>
/// The API only answers browsers on the live Firebase sites and this project's PR preview channels.
/// Runs the real app with production settings (appsettings.json) and checks the CORS response headers,
/// so it covers both the matcher and the Program.cs wiring. Needs no database or Firebase token.
/// </summary>
public sealed class CorsOriginsTests : IClassFixture<WebApplicationFactory<Program>>, IDisposable
{
    private const string PreviewOrigin = "https://si-assignment--pr19-deploy-cicd-a1b2c3d4.web.app";

    private readonly WebApplicationFactory<Program> _production;
    private readonly HttpClient _client;

    public CorsOriginsTests(WebApplicationFactory<Program> factory)
    {
        _production = factory.WithWebHostBuilder(b => b
            .UseEnvironment("Production")
            .UseSetting("ConnectionStrings:Default", "Server=unused;Database=unused"));
        _client = _production.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _production.Dispose();
    }

    [Theory]
    [InlineData("https://si-assignment.web.app")]
    [InlineData("https://si-assignment.firebaseapp.com")]
    [InlineData(PreviewOrigin)]
    public async Task Live_sites_and_this_projects_previews_are_allowed(string origin)
    {
        Assert.Equal(origin, await AllowedOriginHeader(origin));
    }

    [Theory]
    [InlineData("https://evil.web.app")] // someone else's Firebase site
    [InlineData("https://other-project--pr1-abc.web.app")] // someone else's preview channel
    [InlineData("https://si-assignment--pr1.web.app.evil.com")] // suffix trick
    [InlineData("http://si-assignment--pr1-abc.web.app")] // not HTTPS
    [InlineData("https://si-assignment--pr1-abc.firebaseapp.com")] // previews are only on web.app
    [InlineData("http://localhost:5173")] // dev origin isn't in production settings
    public async Task Other_origins_are_rejected(string origin)
    {
        Assert.Null(await AllowedOriginHeader(origin));
    }

    [Fact]
    public async Task Preview_preflight_allows_the_authorization_header()
    {
        // Browsers send this before every authenticated API call from a preview.
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/me");
        request.Headers.Add("Origin", PreviewOrigin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        request.Headers.Add("Access-Control-Request-Headers", "authorization");
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(PreviewOrigin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Contains("authorization", response.Headers.GetValues("Access-Control-Allow-Headers").Single());
    }

    [Fact]
    public void Without_a_preview_pattern_only_exact_origins_match()
    {
        var origins = new CorsOrigins(["https://si-assignment.web.app"], previewPattern: null);

        Assert.True(origins.IsAllowed("https://si-assignment.web.app"));
        Assert.False(origins.IsAllowed("https://si-assignment--pr1-abc.web.app"));
    }

    [Fact]
    public void Preview_pattern_rejects_a_trailing_newline()
    {
        var origins = CorsOrigins.FromConfig(
            new ConfigurationBuilder()
                .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "appsettings.json"))
                .Build());

        Assert.True(origins.IsAllowed("https://si-assignment--pr1-abc.web.app"));
        Assert.False(origins.IsAllowed("https://si-assignment--pr1-abc.web.app\n"));
    }

    private async Task<string?> AllowedOriginHeader(string origin)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", origin);
        using var response = await _client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values)
            ? values.Single()
            : null;
    }
}
