"use client";

import { ArrowUpDown, Boxes, CheckCircle2, CircleAlert, KeyRound, Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type PublishedModel = {
  id: string;
  display_name: string;
  provider: string;
  provider_model_id?: string;
  capabilities?: string[];
  context_window?: number;
  input_price_paise_per_1k: number;
  output_price_paise_per_1k: number;
  status: string;
};

type ProviderModel = {
  provider: string;
  provider_model_id: string;
  display_name: string;
  capabilities: string[];
  mode: string;
  context_window?: number | null;
  compass_model_id?: string | null;
  input_cost_per_million_usd: number;
  output_cost_per_million_usd: number;
  byok_supported: boolean;
  credential_available?: boolean;
  metadata?: { owned_by?: string | null; family?: string | null; parameter_size?: string | null };
};

type DiscoverySource = {
  provider: string;
  status: "available" | "error" | "unconfigured" | "unavailable";
  count: number;
  error?: string | null;
};

type DiscoveryResponse = {
  models: ProviderModel[];
  sources: DiscoverySource[];
  total: number;
  refreshed_at: string;
  catalog_source: string;
  scope_note: string;
};

const providerNames: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  ollama_cloud: "Ollama Cloud",
};
const categories = [
  ["all", "All"],
  ["text", "Text"],
  ["image", "Image"],
  ["audio", "Audio"],
  ["embeddings", "Embeddings"],
] as const;
const pageSize = 30;

function providerLabel(value: string) {
  return providerNames[value] ?? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function modelCategories(model: ProviderModel) {
  const capabilities = model.capabilities.map((capability) => capability.toLowerCase());
  const result = new Set<string>();
  if (capabilities.some((capability) => capability.includes("embed"))) result.add("embeddings");
  if (capabilities.some((capability) => capability.includes("image") || capability.includes("vision"))) result.add("image");
  if (capabilities.some((capability) => ["audio", "speech", "transcri", "tts", "whisper"].some((term) => capability.includes(term)))) result.add("audio");
  if (capabilities.some((capability) => capability.includes("chat") || capability.includes("generatecontent"))) result.add("text");
  if (!result.size) result.add("text");
  return result;
}

function formatContext(value?: number | null) {
  if (!value) return "Not provided";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M tokens`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K tokens`;
  return `${value} tokens`;
}

export function ModelDirectory({ published, token = "", teamId, onActivated }: { published: PublishedModel[]; token?: string; teamId: string; onActivated: () => Promise<void> }) {
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [category, setCategory] = useState("all");
  const [visible, setVisible] = useState(pageSize);
  const [sort, setSort] = useState("provider");
  const [activating, setActivating] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = teamId ? `?team_id=${encodeURIComponent(teamId)}` : "";
      setDiscovery(await apiFetch<DiscoveryResponse>(`/catalog/models${query}`, {}, token));
      setVisible(pageSize);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not discover provider models.");
    } finally {
      setLoading(false);
    }
  }, [teamId, token]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: discovery?.models.length ?? 0 };
    for (const model of discovery?.models ?? []) {
      for (const kind of modelCategories(model)) counts[kind] = (counts[kind] ?? 0) + 1;
    }
    return counts;
  }, [discovery]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = (discovery?.models ?? []).filter((model) =>
      (provider === "all" || model.provider === provider) &&
      (category === "all" || modelCategories(model).has(category)) &&
      (!term || `${model.provider_model_id} ${model.display_name} ${model.provider} ${model.capabilities.join(" ")}`.toLowerCase().includes(term)),
    );
    return rows.sort((a, b) => {
      if (sort === "context") return (b.context_window ?? 0) - (a.context_window ?? 0);
      if (sort === "input-price") return a.input_cost_per_million_usd - b.input_cost_per_million_usd;
      if (sort === "output-price") return a.output_cost_per_million_usd - b.output_cost_per_million_usd;
      return `${a.provider}/${a.display_name}`.localeCompare(`${b.provider}/${b.display_name}`);
    });
  }, [category, discovery, provider, query, sort]);

  const publishedById = useMemo(() => new Map(published.map((model) => [model.id, model])), [published]);
  const providers = useMemo(() => discovery?.sources ?? [], [discovery]);

  async function activate(modelId: string) {
    if (!teamId) return;
    setActivating(modelId);
    setError("");
    try {
      await apiFetch("/models/activate", { method: "POST", body: JSON.stringify({ team_id: teamId, model_id: modelId }) }, token);
      await onActivated();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not enable model.");
    } finally { setActivating(""); }
  }

  return <div className="model-directory">
    <section className="model-published" aria-labelledby="published-models-title">
      <div className="model-section-heading">
        <div><h2 id="published-models-title">Enabled for Compass</h2><p>Provider-native model IDs that can be attached to Compass API keys.</p></div>
        <span className="model-count">{published.length}</span>
      </div>
      <div className="published-model-grid">
        {published.length ? published.map((model) => <article key={model.id} className="published-model-row">
          <div><span className="provider-mark">{providerNames[model.provider] ?? model.provider}</span><h3>{model.display_name}</h3><code>{model.id}</code></div>
          <div className="model-route"><span>LiteLLM route</span><code>{model.provider_model_id ?? "-"}</code></div>
          <div className="model-price"><span>Input / 1K</span><strong>{model.input_price_paise_per_1k} paise</strong></div>
          <div className="model-price"><span>Output / 1K</span><strong>{model.output_price_paise_per_1k} paise</strong></div>
          <span className="key-status active">{model.status}</span>
        </article>) : <div className="model-empty"><Boxes size={24} /><strong>No available models</strong><span>Catalog entries require a tested route and pricing before API keys can use them.</span></div>}
      </div>
    </section>

    <section className="provider-inventory" aria-labelledby="provider-inventory-title">
      <div className="catalog-heading">
        <div><span className="catalog-eyebrow">LITELLM MODEL REGISTRY</span><h2 id="provider-inventory-title">Explore models</h2><p>Compare provider-native IDs, modalities, context, and published provider pricing. Enable compatible chat models with BYOK.</p></div>
        <button className="console-secondary" disabled={loading} onClick={() => void refresh()}><RefreshCw size={16} className={loading ? "animate-spin" : ""} />{loading ? "Refreshing..." : "Refresh"}</button>
      </div>

      <div className="model-source-strip">{providers.slice(0, 6).map((source) => {
        const name = source.provider;
        return <div key={name} className={`model-source ${source?.status ?? "loading"}`}>
          {source?.status === "available" ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
          <span><strong>{providerLabel(name)}</strong><small>{source.status === "available" ? `${source.count} models` : source.error || "Unavailable"}</small></span>
        </div>;
      })}</div>

      {error ? <div className="model-error" role="alert"><CircleAlert size={17} />{error}</div> : null}

      <div className="catalog-controls">
        <label className="key-search"><Search size={18} /><input aria-label="Search provider models" placeholder="Search models and providers..." value={query} onChange={(event) => { setQuery(event.target.value); setVisible(pageSize); }} /></label>
        <div className="catalog-categories" aria-label="Filter by model type">{categories.map(([value, label]) => <button key={value} aria-pressed={category === value} onClick={() => { setCategory(value); setVisible(pageSize); }}>{label}<span>{categoryCounts[value] ?? 0}</span></button>)}</div>
        <label className="catalog-sort"><ArrowUpDown size={16} /><span className="sr-only">Sort models</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="provider">Provider</option><option value="context">Largest context</option><option value="input-price">Lowest input price</option><option value="output-price">Lowest output price</option></select></label>
      </div>

      <div className="catalog-layout">
        <aside className="catalog-filters" aria-label="Catalog filters">
          <h3>Provider</h3>
          <button aria-pressed={provider === "all"} onClick={() => { setProvider("all"); setVisible(pageSize); }}><span>All providers</span><small>{discovery?.total ?? 0}</small></button>
          {providers.map((source) => <button key={source.provider} aria-pressed={provider === source.provider} onClick={() => { setProvider(source.provider); setVisible(pageSize); }}><span>{providerLabel(source.provider)}</span><small>{source.count}</small></button>)}
          <div className="catalog-legend"><strong>Availability</strong><span><i className="available" />Enabled for Compass</span><span><i />Catalog only</span></div>
        </aside>

        <div className="catalog-results">
          <div className="catalog-result-count"><strong>{filtered.length} models</strong><span>{discovery?.scope_note ?? "Controlled LiteLLM registry"}</span></div>
          <div className="model-catalog-list">
            {loading && !discovery ? <div className="model-table-empty">Loading provider catalogs...</div> : filtered.length ? filtered.slice(0, visible).map((model) => {
              const publication = model.compass_model_id ? publishedById.get(model.compass_model_id) : undefined;
              return <article className="model-catalog-row" key={`${model.provider}:${model.provider_model_id}`}>
                <div className="model-provider-avatar" aria-hidden="true">{providerLabel(model.provider).slice(0, 1)}</div>
                <div className="model-catalog-main">
                  <div className="model-catalog-title"><h3>{model.display_name}</h3><span>{providerLabel(model.provider)}</span></div>
                  <code>{model.provider_model_id}</code>
                  <div className="capability-list">{model.capabilities.length ? model.capabilities.slice(0, 5).map((capability) => <span key={capability}>{capability}</span>) : <span>Text</span>}</div>
                </div>
                <dl className="model-catalog-facts">
                  <div><dt>Context</dt><dd>{formatContext(model.context_window)}</dd></div>
                  <div><dt>Input / 1M</dt><dd>${model.input_cost_per_million_usd.toFixed(model.input_cost_per_million_usd < 1 ? 3 : 2)}</dd></div>
                  <div><dt>Output / 1M</dt><dd>${model.output_cost_per_million_usd.toFixed(model.output_cost_per_million_usd < 1 ? 3 : 2)}</dd></div>
                </dl>
                <div className="model-catalog-state">{publication ? <><span className="key-status active">Enabled</span><code>{publication.id}</code></> : model.mode !== "chat" ? <><span className="key-unavailable">Catalog only</span><small>{model.mode.replaceAll("_", " ")} endpoint not implemented</small></> : !model.byok_supported ? <><span className="key-unavailable">Advanced setup</span><small>Multi-field credentials required</small></> : !model.credential_available ? <><Link className="console-secondary" href="/byok"><KeyRound size={15} />Add BYOK key</Link><small>{providerLabel(model.provider)} credential required</small></> : <button className="console-primary" disabled={activating === model.provider_model_id} onClick={() => void activate(model.provider_model_id)}><Plus size={15} />{activating === model.provider_model_id ? "Enabling..." : "Enable"}</button>}</div>
              </article>;
            }) : <div className="model-table-empty">{query || provider !== "all" || category !== "all" ? "No models match these filters." : "No provider models were discovered."}</div>}
          </div>
          <footer className="model-footer"><span>Showing {Math.min(visible, filtered.length)} of {filtered.length}</span>{visible < filtered.length ? <button className="console-secondary" onClick={() => setVisible((count) => count + pageSize)}>Show more</button> : null}<span>{discovery ? `Source: ${discovery.catalog_source} · Updated ${new Date(discovery.refreshed_at.endsWith("Z") ? discovery.refreshed_at : `${discovery.refreshed_at}Z`).toLocaleString("en-IN")}` : ""}</span></footer>
        </div>
      </div>
    </section>
  </div>;
}
