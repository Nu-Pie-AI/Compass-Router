# COMPASS ROUTER — PRODUCTION IMPLEMENTATION MASTER PLAN

**Document version:** 1.0  
**Prepared:** 2026-10-08  
**Purpose:** Authoritative implementation plan and coding-agent instructions for turning the **existing Compass Router** into a deployable, multi-tenant, prepaid AI inference gateway with **Clerk authentication**.  
**Scope:** Compass Router (Router API, Router web, marketplace identity/catalog where relevant, LiteLLM, database, operations). **Out of scope:** `compass-code` implementation, VS Code UI, local coding agents, Kilo, OpenCode, MCP agent runtimes. Do not modify those components except shared interface contracts where strictly necessary and approved.

> **Operating principle:** This is an execution specification, not proof that any system is production-ready. Implement, test, measure, and record evidence. Keep the existing source untouched; build in a separate new folder and use controlled migrations. The user will supply Razorpay credentials in environment variables, but *other external accounts, provider credentials, Clerk credentials, secrets, cloud access, domain setup, and commercial approval are still required as applicable*. Do not fabricate secrets or claim deployment is complete without them.

---

## A. NON-NEGOTIABLE GOAL

Deliver an independently deployable Compass Router platform in which users authenticate through Clerk; manage organizations, teams, projects and scoped Compass API keys; browse accurate dynamically synchronized model catalogs without hosting inference models; buy and spend prepaid credits; use Compass OpenAI-compatible APIs; receive genuine incremental streaming; and view auditable, consistent tokens, charges and balances. Allow OpenRouter as the first live inference aggregator and retain the existing LiteLLM/direct-provider abstraction for future optional routes. Use PostgreSQL, Redis, Cloud Run-compatible containers, comprehensive tests, structured observability, secret protection and repeatable database migrations.

**Successful customer journey:** Clerk signup/login → Compass account provisioned → create/select tenant/project → create restricted Compass API key → view currently eligible models and transparent prices → Razorpay top-up confirmed by verified webhook → authenticated model inference via Compass gateway → streamed response → exact usage and wallet settlement → account shows correct history and balance.

**Commercial guardrail:** Before accepting real customer money, confirm upstream providers' resale/commercial terms, applicable taxes/GST/invoicing requirements, privacy and retention disclosures, payment-provider onboarding and applicable compliance. No AI service guarantees zero data exposure: prompts and supporting context sent to upstream inference providers leave Compass infrastructure.

---

## B. REPOSITORY BASELINE AND EVIDENCE

Canonical original repository reported by the user's 2026-10-08 read-only source audit:

`C:\Users\tohee\Desktop\Compass-Litellm-Router`

Audit baseline: branch `main`, commit `9d34810`, tag `compass-baseline-2026-10-08` (verify on disk; never assume current workspace is still this exact revision).

Canonical structures:

```text
Compass-Litellm-Router/
├── apps/
│   ├── api/                 # Python FastAPI; main.py, services.py, models.py, security.py, db.py
│   └── web/                 # Next.js Router customer/admin console
├── marketplace/            # Separate Next.js/NextAuth/Prisma marketplace & identity surface
├── compass-code/           # VS Code extension; OUT OF SCOPE, do not edit
├── packages/shared/        # Shared interface types (review before any change)
├── services/litellm/       # LiteLLM proxy configuration
├── infra/docker/           # Docker Compose and service configuration
├── docs/
├── tests/
├── cloudbuild-api.yaml
├── cloudbuild-web.yaml
└── cloudbuild-litellm.yaml
```

**Reported implemented or partially implemented:** auth and session/version logic, organizations/projects/teams, hashed API keys and scopes, BYOK encrypted credentials, model catalog/policy/discovery, LiteLLM/direct routing, chat/responses/embeddings, wallet reservations/ledger, Razorpay order/webhook/refund endpoints, usage, marketplace signed handoff, Docker/Cloud Build. **Not verified live:** identity delivery, provider calls, payment webhooks, deployed Cloud Run, accurate streaming and production authorization. **Known risks:** pseudo-streaming after completed responses, `create_all` + additive schema repair instead of versioned migrations, incomplete email outbox worker, catalog/adapter mismatch, marketplace NextAuth identity divergence.

Audit documents to retain in new copy: `AI_HANDOFF_SUMMARY.md`, `API_INVENTORY.md`, `DATABASE_SCHEMA.md`, `FEATURE_MATRIX.md`, `PROJECT_ARCHITECTURE.md`, `PROJECT_DISCOVERY_REPORT.md`. These are secondary evidence; current source and reproducible tests are authoritative.

**Never work in** nested snapshots `CompassUnified`, `controlled-beta-work` or generated artifacts as though they were the canonical implementation.

---

## C. MASTER PROMPT — GIVE THIS ENTIRE FILE TO CODEX

You are the principal engineer, security reviewer, QA lead and deployment engineer for **Compass Router Production**. Read this entire document and the repository before writing code. Your job is to make a **new, independent working copy** of the existing repository and incrementally deliver the production-ready Compass Router platform described here. Do **not** create a greenfield rewrite. Preserve existing validated functionality, API compatibility, tenant boundaries, billing integrity and data migrations. Make all changes in the copied workspace only.

### Mandatory behavior

1. **Discovery first:** inspect the canonical root, `git status`, current manifests, database, API routes, web routes, tests, build setup, deployment files, and audit documents. Produce factual baseline notes. Do not assume the audit is still current.
2. **No original changes:** create a separate new folder, prove copied files are the intended baseline, initialize/continue Git in the copy, and make a `baseline` branch/tag or equivalent rollback point. Do not edit `compass-code` or unrelated applications.
3. **Preserve history and data:** never drop tables or reset a database containing existing records. Work against a fresh isolated dev database; test migrations against a sanitized backup. Do not silently move actual production data.
4. **One vertical slice at a time:** implement a small verified end-to-end change, run relevant automated tests, fix regressions, document evidence, and only then start the next slice. Never mark a phase complete based on files alone.
5. **Source of truth:** rely on actual code, installed library APIs, current vendor documentation and executable tests. Do not make up Clerk methods, OpenRouter fields, Razorpay payloads, or Cloud Run services.
6. **No mock success in production:** disable all fixtures, fake balances, seeded credentials, test-response modes, mock streaming and permissive admin bypasses in production. Fail closed on misconfiguration.
7. **Strict auth boundaries:** Clerk authenticates human website sessions; Compass authorizes tenants/projects and authenticates customer inference API keys. Don't make Clerk keys or platform provider secrets available to untrusted clients.
8. **No secret leakage:** do not print env values, keys, tokens, passwords, personal user records, provider responses containing sensitive data, webhook secrets, or payment details in reports or logs. Commit `.env.example` only, never `.env`.
9. **Credential-dependent tasks:** implement and test with sandbox/test credentials if supplied. If real Razorpay/Clerk/provider/cloud access is not supplied, finish all possible source/config/test work and clearly mark live integration as BLOCKED, not complete.
10. **Security in depth:** tenant isolation, least privilege, database transactions, idempotency, auth rejection tests, rate limiting, conservative upstream failover, secret rotation, audit logs, and threat review.
11. **Contract stability:** retain existing routes and response schemas where possible. If change is necessary, make versioned migrations or backward-compatible adapters and update API docs/tests.
12. **Execution logs:** create and maintain `IMPLEMENTATION_PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`, `TEST_RESULTS.md`, and `DEPLOYMENT_READINESS.md` in the new workspace. Record exactly what changed, evidence, status, and next steps.
13. **Verify before shipping:** no production-ready claim before acceptance gates at section P pass, including real provider, payment sandbox, auth flows, concurrency and deployed smoke tests.
14. **Do not request prompts repeatedly:** this file is the master specification. Work through milestones in order. Ask the owner only for genuine business decisions or credentials required for a blocked external step. Keep incremental status clear.

---

## D. COPY-TO-NEW-FOLDER PROCEDURE (WINDOWS / POWERSHELL)

**Default suggested destination:** `C:\Users\tohee\Desktop\Compass-Router-Production`.

The final folder name is configurable; avoid overwriting an existing folder. Prefer Git clone of the local repository for a clean tracked-files copy, then copy any needed *nonsecret* audit documents separately. Cloning a local Git repository preserves committed history but **does not copy uncommitted changes**. If the original includes work needed for production, identify it, review it, and transfer it deliberately—never silently omit it.

### Safe option 1 — local Git clone (preferred)

```powershell
$Source = 'C:\Users\tohee\Desktop\Compass-Litellm-Router'
$Target = 'C:\Users\tohee\Desktop\Compass-Router-Production'
if (-not (Test-Path $Source)) { throw "Source repository not found: $Source" }
if (Test-Path $Target) { throw "Target already exists. Choose a new directory." }
git -C $Source status --short
git -C $Source rev-parse HEAD
git clone --no-hardlinks "$Source" "$Target"
git -C $Target switch -c feat/production-clerk-router
Write-Host "Copied tracked repository to $Target"
```

Audit uncommitted/untracked source files separately. Do not copy `.env`, provider credentials, payment keys, local databases, `.venv`, `node_modules`, `.next`, `.git` from third-party snapshots, or compiled secrets. Copy nonsecret local audit reports only after inspecting their contents.

### Safe option 2 — filesystem copy only when uncommitted work is essential

1. Obtain the owner's approval after reviewing `git status` and identifying valuable uncommitted files.
2. Copy into a *nonexistent* target using `robocopy` with explicit exclusions (`.env`, `.venv`, `node_modules`, `.next`, `dist`, `build`, caches, local SQLite databases, snapshots and generated VSIX). Do **not** use `/MIR` or other flags capable of deleting destination content.
3. Verify file counts, diff and Git status; use `git init` only if there is no usable repository history.
4. Confirm the original remains byte-for-byte unchanged for tracked files (`git status`, hashes on representative critical files).

### Required outputs of copy milestone

- Source commit and source `git status` captured.
- New target path recorded.
- Clear record of any intentionally excluded/uncommitted files.
- Clean or explained Git state in target.
- A restore point/tag created in the copy.
- Source directory modification check performed.
- `compass-code` marked excluded from implementation scope.

**Never operate on a production database during copy or first-run tests.**

---

## E. TARGET ARCHITECTURE AND RESPONSIBILITY BOUNDARIES

```mermaid
flowchart TD
    C[Customer browser] --> W[Next.js Router Console]
    W --> CL[Clerk signup login MFA sessions]
    W --> API[Compass FastAPI]
    CL -. signed Clerk session .-> API
    K[API clients using Compass keys] --> API
    API --> AUTH[Clerk token verifier / Compass API-key verifier]
    AUTH --> POLICY[Tenant, project, scope, quota policies]
    POLICY --> ROUTER[Inference router and provider adapters]
    ROUTER --> OR[OpenRouter API]
    ROUTER --> LLM[Optional LiteLLM and direct providers]
    API --> CATALOG[Model catalog sync / pricing]
    CATALOG --> OR
    API --> WALLET[Wallet reserve settle ledger]
    API --> PAY[Razorpay payment and verified webhooks]
    API --> DB[(PostgreSQL)]
    API --> REDIS[(Redis)]
    API --> OBS[Audit logs metrics tracing]
```

### Core architectural decisions

- **Clerk:** authentication and human session lifecycle only. Clerk Organizations are **not** the source of truth for Compass tenant roles unless a separate deliberate migration decision is made. Default: existing Compass organization/team/project data remain authoritative.
- **Compass `User.id`:** stable internal identifier for all business foreign keys; add unique `clerk_user_id` or robust external identity mapping. Do not re-key customer data.
- **Separate authentication dependencies:** web endpoints accept and validate Clerk sessions; inference endpoints accept **Compass API keys**; admin endpoints enforce explicit Compass roles. Reject ambiguous credential confusion and unintended dual-auth escalation.
- **OpenRouter:** catalog and primary inference aggregation provider at MVP. Compass does not host LLM weights or inference servers. Direct-provider/LiteLLM paths remain available only if verified/configured.
- **Router gateway:** the only place that holds platform provider keys, checks spend policies, performs inference accounting and records charges.
- **Payments:** Razorpay credits the wallet **only after cryptographic verification and server-side payment status confirmation**, never after a browser redirect alone.
- **Database:** PostgreSQL primary production store with SQLAlchemy and Alembic; Redis for cache/rate-limit primitives, not the financial source of truth.
- **Pricing currency:** existing schema reportedly stores paise per 1,000 tokens; preserve and explicitly document units, currency conversion, rounding and provider cost vs customer charge. Use integer minor units or Decimal; never use binary floating-point for wallet arithmetic.
- **Isolation:** web/marketplace/Router may have separate origins; configure Clerk trusted origins and FastAPI CORS strictly. Never rely on client-supplied tenant IDs alone for authorization.

---

## F. PHASE 0 — BASELINE, VERIFICATION, AND ISOLATION

**Tasks**

1. Implement safe copy as section D, verify original untouched.
2. Inventory actual route methods, schemas, auth dependencies, provider adapters, catalog sync jobs, wallet SQL operations, webhook signatures, config and test utilities.
3. Confirm exact Next.js major version and router mode, Python/FastAPI dependencies, Clerk SDK compatibility, marketplace auth integration, DB schema and project/organization ownership.
4. Run existing typecheck/lint/unit/integration tests against isolated local services, capture failures honestly.
5. Establish `compose` dev environment with synthetic test records and production-safe configuration defaults.
6. Identify unknowns: real provider adapters, account lifecycle, pricing rules, payment states, existing customer migration options.
7. Create threat model, dependency lockfile/SBOM baseline, secure secrets plan, and prioritized backlog.

**Acceptance:** repeatable clean builds/test baseline; documented gap list and rollback point; no modification to canonical original.

---

## G. PHASE 1 — VERSIONED DATABASE MIGRATIONS (BEFORE CLERK SCHEMA WRITE)

**Tasks**

1. Add Alembic and a reproducible initial revision matching the *actual* current canonical schema. Distinguish fresh install from pre-existing DB adoption; don't blindly `stamp head` without verifying matching schema.
2. Remove the requirement for risky uncontrolled production `create_all` + startup DDL repairs. Guard legacy bootstrap behind explicit development-only mode during transition; replace with migration execution in deployment jobs.
3. Add unique external identity mapping (`User.clerk_user_id` nullable initially or separate `ExternalIdentity` table) without changing `User.id`.
4. Audit unique constraints and indexes for API key prefixes/digests, provider attempt IDs, ledger event idempotency, payment orders and webhook event identifiers.
5. Introduce migration tests for empty DB and anonymized legacy populated DB; include forward/backward recovery with backups and destructive migration approval gates.
6. Document deploy ordering: backup → expand migration → compatible app release → data backfill → validation → optional contract migration later.

**Acceptance:** clean install and existing-schema upgrade both pass; no lost FK linkage, wallets or keys; migration plan verified on sanitized backup.

---

## H. PHASE 2 — CLERK SIGNUP, LOGIN AND IDENTITY MIGRATION

### Implementation requirements

1. Create Clerk development and production applications **in user's Clerk account** (manual external provisioning may be necessary); configure allowed domains/origins, OAuth providers, email verification, MFA policies, sign-in/sign-up routes, secure cookies and session lifetimes.
2. Add `@clerk/nextjs` to `apps/web` using the installed Next.js version's *current* officially documented pattern. Use `ClerkProvider`, sign-in/up UI or hosted auth, resource-level `auth()` checks, correct middleware/proxy filename for installed Next.js version. Client route hiding is not authorization.
3. FastAPI: verify Clerk session tokens using Clerk's current supported Python backend SDK or standards-compliant JWT/JWKS validation; validate signature, permitted algorithms, issuer, expiry, not-before and correct audience/authorized party where applicable. Cache JWKS with key rotation handling; fail closed.
4. Maintain Compass-internal user and tenant access state. New user first access: transactionally resolve by `clerk_user_id`; if none, provision Compass user and default account resources idempotently. Email change must **never automatically transfer ownership**.
5. Existing customers: design a reviewed link flow requiring proof of prior Compass ownership and new Clerk authentication. Restrict email-based matching to verified addresses and authenticated/approved linking; do not auto-merge based merely on equal emails.
6. Sync account lifecycle using Clerk signed webhooks (`user.created`, `user.updated`, `user.deleted` where relevant); verify raw-body signature, dedupe deliveries, tolerate out-of-order delivery, and reconcile on first login. Define whether deletion soft-deactivates Compass accounts and retains legally required billing records.
7. Protect web routes, API routes, dashboard, keys, wallet, billing, provider credentials and admin screens at the resource level. Reject cross-tenant access.
8. Ensure `/v1/*` inference endpoints continue accepting Compass keys with no dependence on browser Clerk cookies. Define exactly which non-inference APIs require session vs API key.
9. Do not remove legacy login flow until all active users are linked or the owner authorizes migration cutoff. Disable unsafe public auth fallbacks in production.
10. Marketplace: keep existing signed SSO while the Router moves to Clerk, or migrate marketplace identity to the same Clerk tenant as a **separate explicitly approved milestone**; never silently replace NextAuth across the second app.

### Tests

- Signup, verification, login, logout and session expiry.
- Wrong issuer/audience/signature, revoked/expired session, unauthenticated dashboard denied.
- Idempotent provisioning across repeated logins and webhook redelivery.
- Two different Clerk users cannot access each other's Compass resources.
- Migrated account retains original project IDs, API keys, wallets and ledger.
- Customer inference key continues functioning while Clerk website session expires.
- Clerk unavailable: existing authenticated requests behave according to defined fail-safe, not permit-all.

**Acceptance:** users securely sign in through Clerk; FastAPI recognizes their mapped Compass identity; all existing authorizations and financial relationships remain intact.

---

## I. PHASE 3 — TENANTS, PROJECTS, API KEYS, AND ADMIN AUTHORIZATION

1. Audit `Organization`, `OrganizationMember`, `Project`, `Team`, `TeamLimit`, `ApiKey`, `ApiKeyModel` and role-related access paths.
2. Enforce explicit tenant/project ownership checks on every read/write API and admin action. Use deny-by-default resource dependencies and DB-scoped queries.
3. Keep API keys cryptographically random, shown once, stored hashed, scoped to a project/account, revocable, expiration-aware, model-allowlist-aware and optionally key-level spend/rate limited. Never return full keys in list responses.
4. Define key rotation process (create new key → overlap with limits → revoke old), audit events, prefix display, last-used timestamps, and expired/revoked rejection tests.
5. Rate-limit signup abuse, token verification, key creation, key misuse, inference and administrative actions; consider Redis availability and behavior on failover.
6. Ensure web session identity cannot be forged with headers such as `X-User-ID`, `X-Project-ID` or an unverified JWT claim.
7. Keep admin and service-to-service credentials separate from customer keys and Clerk sessions; enforce admin RBAC on provider credential and pricing changes.

**Acceptance:** auth/tenant matrix has tests for allowed, denied, revoked, expired, cross-tenant, inactive and exhausted-budget cases.

---

## J. PHASE 4 — DYNAMIC MULTI-PROVIDER MODEL CATALOG

### MVP source of truth

OpenRouter public/provider model metadata (`GET https://openrouter.ai/api/v1/models`) is the primary external catalog source. Do not manually hardcode model inventory or prices. Preserve local fields for Compass eligibility, tier, markup policy, verified routing path and provider health. A catalog entry does not guarantee request availability.

### Sync service

1. Implement a scheduled and on-demand sync job with reasonable rate limits, exponential backoff/jitter, timeouts, last-success timestamps, etag/revision if supported, cache TTL, and last-known-good catalog on temporary API failure.
2. Normalize names, unique upstream IDs, provider/source IDs, description, context length, capabilities/modalities, tool support, supported parameters, raw upstream pricing and the data source/update timestamp.
3. Keep raw fetched catalog snapshot/version for audit. Validate schema, detect adds/deprecations/price changes, flag removed entries for review rather than silently deleting records referenced by billing history.
4. Support filtering by provider, enabled/routable state, context length, capability, text/image/audio modality, tool calling, pricing, status and policy.
5. Convert provider rates to clearly labeled customer-visible prices through a central versioned pricing policy; do not assume prompt/completion are the only billable dimensions (cached, reasoning, image, audio and other units vary by provider/model).
6. Restrict `GET /v1/models` to models the particular account/key can actually route to. Display unavailable models separately if catalog exploration includes them; never imply they are ready for paid inference.
7. Add price change alerting, source timestamp in the UI, minimum charge/rounding policy, and transparent disclosure of markups/platform fees/taxes.
8. Provider direct adapters and LiteLLM configuration remain separate from catalog ingestion. Each enabled model needs a successfully validated route or explicit disabled state.

### Catalog tests

- Parsing new/unknown provider fields without outage.
- Correct source and customer price units (per token vs per million; INR/paise vs USD).
- Partial outage serves labeled stale catalog without enabling unverified routes.
- Deprecated model migration and request errors.
- Model policy/key restrictions reflected in `GET /v1/models`.
- UI has no static model inventory or fabricated availability.

**Acceptance:** scheduled OpenRouter sync updates real catalog; active listed models have verified support; customer prices are consistent across UI, inference preflight, and billing.

---

## K. PHASE 5 — AI GATEWAY, REAL STREAMING AND ROUTING

### Supported core APIs

Preserve existing contracts where possible: `GET /v1/models`, `POST /v1/chat/completions`, `POST /v1/responses`, account/status routes; keep embeddings/image/audio/batch endpoints capability-gated until individually proven. Generate up-to-date OpenAPI documentation and contract tests.

### Request flow

1. Authenticate Compass API key; resolve user/org/project, expiration, scopes, model allowlist, spend constraints.
2. Validate payload and selected model's actual modalities/parameters (including tools); enforce size limits, abuse protections and safe request identifiers.
3. Select eligible configured provider route (start with OpenRouter); use LiteLLM/direct fallback only for tested equivalent functionality, privacy policy and cost rules.
4. Atomically check wallet/concurrency budget and reserve an appropriate conservative amount before provider execution; define max-output-token budgeting and adjustments.
5. Send upstream request, with `stream=true` when requested. **Forward incremental chunks as received** with bounded buffering/backpressure, heartbeats as necessary, cancellation and timeouts; preserve content deltas, reasoning-related fields as permitted, tool-call IDs/arguments and final finish reasons.
6. Do not buffer the whole upstream response before emitting chunks. Do not advertise pseudo-streaming as live.
7. Record provider attempts, request/trace ID, final status, eligible retries, usage metadata and actual billed cost. Sanitize logs to avoid prompts/secrets by default.
8. Reconcile reservation once per logical request, record actual charge (including cached/image modalities), release unused budget, and expose final usage to client where supported.
9. On errors, cancellation and client disconnect: account only for verified provider-billed usage, recover unknown final usage through provider lookup/reconciliation where available, and track unresolved transactions for operations. Never blindly charge estimated full tokens as final cost.
10. Define retry/fallback with idempotency/ambiguity safety: **do not retry automatically** after ambiguous delivery of a billable provider request unless duplicate prevention/cost rules are proven. A failed stream may have already incurred charges.
11. Enforce customer/request/provider circuit breakers, health checks, rate and concurrency limits, request timeout, high-cost alerting, and abuse detection.

### Streaming tests

- First bytes appear before upstream request completes.
- Partial tool-call arguments join correctly; streamed and nonstreamed outputs are semantically compatible.
- Stop/cancel releases unused reservation and records truthful charge state.
- Invalid model, disabled key, low wallet balance fail before upstream call.
- Rate-limited/upstream 5xx/retry paths avoid duplicate debits.
- Parallel calls cannot exceed spend/concurrency ceilings.

**Acceptance:** controlled live/sandbox provider test proves valid streamed inference, tool calls, cancellation, provider usage and exactly-once customer settlement.

---

## L. PHASE 6 — WALLET, PRICING, RAZORPAY AND FINANCIAL CORRECTNESS

### Ledger and charging

1. Retain existing `WalletAccount`, `WalletLedger`, `PaymentOrder`, `PaymentEvent`, `PaymentRefund`, `BillingInvoice`, `LlmRequest` and `ProviderAttempt` relationships. No destructive rewrite.
2. Document currency: INR/paise if wallet uses paise; preserve USD source rates separately. Use trusted, versioned FX conversion with timestamp and fees if underlying usage billed in USD. Clearly distinguish upstream cost, customer charge, service margin, tax, FX and provider gateway fees.
3. Use a **transactional append-only ledger** of top-ups, holds/reservations, releases, debits, refunds and admin adjustments. Keep an auditable, reconstructible balance and versioned cost formula. Store integer minor units/Decimals.
4. Reserve under lock or serializable accounting protocol. Validate balance even with concurrent API requests, multiple workers and retries. Every financial event gets stable idempotency key and constraints.
5. For partial/incomplete streams, track `pending_reconciliation` explicitly rather than guessing cost. Build a recovery/reconciliation job.
6. Never allow requests to continue unbounded when wallet, rate-limit or critical billing persistence systems are unavailable.

### Razorpay lifecycle

1. Credentials supplied by owner through secret configuration: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (**exact variable naming must align with current code/config**). No hardcoding.
2. Separate sandbox/test and production modes with separate secrets and payment environment labels.
3. Create server-side order for exact configured amount/currency and owner; persist merchant order ID, payment IDs, state and idempotency reference.
4. Validate payment signature according to Razorpay's current official protocol; validate webhook signature against **raw request body**, accepted event types, owner/order, expected currency and amount, and payment status via trusted verification when needed.
5. Browser checkout success/callback must not credit the wallet on its own; webhook or server-verified capture/paid confirmation triggers one idempotent credit.
6. Handle duplicate webhooks, reordered events, partial captures, pending/failed payments, timeouts, refunds, partial refunds, disputes and chargebacks. Protect from double credit and negative wallet drift.
7. Implement real invoice/tax document generation or explicitly defer invoicing behind a controlled launch gate; don't label drafts as tax-compliant invoices.
8. Provide finance/admin reconciliation views, signed webhook event audit, daily reconciliation job and alerting for mismatches.

### Financial tests

- Duplicate payment event credits once.
- Forged webhook rejected.
- Wrong amount/currency/order/user rejected.
- Concurrent settlement and top-up never produce inconsistent balance.
- Refund and chargeback reverse correct ledger entries.
- Zero/negative/top-up amount and integer overflow rejected.
- Provider cost versus customer billed cost independently traceable.
- Failed/cancelled inference no invented final usage.

**Acceptance:** in Razorpay test mode, an end-to-end order, verified webhook, wallet top-up, inference debit, refund/reconciliation and audited customer balance all pass. Production real-money smoke requires owner authorization.

---

## M. PHASE 7 — WEB CUSTOMER PORTAL AND ADMIN

Use existing `apps/web` component system rather than replace the UI. Eliminate static data and no-op controls by wiring to real backend endpoints.

### Customer screens

- Public landing/pricing/docs, discover models with search/filter/capabilities/last-synced time; no fabricated availability.
- Clerk signup/login/verify/reset; session-aware dashboard and profile.
- Organization/project/team selector, member roles, key creation, key revocation and per-key models/budgets.
- Model details with upstream source, context, capabilities, current customer rates, notices and verified inference eligibility.
- Wallet with balance, holds, top-ups, ledger and disputes/refund status.
- Razorpay checkout and server-confirmed transaction receipt; distinguish pending from successful top-up.
- Usage analytics by time period, project, key, model, tokens, customer cost and provider category.
- BYOK management: add, validate, delete (never re-display plaintext), routing and fee policy.
- API documentation and copyable example requests against Compass URLs.
- Account support, data export, deletion/retention request workflow, privacy terms and billing explanations.

### Admin screens

- Tenant/user/resource access with RBAC, account suspension, credit-risk flags and audit trail.
- Provider routes, credential status (never plaintext), health, circuit breakers, model sync, model enable/disable and pricing policies.
- Failed requests, unsettled ledger items, payment webhook/reconciliation jobs, error dashboards and configuration/version diagnostics.
- Emergency disable flags per model/provider/tenant and controlled refund/admin adjustments with audit requirements.

### UX acceptance

- Buttons execute implemented actions with loading/error/success feedback.
- Pages enforce server-side permissions and do not leak other tenant data.
- Responsive, keyboard-accessible forms; no hardcoded prices/keys/balances.
- Production build, accessibility smoke, authentication navigation, signed-out behavior and payment flow tests pass.

---

## N. PHASE 8 — SECURITY, RELIABILITY, DATA PROTECTION, OPERATIONS

1. TLS end to end, fixed trusted HTTPS origins, CORS allowlist, secure cookies, no token leakage in query strings, CSRF protection where cookies used, CSP and security headers.
2. Centralize identity dependencies and explicit permission checks. Cover BOLA/IDOR for every organization/project/team/user/key/wallet route.
3. Store Clerk, Razorpay and upstream secrets in Secret Manager or equivalent; `.env` only for isolated local dev, never committed. Separate test/staging/production keys; formal rotation/runbooks.
4. Audit existing BYOK Fernet key derived from application secret: assess rotation and safe independent envelope/key hierarchy with backwards-compatible migration; secrets encrypted at rest and not returned to UI.
5. PostgreSQL managed backups, PITR where available, migrations only through controlled job, least-privilege DB users, connection pooling and lock/timeout management.
6. Redis authenticated/private, non-authoritative financial cache; safe behavior when unavailable.
7. Restrict admin and internal/test routes from public ingress, disable local test shortcuts, enforce production settings validation.
8. Upstream safety controls: egress allowlisting as appropriate, SSRF protection, webhook ingress validation, timeouts, payload constraints, quota ceilings, model/provider disabled states.
9. Observability: structured request IDs, provider attempt IDs, ledger IDs, OpenTelemetry metrics/traces where justified, high-cardinality safeguards, PII redaction, alerts on failed payments, usage-settlement gaps, 5xx, streaming failures, sync staleness, fraud spikes and exhausted upstream funds.
10. Privacy retention: document what prompts/outputs are retained (prefer metadata only), customer data exports/deletion, provider retention terms, jurisdiction compliance and disclosure.
11. CI: Python lint/type/tests, TS lint/type/build, migration upgrade tests, contract tests, dependency scanning, secret scanning, container vulnerability scans, license checks, reproducible locked dependencies.
12. SLO/runbooks: availability/latency targets, incident response, backfill/ledger reconciliation, provider outage, Clerk outage, payment outage, rollbacks and restore drills.

**Acceptance:** security review/high-severity tests pass; no default secrets, internal test routes, unsafe admin routes or log leaks in production configuration.

---

## O. PHASE 9 — GCP CLOUD RUN DEPLOYMENT PLAN

### Proposed production topology

- Next.js `apps/web` container on Cloud Run or managed frontend hosting; custom domain and TLS.
- FastAPI `apps/api` on Cloud Run behind controlled ingress / load balancer as needed.
- LiteLLM on separate Cloud Run service **only if required** by verified routing paths; alternatively disable it and route through authenticated direct OpenRouter adapter.
- Cloud SQL PostgreSQL for state and financial ledger.
- Managed Redis/Valkey service as supported for caching/quotas.
- Secret Manager for Clerk, Razorpay, upstream provider keys, DB credentials, internal auth secrets.
- Cloud Scheduler + authenticated Cloud Run Jobs/services for model sync, reconciliation and periodic cleanup; workers with explicitly scoped service identities.
- Artifact Registry, Cloud Build CI/CD, Cloud Logging/Monitoring and alerts.

### Infrastructure-as-code and deployment

1. Create checked-in declarative configuration (Terraform or agreed equivalent), per-environment variables, least-privileged service accounts and explicit resource naming.
2. Use staging and production isolation for Clerk instances/keys, Razorpay test/live keys, provider accounts, database, caches and domains.
3. Define `Dockerfile`s, startup and readiness checks, concurrency, memory, CPU, timeouts, graceful cancellation, health and private network wiring.
4. Cloud Run request-timeout design must support long model streams; test proxy buffering and client disconnect behavior across domain/load-balancer tiers.
5. Build immutable versioned images, provenance/SBOM, branch protection, automated smoke tests and phased rollout/canary/rollback.
6. Apply expand migrations before compatible deployment, check DB migration state before serving traffic; keep documented rollback/snapshot recovery.
7. Provision Clerk trusted domains, redirect URLs and webhook destination for staging/live; verify routes after DNS/TLS is ready.
8. Configure Razorpay webhook endpoints and HTTPS, enter keys in Secret Manager/env references, run Razorpay sandbox tests before switching to live keys.
9. Configure upstream provider access and commercial account funding: platform OpenRouter API key and any other enabled provider keys. Without these, inference cannot be demonstrated as live.
10. Run external smoke tests after deployment: authentication, catalog, API key, model call with usage, wallet settlement, Razorpay test payment, admin denial, streaming and observability.

**Owner-supplied prerequisites:** Google Cloud project with billing enabled and IAM approval; production DNS/domain access; Clerk account + application publishable/secret key and webhook signing secret; Razorpay account/test/live credentials and webhook secret; OpenRouter/provider account/API key and available prepaid balance; mail/domain configuration if email features beyond Clerk are needed; legal/commercial policies and tax/accounting details. For security, do not ask owner to paste secret values into chat or Git. Support secure console/Secret Manager entry.

**Acceptance:** staging end-to-end suite passes on actual cloud URL; production rollout has rollback, dashboards and alerting; live payments/inference only enabled on explicit owner sign-off.

---

## P. END-TO-END TEST MATRIX AND RELEASE GATES

### P1 — Identity and tenancy

- [ ] New Clerk customer signup/login, verified email, logout, expired/revoked session.
- [ ] Valid Clerk token accepted only by authorized web APIs.
- [ ] Invalid signatures/issuer/audience and spoofed user IDs denied.
- [ ] Account bootstrap and webhook redelivery idempotent.
- [ ] Legacy users link safely; existing resources and balances preserved.
- [ ] Role and tenant isolation tests cover all sensitive endpoints.

### P2 — Keys, catalog, and inference

- [ ] API key create/list/revoke, expiration and model allowlist.
- [ ] OpenRouter catalog sync refreshes models/prices/capabilities; stale state labeled.
- [ ] Selected live models have verified backend execution paths.
- [ ] Unauthorized/disallowed/budget-exceeded inference rejected before upstream call.
- [ ] Live streaming begins before upstream completion; tool-calls and finish reasons preserved.
- [ ] Retry, timeout, cancellation, disconnect, 429/5xx and provider outage behavior verified.

### P3 — Wallet and payments

- [ ] Wallet hold/settlement/release correct under parallel load.
- [ ] Usage source and customer charges reconciled with auditable versioned rates.
- [ ] Test-mode Razorpay payment verifies and adds exactly one credit.
- [ ] Duplicate/forged/out-of-order webhook tests pass.
- [ ] Refund, failed capture, dispute and reconciliation tests pass.
- [ ] Negative balance and overflow protections verified.

### P4 — Platform security and deploy

- [ ] Secure build without hidden mocks, hardcoded secrets or insecure admin bypass.
- [ ] Alembic fresh install and legacy upgrade work on copied DB.
- [ ] OpenAPI, frontend and backend contract tests pass.
- [ ] Web lint/typecheck/build and API lint/typecheck/test pass.
- [ ] Production cloud infrastructure and secrets are validated; DNS/TLS working.
- [ ] Monitoring, alerting, backup restore and rollback smoke tested.
- [ ] Terms/Privacy/Billing policy/commercial resale acceptance confirmed.

### Definition of ready

A feature is **Implemented** only when its code exists and internal tests pass; **Verified** only after an end-to-end test in an appropriate environment; **Production-ready** only when security, telemetry, recovery, monitoring, legal/payment/provider prerequisites and deployment checks all pass. Record each status separately. A source-audit claim is never runtime proof.

---

## Q. RECOMMENDED MILESTONES, ORDER AND DEPENDENCIES

| Milestone | Contents | Dependency | Completion evidence |
|---|---|---|---|
| M0 | Copy workspace, baseline, tests, threat model | None | Original untouched, isolated repo and test baseline |
| M1 | Alembic baseline and identity mapping schema | M0 | Upgrade/recovery tests on copied DB |
| M2 | Clerk Router signup/login + FastAPI JWT + provision/link | M1 | Signup/logout/tenant/legacy-user tests |
| M3 | API-key and tenant authorization hardening | M2 | Cross-tenant and key-policy tests |
| M4 | OpenRouter catalog sync + pricing policies | M3 | Catalog sync, price units and route eligibility tests |
| M5 | Genuine inference streaming + routing | M4 | Live/sandbox streamed response + usage tests |
| M6 | Razorpay wallet/reconciliation and billing | M5 (can prep earlier) | Verified sandbox E2E and concurrency tests |
| M7 | Web customer/admin integration and accessibility | M2–M6 | No mocks; workflow browser tests |
| M8 | Cloud Run, infra, secrets, monitoring, release | M0–M7 | Deployed staging smoke + controlled prod sign-off |

**Critical path:** baseline → migrations → Clerk identity → authorization → routable catalog → streaming + usage → sound wallet charges → payment validation → production release. Parallelize UI styling or infrastructure bootstrap only when it cannot destabilize critical path.

---

## R. ENVIRONMENT VARIABLES AND SECRET CONTRACT

Create `.env.example` files with **names and nonsecret placeholders only**. Validate required variables at startup for each environment and document where each is used. Existing variable names take precedence; adapt examples rather than silently break current deployments.

```dotenv
# Deployment
APP_ENV=development
PUBLIC_WEB_URL=http://localhost:3000
API_BASE_URL=http://localhost:8000
DATABASE_URL=postgresql+psycopg://USERNAME:PASSWORD@HOST:5432/compass
REDIS_URL=redis://HOST:6379/0
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Clerk - supply from the owner's Clerk dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=REPLACE_ME
CLERK_SECRET_KEY=REPLACE_ME
CLERK_WEBHOOK_SIGNING_SECRET=REPLACE_ME
CLERK_JWKS_URL=REPLACE_ME_IF_REQUIRED_BY_CHOSEN_VERIFIER

# Inference - owner provides credentials; models never hosted by Compass
OPENROUTER_API_KEY=REPLACE_ME
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Razorpay - owner explicitly said keys will be added via env
RAZORPAY_KEY_ID=REPLACE_ME
RAZORPAY_KEY_SECRET=REPLACE_ME
RAZORPAY_WEBHOOK_SECRET=REPLACE_ME
RAZORPAY_MODE=test

# Secret management and operations
APP_SECRET_KEY=REPLACE_ME
BYOK_ENCRYPTION_KEY=REPLACE_ME_IF_SEPARATE_KEY_IMPLEMENTED
OTEL_EXPORTER_OTLP_ENDPOINT=
```

**Important:** `CLERK_JWKS_URL`, `BYOK_ENCRYPTION_KEY`, specific database driver formats, and Razorpay mode variable names are **illustrative**. Inspect currently installed SDK/config and implement the actually supported config contract; don't introduce unused env variables. `NEXT_PUBLIC_` is for Clerk's publishable key only, never its secret. The marketplace may need its own independent environment and migration plan.

Secrets should be entered locally into ignored env files or production Secret Manager. Application startup must reject placeholder values in production, reject `RAZORPAY_MODE=test` when live charging is enabled, and ensure production credentials are absent from logs.

---

## S. CONTINUOUS CODEX EXECUTION WORKFLOW

At every milestone:

1. **READ** this file and previous progress notes.
2. **DISCOVER** actual current code and relevant tests; read official API/SDK docs for affected external integrations.
3. **PLAN** a focused minimum-change implementation with risks and backout plan.
4. **IMPLEMENT** only this milestone in the isolated copy.
5. **TEST** automated unit, integration, contract and browser tests relevant to changes.
6. **VERIFY** observable behavior, not just status codes; capture logs with sensitive data masked.
7. **RECTIFY** failures and rerun until tests pass or blockers are documented.
8. **RECORD** changed files, migrations, commands, results, remaining gaps and external prerequisites in progress documents.
9. **CHECK** source original unchanged and `compass-code` out of scope.
10. **PROCEED** to next milestone after exit gates; stop before destructive migrations, live money movement or live production deployment pending owner's confirmation.

### Required progress report template

```markdown
## Milestone M# — NAME
Status: NOT STARTED / IN PROGRESS / CODE COMPLETE / VERIFIED / BLOCKED
Baseline commit:
Change summary:
Files changed:
Routes / schemas / migrations affected:
Tests executed and actual results:
Manual/live verification performed:
Security/privacy/financial implications:
External dependencies or secrets still needed:
Known defects or risks:
Rollback procedure:
Next milestone:
```

Do not call something complete based only on a test stub or hardcoded fixture. If a task cannot be exercised because credentials are missing, leave the implementation testable with mocks for CI **and** label live verification as pending.

---

## T. FIRST SESSION INSTRUCTIONS (START HERE)

The first execution should NOT begin by rewriting auth or provider architecture. It must:

1. Identify actual canonical repository and current Git state.
2. Create `Compass-Router-Production` as a **new nonexisting** folder by safe method in section D.
3. Confirm no original tracked-file modifications, no copied secrets, no source-file writes to `compass-code`.
4. Read current manifests, source entry points, source audit and tests in copied project.
5. Generate a concise implementation backlog aligned with milestones M0–M8.
6. Run existing non-destructive build/tests and capture a reliable baseline.
7. Record `IMPLEMENTATION_PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`, `TEST_RESULTS.md`, `DEPLOYMENT_READINESS.md`.
8. Implement M1 migrations only after baseline and migration strategy are checked; prepare Clerk schema linkage without adopting unsafe user-merging behavior.
9. Proceed phase by phase with objective gates; when external credentials or payment/deployment approvals are needed, pause that verification and continue independent tasks.

### What to report back to owner after first execution

- Working-copy path and Git branch/tag.
- Whether source has uncommitted work and how it was handled.
- Actual current technology/package versions.
- Findings contradicting the previous audit.
- Existing baseline test results.
- M0/M1 status with evidence.
- Exact nonsecret configuration prerequisites for Clerk, OpenRouter, Razorpay and GCP.
- Next implementation step with risks and acceptance tests.

---

## U. UNRESOLVED BUSINESS DECISIONS — ASK ONLY WHEN NEEDED

1. **Brand and domain** for Compass Router web/API; staging and live domain ownership.
2. **Clerk app setup:** approved OAuth methods, email verification/MFA, production session TTL and country restrictions.
3. **Marketplace identity:** keep current NextAuth + signed handoff temporarily (recommended) or authorize separate Clerk convergence after Router stabilization.
4. **Billing jurisdiction:** INR-only customer wallet vs multicurrency; taxes/GST, platform fees, FX and invoice requirements. Do not decide tax/legal policy from code alone.
5. **Credits policy:** prepaid money balance in minor currency units versus abstract credits; expiry/refunds/free-trial terms; no misleading pricing claims.
6. **Upstream account:** owner-provided OpenRouter key and funded account, accepted resale/commercial terms, which modalities/models to enable initially.
7. **Provider fallback rules:** privacy, region and exact pricing across alternate routes; disabled by default where uncertain.
8. **Production launch authorization:** owner explicitly approves actual payment live mode and cloud DNS release after staging gates pass.

**Safe recommended defaults pending owner answers:** single verified INR-denominated wallet, no credit expiry for paid wallet funds without an explicit legal/product policy, no surprise BYOK fees, OpenRouter text/chat models only for initial verified gateway route, one Clerk app for Router, unchanged Compass tenant model, unchanged marketplace identity until separate migration approval.

---

## V. PRIMARY EXTERNAL REFERENCE DOCUMENTATION

Verify versions and exact contracts in current official documentation at execution time:

- Clerk Next.js SDK / middleware and resource-level auth: https://clerk.com/docs/reference/nextjs/clerk-middleware
- Clerk Python backend authentication: https://clerk.com/articles/how-to-add-authentication-to-a-python-backend
- Clerk webhook verification: https://clerk.com/docs/reference/backend/verify-webhook
- OpenRouter model listing: https://openrouter.ai/docs/api/api-reference/models/get-models
- OpenRouter models: https://openrouter.ai/api/v1/models
- OpenRouter pricing and terms: https://openrouter.ai/pricing
- Razorpay official API/payment signature/webhooks: https://razorpay.com/docs/
- Alembic: https://alembic.sqlalchemy.org/
- Google Cloud Run: https://cloud.google.com/run/docs
- Google Cloud Secret Manager: https://cloud.google.com/secret-manager/docs

---

## W. FINAL DONE CRITERIA

**Do not declare Compass Router production-ready unless** all of the following have verified evidence: source copied cleanly; original untouched; migration recovery tested; Clerk signup/login and legacy identity mapping secure; tenant isolation and key controls verified; dynamic accurate routable model catalog; genuine live streaming from at least one actual upstream provider; deterministic usage and wallet settlement; Razorpay test webhook idempotency and invoice/payment policy reviewed; zero known high-severity security defects; immutable and reproducible CI builds; controlled secret storage; cloud staging with DNS/TLS/alerts and rollback; production access and money-moving operations only after explicit owner sign-off.

**Product principle:** reuse the substantial Compass Router implementation already in place; harden it rather than rebuild it. **Deployment principle:** the absence of externally supplied credentials cannot be fixed in code and must be recorded as a blocker, never concealed by synthetic success.
