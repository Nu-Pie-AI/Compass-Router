import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
const state = {
  baseUrl: "https://example.com",
  provider: "compass",
  connected: true,
  connecting: false,
  busy: false,
  models: [{ id: "test-model", owned_by: "test" }],
  selectedModel: "test-model",
  mode: "ask",
  account: null,
  transcript: [
    {
      id: "tool",
      role: "tool",
      toolName: "read_file",
      content: "file content",
    },
  ],
  conversations: [{ id: "one", title: "Fix login", updatedAt: 1 }],
  activeConversationId: "one",
  permission: null,
  error: null,
  goal: null,
};
async function update(page: Page, patch = {}) {
  await page.evaluate(
    (s) => window.postMessage({ type: "state", state: s }, "*"),
    { ...state, ...patch },
  );
}
test.beforeEach(async ({ page }) => {
  await page.route("http://compass.test/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: '<div id="app"></div><link rel="stylesheet" href="/style.css"><script src="/main.js"></script>' });
      return;
    }
    const relative = pathname.slice(1);
    if (!["main.js", "style.css"].includes(relative) && !/^assets\/[\w-]+\.ttf$/.test(relative)) {
      await route.abort();
      return;
    }
    await route.fulfill({
      contentType: relative.endsWith(".css") ? "text/css" : relative.endsWith(".ttf") ? "font/ttf" : "application/javascript",
      body: await readFile(path.resolve("media", relative)),
    });
  });
  await page.addInitScript(() => {
    (window as any).messages = [];
    (window as any).acquireVsCodeApi = () => ({
      postMessage: (m: unknown) => (window as any).messages.push(m),
      getState: () => ({}),
      setState: () => {},
    });
  });
  await page.goto("http://compass.test/");
  await page.waitForFunction(() => (window as any).messages.some((m: any) => m.type === "ready"));
  await update(page);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("16px codicon"))).toBe(true);
});
test("draft, focus and expanded tool survive streaming updates and navigation", async ({
  page,
}) => {
  await page.getByText("read_file").click();
  await page
    .getByRole("textbox", { name: "Message Compass" })
    .fill("Keep this draft");
  await update(page, {
    busy: true,
    transcript: [
      ...state.transcript,
      { id: "reply", role: "assistant", content: "Streaming", streaming: true },
    ],
  });
  await expect(
    page.getByRole("textbox", { name: "Message Compass" }),
  ).toHaveValue("Keep this draft");
  await expect(
    page.getByRole("textbox", { name: "Message Compass" }),
  ).toBeFocused();
  await expect(page.locator("details.tool")).toHaveAttribute("open", "");
  await page.evaluate(() => window.postMessage({ type: "navigate", page: "settings" }, "*"));
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.evaluate(() => window.postMessage({ type: "navigate", page: "chat" }, "*"));
  await expect(
    page.getByRole("textbox", { name: "Message Compass" }),
  ).toHaveValue("Keep this draft");
  await page.getByRole("button", { name: "Stop task", exact: true }).click();
  expect(await page.evaluate(() => (window as any).messages)).toContainEqual({
    type: "stop",
  });
});
test("disconnected state uses the Compass Router onboarding flow", async ({ page }) => {
  await update(page, { connected: false, connecting: false, transcript: [] });
  await expect(page.getByRole("heading", { name: "Welcome to Compass Router" })).toBeVisible();
  await expect(page.getByText("Choose how you want to work")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect a workspace" })).toBeVisible();
  await page.screenshot({ path: "test-results/compass-welcome.png" });
  await page.getByRole("button", { name: "HIGH AUTONOMY" }).click();
  await expect(page.getByRole("button", { name: "HIGH AUTONOMY" })).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Connect a workspace" }).click();
  await expect(page.getByRole("heading", { name: "Connect a Compass workspace" })).toBeVisible();
  await page.screenshot({ path: "test-results/compass-onboarding.png" });
});
test("chat exposes task controls, slash commands, context chips, and transcript actions", async ({ page }) => {
  await update(page, {
    goal: {
      id: "goal-1",
      title: "Repair the login flow",
      status: "working",
      createdAt: 1,
      updatedAt: 1,
      startedAt: 1,
      elapsedMs: 100,
      followUpCount: 0,
      plan: [{ id: "plan", title: "Inspect the auth flow", status: "completed", updatedAt: 1 }],
      activity: [],
      changedFiles: [],
    },
  });
  await expect(page.locator(".chat-header").getByText("Repair the login flow")).toBeVisible();
  await expect(page.getByLabel("Task progress")).toBeVisible();
  await page.getByRole("button", { name: "Add context" }).click();
  await page.getByRole("button", { name: "@workspace", exact: true }).click();
  await expect(page.getByRole("button", { name: /@workspace/ })).toHaveCount(2);
  await page.getByRole("button", { name: "Show slash commands" }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.getByRole("button", { name: /\/mode code/ }).click();
  await expect(page.getByRole("textbox", { name: "Message Compass" })).toHaveValue("/mode code");
  await page.getByRole("button", { name: "Conversation options" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("button", { name: "Copy transcript" }).click();
  expect(await page.evaluate(() => (window as any).messages)).toContainEqual({ type: "copyTranscript" });
});
test("history uses inline rename and deletion confirmation", async ({
  page,
}) => {
  await page.evaluate(() => window.postMessage({ type: "navigate", page: "history" }, "*"));
  await page.getByRole("button", { name: "Rename conversation" }).click();
  await page
    .getByRole("textbox", { name: "Conversation name" })
    .fill("Login repaired");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect(await page.evaluate(() => (window as any).messages)).toContainEqual({
    type: "renameConversation",
    id: "one",
    title: "Login repaired",
  });
  await page.getByRole("button", { name: "Delete conversation" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(() =>
      (window as any).messages.some(
        (m: any) => m.type === "deleteConversation",
      ),
    ),
  ).toBe(false);
});
test("settings provides Kilo-style categories and model controls", async ({ page }) => {
  await page.evaluate(() => window.postMessage({ type: "navigate", page: "settings" }, "*"));
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Models", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agent Behaviour", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Models" })).toBeVisible();
  await page.getByRole("button", { name: "Providers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Providers" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Settings" }).getByText("Compass Router", { exact: true })).toBeVisible();
  await expect(page.getByText("Direct provider connections", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Configure", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Back to chat", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message Compass" })).toBeVisible();
});
test("account exposes login and logout actions", async ({ page }) => {
  await update(page, {
    account: {
      team: { id: "team", name: "Compass workspace", slug: "compass" },
      wallet: { currency: "INR", balance_paise: 1000 },
      api_key: { id: "key", name: "VS Code key", status: "active", allowed_models: ["test-model"] },
      usage: { requests: 2, tokens: 40, spend_paise: 10 },
      recent_requests: [],
      local_test_mode: false,
    },
  });
  await page.evaluate(() => window.postMessage({ type: "navigate", page: "account" }, "*"));
  await expect(page.getByText("Workspace connected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out on this device", exact: true }).click();
  expect(await page.evaluate(() => (window as any).messages)).toContainEqual({ type: "disconnect" });
  await update(page, { connected: false, account: null });
  await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
  expect(await page.evaluate(() => (window as any).messages)).toContainEqual({ type: "login" });
});
test("approval carries the request ID and prevents duplicate decisions", async ({
  page,
}) => {
  await update(page, {
    busy: true,
    permission: {
      id: "approval-one",
      toolName: "write_file",
      kind: "write",
      summary: "Write index.ts",
      arguments: {},
      decisions: ["once", "deny"],
    },
  });
  await page.getByRole("button", { name: "Allow once", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Allow once", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => (window as any).messages)).toContainEqual({
    type: "permission",
    id: "approval-one",
    decision: "once",
  });
});
test("markdown is sanitized and file actions retain their payload", async ({
  page,
}) => {
  await update(page, {
    transcript: [
      {
        id: "reply",
        role: "assistant",
        content:
          '<img src=x onerror="window.pwned=true">\n\n```ts path=src/a.ts\nconst n = 1;\n```',
      },
    ],
  });
  await page
    .getByRole("button", { name: "Apply to file", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).messages)).toContainEqual({
    type: "applyCode",
    path: "src/a.ts",
    content: "const n = 1;",
  });
  expect(await page.evaluate(() => (window as any).pwned)).toBeUndefined();
});
for (const width of [300, 420, 1000]) {
  test(`layout remains within ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await update(page, { transcript: [] });
    await expect(
      page.getByRole("heading", { name: "What are we building?" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/compass-dark-${width}.png` });
    await page.addStyleTag({
      content:
        ":root { --vscode-foreground:#202020; --vscode-sideBar-background:#fff; --vscode-input-background:#fff; --vscode-input-foreground:#202020; --vscode-button-secondaryBackground:#eee; --vscode-descriptionForeground:#555; --vscode-list-activeSelectionBackground:#d7eedb; --vscode-list-activeSelectionForeground:#202020; color-scheme:light; }",
    });
    await page.evaluate(() => window.postMessage({ type: "navigate", page: "settings" }, "*"));
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/compass-light-${width}.png` });
  });
}
