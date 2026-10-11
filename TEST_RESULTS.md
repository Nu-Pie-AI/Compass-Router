# Compass Router Production Test Results

## M0 baseline

Date: 2026-10-08
Environment: isolated copy at C:/Users/tohee/Desktop/Compass-Router-Production
Fresh dependency install: Router web and marketplace with npm ci
Source API dependencies: available Python environment

| Check | Command | Result |
|---|---|---|
| API tests | python -m pytest -q | PASS: 49 passed in 106.76s |
| Router web typecheck | npm.cmd run typecheck in apps/web | PASS |
| Router web lint | npm.cmd run lint in apps/web | PASS with 2 warnings |
| Router web build | npm.cmd run build in apps/web | PASS |
| Marketplace TypeScript | npx.cmd tsc --noEmit in marketplace | PASS |
| Marketplace build | npm.cmd run build in marketplace | PASS |
| Docker Compose syntax | docker compose -f infra/docker/docker-compose.yml config --quiet | PASS |
| Router web production audit | npm.cmd audit --omit=dev --json | FAIL gate: 1 critical and 2 high findings |

## Audit findings

The Router web audit identifies Next.js 16.3.4 below the available patched version range, plus transitive sharp and source-map-js findings. These must be reviewed and upgraded in a dedicated dependency-hardening slice. No force upgrade was applied during M0.

## Not run

- Clerk live login, logout, session expiry, JWKS rotation, or webhooks.
- OpenRouter live catalog sync or inference.
- Genuine upstream streaming and cancellation.
- Razorpay sandbox order, signed webhook, refund, or reconciliation.
- PostgreSQL migration upgrade against a populated sanitized database.
- Redis rate-limit and concurrency behavior.
- Cloud Run deployment, DNS, TLS, Secret Manager, logs, alerts, or rollback.
- Real browser end-to-end customer journey.

## M1 migration verification

| Check | Command | Result |
|---|---|---|
| Fresh and downgrade/re-upgrade migration | python -m pytest -q tests/test_migrations.py | PASS: 2 passed in 14.36s |
| Full API regression after M1 | python -m pytest -q | PASS: 51 passed in 101.33s |
| Deployment migration entry point | python -m app.migrate | PASS against fresh SQLite from repository root |
| Alembic drift check | python -m alembic -c alembic.ini check | PASS: no new upgrade operations |
| PostgreSQL migration runtime | docker run postgres:16-alpine | BLOCKED: Docker Desktop Linux engine unavailable |

## Test policy

No test result in this file represents live production verification. New milestones must append exact commands, environment scope, result, and remaining external prerequisites.

## M2 Clerk identity verification

Environment: isolated target copy; SQLite test database; Clerk verifier and Svix delivery isolated with deterministic test doubles; no live credentials

| Check | Command | Result |
|---|---|---|
| Clerk-focused auth/webhook tests | `python -m pytest -q tests/test_api.py -k clerk` | PASS: 4 passed in 5.71 seconds |
| Full API regression | `python -m pytest -q` | PASS: 55 passed in 108.33 seconds |
| Migration regression | `python -m pytest -q tests/test_migrations.py` | PASS: 2 passed in 14.89 seconds |
| Router web typecheck | `npm.cmd run typecheck` in `apps/web` | PASS |
| Router web lint | `npm.cmd run lint` in `apps/web` | PASS with 2 existing navigation warnings |
| Router web production build | `npm.cmd run build` in `apps/web` | PASS; Next 16.3.4 proxy generated |
| PostgreSQL migration runtime | default database URL check | BLOCKED: PostgreSQL/Docker engine unavailable |

Coverage added:
- Idempotent Clerk bootstrap provisions one Compass customer/workspace and returns the existing mapping on repeat.
- Existing Compass email accounts cannot be silently linked to a different Clerk identity.
- Clerk-backed `/me` access is accepted only for a mapped identity.
- Invalid Clerk webhook signatures are rejected.
- Repeated `svix-id` webhook deliveries are acknowledged without duplicate provisioning.

Not yet proven:
- Real Clerk JWT/JWKS verification, Clerk API email lookup, browser redirects, sign-out propagation, webhook signatures, and event retries.
- PostgreSQL schema/search-path behavior and populated legacy upgrade.

## M3 authorization and API key security verification

Environment: isolated target copy; SQLite test database; provider calls mocked or local-test; no live payments or production deployment

| Check | Command | Result |
|---|---|---|
| M3 focused authorization tests | `python -m pytest -q tests/test_api.py -k "cross_tenant_project_header or target_organization or team_owner_can_manage or production_rate_limiting"` | PASS: 4 passed in 5.69 seconds |
| API-key rotation and production model-assignment gates | `python -m pytest -q tests/test_api.py -k "api_key_rotation or api_key_creation or production_stale_catalog_model or commercial_approval"` | PASS |
| Full API regression | `python -m pytest -q tests/test_api.py` | PASS: 57 passed in 88.25 seconds |
| Python compile check | `python -m compileall -q apps/api/app` | PASS |
| Git whitespace check | `git diff --check` | PASS |

Coverage added:
- Cross-tenant project headers are rejected for API keys scoped to another organization.
- Removing a member from one organization does not suspend access to a second organization.
- Team owners can manage assigned team keys; ordinary members cannot change key model policy.
- Production rate limiting returns an unavailable response instead of silently falling back when Redis cannot enforce the limit.

Not yet proven:
- PostgreSQL query behavior and transaction isolation for the authorization paths.
- Redis limiter behavior under concurrent staging requests.
- Live Clerk tenant mapping and session authorization.

## M4 provider-neutral catalog verification

Environment: isolated production copy; SQLite migration/test fixtures; no live provider credentials, payments, or deployment

| Check | Command | Result |
|---|---|---|
| Catalog normalization, canonical capability matching, and optional-provider metadata | `python -m pytest -q tests/test_catalog.py` | PASS: 6 passed |
| Fresh migration with provider-neutral catalog columns | `python -m pytest -q tests/test_migrations.py` | PASS |
| Combined M4 focused tests | `python -m pytest -q tests/test_catalog.py tests/test_migrations.py` | PASS: 8 passed |
| Provider protocol safety | catalog unit test | PASS: known providers use LiteLLM, OpenRouter is optional, unknown providers are `unverified` |
| Whitespace validation | `git diff --check` | PASS |
| Runtime adapter registry and usage normalization | `python -m pytest -q tests/test_provider_adapters.py` | PASS: 4 passed; registered protocols resolve, integrated unknown protocols fail closed, and alternate provider usage fields normalize safely |

M4 implementation evidence:
- LiteLLM catalog records are normalized into stable provider/model identities with capability types, modalities, context, source pricing, and raw metadata.
- New discoveries remain unavailable until activation and verified credentials; synchronization does not simulate route availability.
- Failed refreshes retain the last successful registry snapshot and record the failed sync run.
- Production route readiness requires a recent verified catalog snapshot; stale LiteLLM/OpenRouter rows are excluded from public catalog output and routing.

M4 not yet proven:
- Full isolated regression is now passing; live/infrastructure verification remains pending.
- PostgreSQL migration against a populated sanitized database.
- Live LiteLLM/provider discovery, direct-provider invocation, usage reconciliation, and staging wallet settlement.

## M5 streaming foundation verification

| Check | Command | Result |
|---|---|---|
| Local compatibility streaming | `python -m pytest -q tests/test_api.py -k streaming_response_format` | PASS |
| Production upstream SSE forwarding and usage source | `python -m pytest -q tests/test_api.py -k production_stream_forwards` | PASS |
| Focused M4/M5 migration and API checks | `python -m pytest -q tests/test_migrations.py tests/test_catalog.py tests/test_api.py -k "stream or migration or catalog"` | PASS: 14 passed |

M5 not yet proven:
- Real upstream stream timing, cancellation, backpressure, Responses tool-call events, and provider-specific failures.
- PostgreSQL transaction behavior and Redis limits under concurrent streamed requests.

Full regression after M5 streaming changes:
- `python -m pytest -q`: historical run, 66 passed in 146.83s.

## M6-M8 continuation verification

Environment: isolated production copy; SQLite tests; no live provider credentials, payment credentials, Docker engine, or GCP access

| Check | Command | Result |
|---|---|---|
| Recovery CLI help does not open the database | `python -m app.recovery --help` | PASS |
| Catalog sync CLI help does not open the database | `python -m app.catalog_sync --help` | PASS |
| Stale reservation preview/apply/idempotency | `python -m pytest -q tests/test_api.py -k stale_reservation` | PASS: 3 passed |
| Production startup does not seed fake catalog/pricing | `python -m pytest -q tests/test_api.py::test_production_seed_does_not_create_fixture_models_or_pricing` | PASS |
| Non-routable ORM defaults and verified activation paths | focused activation/embedding tests | PASS: 7 passed |
| Unpriced model defaults and migration compatibility | focused API plus migration checks | PASS: 5 passed |
| Provider commercial approval migration and route gate | `python -m pytest -q tests/test_migrations.py tests/test_api.py -k "commercial_approval or production_configuration or live_readiness"` | PASS: 3 passed |
| Email outbox worker success/failure recording | `python -m pytest -q tests/test_api.py -k email_outbox_worker` | PASS |
| Email worker CLI help is offline | `PYTHONPATH=apps/api python -m app.email_worker --help` | PASS |
| Cloud Run template safety | `python infra/gcp/validate_templates.py` and `cloudbuild-verify.yaml` validation step | PASS; placeholders and secret references are validated before the verification pipeline runs, without deployment |
| Release artifact command safety | `python infra/gcp/build_release.py --help` and `--dry-run` | PASS; requires explicit registry/URLs, clean worktree for real builds, and never deploys Cloud Run |
| Structured request log allow-list and Cloud Run production template requirements | `python -m pytest -q tests/test_infrastructure.py` | PASS: 4 passed; authorization-like extras are excluded from JSON output and production runtime/secret references are required |
| Full API/catalog/migration regression | `python -m pytest -q` | PASS: 96 passed; includes provider adapter capability gates, staging-harness, conservative capability normalization, no-capability activation rejection, media usage-source accounting, source/customer pricing separation, Cloud Run template safety, and M9 governance coverage plus structured logging |
| Optional OpenRouter protocol compatibility | `python -m pytest -q tests/test_catalog.py tests/test_provider_adapters.py` | PASS: 10 passed; canonical `openrouter_optional` plus legacy persisted-row alias resolve, while unknown protocols fail closed |
| Provider capability adapter mappings | `python -m pytest -q tests/test_provider_adapters.py` | PASS; responses, images, batches, speech binary, and transcription multipart paths are explicit; decision capability remains unimplemented and unroutable |
| Canonical audio route capability labels | `python -m pytest -q tests/test_api.py` | PASS: 72 passed; API imports and routing remain valid after distinct speech/transcription capability wiring |
| Staging smoke harness safety | `python -m pytest -q tests/test_staging_smoke.py` and `python infra/verify_staging.py --help` | PASS: 3 tests; URL validation, explicit paid-request acknowledgement, model requirement, and CLI loading verified without network calls |
| Router web typecheck | `npm.cmd run typecheck` in `apps/web` | PASS |
| Router web lint | `npm.cmd run lint` in `apps/web` | PASS with no warnings |
| Router web production build | `npm.cmd run build` in `apps/web` | PASS; 23 routes generated |
| Standalone web server route smoke | `npm.cmd run start` with `PORT=3101`; HTTP GET `/`, `/admin`, `/login`, `/signup`, `/models`, `/playground` | PASS: all returned HTTP 200 with Compass content; server stopped after verification |
| Router web CI-style install | `npm.cmd ci --ignore-scripts` in `apps/web` | PASS: 413 packages installed; development-only audit findings remain in the Tailwind 3 toolchain |
| Docker engine availability | `docker version` | BLOCKED: Docker engine unavailable |
| Production dependency audit | `npm.cmd audit --omit=dev --json` in `apps/web` | PASS: 0 production vulnerabilities after Next.js 16.4.0 and transitive updates |

Release-tool revalidation on 2026-10-09:
- `python infra/gcp/validate_templates.py`: PASS; 2 Cloud Run templates validated.
- `python infra/gcp/build_release.py --registry example.invalid/compass-router --web-api-url https://api.example.invalid --marketplace-url https://marketplace.example.invalid --dry-run`: PASS; printed BuildKit commands only and did not push or deploy.
- `npm.cmd audit --omit=dev` in `apps/web`: PASS; found 0 production vulnerabilities.
- `docker version`: BLOCKED; Docker Desktop Linux engine is unavailable.
- Read-only `gcloud projects describe`, Cloud Run, Cloud SQL, Redis, Secret Manager, and Artifact Registry queries: BLOCKED; configured account requires interactive reauthentication and non-interactive execution cannot prompt.

M6-M8 not yet proven:
- PostgreSQL/Redis runtime behavior, live provider discovery and streaming, live Clerk/browser paths, SMTP transport and deliverability, Razorpay sandbox, Cloud Run/Secret Manager/Cloud Logging/Monitoring/tracing/alerts, and browser accessibility tests.

Dependency note:
- Full development-tree audit still reports findings in the Tailwind 3 build toolchain; resolving those requires a separate Tailwind 4 migration and was not forced into this production verification slice.

## M9 verification

| Check | Command | Result |
|---|---|---|
| M9 governance API and migration coverage | `python -m pytest -q tests/test_api.py -k "m9_" tests/test_migrations.py` | PASS: 7 M9 tests plus migration checks |
| Full backend regression after capability activation, adapter capability gates, health ordering, media usage, pricing accounting, and Cloud Run template hardening | `python -m pytest -q` | PASS: 96 passed; 1 existing Pydantic deprecation warning |
| Media usage-source classification | `python -m pytest -q tests/test_api.py -k media_usage_without_provider_usage_is_explicitly_estimated` | PASS; provider usage is used only when returned, otherwise settlement records an estimate |
| Provider source cost versus customer charge | `python -m pytest -q tests/test_api.py -k provider_cost_uses_source_price_and_customer_charge_uses_markup` | PASS; provider attribution uses source USD rates while customer charge uses marked-up paise rates |
| Provider health ordering under rapid failures | `python -m pytest -q tests/test_api.py::test_provider_circuit_breaker_opens_after_three_failures` | PASS; monotonic timestamps keep the newest circuit state observable |
| Python compilation | `python -m compileall -q apps/api/app apps/api/alembic/versions tests` | PASS |
| Router web lint | `npm.cmd run lint` in `apps/web` | PASS with no warnings |
| Router web typecheck | `npm.cmd run typecheck` in `apps/web` | PASS |
| Router web production build | `npm.cmd run build` in `apps/web` | PASS; 23 routes generated, including `/admin` |
| Diff whitespace check | `git diff --check` | PASS |

M9 live verification remains open for Clerk MFA/session behavior, PostgreSQL/Redis, browser accessibility and authorization journeys, real provider state, SMTP, Razorpay, GCP, monitoring, backups, rollback, DNS/TLS, and production deployment.

Staging harness status:
- `infra/verify_staging.py` is ready for owner-controlled staging. Its default mode performs health and authenticated `/v1/models` checks. Real streaming is opt-in and requires an explicit model plus `--allow-paid-request`.
- No live staging request was made in this turn because provider credentials, API key, and refreshed GCP/infrastructure access are not available.

## Safe staging preflight - 2026-10-09

- `python -m pytest -q tests/test_infrastructure.py tests/test_migrations.py tests/test_provider_adapters.py tests/test_staging_smoke.py`: **13 passed**.
- `npm.cmd run lint` in `apps/web`: **passed**.
- `npm.cmd run build` in `apps/web`: **passed**; 23 routes generated.
- `npm.cmd run typecheck` in `apps/web`: **passed**.
- `npm.cmd audit --omit=dev --audit-level=high`: **0 vulnerabilities**.
- `python infra/gcp/validate_templates.py`: **passed**.
- `python -m compileall -q apps/api/app tests infra/gcp`: **passed**.
- `git diff --check`: **passed**.
- `python -m pip_audit -r apps/api/requirements.txt`: **not run; `pip_audit` is not installed**.
- `python -m pytest -q tests/test_api.py`: **76 passed**, 1 existing Pydantic deprecation warning.

## Neon database integration - 2026-10-09

- URL normalization and direct migration selection tests: **2 passed**; included in the 15-test focused suite.
- Neon pooled/direct connectivity and Alembic checks: **blocked; URLs are not present in the workspace environment**.
- Neon branch production-data audit: **blocked; requires read-only access to the Neon `staging` branch**.
- `python infra/verify_neon_staging.py`: **fail-closed as expected; refused to run without `DATABASE_URL`**.

## Root environment setup - 2026-10-09

- Combined API, migration, and database configuration suite: **80 passed**, 1 existing Pydantic deprecation warning.
- Root `.env` loading from repository root and `apps/api`: **passed**.
- Explicit environment-variable precedence over root `.env`: **passed**.
- Secret-prefix scan of `.env.example` and `.env`: **0 matches** for credential prefixes.
- `.env` Git ignore/tracking check: **ignored and not tracked**.
- Neon verifier with placeholders: **failed safely before migration/connectivity**, as expected.
## Neon database integration completion - 2026-10-09

- `python infra/verify_neon_staging.py`: PASS; pooled/direct connectivity, TLS, Alembic state, and empty protected customer/financial tables verified without exposing credentials.
- `python -m alembic upgrade head` from `apps/api`: PASS; migrations applied through `a1b2c3d4e5f6` on the Neon staging branch using `DIRECT_DATABASE_URL`.
- Schema repair: PASS; the scoped migration moved the 44 known Compass application tables from `public` to `compass` after confirming there were no extra public tables.
- Production safety: PASS for checks performed; no production branch, production service, wallet data, payment data, or deployment was touched.
## M10 Redis verification - 2026-10-09

| Check | Result |
|---|---|
| Redis URL/TLS client construction | PASS; offline test covers `rediss://`, URL auth, pool, timeouts, and bounded retry configuration |
| Redis health error handling | PASS; authentication failures are converted to a generic operational error without credential text |
| Atomic rate-limit script | PASS; offline test verifies Lua `EVAL`, request/token increments, and TTL expiration commands |
| Rate-limit rejection | PASS; request-limit result maps to the expected API error reason |
| Live Redis connectivity | PASS; authenticated TLS Upstash TCP connection and PING succeeded |
| Live Redis commands | PASS; isolated SET/GET, INCR/INCRBY, EXPIRE/TTL, and Lua EVAL passed with cleanup |
| Multi-worker atomic rate limiting | PASS; 20 concurrent calls produced 5 allowed and 15 rejected reservations |
| Redis outage behavior | NOT RUN against a real outage; fail-closed behavior is covered by offline API tests |
| Neon wallet authority/regression | PASS; read-only Neon verifier passed and no schema or financial code was changed in M10 |
| Python dependency audit | BLOCKED; `pip_audit` is not installed in the current environment |

Neon regression rerun on 2026-10-09: **PASS**; pooled/direct connectivity, TLS, Alembic state, and empty protected tables passed.

## M11 Clerk authentication and Super Admin verification - 2026-10-09

| Check | Result |
|---|---|
| Clerk request options | PASS; official SDK uses session tokens only, configured audience, authorized parties, and server secret |
| Unauthenticated Clerk state | PASS; fails closed in focused security tests |
| Verified email requirement | PASS; unverified Clerk email cannot provision an internal user |
| Focused Clerk/API regression | PASS; 14 passed, 65 deselected |
| Complete Python regression | PASS; 105 passed, 1 existing Pydantic deprecation warning |
| Web lint | PASS |
| Web typecheck | PASS |
| Web production build | PASS; 23 routes generated |
| Real Clerk signup/login/logout | NOT RUN; staging browser and public URL are unavailable |
| Real MFA claim and step-up | NOT RUN; requires the staging Clerk instance and owner account |
| Real webhook signature and redelivery | NOT RUN; signing secret and endpoint are not configured |
| Live tenant/admin isolation | NOT RUN; requires approved staging deployment and populated test identities |

No Clerk secret values were printed or committed.

## Local Clerk browser configuration fix - 2026-10-09

| Check | Result |
|---|---|
| Root `.env` loading from `apps/web` startup | PASS; Next config loads the repository-root environment without copying secrets |
| Local `/login` route | PASS; HTTP 200 after server restart with Clerk configured |
| Local `/signup` route | PASS; HTTP 200 after server restart with Clerk configured |
| Frontend lint | PASS |
| Frontend typecheck | PASS |
| Real interactive Clerk sign-in | NOT RUN; requires user completion in the Clerk development instance |
| Authenticated dashboard, refresh, logout, and session revocation | NOT RUN |

## Clerk route correction - 2026-10-10

| Check | Result |
|---|---|
| Local web `.env.local` | PASS; contains the public publishable key and ignored server-only Clerk secret, with no committed values |
| `/login` route | PASS; HTTP 200 and legacy form absent |
| `/signup` route | PASS; HTTP 200 and legacy form absent |
| `/admin-login` route | PASS; HTTP 200 and legacy form absent |
| Public-route middleware behavior | PASS; public auth routes bypass middleware while protected routes remain matched |
| FastAPI health | PASS; HTTP 200 |
| Frontend lint/typecheck | PASS |
| Frontend production build | PASS |
| Interactive Clerk authentication | NOT RUN; requires manual browser sign-in and verification |

## Protected dashboard recovery - 2026-10-10

| Check | Result |
|---|---|
| Unauthenticated dashboard HTML | PASS; HTTP 200 response generated |
| Invalid protected-route session handling | PASS; middleware recovery redirects toward login instead of surfacing an unhandled error |
| Frontend build after recovery change | PASS |

## Customer Credits, BYOK, and membership regression - 2026-10-11

| Check | Result |
|---|---|
| Python compile check | PASS |
| BYOK chat wallet invariant | PASS; no Compass Credit reservation or settlement was written |
| Configured signup Credits | PASS; promotion is configurable and idempotent per user |
| Cross-tenant project header | PASS; unauthorized project tag rejected with `project_access_denied` |
| Invitation and member removal regression | PASS |
| Provider/catalog tests | PASS; 11 tests |
| Infrastructure/staging tests | PASS; 7 tests |
| Web typecheck | PASS |
| VS Code extension build | PASS |
| VS Code extension tests | PASS; 10 tests |
| Organization role/project access UI typecheck | PASS |
| Invitation management API regression | PASS; invitation acceptance and membership authorization regressions passed |
| Managed versus BYOK usage fields | PASS; request response mapping and frontend typecheck passed |
| VS Code project scope UI | PASS; extension typecheck, build, and tests passed after selector/state changes |
| Super Admin provider analytics authorization and aggregation | PASS; customer denied and admin metadata aggregation returned successfully |
| Scoped API-key creation UI | PASS; web production build and typecheck passed with project/member/expiry fields |
| Full API suite | PASS; `pytest -q tests/test_api.py`, 84 passed, 1 existing Pydantic deprecation warning |
| Razorpay sandbox | BLOCKED; external sandbox credentials and approval required |
| Super Admin provider analytics UI | PASS; web typecheck and production build passed with the aggregation rendered in Operations |
| Signup-credit expiration safety review | BLOCKED BY DESIGN; current aggregate wallet cannot safely distinguish promotional balance from purchased Credits |
| VS Code browser/device authorization wiring | PASS; extension typecheck, 10 unit tests, and production bundle passed; live browser approval remains unverified |
| Organization provider analytics scope | PASS; owner access and regular-member denial verified, with date/provider/model/project/member/API-key dimensions |
| Customer-facing Credits terminology | PASS; web typecheck and production build passed after replacing active Wallet labels while retaining compatibility identifiers |

## Organization administration hardening - 2026-10-11

| Check | Result |
|---|---|
| Multi-organization owner/admin API-key listing | PASS; keys are restricted to organizations where the actor is owner/admin |
| Multi-organization provider analytics scope | PASS; analytics excludes organizations where the actor is only a regular member |
| API-key creation/revocation audit metadata | PASS; focused audit regression passed |
| Focused authorization regression | PASS; 4 tests passed |
| Full API suite after hardening | PASS; 84 passed, 1 existing Pydantic deprecation warning |
| Python compile check | PASS |
| Web typecheck | PASS |
| Web production build | PASS |

## Extension session logout hardening - 2026-10-11

| Check | Result |
|---|---|
| Device-session revoke endpoint | PASS; device token is rejected immediately after local sign-out request |
| Admin session revocation compatibility | PASS; existing admin revocation remains safe after device logout |
| Full API suite | PASS; 84 passed, 1 existing Pydantic deprecation warning |
| Extension typecheck | PASS |
| Extension unit tests | PASS; 10 passed |
| Extension production build | PASS |
| Live browser/device logout and token revocation | NOT RUN; requires staging Clerk/browser verification |

## Membership audit coverage - 2026-10-11

| Check | Result |
|---|---|
| Invitation creation/acceptance/removal audit history | PASS; invitation regression verifies all three events |
| Project/team membership audit paths | PASS; code paths write organization-scoped metadata without credentials |
| Full API suite after audit changes | PASS; 84 passed, 1 existing Pydantic deprecation warning |
| Python compile check | PASS |

## Onboarding email guidance - 2026-10-11

| Check | Result |
|---|---|
| Invitation email OTP and login guidance | PASS |
| VS Code browser sign-in and project selection guidance | PASS |
| No-secret email wording | PASS; provider credentials and API keys are explicitly excluded |
| Full API suite after email changes | PASS; 84 passed, 1 existing Pydantic deprecation warning |

## Default project governance - 2026-10-11

| Check | Result |
|---|---|
| Regular project-admin rename of default `Others` | PASS; denied with `default_project_admin_required` |
| Organization owner rename of default project | PASS |
| Full API suite after project-governance change | PASS; 84 passed, 1 existing Pydantic deprecation warning |

## Usage finality analytics - 2026-10-11

| Check | Result |
|---|---|
| Provider analytics usage-source grouping | PASS; aggregates expose provider source without changing charges |
| Estimated/finalized/unavailable classification | PASS; derived from recorded usage source |
| Admin analytics regression | PASS; all rows expose consistent usage finality |
| Full API suite after analytics change | PASS; 84 passed, 1 existing Pydantic deprecation warning |

## Extension session refresh - 2026-10-11

| Check | Result |
|---|---|
| Device token rotation | PASS; old token rejected and rotated token accepted |
| Rolling session expiry | PASS; refreshed session receives a new 30-day expiry |
| Authorization scope preservation | PASS; project/team/API-key scope remains unchanged |
| Full API suite | PASS; 84 passed, 1 existing Pydantic deprecation warning |
| Extension typecheck | PASS |
| Extension tests | PASS; 10 passed |
| Extension build | PASS |
| Live Clerk/browser refresh behavior | NOT RUN; requires staging browser verification |

## Signup-credit eligibility - 2026-10-11

| Check | Result |
|---|---|
| Optional domain allowlist validation | PASS; Super Admin setting accepts bounded non-empty domain lists |
| Super Admin settings endpoint persistence/audit | PASS; `/admin/settings` accepts and persists the eligibility setting |
| Eligible-domain signup grant | PASS |
| Ineligible-domain signup grant suppression | PASS; wallet remains zero |
| Existing signup idempotency regression | PASS |
| Full API suite after eligibility change | PASS; 85 passed, 1 existing Pydantic deprecation warning |

## Razorpay refund webhook coverage - 2026-10-11

| Check | Result |
|---|---|
| Signed `refund.processed` webhook | PASS; sandbox-safe local fixture reversed the expected Credits amount |
| Duplicate refund webhook delivery | PASS; second event was idempotently ignored |
| Refund ledger/status reconciliation | PASS; refund marked processed and one payment event recorded |
| Live Razorpay sandbox | BLOCKED; external credentials and approval remain required |

## Provider analytics presentation - 2026-10-11

| Check | Result |
|---|---|
| Customer activity analytics period and usage finality | PASS; date, estimated/finalized/unavailable usage, provider cost, and Credits are rendered |
| Super Admin analytics period and usage finality | PASS; operations table renders date, scope, credential mode, usage finality, cost, Credits, and failures |
| Web source lint | PASS; targeted lint for `AdminConsole.tsx` and `ActivityPage.tsx` |
| Web typecheck | PASS |
| Web production build | PASS; 23 routes generated |
| Repository-wide web lint | PASS; ESLint now ignores generated `.next`, `.next-local`, `out`, and `node_modules` artifacts |
| Full backend regression after analytics UI changes | PASS; 114 passed, 1 existing Pydantic deprecation warning |

## BYOK failure and streaming accounting - 2026-10-11

| Check | Result |
|---|---|
| Failed BYOK chat request | PASS; provider failure records BYOK usage without wallet reservation or settlement |
| Failed BYOK streaming request | PASS; SSE error is recorded with zero Compass Credits and no wallet ledger entries |
| BYOK wallet invariant | PASS; wallet balance is unchanged and provider credential mode remains `byok` |
| Streaming transaction finalization | PASS; chat and JSON streaming success, failure, and cancellation paths explicitly commit request/settlement state |
| Focused regression | PASS; 3 tests passed |
| Full backend regression | PASS; 115 passed, 1 existing Pydantic deprecation warning |

## Extension session expiry - 2026-10-11

| Check | Result |
|---|---|
| Expired VS Code device session | PASS; an expired session token is rejected by `/v1/account` |
| Refresh/revocation compatibility | PASS; the same regression still verifies rotation and explicit local logout |
| Focused regression | PASS; 1 test passed |

## Customer Credits terminology sweep - 2026-10-11

| Check | Result |
|---|---|
| Visible web/API financial wording | PASS; user-facing balance, recharge, refund, adjustment, and insufficiency messages use Credits |
| Compatibility identifiers | PASS; existing wallet tables, route paths, error codes, and internal field names remain unchanged |
| Focused financial/auth tests | PASS; 10 passed, 76 deselected, 1 existing Pydantic deprecation warning |
| Web lint and typecheck | PASS |
| Full backend regression | PASS; 115 passed, 1 existing Pydantic deprecation warning |

## M12 role portals and portal resolution - 2026-10-11

| Check | Result |
|---|---|
| Server-derived company-owner portal | PASS; signup and `/auth/portal` resolve `/admin` without trusting browser role state |
| Server-derived platform portal | PASS; platform administrator resolves `/super-admin` |
| Focused portal regression | PASS; 2 tests passed |
| Full backend regression | PASS; 116 passed, 1 existing Pydantic deprecation warning |
| Web lint | PASS |
| Web typecheck | PASS |
| Web production build | PASS; `/portal`, `/admin`, and `/super-admin` generated |
| Real Clerk browser signup, invitation, MFA, logout, and session revocation | NOT RUN; staging Clerk interaction required |

## M12 extension and infrastructure validation - 2026-10-11

| Check | Result |
|---|---|
| VS Code extension typecheck | PASS; `npm.cmd run check` |
| VS Code extension tests | PASS; 10 tests |
| VS Code extension build | PASS |
| Cloud Run template validation | PASS; 3 templates |
| Infrastructure regression tests | PASS; 4 tests |
| Live extension device/browser authorization | NOT RUN; external Clerk/browser verification required |
