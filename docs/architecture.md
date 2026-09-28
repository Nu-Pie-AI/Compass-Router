# Architecture

Compass is the business and product layer. LiteLLM is the internal provider connectivity layer.

Flow:

1. Customer application calls Compass `/v1/chat/completions`.
2. Compass authenticates the `sk-compass-*` API key.
3. Compass loads organization, wallet, spend limits, model catalog, route, and credential metadata.
4. Compass calls the pinned Compass LiteLLM service.
5. Compass normalizes the response, records usage, calculates integer-paise cost, debits the wallet, and returns an OpenAI-compatible response.

Customers never call LiteLLM directly and never receive LiteLLM or provider credentials.
