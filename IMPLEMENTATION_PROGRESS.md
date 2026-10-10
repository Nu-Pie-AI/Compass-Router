# Compass Router Production Implementation Progress

## Safe staging branch preflight - 2026-10-09

Status: PREPARED LOCALLY; GCP RESOURCE CREATION AND DEPLOYMENT PENDING OWNER APPROVAL

- Created local branch `staging/safe-deployment-2026-10-09` from the existing target checkout.
- Preserved all existing uncommitted production work; no source repository or VS Code extension changes were made.
- Added build-only Cloud Build configuration at `infra/gcp/cloudbuild-staging-images.yaml`.
- Added staging deployment runbook at `infra/gcp/STAGING_DEPLOYMENT_PLAN.md`.
- Added the Clerk publishable-key build argument to the web image so staging Clerk configuration is not silently omitted at Next.js build time.
- Focused verification: 13 backend/infrastructure tests passed; web lint, production build, and typecheck passed; `npm audit --omit=dev` found 0 vulnerabilities; Cloud Run template validation passed; `git diff --check` passed.
- No Cloud Build, Cloud Run, database, Redis, Secret Manager, payment, or production service mutation was performed.

## Neon staging database integration - 2026-10-09

Status: CODE AND TEMPLATE PREPARATION COMPLETE; CONNECTIVITY AND DATA-SAFETY VERIFICATION PENDING CREDENTIALS

- Runtime uses pooled `DATABASE_URL`; Alembic uses `DIRECT_DATABASE_URL` when configured.
- PostgreSQL URLs normalize to the installed `psycopg` driver and preserve `sslmode=require` while removing unsupported pooler query options.
- Added the Neon-backed staging Cloud Run template without a Cloud SQL dependency.
- Existing Cloud SQL-backed production template remains unchanged except for the optional direct migration secret reference.
- No Neon URL was read, printed, stored, or committed.
- Added `infra/verify_neon_staging.py`, a read-only verifier that requires both Neon URLs, enforces TLS and pooled/direct endpoint separation, checks Alembic state, and rejects populated protected customer/financial tables.

## Root environment setup - 2026-10-09

Status: `.env` CREATED WITH SAFE PLACEHOLDERS; NEON VERIFICATION BLOCKED

- Created the ignored root `.env` from `.env.example` because it did not exist.
- Removed credential-looking Clerk and Neon values from `.env.example` and `.env`.
- Confirmed `.env` is ignored and untracked.
- Confirmed root `.env` loads when running from the repository root or `apps/api`, while explicit process environment variables take precedence.
- No Neon credential was available, so `DATABASE_URL` and `DIRECT_DATABASE_URL` remain clearly labeled placeholders.

Master specification: COMPASS_ROUTER_PRODUCTION_MASTER_PLAN.md plus the revised M4-M8 instructions supplied by the owner on 2026-10-09
Working copy: C:/Users/tohee/Desktop/Compass-Router-Production
Source repository: C:/Users/tohee/Desktop/Compass-Litellm-Router
Scope exclusion: compass-code and VS Code extension implementation

## Customer credits and BYOK audit - 2026-10-10

Status: PARTIALLY IMPLEMENTED; payment, UI management, and provider analytics work remains

- Audited the attached customer Credits, BYOK, members, authentication, extension, Razorpay, terminology, and analytics requirements against the existing API and web modules.
- BYOK chat, JSON, streaming, binary, and multipart routes now avoid Compass Credit reservation/settlement and do not fall back from a BYOK route to a managed credential route.
- BYOK requests continue to record provider, model, project, member, credential mode, usage, and provider-cost metadata where available.
- Signup promotion support now reads the existing Super Admin `trial_credit_paise` platform setting and creates one idempotent `signup_promotion` ledger entry per newly created user. The default remains zero when unset.
- Added organization role updates, project member list/assign/remove operations, and team member removal with member-scoped API-key revocation. Owner roles remain protected.
- Added organization invitation listing, resend with token rotation, cancellation, and audit records; the web access manager exposes pending-invitation controls.
- Added VS Code workspace project selection through `compassCode.chooseProject`; requests send `X-Compass-Project-Id`, and the API verifies that the key's user has access to the selected project.
- Added managed-versus-BYOK fields to request usage responses and workspace activity filtering, including provider upstream cost versus Compass Credits charged.
- Added a platform-permission-gated `/admin/analytics/providers` aggregation endpoint grouped by provider, model, organization, project, and credential mode with separate upstream cost, customer charge, tokens, and failures.
- Renamed the main customer and Super Admin billing labels from Wallet to Credits while retaining internal wallet tables and routes for compatibility.
- Added a visible VS Code project scope indicator and project selector; the extension persists the authorized default `Others` project when no workspace selection exists and warns when no project is available.
- Extended the API-key creation UI to select a project, assign an active team member, and set an optional expiry; the existing server-side model-policy and revocation controls remain in place.
- Focused validation: Python compile check passed; provider adapter/catalog tests passed (11 tests); infrastructure/staging tests passed (7 tests); API focused regressions passed (5 tests); web typecheck passed; VS Code extension build and tests passed (10 tests).
- Full API test execution did not complete in the current environment; no result is claimed for that suite.
- Remaining product work includes visible project-tag status/warning UI, setup email templates, provider-level analytics presentation, Credits terminology cleanup, promotional expiration policy, and Razorpay sandbox verification.

## Milestone M0 - Baseline, verification, and isolation

Status: VERIFIED for source isolation and baseline checks; live integrations pending

Baseline commit:
- Source and target commit: 9d34810294775aaef2ff210b00941fffd3d2fa0a
- Target branch: feat/production-clerk-router
- Target restore tag: compass-production-baseline-m0

Change summary:
- Created a local Git clone in the new production folder.
- Deliberately overlaid 21 reviewed non-secret application and audit files from the source worktree.
- Copied the master specification into the target.
- Excluded extension changes, nested snapshots, generated VSIX/media, environment files, local databases, node_modules, build output, and caches.
- Fixed three copied Router web lint blockers in the target only.

Files changed in target:
- Existing uncommitted Router/API/web changes and audit reports were overlaid intentionally.
- apps/web/app/extension/authorize/page.tsx
- apps/web/components/OrganizationAccessManager.tsx
- apps/web/app/login/page.tsx
- apps/web/components/CompassConsole.tsx
- Required implementation and readiness documents.

Routes, schemas, and migrations affected:
- No production schema migration has been added yet.
- No Clerk route or provider integration has been implemented yet.

Tests executed:
- API: 49 passed in 106.76 seconds.
- Router web typecheck: passed.
- Router web lint: passed with two existing navigation warnings.
- Router web production build: passed.
- Marketplace TypeScript check: passed.
- Marketplace production build: passed.
- Docker Compose config validation: passed.
- Historical M0 Router web production dependency audit: 1 critical and 2 high findings remained at baseline; superseded by the current dependency verification below.

Manual and live verification:
- Source status before and after copy matched exactly.
- Target history and baseline tag verified.
- No external Clerk, OpenRouter, Razorpay, PostgreSQL, Redis, or Cloud Run live flow was exercised.
- No source file in compass-code was modified in the target.

Security, privacy, and financial implications:
- No secrets were copied or printed.
- Current code still contains development-oriented authentication, schema bootstrap, provider, and payment paths that must be hardened.
- The target is not production-ready.

The M0 section below records the initial snapshot; current M4-M8 verification and blockers are recorded in the later milestone sections and the release documents.

External dependencies still needed:
- Clerk development and production applications and webhook configuration.
- Approved staging provider credentials and commercial approval; OpenRouter is optional.
- Razorpay test credentials, webhook secret, and later live approval.
- Isolated PostgreSQL and Redis services.
- GCP project, IAM, Secret Manager, DNS, and Cloud Run access.
- Sanitized legacy database backup for migration verification.

Known defects and risks:
- API startup still uses create_all and additive DDL repairs.
- Live Clerk login is not yet verified; the code path is implemented and the explicit local fallback remains for migration.
- M4-M8 later sections supersede the initial streaming, catalog, email, dependency, and lint snapshots below.

Rollback:
- Do not alter the source repository.
- In the target, return to tag compass-production-baseline-m0 or branch commit 9d34810294775aaef2ff210b00941fffd3d2fa0a.

Next milestone:
- M1: add controlled Alembic migrations and Clerk identity mapping schema without changing Compass user IDs.

## Milestone M1 - Versioned database migrations

Status: CODE COMPLETE on SQLite; PostgreSQL migration verification BLOCKED by unavailable Docker engine

Baseline commit:
- 9d34810294775aaef2ff210b00941fffd3d2fa0a

Change summary:
- Added Alembic configuration, environment integration, revision template, and migration command.
- Added an initial revision matching the current SQLAlchemy schema.
- Added a second revision adding nullable unique User.clerk_user_id and its index.
- Added DATABASE_MIGRATION_MODE with explicit legacy development mode and production validation requiring alembic mode.
- Kept the legacy create_all and additive repair path only for explicit non-production legacy mode.
- Included migration files in the API container image and added migration mode to Compose configuration.
- Added fresh, downgrade/re-upgrade, and populated pre-Clerk schema migration tests.

Files changed:
- apps/api/alembic.ini
- apps/api/alembic/env.py
- apps/api/alembic/script.py.mako
- apps/api/alembic/versions/98a7ef85ff78_initial_current_schema.py
- apps/api/alembic/versions/91635f9f8736_add_clerk_identity_mapping.py
- apps/api/app/migrate.py
- apps/api/app/config.py
- apps/api/app/db.py
- apps/api/app/models.py
- apps/api/requirements.txt
- apps/api/Dockerfile
- docker-compose.yml
- infra/docker/docker-compose.yml
- tests/test_migrations.py

Routes, schemas, and migrations affected:
- No HTTP route contract changed.
- User.clerk_user_id is nullable and does not replace User.id.
- Alembic head at the end of M1 was 91635f9f8736; M2 adds revision a3b7c9d1e2f4 for Clerk webhook events.

Tests executed and actual results:
- Migration tests: 2 passed in 14.36 seconds.
- Full API suite after M1 changes: 51 passed in 101.33 seconds.
- python -m app.migrate from repository root against fresh SQLite: passed.
- alembic check after upgrade: no new upgrade operations detected.
- Docker Compose syntax was previously validated, but Docker runtime was unavailable.

Manual/live verification performed:
- SQLite fresh install and populated pre-Clerk upgrade verified.
- PostgreSQL generation and upgrade not verified because Docker Desktop Linux engine is unavailable.
- No existing customer database was opened or changed.

Security/privacy/financial implications:
- Production startup rejects legacy schema bootstrap unless DATABASE_MIGRATION_MODE=alembic.
- Migration ordering and rollback remain unverified on PostgreSQL.
- No financial tables were dropped or rewritten.

External dependencies or secrets still needed:
- Isolated PostgreSQL service or working Docker engine for schema and legacy upgrade verification.
- Sanitized populated PostgreSQL backup for real adoption testing.

Known defects or risks:
- Existing legacy database adoption still needs an explicit schema inspection and controlled stamp/backfill procedure.
- Alembic initial revision was generated against SQLite because PostgreSQL was unavailable; PostgreSQL search_path behavior must be verified before production use.

Rollback procedure:
- Revert target files to compass-production-baseline-m0 or restore the M1 files from Git before deployment.
- Do not downgrade a production database without a reviewed backup and migration rollback plan.

Next milestone:
- M2: Clerk web/API authentication, identity provisioning, verified legacy linking, and webhook handling.

## Milestone M2 - Clerk identity and web session integration

Status: CODE COMPLETE for isolated, mocked-provider verification; live Clerk verification BLOCKED by external credentials

Change summary:
- Added Clerk Backend API verification with authorized-party and optional audience controls.
- Added Clerk-aware FastAPI session resolution without changing Compass User IDs or accepting Clerk tokens for `/v1` inference.
- Added idempotent Clerk bootstrap provisioning. Existing Compass accounts are not silently claimed by matching email.
- Added Clerk user lifecycle webhook handling with Svix signature verification and a unique event ledger for redelivery deduplication.
- Added Clerk Next.js provider, Next 16 proxy integration, Clerk sign-in/sign-up surfaces, in-memory token bridge, and explicit Clerk sign-out.
- Kept local/legacy auth pages available when no Clerk publishable key is configured for development migration support.
- Added a migration for `clerk_webhook_events` and focused auth/webhook regression tests.

Routes and security boundary:
- `POST /auth/clerk/bootstrap` verifies a Clerk session and creates or retrieves the Compass tenant record.
- `POST /webhooks/clerk` verifies raw Svix headers, handles lifecycle events, and deduplicates `svix-id` deliveries.
- Existing password/OTP auth remains available only as a migration fallback when Clerk is not configured.
- Existing `/v1/*` routes remain Compass API-key authenticated; Clerk is not an inference credential.

Tests executed:
- Clerk-focused API tests: 4 passed in 5.71 seconds.
- Full API suite: 55 passed in 108.33 seconds.
- Migration tests: 2 passed in 14.89 seconds.
- Router web typecheck: passed.
- Router web lint: passed with 2 existing navigation warnings.
- Router web production build: passed; Next 16.3.4 generated the proxy route.

External verification still required:
- Clerk development and production applications, real publishable/secret keys, authorized parties, and webhook signing secret.
- Live browser sign-up/sign-in/sign-out, session expiry, JWKS/key rotation, and real webhook delivery/redelivery.
- PostgreSQL migration execution against the target schema and a sanitized populated backup.

Next milestone:
- M3: route-by-route authorization hardening and authorization matrix coverage.

## Milestone M3 - Authorization and API key security

Status: CODE COMPLETE for isolated SQLite verification; PostgreSQL/Redis production verification remains externally blocked

Implemented:
- Added centralized authorization dependencies for active organization, project, team, team-owner, and administrative access.
- Bound legacy email-only team memberships to active users and active organizations; removed members no longer retain stale team/project access.
- Scoped organization-member removal to the target organization. Users who belong to another organization retain that tenant and session access; extension sessions are revoked only for the removed organization unless the user has no remaining organization membership.
- Enforced API-key organization, team, project-header, expiration, revocation, and model-allowlist boundaries.
- Allowed customer organization/team owners to create, view, revoke, and update team keys while denying those controls to ordinary members.
- Restricted BYOK credential listing and mutation to team owners/administrators.
- Enforced estimated cost against team daily/monthly spend limits and made production Redis rate limiting fail closed when the distributed limiter is unavailable.
- Kept `/v1/*` inference API-key authenticated and recorded the effective project context on usage records.
- Added atomic API-key rotation that preserves scope and limits, revokes the old secret, returns the replacement secret once, and records an audit event. Key creation and model assignment now share production commercial/fresh-catalog gates.

Tests executed:
- Focused M3 authorization tests: 4 passed.
- API-key rotation and production model-assignment gate tests: PASS.
- Full API suite: 57 passed in 88.25 seconds.
- Python compile check: passed.
- Git whitespace check: passed.

M3 external verification still required:
- PostgreSQL authorization queries and transaction behavior against an isolated PostgreSQL instance.
- Redis-backed rate-limit behavior and concurrency under staging load.
- Live Clerk tenant/session authorization with real credentials.

Remaining M3 hardening:
- PostgreSQL/Redis/live Clerk verification remains external; rotation behavior is covered in isolated API tests.

Next milestone:
- M4: provider-neutral model catalog and synchronization.

## Historical M4 transition report - implementation paused for redesign

Date: 2026-10-09

Status at the time of this report: PAUSED at the owner's request. The OpenRouter-specific M4 implementation was incomplete and was not treated as production-ready. No M5 work had started.

Scope and preservation:
- All existing M0-M3 functionality and uncommitted changes remain in place.
- No implementation files were reverted, deleted, or overwritten during this transition.
- The original Compass-Litellm-Router repository and the VS Code extension were not modified.

M4 changes identified in the target worktree:
- Modified `.env.example`, `apps/api/app/config.py`, `apps/api/app/main.py`, `apps/api/app/models.py`, `apps/api/app/schemas.py`, and `apps/api/app/services.py`.
- Added `apps/api/alembic/versions/b4c8d2e6f901_add_openrouter_catalog.py`.

Classification of the interrupted M4 work:

Reusable provider-independent work to preserve:
- Additive model-catalog metadata for raw source data, source timestamps, sync timestamps, route readiness, and source pricing.
- Catalog sync-run persistence for status, revision/etag, snapshots, stale state, errors, and timestamps.
- Versioned pricing-policy persistence, customer-price conversion, and administrative policy endpoints.
- Catalog response shaping and filtering seams for provider, capability, context, availability, policy, and route readiness.
- The retry, cache, stale-catalog, last-known-good, and provider-adapter boundaries as reusable design material, subject to redesign and verification.

OpenRouter-specific work to isolate or redesign:
- OpenRouter environment settings and production configuration requirements.
- OpenRouter HTTP fetch, response normalization, capability extraction, source naming, and pricing field mapping.
- OpenRouter-specific sync/status routes and the OpenRouter provider bootstrap behavior.
- OpenRouter-specific activation behavior in the catalog model path.

Unrelated M4 changes:
- None identified. Other dirty files in the worktree belong to the previously completed M0-M3 work or project documentation.

Verification state:
- Git status and the M4 symbols/files were inspected.
- No M4 runtime, migration, or live-provider verification was run after the interrupted edits.
- Existing M3 verification remains the latest completed implementation evidence recorded above.

## M4 - Provider-neutral model registry and synchronization

Status: CODE COMPLETE for the provider-neutral slice; live provider and production infrastructure verification pending

Implemented in the production copy:
- Added provider-neutral catalog contracts, stable provider/model identity, capability types, modalities, context limits, source metadata, and route-readiness reasons.
- Added a typed, registry-backed `ProviderAdapter` boundary for credential validation, model discovery separation, route readiness, health, invocation, response/usage/error normalization, and provider pricing-source metadata.
- Route activation and resolution now fail closed when the registered adapter cannot execute the model capability; unspecified inference requests default to `chat_completion`, so reserved decision-only models cannot enter chat routing.
- Made LiteLLM the default catalog source for supported providers and kept OpenRouter as an optional isolated source.
- Added LiteLLM catalog synchronization with source revisions, cache freshness, failure recording, last-known-good behavior, disabled-by-default discovery, and retirement of missing records.
- Reused versioned pricing policy conversion without hardcoding customer prices or claiming discovered models are available before activation and credentials.
- Added `python -m app.catalog_sync --provider litellm|openrouter` for a future Cloud Scheduler or Cloud Run Job invocation. Synchronization never activates models.
- Unknown provider names are marked `unverified` until an approved adapter exists.
- Canonical capability matching now uses `capability_types` with legacy-label fallback, including the existing batch contract over compatible chat/response/embedding models.
- Optional OpenRouter snapshots now persist their explicit protocol, modalities, and capability types instead of inheriting LiteLLM defaults.
- Canonicalized the optional OpenRouter protocol to `openrouter_optional` per the revised contract while retaining the legacy `optional_openrouter` adapter alias for existing rows.
- Extended the runtime adapter facade with explicit capability mappings for embeddings, images, batches, speech, and transcription; audio uses binary/multipart methods and decision execution remains reserved until an approved contract exists.
- Preserved explicit empty capability metadata and blocked activation of provider-catalog records with no verified Compass capability; provider-health timestamps are monotonic within a transaction so circuit state ordering is deterministic under rapid failures.
- Media settlement now records `usage_source=provider` only when transcription returns upstream usage; audio speech and usage-less media responses are explicitly marked `estimate`, while failed media attempts are marked `none`.
- Wallet settlement now attributes `provider_cost_paise` from stored provider USD source rates and keeps `compass_cost_paise` on the versioned customer-rate fields, so markup is not misreported as provider cost.
- Provider catalog source status reflects configured/enabled state, and production routing/activation rejects models without current provider pricing and an active pricing policy.
- Production routing, implicit model grants, explicit key-model assignment, public catalog output, and team policy rows require a recent verified LiteLLM/OpenRouter snapshot; stale rows are non-routable.
- Added `infra/verify_staging.py`, a non-destructive staging harness for health, authenticated model visibility, and explicitly authorized real streaming first-byte checks. It never fabricates inference or prints API keys.
- Added the production web `start` script using the Next standalone server entrypoint, matching `output: standalone`; built-route smoke checks returned HTTP 200 for `/`, `/admin`, `/login`, `/signup`, `/models`, and `/playground`.

Files added or changed for this M4 slice:
- `apps/api/app/catalog.py`
- `apps/api/app/provider_adapters.py`
- `apps/api/app/catalog_sync.py`
- `apps/api/app/models.py`
- `apps/api/app/services.py`
- `apps/api/app/main.py`
- `apps/api/app/config.py`
- `apps/api/alembic/versions/c5d7e9f0a123_provider_neutral_catalog.py`
- `tests/test_catalog.py`
- `tests/test_migrations.py`
- `tests/test_provider_adapters.py`

Verification executed:
- `python -m pytest -q tests/test_catalog.py tests/test_migrations.py`: PASS, 8 passed.
- Full regression after the current M4-M6 changes: PASS, 96 passed in the final run.
- Runtime adapter contract checks: PASS, including canonical and legacy optional OpenRouter protocol resolution, image/batch readiness, audio binary/multipart delegation, unknown-protocol fail-closed behavior, and alternate usage normalization.
- `git diff --check`: PASS.
- Production startup seeding test: PASS; `LOCAL_TEST_MODE=false` creates no fixture models, provider credentials, or implicit pricing policy.
- ORM defaults now make new providers unconfigured/disabled and new model rows unavailable/unpublished until verified synchronization and activation.
- Unpriced model rows default to zero; customer prices are populated only from provider-published costs and an active pricing policy.

M4 verification still required:
- Run Alembic against isolated PostgreSQL and verify a sanitized populated upgrade.
- Exercise a real LiteLLM/provider catalog and route with approved staging credentials.
- Verify provider credential health, route readiness, usage accounting, and wallet settlement in staging.

M4 release state:
- The implementation is ready for isolated integration, but not for production activation until live discovery, PostgreSQL migration, credential health, and route-readiness evidence are recorded.
- Production startup no longer creates hardcoded model IDs, local prices, or healthy provider routes; those values are restricted to explicit local test mode.

## M5 - Genuine streaming foundation

Status: CODE COMPLETE for the isolated streaming slice; live provider streaming still pending

Implemented:
- Added incremental SSE consumption for LiteLLM proxy and OpenAI-compatible direct routes.
- Production `/v1/chat/completions` and `/v1/responses` streaming now forward upstream SSE lines as they arrive instead of converting a completed response into fabricated chunks.
- Preserved the deterministic buffered local-test path strictly for local tests.
- Added provider-attempt health/error recording, bounded pre-first-chunk retry behavior, client-disconnect handling, wallet reservation release/settlement, and explicit `usage_source` (`provider`, `estimate`, or `none`).
- Routed `/v1/audio/speech` and `/v1/audio/transcriptions` through their canonical `audio_speech` and `audio_transcription` capability types instead of a shared generic audio label.
- Added migration `apps/api/alembic/versions/d6e8f1a0b234_stream_usage_source.py`.

Verification:
- Production chat and Responses streaming regression tests forward upstream chunks/events and record provider usage.
- Focused streaming/migration/catalog checks: PASS, 14 passed.
- A production stale-catalog regression confirms that an expired discovery snapshot is rejected before provider execution.

Remaining M5 work:
- Live provider streaming/cancellation/backpressure verification.
- Responses tool-call event integration and provider-specific capability tests.
- PostgreSQL/Redis staging verification and live-provider verification.

M5 release state:
- The production code path consumes upstream SSE and records provider usage when a live adapter is configured. Local test mode remains explicitly isolated and is not release evidence.

## M6 - Wallet, payment, and recovery hardening

Status: CODE COMPLETE for isolated wallet/payment behavior and recovery preview/apply; Razorpay sandbox and concurrent PostgreSQL verification remain externally blocked

Implemented or preserved:
- Existing immutable wallet ledger, reservation, settlement, top-up, refund, Razorpay signature verification, webhook deduplication, invoice, and reconciliation flows remain in place.
- Fixed reservation-release idempotency so repeated zero-cost settlement/recovery cannot double-credit the wallet.
- Added `apps/api/app/recovery.py` with preview-first stale inference reservation recovery. Applying it only releases abandoned inference reservations and never contacts or credits a payment provider.
- Added an operator entry point: `python -m app.recovery --task recover-reservations`; `--apply` is explicit.
- Added explicit provider `commercial_status` governance with an Alembic migration. Production model publication and route resolution now require `approved`; unreviewed or rejected providers remain visible only as non-routable admin/catalog state.

Verification:
- Stale reservation preview, apply, and repeated apply: PASS.
- Existing wallet, payment webhook, refund, and reconciliation tests remain covered by the API suite.
- Commercial approval gate and migration preservation test: PASS.

M6 external gates:
- Razorpay test credentials and sandbox confirmation are required for live payment/order/refund verification.
- PostgreSQL row locking, concurrency, backup/restore, and real webhook delivery remain unverified.
- No live payment, customer balance mutation, or production deployment was performed.

## M7 - Customer/admin workflows and playground surfaces

Status: CODE COMPLETE for the existing web workflow slice; real browser, live-provider, and accessibility evidence remain pending

Implemented or preserved:
- Customer routes cover workspaces, teams, members, API keys, models, BYOK, wallet, usage/activity, extension authorization, and profile/session flows.
- Admin routes expose tenant/user/team lifecycle, provider controls, model lifecycle, routing policies, readiness, audit, metrics, billing reconciliation, and operational events.
- Model and catalog surfaces consume API data and expose truthful unavailable or stale states instead of inventing live availability.
- Admin provider controls now show and update technical health separately from commercial approval; production route readiness reflects both gates.
- The existing playground sends only through the authenticated Compass API and displays response, usage, cost, latency, request ID, and status returned by the server.
- Project/team context is selected through authorized API data; extension authorization requires an explicit project and team selection.
- Transactional invitations and OTP messages are persisted to the email outbox; `python -m app.email_worker` claims bounded batches, sends through configured SMTP, retries only within the configured attempt limit, and records `sent` or transport `failed` state.
- Jev remains deferred and no unverified decision UI or route has been activated.

Verification:
- `npm.cmd run typecheck` in `apps/web`: PASS.
- `npm.cmd run lint` in `apps/web`: PASS with no warnings after replacing internal logout redirects with `useRouter().push()`.
- `npm.cmd run build` in `apps/web`: PASS; 23 routes generated.
- `python -m pytest -q tests/test_api.py -k email_outbox_worker`: PASS; SMTP success and transport failure states are recorded.

M7 external gates:
- Browser tests against Clerk sessions, real API responses, project scope, keyboard navigation, and accessibility remain to be run.
- Live provider-backed playground behavior is blocked by staging credentials and infrastructure.

## M8 - Cloud operations and release preparation

Status: IMPLEMENTATION PREPARED; deployment and infrastructure verification require owner-controlled GCP access

Implemented:
- API and web Dockerfiles run as non-root users.
- Verification-only Cloud Build configuration validates deployment templates, then runs API tests, web checks, and image builds without deploying.
- Cloud Run service templates reference Secret Manager values and Cloud SQL without embedding credentials, include Redis/LiteLLM runtime settings, and require deployment-owned secret version placeholders instead of implicit `latest` values.
- API Cloud Run template validation now requires production-safe runtime values, self-service signup, SMTP delivery, Razorpay billing, proxy execution, and Secret Manager references for SSO, admin, and SMTP credentials.
- GCP runbook documents migration, catalog sync, recovery preview/apply, deployment order, and rollback constraints.
- Catalog sync and stale-reservation recovery have explicit operator entry points.
- Added `infra/gcp/validate_templates.py` to verify Cloud Run placeholders and server-side secret references without rendering or applying resources.
- Added `infra/gcp/build_release.py` for explicit clean-worktree BuildKit builds with commit tags, immutable digests, provenance, and SBOM attestations; it does not deploy Cloud Run.
- Added `apps/api/app/observability.py` for structured, redaction-safe request events with request IDs and an allow-listed JSON payload; monitoring ingestion remains external.

Verification:
- Docker engine check: BLOCKED because the local Docker Desktop Linux engine is unavailable.
- `python infra/gcp/validate_templates.py`: PASS for both Cloud Run templates.
- `python infra/gcp/build_release.py --help` and a valid placeholder-argument `--dry-run`: PASS; no registry push or deployment performed.
- `python -m pytest -q tests/test_infrastructure.py`: PASS, 4 focused infrastructure and structured logging tests.
- No Cloud Run deployment, Secret Manager write, database migration, DNS/TLS change, or production payment was performed.

M8 external gates:
- GCP project/IAM, Artifact Registry, Cloud SQL, Redis, Secret Manager, Cloud Build, domain/DNS, Cloud Logging/Monitoring, tracing, alerts, backup/restore, and rollback access remain required.
- A current read-only check found the configured gcloud account but resource queries fail with `Reauthentication failed` in non-interactive execution; no cloud mutation was attempted.
- Once staging access is restored, run `python infra/verify_staging.py --api-url ... --api-key ...` for non-destructive checks; add `--run-chat --allow-paid-request --model ...` only with explicit owner approval for a real inference request.

Dependency hardening:
- Upgraded Next.js to 16.4.0 and refreshed vulnerable production transitive dependencies.
- Current `npm.cmd audit --omit=dev --json`: PASS with zero production vulnerabilities.
- Development-only audit findings remain in the Tailwind 3 toolchain and would require a breaking Tailwind 4 migration; they do not affect the production dependency audit gate.

## M9 - Super Admin control center and platform governance

Status: IMPLEMENTED LOCALLY; LIVE VERIFICATION PENDING

Implemented:
- Added explicit platform roles and permission mapping for super admin, platform admin, finance admin, support admin, and read-only auditor, while preserving the legacy admin compatibility path for M0-M8.
- Added Clerk-bound, explicit-confirmation owner bootstrap with configurable MFA claim enforcement and terminal revocation behavior. Only the super-admin permission can grant subordinate platform roles; self-revocation is rejected.
- Added server-side governance APIs for access, roles, command-center aggregates, customer and organization metadata, projects, teams, API-key metadata, request metadata, settings, security events, wallet adjustments, ledger views, routing policy revisions, pricing revisions, and routing rollback.
- Added atomic, idempotent wallet adjustment handling with row locking, currency checks, balance safety, reason requirements, and audit events. API keys, provider credentials, prompts, and raw request content remain metadata-only in admin views.
- Added a dedicated `/admin` Router workspace with permission-aware navigation, command center, customer/org/project/team/key explorers, provider/model controls, wallet/reconciliation views, request logs, security/audit, role management, and platform settings.
- Added versioned Alembic tables for role assignments, bootstrap state, platform settings, pricing revisions, and routing policy revisions.
- Added M9 API regression tests and corrected the production configuration fixture for the new required owner boundary.

Verification:
- `python -m pytest -q`: PASS, 96 passed, 1 existing Pydantic deprecation warning.
- `python -m pytest -q tests/test_api.py -k "m9_" tests/test_migrations.py`: PASS, 7 M9 tests plus migration checks.
- `python -m compileall -q apps/api/app apps/api/alembic/versions tests`: PASS.
- `npm.cmd run lint` in `apps/web`: PASS with no warnings.
- `npm.cmd run typecheck` in `apps/web`: PASS.
- `npm.cmd run build` in `apps/web`: PASS; 23 routes generated, including `/admin`.
- `git diff --check`: PASS.

M9 external/live gates:
- Verify the real Clerk MFA claim contract, owner bootstrap, fresh-authentication expectations, role changes, session revocation, and webhook behavior in a staging browser environment.
- Verify all new queries, locks, indexes, migrations, and concurrency behavior against PostgreSQL and Redis; the local suite remains SQLite/isolated.
- Verify real provider/model state, SMTP delivery, Razorpay sandbox/reconciliation, GCP Secret Manager, Cloud Run, monitoring, backups, rollback, DNS/TLS, and production redaction review.
- No deployment, live payment, secret write, destructive migration, or original-repository/VS Code extension change was performed.

## Customer Credits follow-up - 2026-10-11

- Super Admin Operations now renders the provider analytics aggregation alongside request metadata, including provider/model, organization/project scope, managed versus BYOK, requests, tokens, provider cost, Compass Credits, and failures.
- The VS Code extension now reaches the existing browser/device authorization flow: it opens the verified Compass authorization page, polls the short-lived device code, stores the returned device session in VS Code SecretStorage, and preserves manual API-key connection for compatibility.
- Added organization-scoped provider analytics with date, provider, model, project, member/user, API-key, credential mode, token, upstream-cost, Compass-Credit, and failure dimensions. Organization owners/admins are scoped by server-side organization membership; regular members are denied.
- Completed the active customer-facing terminology sweep: Credits is used in dashboard, billing, team, marketing, pricing, and Super Admin copy; internal `wallet_*` persistence/API names and the compatibility route remain unchanged.
- Full backend API regression now passes locally: 81 tests passed with one existing Pydantic deprecation warning.
- Promotional credit expiration remains intentionally unimplemented: the current aggregate wallet cannot identify whether a later debit consumed promotional or purchased Credits. A future ledger design must model credit lots or equivalent allocation before expiration is enabled.

## Neon staging verification - 2026-10-09

Status: VERIFIED FOR DATABASE-ONLY STAGING CHECKS; DEPLOYMENT STILL BLOCKED

- Read-only Neon verification reached the configured pooled and direct endpoints with TLS enabled.
- The staging branch was initially uninitialized; Alembic applied revisions through `a1b2c3d4e5f6` successfully using `DIRECT_DATABASE_URL`.
- The initial migration had placed the 44 application tables in `public` while the runtime expects `compass`. Added a scoped forward migration that moves only the known Compass application tables into `compass`.
- Re-ran `python infra/verify_neon_staging.py`: PASS. Alembic state, pooled/direct routing, TLS, and empty protected customer/financial tables are verified.
- No production branch, production service, payment credential, wallet record, or deployment was changed.

## Organization administration hardening - 2026-10-11

- Organization owners and administrators can now manage API keys across every organization where they hold an owner/admin membership; ordinary members remain excluded.
- Organization provider analytics now aggregates only those owner/admin organizations, avoiding first-organization selection errors for multi-organization users.
- Customer API-key creation and revocation now write audit records with team, project, member, and expiry scope metadata.
- Focused authorization/audit tests and the full API suite pass; no production service, database, payment, or extension artifact was changed.
## M10 - Redis integration and staging verification - 2026-10-09

Status: LIVE STAGING REDIS VERIFICATION COMPLETE; CLOUD RUN DEPLOYMENT STILL BLOCKED

- Audited Redis usage: readiness `PING`, atomic team request/token rate limiting via Lua `EVAL`, `INCR`, `INCRBY`, and `EXPIRE`; no Redis wallet authority, Pub/Sub, streams, blocking queues, or session cache was found.
- Replaced raw unauthenticated RESP sockets with pooled `redis-py` clients that support `redis://` and `rediss://`, URL authentication, bounded timeouts, health checks, and bounded retries.
- Preserved production fail-closed behavior when distributed rate limiting is unavailable. Non-production database fallback remains unchanged.
- Cloud Run staging already references `REDIS_URL` through Secret Manager; no secret values were added to templates or images.
- Added offline Redis tests and a staging setup guide. Live Upstash checks passed for authenticated TLS, required commands, Lua EVAL, and concurrent atomic rate limiting using expiring isolated keys.
- The Neon read-only verifier passed again after Redis configuration cleanup.
- Redis outage behavior against a real fault, broader PostgreSQL wallet concurrency, and Cloud Run runtime verification remain open.

## M11 - Clerk authentication and Super Admin security - 2026-10-09

Status: CODE COMPLETE LOCALLY; LIVE CLERK VERIFICATION BLOCKED

- Audited the existing Clerk, Compass session, identity mapping, tenant authorization, owner bootstrap, role, MFA, webhook, and API-key boundaries.
- Added Clerk route protection for `/dashboard`, `/admin`, and `/extension/authorize` when configured.
- Admin login now uses Clerk SignIn when configured while preserving the legacy compatibility path when Clerk is absent.
- Backend Clerk verification remains official SDK based, accepts session tokens only, and applies audience and authorized-party checks.
- Internal provisioning now requires the selected Clerk primary email to be verified.
- Added focused Clerk security tests; the complete Python suite passed with 105 tests and one existing Pydantic deprecation warning.
- Web lint, typecheck, and production build passed.
- Real Clerk browser signup/login/logout, MFA claims, session revocation, webhook delivery, staging Secret Manager, and Cloud Run verification remain open external gates.
- No production service, production Clerk instance, production database, original repository, or VS Code extension was modified.
- Neon remains the financial authority; no wallet or database schema changes were made.

## Extension session logout hardening - 2026-10-11

- Added an authenticated device-session revoke endpoint for VS Code.
- Extension sign-out now attempts server-side device-session/API-key revocation before deleting the local SecretStorage token, while remaining usable during network failure.
- Added regression coverage proving a locally revoked device token cannot call the Router afterward; admin-wide session revocation remains compatible and idempotent.

## Membership audit coverage - 2026-10-11

- Added audit records for invitation creation and acceptance, organization member removal and role changes, project member assignment/removal, and team member removal.
- Extended the invitation acceptance/removal regression to verify the resulting audit history without exposing invitation or session secrets.

## Onboarding email guidance - 2026-10-11

- Expanded invitation and resend email templates with email OTP, Compass Router login, VS Code browser sign-in, project selection, authorized-key access, expiry, and support instructions.
- Templates explicitly state that API keys and provider credentials are never sent by email.

## Razorpay refund webhook coverage - 2026-10-11

- Added local signed-webhook coverage for `refund.processed`, duplicate delivery, refund ledger reversal, and processed refund status.
- No live Razorpay request or production financial balance was touched; sandbox credentials and approval remain external gates.

## Default project governance - 2026-10-11

- The server now restricts renaming the organization default `Others` project to organization owners/admins; ordinary project-admin memberships cannot change the fallback label.
- Added cross-role regression coverage for the denied member path and authorized owner path.

## Usage finality analytics - 2026-10-11

- Provider and organization analytics now group by recorded `usage_source` and expose `usage_finality` as finalized, estimated, or unavailable.
- Added regression coverage for the classification while keeping provider cost and Compass Credit charge fields separate.

## Extension session refresh - 2026-10-11

- Added device-session token rotation with a 30-day rolling expiry.
- Refresh invalidates the old token, updates the stored authorization token, and preserves the existing device/project/API-key scope.
- VS Code refresh now rotates device credentials before loading models/account data; logout and admin revocation remain compatible.
