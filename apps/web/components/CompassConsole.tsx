"use client";

import { Activity, BarChart3, BadgeIndianRupee, Building2, CheckCircle2, CircleAlert, Clock3, CreditCard, KeyRound, MessageSquare, Play, Send, ShieldCheck, Trash2, TrendingUp, UsersRound, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { apiFetch, formatPaise } from "../lib/api";
import { ConsoleShell } from "./ConsoleShell";
import { ApiKeyManager } from "./ApiKeyManager";
import { TeamsManager } from "./TeamsManager";
import { ModelDirectory } from "./ModelDirectory";
import { ByokManager } from "./ByokManager";
import { ActivityPage } from "./ActivityPage";

type Session = { token: string; user_id: string; email: string; organization_id?: string | null; role: string };
type ApiKey = { id: string; name: string; key: string; status: string; team_id?: string | null; allowed_models?: string[]; models_restricted?: boolean; last_used_at?: string | null; expires_at?: string | null };
type Model = { id: string; display_name: string; provider: string; provider_model_id?: string; capabilities?: string[]; context_window?: number; input_price_paise_per_1k: number; output_price_paise_per_1k: number; status: string };
type RouterModel = Model & { enabled: boolean; published: boolean; fallback_model_id?: string | null; provider_status: string; provider_enabled: boolean };
type RouterProvider = { name: string; enabled: boolean; status: string; last_health?: { status: string; latency_ms: number; error_rate: number; checked_at: string } | null };
type RequestRow = { id: string; status: string; error_code?: string | null; model: string; provider: string; tokens: number; input_tokens?: number; output_tokens?: number; cost_paise: number; latency_ms: number; created_at: string };
type LedgerRow = { id: string; type: string; amount_paise: number; balance_before: number; balance_after: number; reference_id: string; reference_type?: string; created_at?: string };
type BillingOrder = { id: string; team_id: string; provider: string; provider_order_id: string; payment_id?: string | null; amount_paise: number; refunded_paise: number; currency: string; status: string; failure_code?: string | null; failure_description?: string | null; created_at: string; completed_at?: string | null; can_complete: boolean; can_refund: boolean; checkout_key_id?: string | null };
type BillingInvoice = { id: string; invoice_number: string; order_id: string; total_paise: number; currency: string; status: string; created_at: string; paid_at?: string | null };
type BillingRefund = { id: string; order_id: string; amount_paise: number; status: string; reason: string; created_at: string; processed_at?: string | null };
type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type Workspace = { id: string; name: string; team_count: number; created_at?: string };
type Team = { id: string; workspace_id?: string | null; name: string; slug: string; is_active: boolean; wallet: { currency: string; balance_paise: number } };
type Dashboard = { mode: string; workspaces: Workspace[]; teams: Team[]; api_keys: ApiKey[]; models: Model[]; usage: { requests: number; tokens: number; spend_paise: number }; recent_requests: RequestRow[] };
type ProviderName = "openai" | "gemini" | "ollama_cloud";
type AdminMetrics = { requests: { total: number; successful: number; failed: number }; provider_health: { checks: number; open_circuits: number }; billing: { failed_orders: number; pending_refunds: number }; alerts: Array<string | null> };
type AdminLocal = { note: string; providers: Array<{ name: ProviderName; enabled: boolean; status: string; credential_status: string; has_configured_key: boolean; last_four: string }>; models: Model[]; routerModels?: RouterModel[]; routerProviders?: RouterProvider[]; metrics?: AdminMetrics | null };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; meta?: ChatMeta };
type ChatMeta = { requestId?: string; provider?: string; tokens?: number; costPaise?: number; latencyMs?: number; status?: string };
type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  compass?: { request_id?: string; provider?: string; latency_ms?: number; compass_cost_paise?: number };
};


const viewTitles: Record<string, [string, string]> = {
  dashboard: ["Overview", "Monitor routing, usage, and account health."],
  chat: ["Model chat", "Showcase live responses through the Compass gateway."],
  playground: ["Playground", "Inspect OpenAI-compatible requests and responses."],
  models: ["Models", "Browse available routes, providers, and pricing."],
  byok: ["Bring your own key", "Connect provider credentials to this team workspace."],
  "api-keys": ["API Keys", "Create and manage team-scoped credentials."],
  usage: ["Usage", "Review request status, tokens, cost, and latency."],
  activity: ["Activity", "Understand request volume, spend, tokens, and routing performance."],
  wallet: ["Billing", "Recharge wallet credits and inspect the billing ledger."],
  admin: ["Administration", "Configure teams, provider credentials, and pricing."],
  profile: ["Profile", "Manage your account details."],
  workspaces: ["Workspaces", "Manage team workspaces and their wallets."],
  teams: ["Teams", "Manage shared team wallets, members, and API access."],
};

const savedCompassKeyStorageKey = "compass.local.savedApiKey";
const sessionStorageKey = "compass.local.session";
const marketplaceUrl = process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? "http://localhost:3100";

export function CompassConsole({ view }: { view: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [admin, setAdmin] = useState<AdminLocal | null>(null);
  const [oneTimeKey, setOneTimeKey] = useState("");
  const [selectedKey, setSelectedKey] = useState(() => {
    if (typeof window === "undefined") return "";
    const savedKey = window.localStorage.getItem(savedCompassKeyStorageKey);
    return savedKey?.startsWith("sk-compass-") ? savedKey : "";
  });
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [keyName, setKeyName] = useState("Cline key");
  const [providerName, setProviderName] = useState<ProviderName>("openai");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceNotes, setWorkspaceNotes] = useState("");
  const [model, setModel] = useState("openai/gpt-5");
  const [prompt, setPrompt] = useState("Explain this Compass request in one sentence.");
  const [responseText, setResponseText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: "Select a model, paste a Compass API key, and send a message." },
  ]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const activeKey = useMemo(() => selectedKey || oneTimeKey, [selectedKey, oneTimeKey]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const saved = window.localStorage.getItem(sessionStorageKey);
      if (saved) {
        try { setSession(JSON.parse(saved) as Session); }
        catch { window.localStorage.removeItem(sessionStorageKey); }
      }
      setHydrated(true);
    });
  }, []);

  const loadData = useCallback(async (activeSession: Session) => {
    const [dash, adminData, usageRows, opsMetrics, routerModels, routerProviders] = await Promise.all([
      apiFetch<Dashboard>("/dashboard", {}, activeSession.token),
      activeSession.role === "admin" || activeSession.role === "super_admin"
        ? apiFetch<AdminLocal>("/admin/local-test", {}, activeSession.token)
        : Promise.resolve(null),
      apiFetch<RequestRow[]>("/usage/requests", {}, activeSession.token),
      activeSession.role === "admin" || activeSession.role === "super_admin"
        ? apiFetch<AdminMetrics>("/admin/operations/metrics", {}, activeSession.token)
        : Promise.resolve(null),
      activeSession.role === "admin" || activeSession.role === "super_admin"
        ? apiFetch<RouterModel[]>("/admin/router/models", {}, activeSession.token)
        : Promise.resolve(null),
      activeSession.role === "admin" || activeSession.role === "super_admin"
        ? apiFetch<RouterProvider[]>("/admin/router/providers", {}, activeSession.token)
        : Promise.resolve(null),
    ]);
    const preferredTeamId = selectedTeamId || window.localStorage.getItem("compass.local.workspaceTeamId") || "";
    const preferredWorkspaceId = selectedWorkspaceId || window.localStorage.getItem("compass.local.workspaceId") || "";
    const preferredTeam = dash.teams.find((team) => team.id === preferredTeamId);
    const workspaceId = dash.workspaces.some((workspace) => workspace.id === preferredWorkspaceId)
      ? preferredWorkspaceId
      : preferredTeam?.workspace_id ?? dash.workspaces[0]?.id;
    const teamId = preferredTeam && (!workspaceId || !preferredTeam.workspace_id || preferredTeam.workspace_id === workspaceId)
      ? preferredTeam.id
      : dash.teams.find((team) => !workspaceId || !team.workspace_id || team.workspace_id === workspaceId)?.id;
    if (teamId) window.localStorage.setItem("compass.local.workspaceTeamId", teamId);
    if (workspaceId) window.localStorage.setItem("compass.local.workspaceId", workspaceId);
    const ledgerRows = teamId ? await apiFetch<LedgerRow[]>(`/wallet/ledger?team_id=${teamId}`, {}, activeSession.token) : [];
    setDashboard({ ...dash, recent_requests: usageRows });
    setLedger(ledgerRows);
    setAdmin(adminData ? { ...adminData, metrics: opsMetrics, routerModels: routerModels ?? [], routerProviders: routerProviders ?? [] } : null);
    if (teamId && teamId !== selectedTeamId) setSelectedTeamId(teamId);
    if (workspaceId && workspaceId !== selectedWorkspaceId) setSelectedWorkspaceId(workspaceId);
    if (!model && dash.models[0]) setModel(dash.models[0].id);
  }, [model, selectedTeamId, selectedWorkspaceId]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try { await loadData(session); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not load console data."); }
  }, [loadData, session]);

  useEffect(() => {
    if (!session) return;
    void Promise.resolve().then(() => loadData(session)).catch((error) => setStatus(error instanceof Error ? error.message : "Could not load console data."));
  }, [loadData, session]);

  useEffect(() => {
    if (!hydrated || session) return;
    const loginUrl = new URL("/login", marketplaceUrl);
    loginUrl.searchParams.set("callbackUrl", "/compass");
    window.location.replace(loginUrl.toString());
  }, [hydrated, session]);

  function saveCompassKey() {
    const key = activeKey.trim();
    if (!key.startsWith("sk-compass-")) {
      setStatus("Paste a valid Compass API key before saving.");
      return;
    }
    window.localStorage.setItem(savedCompassKeyStorageKey, key);
    setSelectedKey(key);
    setStatus("Compass API key saved in this browser.");
  }

  function forgetCompassKey() {
    window.localStorage.removeItem(savedCompassKeyStorageKey);
    setSelectedKey("");
    setStatus("Saved Compass API key removed from this browser.");
  }

  async function createKey() {
    if (!session) return false;
    const teamId = selectedTeamId || dashboard?.teams[0]?.id;
    if (!teamId) {
      setStatus("Create a team before issuing a Compass API key.");
      return false;
    }
    setBusy(true);
    try {
      const path = session.role === "admin" || session.role === "super_admin" ? "/admin/api-keys" : "/api-keys";
      const key = await apiFetch<{ key: string }>(path, { method: "POST", body: JSON.stringify({ name: keyName, team_id: teamId, allowed_models: [] }) }, session.token);
      setOneTimeKey(key.key);
      setSelectedKey(key.key);
      setStatus("Compass API key created. This is the only time the full key is shown.");
      await loadData(session);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create key.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function updateKeyModels(id: string, models: string[]) {
    if (!session) return false;
    setBusy(true);
    try {
      await apiFetch(`/api-keys/${id}/models`, { method: "PATCH", body: JSON.stringify({ allowed_models: models }) }, session.token);
      setStatus(models.length ? "API key model restrictions updated." : "API key now has access to all available models.");
      await loadData(session);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update key model access.");
      return false;
    } finally { setBusy(false); }
  }

  async function revokeKeys(ids: string[]) {
    if (!session) return false;
    setBusy(true);
    try {
      for (const id of ids) await apiFetch(`/api-keys/${id}/revoke`, { method: "POST" }, session.token);
      setStatus("Selected API keys revoked.");
      await loadData(session);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not revoke keys.");
      await refresh();
      return false;
    } finally { setBusy(false); }
  }

  async function addCredits(amount_paise = 50000) {
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) return;
    const teamId = selectedTeamId || dashboard?.teams[0]?.id;
    if (!teamId) {
      setStatus("Create a team before crediting a wallet.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/admin/wallet/topups", { method: "POST", body: JSON.stringify({ team_id: teamId, amount_paise, idempotency_key: `local-topup-${Date.now()}` }) }, session.token);
      setStatus("Wallet credited.");
      await loadData(session);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not credit wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function runPrompt() {
    if (!activeKey) {
      setStatus("Create or paste a Compass API key first.");
      return;
    }
    setBusy(true);
    setStatus("Running request...");
    try {
      const result = await apiFetch<Record<string, unknown>>("/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${activeKey}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 64, stream: false }),
      });
      setResponseText(JSON.stringify(result, null, 2));
      setStatus("Request succeeded through Compass API.");
      if (session) await loadData(session);
    } catch (error) {
      setResponseText("");
      setStatus(error instanceof Error ? error.message : "Request failed.");
      if (session) await loadData(session);
    } finally {
      setBusy(false);
    }
  }

  async function sendChatMessage() {
    if (!session) return;
    const content = chatInput.trim();
    if (!activeKey) {
      setStatus("Paste a Compass API key before sending chat messages.");
      return;
    }
    if (!content) return;
    const outbound = [...chatMessages.filter((message) => message.id !== "welcome"), { id: `user-${Date.now()}`, role: "user" as const, content }];
    setChatMessages(outbound);
    setChatInput("");
    setBusy(true);
    setStatus("Sending chat through Compass...");
    try {
      const started = performance.now();
      const result = await apiFetch<ChatCompletionResponse>("/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${activeKey}` },
        body: JSON.stringify({
          model,
          messages: outbound.map((message) => ({ role: message.role, content: message.content })),
          max_tokens: 2048,
          stream: false,
        }),
      });
      const text = result.choices?.[0]?.message?.content?.trim() || "The provider returned an empty assistant message.";
      const meta: ChatMeta = {
        requestId: result.compass?.request_id,
        provider: result.compass?.provider,
        tokens: result.usage?.total_tokens,
        costPaise: result.compass?.compass_cost_paise,
        latencyMs: result.compass?.latency_ms ?? Math.round(performance.now() - started),
        status: "success",
      };
      setChatMessages([...outbound, { id: `assistant-${Date.now()}`, role: "assistant", content: text, meta }]);
      setStatus("Chat response completed through Compass.");
      await loadData(session);
    } catch (error) {
      setChatMessages([...outbound, { id: `assistant-error-${Date.now()}`, role: "assistant", content: error instanceof Error ? error.message : "Chat request failed.", meta: { status: "error" } }]);
      setStatus(error instanceof Error ? error.message : "Chat request failed.");
      await loadData(session);
    } finally {
      setBusy(false);
    }
  }

  function openWorkspaceDialog() {
    setWorkspaceName("");
    setWorkspaceNotes("");
    setWorkspaceDialogOpen(true);
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    if (!session) return;
    event.preventDefault();
    if (!workspaceName.trim()) return;
    setBusy(true);
    try {
      const created = await apiFetch<{ id: string }>("/workspaces", { method: "POST", body: JSON.stringify({ name: workspaceName.trim(), notes: workspaceNotes.trim() }) }, session.token);
      setSelectedWorkspaceId(created.id);
      setWorkspaceDialogOpen(false);
      setStatus("Workspace created and selected.");
      await loadData(session);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create workspace.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProviderCredential() {
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) return;
    if (!providerApiKey.trim()) {
      setStatus("Enter a provider API key before saving.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/admin/provider-credentials", { method: "POST", body: JSON.stringify({ provider: providerName, api_key: providerApiKey }) }, session.token);
      setProviderApiKey("");
      setStatus("Provider API key saved server-side. The raw key will not be shown again.");
      await loadData(session);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save provider key.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (session) {
      try { await apiFetch("/auth/logout", { method: "POST" }, session.token); } catch { /* local cleanup still signs the browser out */ }
    }
    window.localStorage.removeItem(sessionStorageKey);
    setSession(null);
    setDashboard(null);
    setAdmin(null);
    setLedger([]);
    window.location.assign(new URL("/compass/logout", marketplaceUrl).toString());
  }

  if (!hydrated) return <div className="console-auth-loading">Loading Compass...</div>;
  if (!session) return <div className="console-auth-loading">Continuing with Compass sign-in...</div>;

  const canManage = session.role === "admin" || session.role === "super_admin";
  const canCreateWorkspace = Boolean(session);
  const activeWorkspaceId = selectedWorkspaceId || dashboard?.workspaces[0]?.id || "";
  function changeWorkspace(workspaceId: string) {
    setSelectedWorkspaceId(workspaceId);
    const nextTeam = dashboard?.teams.find((team) => !team.workspace_id || team.workspace_id === workspaceId);
    setSelectedTeamId(nextTeam?.id ?? "");
  }
  return (
    <>
    <ConsoleShell view={view} title={(viewTitles[view] ?? ["Compass"])[0]} subtitle={(viewTitles[view] ?? ["", "AI routing control plane"])[1]} workspaces={dashboard?.workspaces ?? []} workspaceId={activeWorkspaceId} onWorkspaceChange={changeWorkspace} onRefresh={refresh} session={session} onLogout={logout} onCreateWorkspace={canCreateWorkspace ? openWorkspaceDialog : undefined}>
      <div className="flex flex-col gap-4">
         {status ? <Status>{status}</Status> : null}
        {view === "chat" ? <ChatShowcase dashboard={dashboard} selectedTeamId={selectedTeamId} model={model} setModel={setModel} oneTimeKey={oneTimeKey} selectedKey={selectedKey} setSelectedKey={setSelectedKey} saveCompassKey={saveCompassKey} forgetCompassKey={forgetCompassKey} chatInput={chatInput} setChatInput={setChatInput} messages={chatMessages} setMessages={setChatMessages} sendChatMessage={sendChatMessage} busy={busy} /> : null}
        {view === "playground" ? <Playground dashboard={dashboard} model={model} setModel={setModel} oneTimeKey={oneTimeKey} selectedKey={selectedKey} setSelectedKey={setSelectedKey} saveCompassKey={saveCompassKey} forgetCompassKey={forgetCompassKey} prompt={prompt} setPrompt={setPrompt} responseText={responseText} runPrompt={runPrompt} busy={busy} /> : null}
        {view === "api-keys" ? <ApiKeyManager dashboard={dashboard} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} keyName={keyName} setKeyName={setKeyName} oneTimeKey={oneTimeKey} dismissKey={() => setOneTimeKey("")} createKey={createKey} updateKeyModels={updateKeyModels} revokeKeys={revokeKeys} busy={busy} /> : null}
        {view === "models" ? <ModelDirectory published={dashboard?.models ?? []} token={session.token} teamId={selectedTeamId} onActivated={refresh} /> : null}
        {view === "byok" ? <ByokManager token={session.token} teamId={selectedTeamId} onChanged={refresh} /> : null}
        {view === "teams" ? <TeamsManager dashboard={dashboard} workspaceId={activeWorkspaceId} teamId={selectedTeamId} selectTeam={setSelectedTeamId} refresh={refresh} token={session.token} canManage={canManage} canCreate /> : null}
        {view === "usage" ? <Usage rows={dashboard?.recent_requests ?? []} /> : null}
        {view === "activity" ? <ActivityPage rows={dashboard?.recent_requests ?? []} /> : null}
        {view === "wallet" ? <WalletPage wallet={dashboard?.teams.find((team) => team.id === selectedTeamId)?.wallet ?? dashboard?.teams[0]?.wallet} ledger={ledger} teamId={selectedTeamId} token={session.token} refresh={refresh} /> : null}
        {view === "admin" ? canManage ? <AdminPage admin={admin} dashboard={dashboard} openWorkspaceDialog={openWorkspaceDialog} busy={busy} providerName={providerName} setProviderName={setProviderName} providerApiKey={providerApiKey} setProviderApiKey={setProviderApiKey} saveProviderCredential={saveProviderCredential} token={session.token} refresh={refresh} /> : <Status>Provider settings are available only to Compass administrators.</Status> : null}
        {view === "dashboard" ? <DashboardPage dashboard={dashboard} openWorkspaceDialog={openWorkspaceDialog} selectedTeamId={selectedTeamId} addCredits={addCredits} busy={busy} canCreate={canCreateWorkspace} canManage={canManage} /> : null}
        {view === "profile" ? <ProfilePage session={session} dashboard={dashboard} /> : null}
        {view === "workspaces" ? <WorkspaceDirectory dashboard={dashboard} selectedWorkspaceId={activeWorkspaceId} selectWorkspace={changeWorkspace} openWorkspaceDialog={openWorkspaceDialog} canCreate={canCreateWorkspace} /> : null}
      </div>
    </ConsoleShell>
    {canCreateWorkspace ? <WorkspaceDialog open={workspaceDialogOpen} name={workspaceName} notes={workspaceNotes} busy={busy} setOpen={setWorkspaceDialogOpen} setName={setWorkspaceName} setNotes={setWorkspaceNotes} onSubmit={createWorkspace} /> : null}
    </>
  );
}


function ProfilePage({ session, dashboard }: { session: Session; dashboard: Dashboard | null }) {
  const requestCount = dashboard?.usage.requests ?? 0;
  const spend = formatPaise(dashboard?.usage.spend_paise);
  const workspaceCount = dashboard?.workspaces.length ?? 0;
  const keyCount = dashboard?.api_keys.length ?? 0;
  return <section className="profile-page">
    <div className="profile-hero"><div className="profile-identity"><span className="account-avatar">{session.email.slice(0, 1).toUpperCase()}</span><div><span className="analytics-eyebrow">Compass account</span><h2>{session.email}</h2><p>Manage your account, workspaces, API access, and billing activity.</p></div></div><span className="profile-status"><i />Active</span></div>
    <div className="profile-stats"><div><span>Workspaces</span><strong>{workspaceCount}</strong></div><div><span>API keys</span><strong>{keyCount}</strong></div><div><span>Requests</span><strong>{requestCount.toLocaleString("en-IN")}</strong></div><div><span>Total spend</span><strong>{spend}</strong></div></div>
    <div className="profile-grid"><section className="profile-card"><div className="profile-card-heading"><div><h3>Account details</h3><p>Your account identity and current access.</p></div></div><dl className="profile-facts"><div><dt>Email address</dt><dd>{session.email}</dd></div><div><dt>Account status</dt><dd><span className="profile-inline-status"><i />Active</span></dd></div><div><dt>Default workspace</dt><dd>{dashboard?.workspaces[0]?.name ?? "No workspace selected"}</dd></div></dl></section><section className="profile-card"><div className="profile-card-heading"><div><h3>Quick access</h3><p>Jump to the areas you use most.</p></div></div><div className="profile-links"><Link href="/api-keys"><KeyRound size={17} />Manage API keys</Link><Link href="/activity"><Activity size={17} />View activity</Link><Link href="/wallet"><Wallet size={17} />Open billing</Link><Link href="/workspaces"><Building2 size={17} />Manage workspaces</Link></div></section></div>
    <section className="profile-card profile-security"><div className="profile-card-heading"><div><h3>Account protection</h3><p>Provider credentials and wallet operations remain protected by the Compass gateway.</p></div><ShieldCheck size={20} /></div><div className="profile-security-grid"><div><strong>Provider credentials</strong><span>Stored server-side and never shown in your profile.</span></div><div><strong>API access</strong><span>Use scoped keys and revoke them from API Keys.</span></div><div><strong>Billing controls</strong><span>Wallet balance and recharge history are available in Billing.</span></div></div></section>
  </section>;
}

function Status({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card border border-compass-line bg-compass-panel px-4 py-3 text-sm text-slate-300">{children}</div>;
}

function DashboardPage({ dashboard, openWorkspaceDialog, selectedTeamId, addCredits, busy, canCreate, canManage }: { dashboard: Dashboard | null; openWorkspaceDialog: () => void; selectedTeamId: string; addCredits: () => void; busy: boolean; canCreate: boolean; canManage: boolean }) {
  return <><Stats dashboard={dashboard} selectedTeamId={selectedTeamId} /><div className="mt-5 flex flex-wrap gap-2">{canCreate ? <button disabled={busy} className="rounded-card bg-compass-accent px-4 py-2 text-sm font-medium text-white" onClick={openWorkspaceDialog}><UsersRound className="h-4 w-4" />Create workspace</button> : null}<Link className="rounded-card border border-compass-line px-4 py-2 text-sm" href="/api-keys">Manage API keys</Link>{canManage ? <button disabled={busy} className="rounded-card border border-compass-line px-4 py-2 text-sm" onClick={() => addCredits()}>Add Rs 500 credits</button> : null}<Link className="rounded-card border border-compass-line px-4 py-2 text-sm" href="/playground">Open Playground</Link></div><AnalyticsOverview dashboard={dashboard} /><Usage rows={dashboard?.recent_requests ?? []} compact /></>;
}

function Stats({ dashboard, selectedTeamId }: { dashboard: Dashboard | null; selectedTeamId: string }) {
  const wallet = dashboard?.teams.find((team) => team.id === selectedTeamId)?.wallet.balance_paise;
  const items = [["Wallet", formatPaise(wallet), Wallet], ["Teams", String(dashboard?.teams.length ?? 0), ShieldCheck], ["Requests", String(dashboard?.usage.requests ?? 0), Activity], ["Spend", formatPaise(dashboard?.usage.spend_paise), BadgeIndianRupee]] as const;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map(([label, value, Icon]) => <div key={label} className="rounded-card border border-compass-line bg-compass-panel p-4"><Icon className="h-4 w-4 text-compass-accent" /><div className="mt-4 text-sm text-slate-400">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>)}</div>;
}

function AnalyticsOverview({ dashboard }: { dashboard: Dashboard | null }) {
  const rows = dashboard?.recent_requests ?? [];
  const successful = rows.filter((row) => row.status === "success").length;
  const failed = rows.length - successful;
  const averageLatency = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.latency_ms, 0) / rows.length) : 0;
  const providerCounts = rows.reduce<Record<string, number>>((counts, row) => { counts[row.provider] = (counts[row.provider] ?? 0) + 1; return counts; }, {});
  const providers = Object.entries(providerCounts).sort((a, b) => b[1] - a[1]);
  const maxProviderCount = Math.max(...providers.map(([, count]) => count), 1);
  const successRate = rows.length ? Math.round((successful / rows.length) * 100) : 0;
  return <section className="analytics-overview">
    <div className="analytics-heading"><div><span className="analytics-eyebrow">Workspace analytics</span><h2>Routing health at a glance</h2><p>Recent gateway activity, provider mix, and response health for the selected account.</p></div><BarChart3 size={21} aria-hidden="true" /></div>
    <div className="analytics-grid">
      <article className="analytics-panel analytics-health"><div className="analytics-panel-heading"><span><CheckCircle2 size={17} />Request health</span><strong>{successRate}%</strong></div><div className="health-meter" aria-label={`${successRate}% of recent requests succeeded`}><span style={{ width: `${successRate}%` }} /></div><div className="analytics-stat-row"><span><CheckCircle2 size={15} />Successful<strong>{successful}</strong></span><span><CircleAlert size={15} />Failed<strong>{failed}</strong></span><span><Clock3 size={15} />Avg latency<strong>{averageLatency} ms</strong></span></div></article>
      <article className="analytics-panel"><div className="analytics-panel-heading"><span><TrendingUp size={17} />Provider traffic</span><small>{rows.length} recent requests</small></div><div className="provider-bars">{providers.length ? providers.map(([provider, count]) => <div className="provider-bar-row" key={provider}><div><span>{provider}</span><strong>{count}</strong></div><div className="provider-bar-track"><span style={{ width: `${Math.max((count / maxProviderCount) * 100, 6)}%` }} /></div></div>) : <p className="analytics-empty">Requests will appear here after the first model call.</p>}</div></article>
      <article className="analytics-panel"><div className="analytics-panel-heading"><span><UsersRound size={17} />Workspace snapshot</span><small>Selected account</small></div><div className="snapshot-list"><div><span>Available models</span><strong>{dashboard?.models.length ?? 0}</strong></div><div><span>Active API keys</span><strong>{dashboard?.api_keys.filter((key) => key.status === "active").length ?? 0}</strong></div><div><span>Tracked tokens</span><strong>{dashboard?.usage.tokens ?? 0}</strong></div></div></article>
    </div>
  </section>;
}

function WorkspaceDirectory({ dashboard, selectedWorkspaceId, selectWorkspace, openWorkspaceDialog, canCreate }: { dashboard: Dashboard | null; selectedWorkspaceId: string; selectWorkspace: (id: string) => void; openWorkspaceDialog: () => void; canCreate: boolean }) {
  return <section className="workspace-page"><div className="workspace-page-heading"><div><span className="analytics-eyebrow">Workspace management</span><h2>Your workspaces</h2><p>Workspaces contain teams. Teams contain members, API keys, usage, and wallets.</p></div>{canCreate ? <button className="console-primary" onClick={openWorkspaceDialog}><Building2 size={17} />Create workspace</button> : null}</div><div className="workspace-card-grid">{dashboard?.workspaces.length ? dashboard.workspaces.map((workspace) => <button type="button" className={`workspace-card ${workspace.id === selectedWorkspaceId ? "selected" : ""}`} key={workspace.id} onClick={() => selectWorkspace(workspace.id)}><div className="workspace-card-icon"><Building2 size={18} /></div><div className="workspace-card-copy"><strong>{workspace.name}</strong><span>Workspace container</span></div><div className="workspace-card-meta"><span>{workspace.team_count}</span><small>{workspace.team_count === 1 ? "Team" : "Teams"}</small></div></button>) : <div className="workspace-empty"><Building2 size={24} /><strong>No workspaces yet</strong><span>{canCreate ? "Create your first workspace, then add teams inside it." : "Ask an administrator to add you to a workspace."}</span></div>}</div></section>;
}

function WorkspaceDialog({ open, name, notes, busy, setOpen, setName, setNotes, onSubmit }: { open: boolean; name: string; notes: string; busy: boolean; setOpen: (open: boolean) => void; setName: (value: string) => void; setNotes: (value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  if (!open) return null;
  return <dialog open className="console-dialog workspace-dialog" aria-labelledby="create-workspace-title"><form onSubmit={onSubmit}><div className="dialog-heading"><div><span className="analytics-eyebrow">Workspace setup</span><h2 id="create-workspace-title">Create workspace</h2></div><button className="console-icon" type="button" aria-label="Close workspace dialog" onClick={() => setOpen(false)}><X size={20} /></button></div><p className="dialog-description">Create a top-level container for teams, billing, members, and API access.</p><label>Workspace name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Customer Demo Workspace" /></label><label>Notes <span className="field-optional">Optional</span><textarea maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Who is this workspace for?" /></label><div className="dialog-footer"><button className="console-secondary" disabled={busy} type="button" onClick={() => setOpen(false)}>Cancel</button><button className="console-primary" disabled={busy}>{busy ? "Creating..." : "Create workspace"}</button></div></form></dialog>;
}


function ChatShowcase(props: { dashboard: Dashboard | null; selectedTeamId: string; model: string; setModel: (model: string) => void; oneTimeKey: string; selectedKey: string; setSelectedKey: (key: string) => void; saveCompassKey: () => void; forgetCompassKey: () => void; chatInput: string; setChatInput: (value: string) => void; messages: ChatMessage[]; setMessages: (messages: ChatMessage[]) => void; sendChatMessage: () => void; busy: boolean }) {
  const selectedModel = props.dashboard?.models.find((model) => model.id === props.model);
  const wallet = props.dashboard?.teams.find((team) => team.id === props.selectedTeamId)?.wallet.balance_paise;
  return (
    <section className="grid min-h-[calc(100vh-210px)] gap-4 xl:grid-cols-[320px_1fr]">
      <aside className="rounded-card border border-compass-line bg-compass-panel p-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-compass-accent" />
          <h2 className="text-base font-semibold">Model chat showcase</h2>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1 text-sm">
            Model
            <select className="rounded-card border border-compass-line bg-compass-bg px-3 py-2" value={props.model} onChange={(event) => props.setModel(event.target.value)}>
              {(props.dashboard?.models ?? []).map((model) => <option key={model.id}>{model.id}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Compass API key
            <input className="rounded-card border border-compass-line bg-compass-bg px-3 py-2" value={props.selectedKey || props.oneTimeKey} onChange={(event) => props.setSelectedKey(event.target.value)} placeholder="sk-compass-..." type="password" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button className="inline-flex items-center justify-center gap-2 rounded-card border border-compass-line px-3 py-2 text-sm transition hover:bg-white/5" onClick={props.saveCompassKey} type="button">
              <KeyRound className="h-4 w-4" />
              Save key
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-card border border-compass-line px-3 py-2 text-sm transition hover:bg-white/5" onClick={props.forgetCompassKey} type="button">
              <Trash2 className="h-4 w-4" />
              Forget
            </button>
          </div>
          <div className="rounded-card border border-compass-line bg-compass-bg p-3 text-sm text-slate-300">
            <div className="flex justify-between gap-3"><span className="text-slate-500">Provider</span><span>{selectedModel?.provider ?? "-"}</span></div>
            <div className="mt-2 flex justify-between gap-3"><span className="text-slate-500">Route</span><span className="truncate">{selectedModel?.provider_model_id ?? "-"}</span></div>
            <div className="mt-2 flex justify-between gap-3"><span className="text-slate-500">Wallet</span><span>{formatPaise(wallet)}</span></div>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-card border border-compass-line px-3 py-2 text-sm transition hover:bg-white/5" onClick={() => props.setMessages([])} type="button">
            <Trash2 className="h-4 w-4" />
            Clear chat
          </button>
        </div>
      </aside>
      <div className="flex min-h-[560px] flex-col rounded-card border border-compass-line bg-compass-panel">
        <div className="border-b border-compass-line px-5 py-4">
          <h2 className="text-base font-semibold">Live chat</h2>
          <p className="mt-1 text-sm text-slate-400">Responses use your Compass key, server-side provider credentials, wallet debits, and request tracking.</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {props.messages.length ? props.messages.map((message) => <ChatBubble key={message.id} message={message} />) : <div className="rounded-card border border-dashed border-compass-line p-6 text-center text-sm text-slate-500">No messages yet.</div>}
        </div>
        <div className="border-t border-compass-line p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <textarea className="min-h-20 flex-1 resize-none rounded-card border border-compass-line bg-compass-bg px-3 py-3 text-sm outline-none focus:border-compass-accent" value={props.chatInput} onChange={(event) => props.setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void props.sendChatMessage(); } }} placeholder="Ask a question or demo a model response..." />
            <button disabled={props.busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-card bg-compass-accent px-5 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" onClick={props.sendChatMessage} type="button">
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <article className={`min-w-0 rounded-card border px-4 py-3 ${isUser ? "max-w-[min(520px,85%)] border-compass-accent/40 bg-compass-accent/20" : "w-full max-w-[980px] border-compass-line bg-compass-bg"}`}>
        <div className="text-xs uppercase text-slate-500">{isUser ? "You" : "Compass"}</div>
        <div className="mt-2 max-w-none whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{message.content}</div>
        {message.meta ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
            {message.meta.status ? <span className="rounded-card border border-compass-line px-2 py-1">{message.meta.status}</span> : null}
            {message.meta.provider ? <span className="rounded-card border border-compass-line px-2 py-1">{message.meta.provider}</span> : null}
            {message.meta.tokens !== undefined ? <span className="rounded-card border border-compass-line px-2 py-1">{message.meta.tokens} tokens</span> : null}
            {message.meta.costPaise !== undefined ? <span className="rounded-card border border-compass-line px-2 py-1">{formatPaise(message.meta.costPaise)}</span> : null}
            {message.meta.latencyMs !== undefined ? <span className="rounded-card border border-compass-line px-2 py-1">{message.meta.latencyMs} ms</span> : null}
            {message.meta.requestId ? <span className="rounded-card border border-compass-line px-2 py-1">Request {message.meta.requestId}</span> : null}
          </div>
        ) : null}
      </article>
    </div>
  );
}

function Playground(props: { busy: boolean; dashboard: Dashboard | null; model: string; oneTimeKey: string; prompt: string; responseText: string; runPrompt: () => void; selectedKey: string; setModel: (model: string) => void; setPrompt: (prompt: string) => void; setSelectedKey: (key: string) => void; saveCompassKey: () => void; forgetCompassKey: () => void }) {
  return <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]"><div className="rounded-card border border-compass-line bg-compass-panel p-5"><h2 className="text-base font-semibold">OpenAI-compatible request</h2><div className="mt-4 grid gap-3"><label className="grid gap-1 text-sm">Model<select className="rounded-card border border-compass-line bg-compass-bg px-3 py-2" value={props.model} onChange={(event) => props.setModel(event.target.value)}>{(props.dashboard?.models ?? []).map((model) => <option key={model.id}>{model.id}</option>)}</select></label><label className="grid gap-1 text-sm">Compass API key<input className="rounded-card border border-compass-line bg-compass-bg px-3 py-2" value={props.selectedKey || props.oneTimeKey} onChange={(event) => props.setSelectedKey(event.target.value)} placeholder="sk-compass-..." type="password" /></label><div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-card border border-compass-line px-3 py-2 text-sm" onClick={props.saveCompassKey} type="button"><KeyRound className="h-4 w-4" />Save key</button><button className="inline-flex items-center gap-2 rounded-card border border-compass-line px-3 py-2 text-sm" onClick={props.forgetCompassKey} type="button"><Trash2 className="h-4 w-4" />Forget</button></div><label className="grid gap-1 text-sm">User message<textarea className="min-h-36 rounded-card border border-compass-line bg-compass-bg px-3 py-2" value={props.prompt} onChange={(event) => props.setPrompt(event.target.value)} /></label><button disabled={props.busy} className="inline-flex items-center justify-center gap-2 rounded-card bg-compass-accent px-4 py-2 text-sm font-medium text-white" onClick={props.runPrompt}><Play className="h-4 w-4" />Send request</button></div></div><pre className="min-h-96 overflow-auto rounded-card border border-compass-line bg-compass-panel p-5 text-xs leading-5 text-slate-200">{props.responseText || "Run a request to see response, usage, cost, latency, request ID, and status."}</pre></section>;
}

function Usage({ rows, compact = false }: { rows: RequestRow[]; compact?: boolean }) {
  return <section className={`${compact ? "mt-6" : ""} rounded-card border border-compass-line bg-compass-panel p-5`}><h2 className="text-base font-semibold">Recent requests</h2><DataTable headers={["Status", "Model", "Provider", "Tokens", "Cost", "Latency", "Request ID"]} rows={rows.map((row) => [row.error_code ? `${row.status} (${row.error_code})` : row.status, row.model, row.provider, String(row.tokens), formatPaise(row.cost_paise), `${row.latency_ms} ms`, row.id])} /></section>;
}

function WalletPage({ wallet, ledger, teamId, token, refresh }: { wallet?: { currency: string; balance_paise: number }; ledger: LedgerRow[]; teamId: string; token: string; refresh: () => Promise<void> }) {
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [refunds, setRefunds] = useState<BillingRefund[]>([]);
  const [amount, setAmount] = useState("500");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const loadOrders = useCallback(async () => {
    if (!teamId) return setOrders([]);
    const [nextOrders, nextInvoices, nextRefunds] = await Promise.all([
      apiFetch<BillingOrder[]>(`/billing/orders?team_id=${encodeURIComponent(teamId)}`, {}, token),
      apiFetch<BillingInvoice[]>(`/billing/invoices?team_id=${encodeURIComponent(teamId)}`, {}, token),
      apiFetch<BillingRefund[]>(`/billing/refunds?team_id=${encodeURIComponent(teamId)}`, {}, token),
    ]);
    setOrders(nextOrders);
    setInvoices(nextInvoices);
    setRefunds(nextRefunds);
  }, [teamId, token]);
  useEffect(() => { void Promise.resolve().then(loadOrders).catch((error) => setStatus(error instanceof Error ? error.message : "Could not load billing orders.")); }, [loadOrders]);
  async function openRazorpayCheckout(order: BillingOrder) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if ((window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay) { resolve(); return; }
      const script = existing ?? document.createElement("script");
      if (!existing) { script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.async = true; document.body.appendChild(script); }
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error("Razorpay checkout could not load.")), { once: true });
    });
    const Razorpay = (window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
    if (!Razorpay || !order.checkout_key_id) throw new Error("Razorpay checkout is not configured.");
    const checkout = new Razorpay({
      key: order.checkout_key_id,
      amount: order.amount_paise,
      currency: order.currency,
      name: "Compass",
      description: "Compass wallet recharge",
      order_id: order.provider_order_id,
      handler: async (response: RazorpayResponse) => {
        setBusy(true);
        try {
          await apiFetch(`/billing/orders/${order.id}/verify`, { method: "POST", body: JSON.stringify(response) }, token);
          setStatus("Payment verified. Wallet recharged successfully."); await loadOrders(); await refresh();
        } catch (error) { setStatus(error instanceof Error ? error.message : "Payment verification failed."); }
        finally { setBusy(false); }
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    checkout.open();
  }
  async function createRecharge(event: React.FormEvent) {
    event.preventDefault();
    const rupees = Number(amount);
    if (!teamId || !Number.isFinite(rupees) || rupees < 10 || rupees > 50000) { setStatus("Enter an amount between Rs 10 and Rs 50,000."); return; }
    setBusy(true); setStatus("");
    try {
      const order = await apiFetch<BillingOrder>("/billing/orders", { method: "POST", body: JSON.stringify({ team_id: teamId, amount_paise: Math.round(rupees * 100) }) }, token);
      await loadOrders();
      if (order.provider === "razorpay") { setStatus("Opening Razorpay checkout..."); await openRazorpayCheckout(order); }
      else setStatus("Recharge order created. Complete the development checkout below.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not create recharge order."); }
    finally { setBusy(false); }
  }
  async function completeRecharge(order: BillingOrder) {
    setBusy(true); setStatus("");
    try {
      await apiFetch(`/billing/orders/${order.id}/complete`, { method: "POST", body: JSON.stringify({ confirmation: "browser-confirmed" }) }, token);
      setStatus("Wallet recharged successfully."); await loadOrders(); await refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not complete recharge."); }
    finally { setBusy(false); }
  }
  async function refundRecharge(order: BillingOrder) {
    setBusy(true); setStatus("");
    try {
      await apiFetch(`/billing/orders/${order.id}/refund`, { method: "POST", body: JSON.stringify({ reason: "Customer requested refund" }) }, token);
      setStatus("Refund requested. The wallet will update when the payment provider confirms it."); await loadOrders(); await refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not request the refund."); }
    finally { setBusy(false); }
  }
  const credits = ledger.filter((row) => row.type === "credit").reduce((sum, row) => sum + Math.abs(row.amount_paise), 0);
  const usage = ledger.filter((row) => row.type === "debit").reduce((sum, row) => sum + Math.abs(row.amount_paise), 0);
  return <section className="billing-page">
    <div className="billing-hero"><div><span className="analytics-eyebrow">Billing</span><h2>Wallet and recharge</h2><p>Keep credits available for model requests. Recharge activity and usage charges are recorded in the ledger.</p></div><div className="billing-balance"><span>Available balance</span><strong>{formatPaise(wallet?.balance_paise)}</strong><small>{wallet?.currency ?? "INR"}</small></div></div>
    {status ? <p className="model-error" role="status">{status}</p> : null}
    <div className="billing-grid"><form className="billing-card recharge-card" onSubmit={(event) => void createRecharge(event)}><div className="billing-card-heading"><div><h3>Recharge wallet</h3><p>Choose an amount to create a secure recharge order.</p></div><CreditCard size={20} /></div><div className="amount-presets">{[500, 1000, 2500, 5000].map((preset) => <button type="button" key={preset} className={amount === String(preset) ? "selected" : ""} onClick={() => setAmount(String(preset))}>{formatPaise(preset * 100)}</button>)}</div><label>Amount in rupees<input type="number" min="10" max="50000" step="1" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><button className="console-primary" disabled={busy || !teamId}><CreditCard size={17} />{busy ? "Processing..." : "Create recharge order"}</button><small>Minimum Rs 10. Maximum Rs 50,000 per order.</small></form><section className="billing-card"><div className="billing-card-heading"><div><h3>Billing summary</h3><p>Selected team wallet activity.</p></div><Wallet size={20} /></div><div className="billing-summary"><div><span>Total credits</span><strong>{formatPaise(credits)}</strong></div><div><span>Usage charges</span><strong>{formatPaise(usage)}</strong></div><div><span>Ledger entries</span><strong>{ledger.length}</strong></div></div></section></div>
    <section className="billing-card billing-orders"><div className="billing-card-heading"><div><h3>Recharge orders</h3><p>Payment orders for this team.</p></div></div>{orders.length ? <div className="billing-order-list">{orders.map((order) => <article key={order.id}><div><strong>{formatPaise(order.amount_paise)}</strong><span>{order.provider === "development" ? "Development checkout" : "Razorpay"} · {new Date(order.created_at).toLocaleString("en-IN")}</span></div><div className="billing-order-action"><span className={`key-status ${order.status === "completed" ? "active" : "pending"}`}>{order.status}</span>{order.can_complete ? <button type="button" className="console-secondary" disabled={busy} onClick={() => void completeRecharge(order)}>Complete recharge</button> : null}</div></article>)}</div> : <div className="billing-empty"><CreditCard size={22} /><strong>No recharge orders</strong><span>Create an order to add credits to this team wallet.</span></div>}</section>
    <div className="billing-grid"><section className="billing-card"><div className="billing-card-heading"><div><h3>Invoices</h3><p>Paid receipts generated for completed wallet recharges.</p></div></div><DataTable headers={["Invoice", "Order", "Total", "Status"]} rows={invoices.map((invoice) => [invoice.invoice_number, invoice.order_id.slice(0, 8), formatPaise(invoice.total_paise), invoice.status])} /></section><section className="billing-card"><div className="billing-card-heading"><div><h3>Refunds</h3><p>Provider refunds and wallet reversals.</p></div></div><DataTable headers={["Order", "Amount", "Status", "Reason"]} rows={refunds.map((refund) => [refund.order_id.slice(0, 8), formatPaise(refund.amount_paise), refund.status, refund.reason])} /></section></div>
    {orders.some((order) => order.can_refund) ? <section className="billing-card"><div className="billing-card-heading"><div><h3>Refund eligible payments</h3><p>Request a full refund for a completed recharge. Provider-confirmed refunds reverse wallet credits.</p></div></div><div className="billing-order-list">{orders.filter((order) => order.can_refund).map((order) => <article key={order.id}><div><strong>{formatPaise(order.amount_paise - order.refunded_paise)}</strong><span>Remaining refundable balance</span></div><button type="button" className="console-secondary" disabled={busy} onClick={() => void refundRecharge(order)}>Request refund</button></article>)}</div></section> : null}
    <section className="billing-card"><div className="billing-card-heading"><div><h3>Wallet ledger</h3><p>Every recharge, refund, and model usage charge is recorded here.</p></div></div><DataTable headers={["Type", "Amount", "Before", "After", "Reference"]} rows={ledger.map((row) => [row.type, formatPaise(row.amount_paise), formatPaise(row.balance_before), formatPaise(row.balance_after), row.reference_id])} /></section>
  </section>;
}

function AdminPage(props: { admin: AdminLocal | null; dashboard: Dashboard | null; openWorkspaceDialog: () => void; busy: boolean; providerName: ProviderName; setProviderName: (provider: ProviderName) => void; providerApiKey: string; setProviderApiKey: (key: string) => void; saveProviderCredential: () => void; token: string; refresh: () => Promise<void> }) {
  async function updateModel(modelId: string, status: string) {
    await apiFetch(`/admin/router/models/${encodeURIComponent(modelId)}`, { method: "PATCH", body: JSON.stringify({ status }) }, props.token);
    await props.refresh();
  }
  return <div className="grid gap-4 xl:grid-cols-2">
    <section className="rounded-card border border-compass-line bg-compass-panel p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Workspaces</h2><button disabled={props.busy} className="rounded-card border border-compass-line px-3 py-2 text-sm" onClick={props.openWorkspaceDialog}>Create workspace</button></div><DataTable headers={["Name", "Slug", "Wallet", "Status"]} rows={(props.dashboard?.teams ?? []).map((team) => [team.name, team.slug, formatPaise(team.wallet.balance_paise), team.is_active ? "active" : "disabled"])} /></section>
    <section className="rounded-card border border-compass-line bg-compass-panel p-5"><h2 className="text-base font-semibold">Provider API keys</h2><p className="mt-2 text-sm text-slate-400">{props.admin?.note}</p><div className="mt-4 grid gap-3"><label className="grid gap-1 text-sm">Provider<select className="rounded-card border border-compass-line bg-compass-bg px-3 py-2" value={props.providerName} onChange={(event) => props.setProviderName(event.target.value as ProviderName)}><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="ollama_cloud">Ollama Cloud</option></select></label><label className="grid gap-1 text-sm">API key<input className="rounded-card border border-compass-line bg-compass-bg px-3 py-2" value={props.providerApiKey} onChange={(event) => props.setProviderApiKey(event.target.value)} placeholder="Stored server-side only" type="password" /></label><button disabled={props.busy} className="w-fit rounded-card bg-compass-accent px-4 py-2 text-sm font-medium text-white" onClick={props.saveProviderCredential}>Save provider key</button></div><DataTable headers={["Provider", "Enabled", "Status", "Credential", "Last four"]} rows={(props.admin?.providers ?? []).map((provider) => [provider.name, String(provider.enabled), provider.status, provider.has_configured_key ? "configured" : provider.credential_status, provider.last_four ? `****${provider.last_four}` : ""])} /></section>
    <section className="rounded-card border border-compass-line bg-compass-panel p-5 xl:col-span-2"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Model governance</h2><p className="mt-1 text-sm text-slate-400">Control lifecycle state, publication, provider health, and fallback readiness.</p></div><span className="text-sm text-slate-400">{props.admin?.routerModels?.length ?? 0} models</span></div><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="border-b border-compass-line px-3 py-2">Model</th><th className="border-b border-compass-line px-3 py-2">Provider</th><th className="border-b border-compass-line px-3 py-2">Lifecycle</th><th className="border-b border-compass-line px-3 py-2">Published</th><th className="border-b border-compass-line px-3 py-2">Fallback</th><th className="border-b border-compass-line px-3 py-2">Health</th></tr></thead><tbody>{(props.admin?.routerModels ?? []).map((model) => <tr key={model.id} className="border-b border-compass-line/70"><td className="px-3 py-3"><strong>{model.display_name}</strong><code className="mt-1 block text-xs text-slate-500">{model.id}</code></td><td className="px-3 py-3">{model.provider}</td><td className="px-3 py-3"><select className="rounded-card border border-compass-line bg-compass-bg px-2 py-1 text-xs" value={model.status} onChange={(event) => void updateModel(model.id, event.target.value)}><option value="available">available</option><option value="unavailable">unavailable</option><option value="deprecated">deprecated</option><option value="expired">expired</option></select></td><td className="px-3 py-3">{model.published ? "published" : "hidden"}</td><td className="px-3 py-3 text-xs text-slate-400">{model.fallback_model_id ?? "none"}</td><td className="px-3 py-3"><span className={`key-status ${model.provider_enabled && model.provider_status === "healthy" ? "active" : "revoked"}`}>{model.provider_enabled ? model.provider_status : "disabled"}</span></td></tr>)}</tbody></table></div></section>
    <section className="rounded-card border border-compass-line bg-compass-panel p-5"><h2 className="text-base font-semibold">Provider health</h2><DataTable headers={["Provider", "Status", "Enabled", "Last check", "Latency", "Errors"]} rows={(props.admin?.routerProviders ?? []).map((provider) => [provider.name, provider.status, String(provider.enabled), provider.last_health?.checked_at ?? "Never", provider.last_health ? `${provider.last_health.latency_ms} ms` : "-", provider.last_health ? `${provider.last_health.error_rate}%` : "-"])} /></section>
    <section className="rounded-card border border-compass-line bg-compass-panel p-5"><h2 className="text-base font-semibold">Model pricing</h2><DataTable headers={["Model", "Provider", "Input", "Output"]} rows={(props.admin?.models ?? []).map((model) => [model.id, model.provider, `${model.input_price_paise_per_1k} paise`, `${model.output_price_paise_per_1k} paise`])} /></section>
  </div>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{headers.map((header) => <th className="border-b border-compass-line px-3 py-2 font-medium" key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-b border-compass-line/70">{row.map((cell, cellIndex) => <td className="max-w-80 truncate px-3 py-3 text-slate-300" key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>) : <tr><td className="px-3 py-5 text-slate-500" colSpan={headers.length}>No records yet.</td></tr>}</tbody></table></div>;
}
