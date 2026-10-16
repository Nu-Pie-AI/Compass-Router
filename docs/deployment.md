# Deployment

Target GCP services:

- Cloud Run for `compass-api`, `compass-web`, and `compass-litellm`.
- Cloud SQL PostgreSQL.
- Memorystore Redis.
- Secret Manager.
- Artifact Registry.
- Cloud Logging and Monitoring.

Production deployment must inject secrets from Secret Manager and must not store provider secrets in GitHub or frontend environment variables.

## Clerk session verification

`CLERK_ISSUER` is required by the Compass API whenever Clerk session authentication is used. Configure it as a trusted server environment value equal to the exact `iss` claim expected from that Clerk instance (for example, the matching Development or production Clerk instance URL). The API fails closed when it is missing and rejects a correctly signed token if its issuer differs. Do not put `CLERK_SECRET_KEY` in frontend configuration; use Secret Manager for deployed server credentials. Configure `CLERK_JWT_KEY` or `CLERK_SECRET_KEY` through the approved server-side verification mode, independently of issuer validation.
