/**
 * Get the base URL for API calls
 * Works in both server and client environments
 */
export function getBaseUrl() {
  // Browser should use relative path
  if (typeof window !== "undefined") {
    return "";
  }

  // SSR should use configured URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Cloud Run: Construct URL from service name
  if (process.env.K_SERVICE) {
    // Default Cloud Run URL pattern: https://SERVICE-PROJECT.REGION.run.app
    // But we'll use our custom domain once NEXT_PUBLIC_APP_URL is set
    console.warn("NEXT_PUBLIC_APP_URL not set, using placeholder");
    return "https://compass.nu-pie.ai";
  }

  // Fallback to localhost for local development
  return "http://localhost:3000";
}

/**
 * Construct full API URL
 */
export function getApiUrl(path: string) {
  const baseUrl = getBaseUrl();
  // Remove leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${baseUrl}/${cleanPath}`;
}
