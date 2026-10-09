# Model Catalog Specification

Updated: 2026-10-09

The catalog is Compass-owned registry data. Provider discovery is evidence; it is not an automatic public-route entitlement.

## Identity

- `id`: stable Compass model identifier, normally `<provider>/<native-model-id>`.
- `provider_id` and `provider_model_id`: provider ownership and native identifier.
- `protocol`: verified execution protocol such as `litellm`, `openrouter_optional`, or `unverified`. The legacy `optional_openrouter` value remains readable during migration.
- `catalog_source`: source of the latest discovery snapshot.

## Capability metadata

Supported capability types are `chat_completion`, `responses`, `embedding`, `image_generation`, `audio_speech`, `audio_transcription`, `batch`, and reserved `decision`. Records also retain legacy capabilities, input/output modalities, context limits, maximum output tokens, tools, reasoning, and vision flags.

## Lifecycle

Provider commercial approval is a separate governance state from technical health. Production publication and routing require `commercial_status=approved`; `unreviewed` and `rejected` providers remain non-routable.

1. Synchronize a provider catalog and record source revision, raw metadata, source prices, and sync status.
2. Persist new models as unavailable and unpublished.
3. Review and activate only models with a verified credential, supported capability route, and valid pricing.
4. Publish only activated records. Retire records missing from the latest successful snapshot.
5. Keep the last successful snapshot when a refresh fails.
6. Treat a snapshot as routeable only while its provider-specific freshness window is valid; stale records remain auditable but are excluded from customer routing and default model grants.

## APIs

- `GET /catalog/models` reads the Compass registry and filters by provider/capability/context.
- `POST /admin/catalog/sync?provider=litellm` refreshes the LiteLLM registry.
- `GET /admin/catalog/status?provider=litellm` reports sync freshness and errors.
- `python -m app.catalog_sync --provider litellm` is the scheduled-job entry point.

Jev has no active catalog or decision endpoint in this milestone.
# Commercial approval is a separate provider governance state from technical
# health. Production publication and routing require `commercial_status=approved`.
