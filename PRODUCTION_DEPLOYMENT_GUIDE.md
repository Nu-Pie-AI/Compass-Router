# Production Deployment Guide

Status: NOT READY FOR PRODUCTION

Before deployment, an operator must configure GCP project/IAM, Artifact Registry, Cloud Run, Cloud SQL PostgreSQL, Redis, Secret Manager, Clerk, Razorpay, LiteLLM/provider credentials, migrations, DNS/TLS, alerts, and rollback procedures.

For catalog synchronization, deploy the API image and invoke the non-activating job entry point:

```text
python -m app.catalog_sync --provider litellm
```

Use Cloud Scheduler or a Cloud Run Job with authenticated service-to-service access. Do not expose this command publicly without admin authorization. A live staging run must verify discovery, readiness, activation, routing, usage, and wallet settlement before production approval.

For stale inference reservations, run preview first:

```text
python -m app.recovery --task recover-reservations
```

Use `--apply` only as an approved operator action after reviewing the preview. The recovery job never performs payment-provider calls.

GCP service templates are under `infra/gcp/`. The verification-only Cloud Build pipeline is `infra/gcp/cloudbuild-verify.yaml`; it does not deploy or create cloud resources.

Owner-approved image preparation is explicit and separate from deployment:
`python infra/gcp/build_release.py --registry REGION-docker.pkg.dev/PROJECT/REPOSITORY --web-api-url https://api.example.invalid --marketplace-url https://marketplace.example.invalid`.
It requires a clean worktree, produces commit-tagged immutable image digests,
and enables BuildKit provenance/SBOM attestations. It does not apply Cloud Run.

OpenRouter is optional. Jev is not deployable under the current plan.
## Redis staging requirement

The API requires a standard Redis endpoint for distributed rate limiting. Use a
dedicated staging endpoint with TLS and authentication, configured as
`REDIS_URL=rediss://USERNAME:PASSWORD@HOST:PORT/0` through Secret Manager. Do
not use Upstash REST for this feature: the limiter requires atomic Lua `EVAL`
with `INCR`, `INCRBY`, and `EXPIRE`. See `REDIS_STAGING_GUIDE.md` for the
read-only health check and live verification gates.
