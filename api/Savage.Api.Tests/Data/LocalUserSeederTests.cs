using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Savage.Api.Data;
using Savage.Api.Domain;
using static Savage.Api.Data.LocalUserSeeder;

namespace Savage.Api.Tests.Data;

[Collection(SqlServerCollection.Name)]
public class LocalUserSeederTests(SqlServerFixture sql)
{
    private static readonly LocalUser[] DemoUsers =
    [
        new("uid-admin", "admin@example.com", UserRole.Admin),
        new("uid-purchaser", "purchaser@example.com", UserRole.Purchaser),
    ];

    [Fact]
    public async Task Creates_a_row_for_each_local_user()
    {
        await using var db = await sql.CreateMigratedContextAsync();

        await SeedAsync(db, DemoUsers);

        var users = await db.Users.AsNoTracking().OrderBy(u => u.FirebaseUid).ToListAsync();
        Assert.Collection(users,
            u => Assert.Equal(("uid-admin", "admin@example.com", UserRole.Admin, true), (u.FirebaseUid, u.Email, u.Role, u.IsActive)),
            u => Assert.Equal(("uid-purchaser", "purchaser@example.com", UserRole.Purchaser, true), (u.FirebaseUid, u.Email, u.Role, u.IsActive)));
    }

    [Fact]
    public async Task Re_running_resets_role_and_reactivates_without_duplicating()
    {
        await using var db = await sql.CreateMigratedContextAsync();
        await SeedAsync(db, DemoUsers);
        var admin = await db.Users.SingleAsync(u => u.FirebaseUid == "uid-admin");
        admin.Role = UserRole.Purchaser;
        admin.IsActive = false;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        await SeedAsync(db, DemoUsers);

        Assert.Equal(2, await db.Users.CountAsync());
        var reseeded = await db.Users.AsNoTracking().SingleAsync(u => u.FirebaseUid == "uid-admin");
        Assert.Equal(UserRole.Admin, reseeded.Role);
        Assert.True(reseeded.IsActive);
    }

    [Fact]
    public void Development_config_lists_both_demo_users()
    {
        var config = new ConfigurationBuilder()
            .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "appsettings.Development.json"))
            .Build();

        var users = config.GetSection("Demo:LocalUsers").Get<LocalUser[]>() ?? [];

        Assert.Equal(
            [("admin@example.com", UserRole.Admin), ("purchaser@example.com", UserRole.Purchaser)],
            users.Select(u => (u.Email, u.Role)));
        Assert.All(users, u => Assert.False(string.IsNullOrWhiteSpace(u.FirebaseUid)));
    }
}
