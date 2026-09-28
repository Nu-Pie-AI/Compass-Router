import os
import tempfile
import time

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["APP_SECRET"] = "test-secret"
os.environ["ADMIN_EMAIL"] = "admin@example.com"
os.environ["ADMIN_PASSWORD"] = "CompassAdmin123!"
os.environ["LOCAL_TEST_INPUT_PRICE_PAISE_PER_1K"] = "2"
os.environ["LOCAL_TEST_OUTPUT_PRICE_PAISE_PER_1K"] = "6"
os.environ["DEFAULT_TEAM_TOKEN_LIMIT_PER_MINUTE"] = "250000"
os.environ["PUBLIC_SIGNUP_ENABLED"] = "true"

from app.db import Base, get_db  # noqa: E402
from app.errors import compass_error  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ApiKey, ApiKeyModel, ByokCredential, LlmRequest, Organization, OrganizationMember, Provider, ProviderAttempt, ProviderCredential, Team, TeamMember, User, WalletAccount, WalletLedger  # noqa: E402
from app.security import hash_api_key  # noqa: E402
from app.services import LiteLLMClient, debit_wallet, seed_defaults  # noqa: E402
import app.services as services  # noqa: E402

engine = create_engine(os.environ["DATABASE_URL"], connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
Base.metadata.create_all(bind=engine)
seed_db = TestingSessionLocal()
seed_defaults(seed_db)
seed_db.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


async def fake_provider(self, payload):  # noqa: ARG001
    prompt_tokens = sum(len(str(message.get("content", "")).split()) for message in payload["messages"])
    completion_tokens = min(payload.get("max_tokens") or 64, 32)
    return {
        "id": f"chatcmpl-test-{time.time_ns()}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": payload["model"],
        "choices": [{"index": 0, "message": {"role": "assistant", "content": "Compass controlled beta test response."}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens, "total_tokens": prompt_tokens + completion_tokens},
    }


def admin_headers() -> dict:
    response = client.post("/auth/login", json={"email": "admin@example.com", "password": "CompassAdmin123!"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def create_team_fixture(headers: dict, slug: str | None = None) -> dict:
    response = client.post("/admin/teams", json={"name": "Beta Team", "slug": slug or f"beta-{time.time_ns()}", "notes": "local test"}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def create_member_fixture(headers: dict, team_id: str) -> dict:
    response = client.post("/admin/teams/" + team_id + "/members", json={"name": "Tester", "email": f"tester-{time.time_ns()}@example.com", "role": "developer"}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def create_key_fixture(headers: dict, team_id: str, member_id: str | None = None, models: list[str] | None = None) -> dict:
    response = client.post(
        "/admin/api-keys",
        json={"name": "Cline beta key", "team_id": team_id, "member_id": member_id, "allowed_models": models or ["openai/gpt-5", "gemini/gemini-3.6-flash"]},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def credit(headers: dict, team_id: str, amount_paise: int = 1000, suffix: str = "1") -> None:
    response = client.post("/admin/wallet/topups", json={"team_id": team_id, "amount_paise": amount_paise, "idempotency_key": f"topup-{team_id}-{suffix}"}, headers=headers)
    assert response.status_code == 200, response.text


def chat(key: str, model: str = "openai/gpt-5", content: str = "Hello Compass", max_tokens: int = 64, stream: bool = False):
    return client.post("/v1/chat/completions", json={"model": model, "messages": [{"role": "user", "content": content}], "max_tokens": max_tokens, "stream": stream}, headers={"Authorization": f"Bearer {key}"})


def provision_beta_key(amount_paise: int = 1000) -> tuple[dict, dict, dict, str]:
    headers = admin_headers()
    team = create_team_fixture(headers)
    member = create_member_fixture(headers, team["id"])
    key = create_key_fixture(headers, team["id"], member["id"])
    credit(headers, team["id"], amount_paise)
    return headers, team, member, key["key"]


def test_signup_creates_isolated_customer_workspace_and_login():
    email = f"signup-{time.time_ns()}@example.com"
    password = "NewCustomer123!"
    response = client.post(
        "/auth/signup",
        json={"email": email, "password": password, "organization_name": "Signup Workspace"},
    )
    assert response.status_code == 200, response.text
    session = response.json()
    assert session["email"] == email
    assert session["role"] == "customer"
    assert session["organization_id"]

    headers = {"Authorization": f"Bearer {session['token']}"}
    dashboard = client.get("/dashboard", headers=headers)
    assert dashboard.status_code == 200, dashboard.text
    assert len(dashboard.json()["teams"]) == 1
    assert dashboard.json()["teams"][0]["name"] == "Signup Workspace"
    assert dashboard.json()["teams"][0]["wallet"]["balance_paise"] == 0

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    assert login.json()["organization_id"] == session["organization_id"]

    duplicate = client.post(
        "/auth/signup",
        json={"email": email, "password": password, "organization_name": "Another Workspace"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["error"]["code"] == "account_exists"

    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == email).one()
    organization = db.query(Organization).filter(Organization.id == session["organization_id"]).one()
    organization_member = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).one()
    team_member = db.query(TeamMember).filter(TeamMember.email == email).one()
    wallet = db.query(WalletAccount).filter(WalletAccount.team_id == team_member.team_id).one()
    db.close()
    assert user.password_hash != password
    assert organization.name == "Signup Workspace"
    assert organization_member.role == "owner"
    assert team_member.role == "owner"
    assert wallet.balance_paise == 0


def test_api_key_creation_shows_secret_once_and_stores_hash_only():
    headers = admin_headers()
    team = create_team_fixture(headers)
    member = create_member_fixture(headers, team["id"])
    created = create_key_fixture(headers, team["id"], member["id"])
    assert created["key"].startswith("sk-compass-")
    listed = client.get("/api-keys", headers=headers)
    assert listed.status_code == 200
    assert created["key"] not in listed.text
    db = TestingSessionLocal()
    stored = db.query(ApiKey).filter(ApiKey.key_hash == hash_api_key(created["key"])).one()
    grants = db.query(ApiKeyModel).filter(ApiKeyModel.api_key_id == stored.id).count()
    db.close()
    assert stored.key_hash != created["key"]
    assert grants == 2


def test_api_key_model_access_is_optional_and_editable_after_creation():
    headers = admin_headers()
    team = create_team_fixture(headers)
    member = create_member_fixture(headers, team["id"])
    created = client.post(
        "/admin/api-keys",
        json={"name": "Unrestricted key", "team_id": team["id"], "member_id": member["id"], "allowed_models": []},
        headers=headers,
    )
    assert created.status_code == 200, created.text
    payload = created.json()
    assert payload["models_restricted"] is False
    assert "openai/gpt-5" in payload["allowed_models"]

    restricted = client.patch(
        f"/api-keys/{payload['id']}/models",
        json={"allowed_models": ["openai/gpt-5"]},
        headers=headers,
    )
    assert restricted.status_code == 200, restricted.text
    assert restricted.json() == {"id": payload["id"], "allowed_models": ["openai/gpt-5"], "models_restricted": True}
    models = client.get("/v1/models", headers={"Authorization": f"Bearer {payload['key']}"})
    assert {row["id"] for row in models.json()["data"]} == {"openai/gpt-5"}

    unrestricted = client.patch(
        f"/api-keys/{payload['id']}/models",
        json={"allowed_models": []},
        headers=headers,
    )
    assert unrestricted.status_code == 200, unrestricted.text
    assert unrestricted.json()["models_restricted"] is False


def test_api_key_authentication_models_and_successful_response(monkeypatch):
    monkeypatch.setattr(LiteLLMClient, "chat_completion", fake_provider)
    _, team, member, key = provision_beta_key()
    models = client.get("/v1/models", headers={"Authorization": f"Bearer {key}"})
    assert models.status_code == 200
    assert {row["id"] for row in models.json()["data"]} == {"openai/gpt-5", "gemini/gemini-3.6-flash"}
    response = chat(key)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["object"] == "chat.completion"
    assert body["model"] == "openai/gpt-5"
    assert {"prompt_tokens", "completion_tokens", "total_tokens"} <= set(body["usage"])
    assert body["compass"]["team_id"] == team["id"]
    assert body["compass"]["member_id"] == member["id"]

    account = client.get("/v1/account", headers={"Authorization": f"Bearer {key}"})
    assert account.status_code == 200, account.text
    assert account.json()["team"]["id"] == team["id"]
    assert account.json()["api_key"]["status"] == "active"
    assert account.json()["usage"]["requests"] == 1
    assert account.json()["usage"]["tokens"] == body["usage"]["total_tokens"]
    assert "key_hash" not in account.text


def test_local_test_alias_does_not_require_decrypting_platform_credential(monkeypatch):
    monkeypatch.setattr(LiteLLMClient, "chat_completion", fake_provider)
    _, _, _, key = provision_beta_key()
    db = TestingSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "openai").one()
    credential = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).one()
    original_reference = credential.secret_reference
    credential.secret_reference = "encrypted:stale-local-development-value"
    db.commit()
    db.close()
    try:
        response = chat(key, model="openai/gpt-5")
        assert response.status_code == 200, response.text
        assert response.json()["compass"]["credential_mode"] == "local_test"
    finally:
        db = TestingSessionLocal()
        restored = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).one()
        restored.secret_reference = original_reference
        db.commit()
        db.close()


def test_cline_openai_compatible_request_shape(monkeypatch):
    monkeypatch.setattr(LiteLLMClient, "chat_completion", fake_provider)
    _, team, _, key = provision_beta_key(3000)
    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "gemini/gemini-3.6-flash",
            "messages": [
                {"role": "developer", "content": "You are running inside VS Code."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Hi from Cline."},
                    ],
                },
            ],
            "max_tokens": 128000,
            "stream": False,
            "tools": [],
        },
        headers={"Authorization": f"Bearer {key}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["model"] == "gemini/gemini-3.6-flash"
    assert body["compass"]["team_id"] == team["id"]


def test_revoked_key_rejection():
    headers, _, _, key = provision_beta_key()
    db = TestingSessionLocal()
    stored = db.query(ApiKey).filter(ApiKey.key_hash == hash_api_key(key)).one()
    api_key_id = stored.id
    db.close()
    revoke = client.post(f"/api-keys/{api_key_id}/revoke", headers=headers)
    assert revoke.status_code == 200
    response = chat(key)
    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "revoked_api_key"


def test_wallet_creation_credit_and_ledger_entry():
    headers = admin_headers()
    team = create_team_fixture(headers)
    wallet = client.get("/wallet", params={"team_id": team["id"]}, headers=headers)
    assert wallet.status_code == 200
    assert wallet.json()["balance_paise"] == 0
    credit(headers, team["id"], 2500)
    wallet = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()
    ledger = client.get("/wallet/ledger", params={"team_id": team["id"]}, headers=headers).json()
    assert wallet["balance_paise"] == 2500
    assert ledger[0]["type"] == "credit"
    assert ledger[0]["amount_paise"] == 2500


def test_insufficient_balance_prevents_provider_call(monkeypatch):
    monkeypatch.setattr(LiteLLMClient, "chat_completion", fake_provider)
    headers = admin_headers()
    team = create_team_fixture(headers)
    key = create_key_fixture(headers, team["id"])["key"]
    response = chat(key, max_tokens=8192)
    assert response.status_code == 402
    assert response.json()["detail"]["error"]["code"] == "insufficient_balance"


def test_successful_request_records_usage_debit_and_provider_attempt(monkeypatch):
    monkeypatch.setattr(LiteLLMClient, "chat_completion", fake_provider)
    headers, team, member, key = provision_beta_key()
    before = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"]
    response = chat(key, content="Count these local test tokens")
    assert response.status_code == 200, response.text
    cost = response.json()["compass"]["compass_cost_paise"]
    after = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"]
    usage = client.get("/usage/requests", headers=headers).json()
    ledger = client.get("/wallet/ledger", params={"team_id": team["id"]}, headers=headers).json()
    assert after == before - cost
    assert usage[0]["team_id"] == team["id"]
    assert usage[0]["member_id"] == member["id"]
    assert usage[0]["tokens"] > 0
    assert ledger[0]["type"] == "debit"
    db = TestingSessionLocal()
    assert db.query(ProviderAttempt).filter(ProviderAttempt.request_id == usage[0]["id"], ProviderAttempt.status == "success").count() == 1
    db.close()


def test_idempotent_debit_does_not_double_charge():
    headers = admin_headers()
    team = create_team_fixture(headers)
    credit(headers, team["id"], 1000)
    db = TestingSessionLocal()
    wallet = db.query(WalletAccount).filter(WalletAccount.team_id == team["id"]).one()
    first = debit_wallet(db, team["id"], 100, "same-debit", "manual-test")
    second = debit_wallet(db, team["id"], 100, "same-debit", "manual-test")
    db.refresh(wallet)
    ledger_count = db.query(WalletLedger).filter(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == "same-debit").count()
    db.close()
    assert first.id == second.id
    assert ledger_count == 1
    assert second.balance_after == 900


def test_unknown_and_not_allowed_models(monkeypatch):
    monkeypatch.setattr(LiteLLMClient, "chat_completion", fake_provider)
    _, _, _, key = provision_beta_key()
    unknown = chat(key, model="openai/missing")
    assert unknown.status_code == 404
    not_allowed = chat(key, model="ollama_cloud/gpt-oss:20b")
    assert not_allowed.status_code == 403
    assert not_allowed.json()["detail"]["error"]["code"] == "model_not_allowed"


def test_missing_authorization_and_invalid_request():
    missing = client.post("/v1/chat/completions", json={"model": "openai/gpt-5", "messages": [{"role": "user", "content": "Hi"}]})
    assert missing.status_code == 401
    invalid = client.post("/v1/chat/completions", json={"model": "openai/gpt-4o", "messages": [{"role": "customer", "content": ""}]}, headers={"Authorization": "Bearer sk-compass-invalid"})
    assert invalid.status_code == 422
    assert invalid.json()["detail"]["error"]["code"] == "invalid_request"


def test_provider_failure_timeout_and_malformed_response(monkeypatch):
    async def fail_provider(self, payload):  # noqa: ARG001
        raise compass_error(503, "provider_unavailable", "Provider is unavailable.")

    async def timeout_provider(self, payload):  # noqa: ARG001
        raise compass_error(504, "provider_timeout", "Provider request timed out.")

    async def malformed_provider(self, payload):  # noqa: ARG001
        return {"id": "bad"}

    headers, team, _, key = provision_beta_key(3000)
    for provider, code in ((fail_provider, "provider_unavailable"), (timeout_provider, "provider_timeout"), (malformed_provider, "malformed_provider_response")):
        monkeypatch.setattr(LiteLLMClient, "chat_completion", provider)
        response = chat(key)
        assert response.status_code in {502, 503, 504}
        assert response.json()["detail"]["error"]["code"] == code
    db = TestingSessionLocal()
    errors = db.query(LlmRequest).filter(LlmRequest.team_id == team["id"], LlmRequest.status == "error").all()
    db.close()
    assert {row.error_code for row in errors} >= {"provider_unavailable", "provider_timeout", "malformed_provider_response"}


def test_provider_retry_records_each_attempt_and_returns_success(monkeypatch):
    calls = []

    async def retrying_provider(self, payload):  # noqa: ARG001
        calls.append(payload["model"])
        if len(calls) == 1:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        return await fake_provider(self, payload)

    monkeypatch.setattr(LiteLLMClient, "chat_completion", retrying_provider)
    _, team, _, key = provision_beta_key()
    response = chat(key)
    assert response.status_code == 200, response.text
    assert calls == ["local-test-chat", "local-test-chat"]
    usage = client.get("/usage/requests", headers=admin_headers()).json()
    request_id = response.json()["compass"]["request_id"]
    db = TestingSessionLocal()
    attempts = db.query(ProviderAttempt).filter(ProviderAttempt.request_id == request_id).order_by(ProviderAttempt.created_at.asc()).all()
    db.close()
    assert [attempt.status for attempt in attempts] == ["error", "success"]
    assert any(row["id"] == request_id and row["team_id"] == team["id"] for row in usage)


def test_streaming_response_format(monkeypatch):
    monkeypatch.setattr(LiteLLMClient, "chat_completion", fake_provider)
    _, _, _, key = provision_beta_key()
    response = chat(key, stream=True)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert "chat.completion.chunk" in response.text
    assert "data: [DONE]" in response.text


def test_admin_overview_and_dashboard_local_mode():
    headers = admin_headers()
    create_team_fixture(headers)
    dashboard = client.get("/dashboard", headers=headers).json()
    admin = client.get("/admin/local-test", headers=headers).json()
    assert dashboard["mode"] == "LOCAL TEST MODE"
    assert any(model["id"] == "openai/gpt-5" for model in dashboard["models"])
    assert any(provider["name"] == "openai" for provider in admin["providers"])
    assert db_count(Team) > 0


def test_admin_provider_api_key_is_saved_server_side_only():
    headers = admin_headers()
    raw_secret = "sk-test-provider-secret-123456"
    response = client.post("/admin/provider-credentials", json={"provider": "openai", "api_key": raw_secret}, headers=headers)
    assert response.status_code == 200, response.text
    assert raw_secret not in response.text
    assert response.json()["last_four"] == "3456"
    admin = client.get("/admin/local-test", headers=headers)
    assert admin.status_code == 200
    assert raw_secret not in admin.text
    provider_row = next(row for row in admin.json()["providers"] if row["name"] == "openai")
    assert provider_row["has_configured_key"] is True
    assert provider_row["last_four"] == "3456"
    db = TestingSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "openai").one()
    credential = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).one()
    db.close()
    assert credential.secret_reference.startswith("encrypted:")
    assert raw_secret not in credential.secret_reference


def test_admin_model_discovery_uses_litellm_registry(monkeypatch):
    headers = admin_headers()

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):  # noqa: ARG002
            return False

        async def get(self, url, headers=None, params=None):  # noqa: ARG002
            assert url.endswith("/public/litellm_model_cost_map")
            return FakeResponse(
                {
                    "sample_spec": {"litellm_provider": "one of providers"},
                    "gpt-test": {"litellm_provider": "openai", "mode": "chat", "max_input_tokens": 32768, "input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002, "supports_function_calling": True},
                    "gemini/gemini-test": {"litellm_provider": "gemini", "mode": "chat", "max_input_tokens": 1000000},
                    "embed-test": {"litellm_provider": "openai", "mode": "embedding", "max_input_tokens": 8192},
                }
            )

    monkeypatch.setattr("app.services.httpx.AsyncClient", lambda **kwargs: FakeAsyncClient())
    response = client.get("/admin/models/discover", headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == 3
    assert {row["provider_model_id"] for row in payload["models"]} == {"openai/gpt-test", "gemini/gemini-test", "openai/embed-test"}
    assert {source["status"] for source in payload["sources"]} == {"available"}
    assert payload["catalog_source"] == "controlled-litellm-runtime"


def test_team_byok_activation_and_routing(monkeypatch):
    headers = admin_headers()
    team = create_team_fixture(headers)
    raw_secret = "sk-team-byok-secret-123456"
    saved = client.post("/byok/credentials", json={"team_id": team["id"], "provider": "openai", "api_key": raw_secret}, headers=headers)
    assert saved.status_code == 200, saved.text
    assert raw_secret not in saved.text
    assert saved.json()["last_four"] == "3456"

    services._litellm_catalog_cache.update(
        expires_at=time.monotonic() + 60,
        models=[{
            "provider": "openai", "provider_model_id": "openai/gpt-byok", "litellm_model_id": "openai/gpt-byok",
            "display_name": "GPT BYOK", "capabilities": ["chat", "tools"], "mode": "chat", "context_window": 32768,
            "input_cost_per_million_usd": 1.0, "output_cost_per_million_usd": 2.0, "byok_supported": True, "metadata": {},
        }],
        sources=[{"provider": "openai", "status": "available", "count": 1, "error": None}],
    )
    activated = client.post("/models/activate", json={"team_id": team["id"], "model_id": "openai/gpt-byok"}, headers=headers)
    assert activated.status_code == 200, activated.text
    assert activated.json()["id"] == "openai/gpt-byok"

    key = create_key_fixture(headers, team["id"], models=["openai/gpt-byok"])["key"]
    credit(headers, team["id"], 5000)
    captured = {}

    async def byok_provider(self, payload):  # noqa: ARG001
        captured.update(payload)
        return await fake_provider(self, payload)

    monkeypatch.setattr(LiteLLMClient, "chat_completion", byok_provider)
    response = chat(key, model="openai/gpt-byok")
    assert response.status_code == 200, response.text
    assert response.json()["compass"]["credential_mode"] == "byok"
    assert captured["model"] == "openai/gpt-byok"
    assert captured["api_key"] == raw_secret

    listed = client.get("/byok/credentials", params={"team_id": team["id"]}, headers=headers)
    assert listed.status_code == 200
    assert raw_secret not in listed.text
    db = TestingSessionLocal()
    credential = db.query(ByokCredential).filter(ByokCredential.team_id == team["id"]).one()
    db.close()
    assert credential.encrypted_secret.startswith("encrypted:")
    assert raw_secret not in credential.encrypted_secret

    deleted = client.delete(f"/byok/credentials/openai?team_id={team['id']}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "revoked"


def db_count(model) -> int:
    db = TestingSessionLocal()
    count = db.query(model).count()
    db.close()
    return count
