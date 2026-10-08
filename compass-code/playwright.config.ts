import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test-ui",
  use: { browserName: "chromium", headless: true },
  workers: 1,
});
