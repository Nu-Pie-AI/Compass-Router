export function getSafeAuthCallback(value: string | null | undefined, fallback = "/") {
  if (!value) return fallback;

  try {
    const parsed = new URL(value, "http://compass.local");
    if (parsed.origin !== "http://compass.local" || !parsed.pathname.startsWith("/")) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
