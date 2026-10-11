# Pricing and Wallet Specification

Updated: 2026-10-09

The existing wallet, API-key limits, usage ledger, and tenant isolation remain authoritative. M4/M6 add source-price persistence and separate provider attribution from customer settlement without replacing the wallet source of truth.

## Source and customer price

- Provider source prices are stored as USD per million input/output tokens when the source publishes them.
- Customer prices are derived from the active versioned `PricingPolicy` and the configured currency conversion/markup rules.
- Provider-cost attribution uses the stored source USD rates without customer markup; `compass_cost_paise` uses the marked-up customer-rate fields.
- A discovered model with missing billable source pricing is unavailable.
- No customer price is hardcoded from a provider name or guessed from a model label.

## Settlement boundary

Inference must reserve/check wallet and limits before provider work, record normalized usage and provider cost after a successful response, then settle the Compass charge exactly once. Failed provider requests must not be treated as successful usage.

## M4 scope

Implemented: source pricing fields, policy-version association, catalog conversion, persistence, and distinct provider/customer cost arithmetic.

Pending: M6 billing hardening, Razorpay sandbox reconciliation, refund behavior, and production payment approval.
# M14 pricing policy addendum

Managed pricing uses versioned policies with separate `fx_buffer_bps` and `platform_fee_bps` fields. The initial parity baseline is 500 bps for each, applied once after provider USD cost is converted using the active FX snapshot. BYOK remains zero Compass Credits. The aggregate ledger's existing non-expiring promotional Credits behavior is preserved until credit lots are implemented safely.
