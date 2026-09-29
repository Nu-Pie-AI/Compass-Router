import type { AccountSummary, AgentGoal, AgentMode, CompassModel, ConversationSummary, GoalActivity, PermissionRequest, ProviderKind, TranscriptItem, WorkStyle } from "./types.js";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import { marked } from "marked";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void; getState(): unknown; setState(state: unknown): void };

const vscode = acquireVsCodeApi();
const root = document.querySelector<HTMLElement>("#app")!;
const modes: AgentMode[] = ["ask", "plan", "code", "debug"];

type State = {
  baseUrl: string;
  provider: ProviderKind;
  connected: boolean;
  connecting: boolean;
  busy: boolean;
  models: CompassModel[];
  selectedModel: string;
  mode: AgentMode;
  account: AccountSummary | null;
  transcript: TranscriptItem[];
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  permission: PermissionRequest | null;
  error: string | null;
  goal: AgentGoal | null;
};

const initial: State = {
  baseUrl: "https://compass-router-api-567790052414.us-central1.run.app",
  provider: "compass",
  connected: false,
  connecting: false,
  busy: false,
  models: [],
  selectedModel: "",
  mode: "ask",
  account: null,
  transcript: [],
  conversations: [],
  activeConversationId: null,
  permission: null,
  error: null,
  goal: null
};

const restoredState = vscode.getState() as Partial<State> | undefined;
let state: State = { ...initial, ...restoredState, provider: restoredState?.provider ?? initial.provider };
let workStyle: WorkStyle = "review";
let showHistory = false;
let historyQuery = "";
let showContextPicker = false;
let showJumpToLatest = false;
let renderQueued = false;

function formatPaise(paise: number): string {
  return `Rs ${(paise / 100).toFixed(2)}`;
}

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function post(message: unknown): void {
  vscode.postMessage(message);
}

function render(): void {
  const previousTranscript = document.querySelector<HTMLElement>(".transcript");
  const previousScrollTop = previousTranscript?.scrollTop ?? 0;
  const wasAtBottom = !previousTranscript || previousTranscript.scrollHeight - previousTranscript.scrollTop - previousTranscript.clientHeight < 48;
  if (previousTranscript && !wasAtBottom && state.busy) showJumpToLatest = true;
  if (wasAtBottom) showJumpToLatest = false;
  root.innerHTML = state.connected ? connectedMarkup() : connectMarkup();
  bindEvents();
  vscode.setState(state);
  requestAnimationFrame(() => {
    const transcript = document.querySelector<HTMLElement>(".transcript");
    if (!transcript) return;
    transcript.scrollTop = wasAtBottom ? transcript.scrollHeight : previousScrollTop;
    transcript.dispatchEvent(new Event("scroll"));
  });
}

function queueRender(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function connectMarkup(): string {
  const baseUrl = state.baseUrl || "https://compass-router-api-567790052414.us-central1.run.app";
  const providerLabel = state.provider === "compass" ? "Compass API key" : state.provider === "ollama" ? "API key (optional)" : "Provider API key";
  const providerPlaceholder = state.provider === "compass" ? "sk-compass-..." : state.provider === "ollama" ? "Not required for local Ollama" : "sk-...";
  return `<section class="welcome-shell">
    <div class="brand-lockup" aria-label="Compass">
      <span class="brand-logo" aria-hidden="true"><svg viewBox="0 0 32 32" role="presentation"><path d="M6 9h13a4 4 0 1 0-4-4" /><path d="M26 23H13a4 4 0 1 0 4 4" /><circle cx="6" cy="9" r="3" /><circle cx="26" cy="23" r="3" /></svg></span>
      <span>Compass</span>
    </div>
    <h1>Welcome to Compass</h1>
    <p class="welcome-intro">Your AI coding partner, connected to the models and controls in your Compass workspace.</p>
    <section class="welcome-card" aria-labelledby="work-style-title">
      <h2 id="work-style-title">Choose how you want to work</h2>
      <button class="work-option ${workStyle === "review" ? "selected" : ""}" data-work-style="review" type="button">
        <span class="work-option-title">REVIEW FIRST</span>
        <span class="work-option-copy">Compass pauses and shows you its plan as it works.</span>
        <span class="work-option-points"><span>Asks before editing files or running commands.</span><span>Shows tool actions for review.</span></span>
      </button>
      <button class="work-option ${workStyle === "autonomous" ? "selected" : ""}" data-work-style="autonomous" type="button">
        <span class="work-option-title">HIGH AUTONOMY</span>
        <span class="work-option-copy">Fewer interruptions for a more streamlined workflow.</span>
        <span class="work-option-points"><span>Can edit files and run commands without asking.</span><span>Read access remains available automatically.</span></span>
      </button>
      <p class="welcome-hint">You can change approval behavior later in VS Code Settings.</p>
    </section>
    <section class="connect-fields" aria-label="Connect to Compass">
      <label>Provider<select id="provider"><option value="compass" ${state.provider === "compass" ? "selected" : ""}>Compass Router</option><option value="openai-compatible" ${state.provider === "openai-compatible" ? "selected" : ""}>OpenAI-compatible API</option><option value="ollama" ${state.provider === "ollama" ? "selected" : ""}>Ollama</option></select></label>
      <label><span id="base-url-caption">${state.provider === "ollama" ? "Ollama URL" : "API base URL"}</span><input id="base-url" value="${esc(baseUrl)}" spellcheck="false" /></label>
      <label><span id="api-key-caption">${providerLabel}</span><input id="api-key" type="password" placeholder="${providerPlaceholder}" autocomplete="off" ${state.provider === "ollama" ? "disabled" : ""} /></label>
      <button class="primary full" id="connect">${state.connecting ? "Connecting..." : "Continue"}</button>
      <p class="hint">You can change the API URL in VS Code settings for a self-hosted Compass instance.</p>
      ${state.error ? `<div class="alert error">${esc(state.error)}</div>` : ""}
    </section>
  </section>`;
}

function connectedMarkup(): string {
  const hasTranscript = state.transcript.length > 0;
  const modelOptions = state.models.map((model) => `<option value="${esc(model.id)}" ${model.id === state.selectedModel ? "selected" : ""}>${esc(model.id)}</option>`).join("");
  const messages = hasTranscript ? state.transcript.map(transcriptMarkup).join("") : `<div class="empty"><span class="empty-logo" aria-hidden="true"><svg viewBox="0 0 32 32" role="presentation"><path d="M6 9h13a4 4 0 1 0-4-4" /><path d="M26 23H13a4 4 0 1 0 4 4" /><circle cx="6" cy="9" r="3" /><circle cx="26" cy="23" r="3" /></svg></span><strong>Ready when you are.</strong><span>Ask Compass to inspect, explain, plan, debug, or change this workspace.</span></div>`;
  const firstPrompt = state.transcript.find((item) => item.role === "user")?.content.split("\n")[0].trim() || "New chat";
  const lastAssistant = [...state.transcript].reverse().find((item) => item.role === "assistant");
  const workedFor = lastAssistant?.meta?.latencyMs ? `Worked for ${Math.max(1, Math.round(lastAssistant.meta.latencyMs / 1000))}s` : "";
  const modeOptions = modes.map((mode) => `<option value="${mode}" ${state.mode === mode ? "selected" : ""}>${mode[0].toUpperCase()}${mode.slice(1)}</option>`).join("");
  const visibleConversations = state.conversations.filter((conversation) => conversation.title.toLocaleLowerCase().includes(historyQuery.toLocaleLowerCase()));
  const historyItems = visibleConversations.map((conversation) => `<div class="chat-history-item"><button class="chat-history-open" type="button" data-conversation-id="${esc(conversation.id)}"><span>${esc(conversation.title)}</span><time>${formatChatAge(conversation.updatedAt)}</time></button><button class="chat-history-action" type="button" title="Rename conversation" aria-label="Rename conversation" data-rename-conversation-id="${esc(conversation.id)}">&#x270e;</button><button class="chat-history-action danger" type="button" title="Delete conversation" aria-label="Delete conversation" data-delete-conversation-id="${esc(conversation.id)}">&#x00d7;</button></div>`).join("");
  const history = !hasTranscript || showHistory ? `<section class="chat-history" aria-label="Conversation history"><input id="history-search" class="history-search" type="search" placeholder="Search chats" value="${esc(historyQuery)}" />${historyItems || `<div class="chat-history-empty">${historyQuery ? "No matching chats." : "No previous chats yet."}</div>`}</section>` : "";
  const conversationHeader = hasTranscript ? `<section class="conversation-bar" aria-label="Current conversation">
      <button class="conversation-back" id="new-task-back" type="button" title="Back to new chat" aria-label="Back to new chat">&#x2190;</button>
      <span class="conversation-title">${esc(firstPrompt.slice(0, 72))}</span>
      <div class="conversation-actions"><button class="conversation-icon" type="button" title="Conversation history" aria-label="Conversation history" id="toggle-history">&#x22ef;</button><button class="conversation-icon" type="button" title="Restore last checkpoint" aria-label="Restore last checkpoint" id="restore-checkpoint">&#x21b6;</button></div>
    </section>` : `<section class="chat-list-header"><div class="chat-list-title"><strong>Chats</strong><span class="status-dot" aria-hidden="true"></span></div></section>`;
  const goal = state.goal ? goalMarkup(state.goal) : "";
  return `<main class="agent-shell">
    ${conversationHeader}
    ${history}
    ${state.error ? `<div class="alert error">${esc(state.error)}</div>` : ""}
    ${state.permission ? permissionMarkup(state.permission) : ""}
    <div class="transcript-wrap"><section class="transcript" aria-live="polite">${goal}${messages}</section>${showJumpToLatest ? `<button class="jump-latest" id="jump-latest" type="button">Jump to latest</button>` : ""}</div>
    ${workedFor ? `<div class="worked-row"><span>${workedFor}</span><span aria-hidden="true">&#x203a;</span></div>` : ""}
    <section class="composer" aria-label="Compass Code composer">
      <textarea id="prompt" placeholder="${hasTranscript ? "Ask a follow-up about this workspace..." : "Ask Compass to inspect or change this workspace..."} (Shift+Enter for a new line)" rows="3" ${state.busy ? "disabled" : ""}></textarea>
      <div class="composer-toolbar">
        <button class="composer-icon" id="context-toggle" type="button" title="Add workspace context" aria-label="Add workspace context">&#x2b;</button>
        <label class="select-control" title="Choose a model"><span class="sr-only">Model</span><select id="model" ${state.busy ? "disabled" : ""}>${modelOptions || "<option>No models available</option>"}</select></label>
        <label class="select-control mode-select" title="Choose a mode"><span class="sr-only">Mode</span><select id="mode" ${state.busy ? "disabled" : ""}>${modeOptions}</select></label>
        <button class="send" id="send" type="button" title="${state.busy ? "Stop task" : "Send message"}" aria-label="${state.busy ? "Stop task" : "Send message"}">${state.busy ? "&#x25a0;" : "&#x2191;"}</button>
      </div>
      ${showContextPicker ? `<div class="context-picker" role="menu">${["file", "folder", "workspace", "selection", "terminal", "git", "problems"].map((reference) => `<button type="button" data-context-reference="@${reference}">@${reference}</button>`).join("")}</div>` : ""}
      <div class="composer-status"><span>Ready &middot; Compass workspace</span><span class="approval-note">Changes and terminal commands require approval</span></div>
    </section>
  </main>`;
}

function goalMarkup(goal: AgentGoal): string {
  const statusLabel = goal.status === "waiting" ? "Waiting for approval" : goal.status[0].toUpperCase() + goal.status.slice(1);
  const elapsed = Math.max(0, goal.elapsedMs + (["planning", "working", "waiting", "testing"].includes(goal.status) ? Date.now() - goal.updatedAt : 0));
  const seconds = Math.floor(elapsed / 1000);
  const files = goal.changedFiles.length;
  const plan = goal.plan.map((step) => {
    const symbol = step.status === "completed" ? "✓" : step.status === "failed" ? "!" : step.status === "active" ? "•" : "○";
    return `<li class="goal-step ${step.status}"><span aria-hidden="true">${symbol}</span><span>${esc(step.title)}</span>${step.detail ? `<small>${esc(step.detail)}</small>` : ""}</li>`;
  }).join("");
  const activity = goal.activity.slice(-8).reverse().map((item: GoalActivity) => `<details class="goal-activity ${item.status}"><summary><span class="activity-status" aria-hidden="true"></span><span>${esc(item.title)}</span><time>${item.status}</time></summary>${item.detail ? `<pre>${esc(item.detail)}</pre>` : ""}</details>`).join("");
  const controls = goal.status === "paused" || goal.status === "failed" ? `<button class="goal-control primary" data-goal-action="resumeGoal" type="button">Resume</button>` : goal.status === "completed" || goal.status === "cancelled" ? `<button class="goal-control secondary" data-goal-action="newTask" type="button">New task</button>` : `<button class="goal-control secondary" data-goal-action="pauseGoal" type="button">Pause</button><button class="goal-control danger" data-goal-action="cancelGoal" type="button">Cancel</button>`;
  return `<section class="goal-panel" aria-label="Current goal"><div class="goal-header"><div class="goal-title"><span class="goal-state ${goal.status}" aria-hidden="true"></span><strong>${esc(goal.title)}</strong><span class="goal-status">${esc(statusLabel)}</span></div><span class="goal-elapsed">${seconds}s</span></div><div class="goal-summary"><span>${goal.plan.filter((step) => step.status === "completed").length}/${goal.plan.length} steps</span><span>${files} changed file${files === 1 ? "" : "s"}</span><div class="goal-actions">${goal.changedFiles.length ? `<button class="goal-control secondary" data-goal-action="reviewGoal" type="button">Review changes</button>` : ""}${controls}</div></div><details class="goal-details" ${goal.status === "working" || goal.status === "testing" || goal.status === "waiting" ? "open" : ""}><summary>Plan and activity</summary><ol class="goal-plan">${plan}</ol><div class="goal-activity-list">${activity || `<span class="muted">No activity recorded yet.</span>`}</div></details></section>`;
}

function formatChatAge(updatedAt: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function permissionMarkup(permission: PermissionRequest): string {
  const stats = permission.files?.length ? `<div class="permission-stats"><span>${permission.files.length} file${permission.files.length === 1 ? "" : "s"}</span><span class="added">+${permission.addedLines ?? 0}</span><span class="removed">-${permission.removedLines ?? 0}</span></div>` : "";
  return `<aside class="permission ${permission.kind}"><div><span class="eyebrow">${permission.kind.toUpperCase()} PERMISSION</span><strong>${esc(permission.toolName)}</strong><code>${esc(permission.summary)}</code>${stats}${permission.preview ? `<details class="permission-preview"><summary>Review proposed changes</summary><pre>${esc(permission.preview)}</pre></details>` : ""}</div><div class="permission-actions">${permission.changeId ? `<button class="secondary" data-open-change="${esc(permission.id)}">Open diff</button>` : ""}<button class="secondary" data-permission-decision="deny" data-permission-id="${esc(permission.id)}">Reject</button><button class="secondary" data-permission-decision="session-deny" data-permission-id="${esc(permission.id)}">Reject all</button><button class="secondary" data-permission-decision="session" data-permission-id="${esc(permission.id)}">Accept all</button><button class="secondary" data-permission-decision="always" data-permission-id="${esc(permission.id)}">Always</button><button class="primary" data-permission-decision="once" data-permission-id="${esc(permission.id)}">Allow once</button></div></aside>`;
}

function transcriptMarkup(item: TranscriptItem): string {
  const roleLabel = item.role === "user" ? "YOU" : item.role === "assistant" ? "COMPASS" : item.role.toUpperCase();
  const meta = item.meta ? `<div class="meta"><span>${esc(item.meta.model ?? "")}</span>${item.meta.tokens === undefined ? "" : `<span>${item.meta.tokens} tokens</span>`}${item.meta.costPaise === undefined ? "" : `<span>${formatPaise(item.meta.costPaise)}</span>`}${item.meta.latencyMs === undefined ? "" : `<span>${item.meta.latencyMs} ms</span>`}</div>` : "";
  if (item.role === "user") return `<article class="message user"><pre>${esc(item.content)}</pre></article>`;
  if (item.role === "assistant") return `<article class="message assistant"><div class="assistant-heading"><span class="assistant-mark" aria-hidden="true"><svg viewBox="0 0 32 32" role="presentation"><path d="M6 9h13a4 4 0 1 0-4-4" /><path d="M26 23H13a4 4 0 1 0 4 4" /><circle cx="6" cy="9" r="3" /><circle cx="26" cy="23" r="3" /></svg></span><strong>Compass Agent</strong><span class="assistant-model">&middot; ${esc(item.meta?.model ?? "Compass")}</span></div><div class="assistant-content">${assistantContentMarkup(item.content)}</div>${meta}<button class="regenerate-button" type="button" data-regenerate="true">Regenerate</button></article>`;
  if (item.role === "tool") return `<article class="message tool"><details><summary><span class="tool-status-dot" aria-hidden="true"></span><span class="tool-name">${esc(item.toolName ?? "workspace tool")}</span><span class="tool-copy">Compass workspace action</span></summary><pre>${esc(item.content)}</pre>${item.path ? `<button class="open-file-button" type="button" data-open-file="${esc(item.path)}">Open file</button>` : ""}</details></article>`;
  if (item.role === "status") return `<article class="message status"><span>${esc(item.content)}</span></article>`;
  return `<article class="message ${item.role}"><div class="message-label">${esc(roleLabel)}${item.toolName ? ` &middot; ${esc(item.toolName)}` : ""}</div><pre>${esc(item.content)}</pre>${item.role === "error" ? `<button class="retry-button" type="button" data-retry="true">Retry</button>` : ""}${meta}</article>`;
}

const assistantRenderer = new marked.Renderer();
assistantRenderer.code = ({ text, lang }) => {
  const pathMatch = lang?.match(/(?:^|\s)(?:path|file)=([^\s]+)/i);
  const filePath = pathMatch?.[1];
  const label = (lang || "code").replace(/(?:^|\s)(?:path|file)=[^\s]+/i, "").trim() || "code";
  const language = label.split(/\s+/)[0].toLowerCase();
  const renderedCode = language && hljs.getLanguage(language)
    ? hljs.highlight(text, { language }).value
    : esc(text);
  const actions = filePath ? `<button class="open-code-file" type="button" data-open-code-file="${esc(filePath)}">Open file</button><button class="apply-code" type="button" data-apply-path="${esc(filePath)}" data-apply-code="${esc(encodeURIComponent(text))}">Apply to file</button>` : "";
  return `<div class="code-card"><div class="code-card-header"><span>${esc(filePath || label)}</span><div class="code-card-actions">${actions}<button class="copy-code" type="button" data-copy="${esc(text)}">Copy</button></div></div><pre><code class="hljs language-${esc(language || "text")}">${renderedCode}</code></pre></div>`;
};

function assistantContentMarkup(content: string): string {
  const html = marked.parse(content, { async: false, breaks: true, gfm: true, renderer: assistantRenderer }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-copy", "data-apply-path", "data-apply-code", "data-open-code-file"] });
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-work-style]").forEach((button) => button.addEventListener("click", () => {
    workStyle = button.dataset.workStyle as WorkStyle;
    render();
  }));
  document.querySelector<HTMLButtonElement>("#connect")?.addEventListener("click", () => {
    const baseUrl = document.querySelector<HTMLInputElement>("#base-url")?.value.trim() ?? "";
    const apiKey = document.querySelector<HTMLInputElement>("#api-key")?.value.trim() ?? "";
    const provider = document.querySelector<HTMLSelectElement>("#provider")?.value as ProviderKind ?? "compass";
    if (!apiKey && provider !== "ollama") return;
    post({ type: "connect", baseUrl, apiKey, provider, workStyle });
  });
  document.querySelector<HTMLSelectElement>("#provider")?.addEventListener("change", (event) => {
    const provider = (event.target as HTMLSelectElement).value as ProviderKind;
    const baseUrl = document.querySelector<HTMLInputElement>("#base-url");
    const baseUrlCaption = document.querySelector<HTMLElement>("#base-url-caption");
    const apiKeyCaption = document.querySelector<HTMLElement>("#api-key-caption");
    const apiKey = document.querySelector<HTMLInputElement>("#api-key");
    if (baseUrl && provider === "ollama") baseUrl.value = "http://127.0.0.1:11434";
    if (baseUrlCaption) baseUrlCaption.textContent = provider === "ollama" ? "Ollama URL" : "API base URL";
    if (apiKeyCaption) apiKeyCaption.textContent = provider === "compass" ? "Compass API key" : provider === "ollama" ? "API key (optional)" : "Provider API key";
    if (apiKey) {
      apiKey.disabled = provider === "ollama";
      apiKey.placeholder = provider === "compass" ? "sk-compass-..." : provider === "ollama" ? "Not required for local Ollama" : "sk-...";
    }
  });
  document.querySelector<HTMLButtonElement>("#new-task-back")?.addEventListener("click", () => post({ type: "newTask" }));
  document.querySelector<HTMLButtonElement>("#new-task-list")?.addEventListener("click", () => post({ type: "newTask" }));
  document.querySelector<HTMLButtonElement>("#toggle-history")?.addEventListener("click", () => {
    showHistory = !showHistory;
    render();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-conversation-id]").forEach((button) => button.addEventListener("click", () => {
    showHistory = false;
    post({ type: "openConversation", id: button.dataset.conversationId });
  }));
  document.querySelector<HTMLInputElement>("#history-search")?.addEventListener("input", (event) => {
    historyQuery = (event.target as HTMLInputElement).value;
    render();
    const search = document.querySelector<HTMLInputElement>("#history-search");
    search?.focus();
    search?.setSelectionRange(historyQuery.length, historyQuery.length);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-rename-conversation-id]").forEach((button) => button.addEventListener("click", () => {
    const conversation = state.conversations.find((item) => item.id === button.dataset.renameConversationId);
    const title = window.prompt("Conversation name", conversation?.title ?? "");
    if (title?.trim()) post({ type: "renameConversation", id: button.dataset.renameConversationId, title: title.trim() });
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-delete-conversation-id]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.deleteConversationId;
    if (id && window.confirm("Delete this conversation?")) post({ type: "deleteConversation", id });
  }));
  document.querySelector<HTMLButtonElement>("#restore-checkpoint")?.addEventListener("click", () => post({ type: "restoreCheckpoint" }));
  document.querySelector<HTMLButtonElement>("#settings")?.addEventListener("click", () => post({ type: "openSettings" }));
  document.querySelector<HTMLButtonElement>("#jump-latest")?.addEventListener("click", () => {
    const transcript = document.querySelector<HTMLElement>(".transcript");
    if (transcript) transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
    showJumpToLatest = false;
  });
  document.querySelector<HTMLElement>(".transcript")?.addEventListener("scroll", (event) => {
    const transcript = event.currentTarget as HTMLElement;
    const nearBottom = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 48;
    const jump = document.querySelector<HTMLButtonElement>("#jump-latest");
    if (nearBottom) {
      showJumpToLatest = false;
      jump?.remove();
    } else if (state.busy && !jump) {
      showJumpToLatest = true;
      const wrapper = document.querySelector<HTMLElement>(".transcript-wrap");
      wrapper?.insertAdjacentHTML("beforeend", `<button class="jump-latest" id="jump-latest" type="button">Jump to latest</button>`);
      document.querySelector<HTMLButtonElement>("#jump-latest")?.addEventListener("click", () => {
        transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
        showJumpToLatest = false;
      });
    }
  });
  document.querySelectorAll<HTMLButtonElement>("[data-goal-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.goalAction;
    if (action === "newTask") post({ type: "newTask" });
    else if (action === "pauseGoal") post({ type: "pauseGoal" });
    else if (action === "resumeGoal") post({ type: "resumeGoal" });
    else if (action === "cancelGoal") post({ type: "cancelGoal" });
    else if (action === "reviewGoal") post({ type: "reviewGoal" });
  }));
  document.querySelector<HTMLButtonElement>("#context-toggle")?.addEventListener("click", () => {
    showContextPicker = !showContextPicker;
    render();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-context-reference]").forEach((button) => button.addEventListener("click", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("#prompt");
    const reference = button.dataset.contextReference ?? "";
    const value = textarea?.value.trimEnd() ?? "";
    showContextPicker = false;
    render();
    const next = document.querySelector<HTMLTextAreaElement>("#prompt");
    if (next) {
      next.value = `${value}${value ? " " : ""}${reference} `;
      next.focus();
    }
  }));
  document.querySelector<HTMLSelectElement>("#model")?.addEventListener("change", (event) => post({ type: "setModel", model: (event.target as HTMLSelectElement).value }));
  document.querySelector<HTMLSelectElement>("#mode")?.addEventListener("change", (event) => post({ type: "setMode", mode: (event.target as HTMLSelectElement).value as AgentMode }));
  document.querySelectorAll<HTMLButtonElement>("[data-permission-decision]").forEach((button) => button.addEventListener("click", () => post({ type: "permission", id: button.dataset.permissionId, decision: button.dataset.permissionDecision as "once" | "session" | "always" | "session-deny" | "deny" })));
  document.querySelectorAll<HTMLButtonElement>("[data-open-change]").forEach((button) => button.addEventListener("click", () => post({ type: "openDiff", id: button.dataset.openChange })));
  document.querySelectorAll<HTMLButtonElement>("[data-open-file]").forEach((button) => button.addEventListener("click", () => post({ type: "openFile", path: button.dataset.openFile ?? "" })));
  document.querySelectorAll<HTMLButtonElement>("[data-open-code-file]").forEach((button) => button.addEventListener("click", () => post({ type: "openFile", path: button.dataset.openCodeFile ?? "" })));
  document.querySelectorAll<HTMLButtonElement>("[data-apply-code]").forEach((button) => button.addEventListener("click", () => {
    const path = button.dataset.applyPath;
    const encoded = button.dataset.applyCode;
    if (path && encoded) post({ type: "applyCode", path, content: decodeURIComponent(encoded) });
  }));
  document.querySelector<HTMLButtonElement>("#send")?.addEventListener("click", () => {
    if (state.busy) {
      post({ type: "stop" });
      return;
    }
    const prompt = document.querySelector<HTMLTextAreaElement>("#prompt")?.value.trim() ?? "";
    if (!prompt) return;
    post({ type: "send", prompt, model: state.selectedModel, mode: state.mode, includeSelection: false });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-retry]").forEach((button) => button.addEventListener("click", () => post({ type: "retryLast" })));
  document.querySelectorAll<HTMLButtonElement>("[data-regenerate]").forEach((button) => button.addEventListener("click", () => post({ type: "retryLast" })));
  document.querySelectorAll<HTMLButtonElement>(".copy-code").forEach((button) => button.addEventListener("click", async () => {
    const value = button.dataset.copy ?? "";
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied";
      setTimeout(() => { button.textContent = "Copy"; }, 1200);
    } catch {
      button.textContent = "Copy failed";
    }
  }));
  document.querySelector<HTMLTextAreaElement>("#prompt")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      document.querySelector<HTMLButtonElement>("#send")?.click();
    }
  });
}

window.addEventListener("message", (event: MessageEvent<{ type: string; state?: State }>) => {
  if (event.data.type === "state" && event.data.state) {
    state = event.data.state;
    queueRender();
  }
});

render();
post({ type: "ready" });
