"use client";

import { ChevronRight, CreditCard, KeyRound, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, formatPaise } from "../lib/api";

type Team = { id: string; name: string; slug: string; is_active: boolean; wallet: { balance_paise: number } };
type Member = { id: string; name: string; email: string; role: string; is_active: boolean };
type Dashboard = { teams: Team[]; api_keys: { team_id?: string | null; status: string }[] };

export function TeamsManager({ dashboard, workspaceId, teamId, selectTeam, refresh, token, canManage, canCreate }: {
  dashboard: Dashboard | null; workspaceId: string; teamId: string; selectTeam: (id: string) => void; refresh: () => Promise<void>; token: string; canManage: boolean; canCreate: boolean;
}) {
  const teamDialog = useRef<HTMLDialogElement>(null);
  const memberDialog = useRef<HTMLDialogElement>(null);
  const [members, setMembers] = useState<{ teamId: string; rows: Member[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [memberName, setMemberName] = useState("");
  const [email, setEmail] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [teamNotes, setTeamNotes] = useState("");
  const team = dashboard?.teams.find((item) => item.id === teamId);
  const activeKeys = dashboard?.api_keys.filter((key) => key.status === "active").length ?? 0;
  const teamKeys = dashboard?.api_keys.filter((key) => key.team_id === teamId && key.status === "active").length ?? 0;
  useEffect(() => {
    if (!teamId) return;
    const controller = new AbortController();
    apiFetch<Member[]>(`/teams/${teamId}/members`, { signal: controller.signal }, token)
      .then((rows) => { if (!controller.signal.aborted) { setMembers({ teamId, rows }); setMemberError(""); } })
      .catch((reason) => { if (!controller.signal.aborted) setMemberError(reason instanceof Error ? reason.message : "Could not load members."); });
    return () => controller.abort();
  }, [teamId, token]);
  const rows = members?.teamId === teamId ? members.rows : null;
  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId) { setError("Select or create a workspace first."); return; }
    setBusy(true); setError("");
    try {
      const created = await apiFetch<{ id: string }>("/teams", { method: "POST", body: JSON.stringify({ name: teamName.trim(), slug: teamSlug.trim(), notes: teamNotes.trim(), workspace_id: workspaceId }) }, token);
      selectTeam(created.id); await refresh(); teamDialog.current?.close(); setTeamName(""); setTeamSlug(""); setTeamNotes("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create team."); }
    finally { setBusy(false); }
  }
  async function addMember(event: React.FormEvent) {
    event.preventDefault(); if (!teamId) return; setBusy(true); setError("");
    try {
      await apiFetch(`/admin/teams/${teamId}/members`, { method: "POST", body: JSON.stringify({ name: memberName.trim(), email: email.trim(), role: "tester" }) }, token);
      const updated = await apiFetch<Member[]>(`/teams/${teamId}/members`, {}, token);
      setMembers({ teamId, rows: updated }); memberDialog.current?.close(); setMemberName(""); setEmail("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add member."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="key-actions"><span className="key-scope"><Users size={16} />Teams inside the selected workspace</span>{canCreate ? <button className="console-primary" onClick={() => { setError(""); teamDialog.current?.showModal(); }}><Plus size={18} />New Team</button> : null}</div>
    <div className="teams-summary"><div><span><CreditCard size={16} />Total team Credits</span><strong>{dashboard ? formatPaise(dashboard.teams.reduce((sum, item) => sum + item.wallet.balance_paise, 0)) : "-"}</strong></div><div><span><Users size={16} />Teams</span><strong>{dashboard?.teams.length ?? "-"}</strong></div><div><span><KeyRound size={16} />Active API keys</span><strong>{dashboard ? activeKeys : "-"}</strong></div></div>
    <div className="teams-layout"><section className="teams-list"><h2>Your teams ({dashboard?.teams.length ?? 0})</h2>{dashboard ? dashboard.teams.length ? dashboard.teams.map((item) => <button key={item.id} className={`team-list-item ${item.id === teamId ? "selected" : ""}`} onClick={() => selectTeam(item.id)}><span><strong>{item.name}</strong><small>{item.slug}</small><span>{formatPaise(item.wallet.balance_paise)} <span className="team-state">· {item.is_active ? "Active" : "Disabled"}</span></span></span><ChevronRight size={18} /></button>) : <p className="teams-empty">No teams yet.</p> : <p className="teams-empty">Loading teams...</p>}</section>
      <section className="team-detail">{team ? <><div className="team-detail-heading"><div><h2>{team.name}</h2><span>{team.slug}</span></div>{canManage ? <button className="console-secondary" disabled={!team.is_active || busy} onClick={() => { setError(""); memberDialog.current?.showModal(); }}><Plus size={16} />Add member</button> : null}</div><dl className="team-facts"><div><dt>Credits balance</dt><dd>{formatPaise(team.wallet.balance_paise)}</dd></div><div><dt>Active keys</dt><dd>{teamKeys}</dd></div><div><dt>Member budget</dt><dd className="key-unavailable">Not available</dd></div></dl><div className="team-detail-links"><Link className="console-secondary" href="/api-keys"><KeyRound size={16} />Manage keys</Link><Link className="console-secondary" href="/wallet"><CreditCard size={16} />View Credits</Link></div><h3>Members {rows ? `(${rows.length})` : ""}</h3>{memberError ? <p className="dialog-error" role="alert">{memberError}</p> : null}<div className="team-members-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{rows ? rows.length ? rows.map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.email}</td><td>{member.role}</td><td><span className={`key-status ${member.is_active ? "active" : "revoked"}`}>{member.is_active ? "Active" : "Disabled"}</span></td></tr>) : <tr><td colSpan={4} className="teams-empty">No members yet.</td></tr> : <tr><td colSpan={4} className="teams-empty">{memberError ? "Members unavailable." : "Loading members..."}</td></tr>}</tbody></table></div></> : <div className="teams-empty"><Users size={28} /><p>Select a team to manage members.</p></div>}</section>
    </div>
    <dialog ref={teamDialog} className="console-dialog" aria-labelledby="new-team-title"><form onSubmit={(event) => void createTeam(event)}><div className="dialog-heading"><h2 id="new-team-title">Create team</h2><button className="console-icon" type="button" aria-label="Close team dialog" onClick={() => teamDialog.current?.close()}><X size={20} /></button></div><p className="field-help">Teams belong to the selected workspace and hold members, API keys, usage, and Credits.</p><label>Team name<input required minLength={2} maxLength={120} value={teamName} onChange={(event) => { const value = event.target.value; setTeamName(value); if (!teamSlug) setTeamSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 61)); }} placeholder="Engineering Team" /></label><label>Team slug<input required pattern="[a-z0-9][a-z0-9-]{1,60}" maxLength={61} value={teamSlug} onChange={(event) => setTeamSlug(event.target.value)} placeholder="engineering" /></label><label>Notes <span className="field-optional">Optional</span><textarea maxLength={1000} value={teamNotes} onChange={(event) => setTeamNotes(event.target.value)} placeholder="What is this team for?" /></label>{error ? <p className="dialog-error" role="alert">{error}</p> : null}<div className="dialog-footer"><button className="console-secondary" disabled={busy} type="button" onClick={() => teamDialog.current?.close()}>Cancel</button><button className="console-primary" disabled={busy}><Plus size={17} />{busy ? "Creating..." : "Create team"}</button></div></form></dialog>
    <dialog ref={memberDialog} className="console-dialog" aria-labelledby="new-member-title"><form onSubmit={(event) => void addMember(event)}><div className="dialog-heading"><h2 id="new-member-title">Add team member</h2><button className="console-icon" type="button" aria-label="Close member dialog" onClick={() => memberDialog.current?.close()}><X size={20} /></button></div><label>Name<input required maxLength={120} value={memberName} onChange={(event) => setMemberName(event.target.value)} /></label><label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{error ? <p className="dialog-error" role="alert">{error}</p> : null}<div className="dialog-footer"><button className="console-secondary" disabled={busy} type="button" onClick={() => memberDialog.current?.close()}>Cancel</button><button className="console-primary" disabled={busy}><Plus size={17} />{busy ? "Adding..." : "Add member"}</button></div></form></dialog>
  </>;
}
