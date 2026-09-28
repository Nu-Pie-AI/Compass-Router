import hashlib
import hmac
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
from jose import JWTError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db, init_db
from .errors import compass_error
from .models import ApiKey, LlmRequest, ModelCatalog, Organization, OrganizationMember, PaymentOrder, Provider, ProviderCredential, ProviderHealthCheck, Team, TeamMember, User, WalletAccount, WalletLedger, new_id, now
from .schemas import ApiKeyCreate, ApiKeyModelsUpdate, BillingOrderComplete, BillingOrderCreate, BillingOrderVerify, ByokCredentialUpdate, ChatCompletionRequest, LoginRequest, MarketplaceSsoRequest, ModelActivationRequest, ModelStatusUpdate, ProviderCredentialUpdate, ProviderStatusUpdate, SessionResponse, SignupRequest, TeamCreate, TeamMemberCreate, WalletTopupRequest, WorkspaceCreate
from .security import create_session_token, decode_marketplace_sso_token, decode_session_token, verify_password
from .services import (
    LiteLLMClient,
    allowed_model_ids,
    api_key_models_restricted,
    authenticate_api_key,
    activate_catalog_model,
    byok_credentials_summary,
    check_redis,
    complete_chat,
    create_api_key,
    create_team,
    create_team_member,
    credit_wallet,
    dashboard_summary,
    credential_provider_names,
    litellm_model_catalog,
    list_api_keys,
    model_catalog_rows,
    organization_id_for_user,
    provider_credentials_summary,
    request_rows,
    revoke_byok_api_key,
    revoke_api_key,
    update_api_key_models,
    register_customer,
    seed_defaults,
    select_user_by_email,
    stream_openai_chunks,
    upsert_marketplace_user,
    upsert_byok_api_key,
    upsert_provider_api_key,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": {"error": {"code": "invalid_request", "message": "Request validation failed.", "type": "compass_error", "fields": exc.errors()}}})


async def enforce_body_limit(request: Request) -> None:
    length = request.headers.get("content-length")
    if length and int(length) > settings.request_body_limit_bytes:
        raise compass_error(413, "request_too_large", "Request body is too large.")


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise compass_error(401, "unauthorized", "Missing session token.")
    try:
        user_id = decode_session_token(authorization.removeprefix("Bearer ").strip())
    except JWTError:
        raise compass_error(401, "unauthorized", "Invalid session token.") from None
    user = db.get(User, user_id)
    if user is None:
        raise compass_error(401, "unauthorized", "Invalid session token.")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "super_admin"}:
        raise compass_error(403, "admin_required", "Admin authorization is required.")
    return user


def is_admin(user: User) -> bool:
    return user.role in {"admin", "super_admin"}


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
    redis = check_redis(settings.redis_url)
    litellm = await LiteLLMClient().health_check()
    return {"status": "ready", "database": {"status": "ok", "dialect": db.bind.dialect.name if db.bind else "unknown"}, "redis": redis, "litellm": {"status": litellm.get("status", "ok")}}


@app.post("/auth/signup", response_model=SessionResponse)
def signup(body: SignupRequest, db: Session = Depends(get_db)) -> SessionResponse:
    if not settings.public_signup_enabled:
        raise compass_error(403, "signup_disabled", "Account signup is disabled for this Compass environment.")
    user, organization, _ = register_customer(db, body.email, body.password, body.organization_name)
    return SessionResponse(
        token=create_session_token(user.id),
        user_id=user.id,
        email=user.email,
        organization_id=organization.id,
        role=user.role,
    )


@app.post("/auth/login", response_model=SessionResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> SessionResponse:
    user = db.scalar(select_user_by_email(body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise compass_error(401, "invalid_login", "Invalid email or password.")
    return SessionResponse(
        token=create_session_token(user.id),
        user_id=user.id,
        email=user.email,
        organization_id=organization_id_for_user(db, user.id),
        role=user.role,
    )


@app.post("/auth/marketplace", response_model=SessionResponse)
def marketplace_login(body: MarketplaceSsoRequest, db: Session = Depends(get_db)) -> SessionResponse:
    try:
        claims = decode_marketplace_sso_token(body.token)
    except ValueError as exc:
        raise compass_error(401, "invalid_marketplace_session", "Marketplace sign-in could not be verified.") from exc
    user = upsert_marketplace_user(db, claims["email"], str(claims.get("role", "user")), claims.get("name"))
    return SessionResponse(
        token=create_session_token(user.id),
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


@app.post("/admin/teams")
def admin_create_team(body: TeamCreate, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    team = create_team(db, body.name, body.slug, body.notes, body.workspace_id)
    return {"id": team.id, "workspace_id": team.organization_id, "name": team.name, "slug": team.slug, "is_active": team.is_active}


@app.post("/admin/teams/{team_id}/members")
def admin_create_member(team_id: str, body: TeamMemberCreate, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    member = create_team_member(db, team_id, body.name, body.email.lower(), body.role)
    return {"id": member.id, "team_id": member.team_id, "name": member.name, "email": member.email, "role": member.role, "is_active": member.is_active}


@app.get("/admin/teams/{team_id}/members")
def admin_members(team_id: str, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(TeamMember).where(TeamMember.team_id == team_id).order_by(TeamMember.created_at.desc())).all()
    return [{"id": row.id, "team_id": row.team_id, "name": row.name, "email": row.email, "role": row.role, "is_active": row.is_active} for row in rows]


@app.post("/admin/api-keys")
def admin_create_key(body: ApiKeyCreate, user: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    return create_api_key(db, user.id, body.team_id, body.member_id, body.name, body.allowed_models, body.expires_at)


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
def admin_topup(body: WalletTopupRequest, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    ledger = credit_wallet(db, body.team_id, body.amount_paise, body.idempotency_key, body.idempotency_key)
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
    return {"id": order.id, "team_id": order.team_id, "provider": order.provider, "provider_order_id": order.provider_order_id, "amount_paise": order.amount_paise, "currency": order.currency, "status": order.status, "created_at": order.created_at.isoformat(), "completed_at": order.completed_at.isoformat() if order.completed_at else None, "can_complete": order.provider == "development" and order.status == "created"}


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
    if mode == "razorpay":
        provider = "razorpay"
        try:
            response = httpx.post("https://api.razorpay.com/v1/orders", auth=(settings.razorpay_key_id, settings.razorpay_key_secret), json={"amount": body.amount_paise, "currency": "INR", "receipt": f"compass_{new_id()}"}, timeout=15)
            response.raise_for_status()
            provider_order_id = str(response.json()["id"])
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise compass_error(502, "payment_provider_error", "Razorpay could not create the recharge order.") from exc
    order = PaymentOrder(organization_id=team.organization_id, team_id=team.id, provider=provider, provider_order_id=provider_order_id, amount_paise=body.amount_paise, currency="INR", status="created")
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
    if order.status == "completed":
        return billing_order_row(order)
    ledger = credit_wallet(db, order.team_id, order.amount_paise, f"payment:{order.id}", body.razorpay_payment_id, "payment_order", "Wallet recharge completed through Razorpay")
    order.status = "completed"
    order.completed_at = now()
    db.commit()
    return billing_order_row(order) | {"ledger_id": ledger.id, "balance_paise": ledger.balance_after}


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
    ledger = credit_wallet(db, order.team_id, order.amount_paise, f"payment:{order.id}", order.provider_order_id, "payment_order", "Wallet recharge completed in development checkout")
    order.status = "completed"
    order.completed_at = now()
    db.commit()
    return billing_order_row(order) | {"ledger_id": ledger.id, "balance_paise": ledger.balance_after}


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
        "mode": "LOCAL TEST MODE",
        "note": "Provider credentials are stored server-side. Local beta models use the controlled LiteLLM local-test path, not real provider calls.",
        "providers": provider_credentials_summary(db),
        "models": model_catalog_rows(db),
    }


@app.get("/admin/router/providers")
def admin_router_providers(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> list[dict]:
    providers = db.scalars(select(Provider).order_by(Provider.name)).all()
    rows = []
    for provider in providers:
        health = db.scalar(select(ProviderHealthCheck).where(ProviderHealthCheck.provider_id == provider.id).order_by(ProviderHealthCheck.last_checked_at.desc()).limit(1))
        rows.append({"id": provider.id, "name": provider.name, "status": provider.status, "enabled": provider.enabled, "last_health": {"status": health.status, "latency_ms": health.latency_ms, "error_rate": health.error_rate, "checked_at": health.last_checked_at.isoformat()} if health else None})
    return rows


@app.patch("/admin/router/providers/{provider_name}")
def admin_update_provider_status(provider_name: str, body: ProviderStatusUpdate, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    provider = db.scalar(select(Provider).where(Provider.name == provider_name))
    if provider is None:
        raise compass_error(404, "provider_not_found", "Provider was not found.")
    provider.status = body.status
    if body.enabled is not None:
        provider.enabled = body.enabled
    db.commit()
    return {"name": provider.name, "status": provider.status, "enabled": provider.enabled}


@app.patch("/admin/router/models/{model_id:path}")
def admin_update_model_status(model_id: str, body: ModelStatusUpdate, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    model = db.get(ModelCatalog, model_id)
    if model is None:
        raise compass_error(404, "model_not_found", "Model was not found.")
    model.status = body.status
    if body.enabled is not None:
        model.enabled = body.enabled
    if body.published is not None:
        model.published = body.published
    db.commit()
    return {"id": model.id, "status": model.status, "enabled": model.enabled, "published": model.published}


@app.post("/admin/provider-credentials")
def admin_save_provider_credential(body: ProviderCredentialUpdate, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    credential = upsert_provider_api_key(db, body.provider, body.api_key)
    return {
        "provider": body.provider,
        "credential_status": credential.status,
        "has_configured_key": True,
        "last_four": credential.last_four,
        "updated_at": credential.updated_at.isoformat(),
    }


@app.get("/admin/overview")
def admin_overview(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    return {"users": db.query(User).count(), "teams": db.query(Team).count(), "requests": db.query(LlmRequest).count(), "status": "operational"}
