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
