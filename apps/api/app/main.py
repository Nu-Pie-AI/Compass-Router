import hashlib
import hmac
import json
import re
import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
import httpx
from jose import JWTError
from sqlalchemy import Integer, and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .admin_authorization import clerk_mfa_verified, has_platform_permission, platform_permissions, platform_roles, require_platform_permission, require_super_admin
from .admin_services import adjust_wallet, bootstrap_platform_owner, grant_platform_role, platform_settings_rows, revoke_platform_role, update_platform_settings
from .authorization import is_admin, require_project_access, require_team_access, require_team_owner, require_workspace_access, team_ids_for_user, team_owner_ids_for_user, workspace_ids_for_user
from .catalog import capability_matches, provider_protocol
from .config import get_settings, validate_runtime_config
from .db import get_db, init_db
from .errors import compass_error
from .models import ApiKey, AuditLog, BatchJob, BillingInvoice, CatalogSyncRun, ClerkWebhookEvent, EmailOtpChallenge, ExtensionDeviceAuthorization, Invitation, LoginAttempt, LlmRequest, ModelCatalog, ModelPolicy, OperationalEvent, Organization, OrganizationMember, PaymentEvent, PaymentOrder, PaymentRefund, PlatformBootstrapState, PlatformRoleAssignment, PricingPolicy, PricingRevision, Project, ProjectMember, Provider, ProviderCredential, ProviderHealthCheck, RoutingPolicy, RoutingPolicyRevision, Team, TeamLimit, TeamMember, User, UserAccess, WalletAccount, WalletLedger, new_id, now
from .observability import configure_logging, log_request
from .schemas import AdminRoutingPolicyUpdate, AdminWalletAdjustmentRequest, ApiKeyCreate, ApiKeyMembersUpdate, ApiKeyModelsUpdate, ApiKeyProjectsUpdate, AudioSpeechRequest, BatchRequest, BillingOrderComplete, BillingOrderCreate, BillingOrderVerify, BillingRefundCreate, ByokCredentialUpdate, ChatCompletionRequest, EmbeddingsRequest, ExtensionDeviceApprove, ExtensionDevicePoll, ExtensionDeviceStart, ImageGenerationRequest, InvitationCreate, InvitationOtpVerify, LoginOtpVerify, LoginRequest, MarketplaceSsoRequest, ModelActivationRequest, ModelGovernanceUpdate, ModelPolicyUpdate, OtpRequest, OrganizationMemberUpdate, PlatformBootstrapRequest, PlatformRoleGrantRequest, PlatformRoleRevokeRequest, PlatformSettingsUpdate, PricingPolicyCreate, ProjectCreate, ProjectMemberUpdate, ProjectUpdate, ProviderCredentialUpdate, ProviderRegisterRequest, ProviderStatusUpdate, ResponsesRequest, RoutingPolicyUpdate, SessionResponse, SignupOtpVerify, SignupRequest, TeamCreate, TeamLimitsUpdate, TeamMemberCreate, TeamStatusUpdate, UserAccessUpdate, UserRoleUpdate, WalletTopupRequest, WorkspaceCreate
from .security import authenticate_clerk_request, clerk_user_email, create_session_token, decode_marketplace_sso_token, decode_session_claims, hash_password, verify_password
from .services import (
    LiteLLMClient,
    allowed_model_ids,
    api_key_models_restricted,
    authenticate_api_key,
    activate_catalog_model,
    byok_credentials_summary,
    check_redis,
    complete_chat,
    complete_binary_api,
    complete_json_api,
    complete_multipart_api,
    create_api_key,
    create_invitation,
    create_clerk_organization_invitation,
    create_otp_challenge,
    create_project,
    create_team,
    create_team_member,
    credit_wallet,
    dashboard_summary,
    credential_provider_names,
    catalog_sync_status,
    litellm_model_catalog,
    provider_catalog_response,
    sync_litellm_catalog,
    list_api_keys,
    model_catalog_rows,
    model_policy_rows,
    organization_id_for_user,
    project_ids_for_user,
    project_rows,
    provider_credentials_summary,
    record_audit_log,
    request_id_context,
    resend_invitation,
    revoke_clerk_organization_invitation,
    request_rows,
    revoke_byok_api_key,
    revoke_api_key,
    rotate_api_key,
    test_platform_credential,
    update_api_key_models,
    replace_api_key_members,
    assigned_api_key_members,
    replace_api_key_projects,
    assigned_api_key_projects,
    list_assigned_api_keys,
    openrouter_catalog_response,
    pricing_policy_row,
    sync_openrouter_catalog,
    ensure_default_pricing_policy,
    register_customer,
    provision_clerk_customer,
    seed_defaults,
    select_user_by_email,
    stream_openai_chunks,
    stream_chat,
    stream_json_api,
    verify_otp_challenge,
    _set_local_provider_route,
    api_project_context,
    device_session_context,
    member_inference_context,
    resolve_member_inference_key,
    approve_extension_device as approve_extension_device_service,
    poll_extension_device_authorization,
    revoke_extension_sessions_for_user,
    revoke_extension_session,
    refresh_extension_session,
    start_extension_device_authorization,
    upsert_marketplace_user,
    upsert_byok_api_key,
    upsert_provider_api_key,
)

settings = get_settings()

PROVIDER_CATALOG = [
    {"name": "openai", "label": "OpenAI", "family": "OpenAI-compatible"},
    {"name": "gemini", "label": "Google Gemini", "family": "Google AI"},
    {"name": "anthropic", "label": "Anthropic", "family": "Claude"},
    {"name": "mistral", "label": "Mistral AI", "family": "Mistral"},
    {"name": "groq", "label": "Groq", "family": "OpenAI-compatible"},
    {"name": "deepseek", "label": "DeepSeek", "family": "OpenAI-compatible"},
    {"name": "xai", "label": "xAI", "family": "OpenAI-compatible"},
    {"name": "cohere", "label": "Cohere", "family": "Cohere"},
    {"name": "openrouter", "label": "OpenRouter", "family": "OpenAI-compatible"},
    {"name": "together_ai", "label": "Together AI", "family": "OpenAI-compatible"},
    {"name": "fireworks_ai", "label": "Fireworks AI", "family": "OpenAI-compatible"},
    {"name": "perplexity", "label": "Perplexity", "family": "OpenAI-compatible"},
    {"name": "nvidia_nim", "label": "NVIDIA NIM", "family": "NVIDIA"},
    {"name": "ollama_cloud", "label": "Ollama Cloud", "family": "OpenAI-compatible"},
    {"name": "azure", "label": "Azure OpenAI", "family": "Azure"},
    {"name": "azure_ai", "label": "Azure AI Foundry", "family": "Azure"},
    {"name": "vertex_ai", "label": "Google Vertex AI", "family": "Google Cloud"},
    {"name": "bedrock", "label": "Amazon Bedrock", "family": "AWS"},
    {"name": "cerebras", "label": "Cerebras", "family": "OpenAI-compatible"},
    {"name": "sambanova", "label": "SambaNova", "family": "OpenAI-compatible"},
    {"name": "deepinfra", "label": "DeepInfra", "family": "OpenAI-compatible"},
    {"name": "huggingface", "label": "Hugging Face", "family": "OpenAI-compatible"},
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging(settings.observability_log_level)
    validate_runtime_config(settings)
    init_db()
    db = next(get_db())
    try:
        seed_defaults(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Compass AI Router", version="0.2.0-beta", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.compass_web_origin.split(",") if origin.strip()],
    allow_origin_regex=r"https://compass-router-web-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.run\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_and_security_headers(request: Request, call_next):
    supplied = request.headers.get("X-Request-ID", "")
    request_id = supplied if re.fullmatch(r"[A-Za-z0-9._-]{1,128}", supplied) else new_id()
    request.state.request_id = request_id
    token = request_id_context.set(request_id)
    project_token = api_project_context.set(request.headers.get("X-Compass-Project-Id"))
    device_token = device_session_context.set(None)
    started_at = time.perf_counter()
    status_code = 500
    error_type = None
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
    except Exception as exc:
        error_type = type(exc).__name__
        raise
    finally:
        log_request(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=status_code,
            latency_ms=max(0, int((time.perf_counter() - started_at) * 1000)),
            error_type=error_type,
        )
        request_id_context.reset(token)
        api_project_context.reset(project_token)
        device_session_context.reset(device_token)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": {"error": {"code": "invalid_request", "message": "Request validation failed.", "type": "compass_error", "fields": exc.errors()}}})


async def enforce_body_limit(request: Request) -> None:
    length = request.headers.get("content-length")
    try:
        too_large = length is not None and int(length) > settings.request_body_limit_bytes
    except ValueError:
        raise compass_error(400, "invalid_content_length", "The request content length is invalid.") from None
    if too_large:
        raise compass_error(413, "request_too_large", "Request body is too large.")


def current_clerk_identity(request: Request) -> dict:
    authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise compass_error(401, "unauthorized", "Missing Clerk session token.")
    try:
        return authenticate_clerk_request(request)
    except Exception:
        raise compass_error(401, "unauthorized", "Invalid Clerk session token.") from None


def current_user(request: Request, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise compass_error(401, "unauthorized", "Missing session token.")
    token = authorization.removeprefix("Bearer ").strip()
    user = None
    try:
        claims = decode_session_claims(token)
        candidate = db.get(User, str(claims["sub"]))
        if candidate is not None and int(claims.get("sv", 0)) == candidate.session_version:
            user = candidate
            request.state.auth_source = "session"
    except (JWTError, ValueError, KeyError):
        pass
    if user is not None and settings.environment.strip().lower() in {"production", "prod"}:
        raise compass_error(401, "clerk_auth_required", "Staging and production human sessions require Clerk authentication.")
    if user is None:
        try:
            clerk_claims = authenticate_clerk_request(request)
            user = db.scalar(select(User).where(User.clerk_user_id == str(clerk_claims["sub"])))
            request.state.auth_source = "clerk"
            request.state.clerk_claims = clerk_claims
        except Exception:
            raise compass_error(401, "unauthorized", "Invalid session token.") from None
        if user is None:
            raise compass_error(401, "identity_not_provisioned", "Your Clerk account is not provisioned in Compass yet.")
        clerk_org_id = clerk_claims.get("org_id")
        if isinstance(clerk_org_id, str) and clerk_org_id:
            organization = db.scalar(select(Organization).where(Organization.clerk_organization_id == clerk_org_id))
            if organization is not None:
                membership = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == organization.id, OrganizationMember.user_id == user.id))
                claim_role = str(clerk_claims.get("org_role") or "")
                mapped_role = "admin" if claim_role in {"org:admin", "org:owner"} else "customer"
                if membership is None:
                    db.add(OrganizationMember(user_id=user.id, organization_id=organization.id, role=mapped_role))
                    db.commit()
                elif membership.role == "removed":
                    raise compass_error(403, "organization_membership_revoked", "Your organization membership has been revoked.")
    access = db.scalar(select(UserAccess).where(UserAccess.user_id == user.id))
    if access is not None and access.status != "active":
        raise compass_error(403, "account_suspended", "This account has been suspended by the product owner.")
    return user


def admin_user(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    if not has_platform_permission(db, user, "admin.view"):
        raise compass_error(403, "admin_required", "Admin authorization is required.")
    if settings.environment.strip().lower() in {"production", "prod"}:
        if getattr(request.state, "auth_source", "") != "clerk":
            raise compass_error(401, "clerk_admin_auth_required", "Platform administration requires a Clerk-authenticated session.")
        if "PLATFORM_SUPER_ADMIN" in platform_roles(db, user) and settings.platform_super_admin_require_mfa and not clerk_mfa_verified(getattr(request.state, "clerk_claims", {})):
            raise compass_error(403, "admin_mfa_required", "Verified MFA is required for Super Admin operations.")
    return user


def organization_admin(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    if settings.environment.strip().lower() in {"production", "prod"} and getattr(request.state, "auth_source", "") != "clerk":
        raise compass_error(401, "clerk_organization_auth_required", "Organization administration requires a Clerk-authenticated session.")
    if is_admin(user):
        return user
    organization_id = organization_id_for_user(db, user.id)
    membership = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == organization_id, OrganizationMember.user_id == user.id, OrganizationMember.role.in_(["owner", "admin"]))) if organization_id else None
    if membership is None:
        raise compass_error(403, "organization_admin_required", "Organization owner or administrator access is required.")
    return user


def _portal_context(db: Session, user: User) -> tuple[str, str | None]:
    """Resolve navigation from server-side platform and organization roles."""
    if has_platform_permission(db, user, "admin.view"):
        return "super-admin", None
    organization_id = organization_id_for_user(db, user.id)
    membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.role != "removed",
        )
    ) if organization_id else None
    organization_role = membership.role if membership else None
    return ("admin" if organization_role in {"owner", "admin"} else "dashboard"), organization_role


def _session_response(db: Session, user: User) -> SessionResponse:
    portal, organization_role = _portal_context(db, user)
    return SessionResponse(token=create_session_token(user.id, user.session_version), user_id=user.id, email=user.email, organization_id=organization_id_for_user(db, user.id), role=user.role, portal=portal, organization_role=organization_role)


def _login_guard(db: Session, email: str) -> LoginAttempt:
    normalized = email.strip().lower()
    attempt = db.scalar(select(LoginAttempt).where(LoginAttempt.email == normalized).with_for_update())
    current = now()
    if attempt is None:
        attempt = LoginAttempt(email=normalized, window_started_at=current)
        db.add(attempt)
        db.flush()
    elif attempt.locked_until and attempt.locked_until > current:
        raise compass_error(429, "login_rate_limited", "Too many login attempts. Try again later.")
    elif attempt.window_started_at < current - timedelta(minutes=15):
        attempt.window_started_at = current
        attempt.attempts = 0
        attempt.locked_until = None
    return attempt


def _record_login_failure(db: Session, attempt: LoginAttempt) -> None:
    attempt.attempts += 1
    if attempt.attempts >= 5:
        attempt.locked_until = now() + timedelta(minutes=15)
    db.commit()


def team_rows(db: Session, team_ids: list[str]) -> list[dict]:
    if not team_ids:
        return []
    teams = db.scalars(select(Team).where(Team.id.in_(team_ids)).order_by(Team.created_at.desc())).all()
    return [{"id": team.id, "workspace_id": team.organization_id, "project_id": team.project_id, "name": team.name, "slug": team.slug, "notes": team.notes, "is_active": team.is_active, "created_at": team.created_at.isoformat()} for team in teams]


def workspace_rows(db: Session, workspace_ids: list[str]) -> list[dict]:
    if not workspace_ids:
        return []
    workspaces = db.scalars(select(Organization).where(Organization.id.in_(workspace_ids)).order_by(Organization.created_at.desc())).all()
    counts = dict(db.execute(select(Team.organization_id, func.count(Team.id)).where(Team.organization_id.in_(workspace_ids)).group_by(Team.organization_id)).all())
    return [{"id": workspace.id, "name": workspace.name, "team_count": counts.get(workspace.id, 0), "created_at": workspace.created_at.isoformat()} for workspace in workspaces]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "compass-api"}


@app.get("/health/live")
def live() -> dict:
    return {"status": "live"}


@app.get("/health/ready")
async def ready(db: Session = Depends(get_db)) -> dict:
    db.execute(select(User).limit(1))
    try:
        redis = check_redis(settings.redis_url)
    except (OSError, RuntimeError, ValueError) as exc:
        redis = {"status": "unavailable", "detail": str(exc)}
    try:
        litellm = await LiteLLMClient().health_check()
    except (HTTPException, httpx.HTTPError):
        litellm = {"status": "unavailable", "detail": "LiteLLM health check did not respond."}
    litellm_status = str(litellm.get("status", "ok"))
    redis_ready = redis.get("status") in {"ok", "ready", "healthy"}
    overall_status = "ready" if redis_ready and (settings.local_test_mode or litellm_status in {"ok", "ready", "healthy"}) else "degraded"
    return {"status": overall_status, "database": {"status": "ok", "dialect": db.bind.dialect.name if db.bind else "unknown"}, "redis": redis, "litellm": {"status": litellm_status, "detail": litellm.get("detail")}}


@app.post("/auth/signup", response_model=SessionResponse)
def signup(body: SignupRequest, db: Session = Depends(get_db)) -> SessionResponse:
    if not settings.public_signup_enabled:
        raise compass_error(403, "signup_disabled", "Account signup is disabled for this Compass environment.")
    user, organization, _ = register_customer(db, body.email, body.password, body.organization_name)
    return _session_response(db, user)


@app.post("/auth/signup/request-otp")
def request_signup_otp(body: OtpRequest, db: Session = Depends(get_db)) -> dict:
    if not settings.public_signup_enabled:
        raise compass_error(403, "signup_disabled", "Account signup is disabled for this Compass environment.")
    if db.scalar(select_user_by_email(body.email.lower())) is not None:
        raise compass_error(409, "account_exists", "An account already exists for this email.")
    challenge, code = create_otp_challenge(db, body.email, "signup")
    response = {"challenge_id": challenge.id, "email": challenge.email, "expires_at": challenge.expires_at.isoformat(), "delivery": settings.email_delivery_mode}
    if settings.local_test_mode:
        response["debug_otp"] = code
    return response


@app.post("/auth/signup/verify-otp", response_model=SessionResponse)
def verify_signup_otp(body: SignupOtpVerify, db: Session = Depends(get_db)) -> SessionResponse:
    if not settings.public_signup_enabled:
        raise compass_error(403, "signup_disabled", "Account signup is disabled for this Compass environment.")
    verify_otp_challenge(db, body.challenge_id, body.email, body.code, "signup")
    if db.scalar(select_user_by_email(body.email.lower())) is not None:
        raise compass_error(409, "account_exists", "An account already exists for this email.")
    user, organization, _ = register_customer(db, body.email, f"otp-only:{new_id()}", body.organization_name)
    user.email_verified_at = now()
    db.commit()
    return _session_response(db, user)


@app.post("/auth/login", response_model=SessionResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> SessionResponse:
    attempt = _login_guard(db, body.email)
    user = db.scalar(select_user_by_email(body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        _record_login_failure(db, attempt)
        raise compass_error(401, "invalid_login", "Invalid email or password.")
    access = db.scalar(select(UserAccess).where(UserAccess.user_id == user.id))
    if access is not None and access.status != "active":
        _record_login_failure(db, attempt)
        raise compass_error(403, "account_suspended", "This account has been suspended by the product owner.")
    db.delete(attempt)
    db.commit()
    return _session_response(db, user)


@app.post("/auth/login/request-otp")
def request_login_otp(body: OtpRequest, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select_user_by_email(body.email.lower()))
    if user is None:
        raise compass_error(404, "account_not_found", "No Compass account exists for this email.")
    challenge, code = create_otp_challenge(db, body.email, "login")
    response = {"challenge_id": challenge.id, "email": challenge.email, "expires_at": challenge.expires_at.isoformat(), "delivery": settings.email_delivery_mode}
    if settings.local_test_mode:
        response["debug_otp"] = code
    return response


@app.post("/auth/login/verify-otp", response_model=SessionResponse)
def verify_login_otp(body: LoginOtpVerify, db: Session = Depends(get_db)) -> SessionResponse:
    verify_otp_challenge(db, body.challenge_id, body.email, body.code, "login")
    user = db.scalar(select_user_by_email(body.email.lower()))
    if user is None:
        raise compass_error(404, "account_not_found", "No Compass account exists for this email.")
    access = db.scalar(select(UserAccess).where(UserAccess.user_id == user.id))
    if access is not None and access.status != "active":
        raise compass_error(403, "account_suspended", "This account has been suspended by the product owner.")
    user.email_verified_at = user.email_verified_at or now()
    db.commit()
    return _session_response(db, user)


@app.post("/auth/logout")
def logout(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    user.session_version += 1
    db.commit()
    return {"signed_out": True}


@app.get("/auth/portal")
def auth_portal(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    portal, organization_role = _portal_context(db, user)
    return {"portal": portal, "organization_id": organization_id_for_user(db, user.id), "organization_role": organization_role, "platform_roles": sorted(platform_roles(db, user))}


@app.post("/auth/clerk/bootstrap", response_model=SessionResponse)
def clerk_bootstrap(identity: dict = Depends(current_clerk_identity), db: Session = Depends(get_db)) -> SessionResponse:
    clerk_id = str(identity["sub"])
    email = identity.get("email") if isinstance(identity.get("email"), str) else None
    if not email:
        try:
            email = clerk_user_email(clerk_id)
        except Exception:
            raise compass_error(503, "clerk_email_unavailable", "Clerk identity is valid but its verified email is not available yet.") from None
    user, _, _ = provision_clerk_customer(db, clerk_id, email)
    return _session_response(db, user)


@app.post("/webhooks/clerk")
async def clerk_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    if not settings.clerk_webhook_signing_secret:
        raise compass_error(503, "clerk_webhook_not_configured", "Clerk webhook verification is not configured.")
    from svix.webhooks import Webhook, WebhookVerificationError

    payload_bytes = await request.body()
    try:
        payload = Webhook(settings.clerk_webhook_signing_secret).verify(payload_bytes, dict(request.headers))
    except WebhookVerificationError:
        raise compass_error(401, "invalid_webhook_signature", "The Clerk webhook signature is invalid.") from None
    if not isinstance(payload, dict):
        raise compass_error(400, "invalid_webhook_payload", "The Clerk webhook payload is invalid.")
    event_id = request.headers.get("svix-id")
    event_type = str(payload.get("type") or "")
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    if not event_id or not event_type:
        raise compass_error(400, "invalid_webhook_payload", "The Clerk webhook event is missing its type or id.")
    duplicate = db.scalar(select(ClerkWebhookEvent).where(ClerkWebhookEvent.event_id == event_id))
    if duplicate is not None:
        if duplicate.status != "failed":
            return {"accepted": True, "duplicate": True, "event_id": event_id, "status": duplicate.status}
        db.delete(duplicate)
        db.commit()
    event = ClerkWebhookEvent(event_id=event_id, event_type=event_type, payload_hash=hashlib.sha256(payload_bytes).hexdigest(), status="received")
    db.add(event)
    db.flush()
    try:
        if event_type in {"user.created", "user.updated"}:
            clerk_id = str(data.get("id") or "")
            email_addresses = data.get("email_addresses") if isinstance(data.get("email_addresses"), list) else []
            primary_id = data.get("primary_email_address_id")
            email_row = next((row for row in email_addresses if isinstance(row, dict) and row.get("id") == primary_id), None)
            email_row = email_row or next((row for row in email_addresses if isinstance(row, dict)), None)
            email = email_row.get("email_address") if isinstance(email_row, dict) else None
            if clerk_id and isinstance(email, str) and "@" in email:
                provision_clerk_customer(db, clerk_id, email)
                event.status = "processed"
            else:
                event.status = "deferred"
        elif event_type == "user.deleted":
            clerk_id = str(data.get("id") or "")
            user = db.scalar(select(User).where(User.clerk_user_id == clerk_id)) if clerk_id else None
            if user is not None:
                access = db.scalar(select(UserAccess).where(UserAccess.user_id == user.id))
                if access is None:
                    access = UserAccess(user_id=user.id)
                    db.add(access)
                access.status = "suspended"
                access.reason = "Clerk identity deleted"
                user.session_version += 1
            event.status = "processed"
        else:
            event.status = "ignored"
        event.processed_at = now()
        db.commit()
    except Exception as exc:
        db.rollback()
        db.add(ClerkWebhookEvent(event_id=event_id, event_type=event_type, payload_hash=hashlib.sha256(payload_bytes).hexdigest(), status="failed", error_message=str(exc)[:500]))
        db.commit()
        raise compass_error(409, "clerk_webhook_processing_failed", "The Clerk webhook could not be applied.") from None
    return {"accepted": True, "duplicate": False, "event_id": event_id, "status": event.status}


@app.post("/auth/extension/device/start")
def start_extension_device(body: ExtensionDeviceStart, db: Session = Depends(get_db)) -> dict:
    return start_extension_device_authorization(db, body.device_name)


@app.post("/auth/extension/device/poll")
def poll_extension_device(body: ExtensionDevicePoll, db: Session = Depends(get_db)) -> dict:
    return poll_extension_device_authorization(db, body.device_code)


@app.post("/auth/extension/device/approve")
def approve_extension_device(body: ExtensionDeviceApprove, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return approve_extension_device_service(db, user, body.user_code, body.project_id, body.team_id)


@app.post("/auth/extension/session/revoke")
def revoke_extension_session_route(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict:
    authenticate_api_key(db, authorization)
    session_id = device_session_context.get()
    if session_id is None:
        raise compass_error(400, "device_session_required", "This endpoint requires a VS Code device session.")
    revoked = revoke_extension_session(db, session_id)
    return {"status": "revoked" if revoked else "already_revoked"}


@app.post("/auth/extension/session/refresh")
def refresh_extension_session_route(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict:
    authenticate_api_key(db, authorization)
    session_id = device_session_context.get()
    if session_id is None:
        raise compass_error(400, "device_session_required", "This endpoint requires a VS Code device session.")
    return refresh_extension_session(db, session_id)


@app.post("/auth/marketplace", response_model=SessionResponse)
def marketplace_login(body: MarketplaceSsoRequest, db: Session = Depends(get_db)) -> SessionResponse:
    try:
        claims = decode_marketplace_sso_token(body.token)
    except ValueError as exc:
        raise compass_error(401, "invalid_marketplace_session", "Marketplace sign-in could not be verified.") from exc
    user = upsert_marketplace_user(db, claims["email"], str(claims.get("role", "user")), claims.get("name"))
    access = db.scalar(select(UserAccess).where(UserAccess.user_id == user.id))
    if access is not None and access.status != "active":
        raise compass_error(403, "account_suspended", "This account has been suspended by the product owner.")
    return SessionResponse(
        token=create_session_token(user.id, user.session_version),
        user_id=user.id,
        email=user.email,
        organization_id=organization_id_for_user(db, user.id),
        role=user.role,
    )


@app.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"id": user.id, "email": user.email, "role": user.role}


@app.get("/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    if is_admin(user):
        return dashboard_summary(db, workspace_ids=workspace_ids_for_user(db, user))
    return dashboard_summary(db, team_ids=team_ids_for_user(db, user), user_id=user.id, workspace_ids=workspace_ids_for_user(db, user))


@app.get("/teams")
def teams(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    return team_rows(db, team_ids_for_user(db, user))


@app.get("/workspaces")
def workspaces(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    return workspace_rows(db, workspace_ids_for_user(db, user))


@app.get("/projects")
def projects(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    return project_rows(db, project_ids_for_user(db, user))


@app.post("/projects")
def create_customer_project(body: ProjectCreate, user: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    organization_id = organization_id_for_user(db, user.id)
    if organization_id is None:
        raise compass_error(400, "workspace_required", "Create or select a workspace before creating a project.")
    project = create_project(db, organization_id, body.name, body.slug, body.description, user.id)
    return {"id": project.id, "organization_id": project.organization_id, "name": project.name, "slug": project.slug, "description": project.description, "is_default": project.is_default, "is_active": project.is_active}


@app.patch("/projects/{project_id}")
def update_customer_project(project_id: str, body: ProjectUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    project = require_project_access(db, user, project_id, write=True)
    if project.is_default and not is_admin(user):
        organization_admin_membership = db.scalar(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == project.organization_id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.role.in_(["owner", "admin"]),
            )
        )
        if organization_admin_membership is None:
            raise compass_error(403, "default_project_admin_required", "Only an organization administrator can rename the default project.")
    project.name = body.name.strip()
    project.description = body.description.strip()
    project.updated_at = now()
    db.commit()
    return {"id": project.id, "organization_id": project.organization_id, "name": project.name, "slug": project.slug, "description": project.description, "is_default": project.is_default, "is_active": project.is_active}


@app.get("/organization/members")
def organization_members(user: User = Depends(organization_admin), db: Session = Depends(get_db)) -> list[dict]:
    organization_id = organization_id_for_user(db, user.id)
    rows = db.execute(select(User, OrganizationMember).join(OrganizationMember, OrganizationMember.user_id == User.id).where(OrganizationMember.organization_id == organization_id).order_by(User.email)).all()
    return [{"user_id": member_user.id, "email": member_user.email, "role": membership.role, "status": (db.scalar(select(UserAccess.status).where(UserAccess.user_id == member_user.id)) or "active"), "email_verified": member_user.email_verified_at is not None} for member_user, membership in rows]


@app.delete("/organization/members/{user_id}")
def remove_organization_member(user_id: str, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    organization_id = organization_id_for_user(db, actor.id)
    membership = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == organization_id, OrganizationMember.user_id == user_id))
    if membership is None:
        raise compass_error(404, "member_not_found", "Organization member not found.")
    if membership.role == "owner":
        raise compass_error(400, "owner_required", "Transfer ownership before removing the organization owner.")
    member_user = db.get(User, user_id)
    if member_user is None:
        raise compass_error(404, "member_not_found", "Organization member not found.")
    membership.role = "removed"
    remaining_membership = db.scalar(
        select(OrganizationMember.id).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id != organization_id,
            OrganizationMember.role != "removed",
        )
    )
    if remaining_membership is None:
        access = db.scalar(select(UserAccess).where(UserAccess.user_id == user_id))
        if access is None:
            access = UserAccess(user_id=user_id, status="suspended", reason="Removed from organization", updated_by=actor.id)
            db.add(access)
        else:
            access.status = "suspended"
            access.reason = "Removed from organization"
            access.updated_by = actor.id
        member_user.session_version += 1
        revoke_extension_sessions_for_user(db, user_id)
    else:
        revoke_extension_sessions_for_user(db, user_id, organization_id=organization_id)
    db.query(ProjectMember).filter(ProjectMember.user_id == user_id, ProjectMember.project_id.in_(select(Project.id).where(Project.organization_id == organization_id))).update({ProjectMember.status: "removed"}, synchronize_session=False)
    team_ids = select(Team.id).where(Team.organization_id == organization_id)
    db.query(TeamMember).filter(
        TeamMember.team_id.in_(team_ids),
        or_(TeamMember.user_id == user_id, and_(TeamMember.user_id.is_(None), func.lower(TeamMember.email) == member_user.email.lower())),
    ).update({TeamMember.is_active: False}, synchronize_session=False)
    record_audit_log(db, actor, "organization.member_removed", f"user:{user_id}", {"organization_id": organization_id, "email": member_user.email})
    db.commit()
    return {"user_id": user_id, "status": "removed"}


@app.patch("/organization/members/{user_id}")
def update_organization_member(user_id: str, body: OrganizationMemberUpdate, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    organization_id = organization_id_for_user(db, actor.id)
    membership = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == organization_id, OrganizationMember.user_id == user_id, OrganizationMember.role != "removed"))
    if membership is None:
        raise compass_error(404, "member_not_found", "Organization member not found.")
    if membership.role == "owner":
        raise compass_error(400, "owner_required", "The organization owner role cannot be changed here.")
    previous_role = membership.role
    membership.role = body.role
    record_audit_log(db, actor, "organization.member_role_updated", f"user:{user_id}", {"organization_id": organization_id, "from": previous_role, "to": body.role})
    db.commit()
    return {"user_id": user_id, "role": membership.role, "status": "active"}


@app.get("/projects/{project_id}/members")
def project_members(project_id: str, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> list[dict]:
    project = db.get(Project, project_id)
    organization_id = organization_id_for_user(db, actor.id)
    if project is None or project.organization_id != organization_id:
        raise compass_error(404, "project_not_found", "Project not found.")
    rows = db.execute(select(User, ProjectMember).join(ProjectMember, ProjectMember.user_id == User.id).where(ProjectMember.project_id == project_id, ProjectMember.status == "active").order_by(User.email)).all()
    return [{"user_id": member_user.id, "email": member_user.email, "role": membership.role, "status": membership.status} for member_user, membership in rows]


@app.put("/projects/{project_id}/members/{user_id}")
def assign_project_member(project_id: str, user_id: str, body: ProjectMemberUpdate, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    project = db.get(Project, project_id)
    organization_id = organization_id_for_user(db, actor.id)
    if project is None or project.organization_id != organization_id:
        raise compass_error(404, "project_not_found", "Project not found.")
    organization_membership = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == organization_id, OrganizationMember.user_id == user_id, OrganizationMember.role != "removed"))
    if organization_membership is None:
        raise compass_error(400, "member_not_in_organization", "Add the user to the organization before assigning project access.")
    membership = db.scalar(select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id))
    if membership is None:
        membership = ProjectMember(project_id=project_id, user_id=user_id, role=body.role, status="active")
        db.add(membership)
    else:
        membership.role = body.role
        membership.status = "active"
    record_audit_log(db, actor, "project.member_assigned", f"project:{project_id}", {"organization_id": organization_id, "user_id": user_id, "role": membership.role})
    db.commit()
    return {"project_id": project_id, "user_id": user_id, "role": membership.role, "status": membership.status}


@app.delete("/projects/{project_id}/members/{user_id}")
def remove_project_member(project_id: str, user_id: str, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    project = db.get(Project, project_id)
    organization_id = organization_id_for_user(db, actor.id)
    if project is None or project.organization_id != organization_id:
        raise compass_error(404, "project_not_found", "Project not found.")
    membership = db.scalar(select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id))
    if membership is None:
        raise compass_error(404, "member_not_found", "Project member not found.")
    if membership.role == "owner":
        raise compass_error(400, "owner_required", "The project owner cannot be removed here.")
    membership.status = "removed"
    record_audit_log(db, actor, "project.member_removed", f"project:{project_id}", {"organization_id": organization_id, "user_id": user_id})
    db.commit()
    return {"project_id": project_id, "user_id": user_id, "status": "removed"}


@app.post("/organization/invitations")
def invite_organization_member(body: InvitationCreate, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    project = require_project_access(db, actor, body.project_id, write=True)
    use_clerk = settings.clerk_organization_invitations_enabled and not settings.local_test_mode
    if use_clerk:
        invitation = create_clerk_organization_invitation(db, actor, project, body.email, body.role, body.team_id)
        token = None
    else:
        invitation, token = create_invitation(db, actor, project, body.email, body.role, body.team_id)
    record_audit_log(db, actor, "organization.invitation_created", f"invitation:{invitation.id}", {"email": invitation.email, "project_id": invitation.project_id, "team_id": invitation.team_id, "role": invitation.role, "delivery_provider": invitation.delivery_provider})
    db.commit()
    response = {"id": invitation.id, "email": invitation.email, "project_id": invitation.project_id, "team_id": invitation.team_id, "role": invitation.role, "status": invitation.status, "delivery_provider": invitation.delivery_provider, "expires_at": invitation.expires_at.isoformat()}
    if token is not None:
        response["accept_token"] = token
    if invitation.clerk_invitation_id:
        response["clerk_invitation_id"] = invitation.clerk_invitation_id
    return response


@app.get("/organization/invitations")
def organization_invitations(actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> list[dict]:
    organization_id = organization_id_for_user(db, actor.id)
    rows = db.scalars(select(Invitation).where(Invitation.organization_id == organization_id).order_by(Invitation.created_at.desc())).all()
    return [{"id": row.id, "email": row.email, "project_id": row.project_id, "team_id": row.team_id, "role": row.role, "status": row.status, "expires_at": row.expires_at.isoformat(), "created_at": row.created_at.isoformat()} for row in rows]


@app.post("/organization/invitations/{invitation_id}/resend")
def resend_organization_invitation(invitation_id: str, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    organization_id = organization_id_for_user(db, actor.id)
    invitation = db.scalar(select(Invitation).where(Invitation.id == invitation_id, Invitation.organization_id == organization_id))
    if invitation is None:
        raise compass_error(404, "invitation_not_found", "Invitation not found.")
    if invitation.delivery_provider == "clerk":
        if invitation.status != "pending" or invitation.expires_at < now():
            raise compass_error(409, "invitation_not_pending", "Only pending invitations can be resent.")
        project = db.get(Project, invitation.project_id)
        if project is None:
            raise compass_error(404, "project_not_found", "Project not found.")
        new_invitation = create_clerk_organization_invitation(db, actor, project, invitation.email, invitation.role, invitation.team_id, invitation.id)
        invitation.status = "cancelled"
        db.flush()
        invitation = new_invitation
    else:
        resend_invitation(db, invitation, actor)
    db.commit()
    return {"id": invitation.id, "status": invitation.status, "expires_at": invitation.expires_at.isoformat()}


@app.post("/organization/invitations/{invitation_id}/cancel")
def cancel_organization_invitation(invitation_id: str, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    organization_id = organization_id_for_user(db, actor.id)
    invitation = db.scalar(select(Invitation).where(Invitation.id == invitation_id, Invitation.organization_id == organization_id))
    if invitation is None:
        raise compass_error(404, "invitation_not_found", "Invitation not found.")
    if invitation.status == "accepted":
        raise compass_error(409, "invitation_already_accepted", "An accepted invitation cannot be cancelled.")
    if invitation.delivery_provider == "clerk":
        revoke_clerk_organization_invitation(db, invitation, actor)
    invitation.status = "cancelled"
    record_audit_log(db, actor, "organization.invitation_cancelled", f"invitation:{invitation.id}", {"email": invitation.email, "project_id": invitation.project_id})
    db.commit()
    return {"id": invitation.id, "status": invitation.status}


@app.get("/invitations/{token}")
def invitation_details(token: str, db: Session = Depends(get_db)) -> dict:
    invitation = db.scalar(select(Invitation).where(Invitation.token_hash == hashlib.sha256(token.encode("utf-8")).hexdigest()))
    if invitation is None or invitation.status != "pending" or invitation.expires_at < now():
        raise compass_error(404, "invitation_not_found", "This invitation is invalid or expired.")
    project = db.get(Project, invitation.project_id)
    organization = db.get(Organization, invitation.organization_id)
    return {"id": invitation.id, "email": invitation.email, "organization": organization.name if organization else "", "project": project.name if project else "", "role": invitation.role, "expires_at": invitation.expires_at.isoformat()}


@app.post("/auth/invitations/{token}/request-otp")
def request_invitation_otp(token: str, db: Session = Depends(get_db)) -> dict:
    invitation = db.scalar(select(Invitation).where(Invitation.token_hash == hashlib.sha256(token.encode("utf-8")).hexdigest()))
    if invitation is None or invitation.status != "pending" or invitation.expires_at < now():
        raise compass_error(404, "invitation_not_found", "This invitation is invalid or expired.")
    challenge, code = create_otp_challenge(db, invitation.email, f"invitation:{invitation.id}")
    response = {"challenge_id": challenge.id, "email": invitation.email, "expires_at": challenge.expires_at.isoformat(), "delivery": settings.email_delivery_mode}
    if settings.local_test_mode:
        response["debug_otp"] = code
    return response


@app.post("/auth/invitations/{token}/accept", response_model=SessionResponse)
def accept_invitation(token: str, body: InvitationOtpVerify, db: Session = Depends(get_db)) -> SessionResponse:
    invitation = db.scalar(select(Invitation).where(Invitation.token_hash == hashlib.sha256(token.encode("utf-8")).hexdigest()))
    if invitation is None or invitation.status != "pending" or invitation.expires_at < now() or invitation.email != body.email.lower():
        raise compass_error(404, "invitation_not_found", "This invitation is invalid or expired.")
    verify_otp_challenge(db, body.challenge_id, body.email, body.code, f"invitation:{invitation.id}")
    user = db.scalar(select_user_by_email(body.email.lower()))
    if user is None:
        user = User(email=body.email.lower(), password_hash=hash_password(f"otp-only:{new_id()}"), role="customer", email_verified_at=now())
        db.add(user)
        db.flush()
    else:
        user.email_verified_at = user.email_verified_at or now()
    organization_membership = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == invitation.organization_id, OrganizationMember.user_id == user.id))
    if organization_membership is None:
        db.add(OrganizationMember(user_id=user.id, organization_id=invitation.organization_id, role="admin" if invitation.role == "admin" else "customer"))
    project_membership = db.scalar(select(ProjectMember).where(ProjectMember.project_id == invitation.project_id, ProjectMember.user_id == user.id))
    if project_membership is None:
        db.add(ProjectMember(project_id=invitation.project_id, user_id=user.id, role=invitation.role))
    if invitation.team_id:
        team_member = db.scalar(select(TeamMember).where(TeamMember.team_id == invitation.team_id, func.lower(TeamMember.email) == body.email.lower()))
        if team_member is None:
            db.add(TeamMember(team_id=invitation.team_id, user_id=user.id, name=body.name, email=body.email.lower(), role=invitation.role))
        else:
            team_member.user_id = user.id
            team_member.name = body.name
            team_member.is_active = True
    invitation.status = "accepted"
    invitation.accepted_at = now()
    record_audit_log(db, user, "organization.invitation_accepted", f"invitation:{invitation.id}", {"organization_id": invitation.organization_id, "project_id": invitation.project_id, "email": invitation.email})
    db.commit()
    return _session_response(db, user)


@app.post("/workspaces")
def create_workspace(body: WorkspaceCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    workspace = Organization(name=body.name.strip())
    db.add(workspace)
    db.flush()
    db.add(OrganizationMember(user_id=user.id, organization_id=workspace.id, role="owner"))
    db.commit()
    return {"id": workspace.id, "name": workspace.name, "team_count": 0, "created_at": workspace.created_at.isoformat()}


@app.get("/teams/{team_id}/members")
def team_members(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    require_team_access(db, user, team_id)
    rows = db.scalars(select(TeamMember).where(TeamMember.team_id == team_id).order_by(TeamMember.created_at.desc())).all()
    return [{"id": row.id, "team_id": row.team_id, "name": row.name, "email": row.email, "role": row.role, "is_active": row.is_active} for row in rows]


@app.delete("/teams/{team_id}/members/{member_id}")
def remove_team_member(team_id: str, member_id: str, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    team = db.get(Team, team_id)
    organization_id = organization_id_for_user(db, actor.id)
    if team is None or team.organization_id != organization_id:
        raise compass_error(404, "team_not_found", "Team not found.")
    member = db.scalar(select(TeamMember).where(TeamMember.id == member_id, TeamMember.team_id == team_id))
    if member is None:
        raise compass_error(404, "member_not_found", "Team member not found.")
    if member.role == "owner":
        raise compass_error(400, "owner_required", "The team owner cannot be removed here.")
    member.is_active = False
    db.query(ApiKey).filter(ApiKey.team_id == team_id, ApiKey.member_id == member_id, ApiKey.status == "active").update({ApiKey.status: "revoked", ApiKey.revoked_at: now()}, synchronize_session=False)
    record_audit_log(db, actor, "team.member_removed", f"team:{team_id}", {"organization_id": organization_id, "member_id": member_id, "email": member.email})
    db.commit()
    return {"member_id": member_id, "status": "removed", "api_keys_revoked": True}


def team_limits_row(limits: TeamLimit) -> dict:
    return {
        "team_id": limits.team_id,
        "requests_per_minute": limits.requests_per_minute,
        "tokens_per_minute": limits.tokens_per_minute,
        "daily_spend_limit_paise": limits.daily_spend_limit_paise,
        "monthly_spend_limit_paise": limits.monthly_spend_limit_paise,
    }


@app.get("/teams/{team_id}/limits")
def team_limits(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_access(db, user, team_id)
    limits = db.scalar(select(TeamLimit).where(TeamLimit.team_id == team_id))
    if limits is None:
        raise compass_error(404, "team_limits_not_found", "Team limits were not configured.")
    return team_limits_row(limits)


@app.patch("/admin/teams/{team_id}/limits")
def update_team_limits(team_id: str, body: TeamLimitsUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.manage")
    limits = db.scalar(select(TeamLimit).where(TeamLimit.team_id == team_id))
    if limits is None:
        raise compass_error(404, "team_limits_not_found", "Team limits were not configured.")
    for field, value in body.model_dump().items():
        setattr(limits, field, value)
    record_audit_log(db, actor, "team.limits_updated", f"team:{team_id}", body.model_dump())
    db.commit()
    return team_limits_row(limits)


@app.post("/teams")
def create_customer_team(body: TeamCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    workspace_id = body.workspace_id or (workspace_ids_for_user(db, user)[0] if workspace_ids_for_user(db, user) else None)
    if workspace_id is None:
        raise compass_error(400, "workspace_required", "Create or select a workspace before creating a team.")
    require_workspace_access(db, user, workspace_id)
    project_id = body.project_id or db.scalar(select(Project.id).where(Project.organization_id == workspace_id, Project.is_default.is_(True)))
    if project_id:
        require_project_access(db, user, project_id, write=True)
    team = create_team(db, body.name, body.slug, body.notes, workspace_id, project_id)
    member = create_team_member(db, team.id, user.email, user.email, "owner")
    member.user_id = user.id
    db.commit()
    return {"id": team.id, "workspace_id": team.organization_id, "project_id": team.project_id, "name": team.name, "slug": team.slug, "is_active": team.is_active}


@app.get("/admin/teams")
def admin_teams(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    require_platform_permission(db, actor, "customers.view")
    teams = db.scalars(select(Team).order_by(Team.created_at.desc())).all()
    return [{"id": team.id, "name": team.name, "slug": team.slug, "notes": team.notes, "is_active": team.is_active, "created_at": team.created_at.isoformat()} for team in teams]


@app.patch("/admin/teams/{team_id}/status")
def admin_update_team_status(team_id: str, body: TeamStatusUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.manage")
    team = db.get(Team, team_id)
    if team is None:
        raise compass_error(404, "team_not_found", "Team not found.")
    team.is_active = body.enabled
    team.updated_at = now()
    record_audit_log(db, actor, "team.status_updated", f"team:{team.id}", {"enabled": team.is_active})
    db.commit()
    return {"id": team.id, "is_active": team.is_active}


@app.post("/admin/teams")
def admin_create_team(body: TeamCreate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.manage")
    team = create_team(db, body.name, body.slug, body.notes, body.workspace_id, body.project_id)
    record_audit_log(db, actor, "team.created", f"team:{team.id}", {"name": team.name, "slug": team.slug, "workspace_id": team.organization_id})
    db.commit()
    return {"id": team.id, "workspace_id": team.organization_id, "project_id": team.project_id, "name": team.name, "slug": team.slug, "is_active": team.is_active}


@app.post("/admin/teams/{team_id}/members")
def admin_create_member(team_id: str, body: TeamMemberCreate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.manage")
    member = create_team_member(db, team_id, body.name, body.email.lower(), body.role)
    record_audit_log(db, actor, "team.member_added", f"team:{team_id}", {"member_id": member.id, "email": member.email, "role": member.role})
    db.commit()
    return {"id": member.id, "team_id": member.team_id, "name": member.name, "email": member.email, "role": member.role, "is_active": member.is_active}


@app.get("/admin/teams/{team_id}/members")
def admin_members(team_id: str, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    require_platform_permission(db, actor, "customers.view")
    rows = db.scalars(select(TeamMember).where(TeamMember.team_id == team_id).order_by(TeamMember.created_at.desc())).all()
    return [{"id": row.id, "team_id": row.team_id, "name": row.name, "email": row.email, "role": row.role, "is_active": row.is_active} for row in rows]


@app.post("/admin/api-keys")
def admin_create_key(body: ApiKeyCreate, user: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, user, "customers.manage")
    result = create_api_key(db, user.id, body.team_id, body.member_id, body.name, body.allowed_models, body.expires_at, body.project_id)
    record_audit_log(db, user, "api_key.created", f"team:{body.team_id}", {"name": body.name, "key_id": result.get("id")})
    db.commit()
    return result


@app.post("/api-keys")
def create_key(body: ApiKeyCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_owner(db, user, body.team_id)
    member_id = body.member_id
    if member_id is None:
        member = db.scalar(select(TeamMember).where(TeamMember.team_id == body.team_id, TeamMember.user_id == user.id, TeamMember.is_active.is_(True)))
        if member is None:
            member = db.scalar(select(TeamMember).where(TeamMember.team_id == body.team_id, func.lower(TeamMember.email) == user.email.lower(), TeamMember.is_active.is_(True)))
        if member is None:
            raise compass_error(403, "team_membership_required", "An active team membership is required.")
        member_id = member.id
    result = create_api_key(db, user.id, body.team_id, member_id, body.name, body.allowed_models, body.expires_at, body.project_id)
    record_audit_log(db, user, "api_key.created", f"api_key:{result['id']}", {"team_id": body.team_id, "project_id": result.get("project_id"), "member_id": member_id, "expires_at": body.expires_at.isoformat() if body.expires_at else None})
    db.commit()
    return result


@app.get("/api-keys")
def list_keys(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    if is_admin(user):
        return list_api_keys(db)
    organization_ids = list(db.scalars(select(OrganizationMember.organization_id).where(OrganizationMember.user_id == user.id, OrganizationMember.role.in_(["owner", "admin"]))).all())
    if organization_ids:
        return list_api_keys(db, organization_ids=organization_ids)
    visible = list_api_keys(db, team_ids=team_ids_for_user(db, user), user_id=user.id)
    owned = list_api_keys(db, team_ids=team_owner_ids_for_user(db, user))
    return list({row["id"]: row for row in visible + owned}.values())


@app.post("/api-keys/{api_key_id}/revoke")
def revoke_key(api_key_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    key_record = db.get(ApiKey, api_key_id)
    if key_record is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    if not is_admin(user):
        if not key_record.team_id:
            raise compass_error(403, "api_key_access_denied", "You cannot revoke this API key.")
        require_team_owner(db, user, key_record.team_id)
    key = revoke_api_key(db, api_key_id)
    record_audit_log(db, user, "api_key.revoked", f"api_key:{key.id}", {"team_id": key.team_id, "key_id": key.key_id, "member_id": key.member_id})
    db.commit()
    return {"id": key.id, "status": key.status, "revoked_at": key.revoked_at.isoformat() if key.revoked_at else None}


@app.post("/api-keys/{api_key_id}/rotate")
def rotate_key(api_key_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    key_record = db.get(ApiKey, api_key_id)
    if key_record is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    if not is_admin(user):
        if not key_record.team_id:
            raise compass_error(403, "api_key_access_denied", "You cannot rotate this API key.")
        require_team_owner(db, user, key_record.team_id)
    result = rotate_api_key(db, api_key_id, user.id)
    record_audit_log(db, user, "api_key.rotated", f"api_key:{api_key_id}", {"replacement_id": result["id"], "team_id": key_record.team_id})
    db.commit()
    return result


@app.patch("/api-keys/{api_key_id}/models")
def update_key_models(api_key_id: str, body: ApiKeyModelsUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    key = db.get(ApiKey, api_key_id)
    if key is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    if not is_admin(user):
        if not key.team_id:
            raise compass_error(403, "api_key_access_denied", "You cannot update this API key.")
        require_team_owner(db, user, key.team_id)
    return update_api_key_models(db, api_key_id, body.allowed_models)


@app.get("/api-keys/assigned")
def assigned_keys(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Return safe aliases for keys assigned to the signed-in member.

    Raw secrets and key prefixes are intentionally excluded from this member-facing flow.
    """
    return list_assigned_api_keys(db, user.id)


@app.get("/api-keys/{api_key_id}/members")
def key_members(api_key_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    key = db.get(ApiKey, api_key_id)
    if key is None or not key.team_id:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    require_team_owner(db, user, key.team_id)
    return assigned_api_key_members(db, api_key_id)


@app.put("/api-keys/{api_key_id}/members")
def replace_key_members(api_key_id: str, body: ApiKeyMembersUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    key = db.get(ApiKey, api_key_id)
    if key is None or not key.team_id:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    require_team_owner(db, user, key.team_id)
    members = replace_api_key_members(db, api_key_id, body.member_ids, user.id)
    record_audit_log(db, user, "api_key.members_replaced", f"api_key:{api_key_id}", {"member_ids": [member["id"] for member in members]})
    db.commit()
    return {"api_key_id": api_key_id, "members": members}


@app.get("/api-keys/{api_key_id}/projects")
def key_projects(api_key_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[str]:
    key = db.get(ApiKey, api_key_id)
    if key is None or not key.team_id:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    require_team_owner(db, user, key.team_id)
    return assigned_api_key_projects(db, api_key_id)


@app.put("/api-keys/{api_key_id}/projects")
def replace_key_projects(api_key_id: str, body: ApiKeyProjectsUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    key = db.get(ApiKey, api_key_id)
    if key is None or not key.team_id:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    require_team_owner(db, user, key.team_id)
    project_ids = replace_api_key_projects(db, api_key_id, body.project_ids)
    record_audit_log(db, user, "api_key.projects_replaced", f"api_key:{api_key_id}", {"project_ids": project_ids})
    db.commit()
    return {"api_key_id": api_key_id, "project_ids": project_ids}


@app.post("/admin/wallet/topups")
def admin_topup(body: WalletTopupRequest, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "finance.adjust")
    ledger = credit_wallet(db, body.team_id, body.amount_paise, body.idempotency_key, body.idempotency_key)
    record_audit_log(db, actor, "wallet.topup_created", f"team:{body.team_id}", {"amount_paise": body.amount_paise, "ledger_id": ledger.id})
    db.commit()
    return {"ledger_id": ledger.id, "team_id": body.team_id, "balance_paise": ledger.balance_after}


@app.get("/wallet")
def wallet(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_access(db, user, team_id)
    account = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id))
    if account is None:
        raise compass_error(404, "wallet_not_found", "Credits account not found.")
    return {"team_id": team_id, "currency": account.currency, "balance_paise": account.balance_paise}


@app.get("/wallet/ledger")
def wallet_ledger(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    require_team_access(db, user, team_id)
    account = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id))
    if account is None:
        return []
    rows = db.scalars(select(WalletLedger).where(WalletLedger.wallet_id == account.id).order_by(WalletLedger.created_at.desc())).all()
    return [{"id": row.id, "type": row.type, "amount_paise": row.amount_paise, "balance_before": row.balance_before, "balance_after": row.balance_after, "reference_type": row.reference_type, "reference_id": row.reference_id, "idempotency_key": row.idempotency_key, "created_at": row.created_at.isoformat()} for row in rows]


def billing_order_row(order: PaymentOrder) -> dict:
    return {
        "id": order.id,
        "team_id": order.team_id,
        "provider": order.provider,
        "provider_order_id": order.provider_order_id,
        "payment_id": order.payment_id,
        "amount_paise": order.amount_paise,
        "refunded_paise": order.refunded_paise,
        "currency": order.currency,
        "status": order.status,
        "failure_code": order.failure_code,
        "failure_description": order.failure_description,
        "created_at": order.created_at.isoformat(),
        "completed_at": order.completed_at.isoformat() if order.completed_at else None,
        "can_complete": order.provider == "development" and order.status == "created",
        "can_refund": order.status in {"completed", "partially_refunded"} and order.refunded_paise < order.amount_paise,
    }


def invoice_row(invoice: BillingInvoice) -> dict:
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "order_id": invoice.order_id,
        "team_id": invoice.team_id,
        "currency": invoice.currency,
        "subtotal_paise": invoice.subtotal_paise,
        "tax_paise": invoice.tax_paise,
        "total_paise": invoice.total_paise,
        "status": invoice.status,
        "created_at": invoice.created_at.isoformat(),
        "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
    }


def refund_row(refund: PaymentRefund) -> dict:
    return {
        "id": refund.id,
        "order_id": refund.order_id,
        "team_id": refund.team_id,
        "provider_refund_id": refund.provider_refund_id,
        "amount_paise": refund.amount_paise,
        "status": refund.status,
        "reason": refund.reason,
        "failure_description": refund.failure_description,
        "created_at": refund.created_at.isoformat(),
        "processed_at": refund.processed_at.isoformat() if refund.processed_at else None,
    }


def _ensure_invoice(db: Session, order: PaymentOrder) -> BillingInvoice:
    invoice = db.scalar(select(BillingInvoice).where(BillingInvoice.order_id == order.id))
    if invoice is not None:
        return invoice
    invoice = BillingInvoice(
        invoice_number=f"CMP-{order.created_at.strftime('%Y%m%d')}-{order.id[:8].upper()}",
        order_id=order.id,
        team_id=order.team_id,
        currency=order.currency,
        subtotal_paise=order.amount_paise,
        tax_paise=0,
        total_paise=order.amount_paise,
        status="paid",
        paid_at=order.completed_at or now(),
    )
    db.add(invoice)
    return invoice


def _settle_payment_order(db: Session, order: PaymentOrder, payment_id: str, payment_method: str | None = None) -> tuple[PaymentOrder, WalletLedger, BillingInvoice]:
    locked_order = db.scalar(select(PaymentOrder).where(PaymentOrder.id == order.id).with_for_update())
    if locked_order is None or not locked_order.team_id:
        raise compass_error(404, "payment_order_not_found", "Payment order not found.")
    if locked_order.status == "completed" or locked_order.status == "partially_refunded":
        ledger = db.scalar(select(WalletLedger).where(WalletLedger.idempotency_key == f"payment:{locked_order.id}"))
        invoice = _ensure_invoice(db, locked_order)
        db.commit()
        if ledger is None:
            raise compass_error(409, "payment_ledger_missing", "The payment is marked complete but its wallet ledger entry is missing.")
        return locked_order, ledger, invoice
    if locked_order.status in {"refunded", "failed"}:
        raise compass_error(409, "payment_order_not_settleable", "This payment order cannot be credited in its current state.")
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == locked_order.team_id).with_for_update())
    if wallet is None:
        raise compass_error(404, "wallet_not_found", "Credits account not found.")
    idempotency_key = f"payment:{locked_order.id}"
    ledger = db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == idempotency_key))
    if ledger is None:
        before = wallet.balance_paise
        wallet.balance_paise += locked_order.amount_paise
        wallet.updated_at = now()
        ledger = WalletLedger(
            wallet_id=wallet.id,
            type="credit",
            amount_paise=locked_order.amount_paise,
            balance_before=before,
            balance_after=wallet.balance_paise,
            reference_type="payment_order",
            reference_id=payment_id,
        description="Credits recharge completed through payment provider",
            idempotency_key=idempotency_key,
        )
        db.add(ledger)
    locked_order.payment_id = payment_id
    locked_order.payment_method = payment_method
    locked_order.status = "completed"
    locked_order.completed_at = now()
    invoice = _ensure_invoice(db, locked_order)
    db.commit()
    return locked_order, ledger, invoice


def _apply_refund(db: Session, refund: PaymentRefund, provider_refund_id: str | None = None) -> PaymentRefund:
    locked_refund = db.scalar(select(PaymentRefund).where(PaymentRefund.id == refund.id).with_for_update())
    if locked_refund is None:
        raise compass_error(404, "refund_not_found", "Refund not found.")
    if locked_refund.status == "processed":
        return locked_refund
    order = db.scalar(select(PaymentOrder).where(PaymentOrder.id == locked_refund.order_id).with_for_update())
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == locked_refund.team_id).with_for_update())
    if order is None or wallet is None:
        raise compass_error(404, "wallet_not_found", "Credits account or payment order not found.")
    idempotency_key = f"refund:{locked_refund.id}"
    ledger = db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == idempotency_key))
    if ledger is None:
        before = wallet.balance_paise
        wallet.balance_paise -= locked_refund.amount_paise
        wallet.updated_at = now()
        db.add(WalletLedger(
            wallet_id=wallet.id,
            type="refund",
            amount_paise=-locked_refund.amount_paise,
            balance_before=before,
            balance_after=wallet.balance_paise,
            reference_type="payment_refund",
            reference_id=locked_refund.id,
            description="Credits recharge refund processed",
            idempotency_key=idempotency_key,
        ))
    locked_refund.provider_refund_id = provider_refund_id or locked_refund.provider_refund_id
    locked_refund.status = "processed"
    locked_refund.processed_at = now()
    order.refunded_paise += locked_refund.amount_paise
    order.status = "refunded" if order.refunded_paise >= order.amount_paise else "partially_refunded"
    db.commit()
    return locked_refund


@app.get("/billing/orders")
def billing_orders(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    require_team_access(db, user, team_id)
    rows = db.scalars(select(PaymentOrder).where(PaymentOrder.team_id == team_id).order_by(PaymentOrder.created_at.desc()).limit(30)).all()
    return [billing_order_row(row) for row in rows]


@app.post("/billing/orders")
def create_billing_order(body: BillingOrderCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_owner(db, user, body.team_id)
    team = db.get(Team, body.team_id)
    if team is None or not team.is_active:
        raise compass_error(404, "team_not_found", "Team not found.")
    mode = settings.billing_payment_mode.strip().lower()
    if mode not in {"development", "razorpay"}:
        raise compass_error(503, "billing_unavailable", "Billing is not configured.")
    if mode == "razorpay" and (not settings.razorpay_key_id or not settings.razorpay_key_secret):
        raise compass_error(503, "billing_unavailable", "Razorpay credentials are not configured.")
    provider = "development"
    provider_order_id = f"development_{new_id()}"
    receipt = f"compass_{new_id()}"
    if mode == "razorpay":
        provider = "razorpay"
        try:
            response = httpx.post("https://api.razorpay.com/v1/orders", auth=(settings.razorpay_key_id, settings.razorpay_key_secret), json={"amount": body.amount_paise, "currency": "INR", "receipt": receipt}, timeout=15)
            response.raise_for_status()
            provider_order_id = str(response.json()["id"])
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise compass_error(502, "payment_provider_error", "Razorpay could not create the recharge order.") from exc
    order = PaymentOrder(organization_id=team.organization_id, team_id=team.id, provider=provider, provider_order_id=provider_order_id, receipt=receipt, amount_paise=body.amount_paise, currency="INR", status="created")
    db.add(order)
    db.commit()
    return billing_order_row(order) | {"checkout_key_id": settings.razorpay_key_id if provider == "razorpay" else None}


@app.post("/billing/orders/{order_id}/verify")
def verify_billing_order(order_id: str, body: BillingOrderVerify, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    order = db.get(PaymentOrder, order_id)
    if order is None:
        raise compass_error(404, "payment_order_not_found", "Payment order not found.")
    if not order.team_id:
        raise compass_error(400, "team_required", "This payment order is not attached to a team.")
    require_team_owner(db, user, order.team_id)
    if order.provider != "razorpay" or not settings.razorpay_key_secret:
        raise compass_error(409, "payment_verification_unavailable", "This order is not awaiting Razorpay verification.")
    if order.provider_order_id != body.razorpay_order_id:
        raise compass_error(400, "payment_order_mismatch", "The Razorpay order does not match this recharge.")
    expected = hmac.new(settings.razorpay_key_secret.encode(), f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise compass_error(400, "payment_signature_invalid", "Razorpay payment verification failed.")
    try:
        response = httpx.get(f"https://api.razorpay.com/v1/payments/{body.razorpay_payment_id}", auth=(settings.razorpay_key_id, settings.razorpay_key_secret), timeout=15)
        response.raise_for_status()
        payment = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise compass_error(502, "payment_provider_error", "Razorpay payment status could not be confirmed.") from exc
    if str(payment.get("order_id")) != order.provider_order_id or int(payment.get("amount", -1)) != order.amount_paise or str(payment.get("currency", "INR")) != order.currency:
        raise compass_error(400, "payment_amount_mismatch", "The verified payment does not match this recharge order.")
    if payment.get("status") != "captured":
        raise compass_error(409, "payment_not_captured", "The Razorpay payment has not been captured yet.")
    settled, ledger, _ = _settle_payment_order(db, order, body.razorpay_payment_id, str(payment.get("method")) if payment.get("method") else None)
    return billing_order_row(settled) | {"ledger_id": ledger.id, "balance_paise": ledger.balance_after}


@app.post("/billing/orders/{order_id}/complete")
def complete_billing_order(order_id: str, body: BillingOrderComplete, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    order = db.get(PaymentOrder, order_id)
    if order is None:
        raise compass_error(404, "payment_order_not_found", "Payment order not found.")
    if not order.team_id:
        raise compass_error(400, "team_required", "This payment order is not attached to a team.")
    require_team_owner(db, user, order.team_id)
    if order.status == "completed":
        return billing_order_row(order)
    if order.provider != "development" or settings.billing_payment_mode.strip().lower() != "development":
        raise compass_error(409, "payment_verification_required", "This order must be completed by the configured payment provider.")
    settled, ledger, _ = _settle_payment_order(db, order, order.provider_order_id, "development")
    return billing_order_row(settled) | {"ledger_id": ledger.id, "balance_paise": ledger.balance_after}


@app.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, x_razorpay_signature: str | None = Header(default=None)) -> dict:
    if not settings.razorpay_webhook_secret:
        raise compass_error(503, "webhook_unavailable", "Razorpay webhook secret is not configured.")
    raw_body = await request.body()
    expected = hmac.new(settings.razorpay_webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not x_razorpay_signature or not hmac.compare_digest(expected, x_razorpay_signature):
        raise compass_error(401, "webhook_signature_invalid", "Razorpay webhook signature is invalid.")
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise compass_error(400, "webhook_payload_invalid", "Razorpay webhook payload is invalid.") from exc
    event_type = str(payload.get("event", "unknown"))
    event_id = request.headers.get("x-razorpay-event-id") or str(payload.get("id") or hashlib.sha256(raw_body).hexdigest())
    payload_hash = hashlib.sha256(raw_body).hexdigest()
    db = next(get_db())
    try:
        existing = db.scalar(select(PaymentEvent).where(PaymentEvent.provider == "razorpay", PaymentEvent.event_id == event_id))
        if existing is not None:
            return {"accepted": True, "duplicate": True, "event_id": event_id, "status": existing.status}
        event = PaymentEvent(provider="razorpay", event_id=event_id, event_type=event_type, payload_hash=payload_hash)
        db.add(event)
        db.flush()
        webhook_payload = payload.get("payload") or {}
        payment_entity = (webhook_payload.get("payment") or {}).get("entity") or {}
        order_entity = (webhook_payload.get("order") or {}).get("entity") or {}
        entity = order_entity if event_type == "order.paid" else payment_entity
        if event_type in {"payment.captured", "order.paid"}:
            provider_order_id = str(entity.get("order_id") or entity.get("id") or "")
            order = db.scalar(select(PaymentOrder).where(PaymentOrder.provider_order_id == provider_order_id))
            if order is None:
                event.status = "ignored"
            else:
                payment_amount = payment_entity.get("amount") or entity.get("amount_paid") or entity.get("amount")
                payment_currency = payment_entity.get("currency") or entity.get("currency") or order.currency
                payment_id = str(payment_entity.get("id") or entity.get("payment_id") or entity.get("id") or "")
            if order is not None and (int(payment_amount or -1) != order.amount_paise or str(payment_currency) != order.currency):
                event.status = "failed"
                event.error_message = "Payment amount or currency does not match the order."
                db.commit()
                raise compass_error(400, "payment_amount_mismatch", event.error_message)
            elif order is not None:
                _settle_payment_order(db, order, payment_id, str(payment_entity.get("method")) if payment_entity.get("method") else None)
                event.status = "processed"
        elif event_type == "payment.failed":
            order = db.scalar(select(PaymentOrder).where(PaymentOrder.provider_order_id == str(entity.get("order_id") or "")))
            if order is not None:
                order.status = "failed"
                order.failure_code = str(entity.get("error_code") or "payment_failed")
                order.failure_description = str(entity.get("error_description") or "Razorpay payment failed.")
                event.status = "processed"
            else:
                event.status = "ignored"
        elif event_type in {"refund.processed", "refund.failed"}:
            refund_entity = ((payload.get("payload") or {}).get("refund") or {}).get("entity") or {}
            provider_refund_id = str(refund_entity.get("id") or "")
            refund = db.scalar(select(PaymentRefund).where(PaymentRefund.provider_refund_id == provider_refund_id))
            if refund is None:
                order = db.scalar(select(PaymentOrder).where(PaymentOrder.payment_id == str(refund_entity.get("payment_id") or "")))
                if order is not None and order.team_id:
                    refund = PaymentRefund(order_id=order.id, team_id=order.team_id, provider_refund_id=provider_refund_id, amount_paise=int(refund_entity.get("amount", 0)), status="requested", reason="Razorpay refund")
                    db.add(refund)
                    db.flush()
            if refund is None:
                event.status = "ignored"
            elif event_type == "refund.processed":
                _apply_refund(db, refund, provider_refund_id)
                event.status = "processed"
            else:
                refund.status = "failed"
                refund.failure_description = str(refund_entity.get("error_description") or "Razorpay refund failed.")
                event.status = "processed"
        else:
            event.status = "ignored"
        event.processed_at = now()
        db.commit()
        return {"accepted": True, "duplicate": False, "event_id": event_id, "status": event.status}
    except IntegrityError:
        db.rollback()
        return {"accepted": True, "duplicate": True, "event_id": event_id, "status": "processed"}
    finally:
        db.close()


@app.post("/billing/orders/{order_id}/refund")
def refund_billing_order(order_id: str, body: BillingRefundCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    order = db.get(PaymentOrder, order_id)
    if order is None or not order.team_id:
        raise compass_error(404, "payment_order_not_found", "Payment order not found.")
    require_team_owner(db, user, order.team_id)
    remaining = order.amount_paise - order.refunded_paise
    amount_paise = body.amount_paise or remaining
    if order.status not in {"completed", "partially_refunded"} or amount_paise > remaining:
        raise compass_error(409, "refund_not_allowed", "This payment order is not eligible for that refund amount.")
    if order.provider == "development":
        refund = PaymentRefund(order_id=order.id, team_id=order.team_id, amount_paise=amount_paise, status="requested", reason=body.reason)
        db.add(refund)
        db.flush()
        processed = _apply_refund(db, refund)
        return refund_row(processed)
    if not order.payment_id or not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise compass_error(409, "refund_unavailable", "The payment provider has not supplied a refundable payment reference.")
    try:
        response = httpx.post(f"https://api.razorpay.com/v1/payments/{order.payment_id}/refund", auth=(settings.razorpay_key_id, settings.razorpay_key_secret), json={"amount": amount_paise, "notes": {"reason": body.reason}}, timeout=15)
        response.raise_for_status()
        provider_refund_id = str(response.json()["id"])
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise compass_error(502, "payment_provider_error", "Razorpay could not create the refund.") from exc
    refund = PaymentRefund(order_id=order.id, team_id=order.team_id, provider_refund_id=provider_refund_id, amount_paise=amount_paise, status="requested", reason=body.reason)
    db.add(refund)
    db.commit()
    return refund_row(refund)


@app.get("/billing/refunds")
def billing_refunds(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    require_team_access(db, user, team_id)
    rows = db.scalars(select(PaymentRefund).where(PaymentRefund.team_id == team_id).order_by(PaymentRefund.created_at.desc()).limit(50)).all()
    return [refund_row(row) for row in rows]


@app.get("/billing/invoices")
def billing_invoices(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    require_team_access(db, user, team_id)
    rows = db.scalars(select(BillingInvoice).where(BillingInvoice.team_id == team_id).order_by(BillingInvoice.created_at.desc()).limit(50)).all()
    return [invoice_row(row) for row in rows]


@app.get("/admin/billing/reconciliation")
def billing_reconciliation(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "finance.view")
    orders = db.scalars(select(PaymentOrder).order_by(PaymentOrder.created_at.asc())).all()
    ledgers = db.scalars(select(WalletLedger).where(WalletLedger.reference_type == "payment_order")).all()
    ledger_refs = {row.reference_id for row in ledgers}
    completed = [row for row in orders if row.status in {"completed", "partially_refunded", "refunded"}]
    missing_credit = [row.id for row in completed if (row.payment_id or row.provider_order_id) not in ledger_refs]
    order_refs = {row.payment_id or row.provider_order_id for row in completed}
    orphan_credits = [row.reference_id for row in ledgers if row.reference_id not in order_refs]
    return {
        "orders": len(orders),
        "completed_orders": len(completed),
        "matched_credits": len(completed) - len(missing_credit),
        "missing_credit_order_ids": missing_credit,
        "orphan_credit_references": orphan_credits,
        "total_completed_paise": sum(row.amount_paise for row in completed),
        "total_credited_paise": sum(row.amount_paise for row in ledgers if row.reference_id in order_refs),
        "generated_at": now().isoformat(),
    }


@app.get("/models")
def models(db: Session = Depends(get_db)) -> list[dict]:
    return model_catalog_rows(db)


@app.get("/admin/models/discover")
async def admin_discover_models(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "models.manage")
    return await litellm_model_catalog(db, force=True)


@app.get("/catalog/models")
async def catalog_models(team_id: str | None = None, provider: str | None = None, capability: str | None = None, min_context: int | None = None, include_unavailable: bool = True, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    if team_id:
        require_team_access(db, user, team_id)
    result = provider_catalog_response(db, provider=provider)
    if not result["models"]:
        result = await litellm_model_catalog(db)
    available_providers = credential_provider_names(db, team_id) if team_id else set()
    models = result["models"]
    if capability:
        models = [row for row in models if capability_matches(capability, row.get("capability_types"), row.get("capabilities"))]
    if min_context is not None:
        models = [row for row in models if (row.get("context_window") or 0) >= min_context]
    if not include_unavailable:
        models = [row for row in models if row.get("route_ready", False)]
    result["models"] = [row | {"credential_available": row["provider"] in available_providers} for row in models]
    result["total"] = len(result["models"])
    return result


@app.post("/admin/catalog/sync")
async def admin_sync_catalog(provider: str = "litellm", actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "models.manage")
    if provider == "litellm":
        return await sync_litellm_catalog(db, force=True)
    if provider == "openrouter":
        return await sync_openrouter_catalog(db, force=True)
    raise compass_error(400, "catalog_provider_unsupported", "The requested catalog provider has no verified discovery adapter.")


@app.get("/admin/catalog/status")
def admin_catalog_status(provider: str = "litellm", actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "models.view")
    if provider == "openrouter":
        return openrouter_catalog_response(db)["sync"]
    if provider == "litellm":
        return catalog_sync_status(db, "litellm", settings.litellm_catalog_cache_seconds * 3)
    raise compass_error(400, "catalog_provider_unsupported", "The requested catalog provider has no verified discovery adapter.")


@app.get("/admin/catalog/pricing-policies")
def admin_pricing_policies(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    require_platform_permission(db, actor, "models.view")
    return [pricing_policy_row(row) for row in db.scalars(select(PricingPolicy).order_by(PricingPolicy.effective_at.desc())).all()]


@app.post("/admin/catalog/pricing-policies")
def admin_create_pricing_policy(body: PricingPolicyCreate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "models.manage")
    if db.scalar(select(PricingPolicy).where(PricingPolicy.version == body.version)) is not None:
        raise compass_error(409, "pricing_policy_exists", "A pricing policy with this version already exists.")
    effective_at = body.effective_at
    if effective_at is None:
        effective_at = now()
    elif effective_at.tzinfo is not None:
        effective_at = effective_at.astimezone(UTC).replace(tzinfo=None)
    db.query(PricingPolicy).filter(PricingPolicy.status == "active").update({PricingPolicy.status: "retired"}, synchronize_session=False)
    policy = PricingPolicy(version=body.version, markup_bps=body.markup_bps, usd_to_inr_paise_per_usd=body.usd_to_inr_paise_per_usd, fx_buffer_bps=body.fx_buffer_bps, platform_fee_bps=body.platform_fee_bps, fx_source=body.fx_source, fx_fetched_at=now() if body.fx_source != "fixed_local_fallback" else None, status="active", effective_at=effective_at)
    db.add(policy)
    record_audit_log(db, actor, "catalog.pricing_policy_created", f"pricing_policy:{body.version}", {"markup_bps": body.markup_bps, "fx_buffer_bps": body.fx_buffer_bps, "platform_fee_bps": body.platform_fee_bps, "fx_source": body.fx_source, "usd_to_inr_paise_per_usd": body.usd_to_inr_paise_per_usd})
    db.commit()
    return pricing_policy_row(policy)


@app.get("/admin/pricing/fx")
def admin_fx_status(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    from .fx_service import fx_status
    require_platform_permission(db, actor, "models.view")
    return fx_status(db)


@app.post("/admin/pricing/fx/refresh")
def admin_fx_refresh(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    from .fx_service import refresh_fx_quote
    require_platform_permission(db, actor, "models.manage")
    return refresh_fx_quote(db, force=True)


@app.post("/internal/jobs/fx-refresh")
def internal_fx_refresh(request: Request, x_compass_job_secret: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict:
    """Cloud Scheduler target; the secret stays server-side and is never logged."""
    expected = settings.fx_refresh_job_secret
    iam_request = settings.fx_refresh_iam_auth_enabled and request.headers.get("authorization", "").startswith("Bearer ")
    if not iam_request and (not expected or not x_compass_job_secret or not hmac.compare_digest(x_compass_job_secret, expected)):
        raise HTTPException(status_code=401, detail="Invalid job credentials.")
    from .fx_service import refresh_fx_quote
    return refresh_fx_quote(db)


@app.post("/models/activate")
async def activate_model(body: ModelActivationRequest, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_owner(db, user, body.team_id)
    return await activate_catalog_model(db, body.team_id, body.model_id)


@app.get("/teams/{team_id}/model-policies")
def team_model_policies(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    require_team_access(db, user, team_id)
    return model_policy_rows(db, team_id)


@app.put("/teams/{team_id}/model-policies/{model_id:path}")
def update_team_model_policy(team_id: str, model_id: str, body: ModelPolicyUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_owner(db, user, team_id)
    if db.get(ModelCatalog, model_id) is None:
        raise compass_error(404, "model_not_found", "Model was not found.")
    policy = db.scalar(select(ModelPolicy).where(ModelPolicy.team_id == team_id, ModelPolicy.model_id == model_id))
    if policy is None:
        policy = ModelPolicy(team_id=team_id, model_id=model_id)
        db.add(policy)
    policy.enabled = body.enabled
    policy.requests_per_minute = body.requests_per_minute
    policy.daily_spend_limit_paise = body.daily_spend_limit_paise
    policy.monthly_spend_limit_paise = body.monthly_spend_limit_paise
    policy.updated_at = now()
    db.commit()
    return next(row for row in model_policy_rows(db, team_id) if row["model_id"] == model_id)


@app.get("/admin/router/models")
def admin_router_models(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    require_platform_permission(db, actor, "models.view")
    return model_catalog_rows(db, include_unpublished=True)


@app.get("/admin/router/policies")
def admin_router_policies(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    require_platform_permission(db, actor, "routing.view")
    rows = db.scalars(select(RoutingPolicy).order_by(RoutingPolicy.alias)).all()
    return [{"id": row.id, "alias": row.alias, "candidate_models": [item for item in row.candidate_models.split(",") if item], "enabled": row.enabled} for row in rows]


@app.put("/admin/router/policies/{alias}")
def admin_upsert_router_policy(alias: str, body: AdminRoutingPolicyUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "routing.manage")
    if not alias or len(alias) > 200 or "/" in alias or alias.startswith(("openai/", "gemini/", "ollama_cloud/")):
        raise compass_error(400, "invalid_routing_alias", "Routing aliases must be short names distinct from provider model IDs.")
    if len(set(body.candidate_models)) != len(body.candidate_models):
        raise compass_error(400, "duplicate_routing_model", "Routing policy candidates must be unique.")
    missing = [model_id for model_id in body.candidate_models if db.get(ModelCatalog, model_id) is None]
    if missing:
        raise compass_error(404, "routing_model_not_found", f"Routing policy model was not found: {missing[0]}.")
    if alias in body.candidate_models:
        raise compass_error(400, "routing_policy_loop", "A routing policy cannot reference itself.")
    policy = db.scalar(select(RoutingPolicy).where(RoutingPolicy.alias == alias))
    if policy is None:
        policy = RoutingPolicy(alias=alias, candidate_models=",".join(body.candidate_models))
        db.add(policy)
    else:
        db.add(RoutingPolicyRevision(routing_policy_id=policy.id, administrator_id=actor.id, alias=policy.alias, candidate_models=policy.candidate_models, enabled=policy.enabled, change_reason=body.change_reason.strip()))
        policy.candidate_models = ",".join(body.candidate_models)
    policy.enabled = body.enabled
    record_audit_log(db, actor, "router.policy_updated", f"routing:{alias}", {"candidate_models": body.candidate_models, "enabled": body.enabled, "change_reason": body.change_reason.strip()})
    db.commit()
    return {"id": policy.id, "alias": policy.alias, "candidate_models": body.candidate_models, "enabled": policy.enabled}


@app.delete("/admin/router/policies/{alias}")
def admin_delete_router_policy(alias: str, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "routing.manage")
    policy = db.scalar(select(RoutingPolicy).where(RoutingPolicy.alias == alias))
    if policy is None:
        raise compass_error(404, "routing_policy_not_found", "Routing policy was not found.")
    db.delete(policy)
    record_audit_log(db, actor, "router.policy_deleted", f"routing:{alias}")
    db.commit()
    return {"alias": alias, "deleted": True}


@app.post("/admin/router/policies/{alias}/rollback")
def admin_rollback_router_policy(alias: str, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "routing.manage")
    policy = db.scalar(select(RoutingPolicy).where(RoutingPolicy.alias == alias))
    revision = db.scalar(select(RoutingPolicyRevision).where(RoutingPolicyRevision.alias == alias).order_by(RoutingPolicyRevision.created_at.desc()))
    if policy is None or revision is None:
        raise compass_error(404, "routing_revision_not_found", "No previous verified routing policy is available for rollback.")
    db.add(RoutingPolicyRevision(routing_policy_id=policy.id, administrator_id=actor.id, alias=policy.alias, candidate_models=policy.candidate_models, enabled=policy.enabled, change_reason="Rollback snapshot"))
    policy.candidate_models = revision.candidate_models
    policy.enabled = revision.enabled
    record_audit_log(db, actor, "router.policy_rolled_back", f"routing:{alias}", {"revision_id": revision.id})
    db.commit()
    return {"id": policy.id, "alias": policy.alias, "candidate_models": [item for item in policy.candidate_models.split(",") if item], "enabled": policy.enabled, "rolled_back_revision_id": revision.id}


@app.get("/byok/credentials")
def list_byok_credentials(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    require_team_owner(db, user, team_id)
    return byok_credentials_summary(db, team_id)


@app.post("/byok/credentials")
def save_byok_credential(body: ByokCredentialUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_owner(db, user, body.team_id)
    credential = upsert_byok_api_key(db, body.team_id, user.id, body.provider, body.api_key)
    return {
        "id": credential.id,
        "team_id": credential.team_id,
        "provider": body.provider,
        "status": credential.status,
        "configured": True,
        "last_four": credential.last_four,
        "updated_at": credential.updated_at.isoformat(),
    }


@app.delete("/byok/credentials/{provider_name}")
def delete_byok_credential(provider_name: str, team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_owner(db, user, team_id)
    credential = revoke_byok_api_key(db, team_id, provider_name)
    return {"id": credential.id, "team_id": team_id, "provider": provider_name, "status": credential.status}


@app.get("/v1/models", dependencies=[Depends(enforce_body_limit)])
def openai_models(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict:
    key = authenticate_api_key(db, authorization)
    granted_models = allowed_model_ids(db, key.id)
    data = [{"id": model["id"], "object": "model", "created": 0, "owned_by": "compass", "permission": []} for model in model_catalog_rows(db) if model["id"] in granted_models]
    return {"object": "list", "data": data, "compass": {"team_id": key.team_id, "local_test_mode": settings.local_test_mode, "allowed_models": sorted(granted_models)}}


@app.get("/v1/account")
def openai_account(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict:
    key = authenticate_api_key(db, authorization)
    team = db.get(Team, key.team_id) if key.team_id else None
    project = db.get(Project, key.project_id) if key.project_id else None
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == key.team_id)) if key.team_id else None
    requests = list(
        db.scalars(
            select(LlmRequest)
            .where(LlmRequest.api_key_id == key.id)
            .order_by(LlmRequest.created_at.desc())
            .limit(10)
        ).all()
    )
    totals = db.execute(
        select(
            func.count(LlmRequest.id),
            func.coalesce(func.sum(LlmRequest.total_tokens), 0),
            func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0),
        ).where(LlmRequest.api_key_id == key.id)
    ).one()
    return {
        "team": {"id": team.id, "name": team.name, "slug": team.slug} if team else None,
        "project": {"id": project.id, "name": project.name, "slug": project.slug, "is_default": project.is_default} if project else None,
        "wallet": {"currency": wallet.currency, "balance_paise": wallet.balance_paise} if wallet else None,
        "api_key": {"id": key.id, "name": key.name, "status": key.status, "allowed_models": sorted(allowed_model_ids(db, key.id)), "models_restricted": api_key_models_restricted(db, key.id)},
        "usage": {"requests": int(totals[0]), "tokens": int(totals[1]), "spend_paise": int(totals[2])},
        "recent_requests": request_rows(requests),
        "local_test_mode": settings.local_test_mode,
    }


@app.get("/v1/router/status")
def router_status(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict:
    """Return the provider/model view visible to an API-key client."""
    key = authenticate_api_key(db, authorization)
    allowed = allowed_model_ids(db, key.id)
    models = [row for row in model_catalog_rows(db) if row["id"] in allowed]
    provider_rows = db.scalars(select(Provider).where(Provider.enabled.is_(True)).order_by(Provider.name)).all()
    return {
        "status": "operational",
        "routing": {"fallback_enabled": True, "max_attempts": max(1, min(settings.provider_max_attempts, 5))},
        "providers": [{"name": provider.name, "status": provider.status, "commercial_status": provider.commercial_status, "enabled": provider.enabled} for provider in provider_rows],
        "models": models,
        "api_key": {"id": key.id, "rate_limit": key.rate_limit, "daily_limit_paise": key.daily_limit, "monthly_limit_paise": key.monthly_limit},
    }


@app.post("/v1/chat/completions", dependencies=[Depends(enforce_body_limit)])
async def chat_completions(body: ChatCompletionRequest, authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    api_key = authenticate_api_key(db, authorization)
    payload = body.model_dump()
    if body.stream:
        if not settings.local_test_mode:
            return StreamingResponse(await stream_chat(db, api_key, payload), media_type="text/event-stream")
        full_response = await complete_chat(db, api_key, payload | {"stream": False})
        return StreamingResponse(stream_openai_chunks(full_response), media_type="text/event-stream")
    return await complete_chat(db, api_key, payload)


@app.post("/member/v1/chat/completions", dependencies=[Depends(enforce_body_limit)])
async def member_chat_completions(
    body: ChatCompletionRequest,
    request: Request,
    key_id: str | None = Header(default=None, alias="X-Compass-Key-Id"),
    project_id: str | None = Header(default=None, alias="X-Compass-Project-Id"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Run inference for a Clerk member without exposing a raw Compass key."""
    if getattr(request.state, "auth_source", "") != "clerk":
        raise compass_error(401, "clerk_member_auth_required", "Member inference requires a Clerk-authenticated session.")
    if not key_id:
        raise compass_error(400, "member_key_required", "Select an assigned Compass API key alias.")
    key, member, selected_project = resolve_member_inference_key(db, user, key_id, project_id)
    project_token = api_project_context.set(selected_project)
    member_token = member_inference_context.set((user.id, member.id))
    try:
        payload = body.model_dump()
        if not body.stream:
            return await complete_chat(db, key, payload)
        if settings.local_test_mode:
            full_response = await complete_chat(db, key, payload | {"stream": False})
            return StreamingResponse(stream_openai_chunks(full_response), media_type="text/event-stream")
        events = await stream_chat(db, key, payload)

        async def guarded_events():
            nested_project = api_project_context.set(selected_project)
            nested_member = member_inference_context.set((user.id, member.id))
            try:
                async for event in events:
                    yield event
            finally:
                member_inference_context.reset(nested_member)
                api_project_context.reset(nested_project)

        return StreamingResponse(guarded_events(), media_type="text/event-stream")
    finally:
        member_inference_context.reset(member_token)
        api_project_context.reset(project_token)


@app.post("/v1/responses", dependencies=[Depends(enforce_body_limit)])
async def responses(body: ResponsesRequest, authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    api_key = authenticate_api_key(db, authorization)
    payload = body.model_dump(exclude_none=True)
    if not body.stream:
        return await complete_json_api(db, api_key, payload, "/v1/responses", "responses")

    if not settings.local_test_mode:
        return StreamingResponse(await stream_json_api(db, api_key, payload, "/v1/responses", "responses"), media_type="text/event-stream")

    response = await complete_json_api(db, api_key, payload, "/v1/responses", "responses")

    def response_events():
        yield f"event: response.completed\ndata: {json.dumps(response)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(response_events(), media_type="text/event-stream")


@app.post("/v1/embeddings", dependencies=[Depends(enforce_body_limit)])
async def embeddings(body: EmbeddingsRequest, authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    api_key = authenticate_api_key(db, authorization)
    return await complete_json_api(db, api_key, body.model_dump(exclude_none=True), "/v1/embeddings", "embeddings")


@app.post("/v1/images/generations", dependencies=[Depends(enforce_body_limit)])
async def image_generations(body: ImageGenerationRequest, authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    api_key = authenticate_api_key(db, authorization)
    return await complete_json_api(db, api_key, body.model_dump(exclude_none=True), "/v1/images/generations", "images")


@app.post("/v1/audio/speech", dependencies=[Depends(enforce_body_limit)])
async def audio_speech(body: AudioSpeechRequest, authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    api_key = authenticate_api_key(db, authorization)
    audio, content_type = await complete_binary_api(db, api_key, body.model_dump(exclude_none=True), "/v1/audio/speech", "audio_speech")
    return Response(content=audio, media_type=content_type)


@app.post("/v1/audio/transcriptions", dependencies=[Depends(enforce_body_limit)])
async def audio_transcriptions(
    model: str = Form(...),
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    prompt: str | None = Form(default=None),
    response_format: str | None = Form(default=None),
    temperature: float | None = Form(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    api_key = authenticate_api_key(db, authorization)
    content = await file.read()
    if not content:
        raise compass_error(400, "empty_audio_file", "The audio file is empty.")
    form_data = {key: value for key, value in {"language": language, "prompt": prompt, "response_format": response_format, "temperature": temperature}.items() if value is not None}
    payload = await complete_multipart_api(
        db,
        api_key,
        model,
        form_data,
        (file.filename or "audio.bin", content, file.content_type or "application/octet-stream"),
        "/v1/audio/transcriptions",
        "audio_transcription",
    )
    return payload


@app.post("/v1/batches", dependencies=[Depends(enforce_body_limit)])
async def batches(body: BatchRequest, authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    if body.model is None:
        raise compass_error(400, "batch_model_required", "Compass requires a model for batch routing.")
    api_key = authenticate_api_key(db, authorization)
    request_payload = body.model_dump(exclude_none=True)
    response = await complete_json_api(db, api_key, request_payload, "/v1/batches", "batch")
    provider_batch_id = str(response.get("id")) if response.get("id") else None
    job = BatchJob(
        team_id=api_key.team_id,
        api_key_id=api_key.id,
        provider_batch_id=provider_batch_id,
        model=body.model,
        endpoint=body.endpoint,
        status=str(response.get("status") or "submitted"),
        request_json=json.dumps(request_payload),
        response_json=json.dumps(response),
    )
    db.add(job)
    db.commit()
    return response | {"compass": {**(response.get("compass") or {}), "batch_id": job.id, "batch_status": job.status}}


@app.get("/v1/batches/{batch_id}", dependencies=[Depends(enforce_body_limit)])
def batch_status(batch_id: str, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict:
    api_key = authenticate_api_key(db, authorization)
    job = db.get(BatchJob, batch_id)
    if job is None or job.api_key_id != api_key.id:
        raise compass_error(404, "batch_not_found", "Batch job not found.")
    response = json.loads(job.response_json or "{}")
    response["id"] = job.provider_batch_id or job.id
    response["status"] = job.status
    response["compass"] = {**(response.get("compass") or {}), "batch_id": job.id, "batch_status": job.status}
    return response


@app.post("/v1/batches/{batch_id}/cancel", dependencies=[Depends(enforce_body_limit)])
def cancel_batch(batch_id: str, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict:
    api_key = authenticate_api_key(db, authorization)
    job = db.get(BatchJob, batch_id)
    if job is None or job.api_key_id != api_key.id:
        raise compass_error(404, "batch_not_found", "Batch job not found.")
    if job.status not in {"completed", "failed", "cancelled"}:
        job.status = "cancelled"
        job.completed_at = now()
        db.commit()
    return {"id": job.provider_batch_id or job.id, "status": job.status, "compass": {"batch_id": job.id, "batch_status": job.status}}


@app.get("/usage/requests")
def usage_requests(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(LlmRequest).order_by(LlmRequest.created_at.desc())
    if not is_admin(user):
        team_ids = team_ids_for_user(db, user)
        if not team_ids:
            return []
        stmt = stmt.where(LlmRequest.team_id.in_(team_ids), LlmRequest.user_id == user.id)
    return request_rows(db.scalars(stmt).all())


@app.get("/admin/local-test")
def admin_local_test(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    return {
        "mode": "LOCAL TEST MODE" if settings.local_test_mode else "LIVE PROVIDER MODE",
        "note": "Provider credentials are stored server-side. Test routes are deterministic and do not make real provider calls." if settings.local_test_mode else "Provider credentials are stored server-side. Requests are routed through the configured provider execution path.",
        "providers": provider_credentials_summary(db),
        "models": model_catalog_rows(db),
    }


@app.get("/admin/provider-catalog")
def admin_provider_catalog(_: User = Depends(admin_user)) -> list[dict]:
    return PROVIDER_CATALOG


@app.get("/admin/router/providers")
def admin_router_providers(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    require_platform_permission(db, actor, "providers.view")
    providers = db.scalars(select(Provider).order_by(Provider.name)).all()
    rows = []
    for provider in providers:
        health = db.scalar(select(ProviderHealthCheck).where(ProviderHealthCheck.provider_id == provider.id).order_by(ProviderHealthCheck.last_checked_at.desc()).limit(1))
        rows.append({"id": provider.id, "name": provider.name, "status": provider.status, "commercial_status": provider.commercial_status, "enabled": provider.enabled, "last_health": {"status": health.status, "latency_ms": health.latency_ms, "error_rate": health.error_rate, "checked_at": health.last_checked_at.isoformat()} if health else None})
    return rows


@app.post("/admin/router/providers")
def admin_register_provider(body: ProviderRegisterRequest, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "providers.manage")
    provider_name = body.name.strip().lower()
    provider = db.scalar(select(Provider).where(Provider.name == provider_name))
    if provider is not None:
        return {"id": provider.id, "name": provider.name, "status": provider.status, "commercial_status": provider.commercial_status, "enabled": provider.enabled, "created": False}
    provider = Provider(name=provider_name, protocol=provider_protocol(provider_name), status="unconfigured", enabled=False)
    db.add(provider)
    record_audit_log(db, actor, "provider.registered", f"provider:{provider_name}", {"name": provider_name})
    db.commit()
    return {"id": provider.id, "name": provider.name, "status": provider.status, "commercial_status": provider.commercial_status, "enabled": provider.enabled, "created": True}


@app.patch("/admin/router/providers/{provider_name}")
def admin_update_provider_status(provider_name: str, body: ProviderStatusUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "providers.manage")
    provider = db.scalar(select(Provider).where(Provider.name == provider_name))
    if provider is None:
        raise compass_error(404, "provider_not_found", "Provider was not found.")
    if (body.enabled is True or body.status not in {"disabled", "unavailable"}) and provider.protocol == "unverified":
        raise compass_error(409, "provider_adapter_unavailable", "This provider has no verified Compass adapter.")
    provider.status = body.status
    if body.enabled is not None:
        provider.enabled = body.enabled
    if body.commercial_status is not None:
        provider.commercial_status = body.commercial_status
    record_audit_log(db, actor, "provider.status_updated", f"provider:{provider.name}", {"status": provider.status, "commercial_status": provider.commercial_status, "enabled": provider.enabled})
    db.commit()
    return {"name": provider.name, "status": provider.status, "commercial_status": provider.commercial_status, "enabled": provider.enabled}


@app.patch("/admin/router/models/{model_id:path}")
def admin_update_model_status(model_id: str, body: ModelGovernanceUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "models.manage")
    model = db.get(ModelCatalog, model_id)
    if model is None:
        raise compass_error(404, "model_not_found", "Model was not found.")
    requested_enabled = body.enabled if body.enabled is not None else model.enabled
    requested_published = body.published if body.published is not None else model.published
    if requested_enabled and requested_published:
        provider = model.provider
        credential = db.scalar(
            select(ProviderCredential).where(
                ProviderCredential.provider_id == provider.id,
                ProviderCredential.organization_id.is_(None),
                ProviderCredential.credential_mode == "platform",
                ProviderCredential.status.in_(["active", "local_test"]),
            )
        )
        has_usable_credential = bool(
            credential
            and (
                credential.secret_reference.startswith(("encrypted:", "gcp-secret:"))
                or (settings.local_test_mode and credential.secret_reference.startswith("server-side/"))
            )
        )
        if not has_usable_credential:
            raise compass_error(409, "provider_credential_required", "Configure a usable provider credential before publishing this model.")
        if not settings.local_test_mode and provider.commercial_status != "approved":
            raise compass_error(409, "provider_commercial_approval_required", "Commercial approval is required before publishing this provider model.")
        if provider.protocol == "unverified":
            raise compass_error(409, "provider_adapter_unavailable", "This provider has no verified Compass adapter.")
        if not provider.enabled or provider.status in {"unconfigured", "disabled", "unavailable"}:
            raise compass_error(409, "model_route_unavailable", "Verify and enable the provider before publishing this model.")
    previous_policy = {"status": model.status, "enabled": model.enabled, "published": model.published, "input_price_paise_per_1k": model.input_price_paise_per_1k, "output_price_paise_per_1k": model.output_price_paise_per_1k, "fallback_model_id": model.fallback_model_id}
    model.status = body.status
    if body.enabled is not None:
        model.enabled = body.enabled
    if body.published is not None:
        model.published = body.published
    if body.input_price_paise_per_1k is not None:
        model.input_price_paise_per_1k = body.input_price_paise_per_1k
    if body.output_price_paise_per_1k is not None:
        model.output_price_paise_per_1k = body.output_price_paise_per_1k
    if "fallback_model_id" in body.model_fields_set:
        if body.fallback_model_id == model_id:
            raise compass_error(400, "routing_policy_loop", "A model cannot fall back to itself.")
        if body.fallback_model_id is not None and db.get(ModelCatalog, body.fallback_model_id) is None:
            raise compass_error(404, "fallback_model_not_found", "Fallback model was not found.")
        model.fallback_model_id = body.fallback_model_id
    new_policy = {"status": model.status, "enabled": model.enabled, "published": model.published, "input_price_paise_per_1k": model.input_price_paise_per_1k, "output_price_paise_per_1k": model.output_price_paise_per_1k, "fallback_model_id": model.fallback_model_id}
    if previous_policy["input_price_paise_per_1k"] != new_policy["input_price_paise_per_1k"] or previous_policy["output_price_paise_per_1k"] != new_policy["output_price_paise_per_1k"]:
        db.add(PricingRevision(model_id=model.id, administrator_id=actor.id, previous_policy_json=json.dumps(previous_policy, sort_keys=True), new_policy_json=json.dumps(new_policy, sort_keys=True), change_reason=body.change_reason.strip() or "Model governance update"))
    record_audit_log(db, actor, "model.governance_updated", f"model:{model.id}", {**new_policy, "change_reason": body.change_reason.strip()})
    db.commit()
    return {"id": model.id, "status": model.status, "enabled": model.enabled, "published": model.published, "fallback_model_id": model.fallback_model_id, "input_price_paise_per_1k": model.input_price_paise_per_1k, "output_price_paise_per_1k": model.output_price_paise_per_1k, "provider_status": model.provider.status, "provider_enabled": model.provider.enabled}


@app.post("/admin/provider-credentials")
def admin_save_provider_credential(body: ProviderCredentialUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "providers.manage")
    credential = upsert_provider_api_key(db, body.provider, body.api_key)
    record_audit_log(db, actor, "provider.credential_updated", f"provider:{body.provider}", {"last_four": credential.last_four})
    db.commit()
    return {
        "provider": body.provider,
        "credential_status": credential.status,
        "has_configured_key": True,
        "last_four": credential.last_four,
        "updated_at": credential.updated_at.isoformat(),
    }


@app.post("/admin/provider-credentials/{provider_name}/test")
def admin_test_provider_credential(provider_name: str, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "providers.manage")
    result = test_platform_credential(db, provider_name.strip().lower())
    record_audit_log(db, actor, "provider.credential_tested", f"provider:{result['provider']}", {"status": result["status"]})
    db.commit()
    return result


@app.delete("/admin/provider-credentials/{provider_name}")
def admin_revoke_provider_credential(provider_name: str, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "providers.manage")
    provider = db.scalar(select(Provider).where(Provider.name == provider_name.strip().lower()))
    if provider is None:
        raise compass_error(404, "provider_not_found", "Provider was not found.")
    credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.provider_id == provider.id,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
        )
    )
    if credential is None:
        raise compass_error(404, "provider_credential_not_found", "Provider credential was not found.")
    credential.secret_reference = ""
    credential.status = "revoked"
    credential.last_four = ""
    credential.last_tested_at = None
    credential.updated_at = now()
    _set_local_provider_route(db, provider, live=False)
    record_audit_log(db, actor, "provider.credential_revoked", f"provider:{provider.name}", {})
    db.commit()
    return {"provider": provider.name, "credential_status": credential.status, "has_configured_key": False}


@app.get("/admin/access")
def admin_access(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    return {"user_id": actor.id, "email": actor.email, "roles": sorted(platform_roles(db, actor)), "permissions": sorted(platform_permissions(db, actor))}


@app.post("/admin/bootstrap")
def admin_bootstrap(body: PlatformBootstrapRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    identity = current_clerk_identity(request)
    return bootstrap_platform_owner(db, str(identity.get("sub", "")), body.confirmation, clerk_mfa_verified(identity))


@app.get("/admin/roles")
def admin_roles(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    require_platform_permission(db, actor, "settings.view")
    assignments = db.scalars(select(PlatformRoleAssignment).order_by(PlatformRoleAssignment.created_at.desc())).all()
    users = {user.id: user for user in db.scalars(select(User).where(User.id.in_([assignment.user_id for assignment in assignments]))).all()} if assignments else {}
    return [{"id": assignment.id, "user_id": assignment.user_id, "email": users.get(assignment.user_id).email if users.get(assignment.user_id) else None, "role": assignment.role, "status": assignment.status, "reason": assignment.reason, "granted_by": assignment.granted_by, "revoked_by": assignment.revoked_by, "created_at": assignment.created_at.isoformat(), "revoked_at": assignment.revoked_at.isoformat() if assignment.revoked_at else None} for assignment in assignments]


@app.post("/admin/roles")
def admin_grant_role(body: PlatformRoleGrantRequest, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_super_admin(db, actor)
    return grant_platform_role(db, actor, body.user_id, body.role, body.reason)


@app.post("/admin/roles/{assignment_id}/revoke")
def admin_revoke_role(assignment_id: str, body: PlatformRoleRevokeRequest, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_super_admin(db, actor)
    return revoke_platform_role(db, actor, assignment_id, body.reason)


def _admin_date_filter(value: str | None, field_name: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise compass_error(400, "invalid_date_filter", f"The {field_name} filter must be an ISO-8601 date.") from None
    return parsed.astimezone(UTC).replace(tzinfo=None) if parsed.tzinfo else parsed


def _admin_request_filters(date_from: str | None, date_to: str | None, provider: str | None, model: str | None, organization_id: str | None, project_id: str | None):
    filters = []
    parsed_from = _admin_date_filter(date_from, "date_from")
    parsed_to = _admin_date_filter(date_to, "date_to")
    if parsed_from:
        filters.append(LlmRequest.created_at >= parsed_from)
    if parsed_to:
        filters.append(LlmRequest.created_at < parsed_to)
    if provider:
        filters.append(LlmRequest.provider == provider.strip().lower())
    if model:
        filters.append(LlmRequest.resolved_model == model)
    if organization_id:
        filters.append(LlmRequest.organization_id == organization_id)
    if project_id:
        filters.append(LlmRequest.project_id == project_id)
    return filters


@app.get("/admin/command-center")
def admin_command_center(
    actor: User = Depends(admin_user),
    db: Session = Depends(get_db),
    date_from: str | None = None,
    date_to: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    organization_id: str | None = None,
    project_id: str | None = None,
) -> dict:
    require_platform_permission(db, actor, "admin.view")
    filters = _admin_request_filters(date_from, date_to, provider, model, organization_id, project_id)
    aggregate = db.execute(
        select(
            func.count(LlmRequest.id),
            func.coalesce(func.sum(LlmRequest.input_tokens), 0),
            func.coalesce(func.sum(LlmRequest.output_tokens), 0),
            func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0),
            func.coalesce(func.sum(LlmRequest.provider_cost_paise), 0),
            func.coalesce(func.sum(LlmRequest.latency_ms), 0),
        ).where(*filters)
    ).one()
    total_requests = int(aggregate[0] or 0)
    successful = db.scalar(select(func.count(LlmRequest.id)).where(*filters, LlmRequest.status == "success")) or 0
    failed = db.scalar(select(func.count(LlmRequest.id)).where(*filters, LlmRequest.status == "error")) or 0
    active_customers = db.scalar(
        select(func.count(User.id)).where(
            User.role == "customer",
            ~select(UserAccess.id).where(UserAccess.user_id == User.id, UserAccess.status == "suspended").exists(),
        )
    ) or 0
    wallet_liabilities = db.scalar(select(func.coalesce(func.sum(WalletAccount.balance_paise), 0))) or 0
    failed_settlements = db.scalar(select(func.count(PaymentOrder.id)).where(PaymentOrder.status == "failed")) or 0
    pending_reconciliation = db.scalar(select(func.count(PaymentEvent.id)).where(PaymentEvent.status != "processed")) or 0
    security_alerts = db.scalar(select(func.count(AuditLog.id)).where(AuditLog.action.in_(["platform.role_granted", "platform.role_revoked", "provider.credential_updated", "finance.wallet_adjusted", "user.access_updated"]))) or 0
    average_latency = float(aggregate[5] or 0) / total_requests if total_requests else 0.0
    gross_margin = int(aggregate[3] or 0) - int(aggregate[4] or 0)
    return {
        "filters": {"date_from": date_from, "date_to": date_to, "provider": provider, "model": model, "organization_id": organization_id, "project_id": project_id},
        "customers": {"total": int(db.scalar(select(func.count(User.id)).where(User.role == "customer")) or 0), "active": int(active_customers)},
        "organizations": int(db.scalar(select(func.count(Organization.id))) or 0),
        "active_api_keys": int(db.scalar(select(func.count(ApiKey.id)).where(ApiKey.status == "active")) or 0),
        "requests": {"total": total_requests, "successful": int(successful), "failed": int(failed), "success_rate": (int(successful) / total_requests if total_requests else None)},
        "tokens": {"input": int(aggregate[1] or 0), "output": int(aggregate[2] or 0), "total": int(aggregate[1] or 0) + int(aggregate[2] or 0)},
        "financial": {
            "customer_charges_paise": int(aggregate[3] or 0),
            "provider_cost_paise": int(aggregate[4] or 0),
            "platform_fee_paise": {"value": None, "availability": "not_recorded"},
            "tax_paise": int(db.scalar(select(func.coalesce(func.sum(BillingInvoice.tax_paise), 0))) or 0),
            "refunds_paise": int(db.scalar(select(func.coalesce(func.sum(PaymentRefund.amount_paise), 0))) or 0),
            "payment_processing_cost_paise": {"value": None, "availability": "not_recorded"},
            "gross_margin_estimate_paise": gross_margin,
            "wallet_liabilities_paise": int(wallet_liabilities),
        },
        "latency_ms": {"average": average_latency, "p50": None, "p95": None, "percentiles": "not_available_without_aggregation"},
        "provider_health": {"healthy": int(db.scalar(select(func.count(Provider.id)).where(Provider.enabled.is_(True), Provider.status == "healthy")) or 0), "degraded": int(db.scalar(select(func.count(Provider.id)).where(Provider.status == "degraded")) or 0), "disabled": int(db.scalar(select(func.count(Provider.id)).where(Provider.status == "disabled")) or 0)},
        "failed_settlements": int(failed_settlements),
        "pending_payment_reconciliation": int(pending_reconciliation),
        "security_alerts": int(security_alerts),
        "generated_at": now().isoformat(),
    }


@app.get("/admin/customers")
def admin_customers(page: int = 1, page_size: int = 50, search: str | None = None, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.view")
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    filters = [User.role == "customer"]
    if search:
        filters.append(func.lower(User.email).contains(search.strip().lower()))
    total = int(db.scalar(select(func.count(User.id)).where(*filters)) or 0)
    users = db.scalars(select(User).where(*filters).order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    rows = []
    for user in users:
        access = db.scalar(select(UserAccess).where(UserAccess.user_id == user.id))
        rows.append({"id": user.id, "email": user.email, "clerk_user_id": user.clerk_user_id, "status": access.status if access else "active", "status_reason": access.reason if access else "", "organization_count": int(db.scalar(select(func.count(OrganizationMember.id)).where(OrganizationMember.user_id == user.id)) or 0), "project_count": int(db.scalar(select(func.count(ProjectMember.id)).where(ProjectMember.user_id == user.id)) or 0), "api_key_count": int(db.scalar(select(func.count(ApiKey.id)).where(ApiKey.user_id == user.id)) or 0), "created_at": user.created_at.isoformat()})
    return {"items": rows, "page": page, "page_size": page_size, "total": total}


@app.get("/admin/organizations")
def admin_organizations(page: int = 1, page_size: int = 50, search: str | None = None, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.view")
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    filters = [Organization.name != ""]
    if search:
        filters.append(func.lower(Organization.name).contains(search.strip().lower()))
    total = int(db.scalar(select(func.count(Organization.id)).where(*filters)) or 0)
    organizations = db.scalars(select(Organization).where(*filters).order_by(Organization.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": org.id, "name": org.name, "member_count": int(db.scalar(select(func.count(OrganizationMember.id)).where(OrganizationMember.organization_id == org.id)) or 0), "project_count": int(db.scalar(select(func.count(Project.id)).where(Project.organization_id == org.id)) or 0), "created_at": org.created_at.isoformat()} for org in organizations], "page": page, "page_size": page_size, "total": total}


@app.get("/admin/projects")
def admin_projects(page: int = 1, page_size: int = 50, search: str | None = None, organization_id: str | None = None, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.view")
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    filters = []
    if search:
        filters.append(func.lower(Project.name).contains(search.strip().lower()))
    if organization_id:
        filters.append(Project.organization_id == organization_id)
    total = int(db.scalar(select(func.count(Project.id)).where(*filters)) or 0)
    projects = db.scalars(select(Project).where(*filters).order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": project.id, "organization_id": project.organization_id, "name": project.name, "slug": project.slug, "is_default": project.is_default, "is_active": project.is_active, "member_count": int(db.scalar(select(func.count(ProjectMember.id)).where(ProjectMember.project_id == project.id)) or 0), "created_at": project.created_at.isoformat()} for project in projects], "page": page, "page_size": page_size, "total": total}


@app.get("/admin/api-keys")
def admin_api_keys(page: int = 1, page_size: int = 50, search: str | None = None, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.view")
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    filters = []
    if search:
        filters.append(func.lower(ApiKey.name).contains(search.strip().lower()))
    total = int(db.scalar(select(func.count(ApiKey.id)).where(*filters)) or 0)
    keys = db.scalars(select(ApiKey).where(*filters).order_by(ApiKey.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": key.id, "key_id": key.key_id, "key_prefix": key.key_prefix, "name": key.name, "status": key.status, "user_id": key.user_id, "organization_id": key.organization_id, "project_id": key.project_id, "team_id": key.team_id, "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None, "created_at": key.created_at.isoformat(), "expires_at": key.expires_at.isoformat() if key.expires_at else None} for key in keys], "page": page, "page_size": page_size, "total": total}


@app.get("/admin/requests")
def admin_requests(page: int = 1, page_size: int = 50, date_from: str | None = None, date_to: str | None = None, provider: str | None = None, model: str | None = None, organization_id: str | None = None, project_id: str | None = None, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "operations.view")
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    filters = _admin_request_filters(date_from, date_to, provider, model, organization_id, project_id)
    total = int(db.scalar(select(func.count(LlmRequest.id)).where(*filters)) or 0)
    rows = db.scalars(select(LlmRequest).where(*filters).order_by(LlmRequest.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": row.id, "request_id": row.id, "timestamp": row.created_at.isoformat(), "user_id": row.user_id, "organization_id": row.organization_id, "project_id": row.project_id, "model": row.resolved_model, "requested_model": row.requested_model, "provider": row.provider, "status": row.status, "latency_ms": row.latency_ms, "input_tokens": row.input_tokens, "output_tokens": row.output_tokens, "total_tokens": row.total_tokens, "provider_cost_paise": row.provider_cost_paise, "customer_charge_paise": row.compass_cost_paise, "failure_category": row.error_code, "route": row.route, "credential_mode": row.credential_mode} for row in rows], "page": page, "page_size": page_size, "total": total, "content_policy": "raw prompts and completions are not stored or returned"}


@app.get("/admin/analytics/providers")
def admin_provider_analytics(date_from: str | None = None, date_to: str | None = None, provider: str | None = None, model: str | None = None, organization_id: str | None = None, project_id: str | None = None, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "operations.view")
    filters = _admin_request_filters(date_from, date_to, provider, model, organization_id, project_id)
    return _provider_analytics_rows(db, filters)


def _provider_analytics_rows(db: Session, filters: list) -> dict:
    period = func.date(LlmRequest.created_at).label("period")
    rows = db.execute(
        select(
            period,
            LlmRequest.provider,
            LlmRequest.resolved_model,
            LlmRequest.organization_id,
            LlmRequest.project_id,
            LlmRequest.user_id,
            LlmRequest.member_id,
            LlmRequest.api_key_id,
            LlmRequest.credential_mode,
            LlmRequest.usage_source,
            func.count(LlmRequest.id),
            func.coalesce(func.sum(LlmRequest.input_tokens), 0),
            func.coalesce(func.sum(LlmRequest.output_tokens), 0),
            func.coalesce(func.sum(LlmRequest.provider_cost_paise), 0),
            func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0),
            func.sum(func.cast(LlmRequest.status == "error", Integer)),
        ).where(*filters).group_by(period, LlmRequest.provider, LlmRequest.resolved_model, LlmRequest.organization_id, LlmRequest.project_id, LlmRequest.user_id, LlmRequest.member_id, LlmRequest.api_key_id, LlmRequest.credential_mode, LlmRequest.usage_source).order_by(func.count(LlmRequest.id).desc())
    ).all()
    return {"items": [{"period": str(row[0]) if row[0] is not None else None, "provider": row[1], "model": row[2], "organization_id": row[3], "project_id": row[4], "user_id": row[5], "member_id": row[6], "api_key_id": row[7], "credential_mode": row[8], "usage_source": row[9], "usage_finality": "finalized" if row[9] == "provider" else "estimated" if row[9] == "estimate" else "unavailable", "requests": int(row[10] or 0), "input_tokens": int(row[11] or 0), "output_tokens": int(row[12] or 0), "provider_cost_paise": int(row[13] or 0), "customer_charge_paise": int(row[14] or 0), "failed_requests": int(row[15] or 0)} for row in rows], "total": len(rows), "content_policy": "Metadata only; prompt and response content is not retained."}


@app.get("/organization/analytics/providers")
def organization_provider_analytics(date_from: str | None = None, date_to: str | None = None, provider: str | None = None, model: str | None = None, project_id: str | None = None, actor: User = Depends(organization_admin), db: Session = Depends(get_db)) -> dict:
    organization_ids = list(db.scalars(select(OrganizationMember.organization_id).where(OrganizationMember.user_id == actor.id, OrganizationMember.role.in_(["owner", "admin"]))).all())
    if not organization_ids:
        raise compass_error(403, "organization_not_found", "An organization is required for workspace analytics.")
    filters = _admin_request_filters(date_from, date_to, provider, model, None, project_id)
    filters.append(LlmRequest.organization_id.in_(organization_ids))
    return _provider_analytics_rows(db, filters)


@app.get("/admin/financial/wallets")
def admin_wallets(page: int = 1, page_size: int = 50, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "finance.view")
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    total = int(db.scalar(select(func.count(WalletAccount.id))) or 0)
    wallets = db.scalars(select(WalletAccount).order_by(WalletAccount.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": wallet.id, "team_id": wallet.team_id, "organization_id": wallet.organization_id, "currency": wallet.currency, "available_balance_paise": wallet.balance_paise, "reserved_balance_paise": 0, "status": wallet.status, "updated_at": wallet.updated_at.isoformat()} for wallet in wallets], "page": page, "page_size": page_size, "total": total}


@app.post("/admin/financial/wallet-adjustments")
def admin_wallet_adjustment(body: AdminWalletAdjustmentRequest, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "finance.adjust")
    if abs(body.amount_paise) >= settings.admin_financial_confirmation_threshold_paise:
        if not body.second_approver_user_id or body.second_approver_user_id == actor.id:
            raise compass_error(409, "second_approval_required", "A separate finance-authorized second approver is required for this adjustment.")
        second_approver = db.get(User, body.second_approver_user_id)
        if second_approver is None or not has_platform_permission(db, second_approver, "finance.adjust"):
            raise compass_error(403, "second_approval_invalid", "The second approver is not authorized for financial adjustments.")
    return adjust_wallet(db, actor, body.team_id, body.amount_paise, body.currency, body.reason, body.idempotency_key)


@app.get("/admin/financial/ledger")
def admin_financial_ledger(page: int = 1, page_size: int = 100, team_id: str | None = None, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "finance.view")
    page = max(1, page)
    page_size = max(1, min(page_size, 200))
    wallet_ids = select(WalletAccount.id)
    if team_id:
        wallet_ids = wallet_ids.where(WalletAccount.team_id == team_id)
    filters = [WalletLedger.wallet_id.in_(wallet_ids)]
    total = int(db.scalar(select(func.count(WalletLedger.id)).where(*filters)) or 0)
    rows = db.scalars(select(WalletLedger).where(*filters).order_by(WalletLedger.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": row.id, "wallet_id": row.wallet_id, "type": row.type, "amount_paise": row.amount_paise, "balance_before": row.balance_before, "balance_after": row.balance_after, "reference_type": row.reference_type, "reference_id": row.reference_id, "description": row.description, "idempotency_key": row.idempotency_key, "created_at": row.created_at.isoformat()} for row in rows], "page": page, "page_size": page_size, "total": total}


@app.get("/admin/settings")
def admin_settings(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "settings.view")
    return {"items": platform_settings_rows(db), "deployment_managed": ["CLERK_SECRET_KEY", "RAZORPAY_KEY_SECRET", "LITELLM_MASTER_KEY", "DATABASE_URL", "REDIS_URL", "SMTP_PASSWORD"]}


@app.patch("/admin/settings")
def admin_update_settings(body: PlatformSettingsUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "settings.manage")
    return {"items": update_platform_settings(db, actor, body.values)}


@app.get("/admin/security/events")
def admin_security_events(page: int = 1, page_size: int = 100, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "security.view")
    page = max(1, page)
    page_size = max(1, min(page_size, 200))
    actions = ["platform.role_granted", "platform.role_revoked", "provider.credential_updated", "provider.credential_revoked", "finance.wallet_adjusted", "user.access_updated", "user.sessions_revoked", "api_key.revoked"]
    total = int(db.scalar(select(func.count(AuditLog.id)).where(AuditLog.action.in_(actions))) or 0)
    rows = db.scalars(select(AuditLog).where(AuditLog.action.in_(actions)).order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": row.id, "actor_user_id": row.actor_user_id, "action": row.action, "target": row.target, "request_id": row.request_id, "metadata": json.loads(row.metadata_json or "{}"), "created_at": row.created_at.isoformat()} for row in rows], "page": page, "page_size": page_size, "total": total}


@app.get("/admin/overview")
def admin_overview(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "admin.view")
    return {"users": db.query(User).count(), "teams": db.query(Team).count(), "requests": db.query(LlmRequest).count(), "status": "operational"}


@app.get("/admin/users")
def admin_users(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    require_platform_permission(db, actor, "customers.view")
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    team_counts = dict(
        db.execute(
            select(func.lower(TeamMember.email), func.count(TeamMember.id))
            .where(TeamMember.is_active.is_(True))
            .group_by(func.lower(TeamMember.email))
        ).all()
    )
    workspace_counts = dict(
        db.execute(
            select(OrganizationMember.user_id, func.count(OrganizationMember.id))
            .group_by(OrganizationMember.user_id)
        ).all()
    )
    access_rows = {row.user_id: row for row in db.scalars(select(UserAccess)).all()}
    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "status": access_rows.get(user.id).status if access_rows.get(user.id) else "active",
            "status_reason": access_rows.get(user.id).reason if access_rows.get(user.id) else "",
            "team_count": int(team_counts.get(user.email.lower(), 0)),
            "workspace_count": int(workspace_counts.get(user.id, 0)),
            "created_at": user.created_at.isoformat(),
        }
        for user in users
    ]


@app.patch("/admin/users/{user_id}/role")
def admin_update_user_role(user_id: str, body: UserRoleUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.manage")
    target = db.get(User, user_id)
    if target is None:
        raise compass_error(404, "user_not_found", "User was not found.")
    if target.id == actor.id and body.role != target.role:
        raise compass_error(400, "cannot_change_own_role", "You cannot change your own owner role from this session.")
    if (target.role == "super_admin" or body.role == "super_admin") and actor.role != "super_admin":
        raise compass_error(403, "owner_required", "Only the product owner can manage super-admin roles.")
    previous_role = target.role
    target.role = body.role
    target.session_version += 1
    record_audit_log(db, actor, "user.role_updated", f"user:{target.id}", {"email": target.email, "from": previous_role, "to": target.role})
    db.commit()
    return {"id": target.id, "email": target.email, "role": target.role, "status": "active"}


@app.patch("/admin/users/{user_id}/status")
def admin_update_user_status(user_id: str, body: UserAccessUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.manage")
    target = db.get(User, user_id)
    if target is None:
        raise compass_error(404, "user_not_found", "User was not found.")
    if target.id == actor.id and body.status == "suspended":
        raise compass_error(400, "cannot_suspend_self", "You cannot suspend the product owner session.")
    access = db.scalar(select(UserAccess).where(UserAccess.user_id == target.id))
    if access is None:
        access = UserAccess(user_id=target.id)
        db.add(access)
    access.status = body.status
    access.reason = body.reason.strip()
    access.updated_by = actor.id
    access.updated_at = now()
    target.session_version += 1
    if body.status == "suspended":
        revoke_extension_sessions_for_user(db, target.id)
    record_audit_log(db, actor, "user.access_updated", f"user:{target.id}", {"email": target.email, "status": body.status, "reason": access.reason})
    db.commit()
    return {"id": target.id, "email": target.email, "status": access.status, "reason": access.reason}


@app.post("/admin/users/{user_id}/revoke-sessions")
def admin_revoke_user_sessions(user_id: str, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "customers.manage")
    target = db.get(User, user_id)
    if target is None:
        raise compass_error(404, "user_not_found", "User was not found.")
    target.session_version += 1
    revoke_extension_sessions_for_user(db, target.id)
    record_audit_log(db, actor, "user.sessions_revoked", f"user:{target.id}", {"email": target.email})
    db.commit()
    return {"id": target.id, "email": target.email, "sessions_revoked": True}


@app.get("/admin/platform")
def admin_platform(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "settings.view")
    configured_credentials = db.scalar(select(func.count(ProviderCredential.id)).where(ProviderCredential.status == "active")) or 0
    return {
        "environment": settings.environment,
        "execution_mode": "local_test" if settings.local_test_mode else settings.provider_execution_mode,
        "local_test_mode": settings.local_test_mode,
        "public_signup_enabled": settings.public_signup_enabled,
        "billing_payment_mode": settings.billing_payment_mode,
        "secret_manager_enabled": settings.secret_manager_enabled,
        "provider_execution_mode": settings.provider_execution_mode,
        "provider_max_attempts": settings.provider_max_attempts,
        "litellm_timeout_seconds": settings.litellm_timeout_seconds,
        "configured_provider_credentials": int(configured_credentials),
        "sso_configured": bool(settings.compass_sso_secret),
        "razorpay_configured": bool(settings.razorpay_key_id and settings.razorpay_key_secret and settings.razorpay_webhook_secret),
        "database_dialect": db.bind.dialect.name if db.bind else "unknown",
    }


@app.get("/admin/live-readiness")
async def admin_live_readiness(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "operations.view")
    credentials = db.scalars(
        select(ProviderCredential).where(
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
            ProviderCredential.status == "active",
        )
    ).all()
    usable_credentials = sum(1 for row in credentials if row.secret_reference.startswith(("encrypted:", "gcp-secret:")))
    enabled_providers = db.scalar(select(func.count(Provider.id)).where(Provider.enabled.is_(True), Provider.status.not_in(["disabled", "unavailable", "unconfigured"]))) or 0
    commercially_approved_providers = db.scalar(select(func.count(Provider.id)).where(Provider.enabled.is_(True), Provider.status.not_in(["disabled", "unavailable", "unconfigured"]), Provider.commercial_status == "approved")) or 0
    published_models = db.scalar(
        select(func.count(ModelCatalog.id))
        .join(Provider, Provider.id == ModelCatalog.provider_id)
        .where(
            ModelCatalog.enabled.is_(True),
            ModelCatalog.published.is_(True),
            ModelCatalog.status == "available",
            Provider.enabled.is_(True),
            Provider.status.not_in(["disabled", "unavailable"]),
            Provider.commercial_status == "approved" if not settings.local_test_mode else True,
        )
    ) or 0
    blockers: list[str] = []
    payment_mode = settings.billing_payment_mode.strip().lower()
    execution_mode = settings.provider_execution_mode.strip().lower()
    checks = {
        "local_test_mode": not settings.local_test_mode,
        "billing_payment_mode": payment_mode == "razorpay",
        "secret_manager": settings.secret_manager_enabled,
        "provider_credentials": usable_credentials > 0,
        "enabled_providers": enabled_providers > 0,
        "commercial_approval": settings.local_test_mode or commercially_approved_providers > 0,
        "published_models": published_models > 0,
    }
    if settings.local_test_mode:
        blockers.append("LOCAL_TEST_MODE is enabled")
    if payment_mode != "razorpay":
        blockers.append("Billing payment mode is not razorpay")
    if not settings.secret_manager_enabled:
        blockers.append("Secret Manager is disabled")
    if usable_credentials == 0:
        blockers.append("No active provider credential is configured")
    if enabled_providers == 0:
        blockers.append("No enabled provider route is available")
    if not settings.local_test_mode and commercially_approved_providers == 0:
        blockers.append("No enabled provider has commercial approval")
    if published_models == 0:
        blockers.append("No published model is available")
    if execution_mode == "direct":
        checks["litellm"] = True
    else:
        try:
            litellm = await LiteLLMClient().health_check()
            checks["litellm"] = str(litellm.get("status", "ok")).lower() in {"ok", "ready", "healthy"}
        except Exception:
            checks["litellm"] = False
            blockers.append("LiteLLM health check failed")
    return {
        "ready": not blockers,
        "blockers": blockers,
        "checks": checks,
        "configured_provider_credentials": usable_credentials,
        "enabled_providers": int(enabled_providers),
        "commercially_approved_providers": int(commercially_approved_providers),
        "published_models": int(published_models),
        "generated_at": now().isoformat(),
    }


@app.get("/admin/audit")
def admin_audit(actor: User = Depends(admin_user), db: Session = Depends(get_db), limit: int = 100) -> list[dict]:
    require_platform_permission(db, actor, "security.view")
    safe_limit = max(1, min(limit, 200))
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(safe_limit)).all()
    return [
        {
            "id": row.id,
            "actor_user_id": row.actor_user_id,
            "action": row.action,
            "target": row.target,
            "request_id": row.request_id,
            "metadata": json.loads(row.metadata_json or "{}"),
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@app.get("/admin/operations/metrics")
def admin_operations_metrics(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    require_platform_permission(db, actor, "operations.view")
    request_count = int(db.scalar(select(func.count(LlmRequest.id))) or 0)
    successful_count = int(db.scalar(select(func.count(LlmRequest.id)).where(LlmRequest.status == "success")) or 0)
    failed_count = int(db.scalar(select(func.count(LlmRequest.id)).where(LlmRequest.status == "error")) or 0)
    attempt_count = int(db.scalar(select(func.count(ProviderHealthCheck.id))) or 0)
    open_circuits = int(db.scalar(select(func.count(ProviderHealthCheck.id)).where(ProviderHealthCheck.status == "circuit_open")) or 0)
    failed_orders = db.scalar(select(func.count(PaymentOrder.id)).where(PaymentOrder.status == "failed")) or 0
    pending_refunds = db.scalar(select(func.count(PaymentRefund.id)).where(PaymentRefund.status.in_(["requested", "pending"]))) or 0
    return {
        "status": "operational",
        "requests": {"total": request_count, "successful": successful_count, "failed": failed_count},
        "provider_health": {"checks": attempt_count, "open_circuits": open_circuits},
        "billing": {"failed_orders": int(failed_orders), "pending_refunds": int(pending_refunds)},
        "alerts": [
            "provider_circuit_open" if open_circuits else None,
            "payment_failures" if failed_orders else None,
            "refunds_pending" if pending_refunds else None,
        ],
        "generated_at": now().isoformat(),
    }


@app.get("/admin/operations/events")
def admin_operations_events(actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    require_platform_permission(db, actor, "operations.view")
    events = db.scalars(select(OperationalEvent).order_by(OperationalEvent.created_at.desc()).limit(100)).all()
    return [{"id": event.id, "event_type": event.event_type, "severity": event.severity, "service": event.service, "message": event.message, "metadata": json.loads(event.metadata_json or "{}"), "created_at": event.created_at.isoformat()} for event in events]
