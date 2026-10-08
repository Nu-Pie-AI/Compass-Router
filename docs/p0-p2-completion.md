# Compass P0-P2 Completion Contract

This is the product-completion checklist for the repository. It separates code that is implemented here from prerequisites that require an external account, credential, or deployment operation.

## P0: production safety and financial correctness

- [x] Session authentication, logout invalidation, login throttling, suspension checks, and role authorization.
- [x] Product-owner controls for users, sessions, teams, provider credentials, providers, models, routing policies, billing reconciliation, audit history, operations metrics, and live-readiness.
- [x] Production configuration fails closed when development secrets, local test mode, development billing, or disabled secret storage are used.
- [x] API request IDs and baseline security headers are present on every response.
- [x] Request body limits reject oversized and malformed `Content-Length` values with stable Compass errors.
- [x] Model publication requires an enabled provider and a usable platform or approved local credential.
- [x] Disabled, unpublished, unavailable, expired, and provider-disabled models are excluded from callable inventories and API-key grants.
- [x] Wallet credits and usage debits are idempotent.
- [x] In-flight provider requests reserve estimated wallet balance; successful requests settle to measured usage and failed requests release the reservation.
- [x] Razorpay webhook signatures and duplicate event IDs are handled server-side.

## P1: usable platform workflows

- [x] OpenAI-compatible chat, responses, embeddings, image, audio, batch, and streaming contracts share authentication, routing, limits, health recording, usage records, and billing controls.
- [x] Proxy/local-test and direct provider execution paths are explicit; provider errors map to stable Compass error codes and can use configured fallbacks.
- [x] BYOK credentials remain server-side and are scoped to the owning team.
- [x] Provider and model governance is exposed in the admin console, including lifecycle, publication, pricing, fallback, credentials, and provider health controls.
- [x] Customer console workflows cover teams, members, API keys, model access, wallet, billing orders, refunds, invoices, activity, and model chat/playground.
- [x] VS Code extension contracts use the deployed API base, model inventory, account data, chat completions, and conversation history without embedding provider secrets.
- [x] Readiness and operations endpoints report database, Redis, execution mode, provider credentials, published models, billing mode, health, and recent operational signals.

## P2: operational completeness

- [x] Audit records carry the acting user and request ID for privileged mutations.
- [x] Reconciliation surfaces missing or orphaned payment credits.
- [x] Provider health records support degraded status and circuit-open routing protection.
- [x] Production runbooks, billing behavior, security requirements, and controlled-beta behavior are documented.
- [x] API, web, and extension validation commands are documented and runnable locally.
- [x] Cross-boundary tests cover ownership, model governance, credential routing, billing idempotency, reservation release, security headers, direct execution, and live-mode gates.
- [ ] External-only: configure real provider credentials and verify each provider's native adapter/model mapping.
- [ ] External-only: create and test production Secret Manager, Cloud SQL, Redis, Razorpay, OAuth, email, IAM, monitoring, alerting, and rollback resources.
- [ ] External-only: deploy the validated image and perform live smoke tests against the production domain.

The unchecked items are deliberately not represented as fake local success. They are release prerequisites outside this repository's control.

## Validation gates

```powershell
.\.venv\Scripts\python.exe -m pytest -q
python -m compileall apps/api/app tests
cd apps/web
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
cd ..\compass-code
npm.cmd run check
npm.cmd test
```
