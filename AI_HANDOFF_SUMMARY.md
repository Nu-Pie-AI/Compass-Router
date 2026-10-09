# Compass Router AI Handoff Summary

## Mission

Continue hardening Compass Router as a multi-tenant AI routing platform with a Router web console, marketplace identity surface, VS Code agent extension, provider routing, usage accounting, wallet billing, API keys, teams, projects, and BYOK.

## Production continuation state - 2026-10-09

For the production roadmap, work only in `C:/Users/tohee/Desktop/Compass-Router-Production`; the original repository and VS Code extension are out of scope. M0 through M3 are complete for isolated verification. M4 provider-neutral catalog, M5 genuine upstream streaming, M6 wallet recovery hardening, M7 web workflow verification, M8 deployment preparation, and M9 local super-admin governance are implemented locally; release gates remain blocked by external infrastructure, live credentials, browser, payment, Clerk MFA/session verification, and commercial verification. Never infer production readiness from the local suite.

## Canonical project

Repository: C:/Users/tohee/Desktop/Compass-Litellm-Router
Canonical source directories:
- apps/api
- apps/web
- marketplace
- compass-code
- packages/shared
- services/litellm
- infra/docker
- docs
- tests

Do not treat nested CompassUnified or controlled-beta-work copies as canonical implementation unless explicitly requested. Preserve unrelated worktree changes and generated artifacts.

## Current state

The API and Router web console are implemented to a meaningful production-preparation depth. Current isolated evidence is 96 API/catalog/migration/adapter/staging-harness and infrastructure tests passed, including adapter capability gates, M9 platform role/bootstrap/MFA-boundary, wallet adjustment, settings, pricing/routing revision, command-center, and provider-registry coverage alongside production-startup and non-routable ORM-default tests, API-key rotation, SMTP outbox success/failure state handling, Responses SSE forwarding, commercial approval gating, stale-catalog rejection, conservative capability normalization, no-capability activation rejection, monotonic provider-health ordering, media usage-source accounting, source/customer pricing separation, production-safe Cloud Run runtime requirements, and redaction-safe structured request logging; web typecheck, lint, production build, standalone server start, and public-route smoke checks passed, with 23 routes including `/admin`, the production dependency audit is clean, Cloud Run template safety validation passes locally, and the immutable release builder dry-run passes without pushing. Docker is unavailable in this environment, so PostgreSQL/Redis/container checks, Clerk browser/MFA flows, live providers, SMTP delivery, payment webhooks, Cloud Run, Cloud Logging/Monitoring, tracing, alerts, and real VS Code host behavior remain unverified. `infra/verify_staging.py` is ready for owner-controlled live checks but has not been run against staging.

The extension package is named compass-router and displays Compass Router. The extension contains a custom agent loop with ask, edit, agent, plan, code, and debug modes, workspace tools, permissions, checkpoints, diffs, transcript restore, model selection, project tagging, and a streaming client contract. Its UI is not a complete clone of Kilo Code and does not show evidence of MCP, subagents, durable server-side conversation, or full compaction infrastructure.

## Product architecture decisions to preserve

- Tenant boundary is organization, with projects and teams below it.
- API keys are scoped and hash-backed.
- BYOK credentials are encrypted and must not be exposed to clients.
- Wallet reservations happen before provider execution and settle after usage is known.
- Provider attempts, health, usage, and billing records are separate concerns.
- Provider commercial approval is separate from technical health and is required for production publication and customer routing.
- Marketplace-to-Router sign-in uses a short-lived signed handoff.
- The extension sends a project identifier so requests can be assigned to the correct customer project.
- Customer-facing platform charges must be calculated independently from provider pass-through cost, including BYOK platform fees.

## Highest priority implementation backlog

1. Run PostgreSQL/Alembic and Redis verification in an isolated staging environment.
2. Configure Clerk and verify signup, login, logout, session expiry, webhook redelivery, and extension device authorization in a browser.
3. Verify at least one approved LiteLLM/direct provider for discovery, streaming, usage, retries, cancellation, and wallet settlement.
4. Configure SMTP and verify invitation/OTP delivery, retry behavior, and sending-domain deliverability.
5. Verify Razorpay sandbox order, webhook, duplicate event, refund, invoice, and reconciliation with owner-supplied credentials.
6. Run Cloud Build verification and deploy only after GCP, Secret Manager, DNS/TLS, monitoring, backup/restore, and rollback approvals.
7. Keep Jev deferred until its official contract, authenticated access, pricing, commercial permission, and data-processing terms are verified.
8. Verify M9 in staging: Clerk owner bootstrap/MFA/session revocation, high-risk reauthentication, platform role changes, PostgreSQL/Redis concurrency, admin browser accessibility, and audit completeness.

## Verification plan

### Local API
- Start PostgreSQL, Redis, LiteLLM, API, and web using the repository's documented local path.
- Run API pytest and inspect failures by route group.
- Confirm startup config validation rejects unsafe production settings.
- Exercise health, signup, login, OTP, project, key, model, chat, usage, wallet, and admin authorization flows.

### Web
- Run typecheck and production build.
- Test login, signup, dashboard, project and team membership, API key creation, BYOK, models, usage, wallet, pricing, and admin pages.
- Verify logout clears session state and protected routes cannot silently re-authenticate with stale browser state.

### Extension (separate scope, unchanged by this production copy)
- Build and package the VSIX.
- Install in a real VS Code host.
- Verify device sign-in or API-key sign-in, model list, project tag, prompt send, response rendering, streaming, cancellation, tool approval, transcript restore, and disconnect.
- Capture the actual API request and response for any reported no-response defect.

### Cloud
- Verify GCP project, billing, Artifact Registry, Cloud Run services, environment variables, Secret Manager access, CORS, custom domain, TLS, and database connectivity.
- Run a deployed smoke test through the public API URL and extension configuration.
- Confirm logs contain request IDs without provider secrets or raw API keys.

## Known risks to avoid

- Do not enable local test response mode in production.
- Do not copy fixture credentials from env examples into deployment.
- Do not report historical test counts as fresh results.
- Do not assume a provider catalog entry means that provider is operational.
- Do not expose API key or BYOK plaintext in logs, UI diagnostics, or reports.
- Do not change nested snapshot folders while working on the canonical root.
- Do not remove current features while reorganizing the product; use additive, reversible changes.

## Handoff conclusion

The next AI should begin with the current git status and these progress/blocker documents, then work only on the next externally verifiable release gate. Do not repeat the completed local M4-M9 slices, do not activate Jev, do not deploy, and do not modify the original repository or VS Code extension. Keep the product model and accounting boundaries above intact.

