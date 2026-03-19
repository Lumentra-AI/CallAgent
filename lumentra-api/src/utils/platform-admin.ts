import { queryOne } from "../services/database/client.js";

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

/**
 * Check if email is a platform admin.
 * Sources (in order): env var PLATFORM_ADMIN_EMAILS, then platform_admins table.
 * Env var acts as bootstrap/fallback.
 */
export async function isPlatformAdminEmail(
  email: string | null | undefined,
  rawValue = process.env.PLATFORM_ADMIN_EMAILS,
): Promise<boolean> {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();

  // Check env var first (bootstrap/fallback)
  if (parsePlatformAdminEmails(rawValue).has(normalized)) {
    return true;
  }

  // Check database
  try {
    const row = await queryOne<{ id: string }>(
      `SELECT id FROM platform_admins WHERE email = $1`,
      [normalized],
    );
    return !!row;
  } catch {
    // DB error - fall back to env var only (already checked above)
    return false;
  }
}
