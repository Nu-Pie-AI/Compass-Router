import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextRoot = path.join(webRoot, ".next");
const standaloneRoot = path.join(nextRoot, "standalone");

await mkdir(path.join(standaloneRoot, ".next"), { recursive: true });
await cp(path.join(nextRoot, "static"), path.join(standaloneRoot, ".next", "static"), { recursive: true });

const publicRoot = path.join(webRoot, "public");
try {
  await cp(publicRoot, path.join(standaloneRoot, "public"), { recursive: true });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
