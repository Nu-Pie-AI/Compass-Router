export const API_BASE = process.env.NEXT_PUBLIC_COMPASS_API_URL ?? "http://localhost:28000";

export function formatPaise(value: number | undefined) {
  return `Rs ${((value ?? 0) / 100).toFixed(2)}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.detail?.error?.message ?? body?.detail ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}
