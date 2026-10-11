# M14 Environment Configuration Audit

## Added typed settings

- `CLERK_ORGANIZATION_INVITATIONS_ENABLED`
- `CLERK_INVITATION_REDIRECT_URL`
- `PRICING_FX_SOURCE`
- `PRICING_FX_REFRESH_SECONDS`
- `PRICING_FX_MAX_AGE_SECONDS`
- `PRICING_FX_BUFFER_BPS`
- `PRICING_PLATFORM_FEE_BPS`
- `PRICING_ALLOW_FIXED_FX_FALLBACK`
- `PRICING_LOW_CREDITS_THRESHOLD_PAISE`
- `PRICING_VERIFICATION_MAX_AGE_SECONDS`

The root `.env.example` contains placeholders/defaults only. Runtime settings load the ignored root `.env` and `.env.providers`; explicit process environment variables retain precedence through Pydantic Settings.

## Production controls

Production rejects the fixed local FX source, requires Alembic, Secret Manager, Clerk, Razorpay, and non-development secrets, and keeps OpenRouter optional. Neon, Upstash, provider keys, Clerk secrets, and Razorpay values must be stored outside Git.

Credentials pasted into the development session must be rotated before staging or production use. Values are intentionally omitted from this report.
