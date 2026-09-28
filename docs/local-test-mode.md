# Local Test Mode

Local Test Mode is the deterministic development path for the real Compass request flow.

It uses:

- Compass API on FastAPI.
- PostgreSQL for application data.
- Redis for connectivity readiness.
- `local/test-chat` as the Compass model ID.
- `local-test` as the provider.
- `services/litellm/local_dev_server.py` as a LiteLLM-compatible local service.

This is not a real provider call. It exists to verify:

1. Compass API key validation.
2. Organization and wallet lookup.
3. Model and provider resolution.
4. Compass API to LiteLLM-service communication.
5. OpenAI-compatible response normalization.
6. Usage extraction.
7. INR paise cost calculation.
8. Wallet debit and immutable ledger record.
9. Request/usage persistence.

Pricing is configured with:

- `LOCAL_TEST_INPUT_PRICE_PAISE_PER_1K`
- `LOCAL_TEST_OUTPUT_PRICE_PAISE_PER_1K`

The local provider can simulate failure modes by including these tokens in the user message:

- `__FAIL_500__`
- `__TIMEOUT__`
- `__MALFORMED__`
