import React, { memo, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import DOMPurify from "dompurify";
import { marked } from "marked";
import hljs from "highlight.js/lib/common";
import type {
  AccountSummary,
  AgentGoal,
  AgentMode,
  CompassModel,
  ConversationSummary,
  PermissionRequest,
  ProviderKind,
  TranscriptItem,
  WorkStyle,
} from "../types.js";

import type { ViewState as State, ViewMessage } from "../protocol.js";
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
const bridge = acquireVsCodeApi();
const post = (message: ViewMessage) => bridge.postMessage(message);
const initial: State = {
  baseUrl: "https://compass-router-api-c4psf2dvua-uc.a.run.app",
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
  goal: null,
};
type Page = "chat" | "history" | "settings" | "account" | "connect";
const money = (value: number) => `Rs ${(value / 100).toFixed(2)}`;
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
  const path = lang?.match(/(?:^|\s)(?:path|file)=([^\s]+)/i)?.[1];
  const language = (lang || "").split(/\s/)[0];
  const code = hljs.getLanguage(language)
    ? hljs.highlight(text, { language }).value
    : escape(text);
  return `<section class="code-block"><div class="actions"><span>${escape(path || language || "code")}</span><button data-copy="${escape(text)}">Copy code</button>${path ? `<button data-open="${escape(path)}">Open file</button><button data-path="${escape(path)}" data-code="${escape(text)}">Apply to file</button>` : ""}</div><pre><code>${code}</code></pre></section>`;
};
function Markdown({ content, busy }: { content: string; busy: boolean }) {
  return (
    <div
      className="markdown"
      onClick={(e) => {
        const button = (e.target as HTMLElement).closest("button");
        if (!button) return;
        if (button.dataset.copy !== undefined)
          void navigator.clipboard.writeText(button.dataset.copy).then(
            () => {
              button.textContent = "Copied";
            },
            () => {
              button.textContent = "Copy failed";
            },
          );
        if (button.dataset.open)
          post({ type: "openFile", path: button.dataset.open });
        if (!busy && button.dataset.path && button.dataset.code !== undefined)
          post({
            type: "applyCode",
            path: button.dataset.path,
            content: button.dataset.code,
          });
      }}
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(
          marked.parse(content, { async: false, renderer }) as string,
        ),
      }}
    />
  );
}
function Icon({ name }: { name: string }) {
  return <span aria-hidden="true" className={`codicon codicon-${name}`} />;
}
function Action({
  name,
  label,
  onClick,
  disabled = false,
}: {
  name: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="icon"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={name} />
    </button>
  );
}
function Connection({ state, standalone = false, providerOverride, onCancel }: { state: State; standalone?: boolean; providerOverride?: ProviderKind; onCancel?: () => void }) {
  const [provider, setProvider] = useState(providerOverride ?? state.provider);
  const [url, setUrl] = useState(state.baseUrl);
  const [key, setKey] = useState("");
  const [style, setStyle] = useState<WorkStyle>("review");
  const [showConnect, setShowConnect] = useState(standalone);
  useEffect(() => {
    if (providerOverride) {
      setProvider(providerOverride);
      setUrl(providerOverride === "ollama" ? "http://127.0.0.1:11434" : providerOverride === "compass" ? initial.baseUrl : "");
      setKey("");
    }
  }, [providerOverride]);
  if (!showConnect) {
    return (
      <section className="onboarding page">
        <div className="onboarding-mark" aria-hidden="true">
          <Icon name="compass" />
        </div>
        <h1>Welcome to Compass Router</h1>
        <p className="onboarding-intro">
          Your AI coding partner, connected to the models and controls in your
          Compass workspace.
        </p>
        <section className="onboarding-card" aria-labelledby="work-style-title">
          <h2 id="work-style-title">Choose how you want to work</h2>
          <button
            type="button"
            className={`work-option ${style === "review" ? "selected" : ""}`}
            onClick={() => setStyle("review")}
          >
            <strong>REVIEW FIRST</strong>
            <span>Compass pauses and shows you its plan as it works.</span>
            <small>Asks before editing files or running commands.</small>
            <small>Expands reasoning, commands, and edits for review.</small>
          </button>
          <button
            type="button"
            className={`work-option ${style === "autonomous" ? "selected" : ""}`}
            onClick={() => setStyle("autonomous")}
          >
            <strong>HIGH AUTONOMY</strong>
            <span>Fewer interruptions for a streamlined workflow.</span>
            <small>Edits files and runs commands without asking.</small>
            <small>Collapses tool details, with a compact progress view.</small>
          </button>
          <p className="onboarding-hint">
            You can change these options any time in Settings.
          </p>
          <button className="primary full" type="button" onClick={() => setShowConnect(true)}>
            Connect a workspace <Icon name="arrow-right" />
          </button>
        </section>
        <div className="onboarding-composer" aria-label="Compass Router composer preview">
          <span>Connect Compass Router to start a task</span>
          <div><Icon name="add" /><span>Code</span><span>No model</span><Icon name="arrow-up" /></div>
        </div>
      </section>
    );
  }
  return (
    <form
      className="page connect-page"
      onSubmit={(e) => {
        e.preventDefault();
        post({
          type: "connect",
          provider,
          baseUrl: url.trim(),
          apiKey: key.trim(),
          workStyle: style,
        });
      }}
    >
      <button type="button" className="back-link" onClick={() => onCancel ? onCancel() : setShowConnect(false)}>
        <Icon name="arrow-left" /> {onCancel ? "Back to providers" : "Back to welcome"}
      </button>
      <h1>{provider === "compass" ? "Connect a Compass workspace" : "Connect a direct provider"}</h1>
      <p className="muted">{provider === "compass" ? "Use a Compass API key created in the web console. It is stored only in VS Code SecretStorage." : "Use a provider directly from this workspace. Requests bypass Compass billing and routing."}</p>
      <label>
        Provider
        <select
          value={provider}
          onChange={(e) => {
            const next = e.target.value as ProviderKind;
            setProvider(next);
            setKey("");
            setUrl(
              next === "ollama"
                ? "http://127.0.0.1:11434"
                : next === "compass"
                  ? initial.baseUrl
                  : "",
            );
          }}
        >
          <option value="compass">Compass Router</option>
          <option value="openai-compatible">OpenAI-compatible</option>
          <option value="ollama">Ollama</option>
        </select>
      </label>
      <label>
        API base URL
        <input
          required
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          spellCheck={false}
        />
      </label>
      {provider !== "ollama" && (
        <label>
          {provider === "compass" ? "Compass workspace API key" : "Provider API key"}
          <input
            required
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
      )}
      <label>
        Approval mode
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as WorkStyle)}
        >
          <option value="review">Review first</option>
          <option value="autonomous">High autonomy</option>
        </select>
      </label>
      {style === "autonomous" && (
        <p>File edits and terminal commands will run without approval.</p>
      )}
      <button className="primary" disabled={state.connecting}>
        {state.connecting ? "Connecting..." : provider === "compass" ? "Connect workspace" : "Connect provider"}
      </button>
    </form>
  );
}

type SettingsSection =
  | "models"
  | "providers"
  | "behaviour"
  | "about";

const settingsSections: Array<[SettingsSection, string, string]> = [
  ["models", "Models", "symbol-misc"],
  ["providers", "Providers", "server"],
  ["behaviour", "Agent Behaviour", "sparkle"],
  ["about", "About Compass Router", "info"],
];

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function Settings({ state, onBack }: { state: State; onBack: () => void }) {
  const [section, setSection] = useState<SettingsSection>("models");
  const selectedModel = state.selectedModel || state.models[0]?.id || "";
  const modelOptions = state.models.map((model) => (
    <option key={model.id} value={model.id}>{model.id}</option>
  ));
  const renderSection = () => {
    if (section === "models") {
      return <>
        <h1>Models</h1>
        <p className="settings-lede">Choose the models Compass Router uses for conversations and agent work.</p>
        <SettingRow title="Default Model" description="Primary model for conversations">
          <select aria-label="Default Model" value={selectedModel} disabled={!state.models.length} onChange={(e) => post({ type: "setModel", model: e.target.value })}>{modelOptions || <option>No models available</option>}</select>
        </SettingRow>
        <div className="model-list"><strong>Available models</strong>{state.models.length ? state.models.map((model) => <span key={model.id}><Icon name="check" /> {model.id}</span>) : <span className="muted">No models loaded. Use Reload to fetch them.</span>}</div>
      </>;
    }
    if (section === "providers") {
      const gatewayConnected = state.connected && state.provider === "compass";
      const directProvider = state.connected && state.provider !== "compass" ? state.provider : null;
      return <>
        <h1>Providers</h1>
        <p className="settings-lede">Choose how this extension reaches models. Compass Router is the governed gateway; direct providers stay local to this VS Code profile.</p>
        <section className="provider-group" aria-labelledby="gateway-heading">
          <div className="provider-group-heading"><div><h2 id="gateway-heading">Compass Router gateway</h2><p>Routes requests through your Compass workspace, including model access, usage, and billing.</p></div><span className={`provider-status ${gatewayConnected ? "is-connected" : "is-disconnected"}`}><span className="status-dot" /> {gatewayConnected ? "Connected" : "Not active"}</span></div>
          <div className="provider-card"><span className="provider-mark"><Icon name="compass" /></span><div><strong>Compass Router</strong><p>{state.baseUrl}</p><small>{state.account ? `${state.account.team?.name || "Compass workspace"} · ${state.account.api_key.name}` : "No workspace credential is stored on this device."}</small></div></div>
          <div className="actions"><button className="secondary" disabled={!gatewayConnected || state.connecting} onClick={() => post({ type: "refresh" })}><Icon name="refresh" /> Refresh models</button><button className="secondary" onClick={() => post({ type: "openAccount" })}><Icon name="account" /> Account</button>{gatewayConnected ? <button className="danger-button" onClick={() => post({ type: "disconnect" })}><Icon name="sign-out" /> Sign out on this device</button> : <button className="primary" onClick={() => post({ type: "openConnect", provider: "compass" })}><Icon name="plug" /> Connect workspace</button>}</div>
        </section>
        <section className="provider-group" aria-labelledby="direct-heading">
          <div className="provider-group-heading"><div><h2 id="direct-heading">Direct provider connections</h2><p>Optional developer connections that do not use Compass account billing or routing.</p></div></div>
          <div className="provider-option"><div><strong>OpenAI-compatible</strong><p>Connect a compatible endpoint with its own URL and API key.</p></div><div className="provider-option-actions"><span className={`provider-status ${directProvider === "openai-compatible" ? "is-connected" : "is-disconnected"}`}><span className="status-dot" /> {directProvider === "openai-compatible" ? "Active" : "Not active"}</span><button className="secondary" onClick={() => post({ type: "openConnect", provider: "openai-compatible" })}><Icon name="plug" /> Configure</button></div></div>
          <div className="provider-option"><div><strong>Ollama</strong><p>Use a local Ollama server, normally at 127.0.0.1:11434. No key is stored.</p></div><div className="provider-option-actions"><span className={`provider-status ${directProvider === "ollama" ? "is-connected" : "is-disconnected"}`}><span className="status-dot" /> {directProvider === "ollama" ? "Active" : "Not active"}</span><button className="secondary" onClick={() => post({ type: "openConnect", provider: "ollama" })}><Icon name="plug" /> Configure</button></div></div>
        </section>
      </>;
    }
    if (section === "behaviour") {
      return <><h1>Agent Behaviour</h1><p className="settings-lede">Control the mode used for new Compass tasks.</p><SettingRow title="Task mode" description="Default mode for new conversations"><select aria-label="Task mode" value={state.mode} onChange={(e) => post({ type: "setMode", mode: e.target.value as AgentMode })}>{["ask", "plan", "code", "debug"].map((mode) => <option key={mode}>{mode}</option>)}</select></SettingRow><p className="settings-note">File edits and terminal commands always require an approval decision in the current session.</p></>;
    }
    if (section === "about") return <><h1>About Compass Router</h1><p className="settings-lede">Compass Router brings governed model access and workspace tools into VS Code.</p><div className="about-panel"><strong>Compass Router Agent</strong><span>Live provider routing with approval-gated workspace actions.</span><code>VS Code extension 0.3.5</code></div></>;
    return <><h1>{settingsSections.find(([id]) => id === section)?.[1]}</h1><p className="settings-lede">Configure this Compass Router workspace.</p><div className="settings-placeholder"><Icon name="settings-gear" /><strong>Ready to configure</strong><span>These controls are scoped to this workspace.</span></div></>;
  };
  return <section className="settings-page" aria-label="Settings">
    <div className="settings-toolbar"><div className="settings-heading"><button className="settings-back" aria-label="Back to chat" onClick={onBack}><Icon name="arrow-left" /></button><h2>Settings</h2></div><button className="toolbar-action" onClick={() => post({ type: "refresh" })}><Icon name="refresh" /> Reload</button></div>
    <div className="settings-layout"><aside className="settings-sidebar">{settingsSections.map(([id, label, icon]) => <button key={id} className={section === id ? "selected" : ""} onClick={() => setSection(id)}><Icon name={icon} /> <span>{label}</span></button>)}</aside><div className="settings-content">{renderSection()}</div></div>
  </section>;
}

function Account({ state }: { state: State }) {
  return <section className="page account-page">
    <h1>Account</h1>
    <p className="settings-lede">Manage the Compass workspace connection used by this extension.</p>
    {state.account ? <>
      <div className="account-card"><div className="account-avatar"><Icon name="account" /></div><div><strong>{state.account.team?.name || "Compass workspace"}</strong><span>{state.account.api_key.name}</span><small>Workspace API key stored in VS Code SecretStorage</small></div><span className="provider-status is-connected"><span className="status-dot" /> Workspace connected</span></div>
      <p className="account-note">This extension uses a workspace API key for metered model requests. Signing out removes the key from this device; revoke the key in the Compass console if it should stop working everywhere.</p>
      <dl>
        <dt>Balance</dt><dd>{money(state.account.wallet?.balance_paise || 0)}</dd>
        <dt>Requests</dt><dd>{state.account.usage.requests}</dd>
        <dt>Tokens</dt><dd>{state.account.usage.tokens.toLocaleString()}</dd>
        <dt>Spend</dt><dd>{money(state.account.usage.spend_paise)}</dd>
      </dl>
      <div className="actions"><button className="secondary" onClick={() => post({ type: "openDashboard" })}><Icon name="link-external" /> Manage in console</button><button className="secondary" onClick={() => post({ type: "login" })}><Icon name="sign-in" /> Switch workspace key</button><button className="danger-button" onClick={() => post({ type: "disconnect" })}><Icon name="sign-out" /> Sign out on this device</button></div>
    </> : <div className="account-empty"><Icon name="account" /><strong>No Compass workspace connected</strong><span>Sign in to the Compass web console, create or copy a workspace API key, then connect it here. The extension uses that key for model access and usage tracking.</span><div className="actions"><button className="secondary" onClick={() => post({ type: "openDashboard" })}><Icon name="link-external" /> Open Compass console</button><button className="primary" onClick={() => post({ type: "login" })}><Icon name="plug" /> Connect workspace</button></div></div>}
  </section>;
}
const Message = memo(function Message({
  item,
  busy,
}: {
  item: TranscriptItem;
  busy: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (item.role === "tool")
    return (
      <details className="tool">
        <summary>
          <Icon name="tools" /> {item.toolName || "Workspace action"}
        </summary>
        <pre>{item.content}</pre>
        {item.path && (
          <button onClick={() => post({ type: "openFile", path: item.path! })}>
            Open file
          </button>
        )}
      </details>
    );
  if (item.role === "status") return <p className="muted">{item.content}</p>;
  return (
    <article className={`message ${item.role}`}>
      <header>
        {item.role === "user"
          ? "You"
          : item.role === "error"
            ? "Request failed"
            : "Compass"}
        {item.streaming && <span className="muted">Working...</span>}
      </header>
      {item.role === "assistant" ? (
        item.streaming && !item.content ? (
          <div className="thinking" role="status"><span className="thinking-dot" />Compass is thinking...</div>
        ) : (
          <>
            <Markdown content={item.content} busy={busy} />
            {item.streaming && <span className="streaming-cursor" aria-label="Still generating" />}
          </>
        )
      ) : (
        <pre>{item.content}</pre>
      )}
      {item.meta && (
        <div className="meta">
          {item.meta.model}{" "}
          {item.meta.tokens !== undefined && ` / ${item.meta.tokens} tokens`}{" "}
          {item.meta.costPaise !== undefined &&
            ` / ${money(item.meta.costPaise)}`}
        </div>
      )}
      {item.role === "assistant" && (
        <div className="actions">
          <Action
            name={copied ? "check" : "copy"}
            label={copied ? "Copied" : "Copy response"}
            onClick={() => {
              void navigator.clipboard.writeText(item.content).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          />
          <Action
            name="refresh"
            label="Retry last request"
            disabled={busy}
            onClick={() => post({ type: "retryLast" })}
          />
        </div>
      )}
      {item.role === "error" && (
        <button disabled={busy} onClick={() => post({ type: "retryLast" })}>
          Retry
        </button>
      )}
    </article>
  );
});
function Goal({ goal, busy }: { goal: AgentGoal; busy: boolean }) {
  const completed = goal.plan.filter((step) => step.status === "completed").length;
  return (
    <details className="goal">
      <summary>
        <Icon name="checklist" />
        <strong>Task plan</strong>
        <span>{completed}/{goal.plan.length} complete</span>
        <span>{goal.status}</span>
      </summary>
      <ol>
        {goal.plan.map((step) => (
          <li key={step.id}>
            <Icon
              name={
                step.status === "completed"
                  ? "pass"
                  : step.status === "failed"
                    ? "error"
                    : "circle-outline"
              }
            />
            {step.title}
            <small>{step.status}</small>
          </li>
        ))}
      </ol>
      {goal.changedFiles.map((file) => (
        <button
          className="file"
          key={file.path}
          onClick={() => post({ type: "openFile", path: file.path })}
        >
          {file.path}
          <span>
            +{file.addedLines} / -{file.removedLines}
          </span>
        </button>
      ))}
      {goal.activity.slice(-5).map((activity) => (
        <details key={activity.id}>
          <summary>{activity.title}</summary>
          <pre>{activity.detail || activity.status}</pre>
        </details>
      ))}
      <div className="actions">
        {busy ? (
          <>
            <button onClick={() => post({ type: "pauseGoal" })}>Pause</button>
            <button onClick={() => post({ type: "cancelGoal" })}>Cancel</button>
          </>
        ) : (
          (goal.status === "paused" || goal.status === "failed") && (
            <button onClick={() => post({ type: "resumeGoal" })}>Resume</button>
          )
        )}
        <button
          disabled={busy}
          onClick={() => post({ type: "restoreCheckpoint" })}
        >
          Restore checkpoint
        </button>
        {goal.changedFiles.length > 0 && (
          <button disabled={busy} onClick={() => post({ type: "reviewGoal" })}>
            Review changes
          </button>
        )}
      </div>
    </details>
  );
}
function Permission({ permission }: { permission: PermissionRequest }) {
  const [pending, setPending] = useState(false);
  return (
    <aside className="permission" aria-label="Approval required">
      <strong>Approval required: {permission.toolName}</strong>
      <pre>{permission.summary}</pre>
      {permission.preview && (
        <details>
          <summary>Proposed changes</summary>
          <pre>{permission.preview}</pre>
        </details>
      )}
      <div className="actions">
        {permission.changeId && (
          <button onClick={() => post({ type: "openDiff", id: permission.id })}>
            Open diff
          </button>
        )}
        {(permission.decisions || ["once", "deny"]).map((decision) => (
          <button
            disabled={pending}
            className={decision === "once" ? "primary" : ""}
            key={decision}
            onClick={() => {
              setPending(true);
              post({ type: "permission", id: permission.id, decision });
            }}
          >
            {
              {
                once: "Allow once",
                session: "Allow this session",
                always: "Always allow",
                deny: "Reject",
                "session-deny": "Reject this session",
              }[decision]
            }
          </button>
        ))}
      </div>
    </aside>
  );
}
const modeDetails: Record<string, { label: string; description: string; icon: string }> = {
  ask: { label: "Ask", description: "Explore and explain without changing files", icon: "comment-discussion" },
  plan: { label: "Plan", description: "Investigate and produce an implementation plan", icon: "list-tree" },
  code: { label: "Code", description: "Implement the request and validate the result", icon: "code" },
  debug: { label: "Debug", description: "Diagnose failures and apply focused fixes", icon: "bug" },
};
function ChatHeader({ state, onNewTask }: { state: State; onNewTask: () => void }) {
  const [menu, setMenu] = useState(false);
  const [now, setNow] = useState(Date.now());
  const mode = modeDetails[state.mode] || modeDetails.ask;
  const title = state.goal?.title || "New conversation";
  useEffect(() => {
    if (!state.busy) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.busy]);
  const elapsed = state.goal
    ? Math.max(0, state.goal.elapsedMs + (state.busy ? now - state.goal.updatedAt : 0))
    : 0;
  const seconds = Math.floor(elapsed / 1000);
  const status = state.busy
    ? seconds >= 20 ? `Provider is taking longer than expected · ${seconds}s` : `Working on your task · ${seconds}s`
    : `${mode.label} mode · ${state.selectedModel || "No model"}`;
  return (
    <header className="chat-header">
      <div className="chat-title">
        <span className="status-dot" data-busy={state.busy} />
        <div>
          <strong>{title}</strong>
          <small>{status}</small>
        </div>
      </div>
      <div className="chat-actions">
        <Action name="copy" label="Copy conversation" disabled={!state.transcript.length} onClick={() => post({ type: "copyTranscript" })} />
        <Action name="save" label="Export conversation" disabled={!state.transcript.length} onClick={() => post({ type: "exportTranscript" })} />
        <Action name="add" label="New task" disabled={state.busy} onClick={onNewTask} />
        <div className="menu-wrap">
          <Action name="ellipsis" label="Conversation options" onClick={() => setMenu((value) => !value)} />
          {menu && (
            <div className="menu" role="menu">
              <button onClick={() => { post({ type: "copyTranscript" }); setMenu(false); }}><Icon name="copy" /> Copy transcript</button>
              <button onClick={() => { post({ type: "exportTranscript" }); setMenu(false); }}><Icon name="save" /> Export as Markdown</button>
              <button onClick={() => { post({ type: "openSettings" }); setMenu(false); }}><Icon name="settings-gear" /> Chat settings</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
function ProgressStrip({ goal }: { goal: AgentGoal | null }) {
  if (!goal) return null;
  const done = goal.plan.filter((step) => step.status === "completed").length;
  const total = goal.plan.length || 1;
  return (
    <div className="progress-strip" aria-label="Task progress">
      <div className="progress-copy"><Icon name="checklist" /><span>{done}/{total} steps complete</span><strong>{goal.status}</strong></div>
      <div className="progress-track"><span style={{ width: `${Math.min(100, Math.round((done / total) * 100))}%` }} /></div>
    </div>
  );
}
function History({ state, open }: { state: State; open: () => void }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  return (
    <section className="page">
      <h2>History</h2>
      <input
        aria-label="Search conversations"
        type="search"
        placeholder="Search conversations"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {state.conversations
        .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
        .map((c) => (
          <div className="history-row" key={c.id}>
            {editing === c.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (title.trim()) {
                    post({
                      type: "renameConversation",
                      id: c.id,
                      title: title.trim(),
                    });
                    setEditing(null);
                  }
                }}
              >
                <input
                  autoFocus
                  aria-label="Conversation name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <button>Save</button>
                <button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <button
                  className="history-open"
                  disabled={state.busy}
                  onClick={() => {
                    post({ type: "openConversation", id: c.id });
                    open();
                  }}
                >
                  <strong>{c.title}</strong>
                  <small>
                    {new Date(c.updatedAt).toLocaleDateString()} /{" "}
                    {c.mode || "ask"}
                  </small>
                </button>
                <Action
                  name="edit"
                  label="Rename conversation"
                  disabled={state.busy}
                  onClick={() => {
                    setEditing(c.id);
                    setTitle(c.title);
                  }}
                />
                <Action
                  name="trash"
                  label="Delete conversation"
                  disabled={state.busy}
                  onClick={() => setDeleting(c.id)}
                />
              </>
            )}
            {deleting === c.id && (
              <div className="confirm" role="alert">
                Delete this conversation?
                <button
                  onClick={() => {
                    post({ type: "deleteConversation", id: c.id });
                    setDeleting(null);
                  }}
                >
                  Delete
                </button>
                <button onClick={() => setDeleting(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      {!state.conversations.length && (
        <p className="muted">No conversations yet.</p>
      )}
    </section>
  );
}
function App() {
  const saved = bridge.getState() as
    { draft?: string; page?: Page } | undefined;
  const [state, setState] = useState(initial);
  const [initialized, setInitialized] = useState(false);
  const [page, setPage] = useState<Page>(saved?.page || "chat");
  const [draft, setDraft] = useState(saved?.draft || "");
  const [context, setContext] = useState(false);
  const [contextRefs, setContextRefs] = useState<string[]>([]);
  const [commands, setCommands] = useState(false);
  const [sending, setSending] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [jump, setJump] = useState(false);
  const [connectProvider, setConnectProvider] = useState<ProviderKind | undefined>();
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data?.type === "state" && event.data.state) {
        setState(event.data.state);
        setInitialized(true);
        setSending(false);
      }
      if (event.data?.type === "navigate" && event.data.page) {
        setPage(event.data.page as Page);
        setConnectProvider(event.data.provider as ProviderKind | undefined);
      }
    };
    window.addEventListener("message", receive);
    post({ type: "ready" });
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    bridge.setState({ draft, page });
  }, [draft, page]);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [state.transcript, state.goal, page]);
  const send = () => {
    if (!draft.trim() || state.busy || sending || !state.selectedModel) return;
    setSending(true);
    const command = draft.trim();
    const commandMatch = command.match(/^\/(new|clear|models|mode\s+(ask|plan|code|debug))\b/i);
    if (commandMatch) {
      const value = commandMatch[1].toLowerCase();
      if (value === "new" || value === "clear") {
        post({ type: "newTask" });
        setDraft("");
        setCommands(false);
        return;
      }
      if (value === "mode") {
        post({ type: "setMode", mode: commandMatch[2] as AgentMode });
        setDraft("");
        setCommands(false);
        return;
      }
    }
    const references = contextRefs.length ? `\n\nContext: ${contextRefs.map((item) => `@${item}`).join(" ")}` : "";
    post({
      type: "send",
      prompt: `${command}${references}`,
      model: state.selectedModel,
      mode: state.mode,
      includeSelection: false,
    });
    setDraft("");
    setContextRefs([]);
    setCommands(false);
    follow.current = true;
  };
  return (
    <main className="shell">
      <header className="brand">
        <Icon name="compass" />
        <strong>Compass Router</strong>
        <span className="connection-state">
          {state.connecting
            ? "Connecting"
            : state.connected
              ? "Connected"
              : "Disconnected"}
        </span>
      </header>
      {state.error && (
        <div className="error" role="alert">
          {state.error}
          <Action
            name="refresh"
            label="Retry connection"
            disabled={state.connecting || state.busy}
            onClick={() => post({ type: "refresh" })}
          />
        </div>
      )}
      {!initialized ? (
        <p role="status">Loading connection...</p>
      ) : page === "connect" ? (
        <Connection state={state} standalone providerOverride={connectProvider} onCancel={() => setPage("settings")} />
      ) : !state.connected && page !== "account" ? (
        <Connection state={state} />
      ) : (
        <>
          {page === "history" && (
            <History state={state} open={() => setPage("chat")} />
          )}
          {page === "settings" && (
            <Settings state={state} onBack={() => setPage("chat")} />
          )}
          {page === "account" && <Account state={state} />}
          {page === "chat" && (
            <>
              <ChatHeader state={state} onNewTask={() => { post({ type: "newTask" }); setDraft(""); setContextRefs([]); }} />
              <ProgressStrip goal={state.goal} />
              <div
                className="transcript"
                ref={scroll}
                onScroll={() => {
                  const el = scroll.current!;
                  follow.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 60;
                  setJump(!follow.current);
                }}
              >
                {state.goal && <Goal goal={state.goal} busy={state.busy} />}
                {!state.transcript.length && (
                  <div className="empty">
                    <Icon name="compass" />
                    <h2>What are we building?</h2>
                    <div className="suggestions">
                      {[
                        "Explain this workspace",
                        "Review the current changes",
                        "Find and fix a bug",
                      ].map((text) => (
                        <button key={text} onClick={() => setDraft(text)}>
                          {text}
                          <Icon name="arrow-right" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {state.transcript.map((item) => (
                  <Message key={item.id} item={item} busy={state.busy} />
                ))}
              </div>
              {jump && (
                <button
                  className="latest"
                  onClick={() => {
                    follow.current = true;
                    if (scroll.current)
                      scroll.current.scrollTop = scroll.current.scrollHeight;
                    setJump(false);
                  }}
                >
                  Jump to latest <Icon name="arrow-down" />
                </button>
              )}
              {state.permission && (
                <Permission
                  key={state.permission.id}
                  permission={state.permission}
                />
              )}
              <section className="composer">
                <textarea
                  aria-label="Message Compass"
                  placeholder="Ask Compass..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onFocus={() => setCommands(draft.startsWith("/"))}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                {commands && (
                  <div className="command-menu" role="listbox">
                    <strong>Commands</strong>
                    {["/new", "/models", "/mode ask", "/mode plan", "/mode code", "/mode debug"].map((command) => (
                      <button key={command} onClick={() => { setDraft(command); setCommands(false); }}><code>{command}</code><small>{command === "/new" ? "Start a new task" : command === "/models" ? "Choose a model below" : "Switch agent mode"}</small></button>
                    ))}
                  </div>
                )}
                {context && (
                  <div className="context">
                    {[
                      "file",
                      "folder",
                      "workspace",
                      "selection",
                      "terminal",
                      "git",
                      "problems",
                    ].map((value) => (
                      <button
                        className={contextRefs.includes(value) ? "selected" : ""}
                        key={value}
                        onClick={() => {
                          setContextRefs((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
                        }}
                      >
                        @{value}
                      </button>
                    ))}
                  </div>
                )}
                {contextRefs.length > 0 && <div className="context-chips">{contextRefs.map((value) => <button key={value} onClick={() => setContextRefs((items) => items.filter((item) => item !== value))}>@{value} <Icon name="close" /></button>)}</div>}
                <div className="composer-tools">
                  <Action
                    name="add"
                    label="Add context"
                    onClick={() => setContext(!context)}
                  />
                  <select
                    aria-label="Model"
                    value={state.selectedModel}
                    disabled={state.busy}
                    onChange={(e) =>
                      post({ type: "setModel", model: e.target.value })
                    }
                  >
                    {!state.models.length && (
                      <option value="">No models</option>
                    )}
                    {state.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.id}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Mode"
                    value={state.mode}
                    disabled={state.busy}
                    onChange={(e) =>
                      post({ type: "setMode", mode: e.target.value as AgentMode })
                    }
                  >
                    {["ask", "plan", "code", "debug"].map((mode) => (
                      <option key={mode}>{mode}</option>
                    ))}
                  </select>
                  <Action
                    name={state.busy ? "debug-stop" : "arrow-up"}
                    label={state.busy ? "Stop task" : "Send message"}
                    disabled={
                      !state.busy &&
                      (sending || !draft.trim() || !state.selectedModel)
                    }
                    onClick={() =>
                      state.busy ? post({ type: "stop" }) : send()
                    }
                  />
                  <Action name="comment-discussion" label="Show slash commands" onClick={() => { setCommands(!commands); setDraft((value) => value || "/"); }} />
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("app")!).render(<App />);
