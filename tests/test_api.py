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
from app.models import ApiKey, ApiKeyModel, BatchJob, BillingInvoice, ByokCredential, LlmRequest, ModelCatalog, ModelPolicy, Organization, OrganizationMember, PaymentEvent, PaymentOrder, PaymentRefund, Provider, ProviderAttempt, ProviderCredential, ProviderHealthCheck, RoutingPolicy, Team, TeamLimit, TeamMember, User, WalletAccount, WalletLedger  # noqa: E402
from app.security import hash_api_key  # noqa: E402
from app.services import LiteLLMClient, _circuit_is_open, debit_wallet, record_provider_health, seed_defaults, stream_openai_chunks  # noqa: E402
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


def test_development_billing_completion_is_idempotent_and_creates_invoice():
    headers = admin_headers()
    team = create_team_fixture(headers)
    order_response = client.post("/billing/orders", json={"team_id": team["id"], "amount_paise": 2500}, headers=headers)
    assert order_response.status_code == 200, order_response.text
    order = order_response.json()
    completed = client.post(f"/billing/orders/{order['id']}/complete", json={"confirmation": "test"}, headers=headers)
    assert completed.status_code == 200, completed.text
    repeated = client.post(f"/billing/orders/{order['id']}/complete", json={"confirmation": "test"}, headers=headers)
    assert repeated.status_code == 200, repeated.text
    wallet = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()
    ledger = client.get("/wallet/ledger", params={"team_id": team["id"]}, headers=headers).json()
    invoices = client.get("/billing/invoices", params={"team_id": team["id"]}, headers=headers)
    assert wallet["balance_paise"] == 2500
    assert len([row for row in ledger if row["reference_type"] == "payment_order"]) == 1
    assert invoices.status_code == 200
    assert len(invoices.json()) == 1
    assert invoices.json()[0]["total_paise"] == 2500
    db = TestingSessionLocal()
    assert db.query(BillingInvoice).filter(BillingInvoice.order_id == order["id"]).count() == 1
    db.close()


def test_razorpay_webhook_is_signature_checked_and_idempotent(monkeypatch):
    from app import main as main_module

    monkeypatch.setattr(main_module.settings, "razorpay_webhook_secret", "webhook-test-secret")
    headers = admin_headers()
    team = create_team_fixture(headers)
    db = TestingSessionLocal()
    order = PaymentOrder(team_id=team["id"], provider="razorpay", provider_order_id="order_test_123", amount_paise=3000, currency="INR", status="created")
    db.add(order)
    db.commit()
    order_id = order.id
    db.close()
    import hashlib
    import hmac
    import json

    payload = {"id": "evt_test_123", "event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_test_123", "order_id": "order_test_123", "amount": 3000, "currency": "INR", "status": "captured"}}}}
    raw = json.dumps(payload).encode()
    signature = hmac.new(b"webhook-test-secret", raw, hashlib.sha256).hexdigest()
    webhook_headers = {"X-Razorpay-Signature": signature, "X-Razorpay-Event-Id": "evt_test_123"}
    first = client.post("/webhooks/razorpay", content=raw, headers=webhook_headers)
    second = client.post("/webhooks/razorpay", content=raw, headers=webhook_headers)
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert second.json()["duplicate"] is True
    wallet = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()
    assert wallet["balance_paise"] == 3000
    db = TestingSessionLocal()
    assert db.query(PaymentEvent).filter(PaymentEvent.event_id == "evt_test_123").count() == 1
    assert db.query(PaymentOrder).filter(PaymentOrder.id == order_id, PaymentOrder.status == "completed").count() == 1
    db.close()


def test_development_refund_reverses_wallet_and_reconciliation_matches():
    headers = admin_headers()
    team = create_team_fixture(headers)
    created = client.post("/billing/orders", json={"team_id": team["id"], "amount_paise": 4000}, headers=headers).json()
    assert client.post(f"/billing/orders/{created['id']}/complete", json={"confirmation": "test"}, headers=headers).status_code == 200
    refund = client.post(f"/billing/orders/{created['id']}/refund", json={"reason": "test refund"}, headers=headers)
    assert refund.status_code == 200, refund.text
    assert refund.json()["status"] == "processed"
    wallet = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()
    assert wallet["balance_paise"] == 0
    refunds = client.get("/billing/refunds", params={"team_id": team["id"]}, headers=headers).json()
    assert len(refunds) == 1
    reconciliation = client.get("/admin/billing/reconciliation", headers=headers)
    assert reconciliation.status_code == 200, reconciliation.text
    assert reconciliation.json()["missing_credit_order_ids"] == []


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
        db.query(ProviderHealthCheck).delete()
        db.query(Provider).update({Provider.status: "healthy"})
        db.commit()
        db.close()
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


def test_responses_api_uses_chat_capability_and_records_usage(monkeypatch):
    async def fake_json(self, endpoint, payload):  # noqa: ARG001
        assert endpoint == "/v1/responses"
        assert payload["model"] == "local-test-chat"
        return {
            "id": "resp_test",
            "object": "response",
            "model": payload["model"],
            "output": [{"type": "message", "content": [{"type": "output_text", "text": "Compass response"}]}],
            "usage": {"input_tokens": 3, "output_tokens": 4, "total_tokens": 7},
        }

    monkeypatch.setattr(LiteLLMClient, "request_json", fake_json)
    _, team, _, key = provision_beta_key()
    response = client.post(
        "/v1/responses",
        json={"model": "openai/gpt-5", "input": "Hello Compass", "max_output_tokens": 32},
        headers={"Authorization": f"Bearer {key}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["object"] == "response"
    assert response.json()["compass"]["team_id"] == team["id"]
    assert response.json()["usage"]["total_tokens"] == 7


def test_model_capability_mismatch_is_rejected_before_provider_call(monkeypatch):
    async def unexpected_provider_call(self, endpoint, payload):  # noqa: ARG001
        raise AssertionError("provider should not be called for an incompatible model")

    monkeypatch.setattr(LiteLLMClient, "request_json", unexpected_provider_call)
    _, _, _, key = provision_beta_key()
    response = client.post(
        "/v1/embeddings",
        json={"model": "openai/gpt-5", "input": "Hello Compass"},
        headers={"Authorization": f"Bearer {key}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["error"]["code"] == "model_capability_mismatch"


def test_embeddings_api_routes_an_enabled_embedding_model(monkeypatch):
    db = TestingSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "openai").one()
    model_id = "openai/test-embedding"
    if db.get(ModelCatalog, model_id) is None:
        db.add(ModelCatalog(id=model_id, provider_id=provider.id, provider_model_id="local-test-embedding", display_name="Test Embedding", capabilities="embeddings", context_window=8192, input_price_paise_per_1k=2, output_price_paise_per_1k=0))
        db.commit()
    db.close()

    async def fake_json(self, endpoint, payload):  # noqa: ARG001
        assert endpoint == "/v1/embeddings"
        return {"object": "list", "data": [{"object": "embedding", "index": 0, "embedding": [0.1, 0.2]}], "model": payload["model"], "usage": {"prompt_tokens": 2, "total_tokens": 2}}

    monkeypatch.setattr(LiteLLMClient, "request_json", fake_json)
    headers = admin_headers()
    team = create_team_fixture(headers)
    member = create_member_fixture(headers, team["id"])
    key = create_key_fixture(headers, team["id"], member["id"], models=["openai/test-embedding"])["key"]
    credit(headers, team["id"], 1000)
    response = client.post(
        "/v1/embeddings",
        json={"model": "openai/test-embedding", "input": "Compass models"},
        headers={"Authorization": f"Bearer {key}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"][0]["object"] == "embedding"
    assert response.json()["compass"]["provider"] == "openai"


def test_provider_circuit_breaker_opens_after_three_failures():
    db = TestingSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "openai").one()
    for _ in range(3):
        record_provider_health(db, provider, success=False, latency_ms=25, error_code="provider_unavailable")
        db.flush()
    assert _circuit_is_open(db, provider.id) is True
    db.rollback()
    db.close()


def test_streaming_response_preserves_tool_calls_and_reasoning_text():
    response = {
        "id": "chatcmpl-tool-test",
        "model": "demo",
        "created": int(time.time()),
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": None,
                "reasoning_content": "Inspecting the workspace.",
                "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "read_file", "arguments": '{"path":"README.md"}'}}],
            },
            "finish_reason": "tool_calls",
        }],
        "usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3},
    }
    chunks = "".join(stream_openai_chunks(response))
    assert "Inspecting the workspace." in chunks
    assert '"name": "read_file"' in chunks
    assert '"arguments": "{\\"path\\":\\"README.md\\"}"' in chunks


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


def test_logout_revokes_existing_session_token():
    headers = admin_headers()
    token = headers["Authorization"].removeprefix("Bearer ")
    signed_out = client.post("/auth/logout", headers=headers)
    assert signed_out.status_code == 200
    rejected = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert rejected.status_code == 401


def test_team_limits_are_visible_and_admin_editable():
    headers = admin_headers()
    team = create_team_fixture(headers)
    initial = client.get(f"/teams/{team['id']}/limits", headers=headers)
    assert initial.status_code == 200
    update = client.patch(
        f"/admin/teams/{team['id']}/limits",
        json={"requests_per_minute": 12, "tokens_per_minute": 1200, "daily_spend_limit_paise": 900, "monthly_spend_limit_paise": 9000},
        headers=headers,
    )
    assert update.status_code == 200, update.text
    assert update.json()["daily_spend_limit_paise"] == 900
    assert client.get(f"/teams/{team['id']}/limits", headers=headers).json()["requests_per_minute"] == 12
    db = TestingSessionLocal()
    assert db.query(TeamLimit).filter(TeamLimit.team_id == team["id"], TeamLimit.tokens_per_minute == 1200).count() == 1
    db.close()


def test_responses_streaming_and_batch_lifecycle(monkeypatch):
    async def fake_json(self, endpoint, payload):  # noqa: ARG001
        return {"id": "resp_test_1" if endpoint == "/v1/responses" else "batch_test_1", "object": "response", "status": "submitted", "model": payload["model"], "usage": {"input_tokens": 2, "output_tokens": 3, "total_tokens": 5}}

    monkeypatch.setattr(LiteLLMClient, "request_json", fake_json)
    headers = admin_headers()
    team = create_team_fixture(headers)
    key = create_key_fixture(headers, team["id"], models=["openai/gpt-5"])["key"]
    credit(headers, team["id"], 5000)
    key_headers = {"Authorization": f"Bearer {key}"}
    streamed = client.post("/v1/responses", json={"model": "openai/gpt-5", "input": "Hello", "stream": True}, headers=key_headers)
    assert streamed.status_code == 200, streamed.text
    assert "event: response.completed" in streamed.text
    created = client.post("/v1/batches", json={"model": "openai/gpt-5", "input_file_id": "file_test", "endpoint": "/v1/responses"}, headers=key_headers)
    assert created.status_code == 200, created.text
    batch_id = created.json()["compass"]["batch_id"]
    status = client.get(f"/v1/batches/{batch_id}", headers=key_headers)
    assert status.status_code == 200
    assert status.json()["id"] == "batch_test_1"
    cancelled = client.post(f"/v1/batches/{batch_id}/cancel", headers=key_headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    db = TestingSessionLocal()
    assert db.query(BatchJob).filter(BatchJob.id == batch_id, BatchJob.status == "cancelled").count() == 1
    db.close()


def test_model_governance_policies_and_routing_alias(monkeypatch):
    async def fake_json(self, endpoint, payload):  # noqa: ARG001
        return {"id": "governance_test", "object": "chat.completion", "model": payload["model"], "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}}

    monkeypatch.setattr(LiteLLMClient, "request_json", fake_json)
    headers = admin_headers()
    team = create_team_fixture(headers)
    key = create_key_fixture(headers, team["id"], models=["openai/gpt-5"])["key"]
    credit(headers, team["id"], 5000)
    updated = client.put(f"/teams/{team['id']}/model-policies/openai/gpt-5", json={"enabled": False, "requests_per_minute": 1, "daily_spend_limit_paise": 100, "monthly_spend_limit_paise": 1000}, headers=headers)
    assert updated.status_code == 200, updated.text
    assert updated.json()["enabled"] is False
    blocked = client.post("/v1/chat/completions", json={"model": "openai/gpt-5", "messages": [{"role": "user", "content": "hi"}]}, headers={"Authorization": f"Bearer {key}"})
    assert blocked.status_code == 403
    enabled = client.put(f"/teams/{team['id']}/model-policies/openai/gpt-5", json={"enabled": True, "requests_per_minute": 5, "daily_spend_limit_paise": 1000, "monthly_spend_limit_paise": 10000}, headers=headers)
    assert enabled.status_code == 200, enabled.text
    policy = client.put("/admin/router/policies/fast", json={"candidate_models": ["openai/gpt-5"], "enabled": True}, headers=headers)
    assert policy.status_code == 200, policy.text
    assert client.get("/admin/router/policies", headers=headers).json()[0]["alias"] == "fast"
    routed = client.post("/v1/chat/completions", json={"model": "fast", "messages": [{"role": "user", "content": "hi"}]}, headers={"Authorization": f"Bearer {key}"})
    assert routed.status_code == 200, routed.text
    assert routed.json()["model"] == "fast"
    db = TestingSessionLocal()
    assert db.query(ModelPolicy).filter(ModelPolicy.team_id == team["id"], ModelPolicy.model_id == "openai/gpt-5").count() == 1
    assert db.query(RoutingPolicy).filter(RoutingPolicy.alias == "fast").count() == 1
    db.close()
