const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/setup",
  "/settings",
  "/calls",
  "/analytics",
  "/contacts",
  "/calendar",
  "/notifications",
  "/resources",
];

const AUTH_ROUTE_PATHS = new Set(["/login", "/signup"]);

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
  const { hasMembership, isSetupComplete } = params;
  return hasMembership && isSetupComplete ? "/dashboard" : "/setup";
}
