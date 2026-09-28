# Compass LiteLLM Version

- Upstream: `BerriAI/litellm`
- Intended production runtime image: `ghcr.io/compass-ai-router/compass-litellm:1.99.0-compass.1`
- Local controlled image: `compass-litellm:1.99.0-compass.1`
- Upstream version baseline: `1.99.0`
- Upstream commit: `fa647f742d7baefe8eb1181899d9c81b41559772`
- Compass patch version: `compass.1`

The Compass repository must not depend on `main-latest`. Production deployments should use immutable image digests after the image is built and pushed.

Local development should use the controlled Compass LiteLLM proxy image. `services/litellm/local_dev_server.py` is retained only as a legacy deterministic test helper and is not the production LiteLLM target.
