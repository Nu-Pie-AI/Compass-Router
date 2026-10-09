# Super Admin Operations Guide

## Provision the initial owner

1. Create or select the verified Clerk user and enable the required MFA policy.
2. Set `PLATFORM_SUPER_ADMIN_CLERK_USER_ID` and `PLATFORM_SUPER_ADMIN_REQUIRE_MFA=true` in Secret Manager/environment configuration.
3. Provision the Clerk identity into Compass through the existing Clerk flow.
4. Call `POST /admin/bootstrap` with the explicit confirmation body.
5. Confirm `GET /admin/access` and record the audit event.

The endpoint is idempotent only while the bootstrap state remains active. It
will not restore a revoked owner assignment.

## Routine administration

- Review the command center and readiness blockers before changing routes.
- Use provider controls only after credentials, adapter compatibility, health,
  and commercial approval are verified.
- Change model prices with a written reason; revision history is append-only.
- Use wallet adjustments only for corrections. Use a unique idempotency key and
  a compensating adjustment for reversals; never edit or delete old ledger rows.
- Inspect request logs by metadata and request ID. Do not expose raw payloads.
- Keep deployment-managed secrets outside platform settings.

## Emergency controls

Disable a provider or model through the governance endpoints, record the reason,
and verify route readiness. Use routing rollback only to restore a recorded
previous policy. Deployment rollback, database restore, and live payment action
remain owner-approved operations.
