"use client";

import { ChevronDown, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type Credential = {
  id: string;
  provider: string;
  status: string;
  configured: boolean;
  last_four: string;
  updated_at: string;
};

const commonProviders = ["openai", "anthropic", "gemini", "openrouter", "groq", "mistral", "deepseek", "xai", "perplexity", "together_ai", "fireworks_ai"];
const providerLabel = (name: string) => name.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

export function ByokManager({ token, teamId, onChanged }: { token: string; teamId: string; onChanged: () => Promise<void> }) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [provider, setProvider] = useState("openai");
  const [providerOpen, setProviderOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!teamId) return setCredentials([]);
    setCredentials(await apiFetch<Credential[]>(`/byok/credentials?team_id=${encodeURIComponent(teamId)}`, {}, token));
  }, [teamId, token]);

  useEffect(() => { void Promise.resolve().then(load).catch((error) => setStatus(error instanceof Error ? error.message : "Could not load BYOK credentials.")); }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!teamId || !apiKey.trim()) return;
    setBusy(true);
    setStatus("");
    try {
      await apiFetch("/byok/credentials", { method: "POST", body: JSON.stringify({ team_id: teamId, provider, api_key: apiKey.trim() }) }, token);
      setApiKey("");
      setStatus("Provider key saved for this team. The full key will not be shown again.");
      await load();
      await onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save provider key.");
    } finally { setBusy(false); }
  }

  async function revoke(providerName: string) {
    setBusy(true);
    try {
      await apiFetch(`/byok/credentials/${encodeURIComponent(providerName)}?team_id=${encodeURIComponent(teamId)}`, { method: "DELETE" }, token);
      setStatus(`${providerName} credential removed from this team.`);
      await load();
      await onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove provider key.");
    } finally { setBusy(false); }
  }

  return <div className="byok-layout">
    <section className="byok-intro">
      <ShieldCheck size={24} />
      <div><h2>Team-scoped provider credentials</h2><p>Keys are encrypted at rest and used only by the Compass API when this team sends a request. Raw provider keys are never returned to the browser.</p></div>
    </section>
    {status ? <p className="model-error" role="status">{status}</p> : null}
    <div className="byok-grid">
      <form className="byok-form" onSubmit={(event) => void save(event)}>
        <h2>Add provider key</h2>
        <label>Provider<div className="provider-picker"><button type="button" className="provider-picker-trigger" aria-haspopup="listbox" aria-expanded={providerOpen} onClick={() => setProviderOpen((open) => !open)}><span>{providerLabel(provider)}</span><ChevronDown size={16} aria-hidden="true" /></button>{providerOpen ? <div className="provider-picker-menu" role="listbox" aria-label="Select provider">{commonProviders.map((name) => <button type="button" className="provider-picker-option" role="option" aria-selected={provider === name} key={name} onClick={() => { setProvider(name); setProviderOpen(false); }}>{providerLabel(name)}</button>)}</div> : null}</div></label>
        <label>API key<input type="password" autoComplete="off" minLength={8} required value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Stored encrypted and shown only as last four" /></label>
        <button className="console-primary" disabled={busy || !teamId}><KeyRound size={17} />{busy ? "Saving..." : "Save key"}</button>
        <small>Initial BYOK activation supports providers that accept a single API key. Azure, Bedrock, Vertex AI, and similar providers need a later multi-field credential flow.</small>
      </form>
      <section className="byok-list"><h2>Connected providers</h2>{credentials.length ? credentials.map((credential) => <article key={credential.id}><div><strong>{credential.provider.replaceAll("_", " ")}</strong><span>{credential.configured ? `Configured · ****${credential.last_four}` : credential.status}</span><small>Updated {new Date(credential.updated_at.endsWith("Z") ? credential.updated_at : `${credential.updated_at}Z`).toLocaleString("en-IN")}</small></div><button className="console-icon" title={`Remove ${credential.provider} key`} aria-label={`Remove ${credential.provider} key`} disabled={busy || !credential.configured} onClick={() => void revoke(credential.provider)}><Trash2 size={17} /></button></article>) : <div className="model-empty"><KeyRound size={22} /><strong>No BYOK credentials</strong><span>Add a provider key to enable compatible chat models.</span></div>}</section>
    </div>
  </div>;
}
