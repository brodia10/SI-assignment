using Microsoft.EntityFrameworkCore;
using Savage.Api.Domain;

namespace Savage.Api.Data;

/// <summary>
/// Links the existing demo Firebase accounts to a local database, so a developer can sign in locally
/// without the Firebase admin key. Only writes SQL rows: the accounts already exist in Firebase.
/// Run with: dotnet run --project api/Savage.Api -- seed-local-users
/// UIDs, emails and roles come from config section Demo:LocalUsers (appsettings.Development.json).
/// </summary>
public static class LocalUserSeeder
{
    public record LocalUser(string FirebaseUid, string Email, UserRole Role);

    public static async Task RunAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var users = config.GetSection("Demo:LocalUsers").Get<LocalUser[]>() ?? [];
        if (users.Length == 0)
            throw new InvalidOperationException(
                "No Demo:LocalUsers configured (it's in appsettings.Development.json, so run in the Development environment)");

        await SeedAsync(db, users);
        foreach (var user in users)
            Console.WriteLine($"Local user ready: {user.Email} ({user.Role})");
    }

    public static async Task SeedAsync(AppDbContext db, IEnumerable<LocalUser> users)
    {
        foreach (var user in users)
            await UpsertAsync(db, user.FirebaseUid, user.Email, user.Role);
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Adds the user, or for an existing UID resets the role and reactivates it.
    /// Shared with <see cref="DemoUserSeeder"/>. The caller saves.
    /// </summary>
    public static async Task UpsertAsync(AppDbContext db, string firebaseUid, string email, UserRole role)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.FirebaseUid == firebaseUid);
        if (user is null)
            db.Users.Add(new AppUser { FirebaseUid = firebaseUid, Email = email, Role = role });
        else
        {
            user.Role = role;
            user.IsActive = true;
        }
    }
}
