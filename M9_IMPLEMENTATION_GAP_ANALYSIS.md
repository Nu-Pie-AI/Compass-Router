# M9 Super Admin Control Center Gap Analysis

Updated: 2026-10-09

## Scope and boundaries

M9 is being implemented only in `C:/Users/tohee/Desktop/Compass-Router-Production`.
The original repository and the VS Code extension remain outside scope. Existing
M0-M8 APIs, tenant records, wallet ledgers, usage records, provider adapters, and
audit history must remain compatible.

## Existing reusable capabilities

- FastAPI, SQLAlchemy, Alembic, Clerk verification, session-version revocation,
  organization/project/team authorization, and audit logging already exist.
- Existing admin routes cover early provider, model, routing, user, wallet,
  billing reconciliation, readiness, audit, and operations views.
- Provider credentials are stored as server-side references and existing model
  and provider activation gates prevent unverified routes from becoming live.
- Wallet and payment state is already ledger-backed; M9 must call those services
  and must not introduce a second balance or billing ledger.
- Request usage records contain request, tenant, model/provider, token, cost,
  status, and latency metadata suitable for administrative analytics.

## M9 gaps found before implementation

| Area | Current state | M9 work required |
|---|---|---|
| Platform identity | `User.role` supports only customer/admin/super_admin and `admin_user` is broad | Add explicit platform roles/permissions, controlled Clerk-user bootstrap, subordinate-role enforcement, suspension checks, and high-risk reauthentication contract |
| Admin UI | Customer console components exist; no dedicated `/admin` route/layout | Add backend-driven admin shell, navigation, loading/error/empty states, and role-aware access handling |
| Command center | Basic counts only | Add bounded, filterable overview aggregations with truthful empty states and financial definitions |
| Customer operations | User list/status/role routes exist; no organization/project/key explorer | Add paginated read-only cross-tenant diagnostics and safe suspension/key metadata views |
| Provider/model governance | Early provider/model endpoints exist | Add provider health/credential metadata, model review/pricing revisions, and server-side validation while reusing existing adapters |
| Routing governance | Alias CRUD exists | Add validated policy summaries, rollback-safe revisions, and emergency disablement audit behavior |
| Finance administration | Customer billing/reconciliation exists; admin adjustments absent | Add append-only, idempotent manual credit adjustments and refund/reconciliation views using existing ledger/payment tables |
| Operations/security | Audit and basic metrics exist; request explorer absent | Add paginated metadata-only request logs, security event summaries, and bounded analytics |
| Platform settings | Runtime settings are environment-backed only | Add validated, non-secret database settings with audit and revision-safe updates |
| Verification | 76 isolated tests; no M9 coverage | Add authorization, cross-tenant, idempotency, redaction, UI build, and migration regression coverage; keep live gates explicit |

## Implementation order

1. Add platform role/permission and safe bootstrap data model plus migrations.
2. Centralize FastAPI platform authorization and add role-aware admin contracts.
3. Add backend-driven command center, customer, provider/model, routing, finance,
   request-log, security, and settings endpoints using bounded queries.
4. Add a dedicated Next.js `/admin` workspace consuming those contracts.
5. Add migration/API tests and documentation, then run the complete local suite.

## Safety constraints

- Bootstrap requires an explicitly configured verified Clerk user ID and is
  idempotent; it never re-grants a revoked owner role automatically.
- Frontend role checks are presentation only. Every admin API enforces server
  authorization from Compass database state and authenticated Clerk identity.
- Provider secrets, BYOK values, passwords, session tokens, and raw prompts or
  completions are never returned by admin APIs.
- Manual wallet changes use the existing wallet ledger transaction and require
  an idempotency key, reason, currency, amount validation, and audit event.
- No live payments, deployments, external account changes, or destructive
  migrations are performed by this implementation.

## External verification still required

Live Clerk MFA/claims, PostgreSQL concurrency, Redis behavior, provider health
checks, Razorpay sandbox, Cloud Run/Secret Manager, monitoring, browser
accessibility, and owner approval for live financial actions remain release gates.
