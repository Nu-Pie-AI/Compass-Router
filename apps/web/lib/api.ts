export const API_BASE = process.env.NEXT_PUBLIC_COMPASS_API_URL ?? "http://localhost:28000";

let clerkTokenProvider: (() => Promise<string | null>) | null = null;
let clerkSignOutProvider: (() => Promise<void>) | null = null;

export function registerClerkSessionProviders(
  tokenProvider: (() => Promise<string | null>) | null,
  signOutProvider: (() => Promise<void>) | null,
) {
  clerkTokenProvider = tokenProvider;
  clerkSignOutProvider = signOutProvider;
}

export function registerClerkTokenProvider(provider: (() => Promise<string | null>) | null) {
  clerkTokenProvider = provider;
  if (!provider) clerkSignOutProvider = null;
}

export async function signOutClerkSession() {
  if (clerkSignOutProvider) await clerkSignOutProvider();
}

export function formatPaise(value: number | undefined) {
  return `Rs ${((value ?? 0) / 100).toFixed(2)}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  const sessionToken = !path.startsWith("/v1/") && clerkTokenProvider ? await clerkTokenProvider() : token;
  if (sessionToken) headers.set("authorization", `Bearer ${sessionToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.detail?.error?.message ?? body?.detail ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}
