import * as vscode from "vscode";
import { parseWebviewMessage, type Account, type BridgeState, type HostToWebview, type Model, type Page, type Project, type WebviewToHost } from "./shared/contracts.js";
import { buildDeviceVerificationUrl, extensionDevicePollPath, extensionDeviceStartPath, localApiBaseUrl, localVerificationUrl } from "./shared/endpoints.js";

const secretKey = "compassRouterNext.deviceToken";
const defaultUrl = localApiBaseUrl;

class CompassApi {
  constructor(private readonly context: vscode.ExtensionContext) {}
  get baseUrl(): string { return vscode.workspace.getConfiguration("compassRouterNext").get("apiBaseUrl", defaultUrl).replace(/\/$/, ""); }
  async hasToken(): Promise<boolean> { return Boolean(await this.context.secrets.get(secretKey)); }
  async publicPost<T>(path: string, body: unknown): Promise<T> { return this.fetchJson<T>(path, { method: "POST", body: JSON.stringify(body), public: true }); }
  async get<T>(path: string): Promise<T> { return this.fetchJson<T>(path, {}); }
  async post<T>(path: string, body: unknown): Promise<T> { return this.fetchJson<T>(path, { method: "POST", body: JSON.stringify(body) }); }
  async signOut(): Promise<void> { try { await this.post("/auth/extension/session/revoke", {}); } catch { /* local sign-out remains available offline */ } await this.context.secrets.delete(secretKey); }
  async saveToken(token: string): Promise<void> { await this.context.secrets.store(secretKey, token); }
  private async fetchJson<T>(path: string, init: { method?: string; body?: string; public?: boolean }): Promise<T> {
    const token = init.public ? undefined : await this.context.secrets.get(secretKey);
    if (!init.public && !token) throw new Error("Sign in to Compass Router before using the workspace assistant.");
    const response = await fetch(`${this.baseUrl}${path}`, { method: init.method ?? "GET", body: init.body, signal: AbortSignal.timeout(45000), headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(vscode.workspace.getConfiguration("compassRouterNext").get<string>("projectId", "") ? { "X-Compass-Project-Id": vscode.workspace.getConfiguration("compassRouterNext").get<string>("projectId", "") } : {}) } });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error("Compass rejected this session. Sign in again or select an authorized project.");
      if (response.status === 429) throw new Error("Compass rate limit reached. Retry shortly.");
      if (response.status === 402) {
        let code = "";
        try { const body = await response.json() as { error?: { code?: string } }; code = body.error?.code ?? ""; } catch { /* preserve generic status when the server body is not JSON */ }
        if (code === "insufficient_balance") throw new Error("Insufficient organization Credits for this request. Contact your Company Admin or select another authorized model.");
        throw new Error("Compass could not authorize this paid request. Check the selected model and organization billing status.");
      }
      throw new Error(`Compass request failed (HTTP ${response.status}).`);
    }
    return response.json() as Promise<T>;
  }
}

class CompassView implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private state: BridgeState;
  private readonly api: CompassApi;
  constructor(private readonly context: vscode.ExtensionContext) {
    this.api = new CompassApi(context);
    const config = vscode.workspace.getConfiguration("compassRouterNext");
    this.state = { connected: false, connecting: false, loading: false, page: "chat", mode: config.get("defaultMode", "ask"), models: [], selectedModel: "", projects: [], project: null, account: null, messages: [], historyCount: context.workspaceState.get("compassRouterNext.historyCount", 0), error: null, apiBaseUrl: this.api.baseUrl, settings: { autoApproveReads: config.get("autoApproveReads", true), autoApproveWrites: config.get("autoApproveWrites", false), autoApproveTerminal: config.get("autoApproveTerminal", false) } };
  }
  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")] };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((raw) => { const msg = parseWebviewMessage(raw); if (msg) void this.handle(msg); });
    void this.refresh();
  }
  private post(): void { if (this.view) this.view.webview.postMessage({ type: "state", state: this.state } satisfies HostToWebview); }
  private async handle(msg: WebviewToHost): Promise<void> {
    try {
      if (msg.type === "ready" || msg.type === "refresh") await this.refresh();
      else if (msg.type === "signIn") await this.signIn();
      else if (msg.type === "signOut") { await this.api.signOut(); this.state.connected = false; this.state.account = null; this.state.models = []; this.state.project = null; this.post(); }
      else if (msg.type === "navigate") { this.state.page = msg.page; this.post(); if (msg.page === "usage" || msg.page === "account") await this.refresh(); }
      else if (msg.type === "setMode") { this.state.mode = msg.mode; this.post(); }
      else if (msg.type === "setModel") { if (this.state.models.some((model) => model.id === msg.modelId)) { this.state.selectedModel = msg.modelId; await vscode.workspace.getConfiguration("compassRouterNext").update("modelId", msg.modelId, vscode.ConfigurationTarget.Workspace); this.post(); } }
      else if (msg.type === "setProject") { await vscode.workspace.getConfiguration("compassRouterNext").update("projectId", msg.projectId, vscode.ConfigurationTarget.Workspace); await this.refresh(); }
      else if (msg.type === "newChat") { this.state.messages = []; this.state.page = "chat"; this.post(); }
      else if (msg.type === "loadHistory") { this.state.page = "history"; this.post(); }
      else if (msg.type === "setSetting") { await vscode.workspace.getConfiguration("compassRouterNext").update(msg.key, msg.value, vscode.ConfigurationTarget.Global); this.state.settings[msg.key] = msg.value; this.post(); }
      else if (msg.type === "send") await this.send(msg.prompt);
    } catch (error) { this.state.error = error instanceof Error ? error.message : "Compass request failed."; this.state.loading = false; this.state.connecting = false; this.post(); }
  }
  private async signIn(): Promise<void> {
    this.state.connecting = true; this.state.error = null; this.post();
    const authorization = await this.api.publicPost<{ device_code: string; user_code: string; verification_uri: string; expires_at: string; interval: number }>(extensionDeviceStartPath, { device_name: "Compass Router Next" });
    const configuredVerificationUrl = vscode.workspace.getConfiguration("compassRouterNext").get<string>("verificationUrl", localVerificationUrl).trim().replace(/\/$/, "");
    const verificationUrl = configuredVerificationUrl || authorization.verification_uri;
    await vscode.env.openExternal(vscode.Uri.parse(buildDeviceVerificationUrl(verificationUrl, authorization.user_code)));
    vscode.window.showInformationMessage(`Approve Compass Router in your browser with code ${authorization.user_code}.`);
    while (Date.now() < Date.parse(authorization.expires_at)) { const result = await this.api.publicPost<{ status: string; access_token?: string; project_id?: string }>(extensionDevicePollPath, { device_code: authorization.device_code }); if (result.status === "authorized" && result.access_token) { await this.api.saveToken(result.access_token); await this.refresh(); return; } if (["expired", "cancelled"].includes(result.status)) throw new Error("Compass browser authorization expired or was cancelled."); await new Promise((resolve) => setTimeout(resolve, Math.max(2000, authorization.interval * 1000))); }
    throw new Error("Compass browser authorization expired before it was approved.");
  }
  private async refresh(): Promise<void> {
    this.state.loading = true; this.state.error = null; this.post();
    if (!(await this.api.hasToken())) { this.state.connected = false; this.state.loading = false; this.post(); return; }
    const [models, account, projects] = await Promise.all([this.api.get<{ data: Model[] }>("/v1/models"), this.api.get<Account>("/v1/account"), this.api.get<Project[]>("/projects")]);
    const configuredModel = vscode.workspace.getConfiguration("compassRouterNext").get<string>("modelId", "");
    const selectedModel = (models.data ?? []).some((model) => model.id === configuredModel) ? configuredModel : models.data?.[0]?.id ?? "";
    const configuredProject = vscode.workspace.getConfiguration("compassRouterNext").get<string>("projectId", "");
    this.state.connected = true; this.state.models = models.data ?? []; this.state.selectedModel = selectedModel; this.state.projects = projects; this.state.account = account; this.state.project = projects.find((project) => project.id === configuredProject) ?? account.project ?? projects.find((project) => project.is_default) ?? null; this.state.loading = false; this.post();
  }
  private async send(prompt: string): Promise<void> {
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, content: prompt.trim(), createdAt: Date.now() }; this.state.messages = [...this.state.messages, userMessage]; this.state.loading = true; this.state.error = null; this.post();
    const model = this.state.selectedModel; if (!model) throw new Error("No Compass model is authorized for this device project.");
    const response = await this.api.post<{ choices?: Array<{ message?: { content?: unknown } }> }>("/v1/chat/completions", { model, messages: this.state.messages.map((item) => ({ role: item.role, content: item.content })), stream: false, temperature: 0.2, max_tokens: 4096 });
    const content = response.choices?.[0]?.message?.content; if (typeof content !== "string" || !content.trim()) throw new Error("Compass returned no assistant response.");
    this.state.messages = [...this.state.messages, { id: crypto.randomUUID(), role: "assistant", content, model, createdAt: Date.now() }]; this.state.loading = false; this.state.historyCount += 1; await this.context.workspaceState.update("compassRouterNext.historyCount", this.state.historyCount); this.post();
  }
  private html(webview: vscode.Webview): string { const nonce = crypto.randomUUID().replaceAll("-", ""); const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "main.js")); const css = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "main.css")); return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${css}"></head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`; }
}

export function activate(context: vscode.ExtensionContext): void { const provider = new CompassView(context); context.subscriptions.push(vscode.window.registerWebviewViewProvider("compassRouterNext.chat", provider), vscode.commands.registerCommand("compassRouterNext.open", () => vscode.commands.executeCommand("workbench.view.extension.compassRouterNext"))); }
