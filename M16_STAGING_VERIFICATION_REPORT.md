# Compass Router M16 Staging Verification Report

Date: 2026-10-11
Branch: `staging/safe-deployment-2026-10-09`
Commit at start: `9dbe703`
Status: **NOT READY FOR STAGING DEPLOYMENT**

## Scope

M16 was executed only in `Compass-Router-Production`. The original repository,
public Cloud Run services, production Neon branch, payments, and VS Code
extension source were not modified. Existing untracked user artifacts were
preserved and were not staged.

## Repository and local verification

- Git branch and working-copy identity verified.
- Initial commit verified as `9dbe703`.
- Existing untracked artifacts remain preserved and untracked.
- Full backend regression: **127 passed**, one existing Pydantic deprecation warning.
- Web lint, typecheck, and production build: **passed**.
- VS Code extension check, 10 tests, and build: **passed**; no extension source was changed.
- Cloud Run template validation: **passed**, 3 templates.
- Cloud Scheduler FX template validation: **passed**.
- `git diff --check`: **passed**.

## Security hardening completed

- Production and staging human sessions now reject legacy password-session
  tokens before protected routes can use them; Clerk is required.
- This closes the organization-admin path that previously accepted a legacy
  session while platform-admin routes already required Clerk in production.
- Regression coverage proves a production-configured legacy session is denied.
- Scheduler preparation requires a staging target, POST, OIDC service account,
  bounded retries, and contains no credentials or database/Redis URLs.

## Neon isolation and migration

- The read-only verifier reached the configured pooled/direct Neon endpoints and
  rejected the target because protected customer/financial tables contain rows.
- Branch/project identity was not independently proven from authoritative Neon
  metadata in this workspace.
- Migration `j4k5l6m7n8o9` was **not run**. No database write, cleanup, or
  destructive operation was attempted.
- Required next step: owner provides a verified empty Neon staging branch or a
  newly isolated staging database, including authoritative project/branch
  identity. Only then may migrations and database integration tests run.

## Secrets and infrastructure

- Root `.env` is ignored and untracked; `.env.example` contains placeholders.
- Previously exposed Neon, Clerk, and Upstash credentials are treated as
  compromised. Rotation was not performed automatically.
- Secret Manager, Cloud Scheduler, service accounts, IAM bindings, Cloud Run,
  and deployment resources were not created.
- The OIDC Scheduler template is ready for owner-approved staging deployment;
  it still requires a dedicated service account, IAM, private/authenticated
  Cloud Run ingress, and `FX_REFRESH_JOB_SECRET` in Secret Manager.

## Live verification status

Not verified because external credentials, browser access, isolated database,
or owner approval are missing:

- Clerk sign-in, MFA, session revocation, organization invitations, and email delivery.
- Three live role portals and cross-tenant behavior on PostgreSQL.
- Real member inference, provider discovery/inference, streaming, and Credits settlement.
- BYOK behavior against a real provider.
- Authenticated Upstash multi-worker/concurrency and outage behavior.
- Razorpay sandbox, webhook, refund, and reconciliation.
- VS Code browser/device authorization and live revocation.
- Cloud Run, Secret Manager, logging, monitoring, DNS, rollback, and restore drills.

## Owner actions required

1. Rotate exposed Neon, Clerk, and Upstash credentials; update only secure local
   ignored configuration or Secret Manager.
2. Identify and provision an empty, non-production Neon staging branch/database.
3. Approve staging-only billable resources and provide GCP IAM, Clerk, SMTP,
   provider, Razorpay sandbox, and Upstash access as applicable.
4. After isolation is proven, authorize the staging migration and low-cost real
   provider smoke test.

Until these actions are complete, production promotion remains blocked.
