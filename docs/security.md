# Security

Implemented baseline:

- Password hashing with bcrypt.
- Signed JWT session tokens with a server-side session version so logout invalidates existing tokens.
- Database-backed login throttling after repeated failures.
- Backend authorization dependencies.
- Compass API keys are generated once, hashed, and never listed in full.
- Provider credentials are represented by secret references, not raw database values.
- Request body size limit for `/v1/*`.
- OpenAI-compatible error shapes with stable Compass codes.

Production requirements:

- Replace dev secrets with Secret Manager references.
- Configure Marketplace OAuth and email delivery outside the Router service for Google/Azure login, verification, and password recovery.
- Restrict CORS to production web origins.
- Add Redis-backed distributed rate limiting.
- Add CSRF protection to cookie-authenticated browser flows if cookies are introduced.
- Add Sentry and structured secret-safe logging.
