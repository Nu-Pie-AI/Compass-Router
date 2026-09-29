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
  root.innerHTML = state.connected ? connectedMarkup() : connectMarkup();
  bindEvents();
  vscode.setState(state);
  requestAnimationFrame(() => {
    const transcript = document.querySelector<HTMLElement>(".transcript");
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
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
  const account = state.account;
  const modeButtons = modes.map((mode) => `<button class="mode ${state.mode === mode ? "selected" : ""}" data-mode="${mode}" title="${mode === "ask" ? "Read-only answers" : mode === "plan" ? "Read-only implementation plan" : mode === "code" ? "Edit files with approval" : "Investigate and fix with approval"}">${mode}</button>`).join("");
  const modelOptions = state.models.map((model) => `<option value="${esc(model.id)}" ${model.id === state.selectedModel ? "selected" : ""}>${esc(model.id)}</option>`).join("");
  const messages = state.transcript.length ? state.transcript.map(transcriptMarkup).join("") : `<div class="empty"><strong>Ready when you are.</strong><span>Ask Compass to explain, plan, debug, or change the code in this workspace.</span></div>`;
  return `<header class="topbar">
    <div class="topbar-brand"><span class="brand-logo small" aria-hidden="true"><svg viewBox="0 0 32 32" role="presentation"><path d="M6 9h13a4 4 0 1 0-4-4" /><path d="M26 23H13a4 4 0 1 0 4 4" /><circle cx="6" cy="9" r="3" /><circle cx="26" cy="23" r="3" /></svg></span><strong>COMPASS CODE</strong><span class="topbar-context">AGENT</span><span class="status-dot" title="Connected"></span></div>
    <div class="top-actions"><button class="icon-button" id="refresh" title="Refresh models and account">&#x21bb;</button><button class="icon-button" id="new-task" title="Start a new task">&#x2b;</button><button class="icon-button" id="disconnect" title="Disconnect API key">&#x00d7;</button></div>
  </header>
  <section class="account-strip">
    <div><span class="label">TEAM</span><strong>${esc(account?.team?.name ?? "Compass team")}</strong></div>
    <div><span class="label">WALLET</span><strong>${formatPaise(account?.wallet?.balance_paise ?? 0)}</strong></div>
    <div><span class="label">REQUESTS</span><strong>${account?.usage.requests ?? 0}</strong></div>
    <div><span class="label">SPEND</span><strong>${formatPaise(account?.usage.spend_paise ?? 0)}</strong></div>
  </section>
  <section class="control-panel">
    <label class="model-control"><span>MODEL</span><select id="model">${modelOptions || "<option>No models available</option>"}</select></label>
    <div class="mode-control"><span>MODE</span><div class="mode-group">${modeButtons}</div></div>
  </section>
  ${state.error ? `<div class="alert error">${esc(state.error)}</div>` : ""}
  ${state.permission ? permissionMarkup(state.permission) : ""}
  <section class="transcript" aria-live="polite">${messages}</section>
  <section class="composer">
    <textarea id="prompt" placeholder="Ask Compass to inspect or change this workspace..." rows="4" ${state.busy ? "disabled" : ""}></textarea>
    <div class="composer-footer"><label class="checkbox"><input id="include-selection" type="checkbox" checked ${state.busy ? "disabled" : ""} /> Include current selection</label><span class="hint">Writes and terminal commands require approval</span><button class="primary send" id="send">${state.busy ? "Stop" : "Send"}</button></div>
  </section>`;
}

function permissionMarkup(permission: PermissionRequest): string {
  return `<aside class="permission ${permission.kind}"><div><span class="eyebrow">${permission.kind.toUpperCase()} PERMISSION</span><strong>${esc(permission.toolName)}</strong><code>${esc(permission.summary)}</code></div><div class="permission-actions"><button class="secondary" data-permission="deny" data-permission-id="${esc(permission.id)}">Deny</button><button class="primary" data-permission="approve" data-permission-id="${esc(permission.id)}">Approve</button></div></aside>`;
}

function transcriptMarkup(item: TranscriptItem): string {
  const roleLabel = item.role === "user" ? "YOU" : item.role === "assistant" ? "COMPASS" : item.role.toUpperCase();
  const meta = item.meta ? `<div class="meta"><span>${esc(item.meta.model ?? "")}</span>${item.meta.tokens === undefined ? "" : `<span>${item.meta.tokens} tokens</span>`}${item.meta.costPaise === undefined ? "" : `<span>${formatPaise(item.meta.costPaise)}</span>`}${item.meta.latencyMs === undefined ? "" : `<span>${item.meta.latencyMs} ms</span>`}</div>` : "";
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
  document.querySelector<HTMLSelectElement>("#model")?.addEventListener("change", (event) => post({ type: "setModel", model: (event.target as HTMLSelectElement).value }));
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.addEventListener("click", () => post({ type: "setMode", mode: button.dataset.mode as AgentMode })));
  document.querySelectorAll<HTMLButtonElement>("[data-permission]").forEach((button) => button.addEventListener("click", () => post({ type: "permission", id: button.dataset.permissionId, approved: button.dataset.permission === "approve" })));
  document.querySelector<HTMLButtonElement>("#send")?.addEventListener("click", () => {
    if (state.busy) {
      post({ type: "stop" });
      return;
    }
    const prompt = document.querySelector<HTMLTextAreaElement>("#prompt")?.value.trim() ?? "";
    if (!prompt) return;
    post({ type: "send", prompt, model: state.selectedModel, mode: state.mode, includeSelection: document.querySelector<HTMLInputElement>("#include-selection")?.checked ?? false });
  });
  document.querySelector<HTMLTextAreaElement>("#prompt")?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") document.querySelector<HTMLButtonElement>("#send")?.click();
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
