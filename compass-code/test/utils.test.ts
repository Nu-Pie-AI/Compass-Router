import path from "node:path";
import { describe, expect, it } from "vitest";

import { formatPaise, isPathInside, isSensitivePath, normalizeBaseUrl, parseJsonObject, shellCommandIsBlocked, truncate } from "../src/utils.js";
import { providerTools } from "../src/providers.js";

describe("Compass Code utilities", () => {
  it("normalizes API URLs without losing the host", () => {
    expect(normalizeBaseUrl("http://localhost:28000/v1/")).toBe("http://localhost:28000");
    expect(normalizeBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
  });

  it("blocks paths outside the workspace", () => {
    const root = path.resolve("workspace");
    expect(isPathInside(root, path.join(root, "src", "index.ts"))).toBe(true);
    expect(isPathInside(root, path.resolve(root, "..", "secret.env"))).toBe(false);
  });

  it("formats billing values and parses tool arguments", () => {
    expect(formatPaise(1234)).toBe("Rs 12.34");
    expect(parseJsonObject('{"path":"README.md"}')).toEqual({ path: "README.md" });
    expect(() => parseJsonObject("[]")).toThrow();
  });

  it("truncates oversized tool output", () => {
    expect(truncate("abc", 5)).toBe("abc");
    expect(truncate("abcdefgh", 5)).toContain("abcde");
  });

  it("protects secret paths and dangerous shell commands", () => {
    expect(isSensitivePath(".env.production")).toBe(true);
    expect(isSensitivePath("src/config.ts")).toBe(false);
    expect(shellCommandIsBlocked("git reset --hard HEAD")).toBe(true);
    expect(shellCommandIsBlocked("npm test")).toBe(false);
  });

  it("removes internal permission metadata from provider tool payloads", () => {
    const payload = providerTools([{ permission: "write", output: { type: "string" }, type: "function", function: { name: "write_file", description: "write", parameters: {} } }]);
    expect(payload).toEqual([{ type: "function", function: { name: "write_file", description: "write", parameters: {} } }]);
  });
});
