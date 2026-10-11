# Compass Router Production Deployment Readiness

## Safe staging preflight - 2026-10-09

Status: PREPARED; DEPLOYMENT REQUIRES OWNER APPROVAL

- Target branch: `staging/safe-deployment-2026-10-09`.
- Read-only GCP checks passed for project `compass-510017`, billing, existing Cloud Run services, and Artifact Registry repository `compass` in `us-central1`.
- Focused verification passed: 13 API/infrastructure tests, web lint, web production build, web typecheck, template validation, whitespace validation, and production npm audit.
- Remote build configuration: `infra/gcp/cloudbuild-staging-images.yaml`.
- Intended services: `compass-router-api-staging` and `compass-router-web-staging`.
- No staging resources or existing public services were modified.
- Neon staging database integration is prepared: pooled runtime `DATABASE_URL`, direct Alembic `DIRECT_DATABASE_URL`, `psycopg` normalization, SSL preservation, and a Cloud SQL-free staging template.
- Neon connectivity, migration, isolation, concurrency, rollback, and data-provenance checks remain pending because no database URL was available to the workspace.
- Root `.env` now exists with safe placeholders only; it is ignored and untracked. The verifier was executed and failed closed before any migration because the Neon host is still a placeholder.
- Approval is still required for resource creation, isolated database/Redis provisioning, Secret Manager writes, and Cloud Build execution.

Status: NOT READY

## Current readiness

| Area | Status | Evidence or gap |
|---|---|---|
| Isolated source copy | READY | Target clone, branch, baseline tag, and source status comparison |
| API unit/integration baseline | READY WITH PENDING STAGING CHECKS | 96 isolated API/catalog/migration/adapter/staging-harness and infrastructure tests passed, including adapter capability gates, M9 governance, provider registry fail-closed behavior, conservative capability normalization, no-capability activation rejection, monotonic provider-health ordering, media usage-source accounting, source/customer pricing separation, production startup seeding safety, API-key rotation, SMTP outbox state handling, Responses SSE forwarding, commercial approval gating, stale-catalog rejection, Cloud Run production-template requirements, and structured log allow-listing |
| Router web build | READY | Typecheck, lint, production build, production dependency audit, standalone server start, and public-route smoke checks pass; authenticated Clerk/browser workflows remain unverified |
| Marketplace build | READY WITH WARNINGS | TypeScript/build pass; dependency warnings remain |
| Database migrations | PARTIAL | Alembic head and SQLite upgrade tests pass; PostgreSQL and populated legacy adoption remain unverified |
| Clerk authentication | PARTIAL/BLOCKED FOR LIVE | Clerk verifier, bootstrap, webhook ledger, and web integration are coded; real Clerk app, keys, browser flow, and webhook delivery are not verified |
| Tenant authorization | PARTIAL | M3 centralized organization/project/team/key/BYOK checks and cross-tenant regression tests pass on SQLite; PostgreSQL, Redis, and live Clerk verification remain pending |
| Dynamic model catalog | PARTIAL/BLOCKED FOR LIVE | Provider-neutral LiteLLM registry, source pricing, readiness, stale handling, commercial approval gating, and optional OpenRouter isolation are coded; live provider discovery is not verified |
| Genuine streaming | PARTIAL/BLOCKED FOR LIVE | Production chat and Responses SSE paths forward upstream events; live timing, cancellation, provider errors, and backpressure remain unverified |
| Wallet accounting | PARTIAL | Existing tests, idempotent recovery, and provider commercial gating pass; PostgreSQL concurrency and live settlement remain unverified |
| Customer/admin workflows | PARTIAL | M9 permission-aware `/admin` control center, metadata explorers, wallet adjustment safety, role governance, settings, pricing/routing revisions, and audit views are locally verified; Clerk-backed browser journeys, fresh-authentication controls, and accessibility remain unverified |
| Transactional email | PARTIAL/BLOCKED FOR LIVE | Outbox worker claims, sends, retries, and records SMTP failures locally; SMTP credentials, sending domain, deliverability, and live OTP/invitation delivery remain unverified |
| Cloud operations | PREPARED/BLOCKED | Non-root images, verification Cloud Build, Cloud Run templates, and local template safety validation exist; Docker engine is unavailable and current gcloud resource queries fail with non-interactive reauthentication required |
| Razorpay payments | BLOCKED | Test credentials and signed webhook tests unavailable |
| Secret management | PARTIAL/BLOCKED FOR LIVE | Server-side secret references, pinned template versions, and release checks exist; GCP Secret Manager wiring and rotation drills remain unverified |
| Observability | PARTIAL/BLOCKED FOR LIVE | Structured redaction-safe request logs with request IDs, admin metrics/events, and monitoring guidance exist; Cloud Logging/Monitoring ingestion, tracing, alerts, and production redaction review remain unverified |
| Cloud Run deployment | BLOCKED | GCP project/IAM/domain access unavailable |
| Commercial launch | BLOCKED | Provider resale, tax, privacy, and payment approvals unavailable |
| M9 platform governance | PARTIAL/BLOCKED FOR LIVE | Role/bootstrap/MFA claim checks, metadata-only admin APIs, wallet controls, and admin UI are implemented; real Clerk claims, PostgreSQL/Redis behavior, high-risk reauthentication, and operational staging remain unverified |

## Required release gates

- [ ] M1 migration fresh-install and sanitized-legacy upgrade tests pass.
- [ ] Clerk signup, login, logout, session rejection, provisioning, and webhook redelivery pass against a real Clerk application.
- [x] Cross-tenant, project, key, admin, wallet, and provider credential authorization tests pass in isolated API regression coverage.
- [x] Production startup does not seed fake models, customer prices, or provider availability when local test mode is disabled.
- [ ] Repeat authorization and limiter verification against PostgreSQL, Redis, and a real Clerk application.
- [ ] Dynamic LiteLLM/direct-provider catalog sync and stale-data behavior pass with a real staging provider.
- [ ] Live provider streamed inference starts before upstream completion and handles cancellation.
- [ ] Usage and wallet settlement are truthful and exactly-once under errors and concurrency.
- [ ] Razorpay sandbox order, verified webhook, duplicate event, refund, and reconciliation tests pass.
- [x] Production dependency audit has no unresolved high or critical findings (`npm audit --omit=dev`).
- [ ] Secret Manager, backups, migrations, alerts, logs, DNS, TLS, rollback, and restore drills pass.
- [ ] Browser workflows, project tagging, live catalog state, and accessibility checks pass.
- [ ] SMTP delivery, invitation/OTP receipt, retry behavior, and sending-domain deliverability pass in staging.
- [ ] Owner signs off on live money movement and production deployment.
- [x] M9 local governance APIs, migration, UI build, and 96-test regression evidence.
- [x] Non-destructive staging smoke harness with opt-in real streaming measurement.
- [ ] M9 live Clerk MFA/bootstrap/session-revocation and high-risk reauthentication verification.
- [ ] Refresh the owner-controlled gcloud authentication, then perform read-only project/resource checks before any staging plan or deployment approval.

## Current external prerequisites

Clerk account and app; LiteLLM/direct-provider staging credentials; Razorpay test credentials; GCP project and IAM; domain/DNS; sanitized database backup; commercial and tax decisions. OpenRouter is optional and is not a release prerequisite.

## Neon staging database update - 2026-10-09

- Root `.env` contains owner-supplied Neon staging values and remains ignored/untracked; credentials were not exposed.
- `python infra/verify_neon_staging.py`: PASS for pooled/direct connectivity, TLS, Alembic state, and empty protected customer/financial tables.
- `python -m alembic upgrade head` from `apps/api`: PASS through `a1b2c3d4e5f6`.
- The schema-repair migration moved only the known 44 Compass application tables from `public` to `compass`; no extra public tables were present.
- Database readiness is now READY for isolated staging database checks. This does not authorize Cloud Run deployment or change the overall release status.
## M10 Redis staging update - 2026-10-09

- Redis client integration is READY for staging configuration: pooled `redis-py`, authenticated `rediss://`, bounded timeouts/retries, and atomic Lua rate limiting.
- Cloud Run API templates already source `REDIS_URL` from Secret Manager and do not expose it to the web service.
- Offline Redis tests and live Upstash authenticated TLS verification pass for the required commands.
- Overall release status remains NOT READY; Redis outage behavior, Clerk, provider, SMTP, Razorpay, GCP, and deployment gates remain open.
- Neon regression rerun after the M10 code changes passes; no migration or financial operation was attempted.

## M11 Clerk staging update - 2026-10-09

- Clerk web route protection, Clerk-based admin sign-in selection, server-side session-token verification, verified-email mapping, owner-bootstrap boundaries, and webhook ledger handling are code-complete and locally tested.
- The root local configuration is not sufficient for live verification: owner identity is empty and the webhook signing secret is a placeholder.
- Staging is not deployment-ready for human authentication until the Clerk instance, origins/redirects, webhook, MFA policy, owner identity, Secret Manager references, and Cloud Run service are verified.
- No Cloud Run deployment, secret write, production change, or live payment was performed.

## Local Clerk login fix - 2026-10-09

- The web app now loads the root ignored environment during Next startup, so configured Clerk is selected instead of the legacy login fallback.
- Local `/login` and `/signup` route checks pass after restart, and frontend lint/typecheck pass.
- Live Clerk sign-in, session persistence, logout, MFA, webhook, and Cloud Run verification remain outstanding.

## Clerk local runtime correction - 2026-10-10

- Local web startup now uses the project-local ignored environment required by Clerk edge middleware; server-only `CLERK_SECRET_KEY` is not exposed as a public variable.
- Auth route selection defaults to Clerk, with legacy forms available only through explicit `LEGACY_AUTH_MODE=true`.
- Route-level HTTP checks pass for login, signup, and admin-login. This is not a substitute for live identity-provider authentication evidence.
## M13 readiness - 2026-10-11

- Local API, model compilation, Alembic migration, and regression validation passed.
- New assignment tables require the M13 Alembic head `h2i3j4k5l6m7` in staging; production migration has not been run.
- Managed Clerk-authenticated inference, live provider calls, PostgreSQL/Redis runtime, extension flow, and Cloud Run verification remain pending external staging validation.
- No production service, database, secret, wallet, or payment resource was changed.

## M15 readiness - 2026-10-11

## M15 + M13.1 readiness - 2026-10-11

- Member inference code is locally validated but not staging-verified with real Clerk sessions or provider inference.
- Do not apply the M15 migration until Neon staging identity and protected-table contents are reviewed.
- Scheduler OIDC template is prepared; no service account, IAM binding, Secret Manager value, or Cloud Scheduler job was created.
- Backend, web, extension, and Cloud Run template validation are locally green; live Clerk/member inference and provider inference are still external gates.

- Local FX adapter, validation, quote history, cache, and fail-closed code is present.
- Apply migration `j4k5l6m7n8o9_add_fx_quotes_and_request_snapshots.py` only to an isolated staging database after review.
- Configure `FX_REFRESH_JOB_SECRET` in Secret Manager and schedule the internal refresh target before production managed billing.
- Live endpoint, Neon, Upstash, Cloud Scheduler, and commercial-use verification remain external gates.
- No deployment, paid resource creation, production database, financial record, or secret change was performed.

## M14 readiness - 2026-10-11

- New migration `i3j4k5l6m7n8_add_m14_clerk_and_pricing_fields.py` is local-only and must be applied to an isolated staging database before deployment.
- Clerk invitation delivery remains disabled by default until the Clerk instance and redirect URL are verified.
- Production billing is not ready until an approved FX source replaces the fixed local fallback and its freshness/alerting behavior is tested.
- No production service, database, secret, wallet, payment, or Cloud Run resource was changed.

## M16 isolated staging and security readiness - 2026-10-11

- **NOT READY.** The configured Neon target is reachable but the read-only verifier found protected customer/financial rows; authoritative branch identity is still unproven.
- Migration `j4k5l6m7n8o9` remains unapplied. No database write or destructive cleanup was attempted.
- Local source verification is green: 127 backend tests, web lint/typecheck/build, extension check/test/build, Cloud Run templates, Scheduler template, and diff check.
- Production human authentication now rejects legacy password sessions and requires Clerk before protected organization/platform administration.
- Secret rotation, isolated Neon provisioning, live Clerk/provider/Redis/Razorpay tests, Secret Manager, Cloud Scheduler, Cloud Run, and browser verification remain release gates.

## M17 extension release readiness - 2026-10-11

- Compass Router VSIX `0.1.0` is locally built, audited, and installable.
- Extension package readiness does not imply backend staging readiness: Neon isolation, Clerk live verification, provider inference, and Cloud Run remain blocked as documented in M16.
- Marketplace publication remains blocked until publisher identity, legal URLs, live integration evidence, and owner approval are complete.
