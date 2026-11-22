using System.Net.Mail;
using Savage.Api.Domain;

namespace Savage.Api.Features.Users;

/// <summary>Who can be invited and what an admin may change. Pure functions, unit-tested.</summary>
public static class UserRules
{
    public const int MaxEmailLength = 256;

    /// <summary>Firebase treats emails case-insensitively and stores them lower-case; so do we.</summary>
    public static string NormalizeEmail(string? raw) => (raw ?? "").Trim().ToLowerInvariant();

    public static string? EmailError(string normalizedEmail) =>
        normalizedEmail.Length == 0 ? "Enter an email address."
        : normalizedEmail.Length > MaxEmailLength ? "That email address is too long."
        : !MailAddress.TryCreate(normalizedEmail, out var parsed) || parsed.Address != normalizedEmail
          || !parsed.Host.Contains('.') ? "That doesn't look like an email address."
        : null;

    /// <summary>
    /// An admin can't change their own role or deactivate themselves, so nobody locks themselves out by accident.
    /// </summary>
    public static string? ChangeError(AppUser target, int actingUserId, UserRole newRole, bool newIsActive)
    {
        if (target.Id != actingUserId)
            return null;
        if (!newIsActive)
            return "You can't deactivate your own account. Ask another admin.";
        if (newRole != target.Role)
            return "You can't change your own role. Ask another admin.";
        return null;
    }

    /// <summary>
    /// Someone must always be able to manage users. The self rule above usually guarantees it (the acting admin is
    /// one), but two admins demoting each other at the same moment would otherwise leave none.
    /// </summary>
    public static string? LastAdminError(AppUser target, UserRole newRole, bool newIsActive, int otherActiveAdmins)
    {
        var removesAnAdmin = target is { Role: UserRole.Admin, IsActive: true }
            && (newRole != UserRole.Admin || !newIsActive);
        return removesAnAdmin && otherActiveAdmins == 0
            ? "There has to be at least one active admin. Make someone else an admin first."
            : null;
    }
}
