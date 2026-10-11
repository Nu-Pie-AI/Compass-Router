# Compass Router Production Blockers

Updated: 2026-10-09

## Safe staging preflight status

- Local branch created: `staging/safe-deployment-2026-10-09`.
- GCP read-only access is currently available for project `compass-510017`; billing is enabled and the `compass` Artifact Registry repository exists in `us-central1`.
- Existing public Cloud Run services were inspected and were not changed.
- Cloud Build, staging Cloud Run resource creation, isolated PostgreSQL/Redis resources, and Secret Manager writes remain pending explicit owner approval.
- GitHub publication is blocked because this checkout's `origin` is a local source-folder remote and GitHub CLI is not installed. The branch exists locally; publishing requires the GitHub repository URL and authenticated Git remote.
- Local Docker Desktop is unavailable, but staging image builds are prepared for remote Cloud Build.
- Neon staging pooled and direct connection URLs are not available in the workspace environment; connectivity, migration execution, tenant isolation, wallet concurrency, rollback, and data-safety verification cannot be claimed yet.
- Neon branch data provenance is not independently verifiable from repository code. A read-only Neon branch audit is required to confirm the `staging` branch contains no production customer or payment data.
- `infra/verify_neon_staging.py` is ready for that audit but cannot run until the two Neon URLs are supplied through ignored environment variables or Secret Manager.
- The verifier was run against placeholders and failed safely at DNS resolution; no migration or database write was attempted.
- Required owner action: paste the real Neon staging pooled URL into `DATABASE_URL` and the real Neon staging direct URL into `DIRECT_DATABASE_URL` in the ignored root `.env`, or provide equivalent Secret Manager references. Do not paste them into chat or Git.

## External access blockers

| Blocker | Impact | Owner action |
|---|---|---|
| Clerk application and keys unavailable | Cannot implement or live-verify Clerk session/JWKS/webhook flows | Create development and production Clerk apps and provide secure Secret Manager or local ignored-env access |
| Optional OpenRouter account/key/funding unavailable | Blocks only optional OpenRouter live verification; it does not block the base Router catalog or direct/LiteLLM providers | Provide a test key only if the optional OpenRouter route is later approved |
| Razorpay test credentials unavailable | Cannot verify signed order, webhook, refund, and reconciliation flow | Provide test key ID, secret, webhook secret, and sandbox approval |
| GCP project and IAM unavailable | Cannot deploy Cloud Run, Cloud SQL, Redis, Secret Manager, or monitoring | Provide project, billing, IAM, Artifact Registry, and DNS access |
| Sanitized populated database unavailable | Cannot prove upgrade migration preserves customer records | Provide a sanitized schema/data backup or approve a generated representative fixture |
| Legal/commercial approvals unavailable | Cannot enable real customer money or provider resale | Confirm upstream terms, GST/tax/invoicing, privacy retention, and launch approval |

## Technical blockers

- API persistence now has Alembic and production mode validation, but PostgreSQL execution and populated legacy adoption remain unverified.
- M3 authorization hardening is verified on isolated SQLite; PostgreSQL authorization queries and Redis limiter behavior remain unverified because the isolated production-like services are unavailable.
- Clerk code paths are implemented, but live provider verification is blocked by Clerk application credentials, domain configuration, and webhook setup.
- PostgreSQL runtime verification is still blocked by the unavailable Docker Desktop Linux engine and lack of an isolated database.
- Provider catalog data is now sourced through a provider-neutral LiteLLM sync path in code, but live provider discovery still needs a staging credential and endpoint verification.
- Production startup and ORM defaults no longer advertise models or providers without verified catalog, credential, adapter, and activation evidence.
- Provider commercial approval is now persisted and enforced independently from credentials and technical health; migrated providers default to `unreviewed` until the owner approves their commercial use.
- Production chat and Responses streaming now forward upstream SSE incrementally; stale catalog snapshots are rejected before routing; live timing, cancellation, backpressure, Responses tool-call events, and provider-specific stream failures remain unverified.
- Email outbox delivery now has a bounded SMTP worker with claim, retry limit, sent state, and recorded transport failures; live delivery remains blocked until SMTP credentials, sending domain, and deliverability configuration are supplied.
- Marketplace identity remains separate NextAuth plus signed handoff pending an explicit convergence decision.
- Cloud Run templates with pinned Secret Manager version placeholders, verification Cloud Build, non-root images, and operator runbooks are prepared; actual GCP Secret Manager wiring, alerts, deployment, and rollback smoke tests remain unavailable.
- Production dependency audit is clean after the Next.js 16.4.0 and transitive dependency update. Development-only Tailwind 3 audit findings remain and require a separate breaking migration if the full tree must be clean.

## Non-blocking warnings

- Router web lint is clean after internal logout redirects were moved to the Next client router.
- Marketplace install reports deprecated otplib v12 packages.
- Prisma reports the package.json configuration style is deprecated for Prisma 7.
- No production readiness claim is permitted until section P gates pass.

## M4 transition status

- The OpenRouter-first design has been replaced by a provider-neutral M4 implementation. OpenRouter remains an optional adapter.
- M4 local code verification is complete, including full regression and stale-catalog route rejection; production readiness still requires PostgreSQL migration, staging provider discovery, and route-readiness checks.
- M5 streaming foundation has started; full provider-backed verification remains pending.

M4 implementation blockers:
- A real LiteLLM gateway or approved direct-provider credential is required for live catalog discovery and routing verification.
- PostgreSQL, Redis, Secret Manager, and Cloud Run staging access remain unavailable in this work session.
- No Jev integration is permitted until its official contract, authenticated access, pricing, and commercial customer-facing rights are verified.

## M6/M8 implementation status

- Stale inference reservation recovery is implemented as a preview-first, idempotent local worker. It is not scheduled against production without operator approval.
- Verification-only Cloud Build, non-root API/web images, Cloud Run secret-reference templates, and catalog/recovery job instructions are prepared.
- M7 web typecheck/build, SMTP outbox worker tests, and M6-M8 isolated regression passed; no browser, live provider, transactional email, or production infrastructure evidence is implied by those checks.
- GCP resource creation, Secret Manager population, Cloud Run deployment, DNS/TLS, and monitoring remain blocked by missing project access and explicit deployment approval.

## M9 control-center transition

- M9 governance APIs, role checks, owner bootstrap boundary, wallet adjustment safety, pricing/routing revisions, metadata-only admin views, and the Router `/admin` workspace are implemented and locally verified.
- Production admin access remains blocked until a real Clerk application proves MFA claims, session revocation, fresh-authentication behavior for high-risk actions, and webhook/session lifecycle handling.
- PostgreSQL/Redis staging is required to verify migration behavior, row locks, pagination/filter queries, rate limits, and concurrency; SQLite tests do not establish those guarantees.
- Live provider, SMTP, Razorpay, GCP Secret Manager, Cloud Run, monitoring, backup/restore, DNS/TLS, and rollback access remain external prerequisites.
- Current read-only GCP verification is blocked by expired local credentials: `gcloud auth list` identifies `toheed@nu-pie.com`, but project, Cloud Run, Cloud SQL, Redis, Secret Manager, and Artifact Registry queries all fail with `Reauthentication failed` in non-interactive execution. No interactive login was attempted.
- M9 intentionally performed no live payment, deployment, secret-management write, destructive migration, or change to the original repository or VS Code extension.

## Neon staging verification update - 2026-10-09

- Owner supplied Neon staging values through the ignored root `.env`; values were not printed, logged, or committed.
- `python infra/verify_neon_staging.py`: PASS after database initialization and schema repair. TLS, pooled/direct routing, Alembic head, and empty protected customer/financial tables passed.
- `python -m alembic upgrade head` from `apps/api`: PASS through `a1b2c3d4e5f6` using `DIRECT_DATABASE_URL`.
- The staging branch was empty and contained no rows in the protected customer/financial tables checked by the verifier.
- The Neon integration blocker is resolved for this staging branch. Live provider, Clerk, Redis, SMTP, Razorpay, GCP, browser, and deployment gates remain open.
## M10 Redis status - 2026-10-09

- Redis transport implementation is complete and provider-neutral. `redis-py` supports authenticated `rediss://` endpoints, pooled connections, bounded retries, and the required atomic Lua limiter.
- Offline Redis tests pass, and live Upstash TCP/TLS verification now passes.
- The ignored `.env` had a stale local `REDIS_URL` before the configured Upstash `rediss://` value. The stale entry was removed; no secret value was printed or committed.
- Upstash REST must not be used for the limiter because the application requires atomic Lua `EVAL` with `INCR`, `INCRBY`, and `EXPIRE`.
- Live multi-worker rate limiting is verified. Redis outage behavior against a real service and PostgreSQL wallet concurrency against staging remain open gates.
- Neon regression rerun after the M10 code changes now passes. No migration or financial operation was attempted.

## M10 automatic Upstash verification - 2026-10-09

- Standard Redis TCP/TLS credentials were available in the existing `REDIS_URL`. The Upstash REST token was not substituted for Redis configuration.
- Live Upstash checks passed for authenticated TLS PING, SET/GET, INCR/INCRBY, EXPIRE/TTL, Lua EVAL, and concurrent atomic rate limiting.
- Earlier screenshots contained credentials; rotate any credentials that were exposed before production use, even though no values were committed here.

## M11 Clerk authentication and Super Admin verification - 2026-10-09

- A public staging URL and browser access are required to verify real Clerk signup, login, logout, session revocation, redirect behavior, and protected web routes.
- `CLERK_WEBHOOK_SIGNING_SECRET` is still a placeholder locally; a staging Clerk webhook endpoint and delivery evidence are required.
- `PLATFORM_SUPER_ADMIN_CLERK_USER_ID` is not configured; the owner must provide the exact staging Clerk user ID through a secure channel before bootstrap can be tested.
- The configured local Clerk key prefixes indicate a test setup, but the Clerk dashboard instance, allowed origins, MFA policy, and claims have not been independently verified.
- Live MFA/step-up behavior, high-risk reauthentication, tenant isolation against a real database, Secret Manager references, Cloud Run IAM, and log redaction remain unverified.
- Rotate any Clerk or other credentials exposed in earlier screenshots before relying on them for staging or production.

## Local Clerk browser fix - 2026-10-09

- The legacy login appeared because Next.js did not load the repository-root `.env` when launched from `apps/web`; the Clerk public-key check was false.
- This is fixed locally with startup-time root environment loading in `apps/web/next.config.js`, and the Next server was restarted.
- Interactive Clerk authentication is still an external/user-action gate: complete a real development-instance sign-in at `http://localhost:3100/login` and verify dashboard, refresh, logout, and protected-route behavior.

## Clerk middleware follow-up - 2026-10-10

- The local Next process required an ignored `apps/web/.env.local` because Clerk edge middleware did not receive the parent-directory root `.env` through Next config injection.
- The local file was populated from the existing root values without printing them. It must never be committed or copied into a client bundle beyond the intended public publishable key.
- The browser must still complete a real Clerk development-instance sign-in to verify session bootstrap, dashboard access, logout, and FastAPI token validation.
- A browser with a stale Clerk cookie should be redirected to `/login?callbackUrl=/dashboard`; complete a fresh sign-in there before retrying the dashboard.

## Customer Credits and BYOK follow-up - 2026-10-10

- BYOK zero-Compass-Credit handling is implemented for chat, JSON, streaming, binary, and multipart service paths; focused wallet-invariant regression coverage passes.
- Signup promotion uses the existing `trial_credit_paise` platform setting and is idempotent by user ledger key; promotional expiration is not yet modeled.
- Organization/project/team membership, invitation APIs/UI, extension project-tag status/selector, and scoped API-key creation controls are implemented.
- Usage responses and workspace activity now distinguish managed versus BYOK traffic and provider cost versus Compass Credits. The Super Admin Operations screen now renders the provider/model aggregation with tenant/project scope, credential mode, cost, charge, and failure columns.
- The extension now uses the existing browser/device authorization flow for the primary Compass connection path and keeps manual API-key connection as a compatibility path; live browser approval and revocation still require staging verification.
- Organization-scoped provider analytics are implemented and authorization-tested; live PostgreSQL performance/index verification remains part of staging validation.
- Customer-facing Wallet terminology has been replaced with Credits; internal wallet identifiers remain intentionally unchanged for compatibility.
- Signup-credit expiration/eligibility policy is still not modeled in the ledger; the current configurable grant is one-time and idempotent with no expiry.
- Invitation emails include secure onboarding and extension instructions; SMTP delivery remains dependent on verified staging SMTP configuration.
- Razorpay sandbox verification remains blocked by external sandbox credentials and approval; no live or simulated payment was run.
- The full API pytest file now passes locally: 85 passed with one existing Pydantic deprecation warning. PostgreSQL/Redis concurrency and live infrastructure verification remain external staging gates.
- Promotional credit expiration cannot be enabled safely with the current aggregate wallet balance. Add credit-lot/allocation semantics before implementing expiry, so purchased Credits cannot be clawed back accidentally.

## Signup-credit eligibility - 2026-10-11

- Optional email-domain eligibility is implemented and locally verified.
- Promotional expiration remains blocked by the aggregate wallet design; expiry requires credit-lot/allocation semantics before activation.

## Organization administration hardening - 2026-10-11

- No new implementation blocker. Multi-organization owner/admin API-key and provider-analytics scope is now covered by automated tests.
- Live tenant-isolation and performance verification against the staging PostgreSQL runtime remains an external staging gate.
- Existing Clerk, SMTP, Razorpay sandbox, Redis/Neon runtime, Cloud Run, and deployment-approval blockers remain unchanged.

## Extension session logout hardening - 2026-10-11

- Server-side device-session/API-key revocation is implemented and locally tested.
- Live browser/device authorization, logout, refresh/expiry, and revocation behavior still require staging Clerk and extension verification.

## Extension session refresh - 2026-10-11

- Token rotation and rolling expiry are implemented and locally tested.
- Live browser/device refresh under Clerk, network interruption, and long-lived session conditions remain unverified external gates.

## Membership audit coverage - 2026-10-11

- Membership and invitation audit events are locally implemented and regression-tested.
- Live SMTP delivery, Clerk identity verification, and production log/audit retention remain external verification gates.

## Onboarding email guidance - 2026-10-11

- Invitation and resend templates now contain the required setup guidance without secrets.
- Actual SMTP delivery, bounce handling, and template rendering remain unverified until staging SMTP credentials are configured.

## M12 role portals and Clerk onboarding boundary - 2026-10-11

- Local portal routing is implemented and tested: `/portal` derives the destination from server-side Compass authorization, `/super-admin` preserves platform governance, and `/admin` is the organization administration surface.
- This does not prove a live Clerk journey. A staging Clerk instance with configured origins, verified email delivery, MFA policy, owner subject, webhook signing secret, and browser access is still required.
- Invitation acceptance and onboarding email templates are locally covered, but real invitation delivery, email verification, session persistence/revocation, and member browser access remain unverified.
- The current aggregate Credits ledger still cannot safely expire only promotional Credits; credit-lot/allocation semantics remain a separate design blocker.
- No deployment, secret write, live payment, provider request, or production service/database change was performed.

## M13 team API keys and member assignments - 2026-10-11

- Local additive assignment/project-policy APIs are implemented, but managed Clerk-authenticated inference has not yet been wired to the existing provider and Credits accounting path.
- Real Clerk organization membership, browser managed inference, VS Code device authorization, and immediate revocation behavior require staging credentials and browser verification.
- PostgreSQL migration execution and tenant/concurrency verification remain staging-only gates; no production migration was run.
- No live provider inference, payment, deployment, or secret change was performed.

## M15 FX integration - 2026-10-11

- Cloud Scheduler has not been created or connected; this requires explicit infrastructure approval and a Secret Manager value for `FX_REFRESH_JOB_SECRET`.
- Fawaz read-only smoke verification passed; Frankfurter returned HTTP 403 from this environment and needs a permitted egress path before primary-source verification.
- Commercial approval remains required for using daily reference rates in paid customer pricing.
- The M15 migration is local-only; no Neon migration or production database change was performed.

## M14 Clerk Organizations and pricing parity - 2026-10-11

- Clerk Organizations must be enabled and configured in the intended Clerk instance; live invitation email, acceptance, resend, revoke, and webhook behavior are unverified.
- A production-approved FX source and refresh worker are not configured. The fixed FX value is now rejected for production and remains local-only.
- Cached-input, cache-write, reasoning, audio/image/tool, tiered pricing, and FIFO expiring credit lots are not yet first-class Compass billing semantics.
- Credentials pasted into the session must be rotated before staging use. No rotation was performed automatically.
