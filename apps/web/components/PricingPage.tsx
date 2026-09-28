"use client";

import { ArrowRight, Check, Route } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "../lib/api";

type PublishedModel = {
  id: string;
  display_name: string;
  provider: string;
  input_price_paise_per_1k: number;
  output_price_paise_per_1k: number;
};

const example = {
  providerPriceUsd: 0.15,
  forexRate: 85.2,
  forexBuffer: 5,
  platformFee: 5,
};

const included = [
  "Usage-based wallet billing",
  "Per-request cost visibility in INR",
  "One API key across enabled models",
  "Provider routing and failover controls",
];

function rupees(value: number) {
  return `Rs ${value.toFixed(2)}`;
}

function modelRupees(paisePerThousand: number) {
  return `Rs ${(paisePerThousand * 10).toFixed(2)}`;
}

function providerName(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PricingPage() {
  const [models, setModels] = useState<PublishedModel[]>([]);
  const [modelsError, setModelsError] = useState("");
  const effectiveRate = example.forexRate * (1 + example.forexBuffer / 100);
  const finalCost = example.providerPriceUsd * effectiveRate * (1 + example.platformFee / 100);

  useEffect(() => {
    void apiFetch<PublishedModel[]>("/models")
      .then(setModels)
      .catch((reason) => setModelsError(reason instanceof Error ? reason.message : "Published model prices are unavailable."));
  }, []);

  return <main className="marketing-shell pricing-page">
    <nav className="marketing-nav" aria-label="Primary navigation">
      <Link className="brand-lockup" href="/" aria-label="Compass home"><span className="brand-mark"><Route aria-hidden="true" /></span><span>Compass</span></Link>
      <div className="marketing-links"><Link href="/">Home</Link><Link href="/models">Models</Link><Link className="is-active" href="/pricing" aria-current="page">Pricing</Link><a href="#formula">How it works</a></div>
      <div className="marketing-actions"><Link className="button button-quiet" href="/playground">Playground</Link><Link className="button button-primary" href="/dashboard">Open console <ArrowRight aria-hidden="true" /></Link></div>
    </nav>

    <section className="pricing-hero">
      <span className="eyebrow">Usage-based AI infrastructure</span>
      <h1>Simple, transparent pricing in rupees.</h1>
      <p>Pay for the tokens your applications use through Compass. See the provider price, conversion assumptions, and platform fee before you make a request.</p>
      <div className="pricing-hero-actions"><Link className="button button-primary button-large" href="/dashboard">Start building <ArrowRight aria-hidden="true" /></Link><Link className="button button-secondary button-large" href="/models">Browse models</Link></div>
      <div className="pricing-proof"><span><Check aria-hidden="true" /> No monthly subscription</span><span><Check aria-hidden="true" /> Wallet-backed usage</span><span><Check aria-hidden="true" /> Prices shown in INR</span></div>
    </section>

    <section className="pricing-section" id="formula" aria-labelledby="formula-title">
      <div className="pricing-section-heading"><span className="eyebrow">Billing formula</span><h2 id="formula-title">How we calculate your cost</h2><p>Every estimate is built from the provider list price and the configured Compass pricing policy.</p></div>
      <div className="pricing-formula-table" role="table" aria-label="Pricing formula example">
        <div className="pricing-table-caption">Example: GPT-4o-mini input tokens</div>
        <div className="pricing-table-row" role="row"><span>Provider list price (USD)</span><strong>${example.providerPriceUsd.toFixed(2)} / 1M tokens</strong></div>
        <div className="pricing-table-row" role="row"><span>USD/INR conversion rate</span><strong>Rs {example.forexRate.toFixed(2)} per USD</strong></div>
        <div className="pricing-table-row" role="row"><span>{example.forexBuffer}% forex buffer</span><strong>Effective rate: Rs {effectiveRate.toFixed(2)} per USD</strong></div>
        <div className="pricing-table-row" role="row"><span>{example.platformFee}% platform fee</span><strong>Applied on the INR amount</strong></div>
        <div className="pricing-table-row pricing-table-total" role="row"><span>Your final cost</span><strong>{rupees(finalCost)} / 1M input tokens</strong></div>
      </div>
      <div className="pricing-formula-short"><strong>Short formula:</strong><code>Your cost = provider price (USD) × forex rate × 1.05 × 1.05</code></div>
    </section>

    <section className="pricing-section pricing-models" aria-labelledby="model-prices-title">
      <div className="pricing-section-heading pricing-model-heading"><div><span className="eyebrow">Published model prices</span><h2 id="model-prices-title">Popular routes in rupees</h2><p>Prices below come from the current Compass model catalog. Actual charges use the token counts returned by each request.</p></div><Link className="text-link" href="/models">View all models <ArrowRight aria-hidden="true" /></Link></div>
      <div className="pricing-model-table">
        <div className="pricing-model-header"><span>Model</span><span>Provider</span><span>Input / 1M</span><span>Output / 1M</span></div>
        {models.length ? models.slice(0, 8).map((model) => <div className="pricing-model-row" key={model.id}><div><strong>{model.display_name}</strong><code>{model.id}</code></div><span>{providerName(model.provider)}</span><strong>{modelRupees(model.input_price_paise_per_1k)}</strong><strong>{modelRupees(model.output_price_paise_per_1k)}</strong></div>) : <div className="pricing-model-empty">{modelsError || "Loading published model prices..."}</div>}
      </div>
    </section>

    <section className="pricing-section pricing-included" aria-labelledby="included-title">
      <div className="pricing-section-heading"><span className="eyebrow">Included with Compass</span><h2 id="included-title">Everything needed to run model traffic.</h2></div>
      <div className="pricing-included-grid">{included.map((item) => <div key={item}><Check aria-hidden="true" /><span>{item}</span></div>)}</div>
    </section>

    <footer className="marketing-footer"><Link className="brand-lockup" href="/"><span className="brand-mark"><Route aria-hidden="true" /></span><span>Compass</span></Link><p>OpenAI-compatible routing, usage controls, and INR billing.</p><div><Link href="/models">Models</Link><Link href="/pricing">Pricing</Link><Link href="/playground">Playground</Link></div></footer>
  </main>;
}
