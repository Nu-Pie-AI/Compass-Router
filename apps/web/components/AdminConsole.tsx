"use client";

import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Database,
  FileClock,
  FolderKanban,
  KeyRound,
  LogOut,
  RefreshCw,
  Route,
  Settings2,
  ShieldCheck,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, formatPaise, signOutClerkSession } from "../lib/api";

type Session = { token: string; user_id: string; email: string; role: string };
type Access = {
  user_id: string;
  email: string;
  roles: string[];
  permissions: string[];
};
type Section = {
  id: string;
  label: string;
  group: string;
  icon: typeof BarChart3;
  permission?: string;
};
type CommandCenter = {
  customers: { total: number; active: number };
  organizations: number;
  active_api_keys: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    success_rate: number | null;
  };
  tokens: { input: number; output: number; total: number };
  financial: {
    customer_charges_paise: number;
    provider_cost_paise: number;
    gross_margin_estimate_paise: number;
    wallet_liabilities_paise: number;
    refunds_paise: number;
    tax_paise: number;
  };
  latency_ms: {
    average: number;
    p50: number | null;
    p95: number | null;
    percentiles: string;
  };
  provider_health: { healthy: number; degraded: number; disabled: number };
  failed_settlements: number;
  pending_payment_reconciliation: number;
  security_alerts: number;
  generated_at: string;
};
type Customer = {
  id: string;
  email: string;
  status: string;
  status_reason: string;
  organization_count: number;
  project_count: number;
  api_key_count: number;
  created_at: string;
};
type Provider = {
  name: string;
  enabled: boolean;
  status: string;
  commercial_status: string;
  last_health?: {
    status: string;
    latency_ms: number;
    error_rate: number;
    checked_at: string;
  } | null;
  credential_status?: string;
  has_configured_key?: boolean;
  last_four?: string;
};
type ProviderCredential = {
  name: string;
  credential_status: string;
  has_configured_key: boolean;
  last_four: string;
};
type Model = {
  id: string;
  display_name: string;
  provider: string;
  status: string;
  enabled: boolean;
  published: boolean;
  input_price_paise_per_1k: number;
  output_price_paise_per_1k: number;
  provider_status: string;
  provider_enabled: boolean;
  provider_commercial_status?: string;
  capability_types?: string[];
  pricing_policy_version?: string | null;
  input_price_usd_per_million?: string | null;
  output_price_usd_per_million?: string | null;
  route_readiness_reason?: string;
};
type Wallet = {
  id: string;
  team_id?: string | null;
  organization_id?: string | null;
  currency: string;
  available_balance_paise: number;
  reserved_balance_paise: number;
  status: string;
  updated_at: string;
};
type Audit = {
  id: string;
  actor_user_id?: string | null;
  action: string;
  target: string;
  request_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
type RequestRow = {
  id: string;
  timestamp: string;
  organization_id?: string | null;
  project_id?: string | null;
  model: string;
  provider: string;
  credential_mode?: string;
  status: string;
  latency_ms: number;
  total_tokens: number;
  provider_cost_paise: number;
  customer_charge_paise: number;
  failure_category?: string | null;
};
type ProviderAnalytics = {
  period?: string | null;
  provider: string;
  model: string;
  organization_id?: string | null;
  project_id?: string | null;
  credential_mode: string;
  usage_finality?: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  provider_cost_paise: number;
  customer_charge_paise: number;
  failed_requests: number;
};
type RoleAssignment = {
  id: string;
  user_id: string;
  email?: string | null;
  role: string;
  status: string;
  reason: string;
  created_at: string;
};
type Setting = { key: string; value: unknown; updated_at: string };

const sections: Section[] = [
  {
    id: "overview",
    label: "Platform Overview",
    group: "Command Center",
    icon: BarChart3,
    permission: "admin.view",
  },
  {
    id: "customers",
    label: "Customers",
    group: "Customers",
    icon: Users,
    permission: "customers.view",
  },
  {
    id: "organizations",
    label: "Organizations",
    group: "Customers",
    icon: Building2,
    permission: "customers.view",
  },
  {
    id: "teams",
    label: "Teams",
    group: "Customers",
    icon: Users,
    permission: "customers.view",
  },
  {
    id: "projects",
    label: "Projects",
    group: "Customers",
    icon: FolderKanban,
    permission: "customers.view",
  },
  {
    id: "keys",
    label: "API Keys",
    group: "Customers",
    icon: KeyRound,
    permission: "customers.view",
  },
  {
    id: "providers",
    label: "Providers",
    group: "AI Infrastructure",
    icon: Database,
    permission: "providers.view",
  },
  {
    id: "models",
    label: "Models & Pricing",
    group: "AI Infrastructure",
    icon: Route,
    permission: "models.view",
  },
  {
    id: "routing",
    label: "Routing Policies",
    group: "AI Infrastructure",
    icon: Route,
    permission: "routing.view",
  },
  {
    id: "finance",
    label: "Credits & Reconciliation",
    group: "Finance",
    icon: WalletCards,
    permission: "finance.view",
  },
  {
    id: "payments",
    label: "Payments & Refunds",
    group: "Finance",
    icon: CreditCard,
    permission: "finance.view",
  },
  {
    id: "operations",
    label: "Request Logs",
    group: "Operations",
    icon: FileClock,
    permission: "operations.view",
  },
  {
    id: "security",
    label: "Security & Audit",
    group: "Operations",
    icon: ShieldCheck,
    permission: "security.view",
  },
  {
    id: "roles",
    label: "Admin Roles",
    group: "Governance",
    icon: ShieldCheck,
    permission: "settings.view",
  },
  {
    id: "settings",
    label: "Platform Settings",
    group: "Governance",
    icon: Settings2,
    permission: "settings.view",
  },
];

function shortDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TypeSafeProviderCard({ provider, model, canManage, canManagePricing, busy, onSave, onVerify, onApprovePricing }: { provider: Provider; model: Model; canManage: boolean; canManagePricing: boolean; busy: boolean; onSave: (provider: string, apiKey: string) => Promise<void>; onVerify: (provider: string) => Promise<void>; onApprovePricing: (model: Model, values: { inputPriceUsd: number; outputPriceUsd: number; inputPricePaise: number; outputPricePaise: number }) => Promise<void> }) {
  const [apiKey, setApiKey] = useState("");
  const [inputPriceUsd, setInputPriceUsd] = useState(model.input_price_usd_per_million ?? "");
  const [outputPriceUsd, setOutputPriceUsd] = useState(model.output_price_usd_per_million ?? "");
  const [inputPricePaise, setInputPricePaise] = useState(String(model.input_price_paise_per_1k));
  const [outputPricePaise, setOutputPricePaise] = useState(String(model.output_price_paise_per_1k));
  const credentialReady = Boolean(provider.has_configured_key);
  const pricingReady = Boolean(model.pricing_policy_version && model.input_price_usd_per_million !== null && model.output_price_usd_per_million !== null);
  const active = credentialReady && provider.enabled && provider.status === "healthy" && provider.commercial_status === "approved" && model.enabled && model.published && model.status === "available" && pricingReady;
  const status = active ? "Active" : !credentialReady ? "Setup Required" : provider.status === "degraded" || provider.status === "unavailable" ? "Verification Failed" : "Approval Required";
  return <div className="mt-5 rounded-card border border-compass-line bg-compass-bg p-4" data-testid="typesafe-provider-card">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="analytics-eyebrow">STRUCTURED DECISION PROVIDER</span><h3 className="mt-1 text-lg font-semibold">TypeSafe AI</h3><p className="mt-1 text-sm text-slate-400">Jev structured decisions through the official TypeSafe adapter.</p></div><span className={`admin-status ${active ? "active" : "disabled"}`}>{status}</span></div>
    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><span className="text-slate-500">Model</span><strong className="ml-2">jev-latest</strong></div><div><span className="text-slate-500">Capability</span><strong className="ml-2">Structured Decision</strong></div><div><span className="text-slate-500">Credential</span><strong className="ml-2">{credentialReady ? `Configured ****${provider.last_four}` : "Not configured"}</strong></div><div><span className="text-slate-500">Model access</span><strong className="ml-2">{provider.enabled && !["disabled", "unavailable"].includes(provider.status) && model.enabled && model.published && model.status === "available" ? "Approved" : "Not approved"}</strong></div><div><span className="text-slate-500">Pricing approval</span><strong className="ml-2">{pricingReady ? "Approved" : "Not approved"}</strong></div><div><span className="text-slate-500">Commercial status</span><strong className="ml-2">{provider.commercial_status}</strong></div></div>
    {model.route_readiness_reason ? <p className="mt-3 text-xs text-amber-300">{model.route_readiness_reason}</p> : null}
    {canManage ? <div className="mt-4 flex flex-wrap items-end gap-3"><label className="grid min-w-64 flex-1 gap-1 text-xs text-slate-400">{credentialReady ? "Replace API key" : "API key"}<input className="rounded-card border border-compass-line bg-compass-panel px-3 py-2 text-sm text-slate-200" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={credentialReady ? "Enter replacement key" : "Paste TypeSafe API key"} /></label><button className="console-primary" disabled={busy || !apiKey.trim()} onClick={() => void onSave("typesafe_ai", apiKey).then(() => setApiKey(""))}>{credentialReady ? "Replace key" : "Save key"}</button><button className="console-secondary" disabled={busy} onClick={() => void onVerify("typesafe_ai")}>Verify connection</button></div> : null}
    {canManagePricing ? <div className="mt-4 border-t border-compass-line pt-4"><div className="mb-2 text-sm font-semibold text-slate-200">Approved Jev pricing</div><div className="grid gap-3 sm:grid-cols-4"><label className="grid gap-1 text-xs text-slate-400">Input USD / 1M<input className="rounded-card border border-compass-line bg-compass-panel px-3 py-2 text-sm text-slate-200" inputMode="decimal" value={inputPriceUsd} onChange={(event) => setInputPriceUsd(event.target.value)} /></label><label className="grid gap-1 text-xs text-slate-400">Output USD / 1M<input className="rounded-card border border-compass-line bg-compass-panel px-3 py-2 text-sm text-slate-200" inputMode="decimal" value={outputPriceUsd} onChange={(event) => setOutputPriceUsd(event.target.value)} /></label><label className="grid gap-1 text-xs text-slate-400">Customer input paise / 1K<input className="rounded-card border border-compass-line bg-compass-panel px-3 py-2 text-sm text-slate-200" inputMode="numeric" value={inputPricePaise} onChange={(event) => setInputPricePaise(event.target.value)} /></label><label className="grid gap-1 text-xs text-slate-400">Customer output paise / 1K<input className="rounded-card border border-compass-line bg-compass-panel px-3 py-2 text-sm text-slate-200" inputMode="numeric" value={outputPricePaise} onChange={(event) => setOutputPricePaise(event.target.value)} /></label></div><button className="console-secondary mt-3" disabled={busy || !inputPriceUsd || !outputPriceUsd} onClick={() => void onApprovePricing(model, { inputPriceUsd: Number(inputPriceUsd), outputPriceUsd: Number(outputPriceUsd), inputPricePaise: Number(inputPricePaise), outputPricePaise: Number(outputPricePaise) })}>Approve pricing</button></div> : null}
    <p className="mt-3 text-xs text-slate-500">Keys are submitted only to Compass and are never rendered back to the browser. Jev cannot activate until all requirements pass.</p>
  </div>;
}

function Metric({
  label,
  value,
  detail,
  tone = "",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: string;
}) {
  return (
    <article className={`admin-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="admin-empty">
      <CheckCircle2 size={20} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function AdminConsole() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [section, setSection] = useState("overview");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [customerSearch, setCustomerSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adjustment, setAdjustment] = useState({
    team_id: "",
    amount_paise: "",
    reason: "",
    idempotency_key: "",
  });
  const [roleForm, setRoleForm] = useState({
    user_id: "",
    role: "SUPPORT_ADMIN",
    reason: "",
  });

  useEffect(() => {
    const saved = window.localStorage.getItem("compass.local.session");
    if (!saved) {
      router.replace("/admin-login?callbackUrl=/super-admin");
      return;
    }
    try {
      const parsed = JSON.parse(saved) as Session;
      void Promise.resolve().then(() => setSession(parsed));
    } catch {
      window.localStorage.removeItem("compass.local.session");
      router.replace("/admin-login?callbackUrl=/super-admin");
    }
  }, [router]);

  async function loadAccess(activeSession: Session) {
    try {
      const result = await apiFetch<Access>(
        "/admin/access",
        {},
        activeSession.token,
      );
      setAccess(result);
      if (!result.permissions.includes("*")) {
        const first = sections.find(
          (item) =>
            !item.permission || result.permissions.includes(item.permission),
        );
        if (first) setSection(first.id);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Administrator access could not be verified.",
      );
      window.setTimeout(() => router.replace("/dashboard"), 1200);
    }
  }

  async function loadSection(activeSection = section) {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const token = session.token;
      const responses: Record<string, unknown> = {};
      if (activeSection === "overview")
        responses.overview = await apiFetch<CommandCenter>(
          "/admin/command-center",
          {},
          token,
        );
      if (activeSection === "customers")
        responses.customers = await apiFetch<{
          items: Customer[];
          total: number;
        }>(
          `/admin/customers?page_size=50${customerSearch ? `&search=${encodeURIComponent(customerSearch)}` : ""}`,
          {},
          token,
        );
      if (activeSection === "organizations")
        responses.organizations = await apiFetch<{
          items: Array<{
            id: string;
            name: string;
            member_count: number;
            project_count: number;
            created_at: string;
          }>;
          total: number;
        }>("/admin/organizations?page_size=50", {}, token);
      if (activeSection === "teams")
        responses.teams = await apiFetch<
          Array<{
            id: string;
            name: string;
            slug: string;
            is_active: boolean;
            created_at: string;
          }>
        >("/admin/teams", {}, token);
      if (activeSection === "projects")
        responses.projects = await apiFetch<{
          items: Array<{
            id: string;
            organization_id: string;
            name: string;
            slug: string;
            is_default: boolean;
            is_active: boolean;
            member_count: number;
            created_at: string;
          }>;
          total: number;
        }>("/admin/projects?page_size=50", {}, token);
      if (activeSection === "keys")
        responses.keys = await apiFetch<{
          items: Array<Record<string, unknown>>;
          total: number;
        }>("/admin/api-keys?page_size=50", {}, token);
      if (activeSection === "providers") {
        const [providers, readiness, credentials, models] = await Promise.all([
          apiFetch<Provider[]>("/admin/router/providers", {}, token),
          apiFetch<Record<string, unknown>>("/admin/live-readiness", {}, token),
          apiFetch<ProviderCredential[]>("/admin/provider-credentials", {}, token),
          apiFetch<Model[]>("/admin/router/models", {}, token),
        ]);
        responses.providers = providers.map((provider) => ({ ...provider, ...(credentials.find((item) => item.name === provider.name) ?? {}) }));
        responses.readiness = readiness;
        responses.models = models;
      }
      if (activeSection === "models")
        responses.models = await apiFetch<Model[]>(
          "/admin/router/models",
          {},
          token,
        );
      if (activeSection === "routing")
        responses.routing = await apiFetch<
          Array<{
            id: string;
            alias: string;
            candidate_models: string[];
            enabled: boolean;
          }>
        >("/admin/router/policies", {}, token);
      if (activeSection === "finance") {
        const [wallets, reconciliation] = await Promise.all([
          apiFetch<{ items: Wallet[]; total: number }>(
            "/admin/financial/wallets?page_size=50",
            {},
            token,
          ),
          apiFetch<Record<string, unknown>>(
            "/admin/billing/reconciliation",
            {},
            token,
          ),
        ]);
        responses.wallets = wallets;
        responses.reconciliation = reconciliation;
      }
      if (activeSection === "payments")
        responses.reconciliation = await apiFetch<Record<string, unknown>>(
          "/admin/billing/reconciliation",
          {},
          token,
        );
      if (activeSection === "operations") {
        const [requests, analytics] = await Promise.all([
          apiFetch<{
            items: RequestRow[];
            total: number;
            content_policy: string;
          }>("/admin/requests?page_size=50", {}, token),
          apiFetch<{ items: ProviderAnalytics[]; total: number }>(
            "/admin/analytics/providers",
            {},
            token,
          ),
        ]);
        responses.requests = requests;
        responses.providerAnalytics = analytics;
      }
      if (activeSection === "security")
        responses.audit = await apiFetch<{ items: Audit[]; total: number }>(
          "/admin/security/events?page_size=100",
          {},
          token,
        );
      if (activeSection === "roles")
        responses.roles = await apiFetch<RoleAssignment[]>(
          "/admin/roles",
          {},
          token,
        );
      if (activeSection === "settings")
        responses.settings = await apiFetch<{
          items: Setting[];
          deployment_managed: string[];
        }>("/admin/settings", {}, token);
      setData(responses);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The admin data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session)
      void Promise.resolve().then(() => {
        void loadAccess(session);
        void loadSection(section);
      }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  useEffect(() => {
    if (session && access)
      void Promise.resolve().then(() => loadSection(section)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, customerSearch]);

  const visibleSections = useMemo(
    () =>
      sections.filter(
        (item) =>
          !item.permission ||
          access?.permissions.includes("*") ||
          access?.permissions.includes(item.permission),
      ),
    [access],
  );
  const groups = [...new Set(visibleSections.map((item) => item.group))];
  const can = (permission: string) =>
    Boolean(
      access?.permissions.includes("*") ||
      access?.permissions.includes(permission),
    );

  async function refresh() {
    await loadSection(section);
  }
  async function logout() {
    await signOutClerkSession().catch(() => undefined);
    window.localStorage.removeItem("compass.local.session");
    router.replace("/login");
  }
  async function updateCustomer(
    userId: string,
    statusValue: "active" | "suspended",
  ) {
    if (!session || !can("customers.manage")) return;
    setBusy(true);
    setStatus("");
    try {
      await apiFetch(
        `/admin/users/${userId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: statusValue,
            reason:
              statusValue === "suspended"
                ? "Suspended from Super Admin Console"
                : "Reactivated from Super Admin Console",
          }),
        },
        session.token,
      );
      setStatus("Customer access updated and audited.");
      await loadSection("customers");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Customer access could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggleProvider(provider: Provider) {
    if (!session || !can("providers.manage")) return;
    const nextEnabled = !provider.enabled;
    setBusy(true);
    try {
      await apiFetch(
        `/admin/router/providers/${encodeURIComponent(provider.name)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: nextEnabled ? "healthy" : "disabled",
            enabled: nextEnabled,
          }),
        },
        session.token,
      );
      setStatus(`Provider ${provider.name} updated.`);
      await loadSection("providers");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Provider update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveProviderCredential(providerName: string, apiKey: string) {
    if (!session || !can("providers.manage") || !apiKey.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/admin/provider-credentials", { method: "POST", body: JSON.stringify({ provider: providerName, api_key: apiKey.trim() }) }, session.token);
      setStatus(`${providerName} credential stored server-side. The raw key is not returned.`);
      await loadSection("providers");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Provider credential could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyProviderCredential(providerName: string) {
    if (!session || !can("providers.manage")) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<{ status: string; message: string }>(`/admin/provider-credentials/${encodeURIComponent(providerName)}/test`, { method: "POST" }, session.token);
      setStatus(`${providerName}: ${result.status}. ${result.message}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${providerName} verification failed.`);
    } finally {
      setBusy(false);
    }
  }
  async function approveModelPricing(model: Model, values: { inputPriceUsd: number; outputPriceUsd: number; inputPricePaise: number; outputPricePaise: number }) {
    if (!session || !can("models.manage")) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(
        `/admin/router/models/${encodeURIComponent(model.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: model.status,
            enabled: false,
            published: false,
            input_price_paise_per_1k: values.inputPricePaise,
            output_price_paise_per_1k: values.outputPricePaise,
            input_price_usd_per_million: values.inputPriceUsd,
            output_price_usd_per_million: values.outputPriceUsd,
            pricing_approved: true,
            change_reason: "Approved Jev provider pricing",
          }),
        },
        session.token,
      );
      setStatus(`${model.id} pricing approved. Provider and model remain disabled until credential and verification gates pass.`);
      await loadSection("providers");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Model pricing could not be approved.");
    } finally {
      setBusy(false);
    }
  }
  async function toggleModel(model: Model) {
    if (!session || !can("models.manage")) return;
    setBusy(true);
    try {
      await apiFetch(
        `/admin/router/models/${encodeURIComponent(model.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: model.status,
            enabled: !model.enabled,
            published: model.published,
            input_price_paise_per_1k: model.input_price_paise_per_1k,
            output_price_paise_per_1k: model.output_price_paise_per_1k,
            change_reason: "M9 model availability change",
          }),
        },
        session.token,
      );
      setStatus(`Model ${model.id} updated.`);
      await loadSection("models");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Model update failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !can("finance.adjust")) return;
    setBusy(true);
    setStatus("");
    try {
      await apiFetch(
        "/admin/financial/wallet-adjustments",
        {
          method: "POST",
          body: JSON.stringify({
            ...adjustment,
            amount_paise: Number(adjustment.amount_paise),
          }),
        },
        session.token,
      );
      setStatus("Credits adjustment committed to the ledger and audited.");
      setAdjustment({
        team_id: "",
        amount_paise: "",
        reason: "",
        idempotency_key: "",
      });
      await loadSection("finance");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Credits adjustment failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !can("*")) return;
    setBusy(true);
    try {
      await apiFetch(
        "/admin/roles",
        { method: "POST", body: JSON.stringify(roleForm) },
        session.token,
      );
      setStatus("Platform role granted and audited.");
      setRoleForm({ user_id: "", role: "SUPPORT_ADMIN", reason: "" });
      await loadSection("roles");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Role grant failed.");
    } finally {
      setBusy(false);
    }
  }
  async function revokeRole(assignment: RoleAssignment) {
    if (!session || !can("*")) return;
    const reason = window.prompt(
      `Reason for revoking ${assignment.role} from ${assignment.email ?? assignment.user_id}`,
    );
    if (!reason) return;
    setBusy(true);
    try {
      await apiFetch(
        `/admin/roles/${assignment.id}/revoke`,
        { method: "POST", body: JSON.stringify({ reason }) },
        session.token,
      );
      setStatus("Platform role revoked and audited.");
      await loadSection("roles");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Role revocation failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function updateSettings(values: Record<string, unknown>) {
    if (!session || !can("settings.manage")) return;
    setBusy(true);
    try {
      await apiFetch(
        "/admin/settings",
        { method: "PATCH", body: JSON.stringify({ values }) },
        session.token,
      );
      setStatus("Platform setting saved and audited.");
      await loadSection("settings");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Setting update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!session || !access)
    return (
      <main className="admin-loading">
        <RefreshCw className="animate-spin" size={20} />
        Verifying platform administrator access...
      </main>
    );
  const overview = data.overview as CommandCenter | undefined;
  const customers = data.customers as
    { items: Customer[]; total: number } | undefined;
  const providers = data.providers as Provider[] | undefined;
  const models = data.models as Model[] | undefined;
  const wallets = data.wallets as
    { items: Wallet[]; total: number } | undefined;
  const requests = data.requests as
    { items: RequestRow[]; total: number; content_policy: string } | undefined;
  const audit = data.audit as { items: Audit[]; total: number } | undefined;
  const roles = data.roles as RoleAssignment[] | undefined;
  const settings = data.settings as
    { items: Setting[]; deployment_managed: string[] } | undefined;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <Route size={25} aria-hidden="true" />
          <span>
            <strong>Compass Router</strong>
            <small>Platform Control Center</small>
          </span>
        </div>
        <div className="admin-header-actions">
          <span className="admin-identity">
            <span className="admin-avatar">
              {access.email.slice(0, 1).toUpperCase()}
            </span>
            {access.email}
          </span>
          <button
            className="admin-icon-button"
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh admin data"
            title="Refresh admin data"
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="admin-secondary"
            type="button"
            onClick={() => void logout()}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>
      <div className="admin-body">
        <aside className="admin-sidebar">
          <div className="admin-context">
            <ShieldCheck size={17} />
            <div>
              <strong>Global platform</strong>
              <small>{access.roles.join(" · ")}</small>
            </div>
          </div>
          {groups.map((group) => (
            <nav key={group} className="admin-nav-group" aria-label={group}>
              <span>{group}</span>
              {visibleSections
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={section === item.id ? "is-active" : ""}
                      onClick={() => {
                        setSection(item.id);
                        setStatus("");
                        setError("");
                      }}
                    >
                      <Icon size={16} />
                      {item.label}
                      <ChevronRight size={14} />
                    </button>
                  );
                })}
            </nav>
          ))}
        </aside>
        <section className="admin-main">
          <div className="admin-titlebar">
            <div>
              <span className="admin-eyebrow">SUPER ADMIN</span>
              <h1>
                {sections.find((item) => item.id === section)?.label ??
                  "Platform Overview"}
              </h1>
              <p>Server-backed platform governance for Compass Router.</p>
            </div>
            <span className="admin-role-chip">
              <ShieldCheck size={14} />
              {access.roles[0] ?? "Administrator"}
            </span>
          </div>
          {status ? (
            <div className="admin-notice success">
              <CheckCircle2 size={16} />
              {status}
            </div>
          ) : null}
          {error ? (
            <div className="admin-notice error">
              <AlertTriangle size={16} />
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="admin-panel">
              <div className="admin-loading-inline">
                <RefreshCw className="animate-spin" size={18} />
                Loading live platform data...
              </div>
            </div>
          ) : null}
          {!loading && section === "overview" ? (
            <section className="admin-section">
              <div className="admin-metrics">
                {overview ? (
                  <>
                    <Metric
                      label="Registered customers"
                      value={overview.customers.total}
                      detail={`${overview.customers.active} active`}
                    />
                    <Metric
                      label="Organizations"
                      value={overview.organizations}
                    />
                    <Metric
                      label="Active API keys"
                      value={overview.active_api_keys}
                    />
                    <Metric
                      label="Requests"
                      value={overview.requests.total}
                      detail={`${overview.requests.success_rate === null ? "No" : `${(overview.requests.success_rate * 100).toFixed(1)}%`} success rate`}
                      tone="accent"
                    />
                    <Metric
                      label="Tokens"
                      value={overview.tokens.total.toLocaleString()}
                      detail={`${overview.tokens.input.toLocaleString()} input · ${overview.tokens.output.toLocaleString()} output`}
                    />
                    <Metric
                      label="Customer charges"
                      value={formatPaise(
                        overview.financial.customer_charges_paise,
                      )}
                      detail={`Provider cost ${formatPaise(overview.financial.provider_cost_paise)}`}
                    />
                    <Metric
                      label="Gross margin estimate"
                      value={formatPaise(
                        overview.financial.gross_margin_estimate_paise,
                      )}
                      detail="Charges minus provider cost"
                      tone="accent"
                    />
                    <Metric
                      label="Credits liabilities"
                      value={formatPaise(
                        overview.financial.wallet_liabilities_paise,
                      )}
                      detail="Current prepaid balances"
                    />
                  </>
                ) : (
                  <EmptyState message="No command-center data is available." />
                )}
              </div>
              {overview ? (
                <div className="admin-grid-two">
                  <article className="admin-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Operational health</h2>
                        <p>Current records and provider state.</p>
                      </div>
                      <BarChart3 size={18} />
                    </div>
                    <dl className="admin-facts">
                      <div>
                        <dt>Average latency</dt>
                        <dd>{overview.latency_ms.average.toFixed(0)} ms</dd>
                      </div>
                      <div>
                        <dt>Provider health</dt>
                        <dd>
                          {overview.provider_health.healthy} healthy ·{" "}
                          {overview.provider_health.degraded} degraded ·{" "}
                          {overview.provider_health.disabled} disabled
                        </dd>
                      </div>
                      <div>
                        <dt>Failed settlements</dt>
                        <dd>{overview.failed_settlements}</dd>
                      </div>
                      <div>
                        <dt>Payment reconciliation</dt>
                        <dd>
                          {overview.pending_payment_reconciliation} pending
                          events
                        </dd>
                      </div>
                      <div>
                        <dt>Security alerts</dt>
                        <dd>{overview.security_alerts}</dd>
                      </div>
                      <div>
                        <dt>Last generated</dt>
                        <dd>{shortDate(overview.generated_at)}</dd>
                      </div>
                    </dl>
                  </article>
                  <article className="admin-panel admin-honesty">
                    <AlertTriangle size={18} />
                    <div>
                      <h2>Metric definitions</h2>
                      <p>
                        Prepaid Credits top-ups are liabilities, not inference
                        revenue. Platform fees and payment processing costs are
                        not recorded in the current ledger, so they are not
                        estimated here. Percentile latency requires an
                        aggregation job and is shown as unavailable until one is
                        configured.
                      </p>
                    </div>
                  </article>
                </div>
              ) : null}
            </section>
          ) : null}
          {!loading && section === "customers" ? (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Customer accounts</h2>
                  <p>
                    Metadata-only diagnostics. Suspension preserves records and
                    revokes active sessions.
                  </p>
                </div>
                <Users size={18} />
              </div>
              <div className="admin-filter">
                <input
                  aria-label="Search customers"
                  placeholder="Search customer email"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                />
                <button
                  className="admin-table-action"
                  type="button"
                  onClick={() => void loadSection("customers")}
                >
                  Search
                </button>
              </div>
              {customers?.items.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Organizations</th>
                        <th>Projects</th>
                        <th>Keys</th>
                        <th>Created</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {customers.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.email}</strong>
                            <small>{item.id}</small>
                          </td>
                          <td>
                            <span className={`admin-status ${item.status}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>{item.organization_count}</td>
                          <td>{item.project_count}</td>
                          <td>{item.api_key_count}</td>
                          <td>{shortDate(item.created_at)}</td>
                          <td>
                            {can("customers.manage") ? (
                              <button
                                className="admin-table-action"
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void updateCustomer(
                                    item.id,
                                    item.status === "suspended"
                                      ? "active"
                                      : "suspended",
                                  )
                                }
                              >
                                {item.status === "suspended"
                                  ? "Reactivate"
                                  : "Suspend"}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No customer accounts match the current dataset." />
              )}
            </section>
          ) : null}
          {!loading && section === "organizations" ? (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Organizations</h2>
                  <p>Global tenant inventory and membership counts.</p>
                </div>
                <Building2 size={18} />
              </div>
              {(
                data.organizations as
                  | {
                      items: Array<{
                        id: string;
                        name: string;
                        member_count: number;
                        project_count: number;
                        created_at: string;
                      }>;
                      total: number;
                    }
                  | undefined
              )?.items.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Organization</th>
                        <th>Members</th>
                        <th>Projects</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        data.organizations as {
                          items: Array<{
                            id: string;
                            name: string;
                            member_count: number;
                            project_count: number;
                            created_at: string;
                          }>;
                        }
                      ).items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            <small>{item.id}</small>
                          </td>
                          <td>{item.member_count}</td>
                          <td>{item.project_count}</td>
                          <td>{shortDate(item.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No organizations are recorded." />
              )}
            </section>
          ) : null}
          {!loading && section === "teams" ? (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Teams</h2>
                  <p>
                    Global team inventory without exposing customer credentials.
                  </p>
                </div>
                <Users size={18} />
              </div>
              {(
                data.teams as
                  | Array<{
                      id: string;
                      name: string;
                      slug: string;
                      is_active: boolean;
                      created_at: string;
                    }>
                  | undefined
              )?.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Slug</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        data.teams as Array<{
                          id: string;
                          name: string;
                          slug: string;
                          is_active: boolean;
                          created_at: string;
                        }>
                      ).map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            <small>{item.id}</small>
                          </td>
                          <td>
                            <code>{item.slug}</code>
                          </td>
                          <td>
                            <span
                              className={`admin-status ${item.is_active ? "active" : "disabled"}`}
                            >
                              {item.is_active ? "active" : "disabled"}
                            </span>
                          </td>
                          <td>{shortDate(item.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No teams are recorded." />
              )}
            </section>
          ) : null}
          {!loading && section === "projects" ? (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Projects</h2>
                  <p>
                    Project scope and membership counts for cross-tenant
                    diagnostics.
                  </p>
                </div>
                <FolderKanban size={18} />
              </div>
              {(
                data.projects as
                  | {
                      items: Array<{
                        id: string;
                        organization_id: string;
                        name: string;
                        slug: string;
                        is_default: boolean;
                        is_active: boolean;
                        member_count: number;
                        created_at: string;
                      }>;
                    }
                  | undefined
              )?.items.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Organization</th>
                        <th>Members</th>
                        <th>State</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        data.projects as {
                          items: Array<{
                            id: string;
                            organization_id: string;
                            name: string;
                            slug: string;
                            is_default: boolean;
                            is_active: boolean;
                            member_count: number;
                            created_at: string;
                          }>;
                        }
                      ).items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            <small>
                              {item.slug}
                              {item.is_default ? " · default" : ""}
                            </small>
                          </td>
                          <td>
                            <code>{item.organization_id}</code>
                          </td>
                          <td>{item.member_count}</td>
                          <td>
                            <span
                              className={`admin-status ${item.is_active ? "active" : "disabled"}`}
                            >
                              {item.is_active ? "active" : "disabled"}
                            </span>
                          </td>
                          <td>{shortDate(item.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No projects are recorded." />
              )}
            </section>
          ) : null}
          {!loading && section === "keys" ? (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>API key inventory</h2>
                  <p>
                    Only key metadata and prefixes are displayed. Secret values
                    are never recoverable.
                  </p>
                </div>
                <KeyRound size={18} />
              </div>
              {(
                data.keys as
                  | { items: Array<Record<string, unknown>>; total: number }
                  | undefined
              )?.items.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Prefix</th>
                        <th>Status</th>
                        <th>Project</th>
                        <th>Last used</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        data.keys as { items: Array<Record<string, unknown>> }
                      ).items.map((item) => (
                        <tr key={String(item.id)}>
                          <td>
                            <strong>{String(item.name)}</strong>
                            <small>{String(item.key_id)}</small>
                          </td>
                          <td>
                            <code>{String(item.key_prefix)}</code>
                          </td>
                          <td>
                            <span
                              className={`admin-status ${String(item.status)}`}
                            >
                              {String(item.status)}
                            </span>
                          </td>
                          <td>{String(item.project_id ?? "Unassigned")}</td>
                          <td>
                            {shortDate(item.last_used_at as string | null)}
                          </td>
                          <td>{shortDate(item.created_at as string)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No API keys are recorded." />
              )}
            </section>
          ) : null}
          {!loading && section === "providers" ? (
            <section className="admin-section">
              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Provider health and activation</h2>
                    <p>
                      Credentials remain server-side. Enabling a route still
                      requires verified adapter, credential, and commercial
                      gates.
                    </p>
                  </div>
                  <Database size={18} />
                </div>
                {providers?.length ? (
                  <div className="admin-provider-list">
                    {providers.map((provider) => (
                      <div className="admin-provider-row" key={provider.name}>
                        <div>
                        <strong>{provider.name === "typesafe_ai" ? "TypeSafe AI" : provider.name}</strong>
                          <small>
                            {provider.commercial_status} ·{" "}
                            {provider.last_health?.status ?? "No health check"}
                            {provider.last_health
                              ? ` · ${provider.last_health.latency_ms} ms`
                              : ""}
                          </small>
                        </div>
                        <span
                          className={`admin-status ${provider.enabled ? "active" : "disabled"}`}
                        >
                          {provider.enabled ? "enabled" : "disabled"}
                        </span>
                        {can("providers.manage") ? (
                          <button
                            className="admin-table-action"
                            type="button"
                            disabled={busy}
                            onClick={() => void toggleProvider(provider)}
                          >
                            {provider.enabled ? "Disable" : "Enable"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No provider records are available." />
                )}
                {(() => {
                  const typesafeProvider = providers?.find((provider) => provider.name === "typesafe_ai");
                  const jev = models?.find((model) => model.id === "typesafe_ai/jev-latest");
                  if (!typesafeProvider || !jev) return null;
                  return <TypeSafeProviderCard provider={typesafeProvider} model={jev} canManage={can("providers.manage")} canManagePricing={can("models.manage")} busy={busy} onSave={saveProviderCredential} onVerify={verifyProviderCredential} onApprovePricing={approveModelPricing} />;
                })()}
              </article>
              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Live readiness</h2>
                    <p>Actual release blockers from the API.</p>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <pre className="admin-readiness">
                  {JSON.stringify(data.readiness ?? {}, null, 2)}
                </pre>
              </article>
            </section>
          ) : null}
          {!loading && section === "models" ? (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Model registry and pricing</h2>
                  <p>
                    Availability and prices are persisted model policies;
                    revisions are audited on change.
                  </p>
                </div>
                <Route size={18} />
              </div>
              {models?.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Provider</th>
                        <th>State</th>
                        <th>Customer price</th>
                        <th>Route</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {models.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.display_name}</strong>
                            <small>{item.id}</small>
                          </td>
                          <td>{item.provider}</td>
                          <td>
                            <span
                              className={`admin-status ${item.published && item.enabled ? "active" : "disabled"}`}
                            >
                              {item.published && item.enabled
                                ? "published"
                                : item.status}
                            </span>
                          </td>
                          <td>
                            {formatPaise(item.input_price_paise_per_1k)} / 1K in
                            <br />
                            {formatPaise(item.output_price_paise_per_1k)} / 1K
                            out
                          </td>
                          <td>
                            {item.provider_enabled
                              ? item.provider_status
                              : "unavailable"}
                          </td>
                          <td>
                            {can("models.manage") ? (
                              <button
                                className="admin-table-action"
                                type="button"
                                disabled={busy}
                                onClick={() => void toggleModel(item)}
                              >
                                {item.enabled ? "Disable" : "Enable"}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No model catalog records are available." />
              )}
            </section>
          ) : null}
          {!loading && section === "routing" ? (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Routing policies</h2>
                  <p>
                    Candidate models are validated against the registry; changes
                    create rollback snapshots.
                  </p>
                </div>
                <Route size={18} />
              </div>
              {(
                data.routing as
                  | Array<{
                      id: string;
                      alias: string;
                      candidate_models: string[];
                      enabled: boolean;
                    }>
                  | undefined
              )?.length ? (
                <div className="admin-audit-list">
                  {(
                    data.routing as Array<{
                      id: string;
                      alias: string;
                      candidate_models: string[];
                      enabled: boolean;
                    }>
                  ).map((item) => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.alias}</strong>
                        <small>{item.candidate_models.join(" → ")}</small>
                      </div>
                      <span
                        className={`admin-status ${item.enabled ? "active" : "disabled"}`}
                      >
                        {item.enabled ? "enabled" : "disabled"}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState message="No routing policies are configured." />
              )}
            </section>
          ) : null}
          {!loading && section === "finance" ? (
            <section className="admin-section">
              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Credits accounts</h2>
                    <p>
                      Available and reserved balances are read from credit
                      records; adjustments append ledger entries.
                    </p>
                  </div>
                  <WalletCards size={18} />
                </div>
                {wallets?.items.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Credits account</th>
                          <th>Available</th>
                          <th>Reserved</th>
                          <th>Status</th>
                          <th>Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wallets.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>
                                {item.team_id ??
                                  item.organization_id ??
                                  item.id}
                              </strong>
                              <small>{item.currency}</small>
                            </td>
                            <td>{formatPaise(item.available_balance_paise)}</td>
                            <td>{formatPaise(item.reserved_balance_paise)}</td>
                            <td>
                              <span className={`admin-status ${item.status}`}>
                                {item.status}
                              </span>
                            </td>
                            <td>{shortDate(item.updated_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message="No Credits accounts are recorded." />
                )}
              </article>
              {can("finance.adjust") ? (
                <article className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <h2>Manual credit adjustment</h2>
                      <p>
                        Use a positive or compensating negative amount. Large
                        changes require a second finance-authorized approver.
                      </p>
                    </div>
                    <CircleDollarSign size={18} />
                  </div>
                  <form className="admin-form" onSubmit={submitAdjustment}>
                    <label>
                      Team ID
                      <input
                        required
                        value={adjustment.team_id}
                        onChange={(event) =>
                          setAdjustment({
                            ...adjustment,
                            team_id: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Amount in paise
                      <input
                        required
                        type="number"
                        value={adjustment.amount_paise}
                        onChange={(event) =>
                          setAdjustment({
                            ...adjustment,
                            amount_paise: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Reason
                      <textarea
                        required
                        value={adjustment.reason}
                        onChange={(event) =>
                          setAdjustment({
                            ...adjustment,
                            reason: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Idempotency key
                      <input
                        required
                        minLength={8}
                        value={adjustment.idempotency_key}
                        onChange={(event) =>
                          setAdjustment({
                            ...adjustment,
                            idempotency_key: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      className="admin-primary"
                      type="submit"
                      disabled={busy}
                    >
                      Commit ledger adjustment
                    </button>
                  </form>
                </article>
              ) : null}
            </section>
          ) : null}
          {!loading && section === "payments" ? (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Payments, refunds, and reconciliation</h2>
                  <p>
                    Financial state comes from verified provider events and
                    Compass ledger records.
                  </p>
                </div>
                <CreditCard size={18} />
              </div>
              <pre className="admin-readiness">
                {JSON.stringify(data.reconciliation ?? {}, null, 2)}
              </pre>
            </section>
          ) : null}
          {!loading && section === "operations" ? (
            <section className="admin-section">
              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Request metadata explorer</h2>
                    <p>
                      {requests?.content_policy ??
                        "Raw prompts and completions are not displayed."}
                    </p>
                  </div>
                  <FileClock size={18} />
                </div>
                {requests?.items.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Request</th>
                          <th>Model/provider</th>
                          <th>Status</th>
                          <th>Credential</th>
                          <th>Latency</th>
                          <th>Tokens</th>
                          <th>Customer Credits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <code>{item.id}</code>
                              <small>{shortDate(item.timestamp)}</small>
                            </td>
                            <td>
                              <strong>{item.model}</strong>
                              <small>{item.provider}</small>
                            </td>
                            <td>
                              <span className={`admin-status ${item.status}`}>
                                {item.status}
                              </span>
                              <small>{item.failure_category ?? ""}</small>
                            </td>
                            <td>
                              {item.credential_mode === "byok"
                                ? "BYOK"
                                : "Managed"}
                            </td>
                            <td>{item.latency_ms} ms</td>
                            <td>{item.total_tokens.toLocaleString()}</td>
                            <td>{formatPaise(item.customer_charge_paise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message="No request metadata is available for the current dataset." />
                )}
              </article>
              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Provider analytics</h2>
                    <p>
                      Aggregated operational usage. BYOK requests remain visible
                      for provider cost and reliability analysis but carry zero
                      Compass Credits.
                    </p>
                  </div>
                  <BarChart3 size={18} />
                </div>
                {(
                  data.providerAnalytics as
                    { items: ProviderAnalytics[]; total: number } | undefined
                )?.items.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Provider / model</th>
                          <th>Scope</th>
                          <th>Credential</th>
                          <th>Usage</th>
                          <th>Requests</th>
                          <th>Tokens</th>
                          <th>Provider cost</th>
                          <th>Compass Credits</th>
                          <th>Failures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          data.providerAnalytics as {
                            items: ProviderAnalytics[];
                          }
                        ).items.map((item, index) => (
                          <tr
                            key={`${item.period ?? "undated"}-${item.provider}-${item.model}-${item.organization_id ?? "global"}-${item.project_id ?? "all"}-${index}`}
                          >
                            <td>{item.period ?? "-"}</td>
                            <td>
                              <strong>{item.provider}</strong>
                              <small>{item.model}</small>
                            </td>
                            <td>
                              <small>
                                {item.organization_id ?? "All organizations"}
                              </small>
                              <small>{item.project_id ?? "All projects"}</small>
                            </td>
                            <td>
                              {item.credential_mode === "byok"
                                ? "BYOK"
                                : "Managed"}
                            </td>
                            <td>{item.usage_finality ?? "unavailable"}</td>
                            <td>{item.requests.toLocaleString()}</td>
                            <td>
                              {(
                                item.input_tokens + item.output_tokens
                              ).toLocaleString()}
                            </td>
                            <td>{formatPaise(item.provider_cost_paise)}</td>
                            <td>{formatPaise(item.customer_charge_paise)}</td>
                            <td>{item.failed_requests.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message="No provider analytics are available for the current dataset." />
                )}
              </article>
            </section>
          ) : null}
          {!loading && section === "security" ? (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Security and audit events</h2>
                  <p>
                    Administrative changes are recorded with actor, target,
                    request ID, and safe metadata.
                  </p>
                </div>
                <ShieldCheck size={18} />
              </div>
              {audit?.items.length ? (
                <div className="admin-audit-list">
                  {audit.items.map((item) => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.action}</strong>
                        <small>
                          {item.target} · {shortDate(item.created_at)}
                        </small>
                      </div>
                      <code>{item.request_id ?? "No request ID"}</code>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState message="No security events are recorded." />
              )}
            </section>
          ) : null}
          {!loading && section === "roles" ? (
            <section className="admin-section">
              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Platform role assignments</h2>
                    <p>
                      Only the platform Super Admin can grant subordinate
                      platform roles.
                    </p>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                {roles?.length ? (
                  <div className="admin-audit-list">
                    {roles.map((item) => (
                      <article key={item.id}>
                        <div>
                          <strong>{item.email ?? item.user_id}</strong>
                          <small>
                            {item.role} · {item.status} · {item.reason}
                          </small>
                        </div>
                        <div className="admin-row-actions">
                          <code>{shortDate(item.created_at)}</code>
                          {can("*") && item.status === "active" ? (
                            <button
                              className="admin-table-action danger"
                              type="button"
                              disabled={busy}
                              onClick={() => void revokeRole(item)}
                            >
                              Revoke
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No explicit platform role assignments exist. Legacy admin roles remain mapped for compatibility." />
                )}
              </article>
              {can("*") ? (
                <article className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <h2>Grant subordinate role</h2>
                      <p>
                        Use an internal user ID from the customer directory.
                        Super Admin is bootstrapped separately.
                      </p>
                    </div>
                    <Users size={18} />
                  </div>
                  <form className="admin-form" onSubmit={submitRole}>
                    <label>
                      User ID
                      <input
                        required
                        value={roleForm.user_id}
                        onChange={(event) =>
                          setRoleForm({
                            ...roleForm,
                            user_id: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Role
                      <select
                        value={roleForm.role}
                        onChange={(event) =>
                          setRoleForm({ ...roleForm, role: event.target.value })
                        }
                      >
                        <option>PLATFORM_ADMIN</option>
                        <option>FINANCE_ADMIN</option>
                        <option>SUPPORT_ADMIN</option>
                        <option>READ_ONLY_AUDITOR</option>
                      </select>
                    </label>
                    <label>
                      Reason
                      <textarea
                        required
                        value={roleForm.reason}
                        onChange={(event) =>
                          setRoleForm({
                            ...roleForm,
                            reason: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      className="admin-primary"
                      type="submit"
                      disabled={busy}
                    >
                      Grant role
                    </button>
                  </form>
                </article>
              ) : null}
            </section>
          ) : null}
          {!loading && section === "settings" ? (
            <section className="admin-section">
              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Runtime-safe platform settings</h2>
                    <p>
                      These values are database-backed and audited. Secrets and
                      deployment configuration remain outside the console.
                    </p>
                  </div>
                  <Settings2 size={18} />
                </div>
                {settings?.items.length ? (
                  <div className="admin-settings-list">
                    {settings.items.map((item) => (
                      <div key={item.key}>
                        <div>
                          <strong>{item.key}</strong>
                          <small>{shortDate(item.updated_at)}</small>
                        </div>
                        <code>{JSON.stringify(item.value)}</code>
                        {can("settings.manage") &&
                        typeof item.value === "boolean" ? (
                          <button
                            className="admin-table-action"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void updateSettings({ [item.key]: !item.value })
                            }
                          >
                            {item.value ? "Disable" : "Enable"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No runtime settings have been customized." />
                )}
              </article>
              <article className="admin-panel admin-honesty">
                <XCircle size={18} />
                <div>
                  <h2>Deployment-managed configuration</h2>
                  <p>
                    {settings?.deployment_managed.join(" · ") ??
                      "Secret Manager values"}{" "}
                    remain server-side and are not editable here.
                  </p>
                </div>
              </article>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
