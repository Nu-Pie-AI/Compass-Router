import path from "node:path";
import { describe, expect, it } from "vitest";

import { formatPaise, isPathInside, normalizeBaseUrl, parseJsonObject, truncate } from "../src/utils.js";

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
});
