# FX Rate Refresh Runbook

Configure `FX_REFRESH_JOB_SECRET` through Secret Manager and call `POST /internal/jobs/fx-refresh` once daily from an authenticated Cloud Scheduler job. The preferred staging template is `infra/gcp/cloudscheduler-fx-refresh.yaml.template`, using Cloud Run IAM/OIDC and a dedicated scheduler service account. Set `FX_REFRESH_IAM_AUTH_ENABLED=true` only when Cloud Run requires authentication for the service; otherwise use the constant-time application secret path. The endpoint validates pair direction, freshness, positive finite Decimal rate, and deviation before writing PostgreSQL and Redis.

Frankfurter is attempted first, then Fawaz. If both fail, the existing approved quote remains unchanged. If no fresh approved quote exists, managed paid inference returns `pricing_unavailable` before reservation or provider execution. BYOK is not silently converted to managed billing.

Use `GET /admin/pricing/fx` for Super Admin status/history and `POST /admin/pricing/fx/refresh` for an authorized manual refresh. Never log secrets or use destructive Redis flush commands.

The default four-day maximum age allows daily publication gaps for weekends and holidays; review this policy before production use.
