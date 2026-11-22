using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Savage.Api.Data;
using Savage.Api.Domain;
using Savage.Api.Features.Users;
using Savage.Api.Tests.Data;

namespace Savage.Api.Tests.Features.Admin;

/// <summary>
/// The real API over its own freshly migrated SQL Server database, with two test seams:
/// - Bearer tokens are signed with a local key instead of Google's, but carry the same issuer, audience and
///   "sub" claim as a Firebase ID token, so the real JWT validation, role lookup and policies all run.
/// - Firebase user management is replaced by <see cref="FakeUserDirectory"/>.
/// </summary>
public sealed class TestApi : IAsyncDisposable
{
    private static readonly SymmetricSecurityKey SigningKey =
        new(Encoding.UTF8.GetBytes("test-signing-key-for-integration-tests-only-0123456789"));

    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _projectId;

    public AppDbContext Db { get; }
    public FakeUserDirectory Directory { get; } = new();

    private TestApi(AppDbContext db)
    {
        Db = db;
        var connectionString = db.Database.GetConnectionString()!;
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("ConnectionStrings:Default", connectionString);
            b.ConfigureTestServices(services =>
            {
                services.RemoveAll<IUserDirectory>();
                services.AddSingleton<IUserDirectory>(Directory);
                services.Configure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, o =>
                {
                    // A static configuration means no call to Google for signing keys.
                    o.Configuration = new OpenIdConnectConfiguration { Issuer = o.TokenValidationParameters.ValidIssuer };
                    o.TokenValidationParameters.IssuerSigningKey = SigningKey;
                });
            });
        });

        // Guard against the app quietly using another database (e.g. the developer's from user-secrets).
        using var scope = _factory.Services.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (appDb.Database.GetConnectionString() != connectionString)
            throw new InvalidOperationException("The API under test isn't using the test database");
        _projectId = scope.ServiceProvider.GetRequiredService<IConfiguration>()["Firebase:ProjectId"]!;
    }

    public static async Task<TestApi> StartAsync(SqlServerFixture sql) =>
        new(await sql.CreateMigratedContextAsync());

    public async Task<AppUser> AddUserAsync(UserRole role, bool isActive = true)
    {
        var uid = $"uid-{Guid.NewGuid():N}";
        var user = new AppUser { FirebaseUid = uid, Email = $"{uid}@example.com", Role = role, IsActive = isActive };
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        return user;
    }

    /// <summary>A client signed in as this Firebase UID (whether or not SQL knows it).</summary>
    public HttpClient ClientFor(string firebaseUid)
    {
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = $"https://securetoken.google.com/{_projectId}",
            Audience = _projectId,
            Subject = new ClaimsIdentity([new Claim("sub", firebaseUid)]),
            Expires = DateTime.UtcNow.AddMinutes(10),
            SigningCredentials = new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256),
        });
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public HttpClient ClientFor(AppUser user) => ClientFor(user.FirebaseUid);

    /// <summary>Reads current rows, not what this context cached earlier.</summary>
    public AppDbContext Fresh()
    {
        Db.ChangeTracker.Clear();
        return Db;
    }

    public async ValueTask DisposeAsync()
    {
        await _factory.DisposeAsync();
        await Db.DisposeAsync();
    }
}

/// <summary>Stands in for Firebase: remembers which emails have sign-ins and hands out fake links.</summary>
public class FakeUserDirectory : IUserDirectory
{
    public ConcurrentDictionary<string, string> UidsByEmail { get; } = new();

    /// <summary>Makes link creation fail, like Firebase being unreachable.</summary>
    public bool FailLinks { get; set; }

    public Task<string> GetOrCreateUserAsync(string email, CancellationToken ct = default) =>
        Task.FromResult(UidsByEmail.GetOrAdd(email, _ => $"fb-{Guid.NewGuid():N}"));

    public Task<string> CreateSetPasswordLinkAsync(string email, CancellationToken ct = default) =>
        FailLinks
            ? Task.FromException<string>(new UserDirectoryException("Firebase is down", new HttpRequestException()))
            : Task.FromResult($"https://example.test/set-password?email={Uri.EscapeDataString(email)}&n={Guid.NewGuid():N}");
}
