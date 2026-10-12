# Neon Migration Safety Report

Date: 2026-10-12
Target: configured Neon staging connection from the ignored local environment

## Read-only identity and schema checks

- Database: `neondb`
- Application schema: `compass`
- PostgreSQL server major version: 18
- Current Alembic revision: `a1b2c3d4e5f6`
- Current runtime schema is missing `compass.organizations.clerk_organization_id`.
- The repository migration graph has one head: `j4k5l6m7n8o9`.
- The SQL connection metadata does not independently expose the Neon project or branch name. The configured endpoint is expected to be the `Compass Router` `staging` branch, but that identity still requires confirmation in Neon project metadata or console.

No connection URL, credential, token, email address, name, API key, or provider secret was printed.

## Non-sensitive row audit

The following counts were obtained with read-only aggregate queries. No row contents were selected.

| Table | Rows |
| --- | ---: |
| `users` | 2 |
| `organizations` | 1 |
| `organization_members` | 1 |
| `teams` | 1 |
| `team_members` | 1 |
| `projects` | 1 |
| `project_members` | 1 |
| `provider_credentials` | 1 |
| `wallet_accounts` | 1 |
| `wallet_ledger` | 0 |
| `payment_orders` | 1 |
| `payment_events` | 0 |
| `payment_refunds` | 0 |
| `billing_invoices` | 0 |
| `llm_requests` | 0 |
| `api_keys` | 0 |
| `invitations` | 0 |

Additional classification signals:

- User roles are one `super_admin` and one `customer`.
- The single payment order is in `created` state; no payment event or refund rows exist.
- The payment order amount aggregate is 50,000 paise; the wallet balance aggregate is zero.
- No wallet ledger rows or LLM usage rows exist.
- The populated records were created in the same development-time window, but timestamps do not establish that they are disposable or that they belong only to the current owner.
- The provider credential table contains a credential reference record. Its secret material was not read.

## Migration chain review

The upgrade path from the live revision to repository head is:

`a1b2c3d4e5f6` -> merge `h2i3j4k5l6m7` (including `g1h2i3j4k5l6`) -> `i3j4k5l6m7n8` -> `j4k5l6m7n8o9`

The path adds API-key assignment/project policy tables, Clerk organization and invitation fields, pricing/FX fields, and FX quote/request snapshot structures. The live target is populated, so compatibility and preservation must be tested against an approved recoverable copy before execution. No downgrade, destructive operation, backup creation, or migration was attempted.

## Migration execution update

The owner confirmed the Neon Console identity: project `Compass Router`, branch `staging`, parent `production`, region AWS US East 2 (Ohio). A permanent child backup branch was created and verified:

- Backup branch: `staging-pre-migration-20261012`
- Parent: `staging`
- Neon branch ID: recorded in Neon Console; not copied into repository configuration
- Backup snapshot revision: `a1b2c3d4e5f6`
- Backup row counts matched the pre-migration staging audit.

The first migration attempt exposed two schema qualification/idempotency defects. The pending migrations referenced tables without the `compass` schema and could leave newly created objects while the Alembic revision remained unchanged. The migrations were corrected to use the PostgreSQL `compass` schema and to safely recognize the already-created objects; SQLite migration behavior remains covered by tests.

The reviewed chain was then applied successfully to staging:

`a1b2c3d4e5f6` -> `g1h2i3j4k5l6` -> `h2i3j4k5l6m7` -> `i3j4k5l6m7n8` -> `j4k5l6m7n8o9`

Post-migration verification passed:

- Alembic revision is `j4k5l6m7n8o9`.
- `compass.organizations.clerk_organization_id` exists.
- Existing user, organization, team, project, provider credential, wallet, payment, and usage counts are unchanged.
- Payment aggregate remains 50,000 paise with zero refunded; wallet and wallet-ledger aggregates remain zero.
- No rows were deleted, truncated, reset, or overwritten.
