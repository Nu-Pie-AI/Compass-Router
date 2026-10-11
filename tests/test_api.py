import os
import tempfile
import time
from datetime import datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["APP_SECRET"] = "test-secret"
os.environ["ADMIN_EMAIL"] = "admin@example.com"
os.environ["ADMIN_PASSWORD"] = "CompassAdmin123!"
os.environ["LOCAL_TEST_INPUT_PRICE_PAISE_PER_1K"] = "2"
os.environ["LOCAL_TEST_OUTPUT_PRICE_PAISE_PER_1K"] = "6"
os.environ["LOCAL_TEST_MODE"] = "true"
os.environ["PROVIDER_EXECUTION_MODE"] = "proxy"
os.environ["DEFAULT_TEAM_TOKEN_LIMIT_PER_MINUTE"] = "250000"
os.environ["PUBLIC_SIGNUP_ENABLED"] = "true"

from app.config import get_settings  # noqa: E402
get_settings.cache_clear()
from app.db import Base, get_db  # noqa: E402
from app.config import Settings, validate_runtime_config  # noqa: E402
from app.errors import compass_error  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ApiKey, ApiKeyModel, AuditLog, BatchJob, BillingInvoice, ByokCredential, ClerkWebhookEvent, EmailOutbox, ExtensionSession, LlmRequest, ModelCatalog, ModelPolicy, Organization, OrganizationMember, PaymentEvent, PaymentOrder, PaymentRefund, PlatformBootstrapState, PlatformRoleAssignment, PlatformSetting, PricingPolicy, PricingRevision, ProjectMember, Provider, ProviderAttempt, ProviderCredential, ProviderHealthCheck, RoutingPolicy, Team, TeamLimit, TeamMember, User, WalletAccount, WalletLedger  # noqa: E402
from app.security import encrypt_secret, hash_api_key, hash_password  # noqa: E402
from app.recovery import recover_stale_llm_reservations  # noqa: E402
from app.services import LiteLLMClient, _circuit_is_open, debit_wallet, record_provider_health, seed_defaults, stream_openai_chunks, upsert_provider_api_key  # noqa: E402
import app.services as services  # noqa: E402
import app.email_worker as email_worker  # noqa: E402
import app.main as main_module  # noqa: E402

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


def login_headers(email: str, password: str) -> dict:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_security_headers_and_request_id_are_present():
    response = client.get("/health", headers={"X-Request-ID": "p0-health-check"})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "p0-health-check"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_m9_admin_access_is_denied_to_customer_and_exposes_legacy_admin_permissions():
    customer_email = f"m9-customer-{time.time_ns()}@example.com"
    signup = client.post("/auth/signup", json={"email": customer_email, "password": "M9Customer123!", "organization_name": "M9 Customer Workspace"})
    assert signup.status_code == 200, signup.text
    customer_headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    denied = client.get("/admin/access", headers=customer_headers)
    assert denied.status_code == 403
    access = client.get("/admin/access", headers=admin_headers())
    assert access.status_code == 200, access.text
    assert "PLATFORM_ADMIN" in access.json()["roles"]
    assert "finance.adjust" in access.json()["permissions"]


def test_portal_context_is_server_derived_for_company_owner_and_platform_admin():
    customer_email = f"portal-owner-{time.time_ns()}@example.com"
    signup = client.post("/auth/signup", json={"email": customer_email, "password": "PortalOwner123!", "organization_name": "Portal Workspace"})
    assert signup.status_code == 200, signup.text
    assert signup.json()["portal"] == "admin"
    assert signup.json()["organization_role"] == "owner"
    owner_headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    owner_context = client.get("/auth/portal", headers=owner_headers)
    assert owner_context.status_code == 200, owner_context.text
    assert owner_context.json()["portal"] == "admin"
    platform_context = client.get("/auth/portal", headers=admin_headers())
    assert platform_context.status_code == 200, platform_context.text
    assert platform_context.json()["portal"] == "super-admin"


def test_m9_owner_bootstrap_is_configured_clerk_bound_and_idempotent(monkeypatch):
    clerk_id = f"user_m9_owner_{time.time_ns()}"
    email = f"m9-owner-{time.time_ns()}@example.com"
    db = TestingSessionLocal()
    owner = User(email=email, clerk_user_id=clerk_id, password_hash=hash_password("M9Owner123!"), role="customer")
    db.add(owner)
    db.commit()
    owner_id = owner.id
    db.close()
    monkeypatch.setattr(main_module.settings, "platform_super_admin_clerk_user_id", clerk_id)
    monkeypatch.setattr(main_module.settings, "platform_super_admin_require_mfa", False)
    monkeypatch.setattr(main_module, "authenticate_clerk_request", lambda _request: {"sub": clerk_id, "email": email})
    headers = {"Authorization": "Bearer clerk-owner-session"}
    first = client.post("/admin/bootstrap", json={"confirmation": "BOOTSTRAP_PLATFORM_OWNER"}, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "bootstrapped"
    second = client.post("/admin/bootstrap", json={"confirmation": "BOOTSTRAP_PLATFORM_OWNER"}, headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["status"] == "already_bootstrapped"
    db = TestingSessionLocal()
    try:
        assert db.scalar(select(PlatformBootstrapState).where(PlatformBootstrapState.owner_user_id == owner_id)).status == "active"
        assert db.scalar(select(PlatformRoleAssignment).where(PlatformRoleAssignment.user_id == owner_id, PlatformRoleAssignment.role == "PLATFORM_SUPER_ADMIN")).status == "active"
    finally:
        db.close()


def test_m9_subordinate_platform_role_is_least_privilege():
    target_email = f"m9-finance-{time.time_ns()}@example.com"
    signup = client.post("/auth/signup", json={"email": target_email, "password": "M9Finance123!", "organization_name": "M9 Finance Workspace"})
    assert signup.status_code == 200, signup.text
    super_email = f"m9-super-{time.time_ns()}@example.com"
    db = TestingSessionLocal()
    super_user = User(email=super_email, password_hash=hash_password("M9Super123!"), role="super_admin")
    db.add(super_user)
    db.commit()
    db.close()
    super_headers = login_headers(super_email, "M9Super123!")
    granted = client.post("/admin/roles", json={"user_id": signup.json()["user_id"], "role": "FINANCE_ADMIN", "reason": "M9 finance operations"}, headers=super_headers)
    assert granted.status_code == 200, granted.text
    finance_headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    assert client.get("/admin/financial/wallets", headers=finance_headers).status_code == 200
    assert client.get("/admin/customers", headers=finance_headers).status_code == 403


def test_m9_model_price_change_creates_revision():
    headers = admin_headers()
    db = TestingSessionLocal()
    model = db.get(ModelCatalog, "openai/gpt-5")
    assert model is not None
    old_price = model.input_price_paise_per_1k
    db.close()
    response = client.patch("/admin/router/models/openai/gpt-5", json={"status": "available", "input_price_paise_per_1k": old_price + 1, "change_reason": "M9 pricing revision test"}, headers=headers)
    assert response.status_code == 200, response.text
    db = TestingSessionLocal()
    try:
        revision = db.scalar(select(PricingRevision).where(PricingRevision.model_id == "openai/gpt-5").order_by(PricingRevision.created_at.desc()))
        assert revision is not None
        assert revision.change_reason == "M9 pricing revision test"
    finally:
        db.close()


def test_m9_wallet_adjustment_is_atomic_and_idempotent():
    headers = admin_headers()
    team = create_team_fixture(headers)
    body = {"team_id": team["id"], "amount_paise": 2500, "currency": "INR", "reason": "M9 support credit", "idempotency_key": f"m9-adjust-{time.time_ns()}"}
    first = client.post("/admin/financial/wallet-adjustments", json=body, headers=headers)
    assert first.status_code == 200, first.text
    second = client.post("/admin/financial/wallet-adjustments", json=body, headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["idempotent"] is True
    assert second.json()["balance_paise"] == first.json()["balance_paise"]
    large = {**body, "amount_paise": 100_000}
    requires_approval = client.post("/admin/financial/wallet-adjustments", json=large, headers=headers)
    assert requires_approval.status_code == 409


def test_m9_settings_are_server_validated_and_audited():
    headers = admin_headers()
    updated = client.patch("/admin/settings", json={"values": {"maintenance_mode": True, "platform_announcement": "Planned maintenance", "trial_credit_eligible_domains": ["example.com"]}}, headers=headers)
    assert updated.status_code == 200, updated.text
    values = {row["key"]: row["value"] for row in updated.json()["items"]}
    assert values["maintenance_mode"] is True
    assert values["trial_credit_eligible_domains"] == ["example.com"]
    invalid = client.patch("/admin/settings", json={"values": {"DATABASE_URL": "not allowed"}}, headers=headers)
    assert invalid.status_code == 400
    db = TestingSessionLocal()
    try:
        assert db.get(PlatformSetting, "maintenance_mode") is not None
    finally:
        db.close()


def test_m9_command_center_returns_real_bounded_metrics():
    response = client.get("/admin/command-center", headers=admin_headers())
    assert response.status_code == 200, response.text
    payload = response.json()
    assert {"customers", "organizations", "active_api_keys", "requests", "tokens", "financial", "provider_health"}.issubset(payload)
    assert payload["latency_ms"]["percentiles"] == "not_available_without_aggregation"
    assert payload["financial"]["platform_fee_paise"]["availability"] == "not_recorded"


def test_admin_provider_analytics_is_permission_gated_and_tenant_aware():
    signup = client.post("/auth/signup", json={"email": f"analytics-customer-{time.time_ns()}@example.com", "password": "AnalyticsCustomer123!", "organization_name": "Analytics Customer Workspace"})
    assert signup.status_code == 200, signup.text
    customer = client.get("/admin/analytics/providers", headers={"Authorization": f"Bearer {signup.json()['token']}"})
    assert customer.status_code == 403
    response = client.get("/admin/analytics/providers", headers=admin_headers())
    assert response.status_code == 200, response.text
    assert {"items", "total", "content_policy"}.issubset(response.json())


def test_provider_analytics_exposes_usage_finality(monkeypatch):
    monkeypatch.setattr(LiteLLMClient, "chat_completion", fake_provider)
    headers, team, _, key = provision_beta_key()
    response = chat(key, content="analytics finality")
    assert response.status_code == 200, response.text
    analytics = client.get("/admin/analytics/providers", headers=admin_headers())
    assert analytics.status_code == 200, analytics.text
    items = analytics.json()["items"]
    assert items
    assert all(item["usage_finality"] == ("finalized" if item["usage_source"] == "provider" else "estimated" if item["usage_source"] == "estimate" else "unavailable") for item in items)


def test_organization_provider_analytics_is_scoped_to_owner_membership():
    owner_email = f"org-analytics-owner-{time.time_ns()}@example.com"
    owner_signup = client.post("/auth/signup", json={"email": owner_email, "password": "OrgAnalytics123!", "organization_name": "Org Analytics Workspace"})
    assert owner_signup.status_code == 200, owner_signup.text
    owner_headers = {"Authorization": f"Bearer {owner_signup.json()['token']}"}
    own = client.get("/organization/analytics/providers", headers=owner_headers)
    assert own.status_code == 200, own.text
    assert own.json()["items"] == []

    member_email = f"org-analytics-member-{time.time_ns()}@example.com"
    member_signup = client.post("/auth/signup", json={"email": member_email, "password": "OrgAnalyticsMember123!", "organization_name": "Separate Analytics Workspace"})
    assert member_signup.status_code == 200, member_signup.text
    db = TestingSessionLocal()
    try:
        owner = db.query(User).filter(User.email == owner_email).one()
        member = db.query(User).filter(User.email == member_email).one()
        organization_id = db.query(OrganizationMember.organization_id).filter(OrganizationMember.user_id == owner.id, OrganizationMember.role == "owner").scalar()
        separate_membership = db.query(OrganizationMember).filter(OrganizationMember.user_id == member.id, OrganizationMember.role == "owner").one()
        separate_membership.role = "removed"
        db.add(OrganizationMember(user_id=member.id, organization_id=organization_id, role="customer"))
        db.commit()
    finally:
        db.close()
    member_headers = {"Authorization": f"Bearer {member_signup.json()['token']}"}
    denied = client.get("/organization/analytics/providers", headers=member_headers)
    assert denied.status_code == 403


def test_organization_admin_can_assign_and_audit_scoped_api_key():
    owner_email = f"key-org-owner-{time.time_ns()}@example.com"
    owner_signup = client.post("/auth/signup", json={"email": owner_email, "password": "KeyOrgOwner123!", "organization_name": "Key Org Workspace"})
    assert owner_signup.status_code == 200, owner_signup.text
    owner_headers = {"Authorization": f"Bearer {owner_signup.json()['token']}"}
    team = client.post("/teams", json={"name": "Key Team", "slug": f"key-team-{time.time_ns()}"}, headers=owner_headers)
    assert team.status_code == 200, team.text
    member_email = f"key-org-admin-{time.time_ns()}@example.com"
    member_signup = client.post("/auth/signup", json={"email": member_email, "password": "KeyOrgAdmin123!", "organization_name": "Separate Workspace"})
    assert member_signup.status_code == 200, member_signup.text
    db = TestingSessionLocal()
    try:
        owner = db.query(User).filter(User.email == owner_email).one()
        member = db.query(User).filter(User.email == member_email).one()
        organization_id = db.query(OrganizationMember.organization_id).filter(OrganizationMember.user_id == owner.id, OrganizationMember.role == "owner").scalar()
        db.add(OrganizationMember(user_id=member.id, organization_id=organization_id, role="admin"))
        team_member = TeamMember(team_id=team.json()["id"], user_id=member.id, name="Organization Admin", email=member_email, role="developer")
        db.add(team_member)
        db.commit()
        team_member_id = team_member.id
    finally:
        db.close()
    member_headers = {"Authorization": f"Bearer {member_signup.json()['token']}"}
    created = client.post("/api-keys", json={"name": "Org-admin assigned key", "team_id": team.json()["id"], "member_id": team_member_id, "expires_at": "2030-01-01T00:00:00Z"}, headers=member_headers)
    assert created.status_code == 200, created.text
    assert created.json()["project_id"]
    listed = client.get("/api-keys", headers=member_headers)
    assert listed.status_code == 200 and any(row["id"] == created.json()["id"] for row in listed.json())
    revoked = client.post(f"/api-keys/{created.json()['id']}/revoke", headers=member_headers)
    assert revoked.status_code == 200
    db = TestingSessionLocal()
    try:
        assert db.query(AuditLog).filter(AuditLog.action == "api_key.revoked", AuditLog.target == f"api_key:{created.json()['id']}").count() == 1
    finally:
        db.close()


def test_only_organization_admin_can_rename_default_project():
    owner_email = f"default-project-owner-{time.time_ns()}@example.com"
    owner_signup = client.post("/auth/signup", json={"email": owner_email, "password": "DefaultOwner123!", "organization_name": "Default Project Workspace"})
    assert owner_signup.status_code == 200, owner_signup.text
    owner_headers = {"Authorization": f"Bearer {owner_signup.json()['token']}"}
    project = client.get("/projects", headers=owner_headers).json()[0]
    member_email = f"default-project-member-{time.time_ns()}@example.com"
    member_signup = client.post("/auth/signup", json={"email": member_email, "password": "DefaultMember123!", "organization_name": "Separate Default Workspace"})
    assert member_signup.status_code == 200, member_signup.text
    db = TestingSessionLocal()
    try:
        owner = db.query(User).filter(User.email == owner_email).one()
        member = db.query(User).filter(User.email == member_email).one()
        organization_id = db.query(OrganizationMember.organization_id).filter(OrganizationMember.user_id == owner.id, OrganizationMember.role == "owner").scalar()
        db.add(OrganizationMember(user_id=member.id, organization_id=organization_id, role="customer"))
        db.add(ProjectMember(project_id=project["id"], user_id=member.id, role="admin", status="active"))
        db.commit()
    finally:
        db.close()
    member_headers = {"Authorization": f"Bearer {member_signup.json()['token']}"}
    denied = client.patch(f"/projects/{project['id']}", json={"name": "Member Rename", "description": ""}, headers=member_headers)
    assert denied.status_code == 403
    assert denied.json()["detail"]["error"]["code"] == "default_project_admin_required"
    renamed = client.patch(f"/projects/{project['id']}", json={"name": "Client Projects", "description": ""}, headers=owner_headers)
    assert renamed.status_code == 200, renamed.text


def test_production_configuration_rejects_development_defaults():
    with pytest.raises(RuntimeError, match="Unsafe production configuration"):
        validate_runtime_config(Settings(environment="production"))


def test_production_seed_does_not_create_fixture_models_or_pricing(monkeypatch, tmp_path):
    runtime = services.get_settings()
    monkeypatch.setattr(runtime, "environment", "production")
    monkeypatch.setattr(runtime, "local_test_mode", False)
    monkeypatch.setattr(runtime, "openai_api_key", None)
    engine = create_engine(f"sqlite:///{tmp_path / 'production-seed.sqlite'}")
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = session_factory()
    try:
        services.seed_defaults(db)
        assert db.query(ModelCatalog).count() == 0
        assert db.query(PricingPolicy).count() == 0
        assert db.query(ProviderCredential).count() == 0
    finally:
        db.close()
        engine.dispose()


def test_clerk_bootstrap_is_idempotent_and_supports_session_protection(monkeypatch):
    email = f"clerk-{time.time_ns()}@example.com"
    clerk_id = f"user_clerk_{time.time_ns()}"

    def fake_clerk_authentication(_request):
        return {"sub": clerk_id, "email": email}

    monkeypatch.setattr(main_module, "authenticate_clerk_request", fake_clerk_authentication)
    first = client.post("/auth/clerk/bootstrap", headers={"Authorization": "Bearer clerk-session"})
    assert first.status_code == 200, first.text
    second = client.post("/auth/clerk/bootstrap", headers={"Authorization": "Bearer clerk-session"})
    assert second.status_code == 200, second.text
    assert first.json()["user_id"] == second.json()["user_id"]

    clerk_me = client.get("/me", headers={"Authorization": "Bearer clerk-session"})
    assert clerk_me.status_code == 200, clerk_me.text
    assert clerk_me.json()["email"] == email

    db = TestingSessionLocal()
    try:
        user = db.scalar(select(User).where(User.clerk_user_id == clerk_id))
        assert user is not None
        assert db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == user.id)) is not None
    finally:
        db.close()


def test_clerk_does_not_silently_claim_existing_compass_account(monkeypatch):
    email = f"clerk-link-{time.time_ns()}@example.com"
    signup = client.post("/auth/signup", json={"email": email, "password": "ClerkLink123!", "organization_name": "Existing Workspace"})
    assert signup.status_code == 200, signup.text

    monkeypatch.setattr(main_module, "authenticate_clerk_request", lambda _request: {"sub": f"user_clerk_{time.time_ns()}", "email": email})
    response = client.post("/auth/clerk/bootstrap", headers={"Authorization": "Bearer clerk-session"})
    assert response.status_code == 409, response.text
    assert response.json()["detail"]["error"]["code"] == "identity_link_required"


def test_clerk_webhook_rejects_bad_signature(monkeypatch):
    monkeypatch.setattr(main_module.settings, "clerk_webhook_signing_secret", "whsec_test")
    response = client.post("/webhooks/clerk", content=b"{}", headers={"svix-id": "msg-invalid"})
    assert response.status_code == 401, response.text


def test_clerk_webhook_is_idempotent(monkeypatch):
    monkeypatch.setattr(main_module.settings, "clerk_webhook_signing_secret", "whsec_test")

    class FakeWebhook:
        def __init__(self, _secret):
            pass

        def verify(self, _payload, _headers):
            return {
                "type": "user.created",
                "data": {
                    "id": f"user_webhook_{time.time_ns()}",
                    "email_addresses": [{"id": "email_1", "email_address": f"webhook-{time.time_ns()}@example.com"}],
                    "primary_email_address_id": "email_1",
                },
            }

    monkeypatch.setattr("svix.webhooks.Webhook", FakeWebhook)
    event_id = f"msg_{time.time_ns()}"
    headers = {"svix-id": event_id, "svix-signature": "v1,test", "svix-timestamp": "1"}
    first = client.post("/webhooks/clerk", content=b"signed", headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["duplicate"] is False
    second = client.post("/webhooks/clerk", content=b"signed", headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["duplicate"] is True

    db = TestingSessionLocal()
    try:
        assert db.scalar(select(ClerkWebhookEvent).where(ClerkWebhookEvent.event_id == event_id)) is not None
    finally:
        db.close()


def test_live_readiness_reports_external_release_blockers(monkeypatch):
    async def unavailable(self):  # noqa: ARG001
        return {"status": "unavailable"}

    monkeypatch.setattr(LiteLLMClient, "health_check", unavailable)
    response = client.get("/admin/live-readiness", headers=admin_headers())
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["ready"] is False
    assert payload["checks"]["billing_payment_mode"] is False
    assert "Billing payment mode is not razorpay" in payload["blockers"]


def create_team_fixture(headers: dict, slug: str | None = None) -> dict:
    response = client.post("/admin/teams", json={"name": "Beta Team", "slug": slug or f"beta-{time.time_ns()}", "notes": "local test"}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def create_member_fixture(headers: dict, team_id: str) -> dict:
    response = client.post("/admin/teams/" + team_id + "/members", json={"name": "Tester", "email": f"tester-{time.time_ns()}@example.com", "role": "developer"}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def create_key_fixture(headers: dict, team_id: str, member_id: str | None = None, models: list[str] | None = None) -> dict:
    default_models = [] if not services.get_settings().local_test_mode else ["openai/gpt-5", "gemini/gemini-3.6-flash"]
    response = client.post(
        "/admin/api-keys",
        json={"name": "Cline beta key", "team_id": team_id, "member_id": member_id, "allowed_models": default_models if models is None else models},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_product_owner_controls_users_sessions_platform_and_audit_log():
    headers = admin_headers()
    email = f"owner-control-{time.time_ns()}@example.com"
    signup = client.post(
        "/auth/signup",
        json={"email": email, "password": "OwnerControl123!", "organization_name": "Owner Control Workspace"},
    )
    assert signup.status_code == 200, signup.text
    user = next(row for row in client.get("/admin/users", headers=headers).json() if row["email"] == email)
    assert user["status"] == "active"
    assert user["workspace_count"] == 1

    platform = client.get("/admin/platform", headers=headers)
    assert platform.status_code == 200, platform.text
    assert platform.json()["database_dialect"] == "sqlite"
    assert "database_url" not in platform.text

    mutation_headers = headers | {"X-Request-ID": "owner-role-change"}
    changed_role = client.patch(f"/admin/users/{user['id']}/role", json={"role": "admin"}, headers=mutation_headers)
    assert changed_role.status_code == 200, changed_role.text
    stale_me = client.get("/me", headers={"Authorization": f"Bearer {signup.json()['token']}"})
    assert stale_me.status_code == 401

    revoked = client.post(f"/admin/users/{user['id']}/revoke-sessions", headers=headers)
    assert revoked.status_code == 200, revoked.text
    suspended = client.patch(
        f"/admin/users/{user['id']}/status",
        json={"status": "suspended", "reason": "security review"},
        headers=headers,
    )
    assert suspended.status_code == 200, suspended.text
    blocked_login = client.post("/auth/login", json={"email": email, "password": "OwnerControl123!"})
    assert blocked_login.status_code == 403
    assert blocked_login.json()["detail"]["error"]["code"] == "account_suspended"

    audit = client.get("/admin/audit?limit=50", headers=headers)
    assert audit.status_code == 200, audit.text
    actions = {row["action"] for row in audit.json()}
    assert {"user.role_updated", "user.sessions_revoked", "user.access_updated"} <= actions
    role_audit = next(row for row in audit.json() if row["action"] == "user.role_updated")
    assert role_audit["request_id"] == "owner-role-change"


def test_customer_cannot_cross_team_or_enter_owner_controls():
    email = f"boundary-{time.time_ns()}@example.com"
    signup = client.post(
        "/auth/signup",
        json={"email": email, "password": "Boundary123!", "organization_name": "Boundary Workspace"},
    )
    assert signup.status_code == 200, signup.text
    customer_headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    other_team = create_team_fixture(admin_headers())

    assert client.get("/admin/overview", headers=customer_headers).status_code == 403
    assert client.get("/wallet", params={"team_id": other_team["id"]}, headers=customer_headers).status_code == 403
    assert client.get(f"/teams/{other_team['id']}/members", headers=customer_headers).status_code == 403


def test_admin_provider_catalog_and_custom_registration():
    headers = admin_headers()
    catalog = client.get("/admin/provider-catalog", headers=headers)
    assert catalog.status_code == 200, catalog.text
    assert "nvidia_nim" in {row["name"] for row in catalog.json()}

    provider_name = f"custom_{time.time_ns()}"
    registered = client.post("/admin/router/providers", json={"name": provider_name}, headers=headers)
    assert registered.status_code == 200, registered.text
    assert registered.json()["created"] is True
    providers = client.get("/admin/router/providers", headers=headers)
    assert provider_name in {row["name"] for row in providers.json()}


def test_ignored_provider_file_values_are_encrypted_into_platform_credentials(monkeypatch):
    monkeypatch.setattr(services.get_settings(), "openai_api_key", "sk-file-bootstrap-test")
    monkeypatch.setattr(services.get_settings(), "provider_env_sync_mode", "replace")
    db = TestingSessionLocal()
    credential = db.query(ProviderCredential).join(Provider).filter(Provider.name == "openai").one()
    services.sync_env_provider_credentials(db)
    assert credential.secret_reference.startswith("encrypted:")
    assert "sk-file-bootstrap-test" not in credential.secret_reference
    assert credential.last_four == "test"
    db.rollback()
    db.close()


def test_admin_provider_credential_wins_over_file_by_default(monkeypatch):
    monkeypatch.setattr(services.get_settings(), "openai_api_key", "sk-file-bootstrap-test")
    monkeypatch.setattr(services.get_settings(), "provider_env_sync_mode", "missing")
    db = TestingSessionLocal()
    credential = db.query(ProviderCredential).join(Provider).filter(Provider.name == "openai").first()
    credential.status = "active"
    credential.secret_reference = encrypt_secret("admin-panel-secret")
    credential.last_four = "cret"
    services.sync_env_provider_credentials(db)
    assert credential.last_four == "cret"
    assert services._credential_value(credential.secret_reference) == "admin-panel-secret"
    db.rollback()
    db.close()


def test_model_publication_requires_a_usable_provider_route():
    headers = admin_headers()
    provider_name = f"governance_{time.time_ns()}"
    registered = client.post("/admin/router/providers", json={"name": provider_name}, headers=headers)
    assert registered.status_code == 200, registered.text
    model_id = f"{provider_name}/model-test"
    db = TestingSessionLocal()
    db.add(ModelCatalog(id=model_id, provider_id=registered.json()["id"], provider_model_id=model_id, display_name="Governance test model", enabled=False, published=False))
    db.commit()
    db.close()
    blocked = client.patch(
        f"/admin/router/models/{model_id}",
        json={"status": "available", "enabled": True, "published": True},
        headers=headers,
    )
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["detail"]["error"]["code"] == "provider_credential_required"


def test_callable_model_inventory_excludes_disabled_provider():
    headers = admin_headers()
    team = create_team_fixture(headers)
    key = create_key_fixture(headers, team["id"], models=["openai/gpt-5"])["key"]
    disabled = client.patch("/admin/router/providers/openai", json={"status": "disabled", "enabled": False}, headers=headers)
    assert disabled.status_code == 200, disabled.text
    try:
        public_models = client.get("/models")
        assert public_models.status_code == 200
        assert "openai/gpt-5" not in {row["id"] for row in public_models.json()}
        key_models = client.get("/v1/models", headers={"Authorization": f"Bearer {key}"})
        assert key_models.status_code == 200
        assert "openai/gpt-5" not in {row["id"] for row in key_models.json()["data"]}
    finally:
        restored = client.patch("/admin/router/providers/openai", json={"status": "healthy", "enabled": True}, headers=headers)
        assert restored.status_code == 200, restored.text


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


def mark_openai_fixture_pricing_verified(db) -> None:
    policy = db.query(PricingPolicy).filter(PricingPolicy.status == "active").order_by(PricingPolicy.effective_at.desc()).first()
    model = db.get(ModelCatalog, "openai/gpt-5")
    assert policy is not None and model is not None
    model.pricing_policy_version = policy.version
    model.input_price_usd_per_million = Decimal("1")
    model.output_price_usd_per_million = Decimal("2")
    model.catalog_source = "litellm"
    model.last_synced_at = services.now()


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


def test_api_key_rotation_revokes_old_secret_and_preserves_scope():
    headers = admin_headers()
    team = create_team_fixture(headers)
    member = create_member_fixture(headers, team["id"])
    created = client.post(
        "/admin/api-keys",
        json={"name": "Rotatable key", "team_id": team["id"], "member_id": member["id"], "allowed_models": ["openai/gpt-5"]},
        headers=headers,
    )
    assert created.status_code == 200, created.text
    old = created.json()

    rotated = client.post(f"/api-keys/{old['id']}/rotate", headers=headers)
    assert rotated.status_code == 200, rotated.text
    replacement = rotated.json()
    assert replacement["key"] != old["key"]
    assert replacement["rotated_from"] == old["id"]
    assert replacement["allowed_models"] == ["openai/gpt-5"]

    old_account = client.get("/v1/account", headers={"Authorization": f"Bearer {old['key']}"})
    new_account = client.get("/v1/account", headers={"Authorization": f"Bearer {replacement['key']}"})
    assert old_account.status_code == 401
    assert old_account.json()["detail"]["error"]["code"] == "revoked_api_key"
    assert new_account.status_code == 200, new_account.text

    db = TestingSessionLocal()
    old_row = db.get(ApiKey, old["id"])
    replacement_row = db.get(ApiKey, replacement["id"])
    assert old_row.status == "revoked"
    assert replacement_row.team_id == old_row.team_id
    assert replacement_row.project_id == old_row.project_id
    assert db.query(ApiKeyModel).filter(ApiKeyModel.api_key_id == replacement_row.id).count() == 1
    db.close()


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


def test_api_key_expiry_accepts_timezone_aware_input():
    headers = admin_headers()
    team = create_team_fixture(headers)
    member = create_member_fixture(headers, team["id"])
    created = client.post(
        "/admin/api-keys",
        json={
            "name": "Timezone-aware key",
            "team_id": team["id"],
            "member_id": member["id"],
            "allowed_models": ["openai/gpt-5"],
            "expires_at": "2030-01-01T00:00:00+05:30",
        },
        headers=headers,
    )
    assert created.status_code == 200, created.text
    db = TestingSessionLocal()
    stored = db.query(ApiKey).filter(ApiKey.id == created.json()["id"]).one()
    expires_at = stored.expires_at
    db.close()
    assert expires_at == datetime(2029, 12, 31, 18, 30)
    assert client.get("/v1/models", headers={"Authorization": f"Bearer {created.json()['key']}"}).status_code == 200


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


def test_direct_provider_execution_mode_uses_direct_client(monkeypatch):
    class FakeDirectClient:
        def __init__(self, *_args):
            pass

        async def chat_completion(self, payload):
            return await fake_provider(self, payload)

    monkeypatch.setattr(services, "DirectProviderClient", FakeDirectClient)
    monkeypatch.setattr(services.get_settings(), "local_test_mode", False)
    monkeypatch.setattr(services.get_settings(), "provider_execution_mode", "direct")
    _, _, _, key = provision_beta_key()
    db = TestingSessionLocal()
    credential = db.query(ProviderCredential).join(Provider).filter(Provider.name == "openai").one()
    original_reference = credential.secret_reference
    original_status = credential.status
    credential.secret_reference = encrypt_secret("direct-test-secret")
    credential.status = "active"
    mark_openai_fixture_pricing_verified(db)
    db.commit()
    db.close()
    try:
        response = chat(key)
        assert response.status_code == 200, response.text
        assert response.json()["compass"]["local_test_mode"] is False
    finally:
        db = TestingSessionLocal()
        restored = db.query(ProviderCredential).join(Provider).filter(Provider.name == "openai").one()
        restored.secret_reference = original_reference
        restored.status = original_status
        db.commit()
        db.close()


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


def test_real_platform_credential_overrides_seeded_local_test_route(monkeypatch):
    calls = []

    async def live_provider(self, payload):
        calls.append(payload["model"])
        return await fake_provider(self, payload)

    monkeypatch.setattr(LiteLLMClient, "chat_completion", live_provider)
    _, _, _, key = provision_beta_key()
    db = TestingSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "gemini").one()
    credential = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).one()
    model = db.query(ModelCatalog).filter(ModelCatalog.id == "gemini/gemini-3.6-flash").one()
    original_reference = credential.secret_reference
    original_status = credential.status
    original_last_four = credential.last_four
    original_provider_model_id = model.provider_model_id
    db.close()
    try:
        db = TestingSessionLocal()
        upsert_provider_api_key(db, "gemini", "live-gemini-test-key")
        db.close()
        db = TestingSessionLocal()
        assert db.query(ModelCatalog).filter(ModelCatalog.id == "gemini/gemini-3.6-flash").one().provider_model_id == "gemini-flash-real"
        db.close()
        response = chat(key, model="gemini/gemini-3.6-flash")
        assert response.status_code == 200, response.text
        assert calls == ["gemini-flash-real"]
        assert response.json()["compass"]["credential_mode"] == "platform"
    finally:
        db = TestingSessionLocal()
        restored = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).one()
        restored.secret_reference = original_reference
        restored.status = original_status
        restored.last_four = original_last_four
        restored_model = db.query(ModelCatalog).filter(ModelCatalog.id == "gemini/gemini-3.6-flash").one()
        restored_model.provider_model_id = original_provider_model_id
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


def test_stale_inference_reservation_recovery_is_preview_then_idempotent_apply():
    headers = admin_headers()
    team = create_team_fixture(headers)
    credit(headers, team["id"], 1000, suffix="recovery")
    db = TestingSessionLocal()
    reservation_id = f"stale-{time.time_ns()}"
    reservation = debit_wallet(
        db,
        team["id"],
        250,
        f"llm-reservation:{reservation_id}",
        reservation_id,
        reference_type="llm_reservation",
        description="test stale reservation",
    )
    reservation.created_at = services.now() - services.timedelta(seconds=3600)
    db.commit()
    preview = recover_stale_llm_reservations(db, max_age_seconds=900, apply=False)
    assert preview["mode"] == "preview"
    assert preview["candidate_count"] == 1
    applied = recover_stale_llm_reservations(db, max_age_seconds=900, apply=True)
    assert applied["recovered_count"] == 1
    repeated = recover_stale_llm_reservations(db, max_age_seconds=900, apply=True)
    assert repeated["recovered_count"] == 0
    assert db.query(WalletLedger).filter(WalletLedger.idempotency_key == f"llm-settlement:{reservation_id}:release").count() == 1
    db.close()


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


def test_provider_failure_releases_wallet_reservation(monkeypatch):
    async def failed_provider(self, payload):  # noqa: ARG001
        raise compass_error(503, "provider_unavailable", "Provider is unavailable.")

    monkeypatch.setattr(LiteLLMClient, "chat_completion", failed_provider)
    headers, team, _, key = provision_beta_key()
    before = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"]
    response = chat(key)
    assert response.status_code == 503, response.text
    after = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"]
    assert after == before
    ledger = client.get("/wallet/ledger", params={"team_id": team["id"]}, headers=headers).json()
    assert any(row["reference_type"] == "llm_reservation" for row in ledger)
    assert any(row["reference_type"] == "llm_reservation_release" for row in ledger)


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


def test_razorpay_refund_webhook_is_idempotent_and_reverses_credits(monkeypatch):
    from app import main as main_module

    monkeypatch.setattr(main_module.settings, "razorpay_webhook_secret", "refund-webhook-secret")
    headers = admin_headers()
    team = create_team_fixture(headers)
    db = TestingSessionLocal()
    order = PaymentOrder(team_id=team["id"], provider="razorpay", provider_order_id="order_refund_test", payment_id="pay_refund_test", amount_paise=3000, currency="INR", status="completed", completed_at=services.now())
    db.add(order)
    db.flush()
    wallet = db.query(WalletAccount).filter(WalletAccount.team_id == team["id"]).one()
    wallet.balance_paise = 3000
    db.add(WalletLedger(wallet_id=wallet.id, type="credit", amount_paise=3000, balance_before=0, balance_after=3000, reference_type="payment_order", reference_id="pay_refund_test", description="Test payment credit", idempotency_key="payment:refund-order"))
    db.add(PaymentRefund(order_id=order.id, team_id=team["id"], provider_refund_id="rfnd_test_123", amount_paise=1000, status="requested", reason="test"))
    db.commit()
    db.close()
    import hashlib
    import hmac
    import json

    payload = {"id": "evt_refund_123", "event": "refund.processed", "payload": {"refund": {"entity": {"id": "rfnd_test_123", "payment_id": "pay_refund_test", "amount": 1000}}}}
    raw = json.dumps(payload).encode()
    signature = hmac.new(b"refund-webhook-secret", raw, hashlib.sha256).hexdigest()
    webhook_headers = {"X-Razorpay-Signature": signature, "X-Razorpay-Event-Id": "evt_refund_123"}
    first = client.post("/webhooks/razorpay", content=raw, headers=webhook_headers)
    second = client.post("/webhooks/razorpay", content=raw, headers=webhook_headers)
    assert first.status_code == 200, first.text
    assert second.status_code == 200 and second.json()["duplicate"] is True
    assert client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"] == 2000
    db = TestingSessionLocal()
    try:
        refund = db.query(PaymentRefund).filter(PaymentRefund.provider_refund_id == "rfnd_test_123").one()
        assert refund.status == "processed"
        assert db.query(PaymentEvent).filter(PaymentEvent.event_id == "evt_refund_123").count() == 1
    finally:
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


def test_production_stream_forwards_upstream_chunks_and_records_provider_usage(monkeypatch):
    class FakeStreamingProvider:
        async def stream_request(self, endpoint, payload):
            assert endpoint == "/v1/chat/completions"
            assert payload["stream"] is True
            yield 'data: {"id":"stream-1","object":"chat.completion.chunk","choices":[{"delta":{"content":"live"}}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}'
            yield "data: [DONE]"

    monkeypatch.setattr(services.get_settings(), "local_test_mode", False)
    monkeypatch.setattr(services, "provider_client", lambda _route: FakeStreamingProvider())
    _, team, _, key = provision_beta_key()
    db = TestingSessionLocal()
    credential = db.query(ProviderCredential).join(Provider).filter(Provider.name == "openai").one()
    original_reference = credential.secret_reference
    original_status = credential.status
    credential.secret_reference = encrypt_secret("stream-provider-secret")
    credential.status = "active"
    mark_openai_fixture_pricing_verified(db)
    db.commit()
    db.close()
    try:
        response = chat(key, stream=True)
        assert response.status_code == 200, response.text
        assert '"content":"live"' in response.text
        assert "data: [DONE]" in response.text
        db = TestingSessionLocal()
        request = db.query(LlmRequest).filter(LlmRequest.team_id == team["id"]).order_by(LlmRequest.created_at.desc()).first()
        assert request is not None
        assert request.status == "success"
        assert request.usage_source == "provider"
        assert request.total_tokens == 5
        db.close()
    finally:
        db = TestingSessionLocal()
        restored = db.query(ProviderCredential).join(Provider).filter(Provider.name == "openai").one()
        restored.secret_reference = original_reference
        restored.status = original_status
        db.commit()
        db.close()


def test_production_responses_stream_forwards_upstream_events_and_records_usage(monkeypatch):
    class FakeResponsesStreamingProvider:
        async def stream_request(self, endpoint, payload):
            assert endpoint == "/v1/responses"
            assert payload["stream"] is True
            yield "event: response.output_text.delta"
            yield 'data: {"type":"response.output_text.delta","delta":"live"}'
            yield "event: response.completed"
            yield 'data: {"type":"response.completed","response":{"id":"resp-stream-1","object":"response","usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}'
            yield "data: [DONE]"

    monkeypatch.setattr(services.get_settings(), "local_test_mode", False)
    monkeypatch.setattr(services, "provider_client", lambda _route: FakeResponsesStreamingProvider())
    _, team, _, key = provision_beta_key()
    db = TestingSessionLocal()
    credential = db.query(ProviderCredential).join(Provider).filter(Provider.name == "openai").one()
    original_reference = credential.secret_reference
    original_status = credential.status
    credential.secret_reference = encrypt_secret("responses-stream-provider-secret")
    credential.status = "active"
    mark_openai_fixture_pricing_verified(db)
    db.commit()
    db.close()
    try:
        response = client.post(
            "/v1/responses",
            json={"model": "openai/gpt-5", "input": "Hello", "stream": True},
            headers={"Authorization": f"Bearer {key}"},
        )
        assert response.status_code == 200, response.text
        assert "response.output_text.delta" in response.text
        assert '"delta":"live"' in response.text
        assert "data: [DONE]" in response.text
        db = TestingSessionLocal()
        request = db.query(LlmRequest).filter(LlmRequest.team_id == team["id"]).order_by(LlmRequest.created_at.desc()).first()
        assert request is not None
        assert request.status == "success"
        assert request.usage_source == "provider"
        assert request.total_tokens == 5
        db.close()
    finally:
        db = TestingSessionLocal()
        restored = db.query(ProviderCredential).join(Provider).filter(Provider.name == "openai").one()
        restored.secret_reference = original_reference
        restored.status = original_status
        db.commit()
        db.close()


def test_production_route_requires_provider_commercial_approval(monkeypatch):
    monkeypatch.setattr(services.get_settings(), "local_test_mode", False)
    _, _, _, key = provision_beta_key()
    db = TestingSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "openai").one()
    credential = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).one()
    original_commercial_status = provider.commercial_status
    original_reference = credential.secret_reference
    original_status = credential.status
    provider.commercial_status = "unreviewed"
    credential.secret_reference = encrypt_secret("commercial-gate-secret")
    credential.status = "active"
    mark_openai_fixture_pricing_verified(db)
    db.commit()
    db.close()
    try:
        response = chat(key)
        assert response.status_code == 503, response.text
        assert response.json()["detail"]["error"]["code"] == "provider_commercial_approval_required"
    finally:
        db = TestingSessionLocal()
        provider = db.query(Provider).filter(Provider.name == "openai").one()
        credential = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).one()
        provider.commercial_status = original_commercial_status
        credential.secret_reference = original_reference
        credential.status = original_status
        db.commit()
        db.close()


def test_production_stale_catalog_model_is_not_routable(monkeypatch):
    monkeypatch.setattr(services.get_settings(), "local_test_mode", False)
    _, _, _, key = provision_beta_key()
    db = TestingSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "openai").one()
    credential = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).one()
    model = db.get(ModelCatalog, "openai/gpt-5")
    original_commercial_status = provider.commercial_status
    original_reference = credential.secret_reference
    original_status = credential.status
    original_source = model.catalog_source
    original_synced_at = model.last_synced_at
    provider.commercial_status = "approved"
    credential.secret_reference = encrypt_secret("stale-catalog-secret")
    credential.status = "active"
    mark_openai_fixture_pricing_verified(db)
    model.last_synced_at = services.now() - services.timedelta(seconds=services.get_settings().litellm_catalog_cache_seconds * 3 + 1)
    db.commit()
    db.close()
    try:
        response = chat(key)
        assert response.status_code == 503, response.text
        assert response.json()["detail"]["error"]["code"] == "model_catalog_stale"
    finally:
        db = TestingSessionLocal()
        provider = db.query(Provider).filter(Provider.name == "openai").one()
        credential = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).one()
        model = db.get(ModelCatalog, "openai/gpt-5")
        provider.commercial_status = original_commercial_status
        credential.secret_reference = original_reference
        credential.status = original_status
        model.catalog_source = original_source
        model.last_synced_at = original_synced_at
        db.commit()
        db.close()


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


def test_route_rejects_capability_without_registered_adapter(monkeypatch):
    db = TestingSessionLocal()
    model = db.get(ModelCatalog, "openai/gpt-5")
    original_capabilities = model.capabilities
    original_capability_types = model.capability_types
    original_protocol = model.protocol
    model.capabilities = "chat,decision"
    model.capability_types = "chat_completion,decision"
    model.protocol = "decision_native"
    db.commit()
    db.close()
    try:
        _, _, _, key = provision_beta_key()
        response = chat(key, model="openai/gpt-5")
        assert response.status_code == 503, response.text
        assert response.json()["detail"]["error"]["code"] == "provider_capability_unsupported", response.json()
    finally:
        db = TestingSessionLocal()
        model = db.get(ModelCatalog, "openai/gpt-5")
        model.capabilities = original_capabilities
        model.capability_types = original_capability_types
        model.protocol = original_protocol
        db.commit()
        db.close()


def test_embeddings_api_routes_an_enabled_embedding_model(monkeypatch):
    db = TestingSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "openai").one()
    model_id = "openai/test-embedding"
    if db.get(ModelCatalog, model_id) is None:
        db.add(ModelCatalog(id=model_id, provider_id=provider.id, provider_model_id="local-test-embedding", display_name="Test Embedding", capabilities="embeddings", context_window=8192, input_price_paise_per_1k=2, output_price_paise_per_1k=0, enabled=True, published=True, status="available", route_readiness_reason="local test fixture", catalog_source="test"))
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
    db.query(ProviderHealthCheck).filter(ProviderHealthCheck.provider_id == provider.id).delete(synchronize_session=False)
    db.commit()
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
            "capability_types": ["chat_completion", "responses"],
            "input_cost_per_million_usd": 1.0, "output_cost_per_million_usd": 2.0, "byok_supported": True, "metadata": {},
        }],
        sources=[{"provider": "openai", "status": "available", "count": 1, "error": None}],
    )
    activated = client.post("/models/activate", json={"team_id": team["id"], "model_id": "openai/gpt-byok"}, headers=headers)
    assert activated.status_code == 200, activated.text
    assert activated.json()["id"] == "openai/gpt-byok"

    key = create_key_fixture(headers, team["id"], models=["openai/gpt-byok"])["key"]
    credit(headers, team["id"], 5000)
    before_balance = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"]
    captured = {}

    async def byok_provider(self, payload):  # noqa: ARG001
        captured.update(payload)
        return await fake_provider(self, payload)

    monkeypatch.setattr(LiteLLMClient, "chat_completion", byok_provider)
    response = chat(key, model="openai/gpt-byok")
    assert response.status_code == 200, response.text
    assert response.json()["compass"]["credential_mode"] == "byok"
    after_balance = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"]
    assert after_balance == before_balance
    db = TestingSessionLocal()
    assert db.query(WalletLedger).filter(WalletLedger.wallet_id == db.query(WalletAccount).filter(WalletAccount.team_id == team["id"]).one().id, WalletLedger.reference_type.in_(["llm_reservation", "llm_settlement"])).count() == 0
    db.close()
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


def test_byok_failed_and_streaming_requests_never_create_wallet_entries(monkeypatch):
    headers = admin_headers()
    team = create_team_fixture(headers)
    db = TestingSessionLocal()
    openai = db.query(Provider).filter(Provider.name == "openai").one()
    db.query(ProviderHealthCheck).filter(ProviderHealthCheck.provider_id == openai.id).delete(synchronize_session=False)
    openai.status = "healthy"
    db.commit()
    db.close()
    raw_secret = "sk-byok-failure-stream-123456"
    saved = client.post("/byok/credentials", json={"team_id": team["id"], "provider": "openai", "api_key": raw_secret}, headers=headers)
    assert saved.status_code == 200, saved.text
    services._litellm_catalog_cache.update(
        expires_at=time.monotonic() + 60,
        models=[{
            "provider": "openai", "provider_model_id": "openai/gpt-byok-failure", "litellm_model_id": "openai/gpt-byok-failure",
            "display_name": "GPT BYOK failure test", "capabilities": ["chat"], "mode": "chat", "context_window": 32768,
            "capability_types": ["chat_completion"], "input_cost_per_million_usd": 1.0, "output_cost_per_million_usd": 2.0,
            "byok_supported": True, "metadata": {},
        }],
        sources=[{"provider": "openai", "status": "available", "count": 1, "error": None}],
    )
    activated = client.post("/models/activate", json={"team_id": team["id"], "model_id": "openai/gpt-byok-failure"}, headers=headers)
    assert activated.status_code == 200, activated.text
    key = create_key_fixture(headers, team["id"], models=["openai/gpt-byok-failure"])["key"]
    credit(headers, team["id"], 5000, suffix="byok-failure")
    before_balance = client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"]

    async def failed_provider(self, payload):  # noqa: ARG001
        raise compass_error(503, "provider_authentication", "BYOK provider authentication failed.")

    monkeypatch.setattr(LiteLLMClient, "chat_completion", failed_provider)
    failed = chat(key, model="openai/gpt-byok-failure")
    assert failed.status_code == 503, failed.text
    assert client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"] == before_balance

    class FailedStreamingProvider:
        async def stream_request(self, endpoint, payload):  # noqa: ARG002
            raise compass_error(503, "provider_unavailable", "BYOK stream unavailable.")
            yield "never"

    monkeypatch.setattr(services.get_settings(), "local_test_mode", False)
    monkeypatch.setattr(services, "provider_client", lambda _route: FailedStreamingProvider())
    db = TestingSessionLocal()
    credential = db.query(ByokCredential).filter(ByokCredential.team_id == team["id"]).one()
    credential.encrypted_secret = encrypt_secret(raw_secret)
    credential.status = "active"
    db.commit()
    db.close()
    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={"model": "openai/gpt-byok-failure", "messages": [{"role": "user", "content": "Hello Compass"}], "max_tokens": 64, "stream": True},
        headers={"Authorization": f"Bearer {key}"},
    ) as streamed:
        streamed_text = "".join(streamed.iter_text())
        assert streamed.status_code == 200, streamed_text
    assert "provider_unavailable" in streamed_text
    assert client.get("/wallet", params={"team_id": team["id"]}, headers=headers).json()["balance_paise"] == before_balance
    db = TestingSessionLocal()
    try:
        wallet = db.query(WalletAccount).filter(WalletAccount.team_id == team["id"]).one()
        assert db.query(WalletLedger).filter(WalletLedger.wallet_id == wallet.id, WalletLedger.reference_type.in_(["llm_reservation", "llm_settlement"])).count() == 0
        requests = db.query(LlmRequest).filter(LlmRequest.team_id == team["id"], LlmRequest.resolved_model == "openai/gpt-byok-failure").order_by(LlmRequest.created_at.desc()).all()
        assert {request.credential_mode for request in requests} == {"byok"}
        assert all(request.compass_cost_paise == 0 for request in requests)
    finally:
        provider = db.query(Provider).filter(Provider.name == "openai").one()
        db.query(ProviderHealthCheck).filter(ProviderHealthCheck.provider_id == provider.id).delete(synchronize_session=False)
        provider.status = "healthy"
        db.commit()
        db.close()


def test_signup_promotion_is_configurable_and_idempotent():
    amount = 1234
    db = TestingSessionLocal()
    db.merge(PlatformSetting(key="trial_credit_paise", value_json=str(amount)))
    db.commit()
    db.close()
    email = f"signup-credit-{time.time_ns()}@example.com"
    try:
        signup = client.post("/auth/signup", json={"email": email, "password": "SignupCredit123!", "organization_name": "Signup Credit Workspace"})
        assert signup.status_code == 200, signup.text
        headers = {"Authorization": f"Bearer {signup.json()['token']}"}
        team_id = client.get("/teams", headers=headers).json()[0]["id"]
        first = client.get("/wallet", params={"team_id": team_id}, headers=headers).json()["balance_paise"]
        assert first == amount
        login = client.post("/auth/login", json={"email": email, "password": "SignupCredit123!"})
        assert login.status_code == 200
        second = client.get("/wallet", params={"team_id": team_id}, headers={"Authorization": f"Bearer {login.json()['token']}"}).json()["balance_paise"]
        assert second == amount
        db = TestingSessionLocal()
        assert db.query(WalletLedger).filter(WalletLedger.reference_type == "signup_promotion", WalletLedger.reference_id == signup.json()["user_id"]).count() == 1
        db.close()
    finally:
        db = TestingSessionLocal()
        db.query(PlatformSetting).filter(PlatformSetting.key == "trial_credit_paise").delete()
        db.commit()
        db.close()


def test_signup_promotion_respects_configured_email_domain_eligibility():
    db = TestingSessionLocal()
    db.merge(PlatformSetting(key="trial_credit_paise", value_json="321"))
    db.merge(PlatformSetting(key="trial_credit_eligible_domains", value_json='["eligible.example"]'))
    db.commit()
    db.close()
    try:
        ineligible = client.post("/auth/signup", json={"email": f"user-{time.time_ns()}@other.example", "password": "Eligibility123!", "organization_name": "Ineligible Workspace"})
        assert ineligible.status_code == 200, ineligible.text
        ineligible_team = client.get("/teams", headers={"Authorization": f"Bearer {ineligible.json()['token']}"}).json()[0]
        assert client.get("/wallet", params={"team_id": ineligible_team["id"]}, headers={"Authorization": f"Bearer {ineligible.json()['token']}"}).json()["balance_paise"] == 0
        eligible = client.post("/auth/signup", json={"email": f"user-{time.time_ns()}@eligible.example", "password": "Eligibility123!", "organization_name": "Eligible Workspace"})
        assert eligible.status_code == 200, eligible.text
        eligible_headers = {"Authorization": f"Bearer {eligible.json()['token']}"}
        eligible_team = client.get("/teams", headers=eligible_headers).json()[0]
        assert client.get("/wallet", params={"team_id": eligible_team["id"]}, headers=eligible_headers).json()["balance_paise"] == 321
    finally:
        db = TestingSessionLocal()
        db.query(PlatformSetting).filter(PlatformSetting.key.in_(["trial_credit_paise", "trial_credit_eligible_domains"])).delete(synchronize_session=False)
        db.commit()
        db.close()


def test_unknown_catalog_capability_cannot_be_activated(monkeypatch):
    headers = admin_headers()
    team = create_team_fixture(headers)
    saved = client.post("/byok/credentials", json={"team_id": team["id"], "provider": "cohere", "api_key": "sk-cohere-unknown-mode"}, headers=headers)
    assert saved.status_code == 200, saved.text
    services._litellm_catalog_cache.update(
        expires_at=time.monotonic() + 60,
        models=[{
            "provider": "cohere", "provider_model_id": "cohere/rerank-test", "litellm_model_id": "cohere/rerank-test",
            "display_name": "Rerank Test", "capabilities": ["rerank"], "capability_types": [], "mode": "rerank",
            "context_window": None, "input_cost_per_million_usd": 1.0, "output_cost_per_million_usd": 1.0,
            "byok_supported": True, "metadata": {},
        }],
        sources=[{"provider": "cohere", "status": "available", "count": 1, "error": None}],
    )
    blocked = client.post("/models/activate", json={"team_id": team["id"], "model_id": "cohere/rerank-test"}, headers=headers)
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["detail"]["error"]["code"] == "provider_capability_unsupported"
    deleted = client.delete(f"/byok/credentials/cohere?team_id={team['id']}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "revoked"


def test_media_usage_without_provider_usage_is_explicitly_estimated():
    estimated, source = services._usage_with_source({"id": "media-response"}, 7)
    assert estimated == {"prompt_tokens": 7, "completion_tokens": 0, "total_tokens": 7}
    assert source == "estimate"
    provider, source = services._usage_with_source({"usage": {"input_tokens": 2, "output_tokens": 3}}, 7)
    assert provider == {"prompt_tokens": 2, "completion_tokens": 3, "total_tokens": 5}
    assert source == "provider"


def test_provider_cost_uses_source_price_and_customer_charge_uses_markup():
    model = SimpleNamespace(
        input_price_paise_per_1k=20,
        output_price_paise_per_1k=40,
        input_price_usd_per_million=Decimal("1"),
        output_price_usd_per_million=Decimal("2"),
    )

    provider_cost, customer_charge = services.calculate_cost_paise(model, {"prompt_tokens": 1000, "completion_tokens": 1000})

    assert provider_cost == 26
    assert customer_charge == 60


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


def test_self_serve_otp_signup_creates_others_project_and_scoped_key():
    email = f"otp-owner-{time.time_ns()}@example.com"
    requested = client.post("/auth/signup/request-otp", json={"email": email})
    assert requested.status_code == 200, requested.text
    payload = requested.json()
    db = TestingSessionLocal()
    assert db.query(EmailOutbox).filter(EmailOutbox.recipient == email, EmailOutbox.status == "queued").count() == 1
    db.close()
    verified = client.post("/auth/signup/verify-otp", json={"challenge_id": payload["challenge_id"], "email": email, "code": payload["debug_otp"], "organization_name": "OTP Workspace"})
    assert verified.status_code == 200, verified.text
    headers = {"Authorization": f"Bearer {verified.json()['token']}"}
    projects = client.get("/projects", headers=headers)
    assert projects.status_code == 200, projects.text
    fallback = next(project for project in projects.json() if project["is_default"])
    team = client.post("/teams", json={"name": "OTP Team", "slug": f"otp-{time.time_ns()}", "project_id": fallback["id"]}, headers=headers)
    assert team.status_code == 200, team.text
    key = client.post("/api-keys", json={"name": "VS Code device", "team_id": team.json()["id"], "project_id": fallback["id"]}, headers=headers)
    assert key.status_code == 200, key.text
    assert key.json()["project_id"] == fallback["id"]


def test_email_outbox_worker_records_real_transport_success_and_failure(monkeypatch):
    db = TestingSessionLocal()
    db.query(EmailOutbox).filter(EmailOutbox.status == "queued").update({EmailOutbox.status: "sent"}, synchronize_session=False)
    message = services.queue_email(db, "worker-success@example.com", "Subject", "Body")
    db.commit()
    sent_messages = []

    class FakeSMTP:
        def __init__(self, *_args, **_kwargs):
            pass

        def starttls(self):
            pass

        def login(self, _username, _password):
            pass

        def send_message(self, email):
            sent_messages.append(email)

        def quit(self):
            pass

    monkeypatch.setattr(services.get_settings(), "smtp_host", "smtp.test")
    monkeypatch.setattr(email_worker.smtplib, "SMTP", FakeSMTP)
    result = email_worker.drain_email_outbox(db, limit=1)
    assert result == {"selected": 1, "sent": 1, "failed": 0}
    assert db.get(EmailOutbox, message.id).status == "sent"
    assert sent_messages[0]["To"] == "worker-success@example.com"

    failed_message = services.queue_email(db, "worker-failure@example.com", "Subject", "Body")
    db.commit()

    def unavailable(*_args, **_kwargs):
        raise OSError("SMTP unavailable")

    monkeypatch.setattr(email_worker.smtplib, "SMTP", unavailable)
    result = email_worker.drain_email_outbox(db, limit=1)
    assert result == {"selected": 1, "sent": 0, "failed": 1}
    stored_failure = db.get(EmailOutbox, failed_message.id)
    assert stored_failure.status == "failed"
    assert "SMTP unavailable" in stored_failure.last_error
    db.close()


def test_project_invitation_otp_acceptance_and_member_revocation():
    owner_email = f"invite-owner-{time.time_ns()}@example.com"
    signup = client.post("/auth/signup", json={"email": owner_email, "password": "InviteOwner123!", "organization_name": "Invite Workspace"})
    assert signup.status_code == 200, signup.text
    owner_headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    project = client.post("/projects", json={"name": "Client Project", "description": "Customer delivery"}, headers=owner_headers)
    assert project.status_code == 200, project.text
    invite_email = f"invite-member-{time.time_ns()}@example.com"
    invitation = client.post("/organization/invitations", json={"project_id": project.json()["id"], "email": invite_email}, headers=owner_headers)
    assert invitation.status_code == 200, invitation.text
    db = TestingSessionLocal()
    try:
        email = db.query(EmailOutbox).filter(EmailOutbox.recipient == invite_email).order_by(EmailOutbox.created_at.desc()).first()
        assert email is not None
        assert "one-time email code" in email.body
        assert "Sign in with browser" in email.body
        assert "Select the project in VS Code" in email.body
        assert "API keys and provider credentials are never included" in email.body
    finally:
        db.close()
    token = invitation.json()["accept_token"]
    otp = client.post(f"/auth/invitations/{token}/request-otp")
    assert otp.status_code == 200, otp.text
    accepted = client.post(f"/auth/invitations/{token}/accept", json={"challenge_id": otp.json()["challenge_id"], "email": invite_email, "code": otp.json()["debug_otp"], "name": "Invited Member"})
    assert accepted.status_code == 200, accepted.text
    member_headers = {"Authorization": f"Bearer {accepted.json()['token']}"}
    member_projects = client.get("/projects", headers=member_headers)
    assert member_projects.status_code == 200, member_projects.text
    assert any(row["id"] == project.json()["id"] for row in member_projects.json())
    removed = client.delete(f"/organization/members/{accepted.json()['user_id']}", headers=owner_headers)
    assert removed.status_code == 200, removed.text
    assert client.get("/projects", headers=member_headers).status_code == 401
    db = TestingSessionLocal()
    try:
        actions = {row.action for row in db.query(AuditLog).filter(AuditLog.target.in_([f"invitation:{invitation.json()['id']}", f"user:{accepted.json()['user_id']}"])).all()}
        assert {"organization.invitation_created", "organization.invitation_accepted", "organization.member_removed"}.issubset(actions)
    finally:
        db.close()


def test_vscode_device_authorization_scopes_project_and_revokes_with_admin_session_revoke(monkeypatch):
    owner_email = f"device-owner-{time.time_ns()}@example.com"
    signup = client.post("/auth/signup", json={"email": owner_email, "password": "DeviceOwner123!", "organization_name": "Device Workspace"})
    assert signup.status_code == 200, signup.text
    owner_headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    project = client.post("/projects", json={"name": "VS Code Project"}, headers=owner_headers)
    assert project.status_code == 200, project.text
    team = client.post("/teams", json={"name": "VS Code Team", "slug": f"device-{time.time_ns()}", "project_id": project.json()["id"]}, headers=owner_headers)
    assert team.status_code == 200, team.text
    started = client.post("/auth/extension/device/start", json={"device_name": "VS Code integration test"})
    assert started.status_code == 200, started.text
    approved = client.post("/auth/extension/device/approve", json={"user_code": started.json()["user_code"], "project_id": project.json()["id"], "team_id": team.json()["id"]}, headers=owner_headers)
    assert approved.status_code == 200, approved.text
    polled = client.post("/auth/extension/device/poll", json={"device_code": started.json()["device_code"]})
    assert polled.status_code == 200, polled.text
    device_token = polled.json()["access_token"]
    account = client.get("/v1/account", headers={"Authorization": f"Bearer {device_token}"})
    assert account.status_code == 200, account.text
    assert account.json()["project"]["id"] == project.json()["id"]
    credit(admin_headers(), team.json()["id"], 5000)
    monkeypatch.setattr(LiteLLMClient, "chat_completion", fake_provider)
    completion = client.post("/v1/chat/completions", json={"model": "openai/gpt-5", "messages": [{"role": "user", "content": "device flow"}]}, headers={"Authorization": f"Bearer {device_token}"})
    assert completion.status_code == 200, completion.text
    db = TestingSessionLocal()
    request = db.query(LlmRequest).filter(LlmRequest.api_key_id == account.json()["api_key"]["id"]).order_by(LlmRequest.created_at.desc()).first()
    assert request is not None and request.project_id == project.json()["id"] and request.device_session_id
    db.close()
    refreshed = client.post("/auth/extension/session/refresh", headers={"Authorization": f"Bearer {device_token}"})
    assert refreshed.status_code == 200, refreshed.text
    refreshed_token = refreshed.json()["access_token"]
    assert refreshed_token != device_token
    assert client.get("/v1/account", headers={"Authorization": f"Bearer {device_token}"}).status_code == 401
    assert client.get("/v1/account", headers={"Authorization": f"Bearer {refreshed_token}"}).status_code == 200
    device_token = refreshed_token
    db = TestingSessionLocal()
    session = db.query(ExtensionSession).filter(ExtensionSession.token_hash == hash_api_key(device_token)).one()
    session.expires_at = services.now() - timedelta(seconds=1)
    db.commit()
    db.close()
    assert client.get("/v1/account", headers={"Authorization": f"Bearer {device_token}"}).status_code == 401
    db = TestingSessionLocal()
    session = db.query(ExtensionSession).filter(ExtensionSession.token_hash == hash_api_key(device_token)).one()
    session.expires_at = services.now() + timedelta(days=30)
    db.commit()
    db.close()
    local_revoked = client.post("/auth/extension/session/revoke", headers={"Authorization": f"Bearer {device_token}"})
    assert local_revoked.status_code == 200, local_revoked.text
    assert local_revoked.json()["status"] == "revoked"
    assert client.get("/v1/account", headers={"Authorization": f"Bearer {device_token}"}).status_code == 401
    # Admin revocation remains idempotent after a device has signed out.
    revoked = client.post(f"/admin/users/{signup.json()['user_id']}/revoke-sessions", headers=admin_headers())
    assert revoked.status_code == 200, revoked.text
    assert client.get("/v1/account", headers={"Authorization": f"Bearer {device_token}"}).status_code == 401


def test_api_key_rejects_cross_tenant_project_header():
    first_email = f"scope-first-{time.time_ns()}@example.com"
    first = client.post("/auth/signup", json={"email": first_email, "password": "ScopeFirst123!", "organization_name": "Scope First"})
    assert first.status_code == 200, first.text
    first_headers = {"Authorization": f"Bearer {first.json()['token']}"}
    first_team = client.get("/teams", headers=first_headers).json()[0]
    first_project = client.get("/projects", headers=first_headers).json()[0]
    created = client.post("/api-keys", json={"name": "Scoped test key", "team_id": first_team["id"], "project_id": first_project["id"]}, headers=first_headers)
    assert created.status_code == 200, created.text

    second_email = f"scope-second-{time.time_ns()}@example.com"
    second = client.post("/auth/signup", json={"email": second_email, "password": "ScopeSecond123!", "organization_name": "Scope Second"})
    assert second.status_code == 200, second.text
    second_project = client.get("/projects", headers={"Authorization": f"Bearer {second.json()['token']}"}).json()[0]
    response = client.get(
        "/v1/models",
        headers={"Authorization": f"Bearer {created.json()['key']}", "X-Compass-Project-Id": second_project["id"]},
    )
    assert response.status_code == 403, response.text
    assert response.json()["detail"]["error"]["code"] == "project_access_denied"


def test_removing_member_is_scoped_to_the_target_organization():
    first_email = f"org-first-{time.time_ns()}@example.com"
    first = client.post("/auth/signup", json={"email": first_email, "password": "OrgFirst123!", "organization_name": "First Organization"})
    assert first.status_code == 200, first.text
    first_headers = {"Authorization": f"Bearer {first.json()['token']}"}
    first_project = client.get("/projects", headers=first_headers).json()[0]

    member_email = f"org-member-{time.time_ns()}@example.com"
    member = client.post("/auth/signup", json={"email": member_email, "password": "OrgMember123!", "organization_name": "Member Organization"})
    assert member.status_code == 200, member.text
    member_headers = {"Authorization": f"Bearer {member.json()['token']}"}
    member_project = client.get("/projects", headers=member_headers).json()[0]

    invitation = client.post("/organization/invitations", json={"project_id": first_project["id"], "email": member_email}, headers=first_headers)
    assert invitation.status_code == 200, invitation.text
    token = invitation.json()["accept_token"]
    otp = client.post(f"/auth/invitations/{token}/request-otp")
    accepted = client.post(f"/auth/invitations/{token}/accept", json={"challenge_id": otp.json()["challenge_id"], "email": member_email, "code": otp.json()["debug_otp"], "name": "Shared Member"})
    assert accepted.status_code == 200, accepted.text

    removed = client.delete(f"/organization/members/{accepted.json()['user_id']}", headers=first_headers)
    assert removed.status_code == 200, removed.text
    remaining = client.get("/projects", headers=member_headers)
    assert remaining.status_code == 200, remaining.text
    assert [row["id"] for row in remaining.json()] == [member_project["id"]]


def test_team_owner_can_manage_team_keys_but_member_cannot():
    owner_email = f"key-owner-{time.time_ns()}@example.com"
    owner = client.post("/auth/signup", json={"email": owner_email, "password": "KeyOwner123!", "organization_name": "Key Workspace"})
    assert owner.status_code == 200, owner.text
    owner_headers = {"Authorization": f"Bearer {owner.json()['token']}"}
    team = client.get("/teams", headers=owner_headers).json()[0]
    project = client.get("/projects", headers=owner_headers).json()[0]
    member_email = f"key-member-{time.time_ns()}@example.com"
    member = client.post("/auth/signup", json={"email": member_email, "password": "KeyMember123!", "organization_name": "Other Workspace"})
    assert member.status_code == 200, member.text
    member_headers = {"Authorization": f"Bearer {member.json()['token']}"}
    invitation = client.post("/organization/invitations", json={"project_id": project["id"], "team_id": team["id"], "email": member_email}, headers=owner_headers)
    assert invitation.status_code == 200, invitation.text
    token = invitation.json()["accept_token"]
    otp = client.post(f"/auth/invitations/{token}/request-otp")
    accepted = client.post(f"/auth/invitations/{token}/accept", json={"challenge_id": otp.json()["challenge_id"], "email": member_email, "code": otp.json()["debug_otp"], "name": "Key Member"})
    assert accepted.status_code == 200, accepted.text
    members = client.get(f"/teams/{team['id']}/members", headers=owner_headers).json()
    member_row = next(row for row in members if row["email"] == member_email)
    created = client.post("/api-keys", json={"name": "Member-assigned key", "team_id": team["id"], "project_id": project["id"], "member_id": member_row["id"]}, headers=owner_headers)
    assert created.status_code == 200, created.text
    listed = client.get("/api-keys", headers=owner_headers)
    assert any(row["id"] == created.json()["id"] for row in listed.json())
    denied = client.patch(f"/api-keys/{created.json()['id']}/models", json={"allowed_models": ["openai/gpt-5"]}, headers=member_headers)
    assert denied.status_code == 403, denied.text


def test_m13_key_member_assignment_is_idempotent_and_team_scoped():
    headers = admin_headers()
    team = create_team_fixture(headers)
    first = create_member_fixture(headers, team["id"])
    second = create_member_fixture(headers, team["id"])
    other_team = create_team_fixture(headers)
    other_member = create_member_fixture(headers, other_team["id"])
    key = create_key_fixture(headers, team["id"])

    assigned = client.put(f"/api-keys/{key['id']}/members", json={"member_ids": [first["id"], second["id"]]}, headers=headers)
    assert assigned.status_code == 200, assigned.text
    assert {row["id"] for row in assigned.json()["members"]} == {first["id"], second["id"]}

    repeated = client.put(f"/api-keys/{key['id']}/members", json={"member_ids": [first["id"], second["id"], first["id"]]}, headers=headers)
    assert repeated.status_code == 200, repeated.text
    assert len(repeated.json()["members"]) == 2

    denied = client.put(f"/api-keys/{key['id']}/members", json={"member_ids": [other_member["id"]]}, headers=headers)
    assert denied.status_code == 400, denied.text


def test_organization_admin_can_change_role_and_project_access():
    owner_email = f"access-owner-{time.time_ns()}@example.com"
    owner = client.post("/auth/signup", json={"email": owner_email, "password": "AccessOwner123!", "organization_name": "Access Workspace"})
    assert owner.status_code == 200, owner.text
    owner_headers = {"Authorization": f"Bearer {owner.json()['token']}"}
    project = client.get("/projects", headers=owner_headers).json()[0]
    member_email = f"access-member-{time.time_ns()}@example.com"
    invitation = client.post("/organization/invitations", json={"project_id": project["id"], "email": member_email}, headers=owner_headers)
    assert invitation.status_code == 200, invitation.text
    token = invitation.json()["accept_token"]
    otp = client.post(f"/auth/invitations/{token}/request-otp")
    accepted = client.post(f"/auth/invitations/{token}/accept", json={"challenge_id": otp.json()["challenge_id"], "email": member_email, "code": otp.json()["debug_otp"], "name": "Access Member"})
    assert accepted.status_code == 200, accepted.text
    member_id = accepted.json()["user_id"]
    changed = client.patch(f"/organization/members/{member_id}", json={"role": "admin"}, headers=owner_headers)
    assert changed.status_code == 200, changed.text
    assigned = client.put(f"/projects/{project['id']}/members/{member_id}", json={"role": "admin"}, headers=owner_headers)
    assert assigned.status_code == 200, assigned.text
    listed = client.get(f"/projects/{project['id']}/members", headers=owner_headers)
    assert any(row["user_id"] == member_id and row["role"] == "admin" for row in listed.json())
    removed = client.delete(f"/projects/{project['id']}/members/{member_id}", headers=owner_headers)
    assert removed.status_code == 200, removed.text
    db = TestingSessionLocal()
    assert db.query(ProjectMember).filter(ProjectMember.project_id == project["id"], ProjectMember.user_id == member_id, ProjectMember.status == "removed").count() == 1
    db.close()


def test_production_rate_limiting_fails_closed_when_redis_is_unavailable(monkeypatch):
    headers = admin_headers()
    team = create_team_fixture(headers)
    db = TestingSessionLocal()
    original_environment = services.get_settings().environment
    monkeypatch.setattr(services.get_settings(), "environment", "production")
    monkeypatch.setattr(services, "redis_team_rate_limit", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("redis unavailable")))
    try:
        with pytest.raises(HTTPException) as error:
            services.enforce_team_limits(db, team["id"], estimated_tokens=1, estimated_cost_paise=1)
        assert error.value.status_code == 503
        assert error.value.detail["error"]["code"] == "rate_limit_unavailable"
    finally:
        services.get_settings().environment = original_environment
        db.close()
