using System.Text.RegularExpressions;

namespace Savage.Api.Auth;

/// <summary>
/// Which browser origins may call the API. The live sites are listed exactly in
/// <c>Cors:AllowedOrigins</c>. Firebase Hosting preview channels (one per PR) get generated hostnames,
/// so they're matched by <c>Cors:PreviewOriginPattern</c>, which only matches this project's previews.
/// </summary>
public sealed class CorsOrigins
{
    private readonly HashSet<string> _exact;
    private readonly Regex? _preview;

    public CorsOrigins(IEnumerable<string> exact, string? previewPattern)
    {
        _exact = new HashSet<string>(exact, StringComparer.OrdinalIgnoreCase);
        _preview = string.IsNullOrWhiteSpace(previewPattern)
            ? null
            : new Regex(previewPattern, RegexOptions.CultureInvariant | RegexOptions.IgnoreCase, TimeSpan.FromMilliseconds(50));
    }

    public static CorsOrigins FromConfig(IConfiguration config) => new(
        config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [],
        config["Cors:PreviewOriginPattern"]);

    public bool IsAllowed(string origin) =>
        _exact.Contains(origin) || (_preview?.IsMatch(origin) ?? false);
}
