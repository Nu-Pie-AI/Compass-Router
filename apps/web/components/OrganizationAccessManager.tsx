"use client";

import { MailPlus, Pencil, Plus, Shield, Trash2, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type Project = { id: string; name: string; slug: string; description: string; is_default: boolean; is_active: boolean };
type Team = { id: string; project_id?: string | null; name: string; is_active: boolean };
type Member = { user_id: string; email: string; role: string; status: string; email_verified: boolean };
type ProjectMember = { user_id: string; email: string; role: "owner" | "admin" | "member"; status: string };
type Invitation = { id: string; email: string; project_id: string; role: string; status: string; expires_at: string };

export function OrganizationAccessManager({ token }: { token: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async (projectId = selectedProjectId) => {
    try {
      const [projectRows, teamRows, memberRows, invitationRows, projectMemberRows] = await Promise.all([
        apiFetch<Project[]>("/projects", {}, token),
        apiFetch<Team[]>("/teams", {}, token),
        apiFetch<Member[]>("/organization/members", {}, token),
        apiFetch<Invitation[]>("/organization/invitations", {}, token),
        projectId ? apiFetch<ProjectMember[]>(`/projects/${projectId}/members`, {}, token) : Promise.resolve([] as ProjectMember[]),
      ]);
      setProjects(projectRows);
      setTeams(teamRows);
      setMembers(memberRows);
      setInvitations(invitationRows);
      setProjectMembers(projectMemberRows);
      const nextId = projectRows.some((project) => project.id === projectId) ? projectId : projectRows[0]?.id || "";
      setSelectedProjectId(nextId);
      const selected = projectRows.find((project) => project.id === nextId);
      setProjectName(selected?.name || "");
      setProjectDescription(selected?.description || "");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Could not load organization access.");
    }
  }, [selectedProjectId, token]);

  useEffect(() => {
    if (creatingProject) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [creatingProject, load]);

  const projectTeams = useMemo(() => teams.filter((team) => team.project_id === selectedProjectId && team.is_active), [selectedProjectId, teams]);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  async function createProject() {
    if (!projectName.trim()) return;
    setBusy(true); setStatus("");
    try {
      const created = await apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify({ name: projectName.trim(), description: projectDescription.trim() }) }, token);
      setStatus("Project created.");
      setCreatingProject(false);
      setSelectedProjectId(created.id);
      await load(created.id);
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not create project."); }
    finally { setBusy(false); }
  }

  async function saveProject() {
    if (!selectedProjectId || !projectName.trim()) return;
    setBusy(true); setStatus("");
    try {
      await apiFetch(`/projects/${selectedProjectId}`, { method: "PATCH", body: JSON.stringify({ name: projectName.trim(), description: projectDescription.trim() }) }, token);
      setStatus("Project details updated.");
      await load(selectedProjectId);
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not update project."); }
    finally { setBusy(false); }
  }

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId || !inviteEmail.trim()) return;
    setBusy(true); setStatus("");
    try {
      const invitation = await apiFetch<{ email: string }>("/organization/invitations", { method: "POST", body: JSON.stringify({ project_id: selectedProjectId, email: inviteEmail.trim(), role: inviteRole, team_id: inviteTeamId || null }) }, token);
      setInviteEmail("");
      setStatus(`Invitation queued for ${invitation.email}.`);
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not invite member."); }
    finally { setBusy(false); }
  }

  async function removeMember(userId: string) {
    setBusy(true); setStatus("");
    try { await apiFetch(`/organization/members/${userId}`, { method: "DELETE" }, token); setStatus("Member access revoked."); await load(); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not revoke member."); }
    finally { setBusy(false); }
  }

  async function changeRole(userId: string, role: "admin" | "customer") {
    setBusy(true); setStatus("");
    try {
      await apiFetch(`/organization/members/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) }, token);
      setStatus("Member role updated.");
      await load();
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not update member role."); }
    finally { setBusy(false); }
  }

  async function changeProjectAccess(userId: string, value: "none" | "member" | "admin") {
    if (!selectedProjectId) return;
    setBusy(true); setStatus("");
    try {
      if (value === "none") {
        await apiFetch(`/projects/${selectedProjectId}/members/${userId}`, { method: "DELETE" }, token);
      } else {
        await apiFetch(`/projects/${selectedProjectId}/members/${userId}`, { method: "PUT", body: JSON.stringify({ role: value }) }, token);
      }
      setStatus("Project access updated.");
      await load();
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not update project access."); }
    finally { setBusy(false); }
  }

  async function updateInvitation(invitationId: string, action: "resend" | "cancel") {
    setBusy(true); setStatus("");
    try {
      await apiFetch(`/organization/invitations/${invitationId}/${action}`, { method: "POST" }, token);
      setStatus(action === "resend" ? "Invitation resent." : "Invitation cancelled.");
      await load();
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not update invitation."); }
    finally { setBusy(false); }
  }

  function projectRole(userId: string): "none" | "member" | "admin" {
    const role = projectMembers.find((member) => member.user_id === userId)?.role;
    return role === "owner" ? "admin" : role ?? "none";
  }

  return <section className="workspace-page mt-5"><div className="workspace-page-heading"><div><span className="analytics-eyebrow">Customer access</span><h2>Projects, teams, and members</h2><p>Create client projects, rename the default Others project, and invite verified users with scoped access.</p></div><UsersRound size={24} /></div>
    {status ? <p className="status-banner" role="status">{status}</p> : null}
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]"><div className="rounded-card border border-compass-line bg-compass-panel p-3"><div className="mb-2 flex items-center justify-between"><strong>Projects</strong><button className="console-icon" title="New project" aria-label="New project" onClick={() => { setCreatingProject(true); setSelectedProjectId(""); setProjectName(""); setProjectDescription(""); }}><Plus size={17} /></button></div>{projects.map((project) => <button key={project.id} className={`w-full rounded-card border px-3 py-2 text-left text-sm ${project.id === selectedProjectId ? "border-compass-accent bg-compass-accent/10" : "border-compass-line"}`} onClick={() => { setCreatingProject(false); setSelectedProjectId(project.id); setProjectName(project.name); setProjectDescription(project.description); }}>{project.name}<small className="block text-slate-500">{project.is_default ? "Default fallback" : project.slug}</small></button>)}</div>
      <div className="grid gap-4"><div className="rounded-card border border-compass-line bg-compass-panel p-4"><div className="mb-3 flex items-center justify-between"><div><h3>{selectedProject ? "Project settings" : "Create project"}</h3><p className="text-sm text-slate-400">{selectedProject?.is_default ? "Rename Others to match your client or product." : "Project access scopes extension devices, teams, and usage."}</p></div><Pencil size={18} /></div><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm">Name<input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Client portal" /></label><label className="grid gap-1 text-sm">Description<input value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="What this project is for" /></label></div><button className="console-primary mt-3" disabled={busy || !projectName.trim()} onClick={() => void (selectedProject ? saveProject() : createProject())}>{selectedProject ? "Save project" : "Create project"}</button></div>
        <div className="rounded-card border border-compass-line bg-compass-panel p-4"><div className="mb-3 flex items-center gap-2"><MailPlus size={18} /><h3>Invite member</h3></div><form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => void inviteMember(event)}><input required type="email" placeholder="member@client.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "member" | "admin")}><option value="member">Member</option><option value="admin">Project admin</option></select><select value={inviteTeamId} onChange={(event) => setInviteTeamId(event.target.value)}><option value="">No team</option>{projectTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><button className="console-secondary" disabled={busy || !selectedProjectId}><MailPlus size={16} />Send invitation</button></form></div>
        <div className="rounded-card border border-compass-line bg-compass-panel p-4"><div className="mb-3 flex items-center gap-2"><MailPlus size={18} /><h3>Pending invitations</h3></div><div className="grid gap-2">{invitations.filter((invitation) => invitation.status === "pending").map((invitation) => <div className="flex flex-wrap items-center justify-between gap-3 border-b border-compass-line py-2 text-sm" key={invitation.id}><span><strong>{invitation.email}</strong><small className="ml-2 text-slate-500">expires {new Date(invitation.expires_at).toLocaleDateString("en-IN")}</small></span><span className="flex gap-2"><button className="console-secondary" disabled={busy} onClick={() => void updateInvitation(invitation.id, "resend")}>Resend</button><button className="console-icon" title="Cancel invitation" aria-label={`Cancel invitation for ${invitation.email}`} disabled={busy} onClick={() => void updateInvitation(invitation.id, "cancel")}><Trash2 size={16} /></button></span></div>)}{!invitations.some((invitation) => invitation.status === "pending") ? <p className="text-sm text-slate-400">No pending invitations.</p> : null}</div></div>
        <div className="rounded-card border border-compass-line bg-compass-panel p-4"><div className="mb-3 flex items-center gap-2"><Shield size={18} /><h3>Organization members</h3></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Verification</th><th className="p-2">Project access</th><th className="p-2">Status</th><th className="p-2" /></tr></thead><tbody>{members.map((member) => <tr key={member.user_id} className="border-t border-compass-line"><td className="p-2">{member.email}</td><td className="p-2"><select value={member.role === "owner" ? "owner" : member.role} disabled={busy || member.role === "owner"} onChange={(event) => void changeRole(member.user_id, event.target.value as "admin" | "customer")}><option value="owner">Owner</option><option value="admin">Admin</option><option value="customer">Member</option></select></td><td className="p-2">{member.email_verified ? "Verified" : "Pending"}</td><td className="p-2"><select value={projectRole(member.user_id)} disabled={busy || member.role === "owner" || !selectedProjectId} onChange={(event) => void changeProjectAccess(member.user_id, event.target.value as "none" | "member" | "admin")}><option value="none">No access</option><option value="member">Member</option><option value="admin">Admin</option></select></td><td className="p-2">{member.status}</td><td className="p-2 text-right">{member.role !== "owner" ? <button className="console-icon" title="Revoke member access" aria-label={`Revoke ${member.email}`} disabled={busy} onClick={() => void removeMember(member.user_id)}><Trash2 size={16} /></button> : null}</td></tr>)}</tbody></table></div></div></div></div>
  </section>;
}
