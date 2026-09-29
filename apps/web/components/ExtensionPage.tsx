import { ArrowRight, Check, Code2, Download, ExternalLink, FileCode2, GitBranch, ShieldCheck, Terminal } from "lucide-react";
import Link from "next/link";
import { LandingNav } from "./LandingNav";

const steps = [
  ["Install", "Download the Compass Code package and install it from VS Code."],
  ["Connect", "Paste a Compass API key. The extension stores it in VS Code SecretStorage."],
  ["Build", "Ask, plan, code, or debug with workspace-aware actions and approvals."],
];

export function ExtensionPage() {
  return (
    <main className="extension-shell">
      <LandingNav />
      <section className="extension-hero">
        <div className="extension-hero-copy">
          <span className="eyebrow"><Code2 aria-hidden="true" /> Compass Code for VS Code</span>
          <h1>A coding agent that stays inside your workspace controls.</h1>
          <p>Bring Compass routing, model access, usage visibility, and approval-based tools into the editor you already use.</p>
          <div className="hero-actions">
            <a className="button button-primary button-large" href="https://github.com/Nu-Pie-AI/Compass/releases" target="_blank" rel="noreferrer"><Download aria-hidden="true" />Download extension</a>
            <Link className="button button-secondary button-large" href="/dashboard">Open overview <ArrowRight aria-hidden="true" /></Link>
          </div>
          <div className="hero-proof"><span><Check aria-hidden="true" /> Review-first approvals</span><span><Check aria-hidden="true" /> BYOK stays server-side</span><span><Check aria-hidden="true" /> Open source package</span></div>
        </div>
        <div className="extension-preview" aria-label="Compass Code editor preview">
          <div className="extension-preview-top"><span className="preview-dots"><i /><i /><i /></span><span>Compass Code · Agent</span><span className="preview-status"><i /> Connected</span></div>
          <div className="extension-preview-body">
            <aside className="preview-rail"><span className="active"><FileCode2 /></span><span><GitBranch /></span><span><Terminal /></span></aside>
            <div className="preview-editor"><div className="preview-tabs"><span>README.md</span><span>api.ts</span></div><div className="code-lines"><span><b>01</b> <em># Compass workspace</em></span><span><b>02</b> </span><span><b>03</b> Ask Compass to inspect this project.</span><span><b>04</b> </span><span><b>05</b> <em>await router.connect()</em></span></div><div className="preview-composer"><span>Ask Compass to inspect or change this workspace...</span><button type="button" aria-label="Send prompt"><ArrowRight /></button></div></div>
            <aside className="preview-agent"><span className="preview-label">COMPASS CODE</span><strong>Ready when you are.</strong><p>Review the plan, inspect files, and approve changes from one focused panel.</p><div className="preview-agent-row"><ShieldCheck /><span>Approval required for writes</span></div><div className="preview-agent-row"><Code2 /><span>Model access from Compass</span></div></aside>
          </div>
        </div>
      </section>
      <section className="extension-steps" id="install">
        <div className="section-heading"><span className="eyebrow">A focused editor workflow</span><h2>From first prompt to reviewed change.</h2><p>Compass Code keeps the interface compact and the important decisions visible: model, mode, tools, and approvals.</p></div>
        <div className="extension-step-grid">{steps.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>
      <section className="extension-callout">
        <div><span className="eyebrow">Ready to publish</span><h2>Use the extension with your Compass workspace.</h2><p>Source, release packages, and setup instructions live with the combined Compass product.</p></div>
        <div className="extension-callout-actions"><a className="button button-primary button-large" href="https://github.com/Nu-Pie-AI/Compass/releases" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />View releases</a><a className="button button-secondary button-large" href="https://github.com/Nu-Pie-AI/Compass/tree/main/compass-code" target="_blank" rel="noreferrer">View source</a></div>
      </section>
    </main>
  );
}
