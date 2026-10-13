"""Provider-neutral model catalog contracts and normalization helpers."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Protocol


CAPABILITY_TYPES = frozenset(
    {
        "chat_completion",
        "responses",
        "embedding",
        "image_generation",
        "audio_speech",
        "audio_transcription",
        "batch",
        "decision",
        "structured_decision",
    }
)

CAPABILITY_ALIASES = {
    "chat": {"chat", "chat_completion"},
    "chat_completion": {"chat", "chat_completion"},
    "responses": {"responses", "chat", "chat_completion"},
    "embedding": {"embedding", "embeddings"},
    "embeddings": {"embedding", "embeddings"},
    "image": {"image", "images", "image_generation"},
    "images": {"image", "images", "image_generation"},
    "image_generation": {"image", "images", "image_generation"},
    "audio": {"audio", "audio-input", "audio-output", "audio_speech", "audio_transcription"},
    "audio_speech": {"audio", "audio-output", "audio_speech"},
    "audio_transcription": {"audio", "audio-input", "audio_transcription"},
    # Batch requests execute the underlying model capability; providers may
    # expose batch separately, but chat/response/embedding models remain
    # compatible with the existing Compass batch contract.
    "batch": {"batch", "chat", "chat_completion", "responses", "embedding", "embeddings"},
    "decision": {"decision", "structured_decision"},
    "structured_decision": {"decision", "structured_decision"},
}


PROVIDER_PROTOCOLS = {
    "litellm": "litellm",
    "openai": "litellm",
    "anthropic": "litellm",
    "gemini": "litellm",
    "deepseek": "litellm",
    "groq": "litellm",
    "mistral": "litellm",
    "xai": "litellm",
    "cohere": "litellm",
    "together_ai": "litellm",
    "fireworks_ai": "litellm",
    "perplexity": "litellm",
    "nvidia_nim": "litellm",
    "ollama_cloud": "litellm",
    "azure": "litellm",
    "azure_ai": "litellm",
    "vertex_ai": "litellm",
    "cerebras": "litellm",
    "sambanova": "litellm",
    "deepinfra": "litellm",
    "huggingface": "litellm",
    "openrouter": "openrouter_optional",
    "typesafe_ai": "typesafe_decision",
}


@dataclass(frozen=True)
class CatalogSnapshot:
    """A provider discovery result before it is persisted."""

    source: str
    provider: str
    records: tuple[dict[str, Any], ...]
    raw_payload: dict[str, Any]
    source_revision: str
    etag: str | None = None


class CatalogAdapter(Protocol):
    """The minimal discovery contract for a provider catalog connector."""

    source: str
    provider: str

    async def discover(self, *, force: bool = False) -> CatalogSnapshot:
        ...


def native_model_id(provider: str, raw_model_id: str) -> str:
    prefix = f"{provider}/"
    return raw_model_id if raw_model_id.startswith(prefix) else f"{prefix}{raw_model_id}"


def provider_protocol(provider: str) -> str:
    # Unknown providers must remain unverified until a real adapter is registered.
    return PROVIDER_PROTOCOLS.get(provider, "unverified")


def capability_matches(requested: str, capability_types: object, legacy_capabilities: object = None) -> bool:
    """Match a request against canonical capability types with legacy fallback."""

    values: set[str] = set()
    for source in (capability_types, legacy_capabilities):
        if isinstance(source, str):
            values.update(item.strip().lower() for item in source.split(",") if item.strip())
        elif isinstance(source, (list, tuple, set, frozenset)):
            values.update(str(item).strip().lower() for item in source if str(item).strip())
    requested_values = CAPABILITY_ALIASES.get(requested.strip().lower(), {requested.strip().lower()})
    return bool(values & requested_values)


def openrouter_capability_types(capabilities: object, inputs: object, outputs: object) -> list[str]:
    """Map OpenRouter architecture metadata to canonical Compass capabilities."""

    values = {str(item).strip().lower() for item in capabilities if isinstance(item, str)} if isinstance(capabilities, (list, tuple, set)) else set()
    input_values = {str(item).strip().lower() for item in inputs if isinstance(item, str)} if isinstance(inputs, (list, tuple, set)) else set()
    output_values = {str(item).strip().lower() for item in outputs if isinstance(item, str)} if isinstance(outputs, (list, tuple, set)) else set()
    types: set[str] = set()
    if "embeddings" in values:
        types.add("embedding")
    if "images" in values or "image" in output_values:
        types.add("image_generation")
    if "audio" in values or "audio" in output_values:
        types.add("audio_speech")
    if "audio" in values or "audio" in input_values:
        types.add("audio_transcription")
    if not types:
        types.update({"chat_completion", "responses"})
    return sorted(types)


def positive_decimal(value: object) -> Decimal | None:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None
    if not parsed.is_finite() or parsed < 0:
        return None
    return parsed


def _legacy_capabilities(metadata: dict[str, Any]) -> list[str]:
    mode = str(metadata.get("mode") or "unknown")
    capabilities = [mode]
    flags = {
        "supports_audio_input": "audio-input",
        "supports_audio_output": "audio-output",
        "supports_function_calling": "tools",
        "supports_reasoning": "reasoning",
        "supports_response_schema": "structured-output",
        "supports_vision": "vision",
        "supports_web_search": "web-search",
    }
    capabilities.extend(label for field, label in flags.items() if metadata.get(field) is True)
    return sorted(set(capabilities))


def _capability_types(metadata: dict[str, Any]) -> list[str]:
    mode = str(metadata.get("mode") or "").lower()
    if mode in {"embedding", "embeddings"}:
        return ["embedding"]
    if mode in {"image_generation", "image"}:
        return ["image_generation"]
    if mode in {"audio_speech", "speech"}:
        return ["audio_speech"]
    if mode in {"audio_transcription", "transcription"}:
        return ["audio_transcription"]
    if mode == "batch":
        return ["batch"]
    if mode in {"chat", "responses"}:
        capabilities = {"chat_completion", "responses"}
        if metadata.get("supports_function_calling") is True:
            capabilities.add("responses")
        return sorted(capabilities)
    # Discovery must not turn an unknown, completion-only, moderation, or
    # reranking mode into a routable chat model. It remains catalog metadata
    # until an explicit Compass capability mapping is implemented.
    return []


def normalize_litellm_cost_map(raw_catalog: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize LiteLLM's cost map without making availability claims."""

    normalized: dict[str, dict[str, Any]] = {}
    for raw_model_id, metadata in raw_catalog.items():
        if raw_model_id == "sample_spec" or not isinstance(raw_model_id, str) or not isinstance(metadata, dict):
            continue
        provider = metadata.get("litellm_provider")
        if not isinstance(provider, str) or not provider.strip() or provider.startswith("one of "):
            continue
        provider = provider.strip().lower()
        model_id = native_model_id(provider, raw_model_id)
        context_window = metadata.get("max_input_tokens") or metadata.get("max_tokens")
        if not isinstance(context_window, int) or context_window < 1:
            context_window = None
        input_cost = positive_decimal(metadata.get("input_cost_per_token"))
        output_cost = positive_decimal(metadata.get("output_cost_per_token"))
        display_tail = raw_model_id.rsplit("/", 1)[-1]
        normalized[model_id] = {
            "id": model_id,
            "provider": provider,
            "provider_model_id": model_id,
            "display_name": display_tail.replace("-", " ").replace("_", " ").strip().title(),
            "protocol": provider_protocol(provider),
            "capabilities": _legacy_capabilities(metadata),
            "capability_types": _capability_types(metadata),
            "mode": metadata.get("mode") or "unknown",
            "context_window": context_window,
            "max_output_tokens": metadata.get("max_output_tokens") if isinstance(metadata.get("max_output_tokens"), int) else None,
            "input_cost_per_token": input_cost,
            "output_cost_per_token": output_cost,
            "input_cost_per_million_usd": input_cost * Decimal(1_000_000) if input_cost is not None else None,
            "output_cost_per_million_usd": output_cost * Decimal(1_000_000) if output_cost is not None else None,
            "byok_supported": provider not in {"litellm"},
            "input_modalities": metadata.get("input_modalities") if isinstance(metadata.get("input_modalities"), list) else [],
            "output_modalities": metadata.get("output_modalities") if isinstance(metadata.get("output_modalities"), list) else [],
            "metadata": metadata,
        }
    return sorted(normalized.values(), key=lambda row: (row["provider"], row["provider_model_id"]))


def snapshot_revision(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def filter_catalog_records(
    records: list[dict[str, Any]],
    *,
    provider: str | None = None,
    capability: str | None = None,
    min_context: int | None = None,
    include_unavailable: bool = True,
) -> list[dict[str, Any]]:
    result = records
    if provider:
        result = [row for row in result if row.get("provider") == provider]
    if capability:
        result = [
            row
            for row in result
            if capability_matches(capability, row.get("capability_types"), row.get("capabilities"))
        ]
    if min_context is not None:
        result = [row for row in result if (row.get("context_window") or 0) >= min_context]
    if not include_unavailable:
        result = [row for row in result if row.get("route_ready") is True]
    return result
