# M24 Financial Workflows

## Observed

The local Super Admin Payments & Refunds page rendered zero orders, zero completed orders, zero matched Credits, and zero open refunds/events. No financial mutation was performed.

## Fix

`GET /admin/billing/reconciliation` now returns up to 100 open refunds and unprocessed payment events in addition to the existing aggregate checks. The page renders their status, bounded provider/order/team references, amount, reason, and failure detail. It does not expose provider payloads or add a resolution mutation.

This preserves the append-only ledger and the existing refund safety/idempotency code. Existing refund, webhook, insufficient-balance, and reconciliation regression tests passed.

## External limits

Live Razorpay checkout/refund and real-money reconciliation were not executed. Shared staging financial records were not modified.
