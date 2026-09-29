import * as vscode from "vscode";

import { CompassAgent } from "./agent.js";
import { CompassClient } from "./client.js";
import { CheckpointManager } from "./checkpoints.js";
import { ToolExecutor } from "./tools.js";
import type { AccountSummary, AgentMode, CompassModel, PermissionRequest, TranscriptItem, WorkStyle } from "./types.js";

type ViewState = {
  baseUrl: string;
  connected: boolean;
  connecting: boolean;
  busy: boolean;
  models: CompassModel[];
  selectedModel: string;
  mode: AgentMode;
  account: AccountSummary | null;
  transcript: TranscriptItem[];
  permission: PermissionRequest | null;
  error: string | null;
};

type ViewMessage =
  | { type: "ready" }
  | { type: "connect"; baseUrl: string; apiKey: string; workStyle: WorkStyle }
  | { type: "disconnect" }
  | { type: "send"; prompt: string; model: string; mode: AgentMode; includeSelection: boolean }
  | { type: "stop" }
  | { type: "newTask" }
  | { type: "refresh" }
  | { type: "openSettings" }
  | { type: "setMode"; mode: AgentMode }
  | { type: "setModel"; model: string }
  | { type: "permission"; id: string; approved: boolean }
  | { type: "restoreCheckpoint" };

class CompassViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private readonly client: CompassClient;
  private readonly checkpoints: CheckpointManager;
  private readonly tools: ToolExecutor;
  private agent: CompassAgent | undefined;
  private permissionResolver: ((approved: boolean) => void) | undefined;
  private state: ViewState = {
    baseUrl: "https://compass-router-api-567790052414.us-central1.run.app",
    connected: false,
    connecting: false,
    busy: false,
    models: [],
    selectedModel: "",
    mode: "ask",
    account: null,
    transcript: [],
    permission: null,
    error: null
  };

  constructor(private readonly context: vscode.ExtensionContext) {
    this.client = new CompassClient(context);
    this.state.baseUrl = this.client.baseUrl;
    this.checkpoints = new CheckpointManager(context);
    this.tools = new ToolExecutor(this.checkpoints);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")]
    };
    webviewView.webview.html = this.html(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: ViewMessage) => void this.handleMessage(message));
    void this.refresh();
  }

  async connect(): Promise<void> {
    if (!this.view) {
      await vscode.commands.executeCommand("workbench.view.extension.compassCode");
      return;
    }
    const baseUrl = await vscode.window.showInputBox({
      title: "Compass API URL",
      value: this.client.baseUrl,
      prompt: "Use the API base URL without /v1."
    });
    if (baseUrl === undefined) return;
    const apiKey = await vscode.window.showInputBox({
      title: "Compass API key",
      password: true,
      prompt: "Stored in VS Code SecretStorage; it is never written to workspace files."
    });
    if (!apiKey) return;
    await this.finishConnect(baseUrl, apiKey);
  }

  async chooseModel(): Promise<void> {
    if (!this.state.models.length) {
      await this.refresh();
    }
    const picked = await vscode.window.showQuickPick(
      this.state.models.map((model) => ({ label: model.id, description: model.owned_by, model })),
      { title: "Choose a Compass model", matchOnDescription: true }
    );
    if (picked) {
      this.state.selectedModel = picked.model.id;
      this.postState();
    }
  }

  async newTask(): Promise<void> {
    this.agent?.newTask();
    this.state.transcript = [];
    this.state.permission = null;
    this.state.error = null;
    this.postState();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    this.state = {
      ...this.state,
      connected: false,
      connecting: false,
      models: [],
      selectedModel: "",
      account: null,
      transcript: [],
      permission: null,
      error: null
    };
    this.postState();
  }

  async restoreCheckpoint(): Promise<void> {
    const restored = await this.checkpoints.restoreLatest();
    if (restored) {
      this.append({ id: `status-${Date.now()}`, role: "status", content: `Restored checkpoint ${restored}.` });
    } else {
      vscode.window.showInformationMessage("Compass Code has no checkpoint to restore yet.");
    }
  }

  private async handleMessage(message: ViewMessage): Promise<void> {
    try {
      switch (message.type) {
        case "ready":
          await this.refresh();
          break;
        case "connect":
          await this.finishConnect(message.baseUrl, message.apiKey, message.workStyle);
          break;
        case "disconnect":
          await this.disconnect();
          break;
        case "send":
          if (!this.agent) throw new Error("Connect a Compass API key first.");
          this.state.mode = message.mode;
          this.state.selectedModel = message.model;
          this.state.error = null;
          this.postState();
          await this.agent.send(message.prompt, message.model, message.mode, message.includeSelection);
          break;
        case "stop":
          this.agent?.stop();
          break;
        case "newTask":
          await this.newTask();
          break;
        case "refresh":
          await this.refresh();
          break;
        case "openSettings":
          await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:toheedsoudagar.compass-code");
          break;
        case "setMode":
          this.state.mode = message.mode;
          this.postState();
          break;
        case "setModel":
          this.state.selectedModel = message.model;
          this.postState();
          break;
        case "permission":
          if (this.state.permission?.id === message.id && this.permissionResolver) {
            const resolve = this.permissionResolver;
            this.permissionResolver = undefined;
            this.state.permission = null;
            resolve(message.approved);
            this.postState();
          }
          break;
        case "restoreCheckpoint":
          await this.restoreCheckpoint();
          break;
      }
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : "Compass Code failed.";
      this.state.connecting = false;
      this.postState();
    }
  }

  private async finishConnect(baseUrl: string, apiKey: string, workStyle: WorkStyle = "review"): Promise<void> {
    this.state.connecting = true;
    this.state.error = null;
    this.postState();
    try {
      await this.client.saveConnection(baseUrl, apiKey);
      this.state.baseUrl = this.client.baseUrl;
      const config = vscode.workspace.getConfiguration("compassCode");
      await config.update("autoApproveWrites", workStyle === "autonomous", vscode.ConfigurationTarget.Global);
      await config.update("autoApproveTerminal", workStyle === "autonomous", vscode.ConfigurationTarget.Global);
      const models = await this.client.models();
      if (!models.length) throw new Error("This Compass key has no allowed models.");
      this.state.models = models;
      this.state.selectedModel = this.state.selectedModel && models.some((model) => model.id === this.state.selectedModel)
        ? this.state.selectedModel
        : models[0].id;
      this.state.connected = true;
      this.state.account = await this.client.account();
      this.ensureAgent();
      this.append({ id: `status-${Date.now()}`, role: "status", content: `Connected to Compass. ${models.length} allowed model${models.length === 1 ? "" : "s"}.` });
    } catch (error) {
      await this.client.disconnect();
      throw error;
    } finally {
      this.state.connecting = false;
      this.postState();
    }
  }

  private async refresh(): Promise<void> {
    if (!(await this.client.hasCredential())) {
      this.state.connected = false;
      this.postState();
      return;
    }
    this.state.connecting = true;
    this.state.error = null;
    this.postState();
    try {
      this.state.baseUrl = this.client.baseUrl;
      const models = await this.client.models();
      this.state.models = models;
      this.state.selectedModel = this.state.selectedModel && models.some((model) => model.id === this.state.selectedModel)
        ? this.state.selectedModel
        : models[0]?.id ?? "";
      this.state.account = await this.client.account();
      this.state.connected = true;
      this.ensureAgent();
    } catch (error) {
      this.state.connected = false;
      this.state.error = error instanceof Error ? error.message : "Could not refresh Compass.";
    } finally {
      this.state.connecting = false;
      this.postState();
    }
  }

  private ensureAgent(): void {
    if (this.agent) return;
    this.agent = new CompassAgent(this.client, this.tools, {
      append: (item) => this.append(item),
      setBusy: (busy) => {
        this.state.busy = busy;
        this.postState();
      },
      requestPermission: (request) => this.requestPermission(request),
      refreshAccount: async () => {
        try {
          this.state.account = await this.client.account();
          this.postState();
        } catch {
          // Preserve the completed response even if the account refresh is unavailable.
        }
      }
    });
  }

  private requestPermission(request: PermissionRequest): Promise<boolean> {
    this.state.permission = request;
    this.postState();
    return new Promise<boolean>((resolve) => {
      this.permissionResolver = resolve;
    });
  }

  private append(item: TranscriptItem): void {
    this.state.transcript = [...this.state.transcript, item].slice(-80);
    this.postState();
  }

  private postState(): void {
    void this.view?.webview.postMessage({ type: "state", state: this.state });
  }

  private html(webview: vscode.Webview): string {
    const nonce = [...Array(32)].map(() => Math.random().toString(36)[2]).join("");
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "main.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "style.css"));
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${style}" />
  <title>Compass Code</title>
</head>
<body>
  <main id="app" data-nonce="${nonce}"></main>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new CompassViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("compassCode.chat", provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand("compassCode.openAgent", () => vscode.commands.executeCommand("workbench.view.extension.compassCode")),
    vscode.commands.registerCommand("compassCode.connect", () => provider.connect()),
    vscode.commands.registerCommand("compassCode.disconnect", () => provider.disconnect()),
    vscode.commands.registerCommand("compassCode.newTask", () => provider.newTask()),
    vscode.commands.registerCommand("compassCode.chooseModel", () => provider.chooseModel()),
    vscode.commands.registerCommand("compassCode.restoreCheckpoint", () => provider.restoreCheckpoint())
  );
}

export function deactivate(): void {
  // The agent aborts in response to the view's stop/new-task actions.
}
