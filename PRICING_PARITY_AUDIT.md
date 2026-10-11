# M14 Pricing Parity Audit

Reference retrieval date: 2026-10-11.

The public AICredits pricing page documents pay-per-token INR billing, a live USD/INR rate refreshed every 10 minutes, a 5% FX buffer, and a 5% platform fee. Its pricing documentation also describes separate input/output prices, cached-token and reasoning-token rules, provider/tool-specific pricing, pricing tiers, FIFO credits, and one-year expiry.

Compass now stores the FX buffer and platform fee in versioned `PricingPolicy` rows. The effective baseline formula is:

`customer INR charge = provider USD cost x effective USD/INR rate x (1 + FX buffer) x (1 + platform fee) x (1 + legacy markup)`

Initial parity values are `fx_buffer_bps=500` and `platform_fee_bps=500`. The legacy markup remains explicit so it cannot be silently applied twice. Each request continues to use the captured pricing policy version.

## Differences and blockers

- Compass currently stores primary input/output token prices; cached input, cache writes, reasoning tokens, audio/image/tool units, and tier-specific rates are not yet first-class columns.
- The fixed local FX value remains a development fallback only. A licensed/public FX provider, refresh job, stale-rate policy, alerting, and production Secret Manager configuration are still required.
- Compass currently uses an aggregate Credits ledger. FIFO one-year expiry cannot be added safely without credit-lot allocation semantics; existing history must not be rewritten.
- Public AICredits model availability is not treated as Compass availability. Only verified Compass provider routes can be activated.

Sources: [AICredits pricing](https://aicredits.in/pricing), [AICredits pricing documentation](https://aicredits.in/docs/pricing), [AICredits model catalog](https://aicredits.in/models).
