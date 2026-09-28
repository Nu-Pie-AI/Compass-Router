# Production Checklist

- Security headers configured.
- Production CORS configured.
- Secret Manager configured.
- Cloud SQL backups enabled and restore tested.
- Memorystore configured.
- Pinned Compass LiteLLM image deployed.
- Provider credentials tested.
- Razorpay webhook signatures verified.
- Wallet duplicate-credit and duplicate-debit tests passing.
- CI lint, typecheck, unit, integration, and Docker builds passing.
- Alerts configured for downtime, high error rate, payment failures, and reconciliation mismatch.
- Rollback procedure tested.
