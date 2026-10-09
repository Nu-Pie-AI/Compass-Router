# Compass Router Production Threat Model

## Assets

- Compass user, organization, project, team, and role records.
- Compass API keys and provider credentials.
- Clerk session and webhook integrity.
- Wallet balances, payment records, invoices, and usage charges.
- Customer prompts, outputs, metadata, and provider responses.
- Model catalog and pricing policy.
- Operational logs, audit events, backups, and deployment secrets.

## Trust boundaries

1. Browser to Next.js Router web.
2. Web session to FastAPI authorization.
3. Customer API key to inference endpoints.
4. FastAPI to PostgreSQL and Redis.
5. FastAPI to OpenRouter, LiteLLM, and direct providers.
6. Razorpay browser checkout and webhook ingress.
7. Clerk token/JWKS and webhook ingress.
8. Admin users and internal operational routes.
9. Cloud Run services, Secret Manager, and managed data services.

## Threats and controls

| Threat | Required control | Current state |
|---|---|---|
| Cross-tenant object access | Resource-scoped queries and deny-by-default dependencies | Needs M3 audit/tests |
| Forged Clerk identity | JWKS validation, issuer/audience checks, key rotation cache | Not implemented |
| API key theft | Hash-only storage, one-time display, scopes, expiry, rotation, redacted logs | Partially implemented |
| Provider secret disclosure | Secret Manager, encryption at rest, no client return, rotation | Partial |
| Double wallet credit | Raw-body webhook verification, event idempotency, DB constraints | Partial |
| Double debit or overspend | Locked ledger reservation, idempotency, concurrency tests | Partial |
| Fake or stale model availability | Dynamic sync, source timestamps, route eligibility state | Not implemented |
| Prompt and output leakage | Minimize retention, redact logs, provider disclosure and access controls | Needs policy |
| SSRF or unsafe provider URLs | Allowlist provider routes and validate outbound destinations | Needs review |
| Abuse and denial of service | Redis limits, request size/timeouts, concurrency ceilings, circuit breakers | Partial |
| Streaming disconnect ambiguity | Track pending reconciliation and verified provider usage | Not implemented |
| Supply-chain compromise | Lockfiles, audit, scanning, SBOM, signed immutable builds | Partial |
| Admin misuse | Explicit RBAC, audit log, re-authentication for money and secrets | Needs review |
| Data loss | Managed backups, PITR, restore drills, migration rollback | Not implemented |

## Highest-risk items

1. Financial settlement under ambiguous upstream completion or duplicate payment events.
2. Authentication migration and tenant identity linking.
3. Provider credentials and customer prompt exposure.
4. Uncontrolled schema changes on existing wallets and keys.
5. Production dependencies with unresolved high or critical advisories.

