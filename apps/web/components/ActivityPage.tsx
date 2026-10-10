"use client";

import { BarChart3, CheckCircle2, Clock3, Download, Filter, ListFilter, Printer, Search, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";

import { formatPaise } from "../lib/api";

type ActivityRow = {
  id: string;
  status: string;
  error_code?: string | null;
  model: string;
  provider: string;
  credential_mode?: string;
  provider_cost_paise?: number;
  tokens: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_paise: number;
  latency_ms: number;
  created_at: string;
};
type ProviderAnalytics = { period?: string | null; provider: string; model: string; project_id?: string | null; credential_mode: string; requests: number; input_tokens: number; output_tokens: number; provider_cost_paise: number; customer_charge_paise: number; failed_requests: number };

type Tab = "overview" | "trends" | "logs" | "explore";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function percentile(values: number[], percentage: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((percentage / 100) * sorted.length) - 1)]);
}

function latencyValue(value: number, hasData: boolean) {
  return hasData ? `${value} ms` : "-";
}

function ActivityMetric({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: string }) {
  return <article className={`activity-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function ActivityPage({ rows, providerAnalytics = [] }: { rows: ActivityRow[]; providerAnalytics?: ProviderAnalytics[] }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState("30");
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [billingMode, setBillingMode] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metric, setMetric] = useState("spend");
  const [groupBy, setGroupBy] = useState("model");
  const [saved, setSaved] = useState<string[]>([]);
  const [now] = useState(() => Date.now());

  const providers = useMemo(() => Array.from(new Set(rows.map((row) => row.provider))).sort(), [rows]);
  const models = useMemo(() => Array.from(new Set(rows.map((row) => row.model))).sort(), [rows]);
  const filtered = useMemo(() => {
    const cutoff = Number(range);
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const inRange = !Number.isFinite(cutoff) || now - new Date(row.created_at).getTime() <= cutoff * 24 * 60 * 60 * 1000;
      const matchesSearch = !term || `${row.id} ${row.model} ${row.provider} ${row.error_code ?? ""}`.toLowerCase().includes(term);
      return inRange && matchesSearch && (provider === "all" || row.provider === provider) && (modelFilter === "all" || row.model === modelFilter) && (status === "all" || row.status === status) && (billingMode === "all" || (row.credential_mode ?? "platform") === billingMode);
    });
  }, [billingMode, modelFilter, now, provider, query, range, rows, status]);

  const summary = useMemo(() => {
    const successful = filtered.filter((row) => row.status === "success").length;
    const tokens = filtered.reduce((sum, row) => sum + row.tokens, 0);
    const inputTokens = filtered.reduce((sum, row) => sum + (row.input_tokens ?? 0), 0);
    const outputTokens = filtered.reduce((sum, row) => sum + (row.output_tokens ?? 0), 0);
    const spend = filtered.reduce((sum, row) => sum + row.cost_paise, 0);
    const providerCost = filtered.reduce((sum, row) => sum + (row.provider_cost_paise ?? 0), 0);
    const latencies = filtered.map((row) => row.latency_ms);
    const latency = filtered.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / filtered.length) : 0;
    const blendedCost = tokens ? Math.round((spend / tokens) * 1_000_000) : 0;
    const byokRequests = filtered.filter((row) => row.credential_mode === "byok").length;
    return { successful, tokens, inputTokens, outputTokens, spend, providerCost, byokRequests, latency, p50: percentile(latencies, 50), p90: percentile(latencies, 90), p99: percentile(latencies, 99), blendedCost, successRate: filtered.length ? Math.round((successful / filtered.length) * 100) : 0 };
  }, [filtered]);

  const grouped = useMemo(() => {
    const values = new Map<string, { requests: number; tokens: number; spend: number }>();
    for (const row of filtered) {
      const key = groupBy === "provider" ? row.provider : groupBy === "status" ? row.status : row.model;
      const current = values.get(key) ?? { requests: 0, tokens: 0, spend: 0 };
      current.requests += 1;
      current.tokens += row.tokens;
      current.spend += row.cost_paise;
      values.set(key, current);
    }
    return Array.from(values.entries()).sort(([, a], [, b]) => (metric === "requests" ? b.requests - a.requests : metric === "tokens" ? b.tokens - a.tokens : b.spend - a.spend)).slice(0, 8);
  }, [filtered, groupBy, metric]);

  const daily = useMemo(() => {
    const values = new Map<string, number>();
    for (const row of filtered) {
      const key = row.created_at.slice(0, 10);
      values.set(key, (values.get(key) ?? 0) + (metric === "requests" ? 1 : metric === "tokens" ? row.tokens : row.cost_paise));
    }
    return Array.from(values.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  }, [filtered, metric]);

  const trends = useMemo(() => {
    const days = Math.max(Number(range), 1);
    const windowMs = days * 24 * 60 * 60 * 1000;
    const current = new Map<string, number>();
    const previous = new Map<string, number>();
    const term = query.trim().toLowerCase();
    const measure = (row: ActivityRow) => metric === "requests" ? 1 : metric === "tokens" ? row.tokens : row.cost_paise;
    for (const row of rows) {
      const age = now - new Date(row.created_at).getTime();
      const matches = (!term || `${row.id} ${row.model} ${row.provider} ${row.error_code ?? ""}`.toLowerCase().includes(term)) && (provider === "all" || row.provider === provider) && (modelFilter === "all" || row.model === modelFilter) && (status === "all" || row.status === status) && (billingMode === "all" || (row.credential_mode ?? "platform") === billingMode);
      if (!matches || age < 0 || age > windowMs * 2) continue;
      const key = groupBy === "provider" ? row.provider : groupBy === "status" ? row.status : row.model;
      const target = age <= windowMs ? current : previous;
      target.set(key, (target.get(key) ?? 0) + measure(row));
    }
    return Array.from(new Set([...current.keys(), ...previous.keys()])).map((name) => {
      const currentValue = current.get(name) ?? 0;
      const previousValue = previous.get(name) ?? 0;
      return { name, currentValue, previousValue, delta: currentValue - previousValue };
    }).sort((a, b) => b.delta - a.delta).slice(0, 8);
  }, [billingMode, groupBy, metric, modelFilter, now, provider, query, range, rows, status]);

  const selected = selectedId ? rows.find((row) => row.id === selectedId) ?? null : null;
  const maxGrouped = Math.max(...grouped.map(([, value]) => metric === "requests" ? value.requests : metric === "tokens" ? value.tokens : value.spend), 1);
  const maxDaily = Math.max(...daily.map(([, value]) => value), 1);

  function exportCsv() {
    const header = ["request_id", "created_at", "status", "model", "provider", "credential_mode", "tokens", "input_tokens", "output_tokens", "provider_cost_paise", "credits_paise", "latency_ms", "error_code"];
    const body = filtered.map((row) => [row.id, row.created_at, row.status, row.model, row.provider, row.credential_mode ?? "platform", row.tokens, row.input_tokens ?? "", row.output_tokens ?? "", row.provider_cost_paise ?? 0, row.cost_paise, row.latency_ms, row.error_code ?? ""]);
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `compass-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  function saveView() {
    const name = `${metric} by ${groupBy}`;
    if (!saved.includes(name)) setSaved((current) => [...current, name]);
  }

  return <section className="activity-page">
    <div className="activity-hero"><div><span className="analytics-eyebrow">Workspace activity</span><h2>Understand every model request.</h2><p>Monitor spend, reliability, latency, and token volume across the selected workspace.</p></div><div className="activity-hero-actions"><button className="console-secondary" onClick={printReport}><Printer size={16} />Print / PDF</button><button className="console-secondary" onClick={exportCsv}><Download size={16} />Export CSV</button></div></div>
    <div className="activity-tabs" role="tablist" aria-label="Activity views">{(["overview", "trends", "logs", "explore"] as Tab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "overview" ? "Overview" : item === "trends" ? "Trends" : item === "logs" ? "Request logs" : "Explore"}</button>)}</div>
    <div className="activity-toolbar"><div className="activity-range" role="group" aria-label="Activity time range">{[["1", "24h"], ["7", "7d"], ["30", "30d"]].map(([value, label]) => <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{label}</button>)}</div><label className="activity-search"><Search size={16} /><input aria-label="Search activity" placeholder="Search model, provider, or request ID" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="activity-select"><Filter size={15} /><span className="sr-only">Provider</span><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="all">All providers</option>{providers.map((item) => <option key={item}>{item}</option>)}</select></label><label className="activity-select"><ListFilter size={15} /><span className="sr-only">Model</span><select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}><option value="all">All models</option>{models.map((item) => <option key={item}>{item}</option>)}</select></label><label className="activity-select"><ListFilter size={15} /><span className="sr-only">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="success">Success</option><option value="error">Error</option></select></label><label className="activity-select"><ListFilter size={15} /><span className="sr-only">Billing mode</span><select value={billingMode} onChange={(event) => setBillingMode(event.target.value)}><option value="all">Managed and BYOK</option><option value="platform">Managed</option><option value="byok">BYOK</option></select></label></div>

    {tab === "overview" ? <>
      <div className="activity-metrics"><ActivityMetric label="Compass Credits" value={formatPaise(summary.spend)} detail={`${filtered.length} filtered requests`} tone="accent" /><ActivityMetric label="Requests" value={String(filtered.length)} detail={filtered.length ? `${summary.successRate}% successful` : "No activity yet"} /><ActivityMetric label="BYOK requests" value={String(summary.byokRequests)} detail="No Compass Credits charged" /><ActivityMetric label="Provider cost" value={formatPaise(summary.providerCost)} detail="Upstream estimate or reported cost" /><ActivityMetric label="P90 latency" value={latencyValue(summary.p90, filtered.length > 0)} detail={filtered.length ? `Average ${summary.latency} ms` : "No activity yet"} /><ActivityMetric label="Failure rate" value={filtered.length ? `${100 - summary.successRate}%` : "-"} detail={filtered.length ? `${filtered.length - summary.successful} failed requests` : "No activity yet"} /></div>
      <div className="activity-grid"><section className="activity-card activity-chart-card"><div className="activity-card-heading"><div><h3>Usage over time</h3><p>{metric === "spend" ? "Spend in INR" : metric === "tokens" ? "Tokens" : "Requests"} by day</p></div><BarChart3 size={19} /></div><div className="activity-bars">{daily.length ? daily.map(([day, value]) => <div className="activity-bar-item" key={day}><div className="activity-bar-track"><span style={{ height: `${Math.max((value / maxDaily) * 100, 5)}%` }} /></div><small>{shortDate(day)}</small></div>) : <div className="activity-empty">Requests will appear here after the first model call.</div>}</div></section><section className="activity-card"><div className="activity-card-heading"><div><h3>Top {groupBy}s</h3><p>Ranked by {metric}</p></div><CheckCircle2 size={19} /></div><div className="activity-ranked">{grouped.length ? grouped.map(([name, value]) => { const amount = metric === "requests" ? value.requests : metric === "tokens" ? value.tokens : value.spend; return <div key={name}><div><span title={name}>{name}</span><strong>{metric === "spend" ? formatPaise(amount) : amount.toLocaleString("en-IN")}</strong></div><div className="activity-rank-track"><span style={{ width: `${Math.max((amount / maxGrouped) * 100, 5)}%` }} /></div></div>; }) : <div className="activity-empty">No matching activity.</div>}</div></section></div>
      <div className="activity-analytics-grid"><section className="activity-card activity-breakdown"><div className="activity-card-heading"><div><h3>Latency distribution</h3><p>Percentiles show the long-tail experience.</p></div><Clock3 size={19} /></div><div className="activity-breakdown-grid"><div><span>P50 latency</span><strong>{latencyValue(summary.p50, filtered.length > 0)}</strong></div><div><span>P90 latency</span><strong>{latencyValue(summary.p90, filtered.length > 0)}</strong></div><div><span>P99 latency</span><strong>{latencyValue(summary.p99, filtered.length > 0)}</strong></div><div><span>Data retention</span><strong>Metadata only</strong></div></div></section><section className="activity-card activity-breakdown"><div className="activity-card-heading"><div><h3>Token mix</h3><p>Recorded prompt and completion usage.</p></div><Clock3 size={19} /></div><div className="activity-breakdown-grid"><div><span>Input tokens</span><strong>{filtered.length ? summary.inputTokens.toLocaleString("en-IN") : "-"}</strong></div><div><span>Output tokens</span><strong>{filtered.length ? summary.outputTokens.toLocaleString("en-IN") : "-"}</strong></div><div><span>Successful requests</span><strong>{filtered.length ? summary.successful : "-"}</strong></div><div><span>Cache hit rate</span><strong>Not recorded</strong></div></div></section></div>
      {providerAnalytics.length ? <section className="activity-card activity-breakdown"><div className="activity-card-heading"><div><h3>Organization provider analytics</h3><p>Metadata for this organization only. BYOK traffic has zero Compass Credits charged.</p></div><BarChart3 size={19} /></div><div className="activity-log-table"><div className="activity-log-header"><span>Date</span><span>Provider / model</span><span>Project</span><span>Mode</span><span>Requests</span><span>Provider cost</span><span>Credits</span></div>{providerAnalytics.slice(0, 20).map((item, index) => <div className="activity-log-row" key={`${item.period}-${item.provider}-${item.model}-${index}`}><span>{item.period ?? "-"}</span><span><strong>{item.provider}</strong><small>{item.model}</small></span><span>{item.project_id ?? "All projects"}</span><span>{item.credential_mode === "byok" ? "BYOK" : "Managed"}</span><span>{item.requests.toLocaleString("en-IN")}</span><span>{formatPaise(item.provider_cost_paise)}</span><span>{formatPaise(item.customer_charge_paise)}</span></div>)}</div></section> : null}
    </> : null}

    {tab === "trends" ? <section className="activity-card activity-trends"><div className="activity-card-heading"><div><h3>Trends</h3><p>Compare the selected period with the previous period by {groupBy}.</p></div><TrendingUp size={19} /></div><div className="activity-trend-list">{trends.length ? trends.map((item) => <div className="activity-trend-row" key={item.name}><div><strong>{item.name}</strong><small>{metric === "spend" ? formatPaise(item.currentValue) : item.currentValue.toLocaleString("en-IN")} in current period</small></div><span className={item.delta >= 0 ? "rising" : "falling"}>{item.delta >= 0 ? "+" : "-"}{metric === "spend" ? formatPaise(Math.abs(item.delta)) : Math.abs(item.delta).toLocaleString("en-IN")}</span></div>) : <div className="activity-empty">Not enough historical activity for a comparison.</div>}</div></section> : null}

    {tab === "logs" ? <section className="activity-card activity-logs"><div className="activity-card-heading"><div><h3>Request logs</h3><p>Click a request to inspect routing and billing metadata.</p></div><strong>{filtered.length} requests</strong></div><div className="activity-log-table"><div className="activity-log-header"><span>Status</span><span>Request</span><span>Model / provider</span><span>Tokens</span><span>Cost</span><span>Latency</span></div>{filtered.length ? filtered.map((row) => <button className={`activity-log-row ${selectedId === row.id ? "selected" : ""}`} key={row.id} onClick={() => setSelectedId(row.id)}><span><i className={row.status === "success" ? "success" : "error"} />{row.status}</span><span><strong>{shortDate(row.created_at)}</strong><small>{row.id}</small></span><span><strong>{row.model}</strong><small>{row.provider}</small></span><span>{row.tokens.toLocaleString("en-IN")}</span><span>{formatPaise(row.cost_paise)}</span><span>{row.latency_ms} ms</span></button>) : <div className="activity-empty">No requests match these filters.</div>}</div></section> : null}

    {tab === "explore" ? <section className="activity-card activity-explore"><div className="activity-card-heading"><div><h3>Explore activity</h3><p>Assemble a focused view from the selected request metadata.</p></div><button className="console-secondary" onClick={saveView}>Save view</button></div><div className="activity-explore-controls"><label>Metric<select value={metric} onChange={(event) => setMetric(event.target.value)}><option value="spend">Spend</option><option value="requests">Request count</option><option value="tokens">Tokens</option></select></label><label>Group by<select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="model">Model</option><option value="provider">Provider</option><option value="status">Status</option></select></label><div><span>Chart</span><button className="active">Bars</button><button disabled>Line</button><button disabled>Table</button></div></div><div className="activity-explore-result"><div className="activity-card-heading"><div><h3>{metric[0].toUpperCase() + metric.slice(1)} by {groupBy}</h3><p>{filtered.length} requests in the selected range</p></div></div>{grouped.map(([name, value]) => { const amount = metric === "requests" ? value.requests : metric === "tokens" ? value.tokens : value.spend; return <div className="activity-explore-row" key={name}><span>{name}</span><div className="activity-rank-track"><span style={{ width: `${Math.max((amount / maxGrouped) * 100, 4)}%` }} /></div><strong>{metric === "spend" ? formatPaise(amount) : amount.toLocaleString("en-IN")}</strong></div>})}</div>{saved.length ? <div className="activity-saved"><strong>Saved views</strong>{saved.map((view) => <span key={view}>{view}</span>)}</div> : null}</section> : null}

    {selected ? <aside className="activity-detail" aria-label="Request details"><div className="activity-detail-heading"><div><span>Request detail</span><h3>{selected.model}</h3></div><button className="console-icon" aria-label="Close request detail" onClick={() => setSelectedId(null)}><X size={18} /></button></div><div className="activity-detail-status"><i className={selected.status === "success" ? "success" : "error"} />{selected.status}{selected.error_code ? ` · ${selected.error_code}` : ""}</div><dl><div><dt>Provider</dt><dd>{selected.provider}</dd></div><div><dt>Request ID</dt><dd>{selected.id}</dd></div><div><dt>Tokens</dt><dd>{selected.tokens.toLocaleString("en-IN")}</dd></div><div><dt>Cost</dt><dd>{formatPaise(selected.cost_paise)}</dd></div><div><dt>Latency</dt><dd>{selected.latency_ms} ms</dd></div><div><dt>Created</dt><dd>{formatDate(selected.created_at)}</dd></div></dl><div className="activity-detail-note"><strong>Prompt and response content</strong><span>Not logged by Compass. This activity view contains request metadata only.</span></div></aside> : null}
  </section>;
}
