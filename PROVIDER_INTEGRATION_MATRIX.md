# Provider Integration Matrix

Updated: 2026-10-09

This matrix describes implementation boundaries, not claims of live availability. A provider is routable only after credentials, health, model activation, capability compatibility, and pricing policy checks succeed.

| Provider family | Current protocol | Discovery source | Execution path | Status |
|---|---|---|---|---|
| OpenAI | LiteLLM | LiteLLM catalog | LiteLLM proxy or direct adapter | Code path present; live verification pending |
| Anthropic | LiteLLM | LiteLLM catalog | LiteLLM proxy | Code path present; live verification pending |
| Gemini | LiteLLM plus native normalization | LiteLLM catalog | LiteLLM proxy or direct adapter | Code path present; live verification pending |
| DeepSeek | LiteLLM | LiteLLM catalog | LiteLLM proxy | Code path present; live verification pending |
| Groq | LiteLLM | LiteLLM catalog | LiteLLM proxy | Code path present; live verification pending |
| Together AI | LiteLLM | LiteLLM catalog | LiteLLM proxy | Code path present; live verification pending |
| Other configured LiteLLM providers | LiteLLM only when explicitly mapped | LiteLLM catalog | LiteLLM proxy | Must be verified before activation |
| OpenRouter | `openrouter_optional` adapter | Optional OpenRouter catalog | Optional direct/proxy route | Never required; live access not verified |
| Jev | Reserved future decision capability | None active | None active | Deferred pending official contract and commercial approval |

## Contract

`apps/api/app/provider_adapters.py` defines the provider-neutral adapter boundary and explicit protocol registry for credential validation, catalog-discovery separation, route readiness, health, invocation, response/usage/error normalization, and pricing-source metadata. Its runtime facade maps chat, responses, embeddings, images, batches, speech, and transcription to their distinct request methods; decision execution remains reserved. `apps/api/app/services.py` resolves LiteLLM and optional OpenRouter routes through this registry while preserving the existing real network clients. `apps/api/app/catalog.py` defines catalog snapshots, capability types, protocol identity, normalization, and filtering. The canonical optional OpenRouter protocol is `openrouter_optional`; the legacy `optional_openrouter` spelling remains registered for existing persisted rows during rollout.

Unknown provider names are stored as `unverified`; they cannot inherit a verified LiteLLM protocol by name alone.

## Activation rule

Discovery persists a model as unavailable and unpublished. Activation requires a real platform or team credential, a supported provider protocol, billable source pricing, and an explicit administrative action. No fake model availability or customer pricing is accepted.
