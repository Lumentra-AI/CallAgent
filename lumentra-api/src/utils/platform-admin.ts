export function parsePlatformAdminEmails(
  rawValue: string | undefined,
): Set<string> {
  return new Set(
    (rawValue || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdminEmail(
  email: string | null | undefined,
  rawValue = process.env.PLATFORM_ADMIN_EMAILS,
): boolean {
  if (!email) {
    return false;
  }

  return parsePlatformAdminEmails(rawValue).has(email.trim().toLowerCase());
}
