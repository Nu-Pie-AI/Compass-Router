# Billing

Compass stores INR wallet balances in paise. `wallet_ledger` is append-only by convention and uses `(wallet_id, idempotency_key)` to prevent duplicate credits or debits.

## Payment lifecycle

1. `POST /billing/orders` creates a development order or a Razorpay order.
2. Razorpay checkout verification confirms the signature and fetches the payment to validate order ID, amount, currency, and captured status.
3. `POST /webhooks/razorpay` verifies the raw-body signature and records every event by provider event ID. Captured payments settle the order, wallet ledger, and local invoice in one transaction.
4. Failed payments remain visible with provider error details.
5. `POST /billing/orders/{order_id}/refund` requests a provider refund. A processed refund reverses wallet credits exactly once; development mode processes locally for testing.
6. `GET /billing/invoices` and `GET /billing/refunds` expose customer billing history.
7. `GET /admin/billing/reconciliation` compares completed orders with payment ledger entries and reports missing or orphaned credits.

## Production configuration

Set `BILLING_PAYMENT_MODE=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Configure the Razorpay webhook URL as `/webhooks/razorpay` and subscribe to payment captured/failed and refund processed/failed events. Keep development mode restricted to local testing.

Wallet refunds create a negative ledger entry if credits have already been spent. Subsequent API usage is blocked until the wallet is funded again, preserving a complete financial audit trail instead of silently losing the provider refund.
