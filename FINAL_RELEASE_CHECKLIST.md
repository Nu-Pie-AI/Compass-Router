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
