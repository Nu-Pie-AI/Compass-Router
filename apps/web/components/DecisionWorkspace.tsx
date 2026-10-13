"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type AssignedKey = { id: string; name: string; key_alias: string; project_id?: string | null; project_ids?: string[]; allowed_models?: string[] };
type Project = { id: string; name: string };

export function DecisionWorkspace({ token }: { token: string }) {
  const [keys, setKeys] = useState<AssignedKey[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [keyId, setKeyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [state, setState] = useState('{"text":"Evaluate this item"}');
  const [question, setQuestion] = useState("Is this relevant?");
  const [answer, setAnswer] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      apiFetch<AssignedKey[]>("/api-keys/assigned", {}, token),
      apiFetch<Project[]>("/projects", {}, token),
    ]).then(([assigned, availableProjects]) => {
      setKeys(assigned);
      setProjects(availableProjects);
      setKeyId(assigned[0]?.id ?? "");
      setProjectId(assigned[0]?.project_id ?? availableProjects[0]?.id ?? "");
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load decision access."));
  }, [token]);

  async function runDecision() {
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      const parsedState = JSON.parse(state) as unknown;
      const result = await apiFetch<Record<string, unknown>>("/member/v1/decisions", {
        method: "POST",
        headers: { "X-Compass-Key-Id": keyId, "X-Compass-Project-Id": projectId },
        body: JSON.stringify({ model: "typesafe_ai/jev-latest", project_id: projectId, state: parsedState, questions: { relevance: { type: "choice", instructions: question, criteria: { yes: "Relevant", no: "Not relevant" } } } }),
      }, token);
      setAnswer(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The decision request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-card border border-compass-line bg-compass-panel p-5">
    <div className="mb-5"><span className="analytics-eyebrow">STRUCTURED DECISION</span><h2 className="mt-1 text-xl font-semibold">Jev decision workspace</h2><p className="mt-2 text-sm text-slate-500">Run typed Choice, Score, and Noul questions through the official TypeSafe System One route.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm">Assigned Compass key<select className="console-input mt-2 w-full" value={keyId} onChange={(event) => setKeyId(event.target.value)}><option value="">Select an assigned key</option>{keys.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.key_alias})</option>)}</select></label>
      <label className="text-sm">Project<select className="console-input mt-2 w-full" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Select a project</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div>
    <label className="mt-4 block text-sm">State JSON<textarea className="console-input mt-2 min-h-28 w-full font-mono text-xs" value={state} onChange={(event) => setState(event.target.value)} /></label>
    <label className="mt-4 block text-sm">Choice question<textarea className="console-input mt-2 min-h-20 w-full" value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
    <div className="mt-4 flex items-center gap-3"><button className="console-primary" disabled={busy || !keyId || !projectId} onClick={() => void runDecision()}>{busy ? "Running..." : "Run decision"}</button><span className="text-sm text-slate-500">Jev remains unavailable until TypeSafe access and approved pricing are configured.</span></div>
    {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    {answer ? <pre className="mt-5 overflow-auto rounded border border-compass-line bg-slate-50 p-4 text-xs">{JSON.stringify(answer, null, 2)}</pre> : null}
  </section>;
}
