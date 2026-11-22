using Microsoft.EntityFrameworkCore;
using Savage.Api.Data;
using Testcontainers.MsSql;

namespace Savage.Api.Tests.Data;

/// <summary>
/// One SQL Server 2022 container per test run (needs Docker/OrbStack). Each test gets its own
/// freshly migrated database, so sequence numbers always start from the seeded values.
/// </summary>
public sealed class SqlServerFixture : IAsyncLifetime
{
    private readonly MsSqlContainer _container =
        new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    /// <summary>Context over an empty database that no migration has touched yet.</summary>
    public AppDbContext CreateContextForNewDatabase()
    {
        var connectionString = _container.GetConnectionString()
            .Replace("Database=master", $"Database=test_{Guid.NewGuid():N}");
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connectionString).Options;
        return new AppDbContext(options);
    }

    public async Task<AppDbContext> CreateMigratedContextAsync()
    {
        var db = CreateContextForNewDatabase();
        await db.Database.MigrateAsync();
        return db;
    }
}

[CollectionDefinition(Name)]
public class SqlServerCollection : ICollectionFixture<SqlServerFixture>
{
    public const string Name = "SQL Server";
}
