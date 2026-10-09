# Compass Router Revised M4-M8 Implementation Specification

Status: IMPLEMENTED LOCALLY - external release gates pending
Date: 2026-10-09
Working copy: `C:\Users\tohee\Desktop\Compass-Router-Production`
Scope: Compass Router API, web console, database, provider integrations, billing, and operations
Explicit exclusions: original repository and VS Code extension

## 1. Purpose and decisions

This document supersedes the previous OpenRouter-first M4-M8 design as the implementation specification. The owner subsequently authorized implementation in the isolated working copy. The existing M0-M3 work and reusable provider-independent M4 work remain preserved in the working copy.

The revised architecture makes these decisions:

- OpenRouter is optional. It is never a startup requirement, catalog source requirement, inference requirement, or production-readiness gate for the base platform.
- FastAPI remains the public Compass Router API and control plane.
- LiteLLM remains the execution path for providers that are compatible with its supported interfaces.
- Direct provider adapters remain first-class for providers whose native protocol, capabilities, usage, or billing cannot be represented safely through LiteLLM.
- The model registry describes capabilities and protocols, not only model names.
- Jev is a future decision-provider candidate. The current implementation must reserve a native decision capability and adapter boundary without inventing or activating a Jev endpoint, model ID, request schema, pricing, or commercial route.
- Existing tenant isolation, Compass API keys, project and team scope, BYOK, wallet ledger, pricing policy, and security controls remain authoritative.
- A model is unavailable unless discovery, credentials, policy, and a tested execution route prove it is available. No seeded or synthetic model is exposed as live.
- Customer prices are derived from versioned provider pricing and Compass pricing policy. No customer price is hardcoded in route or UI code.
- Provider credentials stay server-side in environment variables or Secret Manager. Customer API keys never become upstream provider credentials.

## 2. Current baseline and implementation boundary

M0-M3 remain the preserved baseline:

- Isolated production repository and rollback tag.
- Alembic migration path and Clerk identity mapping.
- Clerk session and webhook integration, with Compass API keys retained for inference.
- Centralized tenant, project, team, API-key, BYOK, spend-limit, and Redis authorization boundaries.

The interrupted OpenRouter M4 code remains uncommitted and is not deleted or reverted. It was refactored in the target copy into provider-neutral contracts and optional provider adapters; the resulting code is not treated as production-ready without the live gates documented below.

All implementation changes remain confined to the target copy. The original repository and VS Code extension remain excluded from this specification.

## 3. Target architecture

```text
Client / Router web / VS Code extension
                 |
        FastAPI Compass API
                 |
  Auth + tenant/project/key authorization
                 |
        Capability-aware router
          |                    |
   LiteLLM adapter       Direct adapters
   chat/responses        Jev decisions, native APIs
          |                    |
   Configured providers  Provider-native endpoints
                 |
        Usage normalizer
                 |
     Wallet reservation/settlement
                 |
 PostgreSQL ledger + Redis limits/cache
```

### 3.1 Provider and adapter boundaries

Every provider integration must implement a typed adapter boundary with these responsibilities:

```text
discover_models(credentials) -> ProviderCatalogSnapshot
check_route(model, capability, credentials, policy) -> RouteReadiness
invoke(request, route) -> ProviderResponse or ProviderStream
normalize_response(response) -> CompassResponse
normalize_usage(response) -> ProviderUsage
normalize_error(error) -> CompassProviderError
pricing_source(model, response_or_catalog) -> ProviderPrice
```

The adapter boundary must not own tenants, Compass API keys, wallet balances, or customer pricing. Those remain in shared Router services.

Adapter families:

- `litellm`: provider execution through the configured LiteLLM proxy. It may support chat, responses, embeddings, image, audio, and batch capabilities only where the live route is verified.
- `direct`: provider-native HTTP clients for protocols that need native request or response handling.
- `decision_native`: a reserved direct-adapter family for future non-chat decision protocols. It must not be implemented against an unverified provider contract or translate a decision protocol into a chat prompt.
- `openrouter_optional`: an optional direct or LiteLLM-compatible adapter. Its absence must not prevent startup, catalog operation for other providers, or production readiness of unrelated routes.

## 4. Multi-provider model registry

The registry is the source of truth for what Compass can expose. It must distinguish provider discovery from route readiness.

### 4.1 Canonical model identity

Use a stable internal model record keyed by provider and external model identity. At minimum store:

- `provider_id`
- `external_model_id`
- `canonical_model_key`
- `display_name`
- `model_family`
- `protocol` (`litellm`, `openai_compatible`, `native_decision`, or another explicit protocol)
- `capability_types`
- `context_limits` and capability-specific limits
- `input_modalities` and `output_modalities`
- `supported_parameters`
- `source_metadata_json`
- `source_revision`, `source_created_at`, `last_synced_at`
- `availability_status` (`discovered`, `routable`, `degraded`, `stale`, `disabled`, `retired`)
- `route_readiness` and the reason when not routable
- `pricing_revision_id`

Do not use one generic `supports_chat` boolean as the capability model. A provider may support decisions but not chat, or embeddings but not generation.

### 4.2 Capability types

The first registry vocabulary is:

- `chat_completion`
- `responses`
- `embedding`
- `image_generation`
- `audio_speech`
- `audio_transcription`
- `batch`
- `decision`

Each capability has its own request schema, response normalizer, streaming behavior, usage units, and pricing dimensions. A model is visible for a capability only when its adapter and provider route support that capability.

### 4.3 Registry persistence and synchronization

Preserve the reusable M4 persistence work, but make the source model generic:

- Keep raw provider snapshots and normalized model records.
- Keep sync-run status, revision/etag, timestamps, errors, stale-after state, and last-known-good data.
- Mark removed models retired or unavailable; do not silently delete them when historical usage or billing references exist.
- Store provider source prices separately from Compass customer pricing.
- Support scheduled and administrator-triggered synchronization per provider.
- A failed provider sync must not erase another provider's catalog or make unrelated routes unavailable.
- Stale catalog data must be labeled and must not be reported as verified current data.

The registry may serve stale metadata for browsing, but route selection must apply an explicit stale policy. A stale model is not routable unless the configured policy allows it and the provider health check succeeds.

## 5. Future decision-provider extension

### 5.1 Contract status

Jev is intentionally deferred by the current master plan. Public documentation was inspected as research, but it is not an implementation contract for Compass Router. The exact service, endpoint, authentication, model IDs, request/response schema, pricing, limits, data terms, and commercial/resale permissions remain unfinalized for this project.

Primary references:

- [TypeSafe API OpenAPI/ReDoc](https://api.typesafe.ai/redoc)
- [TypeSafe API Swagger UI](https://api.typesafe.ai/docs)
- [Jev AI decision documentation](https://jev-ai.org/docs/decisions/)
- [Jev AI models documentation](https://jev-ai.org/docs/models/)
- [TypeSafe master customer agreement](https://typesafe.ai/legal/mca)

No Jev provider row, model row, price, environment variable, route, UI control, or fake catalog may be added in M4-M8 while this decision is open. Before a later Jev milestone, Compass must obtain current official documentation, authenticated access, a real commercial account, and written confirmation that the intended Compass Router customer-facing use is permitted. Public documentation or a free account is not sufficient commercial approval.

### 5.2 Reserved native capability

The registry reserves `decision` as a capability type and `decision_native` as a protocol family. A future adapter may implement discovery and execution only after the external contract is approved and verified. Until then, no decision provider is routable.

### 5.3 Deferred contract work

No decision request schema, response envelope, pricing rule, retry rule, endpoint, or public decision API is authorized under this milestone plan. A later decision-provider milestone must derive those details from a verified official contract and a commercially approved account. Until then, the registry must report the capability as unavailable rather than expose a placeholder.

## 6. Public API compatibility

Keep existing contracts where their semantics remain valid:

- `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`, image, audio, batch, `/v1/models`, `/v1/account`, and usage routes remain available for their existing capability types.
- `/v1/models` returns only models routeable for the authenticated Compass API key, project, tenant policy, and requested capability. It must not list every discovered model as executable.
- Existing `/models`, `/catalog/models`, provider administration, BYOK, key management, wallet, billing, and tenant routes retain their existing authorization boundary.
- Reserve a future dedicated decision endpoint only after a verified provider contract exists. Do not add an empty or generic endpoint that implies a working provider.

## 7. M4-M8 milestone sequence

### M4 - Provider-neutral registry and adapter contracts

Scope:

- Reclassify and preserve the reusable interrupted M4 schema and service work.
- Remove the design dependency on OpenRouter from production validation and startup.
- Define provider, capability, adapter, discovery, route-readiness, pricing, and sync interfaces.
- Add migration changes only through reviewed Alembic revisions.
- Implement or refactor registry persistence and synchronization orchestration without embedding OpenRouter assumptions.
- Keep provider snapshots, stale state, last-known-good data, and versioned pricing.
- Define LiteLLM and direct-adapter registration points.

Exit evidence:

- Provider-neutral registry and adapter contract tests pass.
- No provider credential is required merely to start the API in development or to use a different configured provider.
- No model is marked routable without discovery/credential/adapter evidence.
- M0-M3 authorization and wallet tests remain green.

### M5 - Capability routing and genuine streaming

Scope:

- Implement capability-aware route selection.
- Complete genuine incremental streaming for supported chat/response adapters; do not apply streaming to Jev.
- Define the future decision-provider extension contract without activating Jev or inventing a provider protocol.

Exit evidence:

- At least one approved LiteLLM/direct route has live verification.
- Any future decision provider has an approved contract and live verification before exposure.
- Stream tests prove first-byte delivery before upstream completion for streaming-capable routes.
- Decision tests prove typed answers, decimal scores, probabilities, provider usage, and no duplicate charge on retry.

### M6 - Billing, wallet, pricing, and commercial controls

Scope:

- Reconcile all provider usage units with the existing wallet hold/settle/release ledger.
- Add provider-specific pricing dimensions without changing the wallet source of truth.
- Add versioned pricing policies and effective dates for chat, embedding, media, and decision capabilities.
- Preserve BYOK semantics and make any platform fee explicit.
- Complete Razorpay verification, webhook idempotency, refunds, reconciliation, and invoice behavior using existing architecture.
- Add provider commercial status to route readiness. Unapproved provider routes cannot be enabled for customer traffic.

Exit evidence:

- Actual provider usage reconciles to provider and customer ledger records.
- Pricing changes are versioned and historical requests retain their applied revision.
- Razorpay sandbox tests pass only with owner-supplied credentials.
- Jev commercial permission and data-processing terms are documented before any customer-facing Jev route is enabled.

### M7 - Customer/admin web workflows and AI Playgrounds

Scope:

- Use live registry data for model, capability, availability, pricing, wallet, and usage views.
- Add provider and capability-aware route selection without duplicating provider-specific logic in the UI.
- AI Playground behavior:

- Select project/client/workspace from the existing authorized context; default to `Others` only as a visible project label when no explicit project is selected, and allow an authorized owner to rename it.
- Render controls based on the selected model capability and verified request schema.
- Show structured provider responses only when the provider route is live; otherwise show a truthful unavailable state.
- Keep all Compass and provider credentials out of browser code.

Exit evidence:

- Browser tests cover authorization, project scope, valid and invalid question construction, live execution, error state, and usage display.
- Existing customer/admin workflows remain functional.
- Accessibility and keyboard navigation pass for the new playground.

### M8 - Cloud operations and production release

Scope:

- Provision Cloud Run-compatible API/web services, PostgreSQL, Redis, Secret Manager, scheduled sync workers, logging, metrics, and alerts.
- Store LiteLLM credentials, direct provider credentials, Clerk secrets, Razorpay secrets, and application secrets only in Secret Manager or approved server-side environments. Do not add Jev secrets until its contract is approved.
- Use separate staging and production provider accounts, tenants, databases, wallets, and secret versions.
- Add readiness checks that distinguish configured, discovered, healthy, commercially approved, and routable.
- Add immutable images, SBOM, migrations, backup/restore, rollback, DNS/TLS, and incident procedures.

Production gate:

- No Jev route is production-ready until an owner-approved commercial account can make a real low-cost request, model discovery is live, usage and billing reconcile, data-processing terms are accepted, and TypeSafe confirms Compass's intended customer-facing gateway/resale use is allowed.
- No provider is production-ready based on a model name in configuration, a mocked response, a catalog fixture, or an unverified OpenAI-compatible adapter.

## 8. Environment and secrets contract

The eventual implementation may add names such as:

```dotenv
# Existing Compass/LiteLLM/direct-provider variables remain authoritative.
# Optional provider, never mandatory for Router startup.
OPENROUTER_API_KEY=REPLACE_ME_IF_ENABLED
OPENROUTER_BASE_URL=REPLACE_ME_IF_ENABLED
```

These are plan-level names only. No Jev environment variables are authorized until the owner provides the verified contract. Production startup must reject placeholders when an enabled provider route requires them, but must not reject the entire platform because an optional provider is absent.

## 9. Required testing and evidence

Test layers:

- Unit: discriminated schemas, capability filtering, pricing arithmetic, stale state, provider error mapping, idempotency keys.
- Contract: LiteLLM response normalization and direct adapter contracts. A future decision-provider contract is out of scope until officially approved.
- Integration: database migrations, sync transactions, wallet reservation and settlement, tenant/key/model policy boundaries.
- Live provider: discovery, one route per enabled capability, actual usage, provider failure, retry, and cancellation.
- Browser: AI Playground and existing customer/admin paths.
- Operational: Secret Manager, Cloud Run readiness, logs with redaction, alerts, backup/restore, rollback.

Mocks and fixtures may support CI contract tests, but all such tests must be labeled. They cannot mark a provider, model, price, or commercial route as live.

## 10. Approval and release gate

Implementation in the isolated target copy is authorized. Continue one milestone at a time, update progress/blockers after each gate, and stop before external commercial activation or production deployment without explicit owner approval. Live provider, payment, infrastructure, browser, and commercial evidence must never be inferred from local tests or templates.
