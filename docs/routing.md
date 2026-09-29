# Routing

Compass exposes provider-native model IDs such as `openai/gpt-4o-mini`. A model is
callable only when it is published, enabled, available, granted to the Compass
API key, and backed by a usable platform or team BYOK credential.

## Capability-aware APIs

The router validates the selected model before provider execution:

- `/v1/chat/completions` requires `chat`.
- `/v1/responses` requires `chat` or `responses`.
- `/v1/embeddings` requires `embedding` or `embeddings`.
- `/v1/images/generations` requires `image`, `images`, or `image_generation`.
- `/v1/audio/speech` requires an audio capability.
- `/v1/batches` requires a chat or embedding-capable model and an explicit `model` field so Compass can route the batch.

Catalog entries can be visible without being callable. Activation now accepts
all catalog modes when a platform or team credential is configured; it is no
longer limited to chat-only models.

## Fallback behavior

Each model may define a fallback model. Compass walks the fallback chain without
loops and retries transient provider failures for timeout, unavailable, rate
limit, and provider errors. Every attempt is recorded in `provider_attempts`,
while the final request records model, provider, credential mode, latency, usage,
and wallet cost.

Responses streaming is intentionally rejected until the provider event format is
handled end to end. Chat completion streaming remains available through the
existing OpenAI-compatible SSE formatter.
