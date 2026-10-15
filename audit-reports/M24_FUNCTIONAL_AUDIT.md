# M24 Functional Audit

Date: 2026-10-15
Branch: `staging/safe-deployment-2026-10-09`
Baseline: `cba4013aefc5b6fd3680b001e76dddf65b89c38a`

## Scope

Audited the local API on `127.0.0.1:28000`, the rebuilt web app on `localhost:23000`, the authenticated Chrome session, Super Admin controls, provider/model catalog, Credits and payments views, and the VS Code extension package.

## Result

The local application is functional for the authenticated Platform Super Admin. `/portal` resolves to `/super-admin`; the Super Admin shell and all navigation sections loaded from server-backed data. TypeSafe AI / `jev-latest` is visible and remains fail-closed. No live provider inference, payment, refund, database migration, or deployment was performed.

One safe defect was found and fixed: the payments page exposed only aggregate reconciliation JSON. The admin reconciliation endpoint and UI now expose bounded read-only details for open refunds and unprocessed payment events, including status, references, amount, reason, and failure detail.

## Limits

Separate real Chrome sessions for Company Admin and Company Member were not available without changing authentication state. Their authorization is covered by the backend regression suite, but their browser rendering is `UNVERIFIED` in this run. Live Razorpay and Jev verification remain intentionally unverified.
