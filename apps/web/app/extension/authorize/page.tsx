"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Compass, Laptop, ShieldCheck } from "lucide-react";
import { apiFetch } from "../../../lib/api";

type Session = { token: string; email: string };
type Project = { id: string; name: string; slug: string; is_default: boolean };
type Team = { id: string; project_id?: string | null; name: string; slug: string; is_active: boolean };

export default function ExtensionAuthorizePage() {
  const [userCode] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("user_code") || "");
  const [session] = useState<Session | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem("compass.local.session");
    if (!saved) return null;
    try { return JSON.parse(saved) as Session; }
    catch { window.localStorage.removeItem("compass.local.session"); return null; }
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projectId, setProjectId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    void Promise.all([apiFetch<Project[]>("/projects", {}, session.token), apiFetch<Team[]>("/teams", {}, session.token)])
        .then(([projectRows, teamRows]) => {
          setProjects(projectRows);
          setTeams(teamRows);
          const first = projectRows.find((project) => project.is_default) || projectRows[0];
          setProjectId(first?.id || "");
          setTeamId(teamRows.find((team) => team.project_id === first?.id && team.is_active)?.id || "");
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load your Compass projects."));
  }, [session]);

  const projectTeams = useMemo(() => teams.filter((team) => team.project_id === projectId && team.is_active), [projectId, teams]);

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    setTeamId(teams.find((team) => team.project_id === nextProjectId && team.is_active)?.id || "");
  }

  async function approve() {
    if (!session || !userCode || !projectId || !teamId) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/auth/extension/device/approve", { method: "POST", body: JSON.stringify({ user_code: userCode, project_id: projectId, team_id: teamId }) }, session.token);
      setApproved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not authorize VS Code.");
    } finally {
      setBusy(false);
    }
  }

  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/extension/authorize?user_code=${userCode}`)}`;
  return <main className="console-login"><section className="console-login-panel" aria-labelledby="extension-auth-title">
    <div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div>
    {approved ? <><div className="console-login-copy"><span>DEVICE AUTHORIZED</span><h1 id="extension-auth-title">VS Code is connected</h1><p>You can return to VS Code. It will finish signing in automatically and use the selected project for usage attribution.</p></div><div className="account-empty"><CheckCircle2 /><strong>Authorization approved</strong><span>Project: {projects.find((project) => project.id === projectId)?.name || "Compass project"}</span></div></> : !session ? <><div className="console-login-copy"><span>COMPASS ROUTER EXTENSION</span><h1 id="extension-auth-title">Sign in to authorize VS Code</h1><p>Use your Compass account to approve this device. The code is <strong>{userCode || "missing"}</strong>.</p></div><a className="console-primary" href={loginHref}><Laptop size={17} /> Sign in to continue</a></> : <><div className="console-login-copy"><span>COMPASS ROUTER EXTENSION</span><h1 id="extension-auth-title">Authorize this VS Code device</h1><p>Signed in as {session.email}. Choose the project and team that should receive this device&apos;s requests.</p></div><label>Project<select value={projectId} onChange={(event) => changeProject(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.is_default ? " · Others" : ""}</option>)}</select></label><label>Team<select required value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Select a team</option>{projectTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><p className="console-login-fixture"><ShieldCheck size={15} /> The device session is scoped to this project and can be revoked from member or device management.</p>{error ? <p className="console-login-error" role="alert">{error}</p> : null}<button className="console-primary" type="button" disabled={busy || !userCode || !projectId || !teamId} onClick={() => void approve()}>{busy ? "Authorizing..." : "Authorize VS Code"}</button></>}
  </section></main>;
}
