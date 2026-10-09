from decimal import Decimal

from app.catalog import capability_matches, filter_catalog_records, normalize_litellm_cost_map, openrouter_capability_types, provider_protocol, snapshot_revision
from app.config import Settings, validate_runtime_config


def test_litellm_normalization_is_provider_neutral_and_stable():
    raw = {
        "gpt-test": {
            "litellm_provider": "openai",
            "mode": "chat",
            "max_input_tokens": 8192,
            "max_output_tokens": 2048,
            "input_cost_per_token": 0.000001,
            "output_cost_per_token": 0.000002,
            "supports_function_calling": True,
            "input_modalities": ["text"],
            "output_modalities": ["text"],
        },
        "embed-test": {
            "litellm_provider": "gemini",
            "mode": "embedding",
            "max_input_tokens": 2048,
        },
        "sample_spec": {"litellm_provider": "ignored"},
    }

    records = normalize_litellm_cost_map(raw)

    assert [record["id"] for record in records] == ["gemini/embed-test", "openai/gpt-test"]
    chat = records[1]
    assert chat["provider_model_id"] == "openai/gpt-test"
    assert chat["protocol"] == "litellm"
    assert chat["capability_types"] == ["chat_completion", "responses"]
    assert chat["input_cost_per_million_usd"] == Decimal("1.000000")
    assert chat["output_cost_per_million_usd"] == Decimal("2.000000")
    assert records[0]["capability_types"] == ["embedding"]


def test_litellm_unknown_modes_are_not_promoted_to_chat():
    records = normalize_litellm_cost_map(
        {
            "rerank-test": {"litellm_provider": "cohere", "mode": "rerank"},
            "unknown-test": {"litellm_provider": "future", "mode": "unknown"},
        }
    )

    assert records
    assert all(record["capability_types"] == [] for record in records)


def test_catalog_filtering_uses_capabilities_and_route_readiness():
    records = [
        {"provider": "openai", "capability_types": ["chat_completion"], "context_window": 8192, "route_ready": True},
        {"provider": "gemini", "capability_types": ["embedding"], "context_window": 16384, "route_ready": False},
    ]

    assert filter_catalog_records(records, capability="embedding", min_context=10000) == [records[1]]
    assert filter_catalog_records(records, include_unavailable=False) == [records[0]]
    assert filter_catalog_records(records, provider="missing") == []


def test_catalog_source_revision_is_deterministic_and_protocols_are_explicit():
    payload = {"models": [{"id": "openai/gpt-test", "price": "1.0"}]}
    assert snapshot_revision(payload) == snapshot_revision({"models": [{"price": "1.0", "id": "openai/gpt-test"}]})
    assert provider_protocol("openai") == "litellm"
    assert provider_protocol("openrouter") == "openrouter_optional"
    assert provider_protocol("future_native") == "unverified"


def test_capability_matching_prefers_canonical_types_with_legacy_fallback():
    assert capability_matches("embeddings", ["embedding"], ["chat"])
    assert capability_matches("responses", "chat_completion,responses")
    assert not capability_matches("decision", ["chat_completion", "responses"])


def test_optional_openrouter_capability_mapping_is_provider_neutral():
    assert openrouter_capability_types(["chat", "tools"], ["text"], ["text"]) == ["chat_completion", "responses"]
    assert openrouter_capability_types(["embeddings"], ["text"], ["embedding"]) == ["embedding"]


def test_production_configuration_does_not_require_openrouter():
    validate_runtime_config(
        Settings(
            environment="production",
            local_test_mode=False,
            app_secret="production-secret",
            compass_sso_secret="production-sso-secret",
            litellm_master_key="production-litellm-key",
            billing_payment_mode="razorpay",
            secret_manager_enabled=True,
            database_migration_mode="alembic",
            gcp_project_id="compass-test",
            admin_password="production-admin-secret",
            razorpay_key_id="rzp_test_id",
            razorpay_key_secret="rzp_test_secret",
            razorpay_webhook_secret="rzp_test_webhook",
            clerk_secret_key="clerk_test_secret",
            platform_super_admin_clerk_user_id="user_platform_owner",
            clerk_webhook_signing_secret="whsec_test",
            smtp_host="smtp.test",
            openrouter_api_key=None,
        )
    )
