# Compass Router Production Decisions

## D1 - Independent working copy

Decision: implement only in C:/Users/tohee/Desktop/Compass-Router-Production.

Reason:
The source worktree is dirty and contains unrelated snapshots, generated artifacts, and an already-developed VS Code extension. The master plan requires the original to remain untouched.

## D2 - Source baseline and overlay

Decision:
Clone tracked history from commit 9d34810294775aaef2ff210b00941fffd3d2fa0a, then deliberately overlay reviewed non-secret Router/API/web changes and audit documents from the source worktree.

Excluded:
- compass-code changes and generated extension artifacts
- CompassUnified and controlled-beta-work snapshots
- generated VSIX/media
- .env files, provider credentials, local databases, dependency directories, and build caches

## D3 - Authentication boundary

Decision:
Use Clerk for human website authentication in Phase 2. Preserve Compass internal User, Organization, Project, Team, API key, wallet, and billing records as the business source of truth. Do not re-key User.id or auto-merge users only by matching email.

Compass API keys remain the credential for /v1 inference APIs. Clerk sessions must not be accepted as inference credentials.

## D9 - Clerk session bridge and provisioning

Decision:
Use Clerk as the browser identity provider and map its stable user ID to the nullable `users.clerk_user_id` column. The web client keeps the Clerk token in Clerk-managed memory, bootstraps a Compass session for existing UI contracts, and calls Clerk sign-out before clearing local UI state.

Reason:
This preserves the existing Compass tenant, project, key, wallet, and billing contracts while preventing email-only account takeover. A matching existing email produces an explicit linking error until an approved linking workflow exists; it never transfers ownership automatically.

## D10 - Clerk webhook idempotency

Decision:
Verify Clerk webhooks with Svix against the raw request body and persist a unique `svix-id` event ledger before applying lifecycle changes. Duplicate deliveries return success without repeating provisioning or suspension work.

Reason:
Clerk delivery is at-least-once and webhook authenticity must be established before identity data changes. The event ledger makes redelivery behavior explicit and auditable.

## D4 - Provider strategy

Decision:
OpenRouter is the first live aggregator for catalog synchronization and verified inference. LiteLLM and direct-provider paths remain optional and disabled unless the route is tested, priced, and operationally supported.

## D5 - Financial source of truth

Decision:
PostgreSQL ledger records and transactional wallet operations remain authoritative. Redis may support limits and caching but never determines financial balance. Razorpay browser redirects cannot credit a wallet without verified server-side payment state.

## D6 - Migration strategy

Decision:
Add Alembic before adding Clerk identity data. Preserve the current schema and relationships, use expand-and-migrate steps, and test both an empty database and a sanitized populated database. Do not use startup create_all as the production migration mechanism.

## D7 - Streaming contract

Decision:
A request marked stream=true must not be advertised as live until upstream incremental chunks are forwarded before upstream completion. Existing buffered streaming is a known gap and will be replaced or explicitly disabled while the gateway is being hardened.

## D8 - Production claims

Decision:
Implemented, verified, and production-ready are separate statuses. Missing external credentials or live environments are blockers, not reasons to create fake success responses.

## D11 - Centralized tenant authorization and scoped removal

M3 authorization is centralized in `apps/api/app/authorization.py`. Organization membership is an explicit prerequisite for project and organization-bound team access. Removing a user from one organization revokes only that organization’s projects, teams, and extension sessions; global account suspension is reserved for users with no remaining active organization membership.

API keys validate organization, team, project-header, expiry, revocation, and model policy at the inference boundary. Team owners/administrators manage team keys and BYOK metadata; ordinary team members retain no mutation authority. Production Redis limiter failures fail closed to avoid an unbounded fallback under load.

