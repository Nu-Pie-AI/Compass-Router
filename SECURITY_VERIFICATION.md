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
