import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(process.cwd(), "..", ".."));

export const clerkPublishableKey = process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] ?? "";
export const legacyAuthMode = process.env["LEGACY_AUTH_MODE"] === "true";
