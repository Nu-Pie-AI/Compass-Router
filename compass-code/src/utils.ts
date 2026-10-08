import path from "node:path";

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed.slice(0, -3) : trimmed;
}

export function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function isSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/").toLocaleLowerCase();
  const name = normalized.split("/").at(-1) ?? normalized;
  return name === ".env" || name.startsWith(".env.") || name === ".npmrc" || name === ".pypirc" ||
    name.includes("credentials") || name.includes("secret") || name.endsWith(".pem") || name.endsWith(".key") ||
    name === "id_rsa" || normalized.includes("/.ssh/") || normalized.includes("/.git/");
}

export function looksBinary(value: Uint8Array): boolean {
  const sample = value.subarray(0, Math.min(value.length, 4096));
  return sample.includes(0);
}

export function shellCommandIsBlocked(command: string): boolean {
  return /(^|\s)(rm\s+-rf|del\s+\/s|format\s+|shutdown\b|poweroff\b|git\s+reset\s+--hard|git\s+clean\s+-fd|remove-item\b)/i.test(command);
}

export function formatPaise(value: number | undefined | null): string {
  return `Rs ${((value ?? 0) / 100).toFixed(2)}`;
}

export function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // The caller reports a tool-specific error with the original model output omitted.
  }
  throw new Error("The model returned invalid tool arguments.");
}

export function truncate(value: string, maxLength = 40_000): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[Output truncated by Compass Router]`;
}

export function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
