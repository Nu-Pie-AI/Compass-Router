import * as vscode from "vscode";

import { CompassAgent } from "./agent.js";
import { CompassClient } from "./client.js";
import { CheckpointManager } from "./checkpoints.js";
import { ContextManager } from "./context.js";
import { DiffReviewManager } from "./diffs.js";
import type { ModelProvider } from "./providers.js";
import { ToolExecutor } from "./tools.js";
import { randomId } from "./utils.js";
import type { AccountSummary, AgentGoal, AgentMode, CompassModel, ConversationSummary, GoalActivity, GoalFileChange, GoalStatus, GoalStepStatus, PermissionDecision, PermissionRequest, ProviderKind, TranscriptItem, WorkStyle } from "./types.js";

type SavedConversation = ConversationSummary & { transcript: TranscriptItem[] };

import type { ViewMessage, ViewState } from "./protocol.js";

class CompassViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private readonly client: CompassClient;
  private readonly checkpoints: CheckpointManager;
  private readonly reviews: DiffReviewManager;
  private readonly tools: ToolExecutor;
  private readonly contextManager: ContextManager;
  private modelProvider: ModelProvider;
  private agent: CompassAgent | undefined;
  private permissionResolver: ((decision: PermissionDecision) => void) | undefined;
  private conversations: SavedConversation[];
  private activeConversationId: string | null = null;
  private sessionWriteAllowed = false;
  private sessionWriteDenied = false;
  private state: ViewState = {
    baseUrl: "https://compass-router-api-c4psf2dvua-uc.a.run.app",
    provider: "compass",
    connected: false,
    connecting: false,
    busy: false,
    models: [],
    selectedModel: "",
    mode: "ask",
    account: null,
    projectId: null,
    projectName: null,
    projectIsDefault: false,
    transcript: [],
    conversations: [],
    activeConversationId: null,
    permission: null,
    error: null,
    goal: null
  };

  constructor(private readonly context: vscode.ExtensionContext) {
    this.client = new CompassClient(context);
    this.state.baseUrl = this.client.baseUrl;
    this.state.provider = vscode.workspace.getConfiguration("compassCode").get<ProviderKind>("provider", "compass");
    this.conversations = context.workspaceState.get<SavedConversation[]>("compassCode.conversations", []) ?? [];
    this.state.conversations = this.summaries();
    this.checkpoints = new CheckpointManager(context);
    this.reviews = new DiffReviewManager(context);
    this.tools = new ToolExecutor(this.checkpoints, this.reviews);
    this.contextManager = new ContextManager(() => this.tools.recentTerminalContext(), () => this.tools.gitContext());
    this.modelProvider = this.client;
    this.sessionWriteDenied = false;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")]
    };
    webviewView.webview.html = this.html(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: ViewMessage) => void this.handleMessage(message));
    this.postState();
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
    await this.authorizeDevice(baseUrl);
  }

  private async authorizeDevice(baseUrl: string): Promise<void> {
    this.state.connecting = true;
    this.state.error = null;
    this.postState();
    try {
      await this.client.setBaseUrl(baseUrl);
      const authorization = await this.client.startDeviceAuthorization("VS Code");
      const verificationUri = `${authorization.verification_uri}?user_code=${encodeURIComponent(authorization.user_code)}`;
      await vscode.env.openExternal(vscode.Uri.parse(verificationUri));
      vscode.window.showInformationMessage(`Authorize Compass Router in your browser using code ${authorization.user_code}.`);
      const deadline = Date.parse(authorization.expires_at);
      while (Date.now() < deadline) {
        const result = await this.client.pollDeviceAuthorization(authorization.device_code);
        if (result.status === "authorized" && result.access_token) {
          if (result.project_id) await vscode.workspace.getConfiguration("compassCode").update("projectId", result.project_id, vscode.ConfigurationTarget.Workspace);
          await this.finishConnect(baseUrl, result.access_token);
          return;
        }
        if (result.status === "expired" || result.status === "cancelled") throw new Error("The Compass Router device authorization expired or was cancelled.");
        await new Promise((resolve) => setTimeout(resolve, Math.max(2000, authorization.interval * 1000)));
      }
      throw new Error("The Compass Router device authorization expired before it was approved.");
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : "Could not authorize this VS Code device.";
      throw error;
    } finally {
      this.state.connecting = false;
      this.postState();
    }
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

  async chooseProject(): Promise<void> {
    if (!(await this.client.hasCredential())) {
      await this.connect();
      return;
    }
    const projects = await this.client.projects();
    const picked = await vscode.window.showQuickPick(
      projects.map((project) => ({ label: project.name, description: project.is_default ? "Default project" : project.slug, project })),
      { title: "Choose a Compass project" },
    );
    if (picked) {
      await vscode.workspace.getConfiguration("compassCode").update("projectId", picked.project.id, vscode.ConfigurationTarget.Workspace);
      this.state.projectId = picked.project.id;
      this.state.projectName = picked.project.name;
      this.state.projectIsDefault = picked.project.is_default;
      this.postState();
      vscode.window.showInformationMessage(`Compass project selected: ${picked.project.name}`);
    }
  }

  private async syncProjectSelection(): Promise<void> {
    if (this.state.provider !== "compass") {
      this.state.projectId = null;
      this.state.projectName = null;
      this.state.projectIsDefault = false;
      return;
    }
    const projects = await this.client.projects();
    const config = vscode.workspace.getConfiguration("compassCode");
    const configuredId = config.get<string>("projectId", "").trim();
    const selected = projects.find((project) => project.id === configuredId) ?? projects.find((project) => project.is_default);
    if (selected && configuredId !== selected.id) {
      await config.update("projectId", selected.id, vscode.ConfigurationTarget.Workspace);
    }
    this.state.projectId = selected?.id ?? null;
    this.state.projectName = selected?.name ?? null;
    this.state.projectIsDefault = selected?.is_default ?? false;
  }

  async newTask(): Promise<void> {
    this.archiveCurrentConversation();
    this.cancelPermission();
    this.agent?.newTask();
    this.activeConversationId = null;
    this.state.transcript = [];
    this.state.activeConversationId = null;
    this.state.permission = null;
    this.state.error = null;
    this.state.goal = null;
    this.postState();
  }

  async disconnect(): Promise<void> {
    this.agent?.stop();
    this.agent = undefined;
    this.modelProvider = this.client;
    this.sessionWriteAllowed = false;
    this.sessionWriteDenied = false;
    this.cancelPermission();
    await this.client.disconnect();
    this.state = {
      ...this.state,
      connected: false,
      connecting: false,
      models: [],
      selectedModel: "",
      account: null,
      projectId: null,
      projectName: null,
      projectIsDefault: false,
      transcript: [],
      conversations: this.summaries(),
      activeConversationId: null,
      permission: null,
      error: null,
      goal: null
    };
    this.postState();
  }

  async restoreCheckpoint(): Promise<void> {
    const restored = await this.checkpoints.restoreLatest();
    if (restored) {
      this.append({ id: `status-${Date.now()}`, role: "status", content: `Restored checkpoint ${restored}.` });
    } else {
      vscode.window.showInformationMessage("Compass Router has no checkpoint to restore yet.");
    }
  }

  async stopAgent(): Promise<void> {
    this.agent?.stop();
    this.cancelPermission();
    if (this.state.goal && ["planning", "working", "waiting", "testing"].includes(this.state.goal.status)) {
      this.setGoalStatus("paused", "Paused by the user.");
    }
    this.postState();
  }

  async openDashboard(): Promise<void> {
    const url = vscode.workspace.getConfiguration("compassCode").get<string>("marketplaceUrl", "https://compass.nu-pie.ai");
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  openPage(page: "chat" | "history" | "settings" | "account" | "connect", provider?: ProviderKind): void {
    void this.view?.webview.postMessage({ type: "navigate", page, provider });
  }

  async resumeGoal(): Promise<void> {
    const goal = this.state.goal;
    const prompt = [...this.state.transcript].reverse().find((item) => item.role === "user")?.content;
    if (!goal || !prompt || !this.state.selectedModel || !this.state.connected) return;
    if (goal.status !== "paused" && goal.status !== "failed") return;
    goal.followUpCount += 1;
    goal.finishedAt = undefined;
    goal.startedAt = Date.now();
    goal.status = "planning";
    goal.updatedAt = Date.now();
    this.postState();
    if (!this.agent) this.ensureAgent();
    await this.agent?.send(`Continue the previous task from its current state. Re-check incomplete or failed steps, then finish the request. Original request: ${prompt}`, this.state.selectedModel, this.state.mode, false);
  }

  async cancelGoal(): Promise<void> {
    this.agent?.stop();
    this.cancelPermission();
    if (this.state.goal) this.setGoalStatus("cancelled", "Cancelled by the user.");
    this.postState();
  }

  private cancelPermission(): void {
    const resolve = this.permissionResolver;
    this.permissionResolver = undefined;
    this.state.permission = null;
    resolve?.("deny");
  }

  private async applyCode(path: string, content: string): Promise<void> {
    if (this.state.permission) throw new Error("Finish the current permission request before applying another change.");
    const args = { path, content };
    if (this.sessionWriteDenied) return;
    const prepared = this.sessionWriteAllowed ? undefined : await this.tools.preview("write_file", args);
    const id = randomId("apply-code");
    const decision = this.sessionWriteAllowed ? "once" : await this.requestPermission({
      id,
      toolName: "write_file",
      kind: "write",
      summary: `Apply generated code to ${path}`,
      arguments: args,
      preview: prepared?.diff,
      changeId: prepared?.changeId,
      files: prepared?.files,
      addedLines: prepared?.addedLines,
      removedLines: prepared?.removedLines,
      decisions: ["once", "session", "always", "session-deny", "deny"]
    });
    if (decision === "deny") {
      await this.tools.discardPreview(prepared?.changeId);
      return;
    }
    if (decision === "session") this.sessionWriteAllowed = true;
    if (decision === "session-deny") {
      this.sessionWriteDenied = true;
      await this.tools.discardPreview(prepared?.changeId);
      return;
    }
    if (decision === "always") await vscode.workspace.getConfiguration("compassCode").update("autoApproveWrites", true, vscode.ConfigurationTarget.Global);
    try {
      const result = await this.tools.execute("write_file", args);
      await this.tools.discardPreview(prepared?.changeId);
      this.append({ id: randomId("tool"), role: "tool", toolName: "write_file", path, content: result });
    } catch (error) {
      await this.tools.discardPreview(prepared?.changeId);
      throw error;
    }
  }

  async retryLast(): Promise<void> {
    const prompt = [...this.state.transcript].reverse().find((item) => item.role === "user")?.content;
    if (!prompt || !this.state.selectedModel) {
      vscode.window.showInformationMessage("Compass Router has no previous request to retry.");
      return;
    }
    if (!this.agent) this.ensureAgent();
    if (!this.activeConversationId) {
      this.activeConversationId = `chat-${Date.now()}`;
      this.state.activeConversationId = this.activeConversationId;
    }
    this.startOrContinueGoal(prompt, this.state.selectedModel, this.state.mode);
    await this.agent?.send(prompt, this.state.selectedModel, this.state.mode, false);
  }

  async runCommandPrompt(prompt: string, mode: AgentMode = "ask"): Promise<void> {
    if (!this.view) await vscode.commands.executeCommand("workbench.view.extension.compassCode");
    if (!this.state.connected) {
      vscode.window.showWarningMessage("Connect Compass Router before running an AI command.");
      return;
    }
    if (!this.agent) this.ensureAgent();
    if (!this.state.selectedModel) {
      vscode.window.showWarningMessage("Compass Router has no available model for this workspace.");
      return;
    }
    if (!this.activeConversationId) {
      this.activeConversationId = `chat-${Date.now()}`;
      this.state.activeConversationId = this.activeConversationId;
    }
    this.startOrContinueGoal(prompt, this.state.selectedModel, mode);
    this.state.mode = mode;
    this.state.error = null;
    this.postState();
    await this.agent?.send(prompt, this.state.selectedModel, mode, true);
  }

  private async openConversation(id: string): Promise<void> {
    const conversation = this.conversations.find((item) => item.id === id);
    if (!conversation) return;
    this.agent?.newTask();
    this.activeConversationId = conversation.id;
    this.state.activeConversationId = conversation.id;
    this.state.transcript = [...conversation.transcript];
    this.state.goal = conversation.goal ? structuredClone(conversation.goal) : null;
    if (conversation.mode) this.state.mode = conversation.mode;
    if (conversation.model && this.state.models.some((model) => model.id === conversation.model)) this.state.selectedModel = conversation.model;
    if (this.agent) this.agent.restoreTranscript(this.state.transcript, this.state.mode);
    this.state.permission = null;
    this.state.error = null;
    this.postState();
  }

  private async renameConversation(id: string, title: string): Promise<void> {
    const nextTitle = title.trim().slice(0, 120);
    if (!nextTitle) return;
    const conversation = this.conversations.find((item) => item.id === id);
    if (!conversation) return;
    conversation.title = nextTitle;
    this.state.conversations = this.summaries();
    await this.context.workspaceState.update("compassCode.conversations", this.conversations);
    this.postState();
  }

  private async deleteConversation(id: string): Promise<void> {
    if (this.activeConversationId === id) {
      this.activeConversationId = null;
      await this.newTask();
    }
    this.conversations = this.conversations.filter((item) => item.id !== id);
    this.state.conversations = this.summaries();
    await this.context.workspaceState.update("compassCode.conversations", this.conversations);
    this.postState();
  }

  private async handleMessage(message: ViewMessage): Promise<void> {
    try {
      if (this.state.busy && ["send", "newTask", "openConversation", "deleteConversation", "retryLast", "resumeGoal", "applyCode", "restoreCheckpoint", "setModel", "setMode", "refresh", "connect", "login"].includes(message.type)) return;
      switch (message.type) {
        case "ready":
          await this.refresh();
          break;
        case "connect":
          await this.finishConnect(message.baseUrl, message.apiKey, message.workStyle, message.provider);
          break;
        case "login":
          await this.connect();
          break;
        case "deviceLogin":
          await this.connect();
          break;
        case "disconnect":
          await this.disconnect();
          break;
        case "send":
          if (this.state.busy) return;
          if (!this.agent) throw new Error("Connect a Compass API key first.");
          if (!this.activeConversationId) {
            this.activeConversationId = `chat-${Date.now()}`;
            this.state.activeConversationId = this.activeConversationId;
          }
          this.startOrContinueGoal(message.prompt, message.model, message.mode);
          this.state.mode = message.mode;
          this.state.selectedModel = message.model;
          this.state.error = null;
          this.postState();
          await this.agent.send(message.prompt, message.model, message.mode, message.includeSelection);
          break;
        case "stop":
          await this.stopAgent();
          break;
        case "pauseGoal":
          await this.stopAgent();
          break;
        case "resumeGoal":
          await this.resumeGoal();
          break;
        case "cancelGoal":
          await this.cancelGoal();
          break;
        case "reviewGoal":
          await vscode.commands.executeCommand("compassCode.reviewChanges");
          break;
        case "retryLast":
          await this.retryLast();
          break;
        case "newTask":
          await this.newTask();
          break;
        case "openConversation":
          await this.openConversation(message.id);
          break;
        case "renameConversation":
          await this.renameConversation(message.id, message.title);
          break;
        case "deleteConversation":
          await this.deleteConversation(message.id);
          break;
        case "refresh":
          await this.refresh();
          break;
        case "chooseProject":
          await this.chooseProject();
          break;
        case "openConnect":
          this.openPage("connect", message.provider);
          break;
        case "openSettings":
          this.openPage("settings");
          break;
        case "openAccount":
          this.openPage("account");
          break;
        case "openDashboard":
          await this.openDashboard();
          break;
        case "copyTranscript": {
          const text = this.state.transcript
            .map((item) => `${item.role.toUpperCase()}\n${item.content}`)
            .join("\n\n");
          await vscode.env.clipboard.writeText(text);
          vscode.window.showInformationMessage("Conversation copied to the clipboard.");
          break;
        }
        case "exportTranscript": {
          const uri = await vscode.window.showSaveDialog({
            saveLabel: "Export conversation",
            filters: { Markdown: ["md"], Text: ["txt"] },
            defaultUri: vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(this.context.extensionPath), "compass-conversation.md")
          });
          if (uri) {
            const text = this.state.transcript
              .map((item) => `## ${item.role === "assistant" ? "Compass" : item.role === "user" ? "You" : item.role}\n\n${item.content}`)
              .join("\n\n");
            await vscode.workspace.fs.writeFile(uri, Buffer.from(`# Compass conversation\n\n${text}`, "utf8"));
          }
          break;
        }
        case "setMode":
          this.state.mode = message.mode;
          this.postState();
          break;
        case "setModel":
          this.state.selectedModel = message.model;
          await vscode.workspace.getConfiguration("compassCode").update("defaultModel", message.model, vscode.ConfigurationTarget.Global);
          this.postState();
          break;
        case "permission":
          if (this.state.permission?.id === message.id && this.permissionResolver) {
            const resolve = this.permissionResolver;
            this.permissionResolver = undefined;
            this.state.permission = null;
            if (message.decision !== "deny" && message.decision !== "session-deny") this.setGoalStatus("working", "Approval received; continuing.");
            else if (this.state.goal?.status === "waiting") this.setGoalStatus("working", "Approval declined; choosing the next step.");
            resolve(message.decision);
            this.postState();
          }
          break;
        case "openDiff":
          if (this.state.permission?.id === message.id && this.state.permission.changeId) await this.reviews.open(this.state.permission.changeId);
          break;
        case "openFile":
          await this.tools.openFile(message.path);
          break;
        case "applyCode":
          await this.applyCode(message.path, message.content);
          break;
        case "restoreCheckpoint":
          await this.restoreCheckpoint();
          break;
      }
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : "Compass Router failed.";
      this.state.connecting = false;
      this.postState();
    }
  }

  private async finishConnect(baseUrl: string, apiKey: string, workStyle: WorkStyle = "review", provider: ProviderKind = "compass"): Promise<void> {
    this.state.connecting = true;
    this.state.error = null;
    this.postState();
    try {
      await vscode.workspace.getConfiguration("compassCode").update("provider", provider, vscode.ConfigurationTarget.Global);
      await this.client.saveConnection(baseUrl, apiKey, provider);
      this.state.baseUrl = this.client.baseUrl;
      this.state.provider = provider;
      this.modelProvider = await this.client.provider(provider);
      this.agent?.stop();
      this.agent = undefined;
      const config = vscode.workspace.getConfiguration("compassCode");
      await config.update("autoApproveWrites", workStyle === "autonomous", vscode.ConfigurationTarget.Global);
      await config.update("autoApproveTerminal", workStyle === "autonomous", vscode.ConfigurationTarget.Global);
        const models = await this.modelProvider.models();
      if (!models.length) throw new Error("This Compass key has no allowed models.");
      this.state.models = models;
      const preferredModel = config.get<string>("defaultModel", "") || this.state.selectedModel;
      this.state.selectedModel = preferredModel && models.some((model) => model.id === preferredModel)
        ? preferredModel
        : models[0].id;
      this.state.connected = true;
      this.state.account = provider === "compass" ? await this.client.account() : null;
      await this.syncProjectSelection();
      this.ensureAgent();
      const connectionName = provider === "compass" ? "Compass Router" : provider === "ollama" ? "Ollama" : "the OpenAI-compatible provider";
      this.append({ id: `status-${Date.now()}`, role: "status", content: `Connected to ${connectionName}. ${models.length} model${models.length === 1 ? "" : "s"} available.` });
      this.openPage("chat");
    } catch (error) {
      await this.client.disconnect();
      throw error;
    } finally {
      this.state.connecting = false;
      this.postState();
    }
  }

  private async refresh(): Promise<void> {
    if (this.state.connecting) return;
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
      this.state.provider = vscode.workspace.getConfiguration("compassCode").get<ProviderKind>("provider", "compass");
      if (this.state.provider === "compass") await this.client.refreshDeviceSession();
      this.modelProvider = await this.client.provider(this.state.provider);
      const models = await this.modelProvider.models();
      this.state.models = models;
      const preferredModel = vscode.workspace.getConfiguration("compassCode").get<string>("defaultModel", "") || this.state.selectedModel;
      this.state.selectedModel = preferredModel && models.some((model) => model.id === preferredModel)
        ? preferredModel
        : models[0]?.id ?? "";
      this.state.account = this.state.provider === "compass" ? await this.client.account() : null;
      await this.syncProjectSelection();
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
    this.agent = new CompassAgent(this.modelProvider, this.tools, {
      append: (item) => this.append(item),
      has: (id) => this.has(id),
      update: (id, patch) => this.update(id, patch),
      setBusy: (busy) => {
        this.state.busy = busy;
        this.postState();
      },
      requestPermission: (request) => this.requestPermission(request),
      setGoalStatus: (status, detail) => this.setGoalStatus(status, detail),
      setPlanStep: (stepId, status, detail) => this.setPlanStep(stepId, status, detail),
      addGoalActivity: (activity) => this.addGoalActivity(activity),
      updateGoalActivity: (id, patch) => this.updateGoalActivity(id, patch),
      recordGoalFileChange: (change) => this.recordGoalFileChange(change),
      refreshAccount: async () => {
        if (this.state.provider !== "compass") return;
        try {
          this.state.account = await this.client.account();
          this.postState();
        } catch {
          // Preserve the completed response even if the account refresh is unavailable.
        }
      }
    }, this.contextManager);
  }

  private requestPermission(request: PermissionRequest): Promise<PermissionDecision> {
    this.state.permission = request;
    this.setGoalStatus("waiting", `Waiting for approval: ${request.summary}`);
    this.postState();
    return new Promise<PermissionDecision>((resolve) => {
      this.permissionResolver = resolve;
    });
  }

  private append(item: TranscriptItem): void {
    this.state.transcript = [...this.state.transcript, item].slice(-80);
    this.persistCurrentConversation();
    this.postState();
  }

  private has(id: string): boolean {
    return this.state.transcript.some((item) => item.id === id);
  }

  private update(id: string, patch: Partial<TranscriptItem>): void {
    const index = this.state.transcript.findIndex((item) => item.id === id);
    if (index < 0) return;
    const transcript = [...this.state.transcript];
    transcript[index] = { ...transcript[index], ...patch };
    this.state.transcript = transcript;
    this.persistCurrentConversation();
    this.postState();
  }

  private summaries(): ConversationSummary[] {
    return this.conversations.map(({ id, title, updatedAt, model, mode, contextReferences, goal }) => ({ id, title, updatedAt, model, mode, contextReferences, goal }));
  }

  private archiveCurrentConversation(): void {
    this.persistCurrentConversation();
  }

  private persistCurrentConversation(): void {
    if (!this.activeConversationId || !this.state.transcript.some((item) => item.role === "user")) return;
    const title = this.conversations.find(item => item.id === this.activeConversationId)?.title || this.state.transcript.find((item) => item.role === "user")?.content.split("\n")[0].trim().slice(0, 72) || "Compass chat";
    const firstPrompt = this.state.transcript.find((item) => item.role === "user")?.content ?? "";
    const contextReferences = [...firstPrompt.matchAll(/@(file|folder|workspace|selection|terminal|git|problems)\b/gi)].map((match) => match[1].toLocaleLowerCase());
    const saved: SavedConversation = {
      id: this.activeConversationId,
      title,
      updatedAt: Date.now(),
      model: this.state.selectedModel || undefined,
      mode: this.state.mode,
      contextReferences: [...new Set(contextReferences)],
      goal: this.state.goal ? structuredClone(this.state.goal) : undefined,
      transcript: [...this.state.transcript]
    };
    this.conversations = [saved, ...this.conversations.filter((item) => item.id !== saved.id)].slice(0, 20);
    this.state.conversations = this.summaries();
    void this.context.workspaceState.update("compassCode.conversations", this.conversations);
  }

  private initialPlan(): AgentGoal["plan"] {
    const now = Date.now();
    return [
      { id: "inspect", title: "Inspect repository", status: "active", updatedAt: now },
      { id: "plan", title: "Plan changes", status: "pending", updatedAt: now },
      { id: "implement", title: "Implement changes", status: "pending", updatedAt: now },
      { id: "validate", title: "Run validation", status: "pending", updatedAt: now },
      { id: "fix", title: "Fix failures", status: "pending", updatedAt: now },
      { id: "complete", title: "Complete goal", status: "pending", updatedAt: now }
    ];
  }

  private startOrContinueGoal(prompt: string, model: string, mode: AgentMode): void {
    const now = Date.now();
    const current = this.state.goal;
    if (!current || current.status === "completed" || current.status === "cancelled" || current.status === "failed") {
      this.state.goal = {
        id: randomId("goal"),
        title: prompt.split("\n")[0].trim().slice(0, 120) || "Compass task",
        status: "planning",
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        elapsedMs: 0,
        model,
        mode,
        contextReferences: [...prompt.matchAll(/@(file|folder|workspace|selection|terminal|git|problems)\b/gi)].map((match) => match[1].toLocaleLowerCase()),
        plan: this.initialPlan(),
        activity: [],
        changedFiles: [],
        followUpCount: current?.followUpCount ?? 0
      };
    } else {
      current.model = model;
      current.mode = mode;
      current.followUpCount += 1;
      current.status = "planning";
      current.startedAt = now;
      current.finishedAt = undefined;
      current.updatedAt = now;
    }
    this.postState();
  }

  private setGoalStatus(status: GoalStatus, detail?: string): void {
    const goal = this.state.goal;
    if (!goal) return;
    const now = Date.now();
    const running = ["planning", "working", "waiting", "testing"].includes(goal.status);
    if (running) goal.elapsedMs += Math.max(0, now - goal.updatedAt);
    goal.status = status;
    goal.updatedAt = now;
    if (status === "completed" || status === "failed" || status === "cancelled") goal.finishedAt = now;
    if (detail) this.addGoalActivity({ kind: "status", title: detail, status: "completed" });
    this.persistCurrentConversation();
    this.postState();
  }

  private setPlanStep(stepId: string, status: GoalStepStatus, detail?: string): void {
    const goal = this.state.goal;
    const step = goal?.plan.find((item) => item.id === stepId);
    if (!step) return;
    step.status = status;
    step.updatedAt = Date.now();
    if (detail) step.detail = detail;
    this.persistCurrentConversation();
    this.postState();
  }

  private addGoalActivity(activity: Omit<GoalActivity, "id" | "createdAt" | "updatedAt">): string {
    const id = randomId("activity");
    const goal = this.state.goal;
    if (!goal) return id;
    const now = Date.now();
    goal.activity = [...goal.activity, { ...activity, id, createdAt: now, updatedAt: now }].slice(-100);
    goal.updatedAt = now;
    this.persistCurrentConversation();
    this.postState();
    return id;
  }

  private updateGoalActivity(id: string, patch: Partial<GoalActivity>): void {
    const goal = this.state.goal;
    const activity = goal?.activity.find((item) => item.id === id);
    if (!goal || !activity) return;
    Object.assign(activity, patch, { updatedAt: Date.now() });
    goal.updatedAt = Date.now();
    this.persistCurrentConversation();
    this.postState();
  }

  private recordGoalFileChange(change: GoalFileChange): void {
    const goal = this.state.goal;
    if (!goal) return;
    const existing = goal.changedFiles.find((item) => item.path === change.path);
    if (existing) Object.assign(existing, change);
    else goal.changedFiles.push(change);
    goal.updatedAt = Date.now();
    this.persistCurrentConversation();
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${style}" />
  <title>Compass Router</title>
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
    vscode.commands.registerCommand("compassCode.chooseProject", () => provider.chooseProject()),
    vscode.commands.registerCommand("compassCode.restoreCheckpoint", () => provider.restoreCheckpoint()),
    vscode.commands.registerCommand("compassCode.openSettings", () => provider.openPage("settings")),
    vscode.commands.registerCommand("compassCode.openHistory", () => provider.openPage("history")),
    vscode.commands.registerCommand("compassCode.openAccount", () => provider.openPage("account")),
    vscode.commands.registerCommand("compassCode.openDashboard", () => provider.openDashboard()),
    vscode.commands.registerCommand("compassCode.explainSelection", () => provider.runCommandPrompt("Explain the selected code, its responsibilities, assumptions, and any risks.", "ask")),
    vscode.commands.registerCommand("compassCode.fixSelection", () => provider.runCommandPrompt("Inspect the selected code, identify the defect, and fix it with the smallest safe edit.", "edit")),
    vscode.commands.registerCommand("compassCode.refactorSelection", () => provider.runCommandPrompt("Refactor the selected code for clarity and maintainability while preserving behavior.", "edit")),
    vscode.commands.registerCommand("compassCode.optimizeSelection", () => provider.runCommandPrompt("Optimize the selected code for its stated performance or resource behavior while preserving correctness and public behavior.", "edit")),
    vscode.commands.registerCommand("compassCode.generateTests", () => provider.runCommandPrompt("Generate focused tests for the selected code and add them to the appropriate test file.", "edit")),
    vscode.commands.registerCommand("compassCode.generateDocumentation", () => provider.runCommandPrompt("Document the selected code with concise, idiomatic documentation appropriate for this repository.", "edit")),
    vscode.commands.registerCommand("compassCode.fixProblems", () => provider.runCommandPrompt("Inspect the current VS Code diagnostics, fix the relevant problems, and rerun focused validation.", "debug")),
    vscode.commands.registerCommand("compassCode.reviewChanges", () => provider.runCommandPrompt("Review the current working tree changes. Identify correctness, security, and regression risks, and report findings with file references.", "plan")),
    vscode.commands.registerCommand("compassCode.generateCommitMessage", () => provider.runCommandPrompt("Inspect the current Git diff and propose a concise commit message. Do not commit anything.", "ask")),
    vscode.commands.registerCommand("compassCode.stopAgent", () => provider.stopAgent())
  );
}

export function deactivate(): void {
  // The agent aborts in response to the view's stop/new-task actions.
}
