# Security Verification

Updated: 2026-10-09

- Provider secrets remain server-side settings, encrypted/GCP Secret Manager references, or approved platform credential records.
- Catalog raw metadata is persisted without provider credentials.
- Catalog synchronization is admin-controlled and does not activate or publish models.
- `/v1/*` continues to use Compass API-key authorization, tenant isolation, project context, model allowlists, wallet limits, and rate limits.
- OpenRouter is optional and no longer a production startup requirement.
- Unknown providers are `unverified` and cannot silently become routable.
- Jev credentials and routes are not present or activated.

## M9 platform controls

- Platform authorization is evaluated server-side from legacy admin compatibility mappings plus active `PlatformRoleAssignment` records. Client role fields are not trusted.
- The initial owner bootstrap is bound to `PLATFORM_SUPER_ADMIN_CLERK_USER_ID`, requires explicit confirmation and, by default, a verified MFA claim, and persists a singleton state so revocation cannot trigger automatic re-grant.
- Production admin endpoints reject password-session administration and require a Clerk-authenticated request. Super Admin requests require MFA claims when configured.
- Subordinate permissions are explicit: Finance Admin cannot read customer management, Support Admin cannot change providers/models, and Read-Only Auditor has no write permissions.
- Provider credentials are returned only as configured/last-four metadata. API keys expose prefixes and metadata only. BYOK secrets, passwords, session tokens, prompts, and completions are excluded from admin responses.
- Financial adjustments use `WalletLedger`, row locking, idempotency keys, positive/negative balance validation, reason text, audit records, and second-approver enforcement above the configured threshold.
- Pricing and routing revisions preserve previous policy snapshots and audit records; historical usage rows are not rewritten.

Not yet verified: PostgreSQL row/transaction behavior, Redis concurrency, Secret Manager deployment, live Clerk MFA validation, staging provider health, Razorpay sandbox, and Cloud Run IAM/logging.

## M11 Clerk security verification - 2026-10-09

- FastAPI Clerk authentication uses the official backend SDK and accepts only `session_token` credentials.
- Configured audience and authorized-party checks are passed to the SDK; unauthenticated Clerk state fails closed.
- Client-supplied IDs, roles, and email values are not trusted for authorization or provisioning. Internal mapping uses the verified Clerk subject, and provisioning requires a verified primary email.
- Production admin requests require Clerk authentication; Super Admin bootstrap and access require the configured Clerk identity and MFA claim when enabled.
- Human Clerk sessions and Compass API keys remain separate authentication domains.
- Clerk webhook verification is Svix-based with persisted idempotency state.
- Live Clerk browser, MFA, revocation, webhook, Secret Manager, and Cloud Run evidence remains outstanding.

## M12 portal authorization - 2026-10-11

- Portal selection is resolved server-side from active Compass platform permissions and organization membership.
- Company members do not receive organization-admin controls in the workspace UI; backend organization-admin dependencies remain authoritative.
- `/super-admin` is protected by the existing platform-admin API boundary; `/admin` delegates organization changes to organization-admin APIs.
- Local tests do not establish live Clerk token validation, MFA claims, session revocation, invitation identity proof, browser route protection, or deployment IAM. Those remain required before release.
## M13 team API key controls - 2026-10-11

- Clerk member inference is separate from machine API-key inference and rejects legacy session tokens.
- Member requests resolve key assignment server-side and attribute usage to the authenticated Clerk user/member.
- Raw Compass/provider credentials are not returned to the member browser or extension path.
- The refresh job supports constant-time application-secret checks; OIDC mode is permitted only behind authenticated Cloud Run ingress with `FX_REFRESH_IAM_AUTH_ENABLED=true`.

- Machine key secrets remain one-time responses and are stored as hashes; member assignment endpoints never return raw secrets.
- Member and project assignment writes require a team owner or organization administrator and validate team/organization scope server-side.
- Assignment tables use foreign keys, unique key/member and key/project constraints, active/revoked state, and timestamps.
- Safe member listings expose aliases and policy metadata only.
- Local regression covers idempotent duplicate assignment and cross-team rejection.
- Live Clerk identity, managed inference, extension, PostgreSQL, Redis, and log-retention verification remain staging gates.

## M14 Clerk and pricing controls - 2026-10-11

- Clerk invitation delivery is server-side and feature-gated; no secret is sent to the browser or stored in the invitation token path.
- Signed Clerk organization claims are required for organization membership reconciliation; removed Compass memberships are denied.
- Production rejects fixed local FX configuration so stale hardcoded conversion cannot silently bill customers.
- Credentials exposed in the user-provided `.env` content must be rotated; no credential values are recorded here.

## M16 isolated staging and authentication hardening - 2026-10-11

- Production/staging human requests reject legacy password-session tokens before protected route authorization; machine-to-machine Compass API-key routes remain separate.
- Organization administration is now Clerk-only in production/staging mode, matching the existing platform-admin and member-inference boundaries.
- Scheduler template validation confirms OIDC authentication, staging-only target placeholders, bounded retry settings, and no plaintext secrets.
- Repository checks found no committed live credential values outside documented placeholders/test fixtures; ignored local secrets remain outside Git and must be rotated because they were exposed during setup.
- Neon isolation, PostgreSQL transaction behavior, Redis runtime behavior, Clerk live claims/MFA, provider health, and deployment IAM remain unverified.

## M20 web security verification - 2026-10-12

- Protected web routes are guarded by Clerk middleware and redirect unauthenticated requests to `/login` with the original callback path.
- No raw server credentials are included in the web source or public route evidence.
- Authenticated tenant isolation, Clerk MFA/claims, key non-disclosure, provider secret handling, and cross-tenant browser checks remain pending live staging verification.
