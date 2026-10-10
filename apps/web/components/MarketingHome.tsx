import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Check,
  Code2,
  Database,
  Download,
  FileCode2,
  GitBranch,
  Gauge,
  KeyRound,
  Layers3,
  Route,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { LandingNav } from "./LandingNav";

const capabilities = [
  { icon: Route, title: "One API for configured routes", copy: "Connect applications once, then route chat requests through the models and providers enabled for your workspace." },
  { icon: KeyRound, title: "BYOK or managed access", copy: "Save a team provider key or use an administrator-managed route. Raw provider credentials stay out of client applications." },
  { icon: Gauge, title: "Model access you control", copy: "Browse the model catalog, enable compatible chat models, and optionally restrict which models each Compass key can use." },
  { icon: Wallet, title: "Usage priced in INR", copy: "Check Credits before inference, record token usage, and settle each completed request with an idempotent ledger entry." },
];

const flow = [
  ["01", "Authenticate", "Validate the Compass key and resolve its workspace and model access."],
  ["02", "Route", "Select the configured provider route, with retry and fallback handling when available."],
  ["03", "Measure", "Record provider attempts, usage, latency, status, and request metadata."],
  ["04", "Settle", "Calculate INR cost, debit Credits once, and return an OpenAI-compatible chat response."],
];

export function MarketingHome() {
  return (
    <main className="marketing-shell">
      <LandingNav />

      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles aria-hidden="true" /> Controlled AI routing for teams</span>
          <h1>One API for the models your team enables.</h1>
          <p>Compass gives teams an OpenAI-compatible chat endpoint with workspace access, BYOK credentials, provider routing, usage records, and Credits-backed INR billing.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href="/dashboard">Start building <ArrowRight aria-hidden="true" /></Link>
            <Link className="button button-secondary button-large" href="/playground"><Code2 aria-hidden="true" /> Open playground</Link>
          </div>
          <div className="hero-proof">
            <span><Check aria-hidden="true" /> Chat completions compatible</span>
            <span><Check aria-hidden="true" /> BYOK keys stay server-side</span>
            <span><Check aria-hidden="true" /> Credits usage in INR</span>
          </div>
        </div>

        <div className="product-stage" aria-label="Compass routing console preview">
          <div className="stage-glow" />
          <div className="product-window">
            <div className="window-bar">
              <div className="window-dots"><span /><span /><span /></div>
              <span className="window-title">Example request route</span>
              <span className="status-pill status-live"><span /> Configured</span>
            </div>
            <div className="route-canvas">
              <div className="request-node">
                <Code2 aria-hidden="true" />
                <div><small>APPLICATION</small><strong>POST /v1/chat/completions</strong></div>
              </div>
              <div className="route-line"><span /></div>
              <div className="compass-node">
                <div className="node-icon"><Route aria-hidden="true" /></div>
                <div><small>COMPASS ROUTER</small><strong>gemini/gemini-3.6-flash</strong></div>
                <span className="status-pill">BYOK or managed</span>
              </div>
              <div className="provider-grid">
                <div className="provider-node provider-active"><span className="provider-letter">G</span><div><small>CONFIGURED</small><strong>Gemini</strong></div><Check aria-hidden="true" /></div>
                <div className="provider-node"><span className="provider-letter">O</span><div><small>FALLBACK</small><strong>OpenAI</strong></div></div>
                <div className="provider-node"><span className="provider-letter">L</span><div><small>AVAILABLE ROUTE</small><strong>Ollama</strong></div></div>
              </div>
            </div>
            <div className="request-result">
              <div><span>ENDPOINT</span><strong className="success-text">Chat completions</strong></div>
              <div><span>ACCESS</span><strong>Workspace key</strong></div>
              <div><span>USAGE</span><strong>Recorded</strong></div>
              <div><span>SETTLEMENT</span><strong>Credits ledger</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Compass routing controls">
        <span>CONNECT YOUR ROUTES</span>
        <strong>BYOK</strong><strong>Managed providers</strong><strong>Workspace keys</strong><strong>Fallback routes</strong>
      </section>

      <section className="content-section" id="platform">
        <div className="section-heading">
          <span className="eyebrow">The control plane</span>
          <h2>Everything your team needs before the model call.</h2>
          <p>Set up a workspace, choose model access, keep provider credentials server-side, and give applications one Compass endpoint.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map(({ icon: Icon, title, copy }) => (
            <article className="capability" key={title}>
              <span className="capability-icon"><Icon aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-section" id="workflow">
        <div className="workflow-intro">
          <span className="eyebrow">Request lifecycle</span>
          <h2>One request. Clear routing and usage records.</h2>
          <p>Compass connects API-key access, model routing, provider attempts, usage, and Credits settlement without exposing provider credentials to the client.</p>
          <Link className="text-link" href="/usage">Explore request usage <ArrowRight aria-hidden="true" /></Link>
        </div>
        <div className="workflow-list">
          {flow.map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="signal-section">
        <div className="signal-copy">
          <span className="eyebrow">Activity and billing visibility</span>
          <h2>See what each request used and cost.</h2>
          <p>Review request status, model and provider, token usage, latency, and INR cost from the selected workspace.</p>
          <ul>
            <li><Activity aria-hidden="true" /> Request status and provider latency</li>
            <li><BarChart3 aria-hidden="true" /> Tokens and cost by model</li>
            <li><Database aria-hidden="true" /> Connected request and ledger records</li>
          </ul>
        </div>
        <div className="signal-panel">
           <div className="signal-header"><div><small>EXAMPLE ACTIVITY VIEW</small><strong>Recent requests</strong></div><span>Workspace activity</span></div>
          <div className="chart-bars" aria-hidden="true">{[28, 42, 35, 62, 51, 76, 68, 88, 72, 94, 80, 100].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>
          <div className="signal-table">
             <div><span className="dot dot-green" /><strong>Model request</strong><span>Tokens recorded</span><span>INR cost</span></div>
             <div><span className="dot dot-violet" /><strong>Provider attempt</strong><span>Latency recorded</span><span>Status</span></div>
             <div><span className="dot dot-blue" /><strong>Credits settlement</strong><span>Ledger entry</span><span>Idempotent</span></div>
          </div>
        </div>
      </section>

      <section className="extension-section" id="extension">
        <div className="extension-section-copy">
          <span className="eyebrow"><Code2 aria-hidden="true" /> Compass Code for VS Code</span>
          <h2>Bring the router into your editor.</h2>
          <p>Use the Compass Code extension to ask questions, plan changes, inspect files, and make approved edits without leaving VS Code.</p>
          <div className="extension-feature-list">
            <span><CheckCircle2 aria-hidden="true" /> Review-first or high-autonomy work styles</span>
            <span><CheckCircle2 aria-hidden="true" /> Workspace-aware file and terminal tools</span>
            <span><CheckCircle2 aria-hidden="true" /> Compass model and API-key controls</span>
          </div>
          <div className="hero-actions"><Link className="button button-primary button-large" href="/extension"><Download aria-hidden="true" />Explore Compass Code</Link><a className="button button-secondary button-large" href="https://github.com/Nu-Pie-AI/Compass/releases" target="_blank" rel="noreferrer">View releases <ArrowRight aria-hidden="true" /></a></div>
        </div>
        <div className="extension-mini-preview"><div className="mini-top"><span><i /><i /><i /></span><strong>Compass Code</strong><small>AGENT</small></div><div className="mini-body"><aside><FileCode2 /><GitBranch /><Terminal /></aside><div><span className="mini-label">REVIEW FIRST</span><strong>Ready when you are.</strong><p>Ask Compass to inspect or change this workspace.</p><div className="mini-input"><span>Describe a task...</span><ArrowRight /></div></div></div></div>
      </section>

      <section className="security-section" id="security">
        <div className="security-mark"><ShieldCheck aria-hidden="true" /></div>
         <div><span className="eyebrow">Designed for controlled access</span><h2>Provider credentials stay behind the Compass API.</h2></div>
        <div className="security-points">
          <span><KeyRound aria-hidden="true" /> Hashed Compass API keys</span>
           <span><Layers3 aria-hidden="true" /> Workspace-scoped model access</span>
           <span><Zap aria-hidden="true" /> Server-side Credits controls</span>
        </div>
      </section>

      <section className="final-cta">
        <div><span className="eyebrow">Compass Router</span><h2>Give your applications one controlled chat endpoint.</h2></div>
        <Link className="button button-inverse button-large" href="/dashboard">Open Compass console <ArrowRight aria-hidden="true" /></Link>
      </section>

      <footer className="marketing-footer">
        <Link className="brand-lockup" href="/"><span className="brand-mark"><Route aria-hidden="true" /></span><span>Compass</span></Link>
         <p>OpenAI-compatible chat routing, BYOK access, usage records, and INR Credits billing.</p>
        <div><Link href="/dashboard">Console</Link><Link href="/models">Models</Link><Link href="/pricing">Pricing</Link><Link href="/playground">Playground</Link></div>
      </footer>
    </main>
  );
}
