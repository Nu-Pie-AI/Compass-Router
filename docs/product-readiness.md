# Compass Product Readiness

This is the end-to-end completion contract for Compass, excluding deployment mechanics and real provider credential setup.

## Golden path

1. A user signs up or enters through Marketplace SSO.
2. Compass creates an isolated workspace, team, owner membership, limits, and wallet.
3. The owner configures a provider credential or team BYOK credential without exposing the secret.
4. A model is discovered, enabled, published, and visible only when its provider route is usable.
5. The owner creates a Compass API key and optionally restricts it to published model IDs.
6. An OpenAI-compatible client lists models and sends chat, Responses, embeddings, or batch requests.
7. Compass authenticates the key, applies team/key/model limits, routes with fallback, records attempts and usage, and debits the wallet once.
8. The owner can inspect users, providers, models, keys, usage, billing, readiness, and audit events.

## Product invariants

- Sessions are invalidated by logout, revocation, suspension, and role changes.
- API secrets and provider secrets are never returned after creation; only hashes, prefixes, or last-four metadata are exposed.
- Customer reads and writes are scoped to active workspace/team membership.
- Unrestricted API keys resolve only to enabled, published, available models behind enabled, healthy providers.
- Model publication requires a usable platform route; BYOK activation remains team-scoped.
- Billing credits, usage debits, refunds, invoices, and webhooks are idempotent and auditable.
- Provider failures create attempt and health records without charging a failed request.
- Local deterministic execution is explicit and never presented as live provider execution.

## Validation gates

- API integration suite covers auth, ownership, model governance, provider controls, routing, limits, usage, billing, and failure paths.
- Web lint, typecheck, and production build pass.
- VS Code extension typecheck, unit tests, and client contract remain green.
- `pytest` runs only the canonical root `tests/` suite and does not collect copied worktrees.

## Deliberately outside this goal

- Cloud Run, DNS, CI/CD, and secret-manager deployment operations.
- Production provider credentials and live provider execution verification.
- OAuth/email delivery, payment-provider account activation, and external IAM policy configuration.
