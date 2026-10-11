# M12 Customer Requirements Audit

Updated: 2026-10-11

Scope: `C:\Users\tohee\Desktop\Compass-Router-Production` only. This audit distinguishes local implementation evidence from live external verification.

| Requirement | Current evidence | Status |
|---|---|---|
| BYOK zero Credits | Service paths skip reservation/settlement for BYOK; failed and streaming regressions cover the invariant | Implemented locally; live provider unverified |
| Signup Credits | Configurable, idempotent `signup_promotion` ledger grant with domain eligibility | Implemented locally; expiry blocked by aggregate-ledger design |
| VS Code project tagging | Project selector, `Others` fallback, warning, `X-Compass-Project-Id`, and server authorization | Implemented locally; live device/browser flow unverified |
| Admin API-key assignment | Scoped project/member/model/expiry controls, one-time secret, revoke/rotate, audit events | Implemented locally; PostgreSQL and live browser verification pending |
| Email member access | Invitation create/list/resend/cancel/accept, expiry, OTP, tenant and audit checks | Implemented locally; SMTP/Clerk delivery unverified |
| Member management | Add/remove/role/project/team access and status controls with organization-admin dependencies | Implemented locally; live tenant verification pending |
| Setup email guidance | Invitation/resend templates include login, OTP, VS Code, project and support instructions; no secrets | Implemented locally; SMTP delivery pending |
| Clerk web and extension auth | Clerk bridge, protected routes, verified-email provisioning, device authorization, refresh, revoke, secure storage | Implemented locally; live Clerk/MFA/session verification pending |
| Razorpay Credits | Signature/webhook/idempotency/refund/reconciliation paths and signed local regression coverage | Implemented locally; sandbox credentials and approval blocked |
| Credits terminology | Customer-facing Wallet wording replaced while internal wallet schema/routes remain compatible | Implemented locally |
| Provider analytics | Organization and platform aggregations include provider/model/project/member, tokens, cost, Credits, mode, failures and finality | Implemented locally; live data provenance pending |
| Security/tests | Cross-tenant, role, invitation, API-key, BYOK, billing, analytics and extension regressions; web/extension/infrastructure checks | Local evidence complete; live gates remain |
| Role portals | `/portal` derives destination server-side; `/super-admin` preserves platform console; `/admin` is company administration | Implemented locally; browser verification pending |

## Local verification evidence

- Backend: `python -m pytest -q` -> 116 passed, one existing Pydantic deprecation warning.
- Web: lint, typecheck, and production build passed; build generated `/portal`, `/admin`, and `/super-admin`.
- Extension: `npm.cmd run check`, `npm.cmd run test` -> 10 passed, and `npm.cmd run build` passed.
- Infrastructure: `python infra/gcp/validate_templates.py` passed; `tests/test_infrastructure.py` -> 4 passed.
- `git diff --check` passed.

## Evidence not available locally

Real Clerk signup/email verification/MFA/logout/revocation, invitation delivery, SMTP delivery, live provider inference/catalog, Razorpay sandbox, PostgreSQL/Redis concurrency, Cloud Run/Secret Manager/IAM, DNS/TLS, monitoring, rollback, and production payment verification remain external release gates. No live payment, deployment, production database mutation, or secret publication was performed.
