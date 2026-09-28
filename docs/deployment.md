# Deployment

Target GCP services:

- Cloud Run for `compass-api`, `compass-web`, and `compass-litellm`.
- Cloud SQL PostgreSQL.
- Memorystore Redis.
- Secret Manager.
- Artifact Registry.
- Cloud Logging and Monitoring.

Production deployment must inject secrets from Secret Manager and must not store provider secrets in GitHub or frontend environment variables.
