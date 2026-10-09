# Super Admin Architecture

## Trust boundaries

Clerk authenticates the human. FastAPI resolves the Compass user and authorizes
platform permissions from database state. The Next.js `/admin` workspace is a
presentation layer only. API keys, provider credentials, wallet entries, usage
records, and audit events remain owned by their existing domain services.

## Identity and bootstrap

The owner configures `PLATFORM_SUPER_ADMIN_CLERK_USER_ID` in the deployment
environment. The verified Clerk user first provisions an internal Compass user,
then calls `POST /admin/bootstrap` with the explicit confirmation string. The
singleton bootstrap row and active `PLATFORM_SUPER_ADMIN` assignment make the
operation idempotent. A revoked bootstrap state is terminal until an owner-led
recovery procedure changes it outside the application.

## Administrative data flow

The command center uses SQL aggregates over users, organizations, API keys,
requests, wallets, payments, providers, and audit records. Explorers use bounded
pagination and return metadata only. Wallet adjustments call the existing
append-only wallet ledger. Provider/model/routing writes use existing activation
gates and append pricing/routing revision snapshots.

## Runtime-safe settings

The database stores only an allow-listed set of non-secret runtime settings.
Clerk keys, database URLs, Redis URLs, provider credentials, Razorpay secrets,
SMTP passwords, and LiteLLM keys remain deployment-managed.

## Verification boundary

Local SQLite, compile, API, migration, typecheck, lint, and build tests prove
code behavior only. Live Clerk MFA, PostgreSQL/Redis, provider, Razorpay, GCP,
monitoring, and browser accessibility evidence remains a separate release gate.
