"""Provider-neutral runtime adapter contracts and registry.

The existing LiteLLM and direct HTTP clients remain the network implementations.
This module gives routing one typed boundary around both clients without
inventing availability, pricing, or provider responses.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

from .catalog import CatalogSnapshot


@dataclass(frozen=True)
class ProviderRoute:
    provider: str
    protocol: str
    model_id: str
    credential_mode: str
    secret_reference: str


@dataclass(frozen=True)
class RouteReadiness:
    ready: bool
    capability: str
    reason: str = ""


@dataclass(frozen=True)
class ProviderCredentialState:
    provider: str
    configured: bool
    source: str | None = None
    last_four: str | None = None
    reason: str = ""


@dataclass(frozen=True)
class ProviderHealth:
    provider: str
    healthy: bool
    checked_at: str
    detail: str = ""


@dataclass(frozen=True)
class ProviderUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    provider_cost_usd: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProviderError:
    code: str
    message: str
    retryable: bool = False
    status_code: int | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class ProviderAdapterError(RuntimeError):
    """Raised when an adapter cannot truthfully perform a requested operation."""


class RuntimeClient(Protocol):
    async def chat_completion(self, payload: dict[str, Any]) -> dict[str, Any]:
        ...

    async def request_json(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        ...

    async def stream_request(self, endpoint: str, payload: dict[str, Any]):
        ...

    async def request_bytes(self, endpoint: str, payload: dict[str, Any]) -> tuple[bytes, str]:
        ...

    async def request_multipart(self, endpoint: str, data: dict[str, Any], file: tuple[str, bytes, str]) -> dict[str, Any]:
        ...


class ProviderAdapter(Protocol):
    """Common contract for a verified provider execution/discovery adapter."""

    provider: str
    protocol: str

    async def validate_credentials(self) -> ProviderCredentialState:
        ...

    async def discover_models(self, *, force: bool = False) -> CatalogSnapshot:
        ...

    async def check_route(self, capability: str) -> RouteReadiness:
        ...

    def supports_capability(self, capability: str) -> bool:
        ...

    async def health_check(self) -> ProviderHealth:
        ...

    async def invoke(self, capability: str, request: dict[str, Any]) -> dict[str, Any]:
        ...

    async def invoke_binary(self, capability: str, request: dict[str, Any]) -> tuple[bytes, str]:
        ...

    async def invoke_multipart(self, capability: str, request: dict[str, Any], file: tuple[str, bytes, str]) -> dict[str, Any]:
        ...

    def normalize_response(self, response: object) -> dict[str, Any]:
        ...

    def normalize_usage(self, response: dict[str, Any]) -> ProviderUsage:
        ...

    def normalize_error(self, error: Exception) -> ProviderError:
        ...

    def pricing_source(self, model_id: str) -> dict[str, str]:
        ...


AdapterFactory = Callable[[ProviderRoute, RuntimeClient], ProviderAdapter]


class ProviderAdapterRegistry:
    """Explicit protocol-to-adapter registry; unknown protocols fail closed."""

    def __init__(self) -> None:
        self._factories: dict[str, AdapterFactory] = {}

    def register(self, protocol: str, factory: AdapterFactory) -> None:
        normalized = protocol.strip().lower()
        if not normalized:
            raise ValueError("Adapter protocol cannot be empty")
        self._factories[normalized] = factory

    def resolve(self, route: ProviderRoute, client: RuntimeClient) -> ProviderAdapter:
        factory = self._factories.get(route.protocol.strip().lower())
        if factory is None:
            raise ProviderAdapterError(f"No verified adapter is registered for protocol {route.protocol!r}")
        return factory(route, client)

    def supports_capability(self, protocol: str, capability: str) -> bool:
        """Check the registered adapter mapping without making a network call."""

        factory = self._factories.get(protocol.strip().lower())
        if factory is None:
            return False
        try:
            adapter = factory(ProviderRoute("", protocol, "", "", ""), None)  # type: ignore[arg-type]
            return adapter.supports_capability(capability)
        except (ProviderAdapterError, TypeError, ValueError):
            return False

    @property
    def protocols(self) -> tuple[str, ...]:
        return tuple(sorted(self._factories))


class RuntimeProviderAdapter:
    """Adapter facade preserving the existing client's real network behavior."""

    _JSON_ENDPOINTS = {
        "responses": "/v1/responses",
        "embedding": "/v1/embeddings",
        "embeddings": "/v1/embeddings",
        "image_generation": "/v1/images/generations",
        "image": "/v1/images/generations",
        "images": "/v1/images/generations",
        "batch": "/v1/batches",
    }
    _BINARY_ENDPOINTS = {"audio_speech": "/v1/audio/speech", "audio": "/v1/audio/speech"}
    _MULTIPART_ENDPOINTS = {"audio_transcription": "/v1/audio/transcriptions"}

    def __init__(self, route: ProviderRoute, client: RuntimeClient) -> None:
        self.route = route
        self.client = client
        self.provider = route.provider
        self.protocol = route.protocol

    async def validate_credentials(self) -> ProviderCredentialState:
        reference = self.route.secret_reference or ""
        if reference == "local-test":
            return ProviderCredentialState(self.provider, False, "local_test", reason="Deterministic test route; no provider credential is configured.")
        configured = reference.startswith(("encrypted:", "gcp-secret:"))
        return ProviderCredentialState(
            self.provider,
            configured,
            self.route.credential_mode,
            None,
            "" if configured else "Provider credential reference is unavailable.",
        )

    async def discover_models(self, *, force: bool = False) -> CatalogSnapshot:  # noqa: ARG002
        raise ProviderAdapterError("Model discovery is owned by the provider catalog adapter, not the execution client.")

    @classmethod
    def canonical_capability(cls, capability: str) -> str:
        normalized = capability.strip().lower()
        if normalized in {"chat", "chat_completion"}:
            return "chat_completion"
        if normalized in {"embedding", "embeddings"}:
            return "embedding"
        if normalized in {"image", "images", "image_generation"}:
            return "image_generation"
        if normalized in {"audio", "audio_speech"}:
            return "audio_speech"
        if normalized == "audio_transcription":
            return "audio_transcription"
        return normalized

    def supports_capability(self, capability: str) -> bool:
        normalized = self.canonical_capability(capability)
        return normalized in {
            "chat_completion",
            "responses",
            "embedding",
            "image_generation",
            "audio_speech",
            "audio_transcription",
            "batch",
        }

    async def check_route(self, capability: str) -> RouteReadiness:
        normalized = self.canonical_capability(capability)
        credential = await self.validate_credentials()
        if not credential.configured and credential.source != "local_test":
            return RouteReadiness(False, normalized, credential.reason or "Provider credential is unavailable.")
        if not self.supports_capability(normalized):
            return RouteReadiness(False, normalized, "The adapter has no verified JSON execution mapping for this capability.")
        return RouteReadiness(True, normalized, "Provider execution adapter is registered; catalog and policy gates still apply.")

    async def health_check(self) -> ProviderHealth:
        method = getattr(self.client, "health_check", None)
        if method is None:
            return ProviderHealth(self.provider, False, datetime.now(UTC).isoformat(), "The configured runtime client has no health-check operation.")
        result = await method()
        healthy = not isinstance(result, dict) or str(result.get("status", "ok")).lower() in {"ok", "ready", "healthy"}
        return ProviderHealth(self.provider, healthy, datetime.now(UTC).isoformat(), str(result))

    async def invoke(self, capability: str, request: dict[str, Any]) -> dict[str, Any]:
        normalized = capability.strip().lower()
        if normalized in {"chat", "chat_completion"}:
            response = await self.client.chat_completion(request)
        else:
            endpoint = self._JSON_ENDPOINTS.get(normalized)
            if normalized == "responses":
                endpoint = "/v1/responses"
            if endpoint is None:
                if normalized in self._BINARY_ENDPOINTS or normalized in self._MULTIPART_ENDPOINTS:
                    raise ProviderAdapterError(f"Capability {capability!r} requires its binary or multipart adapter method.")
                raise ProviderAdapterError(f"Capability {capability!r} is not supported by the JSON adapter contract.")
            response = await self.client.request_json(endpoint, request)
        return self.normalize_response(response)

    async def invoke_binary(self, capability: str, request: dict[str, Any]) -> tuple[bytes, str]:
        endpoint = self._BINARY_ENDPOINTS.get(capability.strip().lower())
        if endpoint is None:
            raise ProviderAdapterError(f"Capability {capability!r} is not supported by the binary adapter contract.")
        return await self.client.request_bytes(endpoint, request)

    async def invoke_multipart(self, capability: str, request: dict[str, Any], file: tuple[str, bytes, str]) -> dict[str, Any]:
        endpoint = self._MULTIPART_ENDPOINTS.get(capability.strip().lower())
        if endpoint is None:
            raise ProviderAdapterError(f"Capability {capability!r} is not supported by the multipart adapter contract.")
        return await self.client.request_multipart(endpoint, request, file)

    def normalize_response(self, response: object) -> dict[str, Any]:
        if not isinstance(response, dict):
            raise ProviderAdapterError("Provider returned a non-object response.")
        return response

    def normalize_usage(self, response: dict[str, Any]) -> ProviderUsage:
        usage = response.get("usage")
        if not isinstance(usage, dict):
            nested = response.get("response")
            usage = nested.get("usage") if isinstance(nested, dict) else {}

        def token_count(*values: object) -> int:
            for value in values:
                if value is None:
                    continue
                try:
                    return max(0, int(value))
                except (TypeError, ValueError):
                    continue
            return 0

        input_tokens = token_count(usage.get("prompt_tokens"), usage.get("input_tokens"), usage.get("promptTokenCount"))
        output_tokens = token_count(usage.get("completion_tokens"), usage.get("output_tokens"), usage.get("candidatesTokenCount"))
        total_tokens = token_count(usage.get("total_tokens"), usage.get("totalTokenCount"), input_tokens + output_tokens)
        cost = usage.get("cost") or usage.get("provider_cost_usd")
        return ProviderUsage(input_tokens, output_tokens, total_tokens, str(cost) if cost is not None else None, dict(usage))

    def normalize_error(self, error: Exception) -> ProviderError:
        status_code = getattr(error, "status_code", None)
        if not isinstance(status_code, int):
            status_code = None
        retryable = status_code in {408, 409, 429} or (status_code is not None and status_code >= 500)
        detail = getattr(error, "detail", None)
        message = str(detail or error)
        return ProviderError("provider_error", message[:500], retryable, status_code)

    def pricing_source(self, model_id: str) -> dict[str, str]:
        return {"provider": self.provider, "model_id": model_id, "source": "provider_catalog"}

    async def chat_completion(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.client.chat_completion(payload)

    async def request_json(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.client.request_json(endpoint, payload)

    async def stream_request(self, endpoint: str, payload: dict[str, Any]):
        async for line in self.client.stream_request(endpoint, payload):
            yield line

    async def request_bytes(self, endpoint: str, payload: dict[str, Any]) -> tuple[bytes, str]:
        return await self.client.request_bytes(endpoint, payload)

    async def request_multipart(self, endpoint: str, data: dict[str, Any], file: tuple[str, bytes, str]) -> dict[str, Any]:
        return await self.client.request_multipart(endpoint, data, file)
