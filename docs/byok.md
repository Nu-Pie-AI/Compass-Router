# BYOK

The credential resolver prefers active organization-owned credentials, then falls back to platform credentials.

Credential values must be stored outside normal database columns. Database rows only store:

- provider
- organization
- credential mode
- secret reference
- status
- last four characters
- last tested timestamp

Production should implement GCP Secret Manager-backed `SecretManager`.
