import { describe, expect, it } from "vitest";
import { parseWebviewMessage } from "../src/shared/contracts";
import { buildDeviceVerificationUrl, extensionDeviceStartPath, localApiBaseUrl, localVerificationUrl } from "../src/shared/endpoints";

describe("webview bridge validation", () => {
  it("accepts the typed navigation and chat commands", () => {
    expect(parseWebviewMessage({ type: "navigate", page: "usage" })).toEqual({ type: "navigate", page: "usage" });
    expect(parseWebviewMessage({ type: "send", prompt: "inspect this" })).toEqual({ type: "send", prompt: "inspect this" });
  });
  it("rejects unsafe or malformed messages", () => {
    expect(parseWebviewMessage({ type: "navigate", page: "../../secret" })).toBeNull();
    expect(parseWebviewMessage({ type: "send", prompt: "" })).toBeNull();
    expect(parseWebviewMessage({ type: "setSetting", key: "apiKey", value: true })).toBeNull();
  });
  it("keeps local device authorization on the registered API route", () => {
    expect(localApiBaseUrl).toBe("http://127.0.0.1:28000");
    expect(extensionDeviceStartPath).toBe("/auth/extension/device/start");
    expect(buildDeviceVerificationUrl(localVerificationUrl, "ABCD-1234")).toBe("http://localhost:23000/extension/authorize?user_code=ABCD-1234");
  });
});
