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

## M11 evidence update - 2026-10-09

- [x] Clerk verification path is server-side, session-token-only, and audience/authorized-party aware.
- [x] Admin login selects Clerk SignIn when configured and preserves local compatibility mode when absent.
- [x] Verified Clerk email is required for internal provisioning.
- [ ] Staging Clerk instance, verified domain/origins, MFA claims, session revocation, and fresh-authentication behavior verified in a browser.
- [ ] Exact owner Clerk user ID stored in staging Secret Manager and explicit bootstrap verified.
- [ ] Staging Clerk webhook endpoint, signature verification, and redelivery verified.
