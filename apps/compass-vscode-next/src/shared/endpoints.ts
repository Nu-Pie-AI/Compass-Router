export const extensionDeviceStartPath = "/auth/extension/device/start";
export const extensionDevicePollPath = "/auth/extension/device/poll";
export const localApiBaseUrl = "http://127.0.0.1:28000";
export const localVerificationUrl = "http://localhost:23000/extension/authorize";

export function buildDeviceVerificationUrl(baseUrl: string, userCode: string): string {
  const normalized = baseUrl.trim().replace(/\/$/, "");
  if (!/^https?:\/\/[^\s/]+(?::\d+)?(?:\/[^\s]*)?$/.test(normalized)) throw new Error("Invalid Compass verification URL.");
  return `${normalized}?user_code=${encodeURIComponent(userCode)}`;
}
