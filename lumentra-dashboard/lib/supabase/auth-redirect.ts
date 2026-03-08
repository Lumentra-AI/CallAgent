export function buildAuthCallbackUrl(
  origin: string,
  nextPath: string = "/setup",
): string {
  const configuredRedirect = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL?.trim();
  const callbackUrl = new URL(configuredRedirect || "/auth/callback", origin);

  callbackUrl.searchParams.set("next", nextPath);

  return callbackUrl.toString();
}
