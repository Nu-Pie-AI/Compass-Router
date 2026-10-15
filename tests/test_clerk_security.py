from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from starlette.requests import Request

from app import security
from app.config import get_settings


def _request(token: str = "Bearer clerk-session") -> Request:
    return Request({
        "type": "http",
        "method": "GET",
        "path": "/me",
        "headers": [(b"authorization", token.encode())],
        "query_string": b"",
        "scheme": "https",
        "server": ("testserver", 443),
        "client": ("127.0.0.1", 1),
        "root_path": "",
    })


def test_clerk_request_uses_session_tokens_and_configured_claim_constraints(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_clerk")
    monkeypatch.setattr(settings, "clerk_jwt_key", None)
    monkeypatch.setattr(settings, "clerk_issuer", "https://worthy-mutt-884.clerk.accounts.dev")
    monkeypatch.setattr(settings, "clerk_audience", "compass-api")
    monkeypatch.setattr(settings, "clerk_authorized_parties", "https://compass.example,https://staging.example")
    captured = {}

    def fake_authenticate(request, options):
        captured["request"] = request
        captured["options"] = options
        return SimpleNamespace(is_authenticated=True, payload={
            "iss": "https://worthy-mutt-884.clerk.accounts.dev",
            "sub": "user_123",
            "exp": 2_000_000_000,
        })

    monkeypatch.setattr(security, "authenticate_request", fake_authenticate)
    claims = security.authenticate_clerk_request(_request())

    assert claims["sub"] == "user_123"
    assert captured["options"].accepts_token == ["session_token"]
    assert captured["options"].audience == "compass-api"
    assert captured["options"].authorized_parties == ["https://compass.example", "https://staging.example"]
    assert captured["options"].secret_key == "sk_test_clerk"


def test_clerk_request_fails_closed_for_unauthenticated_state(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_clerk")
    monkeypatch.setattr(settings, "clerk_issuer", "https://worthy-mutt-884.clerk.accounts.dev")
    monkeypatch.setattr(security, "authenticate_request", lambda *_args: SimpleNamespace(is_authenticated=False, payload=None, reason="invalid token"))

    with pytest.raises(ValueError, match="invalid token"):
        security.authenticate_clerk_request(_request())


def test_clerk_request_fails_closed_when_issuer_is_unconfigured(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "clerk_issuer", None)
    monkeypatch.setattr(security, "authenticate_request", lambda *_args: pytest.fail("verifier must not run without trusted issuer"))

    with pytest.raises(ValueError, match="CLERK_ISSUER is required"):
        security.authenticate_clerk_request(_request())


@pytest.mark.parametrize(
    ("token_issuer", "accepted"),
    [
        ("https://worthy-mutt-884.clerk.accounts.dev", True),
        ("https://attacker.clerk.accounts.dev", False),
        (None, False),
    ],
)
def test_clerk_request_checks_issuer_after_real_rs256_signature_verification(monkeypatch, token_issuer, accepted):
    settings = get_settings()
    monkeypatch.setattr(settings, "clerk_secret_key", None)
    monkeypatch.setattr(settings, "clerk_issuer", "https://worthy-mutt-884.clerk.accounts.dev")
    monkeypatch.setattr(settings, "clerk_authorized_parties", "")
    monkeypatch.setattr(settings, "clerk_audience", None)
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")
    monkeypatch.setattr(settings, "clerk_jwt_key", public_key)
    now = datetime.now(UTC)
    claims = {
        "sub": "user_synthetic_issuer_test",
        "sid": "sess_synthetic_issuer_test",
        "iat": now,
        "nbf": now - timedelta(seconds=1),
        "exp": now + timedelta(minutes=2),
    }
    if token_issuer is not None:
        claims["iss"] = token_issuer
    token = jwt.encode(
        claims,
        private_key,
        algorithm="RS256",
        headers={"kid": "synthetic-test-key", "typ": "JWT"},
    )

    if accepted:
        assert security.authenticate_clerk_request(_request(f"Bearer {token}"))["iss"] == settings.clerk_issuer
    else:
        with pytest.raises(ValueError, match="issuer does not match"):
            security.authenticate_clerk_request(_request(f"Bearer {token}"))


def test_clerk_email_provisioning_requires_verified_primary_email(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_clerk")

    unverified = SimpleNamespace(
        primary_email_address_id="email_1",
        email_addresses=[SimpleNamespace(id="email_1", email_address="user@example.com", verification=SimpleNamespace(status="unverified"))],
    )
    monkeypatch.setattr(security, "Clerk", lambda **_kwargs: SimpleNamespace(users=SimpleNamespace(get=lambda **_args: unverified)))

    with pytest.raises(ValueError, match="not verified"):
        security.clerk_user_email("user_clerk_123")
