"use client";

import { Activity, Boxes, BrainCircuit, Building2, Check, ChevronDown, CreditCard, KeyRound, LayoutGrid, LockKeyhole, Menu, MessageSquare, Plus, RefreshCw, Route, Search, Store, Terminal, UserRound, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Workspace = { id: string; name: string; team_count: number };
type NavigationLink = { label: string; href: string; icon: LucideIcon };
const workspaceLinks: NavigationLink[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutGrid },
  { label: "Models", href: "/models", icon: Boxes },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Playground", href: "/playground", icon: Terminal },
  { label: "Decision workspace", href: "/decisions", icon: BrainCircuit },
];
const manageLinks: NavigationLink[] = [
  { label: "API Keys", href: "/api-keys", icon: KeyRound },
  { label: "BYOK", href: "/byok", icon: LockKeyhole },
  { label: "Provider settings", href: "/admin", icon: LockKeyhole },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Billing", href: "/wallet", icon: CreditCard },
];
const accountLinks: NavigationLink[] = [
  { label: "Teams", href: "/teams", icon: Users },
  { label: "Workspaces", href: "/workspaces", icon: LayoutGrid },
  { label: "Profile", href: "/profile", icon: UserRound },
];
const allDestinations = [
  { label: "Overview", href: "/dashboard" }, { label: "API Keys", href: "/api-keys" },
  { label: "Models", href: "/models" }, { label: "Pricing", href: "/pricing" }, { label: "Chat", href: "/chat" },
  { label: "Playground", href: "/playground" }, { label: "Decision workspace", href: "/decisions" }, { label: "Activity", href: "/activity" },
  { label: "Billing", href: "/wallet" }, { label: "BYOK", href: "/byok" },
  { label: "Provider settings", href: "/admin" },
  { label: "Workspaces", href: "/workspaces" }, { label: "Profile", href: "/profile" },
  { label: "Teams", href: "/teams" },
];
const topLinks = [
  { label: "Home", href: "/dashboard" },
  { label: "Models", href: "/models" },
  { label: "Pricing", href: "/pricing" },
  { label: "Chat", href: "/chat" },
  { label: "Playground", href: "/playground" },
  { label: "Decisions", href: "/decisions" },
];
const navigationDrawerStorageKey = "compass.console.navigationOpen";
const marketplaceUrl = process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? "http://localhost:3100";

export function ConsoleShell({ children, view, title, subtitle, workspaces, workspaceId, onWorkspaceChange, onRefresh, session, onLogout, onCreateWorkspace }: {
  children: React.ReactNode; view: string; title: string; subtitle: string;
  workspaces: Workspace[]; workspaceId: string; onWorkspaceChange: (id: string) => void; onRefresh: () => void;
  session: { email: string; role: string; organization_role?: string | null }; onLogout: () => void; onCreateWorkspace?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(navigationDrawerStorageKey) === "true";
  });
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const canManage = session.role === "admin" || session.role === "super_admin";
  const canManageOrganization = canManage || session.organization_role === "owner" || session.organization_role === "admin";
  const visibleManageLinks = canManage ? manageLinks : manageLinks.filter((item) => item.href !== "/admin");
  const destinations = canManage ? allDestinations : allDestinations.filter((item) => item.href !== "/admin");
  const results = destinations.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()));
  const accountName = session.email.split("@")[0] || "Account";
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  const isActive = (href: string) => href !== "/" && href === `/${view}`;
  async function refresh() {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }
  useEffect(() => {
    if (!workspaceOpen) return;
    function closeOnOutside(event: MouseEvent) {
      if (!workspaceRef.current?.contains(event.target as Node)) setWorkspaceOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [workspaceOpen]);
  useEffect(() => {
    window.sessionStorage.setItem(navigationDrawerStorageKey, String(menuOpen));
  }, [menuOpen]);
  useEffect(() => {
    if (menuOpen) sidebarRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [menuOpen, view]);
  useEffect(() => {
    const topbar = topbarRef.current;
    if (!topbar) return;
    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty("--console-topbar-height", `${topbar.getBoundingClientRect().height}px`);
    };
    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(topbar);
    return () => observer.disconnect();
  }, []);
  function links(items: NavigationLink[]) {
    return items.map((item) => {
      const Icon = item.icon;
      return <Link key={item.label} href={item.href} className={`console-nav-item ${isActive(item.href) ? "is-active" : ""}`} aria-current={isActive(item.href) ? "page" : undefined}><Icon size={18} /><span>{item.label}</span></Link>;
    });
  }
  return <main className={`console-shell ${menuOpen ? "is-menu-open" : ""}`}>
    <a href="#console-content" className="console-skip">Skip to content</a>
    <header ref={topbarRef} className="console-topbar">
      <div className="console-brand-area"><button className="console-icon mobile-menu" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="console-sidebar" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><Link href="/" className="console-brand"><Route size={28} />Compass</Link></div>
      <div className="console-global-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
        <Search size={18} /><input aria-label="Search console pages" placeholder="Search" value={search} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }} />
        {searchOpen ? <nav className="console-search-results" aria-label="Search results">{results.length ? results.map((item) => <Link key={item.href} href={item.href} onClick={() => setSearchOpen(false)}>{item.label}</Link>) : <p>No matching pages.</p>}</nav> : null}
      </div>
      <nav className="console-top-links" aria-label="Product navigation">{topLinks.map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "is-active" : undefined} aria-current={isActive(item.href) ? "page" : undefined}>{item.label}</Link>)}<a href={marketplaceUrl} className="console-marketplace-link console-marketplace-button"><Store size={15} aria-hidden="true" />Marketplace</a></nav>
      <details className="console-account"><summary><span className="account-avatar">{session.email.slice(0, 1).toUpperCase()}</span><span className="account-label">{accountName}</span><ChevronDown size={15} /></summary><div><Link className={isActive("/profile") ? "is-active" : undefined} aria-current={isActive("/profile") ? "page" : undefined} href="/profile">Profile</Link><Link className={isActive("/workspaces") ? "is-active" : undefined} aria-current={isActive("/workspaces") ? "page" : undefined} href="/workspaces">Workspaces</Link>{canManageOrganization ? <Link className={isActive("/admin") ? "is-active" : undefined} aria-current={isActive("/admin") ? "page" : undefined} href="/admin">Company admin</Link> : null}{canManage ? <Link className={isActive("/super-admin") ? "is-active" : undefined} aria-current={isActive("/super-admin") ? "page" : undefined} href="/super-admin">Super Admin</Link> : null}<button type="button" onClick={onLogout}>Sign out</button></div></details>
    </header>
    {menuOpen ? <button className="console-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}
    <aside id="console-sidebar" ref={sidebarRef} className={`console-sidebar ${menuOpen ? "is-open" : ""}`}>
      <div className="workspace-switcher" ref={workspaceRef}>
        <button type="button" className="workspace-switcher-trigger" aria-haspopup="listbox" aria-expanded={workspaceOpen} onClick={() => setWorkspaceOpen((open) => !open)} disabled={!workspaces.length}>
          <span className="workspace-switcher-copy"><Building2 size={16} aria-hidden="true" /><span><strong>{selectedWorkspace?.name ?? "No workspace"}</strong><small>{selectedWorkspace ? `${selectedWorkspace.team_count} ${selectedWorkspace.team_count === 1 ? "team" : "teams"}` : "Create a workspace to get started"}</small></span></span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {workspaceOpen ? <div className="workspace-menu" role="listbox" aria-label="Select workspace">
          {workspaces.map((workspace) => <button type="button" role="option" aria-selected={workspace.id === workspaceId} className="workspace-menu-item" key={workspace.id} onClick={() => { onWorkspaceChange(workspace.id); setWorkspaceOpen(false); }}>
            <span><strong>{workspace.name}</strong><small>{workspace.team_count} {workspace.team_count === 1 ? "team" : "teams"}</small></span>
            {workspace.id === workspaceId ? <Check size={16} aria-hidden="true" /> : null}
          </button>)}
          {onCreateWorkspace ? <><div className="workspace-menu-divider" /><button type="button" className="workspace-menu-action" onClick={() => { setWorkspaceOpen(false); onCreateWorkspace(); }}><Plus size={16} aria-hidden="true" />Create workspace</button></> : null}
        </div> : null}
      </div>
      <nav className="console-sidebar-nav" aria-label="Workspace navigation">
        <div className="console-nav-group">{links(workspaceLinks)}</div>
        <div className="console-nav-group"><div className="console-nav-label">Manage</div>{links(visibleManageLinks)}</div>
        <div className="console-nav-group"><div className="console-nav-label">Account</div>{links(accountLinks)}</div>
      </nav>
    </aside>
    <section id="console-content" className="console-content" tabIndex={-1}>
      <div className="console-page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div><button className="console-icon" onClick={() => void refresh()} disabled={refreshing} title="Refresh data" aria-label="Refresh data"><RefreshCw size={19} className={refreshing ? "animate-spin" : ""} /></button></div>
      {children}
    </section>
  </main>;
}
