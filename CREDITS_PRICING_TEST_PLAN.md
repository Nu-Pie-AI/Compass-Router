# M14 Credits and Pricing Test Plan

## Local tests

- Versioned pricing policy stores 5% FX buffer and 5% platform fee.
- Customer price calculation applies the formula once, with explicit legacy markup.
- BYOK requests settle zero Compass Credits while retaining usage attribution.
- Managed requests reserve, settle, or release Credits idempotently.
- Pricing policy snapshots remain attached to model/request records.
- Clerk invitation fallback remains available only for local test mode or disabled feature configuration.
- Clerk invitation HTTP calls are mocked in unit tests; no live email is claimed.

## Staging gates

- Clerk Organization enablement, invitation email delivery, acceptance, resend, revoke, and webhook reconciliation.
- Approved FX source refresh, stale-rate handling, and pricing calculator against verified catalog records.
- PostgreSQL concurrency, Redis, real provider inference, streaming settlement, and Razorpay sandbox.
- FIFO credit lots and expiry require a separate migration-safe ledger design before activation.
