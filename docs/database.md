# Database

Primary database: PostgreSQL.

Tables implemented in SQLAlchemy:

- `users`
- `organizations`
- `organization_members`
- `api_keys`
- `providers`
- `provider_credentials`
- `models`
- `wallet_accounts`
- `wallet_ledger`
- `payment_orders`
- `llm_requests`
- `routing_policies`
- `provider_health_checks`
- `audit_logs`

Money is stored as integer paise. API keys are stored as SHA-256 hashes with only prefixes returned for display after creation.
