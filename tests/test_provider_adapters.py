import asyncio
import os
import tempfile

import pytest
from types import SimpleNamespace

if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ.setdefault("LOCAL_TEST_MODE", "true")
os.environ.setdefault("PROVIDER_EXECUTION_MODE", "proxy")

from app.provider_adapters import (
    ProviderAdapterError,
    ProviderAdapterRegistry,
    ProviderRoute,
    RuntimeProviderAdapter,
)
from app import services


class FakeRuntimeClient:
    async def chat_completion(self, payload):
        return {"object": "chat.completion", "usage": {"prompt_tokens": 2, "completion_tokens": 3, "total_tokens": 5}, "payload": payload}

    async def request_json(self, endpoint, payload):
        return {"endpoint": endpoint, "usage": {"input_tokens": 4, "output_tokens": 6}, "payload": payload}

    async def stream_request(self, endpoint, payload):
        yield f"data: {endpoint}:{payload['model']}"

    async def request_bytes(self, endpoint, payload):
        return b"provider-bytes", "application/octet-stream"

    async def request_multipart(self, endpoint, data, file):
        return {"endpoint": endpoint, "filename": file[0], "data": data}


def route(protocol="litellm", secret_reference="encrypted:provider-secret"):
    return ProviderRoute("openai", protocol, "openai/gpt-test", "platform", secret_reference)


def test_registry_resolves_registered_protocols_and_rejects_unknown_protocols():
    registry = ProviderAdapterRegistry()
    registry.register("litellm", lambda adapter_route, client: RuntimeProviderAdapter(adapter_route, client))
    registry.register("openrouter_optional", lambda adapter_route, client: RuntimeProviderAdapter(adapter_route, client))
    registry.register("optional_openrouter", lambda adapter_route, client: RuntimeProviderAdapter(adapter_route, client))
    client = FakeRuntimeClient()

    resolved = registry.resolve(route(), client)
    assert isinstance(resolved, RuntimeProviderAdapter)
    assert registry.protocols == ("litellm", "openrouter_optional", "optional_openrouter")
    assert registry.supports_capability("litellm", "responses") is True
    assert registry.supports_capability("litellm", "decision") is False
    assert registry.supports_capability("unverified", "chat_completion") is False
    with pytest.raises(ProviderAdapterError, match="No verified adapter"):
        registry.resolve(route("unverified"), client)


def test_runtime_adapter_preserves_capability_mapping_and_normalizes_usage():
    adapter = RuntimeProviderAdapter(route(), FakeRuntimeClient())

    response = asyncio.run(adapter.invoke("responses", {"model": "openai/gpt-test", "input": "hello"}))
    readiness = asyncio.run(adapter.check_route("chat"))
    image_readiness = asyncio.run(adapter.check_route("images"))
    batch_readiness = asyncio.run(adapter.check_route("batch"))
    speech = asyncio.run(adapter.invoke_binary("audio_speech", {"model": "openai/gpt-test"}))
    transcription = asyncio.run(adapter.invoke_multipart("audio_transcription", {"model": "openai/gpt-test"}, ("voice.wav", b"audio", "audio/wav")))
    usage = adapter.normalize_usage(response)

    assert response["endpoint"] == "/v1/responses"
    assert readiness.ready is True
    assert readiness.capability == "chat_completion"
    assert image_readiness.capability == "image_generation"
    assert batch_readiness.capability == "batch"
    assert speech == (b"provider-bytes", "application/octet-stream")
    assert transcription["endpoint"] == "/v1/audio/transcriptions"
    assert usage.input_tokens == 4
    assert usage.output_tokens == 6
    assert usage.total_tokens == 10
    assert adapter.pricing_source("openai/gpt-test") == {
        "provider": "openai",
        "model_id": "openai/gpt-test",
        "source": "provider_catalog",
    }


def test_runtime_adapter_does_not_claim_local_test_route_has_a_live_credential():
    adapter = RuntimeProviderAdapter(route(secret_reference="local-test"), FakeRuntimeClient())
    credentials = asyncio.run(adapter.validate_credentials())

    assert credentials.configured is False
    assert credentials.source == "local_test"
    assert asyncio.run(adapter.check_route("decision")).ready is False


def test_integrated_provider_client_fails_closed_for_unverified_protocol():
    resolved = SimpleNamespace(
        provider=SimpleNamespace(name="future_provider", protocol="unverified"),
        model=SimpleNamespace(protocol="unverified"),
        resolved_model_id="future_provider/model",
        credential_mode="platform",
        secret_reference="local-test",
    )

    with pytest.raises(Exception, match="provider_adapter_unavailable"):
        services.provider_client(resolved)
