using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;

namespace Savage.Api.Auth;

/// <summary>
/// The Firebase Admin SDK is only needed for admin actions (creating invited users).
/// Credentials come from Firebase:CredentialsJson (deployed, env var) or
/// Firebase:CredentialsPath (local dev, a file outside the repo).
/// </summary>
public static class FirebaseAdminSetup
{
    private static readonly Lock Gate = new();

    public static FirebaseApp GetApp(IConfiguration config)
    {
        lock (Gate)
        {
            if (FirebaseApp.DefaultInstance is { } existing)
                return existing;

            var json = config["Firebase:CredentialsJson"];
            var path = config["Firebase:CredentialsPath"];
            if (string.IsNullOrWhiteSpace(json) && !string.IsNullOrWhiteSpace(path))
                json = File.ReadAllText(Environment.ExpandEnvironmentVariables(path.Replace("~", Environment.GetFolderPath(Environment.SpecialFolder.UserProfile))));
            if (string.IsNullOrWhiteSpace(json))
                throw new InvalidOperationException("Missing config: Firebase:CredentialsJson or Firebase:CredentialsPath");

            var credential = CredentialFactory.FromJson<ServiceAccountCredential>(json).ToGoogleCredential();
            return FirebaseApp.Create(new AppOptions { Credential = credential, ProjectId = config["Firebase:ProjectId"] });
        }
    }
}
