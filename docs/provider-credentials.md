# Provider Credentials

## Local setup

1. Copy `.env.providers.example` to `.env.providers`.
2. Add only the provider keys you intend to use.
3. Set `LOCAL_TEST_MODE=false` and choose `PROVIDER_EXECUTION_MODE=direct` or `proxy` in `.env` when you are ready to call real providers.
4. Start the stack with `docker compose up --build`.
5. Open the admin console and discover or activate the models for the configured providers.

At startup, Compass imports non-placeholder values from `.env.providers`, encrypts them, and stores only an encrypted reference plus the last four characters in the database. The browser and VS Code extension never receive the raw provider key.

By default, `PROVIDER_ENV_SYNC_MODE=missing` makes the admin panel authoritative: the file bootstraps a provider only when no active credential exists. Set `PROVIDER_ENV_SYNC_MODE=replace` only when you intentionally want the file to replace admin-panel credentials on startup.

## Important limitations

- The credential file registers provider credentials; it does not automatically publish every catalog model.
- Direct execution currently has native adapters for OpenAI-compatible providers, Gemini, Ollama Cloud, and OpenRouter. Other providers should use the configured LiteLLM proxy until a native adapter is implemented and tested.
- Azure OpenAI, Azure AI Foundry, Vertex AI, and Bedrock need provider-specific endpoint, deployment, project, service-account, or IAM configuration in addition to this file.
- For production, use Secret Manager and IAM instead of mounting `.env.providers` into Cloud Run.

## Rotation

Replace the key in the local file, restart the API, verify the provider health check, then revoke the previous key at the provider. Any key exposed in source control, chat, screenshots, logs, or browser tools must be revoked immediately.
