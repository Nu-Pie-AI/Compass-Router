# LiteLLM

Compass must use a controlled LiteLLM image, not upstream `main-latest`.

Pinned production image target:

`ghcr.io/compass-ai-router/compass-litellm:1.99.0-compass.1`

Local development image:

`compass-litellm:1.99.0-compass.1`

The local image is built from the separate `C:\Users\tohee\Desktop\compass-litellm` checkout pinned to upstream `BerriAI/litellm` tag `v1.99.0` commit `fa647f742d7baefe8eb1181899d9c81b41559772`.

Compass reads `COMPASS_LITELLM_URL` first and falls back to `LITELLM_URL` for compatibility. The local mock in `services/litellm/local_dev_server.py` is now legacy/test-only.

Maintenance procedure:

1. Mirror or fork `BerriAI/litellm` into `compass-litellm`.
2. Keep upstream remote configured and disable upstream push.
3. Develop Compass wrapper changes on `compass-main`.
4. Preserve upstream license and notices.
5. Build and push versioned images.
6. Promote production by immutable digest.
7. Roll back by redeploying the previous digest.
