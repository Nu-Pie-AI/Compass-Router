import pytest

from infra.verify_staging import normalize_base_url, run


def test_staging_smoke_requires_an_explicit_http_url():
    assert normalize_base_url("https://router.example/") == "https://router.example"
    with pytest.raises(ValueError):
        normalize_base_url("router.example")


def test_staging_smoke_requires_paid_request_acknowledgement_before_streaming():
    args = type("Args", (), {"api_url": "https://router.example", "api_key": "secret", "timeout": 1.0, "run_chat": True, "allow_paid_request": False, "model": "openai/gpt-test"})()
    assert run(args) == 2


def test_staging_smoke_requires_explicit_model_before_streaming():
    args = type("Args", (), {"api_url": "https://router.example", "api_key": "secret", "timeout": 1.0, "run_chat": True, "allow_paid_request": True, "model": None})()
    assert run(args) == 2
