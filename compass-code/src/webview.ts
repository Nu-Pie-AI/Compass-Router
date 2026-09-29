import type { AccountSummary, AgentMode, CompassModel, PermissionRequest, TranscriptItem, WorkStyle } from "./types.js";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void; getState(): unknown; setState(state: unknown): void };

const vscode = acquireVsCodeApi();
const root = document.querySelector<HTMLElement>("#app")!;
const modes: AgentMode[] = ["ask", "plan", "code", "debug"];

type State = {
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

const initial: State = {
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

let state = (vscode.getState() as State | undefined) ?? initial;
let workStyle: WorkStyle = "review";
let showHistory = false;

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
  root.innerHTML = state.connected ? connectedMarkup() : connectMarkup();
  bindEvents();
  vscode.setState(state);
  requestAnimationFrame(() => {
    const transcript = document.querySelector<HTMLElement>(".transcript");
    if (transcript) transcript.scrollTop = wasAtBottom ? transcript.scrollHeight : previousScrollTop;
  });
}

function connectMarkup(): string {
  const baseUrl = state.baseUrl || "https://compass-router-api-567790052414.us-central1.run.app";
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
      <label>Compass API URL<input id="base-url" value="${esc(baseUrl)}" spellcheck="false" /></label>
      <label>Compass API key<input id="api-key" type="password" placeholder="sk-compass-..." autocomplete="off" /></label>
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
  const history = showHistory ? `<section class="chat-history" aria-label="Conversation history"><button class="chat-history-item" id="history-current" type="button"><span>${esc(firstPrompt)}</span><time>now</time></button>${hasTranscript ? "" : `<div class="chat-history-empty">No conversations yet.</div>`}</section>` : "";
  const conversationHeader = hasTranscript ? `<section class="conversation-bar" aria-label="Current conversation">
      <button class="conversation-back" id="new-task-back" type="button" title="Back to new chat" aria-label="Back to new chat">&#x2190;</button>
      <span class="conversation-title">${esc(firstPrompt.slice(0, 72))}</span>
      <div class="conversation-actions"><button class="conversation-icon" type="button" title="Conversation history" aria-label="Conversation history" id="toggle-history">&#x22ef;</button><button class="conversation-icon" type="button" title="Restore last checkpoint" aria-label="Restore last checkpoint" id="restore-checkpoint">&#x21b6;</button></div>
    </section>` : `<section class="chat-list-header"><div class="chat-list-title"><strong>Chats</strong><span class="status-dot" aria-hidden="true"></span></div><div class="conversation-actions"><button class="conversation-icon" type="button" title="Conversation history" aria-label="Conversation history" id="toggle-history">&#x22ef;</button><button class="conversation-icon" type="button" title="Start a new chat" aria-label="Start a new chat" id="new-task-list">&#x270e;</button></div></section>`;
  return `<main class="agent-shell">
    <header class="topbar">
      <div class="topbar-title"><strong>COMPASS CODE: AGENT</strong><span class="status-dot" title="Connected"></span></div>
      <div class="top-actions"><button class="icon-button plain" id="refresh" title="Refresh models and account" aria-label="Refresh models and account">&#x21bb;</button><button class="icon-button plain" id="new-task" title="Start a new chat" aria-label="Start a new chat">&#x2b;</button><button class="icon-button plain" id="settings" title="Open Compass Code settings" aria-label="Open Compass Code settings">&#x2699;</button></div>
    </header>
    ${conversationHeader}
    ${history}
    ${state.error ? `<div class="alert error">${esc(state.error)}</div>` : ""}
    ${state.permission ? permissionMarkup(state.permission) : ""}
    <section class="transcript" aria-live="polite">${messages}</section>
    ${workedFor ? `<div class="worked-row"><span>${workedFor}</span><span aria-hidden="true">&#x203a;</span></div>` : ""}
    <section class="composer" aria-label="Compass Code composer">
      <textarea id="prompt" placeholder="${hasTranscript ? "Ask a follow-up about this workspace..." : "Ask Compass to inspect or change this workspace..."}" rows="3" ${state.busy ? "disabled" : ""}></textarea>
      <div class="composer-toolbar">
        <label class="select-control" title="Choose a model"><span class="sr-only">Model</span><select id="model" ${state.busy ? "disabled" : ""}>${modelOptions || "<option>No models available</option>"}</select></label>
        <label class="select-control mode-select" title="Choose a mode"><span class="sr-only">Mode</span><select id="mode" ${state.busy ? "disabled" : ""}>${modeOptions}</select></label>
        <button class="send" id="send" type="button" title="${state.busy ? "Stop task" : "Send message"}" aria-label="${state.busy ? "Stop task" : "Send message"}">${state.busy ? "&#x25a0;" : "&#x2191;"}</button>
      </div>
      <div class="composer-status"><span class="approval-note">Changes and terminal commands require approval</span></div>
    </section>
  </main>`;
}

function permissionMarkup(permission: PermissionRequest): string {
  return `<aside class="permission ${permission.kind}"><div><span class="eyebrow">${permission.kind.toUpperCase()} PERMISSION</span><strong>${esc(permission.toolName)}</strong><code>${esc(permission.summary)}</code></div><div class="permission-actions"><button class="secondary" data-permission="deny" data-permission-id="${esc(permission.id)}">Deny</button><button class="primary" data-permission="approve" data-permission-id="${esc(permission.id)}">Approve</button></div></aside>`;
}

function transcriptMarkup(item: TranscriptItem): string {
  const roleLabel = item.role === "user" ? "YOU" : item.role === "assistant" ? "COMPASS" : item.role.toUpperCase();
  const meta = item.meta ? `<div class="meta"><span>${esc(item.meta.model ?? "")}</span>${item.meta.tokens === undefined ? "" : `<span>${item.meta.tokens} tokens</span>`}${item.meta.costPaise === undefined ? "" : `<span>${formatPaise(item.meta.costPaise)}</span>`}${item.meta.latencyMs === undefined ? "" : `<span>${item.meta.latencyMs} ms</span>`}</div>` : "";
  if (item.role === "user") return `<article class="message user"><pre>${esc(item.content)}</pre></article>`;
  if (item.role === "assistant") return `<article class="message assistant"><pre>${esc(item.content)}</pre>${meta}</article>`;
  return `<article class="message ${item.role}"><div class="message-label">${esc(roleLabel)}${item.toolName ? ` &middot; ${esc(item.toolName)}` : ""}</div><pre>${esc(item.content)}</pre>${meta}</article>`;
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-work-style]").forEach((button) => button.addEventListener("click", () => {
    workStyle = button.dataset.workStyle as WorkStyle;
    render();
  }));
  document.querySelector<HTMLButtonElement>("#connect")?.addEventListener("click", () => {
    const baseUrl = document.querySelector<HTMLInputElement>("#base-url")?.value.trim() ?? "";
    const apiKey = document.querySelector<HTMLInputElement>("#api-key")?.value.trim() ?? "";
    if (!apiKey) return;
    post({ type: "connect", baseUrl, apiKey, workStyle });
  });
  document.querySelector<HTMLButtonElement>("#disconnect")?.addEventListener("click", () => post({ type: "disconnect" }));
  document.querySelector<HTMLButtonElement>("#refresh")?.addEventListener("click", () => post({ type: "refresh" }));
  document.querySelector<HTMLButtonElement>("#new-task")?.addEventListener("click", () => post({ type: "newTask" }));
  document.querySelector<HTMLButtonElement>("#new-task-back")?.addEventListener("click", () => post({ type: "newTask" }));
  document.querySelector<HTMLButtonElement>("#new-task-list")?.addEventListener("click", () => post({ type: "newTask" }));
  document.querySelector<HTMLButtonElement>("#toggle-history")?.addEventListener("click", () => {
    showHistory = !showHistory;
    render();
  });
  document.querySelector<HTMLButtonElement>("#history-current")?.addEventListener("click", () => {
    showHistory = false;
    render();
  });
  document.querySelector<HTMLButtonElement>("#restore-checkpoint")?.addEventListener("click", () => post({ type: "restoreCheckpoint" }));
  document.querySelector<HTMLButtonElement>("#settings")?.addEventListener("click", () => post({ type: "openSettings" }));
  document.querySelector<HTMLSelectElement>("#model")?.addEventListener("change", (event) => post({ type: "setModel", model: (event.target as HTMLSelectElement).value }));
  document.querySelector<HTMLSelectElement>("#mode")?.addEventListener("change", (event) => post({ type: "setMode", mode: (event.target as HTMLSelectElement).value as AgentMode }));
  document.querySelectorAll<HTMLButtonElement>("[data-permission]").forEach((button) => button.addEventListener("click", () => post({ type: "permission", id: button.dataset.permissionId, approved: button.dataset.permission === "approve" })));
  document.querySelector<HTMLButtonElement>("#send")?.addEventListener("click", () => {
    if (state.busy) {
      post({ type: "stop" });
      return;
    }
    const prompt = document.querySelector<HTMLTextAreaElement>("#prompt")?.value.trim() ?? "";
    if (!prompt) return;
    post({ type: "send", prompt, model: state.selectedModel, mode: state.mode, includeSelection: false });
  });
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
    render();
  }
});

render();
post({ type: "ready" });
