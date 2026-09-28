# Controlled Beta

Compass controlled beta supports local self-service customer signup when `PUBLIC_SIGNUP_ENABLED=true`. Signup creates a customer, organization, owner membership, isolated team, limits, and a zero-balance wallet. A Compass operator still controls wallet credits and local test pricing.

## Operator Setup

Set these values in `.env`:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `PUBLIC_SIGNUP_ENABLED=true`
- `LOCAL_TEST_MODE=true`
- `LOCAL_TEST_INPUT_PRICE_PAISE_PER_1K`
- `LOCAL_TEST_OUTPUT_PRICE_PAISE_PER_1K`

The local stack seeds one admin and two active customer fixtures. Their configurable values use `ADMIN_*`, `LOCAL_TEST_CUSTOMER_*`, and `LOCAL_TEST_CUSTOMER_2_*` variables.

Start the stack:

```powershell
docker compose up --build -d
```

Open `http://localhost:23000` to sign in or create a customer workspace. Use an operator account for wallet credits and other administrative actions.

## Tester Configuration

For Cline OpenAI Compatible:

- Base URL: `http://localhost:28000/v1`
- API key: `sk-compass-...`
- Model names: provider-native IDs such as `openai/gpt-5` and `gemini/gemini-3.6-flash`

Compass API keys are not provider API keys. Team BYOK credentials are encrypted server-side, shown only as a last-four mask, and never returned to the frontend after submission.

## Request Flow

`POST /v1/chat/completions` validates the Compass API key, resolves the team and model grant, checks the wallet, resolves the provider route, calls LiteLLM, records usage, calculates INR paise cost, writes a wallet debit with idempotency, and returns an OpenAI-compatible response.

`GET /v1/models` returns only the provider-native models allowed for that API key.

Streaming requests are supported with OpenAI-compatible server-sent events. In local test mode Compass records billing from a full deterministic local LiteLLM response, then emits compatible chunks.

## Local Test Mode

`LOCAL_TEST_MODE=true` maps the seeded provider-native demonstration IDs to controlled LiteLLM test routes. When a team BYOK credential is configured, Compass sends the requested provider-native model ID and team credential to LiteLLM instead.
