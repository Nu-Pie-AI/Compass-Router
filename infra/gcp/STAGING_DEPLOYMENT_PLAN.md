# Compass Router Staging Deployment

This runbook prepares staging only. It does not modify the existing production
services or create GCP resources without explicit approval.

## Services

- API: `compass-router-api-staging`
- Web: `compass-router-web-staging`
- Region: `us-central1`
- Artifact Registry repository: `compass`

Use `cloudrun-api-staging-service.yaml.template` and
`cloudrun-web-service.yaml.template` with staging substitutions. The staging
API uses a pooled Neon `DATABASE_URL` for runtime traffic and an unpooled
`DIRECT_DATABASE_URL` for Alembic. Both URLs must be stored as separate
Secret Manager references with SSL required. The API must reference
staging-only PostgreSQL, Redis, Clerk, Razorpay sandbox, SMTP, and
LiteLLM/provider secrets. Never point these references at production financial
records or production payment credentials.

## Image build

Configure `cloudbuild-staging-images.yaml` as a Cloud Build trigger for this
branch. Set `_WEB_API_URL`, `_MARKETPLACE_URL`, and the Clerk publishable key as
trigger substitutions. The trigger produces both images tagged with the Git
commit SHA; it does not deploy Cloud Run.

## Required staging substitutions

Render `cloudrun-api-staging-service.yaml.template` with staging service names,
service accounts, image digests, Neon Secret Manager references, SMTP sender,
and secret/version names. It intentionally has no Cloud SQL annotation.
Render `cloudrun-web-service.yaml.template` with the staging API URL and web
service name. The existing Cloud SQL-backed production template remains
available for production compatibility.

Required API settings remain production-safe: Alembic migrations, real provider
execution, Razorpay sandbox mode, Redis rate limiting, SMTP delivery, Clerk
verification, and no local-test or fake-provider mode.

## Approval gate

Before applying either Cloud Run manifest, record the exact resources, expected
monthly cost drivers, secret names, database/Redis isolation, and rollback
revision in `DEPLOYMENT_READINESS.md`, then obtain owner approval.
