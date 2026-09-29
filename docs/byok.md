# BYOK

The credential resolver prefers active team BYOK credentials, then falls back to platform credentials. The provider execution layer is intentionally unchanged by this milestone.

Credential values must be stored outside normal database columns. Database rows only store:

- provider
- organization
- credential mode
- secret reference
- status
- last four characters
- last tested timestamp

When `SECRET_MANAGER_ENABLED=true`, new platform and BYOK credentials are written to GCP Secret Manager and database rows store only a `gcp-secret:` reference. Set `GCP_PROJECT_ID`, `GCP_SECRET_MANAGER_PREFIX`, and grant the Cloud Run service account Secret Manager Secret Accessor and Secret Version Adder permissions. Existing encrypted database references remain supported for local and migration compatibility.
