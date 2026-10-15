export type Mode = "ask" | "plan" | "agent";
export type Page = "chat" | "history" | "tasks" | "usage" | "settings" | "account" | "tools";
export type Model = { id: string; object?: string; owned_by?: string };
export type Project = { id: string; name: string; slug?: string; is_default?: boolean };
export type Account = { team: { id: string; name: string; slug: string } | null; project?: Project | null; wallet?: { currency: string; balance_paise: number } | null; api_key?: { id: string; name: string; status: string; allowed_models: string[] }; usage?: { requests: number; tokens: number; spend_paise: number }; recent_requests?: Array<{ id: string; model: string; tokens: number; cost_paise: number; status: string; created_at: string }> };
export type ChatMessage = { id: string; role: "user" | "assistant" | "error"; content: string; model?: string; createdAt: number };
export type BridgeState = { connected: boolean; connecting: boolean; loading: boolean; page: Page; mode: Mode; models: Model[]; project: Project | null; account: Account | null; messages: ChatMessage[]; historyCount: number; error: string | null; apiBaseUrl: string; settings: { autoApproveReads: boolean; autoApproveWrites: boolean; autoApproveTerminal: boolean } };
export type WebviewToHost =
  | { type: "ready" | "refresh" | "signIn" | "signOut" | "newChat" | "loadHistory" }
  | { type: "navigate"; page: Page }
  | { type: "setMode"; mode: Mode }
  | { type: "setProject"; projectId: string }
  | { type: "send"; prompt: string }
  | { type: "setSetting"; key: keyof BridgeState["settings"]; value: boolean };
export type HostToWebview = { type: "state"; state: BridgeState };

const modes = new Set<Mode>(["ask", "plan", "agent"]);
const pages = new Set<Page>(["chat", "history", "tasks", "usage", "settings", "account", "tools"]);
export function parseWebviewMessage(input: unknown): WebviewToHost | null {
  if (!input || typeof input !== "object" || typeof (input as { type?: unknown }).type !== "string") return null;
  const msg = input as Record<string, unknown>;
  if (["ready", "refresh", "signIn", "signOut", "newChat", "loadHistory"].includes(msg.type as string)) return { type: msg.type as WebviewToHost["type"] } as WebviewToHost;
  if (msg.type === "navigate" && pages.has(msg.page as Page)) return { type: "navigate", page: msg.page as Page };
  if (msg.type === "setMode" && modes.has(msg.mode as Mode)) return { type: "setMode", mode: msg.mode as Mode };
  if (msg.type === "setProject" && typeof msg.projectId === "string" && msg.projectId.length < 128) return { type: "setProject", projectId: msg.projectId };
  if (msg.type === "send" && typeof msg.prompt === "string" && msg.prompt.trim().length > 0 && msg.prompt.length <= 200000) return { type: "send", prompt: msg.prompt };
  if (msg.type === "setSetting" && typeof msg.key === "string" && ["autoApproveReads", "autoApproveWrites", "autoApproveTerminal"].includes(msg.key) && typeof msg.value === "boolean") return { type: "setSetting", key: msg.key as WebviewToHost & { key: never } extends never ? never : keyof BridgeState["settings"], value: msg.value } as WebviewToHost;
  return null;
}
