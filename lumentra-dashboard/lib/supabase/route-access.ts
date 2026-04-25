const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/setup",
  "/settings",
  "/calls",
  "/chats",
  "/calendar",
  "/contacts",
  "/profile",
  "/admin",
];

const AUTH_ROUTE_PATHS = new Set(["/login", "/signup"]);

// Routes accessible to normal (non-admin) authenticated users
const ALLOWED_DASHBOARD_PREFIXES = [
  "/dashboard",
  "/calls",
  "/chats",
  "/calendar",
  "/contacts",
  "/settings",
  "/profile",
  "/admin",
];

// Settings sub-routes accessible to normal users
const ALLOWED_SETTINGS_PATHS = new Set([
  "/settings",
  "/settings/hours",
  "/settings/escalation",
  "/settings/team",
  "/settings/chatbot",
  "/settings/integrations",
]);

/**
 * Check if an email is a platform admin via the env var bootstrap list.
 * This is used in middleware (edge runtime) where DB access is unavailable.
 * The env var is always set for the primary admin.
 */
export function isPlatformAdminByEnv(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(normalized);
}

/**
 * Check if a protected route is blocked for normal users.
 * Returns the redirect target if blocked, or null if allowed.
 */
export function getBlockedRouteRedirect(pathname: string): string | null {
  // Admin routes pass through middleware -- access control is enforced by
  // the admin layout which calls /api/admin/me (checks both env var AND
  // platform_admins table). Middleware can't query the DB in edge runtime.
  if (pathname.startsWith("/admin")) return null;
  // Setup routes pass through (checked by setup flow)
  if (pathname.startsWith("/setup")) return null;

  // Settings sub-routes: check allowlist
  if (pathname.startsWith("/settings/")) {
    return ALLOWED_SETTINGS_PATHS.has(pathname) ? null : "/settings";
  }

  // Top-level routes: check allowlist
  const topPath = "/" + (pathname.split("/")[1] || "");
  if (topPath === "/settings") return null;

  if (
    !ALLOWED_DASHBOARD_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    )
  ) {
    return "/dashboard";
  }

  return null;
}

function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedRoutePath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    matchesRoutePrefix(pathname, prefix),
  );
}

export function isSetupRoutePath(pathname: string): boolean {
  return matchesRoutePrefix(pathname, "/setup");
}

export function isAuthRoutePath(pathname: string): boolean {
  return AUTH_ROUTE_PATHS.has(pathname);
}

export function isVerifyEmailPath(pathname: string): boolean {
  return pathname === "/verify-email";
}

export function isUnverifiedAllowedPath(pathname: string): boolean {
  return isVerifyEmailPath(pathname) || matchesRoutePrefix(pathname, "/auth");
}

export function shouldRedirectUnverifiedUser(pathname: string): boolean {
  if (isUnverifiedAllowedPath(pathname)) {
    return false;
  }

  return isProtectedRoutePath(pathname) || isAuthRoutePath(pathname);
}

export function getAuthenticatedRedirectPath(params: {
  hasMembership: boolean;
  isSetupComplete: boolean;
}): string {
  const { hasMembership } = params;
  return hasMembership ? "/dashboard" : "/setup";
}
