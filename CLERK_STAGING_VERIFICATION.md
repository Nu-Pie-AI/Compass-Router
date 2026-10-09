# Clerk Staging Verification

Updated: 2026-10-09

## Authentication boundary

- Clerk is the human identity provider for the web application and admin workspace.
- FastAPI verifies Clerk session tokens with the official Clerk backend SDK.
- The API accepts session tokens only and validates the configured audience and authorized parties.
- Compass maps the verified Clerk subject to its internal user, tenant, membership, project, and role records.
- Compass API keys remain a separate machine-to-machine credential for `/v1/*`.

## Required staging configuration

Configure these names through staging environment or Secret Manager. Values are intentionally omitted.

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY` (optional)
- `CLERK_AUDIENCE`
- `CLERK_AUTHORIZED_PARTIES`
- `CLERK_WEBHOOK_SIGNING_SECRET`
- `PLATFORM_SUPER_ADMIN_CLERK_USER_ID`
- `PLATFORM_SUPER_ADMIN_REQUIRE_MFA`

The API loads secret values server-side only. The web bundle may contain only the Clerk publishable key.

## Implemented local controls

- Clerk middleware protects `/dashboard`, `/admin`, and `/extension/authorize` when configured.
- Admin login uses Clerk SignIn when a publishable key is present; the legacy form remains for local compatibility mode.
- Production admin requests reject password-session administration and require Clerk authentication.
- Super Admin access requires the configured Clerk identity and, by default, a verified MFA claim.
- Owner bootstrap is explicit, singleton, audited, idempotent, and never grants access from first signup or email alone.
- Internal provisioning rejects a selected primary email unless Clerk reports it as verified.
- Clerk webhook processing uses Svix verification and a persisted event ledger for idempotent redelivery handling.

## Safe staging procedure

1. Use a dedicated Clerk development/staging instance, not the production instance.
2. Configure the staging web origin and redirect URLs.
3. Store the Clerk secret key, webhook signing secret, and exact owner Clerk user ID in staging Secret Manager or an ignored local `.env`.
4. Enable MFA for the intended owner and record the actual claim behavior in a staging browser session.
5. Configure the Clerk webhook endpoint and subscribe only to required user lifecycle events.
6. Test signup, verified email, login, logout, session rejection, owner bootstrap, and two-tenant isolation.

## Current evidence and blockers

- Local Clerk security tests and the complete Python suite pass.
- Web lint, typecheck, and production build pass with route protection included.
- The local root environment has test-prefix Clerk keys, but the owner ID is not configured and the webhook signing secret is a placeholder.
- No live Clerk browser, MFA, session revocation, webhook, staging DNS, or Cloud Run verification was performed.
- This proves code readiness only; it does not prove a production Clerk configuration.
