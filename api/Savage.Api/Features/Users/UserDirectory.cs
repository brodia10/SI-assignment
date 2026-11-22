using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Savage.Api.Auth;

namespace Savage.Api.Features.Users;

/// <summary>
/// Where sign-in identities live (Firebase Authentication). Behind an interface so tests don't call Google.
/// </summary>
public interface IUserDirectory
{
    /// <summary>The UID of the sign-in for this email, creating one with no password if there isn't one yet.</summary>
    Task<string> GetOrCreateUserAsync(string email, CancellationToken ct = default);

    /// <summary>
    /// A one-time link that lets the person choose their password (Firebase's password-reset page). It expires
    /// after about an hour; the admin can make a new one.
    /// </summary>
    Task<string> CreateSetPasswordLinkAsync(string email, CancellationToken ct = default);
}

/// <summary>The sign-in service failed or isn't set up (e.g. missing Admin SDK credentials).</summary>
public class UserDirectoryException(string message, Exception inner) : Exception(message, inner);

public class FirebaseUserDirectory(IConfiguration config) : IUserDirectory
{
    // Created on first use, so the API starts (and the read-only screens work) even without Admin SDK credentials.
    private FirebaseAuth Auth => FirebaseAuth.GetAuth(FirebaseAdminSetup.GetApp(config));

    public Task<string> GetOrCreateUserAsync(string email, CancellationToken ct = default) =>
        Wrap(async () =>
        {
            try
            {
                return (await Auth.GetUserByEmailAsync(email, ct)).Uid;
            }
            catch (FirebaseAuthException e) when (e.AuthErrorCode == AuthErrorCode.UserNotFound)
            {
                try
                {
                    return (await Auth.CreateUserAsync(new UserRecordArgs { Email = email }, ct)).Uid;
                }
                catch (FirebaseAuthException race) when (race.AuthErrorCode == AuthErrorCode.EmailAlreadyExists)
                {
                    return (await Auth.GetUserByEmailAsync(email, ct)).Uid;
                }
            }
        });

    public Task<string> CreateSetPasswordLinkAsync(string email, CancellationToken ct = default) =>
        Wrap(() => Auth.GeneratePasswordResetLinkAsync(email, null, ct));

    private static async Task<string> Wrap(Func<Task<string>> call)
    {
        try
        {
            return await call();
        }
        catch (FirebaseException e)
        {
            throw new UserDirectoryException("Firebase request failed", e);
        }
        catch (InvalidOperationException e) when (e.Message.StartsWith("Missing config"))
        {
            throw new UserDirectoryException("Firebase Admin SDK isn't configured", e);
        }
    }
}

public static class UsersFeature
{
    public static IServiceCollection AddUsersFeature(this IServiceCollection services) =>
        services.AddSingleton<IUserDirectory, FirebaseUserDirectory>();
}
