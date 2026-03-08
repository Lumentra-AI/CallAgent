const SAFE_REDIRECT_ORIGIN = "https://app.lumentra.local";
const DEFAULT_REDIRECT_PATH = "/setup";

export function getSafeRedirectPath(
  next: string | null,
  fallback: string = DEFAULT_REDIRECT_PATH,
): string {
  if (!next) {
    return fallback;
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  if (next.includes("://") || next.includes("\\")) {
    return fallback;
  }

  if (/[\u0000-\u001F\u007F]/.test(next)) {
    return fallback;
  }

  try {
    const parsed = new URL(next, SAFE_REDIRECT_ORIGIN);
    if (parsed.origin !== SAFE_REDIRECT_ORIGIN) {
      return fallback;
    }

    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!normalized.startsWith("/") || normalized.startsWith("//")) {
      return fallback;
    }

    return normalized;
  } catch {
    return fallback;
  }
}
