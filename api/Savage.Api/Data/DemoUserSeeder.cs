using FirebaseAdmin.Auth;
using Microsoft.EntityFrameworkCore;
using Savage.Api.Auth;
using Savage.Api.Domain;

namespace Savage.Api.Data;

/// <summary>
/// Creates the demo sign-ins (one Admin, one Purchaser) in Firebase and links them in SQL.
/// Run with: dotnet run --project api/Savage.Api -- seed-demo-users
/// Emails and passwords come from config section Demo:Users (never hard-coded).
/// </summary>
public static class DemoUserSeeder
{
    private record DemoUser(string Email, string Password, UserRole Role);

    public static async Task RunAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var auth = FirebaseAuth.GetAuth(FirebaseAdminSetup.GetApp(config));

        var demoUsers = config.GetSection("Demo:Users").Get<DemoUser[]>() ?? [];
        if (demoUsers.Length == 0)
            throw new InvalidOperationException("No Demo:Users configured");

        foreach (var demo in demoUsers)
        {
            UserRecord record;
            try
            {
                record = await auth.GetUserByEmailAsync(demo.Email);
                await auth.UpdateUserAsync(new UserRecordArgs { Uid = record.Uid, Password = demo.Password });
            }
            catch (FirebaseAuthException e) when (e.AuthErrorCode == AuthErrorCode.UserNotFound)
            {
                record = await auth.CreateUserAsync(new UserRecordArgs { Email = demo.Email, Password = demo.Password });
            }

            var user = await db.Users.FirstOrDefaultAsync(u => u.FirebaseUid == record.Uid);
            if (user is null)
                db.Users.Add(new AppUser { FirebaseUid = record.Uid, Email = demo.Email, Role = demo.Role });
            else
            {
                user.Role = demo.Role;
                user.IsActive = true;
            }

            Console.WriteLine($"Demo user ready: {demo.Email} ({demo.Role})");
        }

        await db.SaveChangesAsync();
    }
}
