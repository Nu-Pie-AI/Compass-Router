import hashlib
import hmac
import json
import re
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
import httpx
from jose import JWTError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import get_settings, validate_runtime_config
from .db import get_db, init_db
from .errors import compass_error
from .models import ApiKey, AuditLog, BatchJob, BillingInvoice, LoginAttempt, LlmRequest, ModelCatalog, ModelPolicy, OperationalEvent, Organization, OrganizationMember, PaymentEvent, PaymentOrder, PaymentRefund, Provider, ProviderCredential, ProviderHealthCheck, RoutingPolicy, Team, TeamLimit, TeamMember, User, UserAccess, WalletAccount, WalletLedger, new_id, now
from .schemas import ApiKeyCreate, ApiKeyModelsUpdate, AudioSpeechRequest, BatchRequest, BillingOrderComplete, BillingOrderCreate, BillingOrderVerify, BillingRefundCreate, ByokCredentialUpdate, ChatCompletionRequest, EmbeddingsRequest, ImageGenerationRequest, LoginRequest, MarketplaceSsoRequest, ModelActivationRequest, ModelGovernanceUpdate, ModelPolicyUpdate, ProviderCredentialUpdate, ProviderRegisterRequest, ProviderStatusUpdate, ResponsesRequest, RoutingPolicyUpdate, SessionResponse, SignupRequest, TeamCreate, TeamLimitsUpdate, TeamMemberCreate, TeamStatusUpdate, UserAccessUpdate, UserRoleUpdate, WalletTopupRequest, WorkspaceCreate
from .security import create_session_token, decode_marketplace_sso_token, decode_session_claims, verify_password
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
    create_team,
    create_team_member,
    credit_wallet,
    dashboard_summary,
    credential_provider_names,
    litellm_model_catalog,
    list_api_keys,
    model_catalog_rows,
    model_policy_rows,
    organization_id_for_user,
    provider_credentials_summary,
    record_audit_log,
    request_id_context,
    request_rows,
    revoke_byok_api_key,
    revoke_api_key,
    test_platform_credential,
    update_api_key_models,
    register_customer,
    seed_defaults,
    select_user_by_email,
    stream_openai_chunks,
    _set_local_provider_route,
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
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
    finally:
        request_id_context.reset(token)


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


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise compass_error(401, "unauthorized", "Missing session token.")
    try:
        claims = decode_session_claims(authorization.removeprefix("Bearer ").strip())
        user_id = str(claims["sub"])
    except (JWTError, ValueError, KeyError):
        raise compass_error(401, "unauthorized", "Invalid session token.") from None
    user = db.get(User, user_id)
    if user is None or int(claims.get("sv", 0)) != user.session_version:
        raise compass_error(401, "unauthorized", "Invalid session token.")
    access = db.scalar(select(UserAccess).where(UserAccess.user_id == user.id))
    if access is not None and access.status != "active":
        raise compass_error(403, "account_suspended", "This account has been suspended by the product owner.")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "super_admin"}:
        raise compass_error(403, "admin_required", "Admin authorization is required.")
    return user


def is_admin(user: User) -> bool:
    return user.role in {"admin", "super_admin"}


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


def team_ids_for_user(db: Session, user: User) -> list[str]:
    if is_admin(user):
        return list(db.scalars(select(Team.id)).all())
    return list(
        db.scalars(
            select(TeamMember.team_id).where(
                func.lower(TeamMember.email) == user.email.lower(),
                TeamMember.is_active.is_(True),
            )
        ).all()
    )


def workspace_ids_for_user(db: Session, user: User) -> list[str]:
    if is_admin(user):
        return list(db.scalars(select(Organization.id)).all())
    return list(db.scalars(select(OrganizationMember.organization_id).where(OrganizationMember.user_id == user.id)).all())


def require_workspace_access(db: Session, user: User, workspace_id: str) -> None:
    if workspace_id not in workspace_ids_for_user(db, user):
        raise compass_error(403, "workspace_access_denied", "You do not have access to this workspace.")


def require_team_access(db: Session, user: User, team_id: str) -> None:
    if team_id not in team_ids_for_user(db, user):
        raise compass_error(403, "team_access_denied", "You do not have access to this team.")


def require_team_owner(db: Session, user: User, team_id: str) -> None:
    if is_admin(user):
        return
    membership = db.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            func.lower(TeamMember.email) == user.email.lower(),
            TeamMember.is_active.is_(True),
            TeamMember.role.in_(["owner", "admin"]),
        )
    )
    if membership is None:
        raise compass_error(403, "team_owner_required", "A team owner or administrator is required.")


def team_rows(db: Session, team_ids: list[str]) -> list[dict]:
    if not team_ids:
        return []
    teams = db.scalars(select(Team).where(Team.id.in_(team_ids)).order_by(Team.created_at.desc())).all()
    return [{"id": team.id, "workspace_id": team.organization_id, "name": team.name, "slug": team.slug, "notes": team.notes, "is_active": team.is_active, "created_at": team.created_at.isoformat()} for team in teams]


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
    return SessionResponse(
        token=create_session_token(user.id, user.session_version),
        user_id=user.id,
        email=user.email,
        organization_id=organization.id,
        role=user.role,
    )


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
    return SessionResponse(
        token=create_session_token(user.id, user.session_version),
        user_id=user.id,
        email=user.email,
        organization_id=organization_id_for_user(db, user.id),
        role=user.role,
    )


@app.post("/auth/logout")
def logout(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    user.session_version += 1
    db.commit()
    return {"signed_out": True}


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
    team = create_team(db, body.name, body.slug, body.notes, workspace_id)
    create_team_member(db, team.id, user.email, user.email, "owner")
    return {"id": team.id, "workspace_id": team.organization_id, "name": team.name, "slug": team.slug, "is_active": team.is_active}


@app.get("/admin/teams")
def admin_teams(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    teams = db.scalars(select(Team).order_by(Team.created_at.desc())).all()
    return [{"id": team.id, "name": team.name, "slug": team.slug, "notes": team.notes, "is_active": team.is_active, "created_at": team.created_at.isoformat()} for team in teams]


@app.patch("/admin/teams/{team_id}/status")
def admin_update_team_status(team_id: str, body: TeamStatusUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
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
    team = create_team(db, body.name, body.slug, body.notes, body.workspace_id)
    record_audit_log(db, actor, "team.created", f"team:{team.id}", {"name": team.name, "slug": team.slug, "workspace_id": team.organization_id})
    db.commit()
    return {"id": team.id, "workspace_id": team.organization_id, "name": team.name, "slug": team.slug, "is_active": team.is_active}


@app.post("/admin/teams/{team_id}/members")
def admin_create_member(team_id: str, body: TeamMemberCreate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    member = create_team_member(db, team_id, body.name, body.email.lower(), body.role)
    record_audit_log(db, actor, "team.member_added", f"team:{team_id}", {"member_id": member.id, "email": member.email, "role": member.role})
    db.commit()
    return {"id": member.id, "team_id": member.team_id, "name": member.name, "email": member.email, "role": member.role, "is_active": member.is_active}


@app.get("/admin/teams/{team_id}/members")
def admin_members(team_id: str, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(TeamMember).where(TeamMember.team_id == team_id).order_by(TeamMember.created_at.desc())).all()
    return [{"id": row.id, "team_id": row.team_id, "name": row.name, "email": row.email, "role": row.role, "is_active": row.is_active} for row in rows]


@app.post("/admin/api-keys")
def admin_create_key(body: ApiKeyCreate, user: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    result = create_api_key(db, user.id, body.team_id, body.member_id, body.name, body.allowed_models, body.expires_at)
    record_audit_log(db, user, "api_key.created", f"team:{body.team_id}", {"name": body.name, "key_id": result.get("id")})
    db.commit()
    return result


@app.post("/api-keys")
def create_key(body: ApiKeyCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_access(db, user, body.team_id)
    member_id = body.member_id
    if not is_admin(user):
        member = db.scalar(
            select(TeamMember).where(
                TeamMember.team_id == body.team_id,
                func.lower(TeamMember.email) == user.email.lower(),
                TeamMember.is_active.is_(True),
            )
        )
        if member is None:
            raise compass_error(403, "team_membership_required", "An active team membership is required.")
        member_id = member.id
    return create_api_key(db, user.id, body.team_id, member_id, body.name, body.allowed_models, body.expires_at)


@app.get("/api-keys")
def list_keys(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    if is_admin(user):
        return list_api_keys(db)
    return list_api_keys(db, team_ids=team_ids_for_user(db, user), user_id=user.id)


@app.post("/api-keys/{api_key_id}/revoke")
def revoke_key(api_key_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    key_record = db.get(ApiKey, api_key_id)
    if key_record is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    if not is_admin(user):
        if key_record.user_id != user.id or not key_record.team_id:
            raise compass_error(403, "api_key_access_denied", "You cannot revoke this API key.")
        require_team_access(db, user, key_record.team_id)
    key = revoke_api_key(db, api_key_id)
    if is_admin(user):
        record_audit_log(db, user, "api_key.revoked", f"api_key:{key.id}", {"team_id": key.team_id, "key_id": key.key_id})
        db.commit()
    return {"id": key.id, "status": key.status, "revoked_at": key.revoked_at.isoformat() if key.revoked_at else None}


@app.patch("/api-keys/{api_key_id}/models")
def update_key_models(api_key_id: str, body: ApiKeyModelsUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    key = db.get(ApiKey, api_key_id)
    if key is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    if not is_admin(user):
        if key.user_id != user.id or not key.team_id:
            raise compass_error(403, "api_key_access_denied", "You cannot update this API key.")
        require_team_access(db, user, key.team_id)
    return update_api_key_models(db, api_key_id, body.allowed_models)


@app.post("/admin/wallet/topups")
def admin_topup(body: WalletTopupRequest, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    ledger = credit_wallet(db, body.team_id, body.amount_paise, body.idempotency_key, body.idempotency_key)
    record_audit_log(db, actor, "wallet.topup_created", f"team:{body.team_id}", {"amount_paise": body.amount_paise, "ledger_id": ledger.id})
    db.commit()
    return {"ledger_id": ledger.id, "team_id": body.team_id, "balance_paise": ledger.balance_after}


@app.get("/wallet")
def wallet(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    require_team_access(db, user, team_id)
    account = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id))
    if account is None:
        raise compass_error(404, "wallet_not_found", "Wallet not found.")
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
        raise compass_error(404, "wallet_not_found", "Wallet not found.")
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
            description="Wallet recharge completed through payment provider",
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
        raise compass_error(404, "wallet_not_found", "Wallet or payment order not found.")
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
            description="Wallet recharge refund processed",
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
def billing_reconciliation(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
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
async def admin_discover_models(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    return await litellm_model_catalog(db, force=True)


@app.get("/catalog/models")
async def catalog_models(team_id: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    if team_id:
        require_team_access(db, user, team_id)
    result = await litellm_model_catalog(db)
    available_providers = credential_provider_names(db, team_id) if team_id else set()
    result["models"] = [row | {"credential_available": row["provider"] in available_providers} for row in result["models"]]
    return result


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
def admin_router_models(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    return model_catalog_rows(db, include_unpublished=True)


@app.get("/admin/router/policies")
def admin_router_policies(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(RoutingPolicy).order_by(RoutingPolicy.alias)).all()
    return [{"id": row.id, "alias": row.alias, "candidate_models": [item for item in row.candidate_models.split(",") if item], "enabled": row.enabled} for row in rows]


@app.put("/admin/router/policies/{alias}")
def admin_upsert_router_policy(alias: str, body: RoutingPolicyUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
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
        policy.candidate_models = ",".join(body.candidate_models)
    policy.enabled = body.enabled
    record_audit_log(db, actor, "router.policy_updated", f"routing:{alias}", {"candidate_models": body.candidate_models, "enabled": body.enabled})
    db.commit()
    return {"id": policy.id, "alias": policy.alias, "candidate_models": body.candidate_models, "enabled": policy.enabled}


@app.delete("/admin/router/policies/{alias}")
def admin_delete_router_policy(alias: str, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    policy = db.scalar(select(RoutingPolicy).where(RoutingPolicy.alias == alias))
    if policy is None:
        raise compass_error(404, "routing_policy_not_found", "Routing policy was not found.")
    db.delete(policy)
    record_audit_log(db, actor, "router.policy_deleted", f"routing:{alias}")
    db.commit()
    return {"alias": alias, "deleted": True}


@app.get("/byok/credentials")
def list_byok_credentials(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    require_team_access(db, user, team_id)
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
        "providers": [{"name": provider.name, "status": provider.status, "enabled": provider.enabled} for provider in provider_rows],
        "models": models,
        "api_key": {"id": key.id, "rate_limit": key.rate_limit, "daily_limit_paise": key.daily_limit, "monthly_limit_paise": key.monthly_limit},
    }


@app.post("/v1/chat/completions", dependencies=[Depends(enforce_body_limit)])
async def chat_completions(body: ChatCompletionRequest, authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    api_key = authenticate_api_key(db, authorization)
    payload = body.model_dump()
    if body.stream:
        full_response = await complete_chat(db, api_key, payload | {"stream": False})
        return StreamingResponse(stream_openai_chunks(full_response), media_type="text/event-stream")
    return await complete_chat(db, api_key, payload)


@app.post("/v1/responses", dependencies=[Depends(enforce_body_limit)])
async def responses(body: ResponsesRequest, authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    api_key = authenticate_api_key(db, authorization)
    response = await complete_json_api(db, api_key, body.model_dump(exclude_none=True), "/v1/responses", "responses")
    if not body.stream:
        return response

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
    audio, content_type = await complete_binary_api(db, api_key, body.model_dump(exclude_none=True), "/v1/audio/speech", "audio")
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
        "audio",
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
def admin_router_providers(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    providers = db.scalars(select(Provider).order_by(Provider.name)).all()
    rows = []
    for provider in providers:
        health = db.scalar(select(ProviderHealthCheck).where(ProviderHealthCheck.provider_id == provider.id).order_by(ProviderHealthCheck.last_checked_at.desc()).limit(1))
        rows.append({"id": provider.id, "name": provider.name, "status": provider.status, "enabled": provider.enabled, "last_health": {"status": health.status, "latency_ms": health.latency_ms, "error_rate": health.error_rate, "checked_at": health.last_checked_at.isoformat()} if health else None})
    return rows


@app.post("/admin/router/providers")
def admin_register_provider(body: ProviderRegisterRequest, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    provider_name = body.name.strip().lower()
    provider = db.scalar(select(Provider).where(Provider.name == provider_name))
    if provider is not None:
        return {"id": provider.id, "name": provider.name, "status": provider.status, "enabled": provider.enabled, "created": False}
    provider = Provider(name=provider_name, status="healthy", enabled=True)
    db.add(provider)
    record_audit_log(db, actor, "provider.registered", f"provider:{provider_name}", {"name": provider_name})
    db.commit()
    return {"id": provider.id, "name": provider.name, "status": provider.status, "enabled": provider.enabled, "created": True}


@app.patch("/admin/router/providers/{provider_name}")
def admin_update_provider_status(provider_name: str, body: ProviderStatusUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    provider = db.scalar(select(Provider).where(Provider.name == provider_name))
    if provider is None:
        raise compass_error(404, "provider_not_found", "Provider was not found.")
    provider.status = body.status
    if body.enabled is not None:
        provider.enabled = body.enabled
    record_audit_log(db, actor, "provider.status_updated", f"provider:{provider.name}", {"status": provider.status, "enabled": provider.enabled})
    db.commit()
    return {"name": provider.name, "status": provider.status, "enabled": provider.enabled}


@app.patch("/admin/router/models/{model_id:path}")
def admin_update_model_status(model_id: str, body: ModelGovernanceUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    model = db.get(ModelCatalog, model_id)
    if model is None:
        raise compass_error(404, "model_not_found", "Model was not found.")
    requested_enabled = body.enabled if body.enabled is not None else model.enabled
    requested_published = body.published if body.published is not None else model.published
    if requested_enabled and requested_published:
        provider = model.provider
        if not provider.enabled or provider.status in {"disabled", "unavailable"}:
            raise compass_error(409, "model_route_unavailable", "Enable and restore the provider before publishing this model.")
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
    record_audit_log(db, actor, "model.governance_updated", f"model:{model.id}", {"status": model.status, "enabled": model.enabled, "published": model.published, "fallback_model_id": model.fallback_model_id, "input_price_paise_per_1k": model.input_price_paise_per_1k, "output_price_paise_per_1k": model.output_price_paise_per_1k})
    db.commit()
    return {"id": model.id, "status": model.status, "enabled": model.enabled, "published": model.published, "fallback_model_id": model.fallback_model_id, "input_price_paise_per_1k": model.input_price_paise_per_1k, "output_price_paise_per_1k": model.output_price_paise_per_1k, "provider_status": model.provider.status, "provider_enabled": model.provider.enabled}


@app.post("/admin/provider-credentials")
def admin_save_provider_credential(body: ProviderCredentialUpdate, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
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
    result = test_platform_credential(db, provider_name.strip().lower())
    record_audit_log(db, actor, "provider.credential_tested", f"provider:{result['provider']}", {"status": result["status"]})
    db.commit()
    return result


@app.delete("/admin/provider-credentials/{provider_name}")
def admin_revoke_provider_credential(provider_name: str, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
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


@app.get("/admin/overview")
def admin_overview(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    return {"users": db.query(User).count(), "teams": db.query(Team).count(), "requests": db.query(LlmRequest).count(), "status": "operational"}


@app.get("/admin/users")
def admin_users(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
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
    record_audit_log(db, actor, "user.access_updated", f"user:{target.id}", {"email": target.email, "status": body.status, "reason": access.reason})
    db.commit()
    return {"id": target.id, "email": target.email, "status": access.status, "reason": access.reason}


@app.post("/admin/users/{user_id}/revoke-sessions")
def admin_revoke_user_sessions(user_id: str, actor: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    target = db.get(User, user_id)
    if target is None:
        raise compass_error(404, "user_not_found", "User was not found.")
    target.session_version += 1
    record_audit_log(db, actor, "user.sessions_revoked", f"user:{target.id}", {"email": target.email})
    db.commit()
    return {"id": target.id, "email": target.email, "sessions_revoked": True}


@app.get("/admin/platform")
def admin_platform(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
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
async def admin_live_readiness(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    credentials = db.scalars(
        select(ProviderCredential).where(
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
            ProviderCredential.status == "active",
        )
    ).all()
    usable_credentials = sum(1 for row in credentials if row.secret_reference.startswith(("encrypted:", "gcp-secret:")))
    enabled_providers = db.scalar(select(func.count(Provider.id)).where(Provider.enabled.is_(True), Provider.status != "disabled")) or 0
    published_models = db.scalar(
        select(func.count(ModelCatalog.id))
        .join(Provider, Provider.id == ModelCatalog.provider_id)
        .where(
            ModelCatalog.enabled.is_(True),
            ModelCatalog.published.is_(True),
            ModelCatalog.status == "available",
            Provider.enabled.is_(True),
            Provider.status.not_in(["disabled", "unavailable"]),
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
        "published_models": int(published_models),
        "generated_at": now().isoformat(),
    }


@app.get("/admin/audit")
def admin_audit(_: User = Depends(admin_user), db: Session = Depends(get_db), limit: int = 100) -> list[dict]:
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
def admin_operations_metrics(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    requests = db.scalars(select(LlmRequest)).all()
    attempts = db.scalars(select(ProviderHealthCheck)).all()
    failed_orders = db.scalar(select(func.count(PaymentOrder.id)).where(PaymentOrder.status == "failed")) or 0
    pending_refunds = db.scalar(select(func.count(PaymentRefund.id)).where(PaymentRefund.status.in_(["requested", "pending"]))) or 0
    return {
        "status": "operational",
        "requests": {"total": len(requests), "successful": sum(1 for row in requests if row.status == "success"), "failed": sum(1 for row in requests if row.status == "error")},
        "provider_health": {"checks": len(attempts), "open_circuits": sum(1 for row in attempts if row.status == "circuit_open")},
        "billing": {"failed_orders": int(failed_orders), "pending_refunds": int(pending_refunds)},
        "alerts": [
            "provider_circuit_open" if any(row.status == "circuit_open" for row in attempts) else None,
            "payment_failures" if failed_orders else None,
            "refunds_pending" if pending_refunds else None,
        ],
        "generated_at": now().isoformat(),
    }


@app.get("/admin/operations/events")
def admin_operations_events(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    events = db.scalars(select(OperationalEvent).order_by(OperationalEvent.created_at.desc()).limit(100)).all()
    return [{"id": event.id, "event_type": event.event_type, "severity": event.severity, "service": event.service, "message": event.message, "metadata": json.loads(event.metadata_json or "{}"), "created_at": event.created_at.isoformat()} for event in events]
