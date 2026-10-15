# M24 Release Readiness

## Decision: CONDITIONAL GO for local/staging verification; NO-GO for production release

The authenticated local Platform Super Admin workflow, provider catalog, Jev fail-closed state, reconciliation read path, backend suite, web build, and extension build are verified. The repository is not production-ready from this run because live Clerk role matrices, live provider verification, live Razorpay flows, external secret-manager readiness, enabled commercial provider routes, and a disposable PostgreSQL end-to-end run are not all available or authorized.

## Release gates

- Local API/frontend running: PASS.
- Clerk owner session and `/portal` -> `/super-admin`: PASS.
- Company Admin and Member real-browser sessions: UNVERIFIED.
- Jev live verification/inference: BLOCKED by intentionally absent credential and approval.
- Paid payments/refunds: NOT RUN.
- Production deployment/push: NOT RUN.
- Shared database mutation/migration: NOT RUN.

## Required before production

1. Exercise the role matrix with dedicated non-owner Clerk accounts.
2. Verify provider and secret-manager configuration in isolated staging.
3. Complete non-billable provider health and Jev contract checks with approved credentials.
4. Run financial concurrency tests against a disposable PostgreSQL instance and document the result.
5. Resolve the existing Pydantic deprecation warning.
