# Final Release Checklist

Status: NOT READY

- [x] Original repository and VS Code extension remain outside the production copy.
- [x] M0-M3 implementation is preserved.
- [x] OpenRouter is optional rather than a startup requirement.
- [x] Provider-neutral catalog and adapter contracts exist.
- [x] New catalog discovery does not auto-publish or fake route availability.
- [x] Provider commercial approval is an explicit production publication and route-readiness gate.
- [x] Production ORM defaults do not publish providers/models or assign customer prices without verified activation data.
- [x] Production web dependency audit is clean with `npm audit --omit=dev`.
- [x] API-key rotation revokes the old secret atomically, preserves scope, and records an audit event.
- [x] M4-M8 safe implementation slices and local verification are complete: `python -m pytest -q` passed, 96 tests after provider adapter capability gates, staging-harness, conservative capability, activation, health-ordering, media accounting, pricing separation, Cloud Run template hardening, and M9 governance additions; web typecheck/lint/build passed.
- [x] Non-destructive staging verification harness is present; its live checks remain release gates until run with owner-controlled credentials.
- [x] Standalone Next production server starts and public Router routes return HTTP 200 in a local smoke check.
- [x] Email outbox worker records real SMTP success and transport failure states in isolated tests; live SMTP delivery remains a release gate.
- [x] Cloud Run templates pass local placeholder and secret-reference validation without deployment.
- [x] Explicit release artifact script requires clean Git state and records commit-tagged image digests with provenance/SBOM attestations; no deployment is performed.
- [x] Structured request logging uses an allow-listed JSON payload with request IDs and excludes authorization, query, body, and provider payload data.
- [ ] PostgreSQL upgrade and populated-data verification.
- [ ] Redis authenticated TLS endpoint, multi-worker rate-limit, outage, and concurrency verification.
- [ ] Live LiteLLM/direct-provider discovery and inference staging evidence.
- [ ] Usage, wallet, pricing, and API-key reconciliation staging evidence.
- [ ] Clerk, Secret Manager, Cloud Run, Cloud Logging/Monitoring, tracing, alerts, rollback, and DNS verification.
- [ ] Razorpay sandbox and production approval.
- [ ] Jev official contract/commercial approval, if ever enabled.
- [ ] Live M4-M8 release gates: provider, database, browser, payment, GCP, security, and operational verification.
- [x] M9 local super-admin governance slice: role model, owner bootstrap boundary, wallet controls, revisions, metadata-only admin APIs, migration, UI, and regression coverage.
- [ ] M9 live Clerk MFA/session, PostgreSQL/Redis concurrency, high-risk reauthentication, browser accessibility, and operational verification.

## M11 Clerk security evidence - 2026-10-09

- [x] Clerk route protection and configured Clerk admin sign-in are implemented.
- [x] FastAPI Clerk verification, verified-email mapping, owner bootstrap boundary, and webhook idempotency paths are covered by local code/tests.
- [x] Full local Python regression passes: 105 tests, one existing deprecation warning.
- [x] Web lint, typecheck, and production build pass.
- [ ] Real Clerk signup/login/logout and session revocation verification.
- [ ] Real Clerk MFA/step-up and owner bootstrap verification.
- [ ] Real Clerk webhook delivery and redelivery verification.
- [ ] Staging Secret Manager, Cloud Run, browser, and tenant-isolation verification.

## M12 role portal evidence - 2026-10-11

- [x] Server-derived portal resolution for platform administrators, company administrators, and members.
- [x] Product Owner control center available at `/super-admin` without removing the existing M9 implementation.
- [x] Company administration surface available at `/admin` with organization-scoped project, invitation, and member controls.
- [x] Clerk login and signup redirect to `/portal` for role-aware routing.
- [x] Full local API regression, web lint, typecheck, production build, and portal regression evidence.
- [ ] Real Clerk signup, email verification, invitation acceptance, MFA, logout, and session revocation in a staging browser.
- [ ] Live SMTP, provider inference, Razorpay sandbox, PostgreSQL/Redis runtime, Cloud Run, Secret Manager, monitoring, and rollback evidence.
## M13 additions - 2026-10-11

## M15 + M13.1 additions - 2026-10-11

- [ ] Verify isolated Neon staging branch is empty of protected customer/financial data.
- [ ] Apply and verify migration `j4k5l6m7n8o9` in staging only.
- [x] Validate member key assignment authorization locally without exposing raw keys.
- [ ] Verify real Clerk member inference and streaming with staging credentials.
- [ ] Create approved Cloud Scheduler OIDC job and dedicated IAM service account.
- [ ] Rotate previously exposed Neon, Clerk, and Upstash credentials.

- [x] Additive member/project API-key policy schema reviewed.
- [x] Raw machine-key compatibility preserved.
- [x] Member-safe alias endpoint and scoped assignment endpoints implemented.
- [x] Alembic migration graph has one head and fresh upgrade/downgrade tests pass.
- [x] Full local regression passes (`116 passed`, one pre-existing warning).
- [ ] Wire Clerk-authenticated managed inference through provider/Credits accounting.
- [ ] Verify live Clerk, extension, provider, PostgreSQL, Redis, and staging deployment behavior.

## M14 additions - 2026-10-11

- [x] Add feature-gated Clerk Organization invitation path while preserving local test mode.
- [x] Add durable Clerk organization/invitation identifiers.
- [x] Add versioned 5% FX buffer and 5% platform fee policy fields.
- [x] Reject fixed local FX source in production configuration.
- [ ] Configure and verify Clerk Organizations, email delivery, webhooks, and browser acceptance.
- [ ] Configure approved live FX source and refresh/stale-rate worker.
- [ ] Implement first-class special-token pricing and credit-lot FIFO expiry.
