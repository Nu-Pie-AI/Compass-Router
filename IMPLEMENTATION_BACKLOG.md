# Compass Router Production Implementation Backlog

Ordered according to the master plan.

## M0 - Complete with pending external verification

- [x] Create isolated production copy.
- [x] Preserve tracked history and create baseline tag.
- [x] Deliberately transfer relevant Router/API/web worktree changes.
- [x] Exclude extension changes, secrets, snapshots, and generated artifacts.
- [x] Run API, Router web, marketplace, and Compose baseline checks.
- [x] Create progress, decisions, blockers, tests, deployment, and threat documents.
- [ ] Resolve dependency audit findings in a dedicated security slice.
- [ ] Verify Alembic head and legacy adoption against isolated PostgreSQL when Docker or a test database is available.

## M1 - Versioned migrations

- [x] Add Alembic dependency and configuration.
- [x] Model an initial revision from the actual current SQLAlchemy metadata.
- [x] Add safe migration startup/deployment command.
- [x] Guard development-only create_all and legacy repairs.
- [x] Add nullable clerk_user_id mapping without changing User.id.
- [x] Add migration tests for empty and populated pre-Clerk schemas.
- [x] Document backup, expand, backfill, validation, and rollback requirements.
- [ ] Verify PostgreSQL schema, search_path, and sanitized legacy adoption.

## M2 - Clerk identity

- [x] Inspect current Next.js and FastAPI integration points.
- [x] Add current compatible Clerk Next.js package.
- [x] Add server-side Clerk provider/session protection.
- [x] Add FastAPI Clerk verification with authorized-party, audience, expiry, and signature checks delegated to the official verifier.
- [x] Add idempotent Compass account provisioning.
- [x] Reject silent legacy account linking by email.
- [x] Add signed Clerk webhook verification, lifecycle handling, and replay/delivery deduplication.
- [x] Keep Compass API keys independent for inference.
- [x] Add auth rejection, tenant mapping, and webhook tests.
- [ ] Live-verify Clerk browser and webhook flows with external credentials.

## M3 - Authorization hardening

- [x] Audit every organization, project, team, key, wallet, provider, and admin route.
- [x] Add deny-by-default resource dependencies.
- [x] Add atomic key rotation with old-secret revocation, scope preservation, one-time replacement secret, and audit event.
- [x] Add abuse, key, inference, and admin rate-limit enforcement or verified existing controls.
- [x] Add authorization matrix tests.
- [ ] Verify authorization behavior against PostgreSQL, Redis, and live Clerk credentials.

## M4 - Provider-neutral model registry and synchronization

- [x] Implement provider-neutral source snapshots, normalized catalog persistence, capability types, modalities, limits, and raw metadata.
- [x] Add LiteLLM synchronization with timeout, retry, cache freshness, stale state, last-known-good retention, and retirement handling.
- [x] Keep OpenRouter optional and isolated from startup and unrelated provider routes.
- [x] Normalize provider pricing separately from versioned Compass customer pricing.
- [x] Filter model visibility by account, key, policy, commercial approval, credential state, and route readiness.
- [x] Add registry, capability, migration, pricing, and stale-route tests.
- [x] Resolve LiteLLM and optional OpenRouter execution through an explicit adapter registry; unknown protocols fail closed and provider usage fields normalize through the shared boundary.
- [ ] Verify a real LiteLLM/provider catalog and PostgreSQL migration in staging.

## M5 - Capability routing and genuine streaming

- [x] Add provider-neutral capability-aware route selection and adapter contracts.
- [x] Forward genuine upstream SSE for supported chat and Responses routes.
- [x] Preserve provider events, usage, finish state, retries before first data, cancellation, and wallet reservation settlement.
- [x] Keep deterministic buffered responses limited to explicit local test mode.
- [x] Add first-data, usage, retry, commercial-gate, and stale-catalog regression coverage.
- [x] Add a non-destructive staging smoke harness with explicit opt-in for real paid streaming and first-byte measurement.
- [ ] Verify live provider first-byte timing, cancellation, backpressure, and provider-specific failures.

## M6 - Wallet, pricing, commercial controls, and Razorpay

- [x] Preserve immutable wallet ledger, reservations, settlement, release, refunds, invoices, and webhook deduplication.
- [x] Preserve raw-body Razorpay signature verification and add isolated payment/reconciliation coverage.
- [x] Add provider commercial approval as a separate route-publication gate.
- [x] Add preview-first stale reservation recovery with idempotent apply behavior.
- [x] Add SMTP outbox claim/retry/success/failure state handling without fake delivery.
- [ ] Run Razorpay sandbox, concurrent PostgreSQL accounting, and live SMTP delivery verification with owner-supplied credentials.

## M7 - Web customer/admin and playground workflows

- [x] Remove production claims based on seeded model, price, balance, or provider availability data.
- [x] Keep Clerk navigation, session bridge, server permission checks, tenant/project/team/key/model/wallet/usage workflows.
- [x] Expose provider technical health separately from commercial approval in admin controls.
- [x] Keep the authenticated playground bound to authorized project/team context and truthful unavailable states.
- [x] Pass Router web typecheck, lint, production build, and production dependency audit.
- [ ] Run Clerk-backed browser authorization, project scope, keyboard, accessibility, and live playground tests.

## M8 - Cloud and operations

- [x] Add non-root API/web images, verification Cloud Build, Cloud Run templates, pinned Secret Manager references, and operator runbooks.
- [x] Add catalog sync and reservation recovery operator entry points with safe preview/apply boundaries.
- [x] Keep provider, Clerk, database, Redis, Razorpay, and application secrets server-side and out of committed templates.
- [x] Add local Cloud Run template safety validation without rendering or applying deployment resources.
- [x] Add an explicit clean-worktree BuildKit release script with commit tags, immutable digests, provenance, and SBOM attestations; deployment remains separate.
- [x] Add structured redaction-safe request logs with request IDs and an allow-listed JSON event shape.
- [x] Add owner-controlled staging verification tooling for health, authenticated model visibility, and opt-in real streaming checks.
- [ ] Provision and verify Cloud Run, Cloud SQL, Redis, Secret Manager, Scheduler, logging, alerts, DNS/TLS, backup/restore, and rollback.
- [ ] Verify Cloud Logging/Monitoring ingestion, tracing correlation, alert delivery, and production redaction review in staging.
- [x] Add the immutable image/SBOM release path; staging execution and smoke tests remain external gates.
- [ ] Obtain owner sign-off before live money movement or production release.

## M9 - Super Admin control center and platform governance

- [x] Add explicit platform roles, least-privilege permissions, Clerk-bound owner bootstrap, MFA claim boundary, and subordinate role grant/revoke controls.
- [x] Add actual command-center aggregates and metadata-only customer, organization, project, team, API-key, request, security, and audit views.
- [x] Add pricing revision and routing policy revision history with explicit change reasons and routing rollback.
- [x] Add atomic/idempotent wallet adjustments, ledger views, reconciliation visibility, and no-plaintext-secret admin responses.
- [x] Add a dedicated permission-aware Router `/admin` control center and local migration/API/UI regression coverage.
- [ ] Verify Clerk MFA/session revocation/fresh authentication and owner bootstrap in a real staging browser flow.
- [ ] Verify PostgreSQL/Redis migrations, locks, indexes, pagination, and concurrency in staging.
- [ ] Verify admin accessibility, audit completeness, monitoring, and operational rollback before production approval.

