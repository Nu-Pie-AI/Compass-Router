# Super Admin Security Checklist

- [ ] Clerk production app, verified domain, session claims, and MFA policy verified.
- [ ] `PLATFORM_SUPER_ADMIN_CLERK_USER_ID` stored in Secret Manager, not source control.
- [x] Bootstrap is explicit, singleton, audited, and does not auto-regrant after revocation.
- [x] Platform permission checks are server-side and role assignments are database-backed.
- [x] Provider/API/BYOK secrets are masked or excluded from responses.
- [x] Customer request explorers exclude raw prompts and completions.
- [x] Wallet changes are transactional, idempotent, reasoned, and audited.
- [x] Pricing/routing changes preserve revision snapshots.
- [ ] PostgreSQL locking, Redis limits, retention, tamper resistance, and Cloud Logging redaction verified in staging.
- [ ] Razorpay sandbox, restore, rollback, alerts, and owner approval evidence recorded.
