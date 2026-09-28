# Billing

Compass stores INR wallet balances in paise. `wallet_ledger` is append-only by convention and uses `(wallet_id, idempotency_key)` to prevent duplicate credits or debits.

For successful chat completions:

1. Usage is extracted from the LiteLLM/OpenAI-compatible response.
2. Provider cost and Compass customer cost are calculated in integer paise.
3. The `llm_requests` row records provider and customer cost separately.
4. The wallet is debited with an idempotent ledger entry.

Known hardening still required:

- Row-level locking for high-concurrency debit protection on PostgreSQL.
- Payment reconciliation reports.
- Razorpay signature verification endpoints.
