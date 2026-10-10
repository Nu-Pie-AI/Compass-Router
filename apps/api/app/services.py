import asyncio
import hashlib
import json
import math
import re
import secrets
import time
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING
import httpx
from cryptography.fernet import InvalidToken
from fastapi import HTTPException
from redis import Redis
from redis.backoff import ExponentialBackoff
from redis.exceptions import RedisError
from redis.retry import Retry
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import get_settings
from .authorization import require_project_access
from .catalog import (
    capability_matches,
    filter_catalog_records,
    native_model_id,
    normalize_litellm_cost_map,
    openrouter_capability_types,
    provider_protocol,
    snapshot_revision,
)
from .errors import compass_error
from .models import (
    ApiKey,
    ApiKeyModel,
    AuditLog,
    ByokCredential,
    CatalogSyncRun,
    EmailOtpChallenge,
    EmailOutbox,
    ExtensionDevice,
    ExtensionDeviceAuthorization,
    ExtensionSession,
    Invitation,
    LlmRequest,
    ModelCatalog,
    ModelPolicy,
    Organization,
    OrganizationMember,
    Project,
    ProjectMember,
    OperationalEvent,
    PlatformSetting,
    Provider,
    ProviderAttempt,
    ProviderCredential,
    ProviderHealthCheck,
    PricingPolicy,
    RoutingPolicy,
    Team,
    TeamLimit,
    TeamMember,
    User,
    WalletAccount,
    WalletLedger,
    new_id,
    now,
)
from .security import decrypt_secret, encrypt_secret, generate_api_key, hash_api_key, hash_password
from .secrets import get_secret_manager, secret_reference_value
from .provider_adapters import ProviderAdapterError, ProviderAdapterRegistry, ProviderRoute, RuntimeProviderAdapter


request_id_context: ContextVar[str | None] = ContextVar("compass_request_id", default=None)
api_project_context: ContextVar[str | None] = ContextVar("compass_api_project", default=None)
device_session_context: ContextVar[str | None] = ContextVar("compass_device_session", default=None)


def _credential_reference(provider_name: str, secret: str, scope: str) -> str:
    settings = get_settings()
    if settings.secret_manager_enabled:
        return get_secret_manager().put(f"{scope}-{provider_name}-{new_id()}", secret)
    return encrypt_secret(secret)


def _credential_value(reference: str) -> str:
    if reference.startswith("gcp-secret:"):
        return secret_reference_value(reference)
    if reference.startswith("encrypted:"):
        try:
            return decrypt_secret(reference)
        except InvalidToken:
            raise compass_error(503, "provider_credential_invalid", "The provider credential cannot be decrypted. Re-save the provider key.") from None
    return ""


def _has_usable_reference(reference: str) -> bool:
    return reference.startswith(("encrypted:", "gcp-secret:")) or (get_settings().local_test_mode and reference.startswith("server-side/"))


def select_user_by_email(email: str):
    return select(User).where(User.email == email.lower())


def record_audit_log(
    db: Session,
    actor: User | None,
    action: str,
    target: str,
    metadata: dict | None = None,
    request_id: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor.id if actor else None,
        action=action,
        target=target,
        request_id=request_id or request_id_context.get(),
        metadata_json=json.dumps(metadata or {}, sort_keys=True),
    )
    db.add(entry)
    return entry


def organization_id_for_user(db: Session, user_id: str) -> str | None:
    return db.scalar(
        select(OrganizationMember.organization_id)
        .where(OrganizationMember.user_id == user_id, OrganizationMember.role != "removed")
        .limit(1)
    )


def ensure_default_project(db: Session, organization_id: str) -> Project:
    project = db.scalar(select(Project).where(Project.organization_id == organization_id, Project.is_default.is_(True)))
    if project is None:
        organization = db.get(Organization, organization_id)
        if organization is None:
            raise compass_error(404, "workspace_not_found", "Workspace not found.")
        project = Project(organization_id=organization_id, name="Others", slug="others", description="Fallback project for untagged workspaces.", is_default=True)
        db.add(project)
        db.flush()
        db.query(Team).filter(Team.organization_id == organization_id, Team.project_id.is_(None)).update({Team.project_id: project.id}, synchronize_session=False)
        db.query(ApiKey).filter(ApiKey.organization_id == organization_id, ApiKey.project_id.is_(None)).update({ApiKey.project_id: project.id}, synchronize_session=False)
    for membership in db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == organization_id)).all():
        if db.scalar(select(ProjectMember).where(ProjectMember.project_id == project.id, ProjectMember.user_id == membership.user_id)) is None:
            db.add(ProjectMember(project_id=project.id, user_id=membership.user_id, role="owner" if membership.role == "owner" else "member"))
    return project


def ensure_projects_for_organizations(db: Session) -> None:
    for organization_id in db.scalars(select(Organization.id)).all():
        ensure_default_project(db, organization_id)
    db.commit()


def project_ids_for_user(db: Session, user: User) -> list[str]:
    if user.role in {"admin", "super_admin"}:
        return list(db.scalars(select(Project.id)).all())
    return list(
        db.scalars(
            select(Project.id)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .join(OrganizationMember, OrganizationMember.organization_id == Project.organization_id)
            .where(
                ProjectMember.user_id == user.id,
                ProjectMember.status == "active",
                OrganizationMember.user_id == user.id,
                OrganizationMember.role != "removed",
                Project.is_active.is_(True),
            )
        ).all()
    )


def project_rows(db: Session, project_ids: list[str]) -> list[dict]:
    if not project_ids:
        return []
    projects = db.scalars(select(Project).where(Project.id.in_(project_ids)).order_by(Project.is_default.desc(), Project.created_at)).all()
    return [{"id": row.id, "organization_id": row.organization_id, "name": row.name, "slug": row.slug, "description": row.description, "is_default": row.is_default, "is_active": row.is_active, "created_at": row.created_at.isoformat()} for row in projects]


def create_project(db: Session, organization_id: str, name: str, slug: str | None, description: str, owner_id: str) -> Project:
    normalized_slug = slug or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "project"
    if db.scalar(select(Project).where(Project.organization_id == organization_id, Project.slug == normalized_slug)) is not None:
        raise compass_error(409, "project_exists", "A project already exists with this slug.")
    project = Project(organization_id=organization_id, name=name.strip(), slug=normalized_slug, description=description.strip())
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=owner_id, role="owner"))
    db.commit()
    return project


def _otp_hash(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def queue_email(db: Session, recipient: str, subject: str, body: str) -> EmailOutbox:
    message = EmailOutbox(recipient=recipient.strip().lower(), subject=subject, body=body, status="queued")
    db.add(message)
    return message


def create_otp_challenge(db: Session, email: str, purpose: str) -> tuple[EmailOtpChallenge, str]:
    settings = get_settings()
    if not settings.otp_enabled:
        raise compass_error(503, "otp_disabled", "Email verification is not enabled for this environment.")
    normalized = email.strip().lower()
    db.query(EmailOtpChallenge).filter(EmailOtpChallenge.email == normalized, EmailOtpChallenge.purpose == purpose, EmailOtpChallenge.consumed.is_(False)).update({EmailOtpChallenge.consumed: True}, synchronize_session=False)
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = EmailOtpChallenge(email=normalized, purpose=purpose, code_hash=_otp_hash(code), expires_at=now() + timedelta(seconds=settings.otp_ttl_seconds))
    db.add(challenge)
    queue_email(db, normalized, "Your Compass Router verification code", f"Your Compass Router verification code is {code}. It expires in {max(1, settings.otp_ttl_seconds // 60)} minutes.")
    db.commit()
    return challenge, code


def verify_otp_challenge(db: Session, challenge_id: str, email: str, code: str, purpose: str) -> EmailOtpChallenge:
    settings = get_settings()
    challenge = db.get(EmailOtpChallenge, challenge_id)
    if challenge is None or challenge.email != email.strip().lower() or challenge.purpose != purpose or challenge.consumed or challenge.expires_at < now():
        raise compass_error(401, "otp_invalid", "The verification code is invalid or expired.")
    if challenge.attempts >= settings.otp_max_attempts:
        raise compass_error(429, "otp_rate_limited", "Too many verification attempts. Request a new code.")
    challenge.attempts += 1
    if not secrets.compare_digest(challenge.code_hash, _otp_hash(code)):
        db.commit()
        raise compass_error(401, "otp_invalid", "The verification code is invalid or expired.")
    challenge.consumed = True
    db.commit()
    return challenge


def create_invitation(db: Session, actor: User, project: Project, email: str, role: str, team_id: str | None = None) -> tuple[Invitation, str]:
    normalized = email.strip().lower()
    if team_id is not None:
        team = db.get(Team, team_id)
        if team is None or team.organization_id != project.organization_id or (team.project_id and team.project_id != project.id):
            raise compass_error(400, "team_project_mismatch", "The selected team does not belong to this project.")
    token = secrets.token_urlsafe(32)
    invitation = Invitation(organization_id=project.organization_id, project_id=project.id, team_id=team_id, email=normalized, role=role, token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(), invited_by=actor.id, expires_at=now() + timedelta(days=7))
    db.add(invitation)
    origin = get_settings().compass_web_origin.split(",", 1)[0].strip().rstrip("/")
    queue_email(db, normalized, f"You have been invited to {project.name}", f"You have been invited to join project {project.name} in Compass Router. Open {origin}/invitations/{token} to verify your email and accept the invitation. After accepting, install the Compass Router VS Code extension and connect with your workspace account.")
    db.commit()
    return invitation, token


def resend_invitation(db: Session, invitation: Invitation, actor: User) -> Invitation:
    if invitation.status != "pending" or invitation.expires_at < now():
        raise compass_error(409, "invitation_not_pending", "Only pending invitations can be resent.")
    token = secrets.token_urlsafe(32)
    invitation.token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    invitation.expires_at = now() + timedelta(days=7)
    origin = get_settings().compass_web_origin.split(",", 1)[0].strip().rstrip("/")
    project = db.get(Project, invitation.project_id)
    project_name = project.name if project else "your Compass Router project"
    queue_email(db, invitation.email, f"Reminder: invitation to {project_name}", f"You have a pending invitation to join {project_name} in Compass Router. Open {origin}/invitations/{token} to verify your email and accept access. After accepting, install the Compass Router VS Code extension and connect with your workspace account. The invitation expires in 7 days.")
    record_audit_log(db, actor, "organization.invitation_resent", f"invitation:{invitation.id}", {"email": invitation.email, "project_id": invitation.project_id})
    db.commit()
    return invitation


def start_extension_device_authorization(db: Session, device_name: str) -> dict:
    device_code = "cmp_device_code_" + secrets.token_urlsafe(32)
    user_code = f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"
    expires_at = now() + timedelta(minutes=10)
    authorization = ExtensionDeviceAuthorization(device_code_hash=hashlib.sha256(device_code.encode("utf-8")).hexdigest(), user_code=user_code, device_name=device_name.strip() or "VS Code", expires_at=expires_at)
    db.add(authorization)
    db.commit()
    origin = get_settings().compass_web_origin.split(",", 1)[0].strip().rstrip("/")
    return {"device_code": device_code, "user_code": user_code, "verification_uri": f"{origin}/extension/authorize", "expires_at": expires_at.isoformat(), "interval": 3}


def approve_extension_device(db: Session, actor: User, user_code: str, project_id: str, team_id: str | None = None) -> dict:
    authorization = db.scalar(select(ExtensionDeviceAuthorization).where(ExtensionDeviceAuthorization.user_code == user_code.upper().strip()))
    if authorization is None or authorization.status != "pending" or authorization.expires_at < now():
        raise compass_error(400, "device_code_invalid", "This VS Code authorization code is invalid or expired.")
    project = require_project_access(db, actor, project_id)
    organization_membership = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == project.organization_id, OrganizationMember.user_id == actor.id, OrganizationMember.role != "removed"))
    if actor.role not in {"admin", "super_admin"} and organization_membership is None:
        raise compass_error(403, "project_access_denied", "You do not have access to this project.")
    if team_id is None:
        team_id = db.scalar(select(Team.id).where(Team.project_id == project.id, Team.is_active.is_(True)).order_by(Team.created_at).limit(1))
    team = db.get(Team, team_id) if team_id else None
    if team is None or team.organization_id != project.organization_id or (team.project_id and team.project_id != project.id) or not team.is_active:
        raise compass_error(400, "team_required", "Select an active team in this project before authorizing VS Code.")
    if actor.role not in {"admin", "super_admin"}:
        team_member = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == actor.id, TeamMember.is_active.is_(True)))
        if team_member is None:
            team_member = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, func.lower(TeamMember.email) == actor.email.lower(), TeamMember.is_active.is_(True)))
        if team_member is None:
            raise compass_error(403, "team_access_denied", "You do not have access to the selected team.")
    key_result = create_api_key(db, actor.id, team.id, None, f"VS Code · {authorization.device_name}", [], None, project.id, "extension-device")
    device = ExtensionDevice(user_id=actor.id, organization_id=project.organization_id, project_id=project.id, device_name=authorization.device_name, status="active", last_seen_at=now())
    db.add(device)
    db.flush()
    token = "cmp_device_" + secrets.token_urlsafe(40)
    session = ExtensionSession(device_id=device.id, api_key_id=key_result["id"], token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(), expires_at=now() + timedelta(days=30))
    db.add(session)
    db.flush()
    authorization.status = "approved"
    authorization.user_id = actor.id
    authorization.organization_id = project.organization_id
    authorization.project_id = project.id
    authorization.team_id = team.id
    authorization.device_id = device.id
    authorization.session_id = session.id
    authorization.session_token_encrypted = encrypt_secret(token)
    authorization.approved_at = now()
    db.commit()
    return {"status": "approved", "project": {"id": project.id, "name": project.name, "slug": project.slug, "is_default": project.is_default}, "team": {"id": team.id, "name": team.name, "slug": team.slug}}


def poll_extension_device_authorization(db: Session, device_code: str) -> dict:
    authorization = db.scalar(select(ExtensionDeviceAuthorization).where(ExtensionDeviceAuthorization.device_code_hash == hashlib.sha256(device_code.encode("utf-8")).hexdigest()))
    if authorization is None:
        raise compass_error(400, "device_code_invalid", "This VS Code device code is invalid.")
    if authorization.status == "pending" and authorization.expires_at < now():
        authorization.status = "expired"
        db.commit()
    if authorization.status != "approved":
        return {"status": authorization.status, "expires_at": authorization.expires_at.isoformat()}
    session = db.get(ExtensionSession, authorization.session_id) if authorization.session_id else None
    if session is None or session.revoked_at is not None or session.expires_at < now():
        return {"status": "expired", "expires_at": authorization.expires_at.isoformat()}
    return {"status": "authorized", "access_token": decrypt_secret(authorization.session_token_encrypted), "token_type": "Bearer", "expires_at": session.expires_at.isoformat(), "project_id": authorization.project_id, "team_id": authorization.team_id}


def revoke_extension_sessions_for_user(db: Session, user_id: str, organization_id: str | None = None) -> None:
    device_query = select(ExtensionDevice.id).where(ExtensionDevice.user_id == user_id)
    if organization_id is not None:
        device_query = device_query.where(ExtensionDevice.organization_id == organization_id)
    device_ids = list(db.scalars(device_query).all())
    if device_ids:
        db.query(ExtensionSession).filter(ExtensionSession.device_id.in_(device_ids), ExtensionSession.revoked_at.is_(None)).update({ExtensionSession.revoked_at: now()}, synchronize_session=False)
        db.query(ExtensionDevice).filter(ExtensionDevice.id.in_(device_ids)).update({ExtensionDevice.status: "revoked"}, synchronize_session=False)


def revoke_extension_session(db: Session, session_id: str) -> bool:
    session = db.get(ExtensionSession, session_id)
    if session is None or session.revoked_at is not None:
        return False
    session.revoked_at = now()
    device = db.get(ExtensionDevice, session.device_id)
    if device is not None:
        device.status = "revoked"
    api_key = db.get(ApiKey, session.api_key_id)
    if api_key is not None and api_key.status == "active":
        api_key.status = "revoked"
        api_key.revoked_at = now()
    db.commit()
    return True


def register_customer(db: Session, email: str, password: str, organization_name: str) -> tuple[User, Organization, Team]:
    normalized_email = email.strip().lower()
    workspace_name = organization_name.strip()
    if db.scalar(select_user_by_email(normalized_email)) is not None:
        raise compass_error(409, "account_exists", "An account already exists for this email.")

    settings = get_settings()
    user = User(email=normalized_email, password_hash=hash_password(password), role="customer")
    organization = Organization(name=workspace_name)
    db.add_all([user, organization])

    try:
        db.flush()
        slug_base = re.sub(r"[^a-z0-9]+", "-", workspace_name.lower()).strip("-") or "workspace"
        team_slug = f"{slug_base[:48]}-{user.id[:8]}"
        team = Team(organization_id=organization.id, name=workspace_name, slug=team_slug, notes="Customer workspace created during signup")
        db.add(team)
        db.flush()
        project = Project(organization_id=organization.id, name="Others", slug="others", description="Fallback project for untagged workspaces.", is_default=True)
        db.add(project)
        db.flush()
        team.project_id = project.id
        db.add_all(
            [
                OrganizationMember(user_id=user.id, organization_id=organization.id, role="owner"),
                ProjectMember(project_id=project.id, user_id=user.id, role="owner"),
                TeamMember(
                    team_id=team.id,
                    name=normalized_email.split("@", 1)[0][:120],
                    email=normalized_email,
                    user_id=user.id,
                    role="owner",
                ),
                TeamLimit(
                    team_id=team.id,
                    requests_per_minute=settings.default_team_request_limit_per_minute,
                    tokens_per_minute=settings.default_team_token_limit_per_minute,
                    daily_spend_limit_paise=settings.default_team_daily_spend_limit_paise,
                    monthly_spend_limit_paise=settings.default_team_monthly_spend_limit_paise,
                ),
                WalletAccount(team_id=team.id, balance_paise=0),
            ]
        )
        # The promotion helper locks the newly-created wallet, so make the
        # pending account visible to the current transaction first.
        db.flush()
        _grant_signup_credits(db, team.id, user.id)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise compass_error(409, "account_exists", "An account or workspace already exists for these details.") from exc

    return user, organization, team


def _grant_signup_credits(db: Session, team_id: str, user_id: str) -> None:
    """Grant the configured signup promotion once, inside the signup transaction."""
    setting = db.get(PlatformSetting, "trial_credit_paise")
    if setting is None:
        return
    try:
        amount_paise = int(json.loads(setting.value_json))
    except (TypeError, ValueError, json.JSONDecodeError):
        return
    if amount_paise <= 0:
        return
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id).with_for_update())
    if wallet is None:
        raise compass_error(500, "signup_credit_wallet_missing", "The signup Credits account could not be created.")
    idempotency_key = f"signup-credit:{user_id}"
    if db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == idempotency_key)) is not None:
        return
    before = wallet.balance_paise
    wallet.balance_paise += amount_paise
    wallet.updated_at = now()
    db.add(
        WalletLedger(
            wallet_id=wallet.id,
            type="signup_promotion",
            amount_paise=amount_paise,
            balance_before=before,
            balance_after=wallet.balance_paise,
            reference_type="signup_promotion",
            reference_id=user_id,
            description="Configured signup Credits promotion",
            idempotency_key=idempotency_key,
        )
    )


def provision_clerk_customer(db: Session, clerk_user_id: str, email: str) -> tuple[User, Organization | None, bool]:
    """Idempotently map a Clerk identity to a Compass customer.

    Existing email accounts are never silently linked to a different Clerk identity.
    That requires an explicit support/admin linking flow so ownership cannot transfer
    through a mutable email address.
    """
    normalized_email = email.strip().lower()
    mapped = db.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
    if mapped is not None:
        if mapped.email != normalized_email:
            collision = db.scalar(select(User).where(User.email == normalized_email, User.id != mapped.id))
            if collision is not None:
                raise compass_error(409, "identity_email_conflict", "The verified Clerk email belongs to another Compass account.")
            mapped.email = normalized_email
            mapped.email_verified_at = mapped.email_verified_at or now()
            db.commit()
        return mapped, db.scalar(select(Organization).join(OrganizationMember, OrganizationMember.organization_id == Organization.id).where(OrganizationMember.user_id == mapped.id).limit(1)), False

    existing = db.scalar(select(User).where(User.email == normalized_email))
    if existing is not None:
        raise compass_error(409, "identity_link_required", "This email already has a Compass account. Sign in with the existing account before linking Clerk.")

    workspace_name = f"{normalized_email.split('@', 1)[0][:80]} Workspace"
    user, organization, _ = register_customer(db, normalized_email, f"clerk-only:{secrets.token_urlsafe(32)}", workspace_name)
    user.clerk_user_id = clerk_user_id
    user.email_verified_at = now()
    db.commit()
    return user, organization, True


def upsert_marketplace_user(db: Session, email: str, marketplace_role: str, display_name: str | None = None) -> User:
    normalized_email = email.strip().lower()
    user = db.scalar(select_user_by_email(normalized_email))
    if user is None:
        workspace = (display_name or normalized_email.split("@", 1)[0]).strip() or "Compass Workspace"
        user, _, _ = register_customer(
            db,
            normalized_email,
            f"marketplace-sso:{get_settings().app_secret}:{normalized_email}",
            f"{workspace} Workspace",
        )
    if marketplace_role in {"admin", "super_admin"}:
        user.role = "admin"
    elif user.role not in {"admin", "super_admin"}:
        user.role = "customer"
    db.commit()
    return user


def bootstrap_admin(db: Session) -> None:
    settings = get_settings()
    user = db.scalar(select_user_by_email(settings.admin_email.lower()))
    if user is None:
        db.add(User(email=settings.admin_email.lower(), password_hash=hash_password(settings.admin_password), role="admin"))
        db.commit()
        return
    # The configured owner account is the highest-privilege product account.
    # Other administrators can still be managed from the owner console.
    user.role = "super_admin"
    db.commit()


def bootstrap_customer_fixture(
    db: Session,
    *,
    email: str,
    password: str,
    name: str,
    team_name: str,
    team_slug: str,
    credit_reference: str,
) -> None:
    settings = get_settings()
    email = email.lower()
    user = db.scalar(select_user_by_email(email))
    if user is None:
        user = User(email=email, password_hash=hash_password(password), role="customer")
        db.add(user)
        db.commit()
    elif user.role != "customer":
        raise RuntimeError("The local customer email is already assigned to a privileged account.")

    organization_id = organization_id_for_user(db, user.id)
    if organization_id is None:
        organization = Organization(name=team_name)
        db.add(organization)
        db.flush()
        organization_id = organization.id
        db.add(OrganizationMember(user_id=user.id, organization_id=organization.id, role="owner"))
        db.commit()

    team = db.scalar(select(Team).where(Team.slug == team_slug))
    if team is None:
        team = create_team(
            db,
            team_name,
            team_slug,
            "Seeded local customer workspace",
            organization_id,
        )

    member = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.email == email))
    if member is None:
        create_team_member(db, team.id, name, email, "owner")

    credit_wallet(
        db,
        team.id,
        settings.local_test_wallet_credit_paise,
        credit_reference,
        credit_reference,
    )


def bootstrap_local_customers(db: Session) -> None:
    settings = get_settings()
    bootstrap_customer_fixture(
        db,
        email=settings.local_test_customer_email,
        password=settings.local_test_customer_password,
        name=settings.local_test_customer_name,
        team_name=settings.local_test_customer_team_name,
        team_slug=settings.local_test_customer_team_slug,
        credit_reference="local-customer-seed-credit-v1",
    )
    bootstrap_customer_fixture(
        db,
        email=settings.local_test_customer_2_email,
        password=settings.local_test_customer_2_password,
        name=settings.local_test_customer_2_name,
        team_name=settings.local_test_customer_2_team_name,
        team_slug=settings.local_test_customer_2_team_slug,
        credit_reference="local-customer-2-seed-credit-v1",
    )


def ensure_provider(db: Session, name: str) -> Provider:
    provider = db.scalar(select(Provider).where(Provider.name == name))
    if provider is None:
        provider = Provider(
            name=name,
            protocol=provider_protocol(name),
            catalog_source="configuration",
            commercial_status="unreviewed",
            enabled=False,
            status="unconfigured",
        )
        db.add(provider)
        db.flush()
    elif not provider.protocol:
        provider.protocol = provider_protocol(name)
    return provider


def ensure_platform_credential(db: Session, provider: Provider) -> None:
    credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.provider_id == provider.id,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
        )
    )
    if credential is None:
        db.add(
            ProviderCredential(
                provider_id=provider.id,
                credential_mode="platform",
                secret_reference=f"server-side/{provider.name}/local-test",
                status="local_test",
                last_four="",
            )
        )


ENV_PROVIDER_KEYS = {
    "openai": "openai_api_key",
    "gemini": "gemini_api_key",
    "anthropic": "anthropic_api_key",
    "mistral": "mistral_api_key",
    "groq": "groq_api_key",
    "deepseek": "deepseek_api_key",
    "xai": "xai_api_key",
    "cohere": "cohere_api_key",
    "openrouter": "openrouter_api_key",
    "together_ai": "together_api_key",
    "fireworks_ai": "fireworks_api_key",
    "perplexity": "perplexity_api_key",
    "nvidia_nim": "nvidia_nim_api_key",
    "ollama_cloud": "ollama_api_key",
    "azure": "azure_openai_api_key",
    "azure_ai": "azure_ai_api_key",
    "vertex_ai": "vertex_ai_api_key",
    "cerebras": "cerebras_api_key",
    "sambanova": "sambanova_api_key",
    "deepinfra": "deepinfra_api_key",
    "huggingface": "huggingface_api_key",
}


def sync_env_provider_credentials(db: Session) -> None:
    """Bootstrap provider credentials from the ignored local key file."""
    settings = get_settings()
    sync_mode = settings.provider_env_sync_mode.strip().lower()
    if sync_mode not in {"missing", "replace"}:
        raise compass_error(500, "provider_env_sync_invalid", "PROVIDER_ENV_SYNC_MODE must be missing or replace.")
    db.flush()
    for provider_name, setting_name in ENV_PROVIDER_KEYS.items():
        api_key = str(getattr(settings, setting_name, "") or "").strip()
        if not api_key or api_key.lower().startswith("replace-with-") or api_key.startswith("<"):
            continue
        provider = ensure_provider(db, provider_name)
        credential = db.scalar(
            select(ProviderCredential).where(
                ProviderCredential.provider_id == provider.id,
                ProviderCredential.organization_id.is_(None),
                ProviderCredential.credential_mode == "platform",
            )
        )
        if credential is None:
            credential = ProviderCredential(provider_id=provider.id, credential_mode="platform", secret_reference="", status="active")
            db.add(credential)
            db.flush()
        if sync_mode == "missing" and credential.status == "active" and credential.last_four:
            continue
        if credential.last_four != api_key[-4:] or not _has_usable_reference(credential.secret_reference):
            credential.secret_reference = _credential_reference(provider_name, api_key, "platform")
            credential.last_four = api_key[-4:]
        credential.status = "active"
        credential.updated_at = now()
def upsert_model(
    db: Session,
    *,
    model_id: str,
    provider: Provider,
    provider_model_id: str,
    display_name: str,
    capabilities: str,
    context_window: int,
    input_price_paise_per_1k: int,
    output_price_paise_per_1k: int,
    fallback_model_id: str | None = None,
    protocol: str | None = None,
    capability_types: str | None = None,
    input_modalities: list[str] | None = None,
    output_modalities: list[str] | None = None,
    max_output_tokens: int | None = None,
) -> None:
    model = db.get(ModelCatalog, model_id)
    if model is None:
        local_fixture = get_settings().local_test_mode
        db.add(
            ModelCatalog(
                id=model_id,
                provider_id=provider.id,
                provider_model_id=provider_model_id,
                display_name=display_name,
                protocol=protocol or provider.protocol,
                capabilities=capabilities,
                capability_types="chat_completion,responses" if capability_types is None else capability_types,
                input_modalities=json.dumps(input_modalities or []),
                output_modalities=json.dumps(output_modalities or []),
                context_window=context_window,
                max_output_tokens=max_output_tokens,
                input_price_paise_per_1k=input_price_paise_per_1k,
                output_price_paise_per_1k=output_price_paise_per_1k,
                enabled=local_fixture,
                published=local_fixture,
                status="available" if local_fixture else "unavailable",
                route_readiness_reason="local test fixture" if local_fixture else "verified catalog activation required",
                fallback_model_id=fallback_model_id,
            )
        )
        return
    model.provider_id = provider.id
    model.provider_model_id = provider_model_id
    model.display_name = display_name
    model.protocol = protocol or provider.protocol
    model.capabilities = capabilities
    if capability_types is not None:
        model.capability_types = capability_types
    if input_modalities is not None:
        model.input_modalities = json.dumps(input_modalities)
    if output_modalities is not None:
        model.output_modalities = json.dumps(output_modalities)
    model.max_output_tokens = max_output_tokens
    model.context_window = context_window
    model.input_price_paise_per_1k = input_price_paise_per_1k
    model.output_price_paise_per_1k = output_price_paise_per_1k
    if get_settings().local_test_mode:
        model.enabled = True
        model.published = True
        model.status = "available"
        model.route_readiness_reason = "local test fixture"
    model.supports_streaming = True
    model.fallback_model_id = fallback_model_id


def seed_defaults(db: Session) -> None:
    settings = get_settings()
    providers = {name: ensure_provider(db, name) for name in ("openai", "gemini", "ollama_cloud")} if settings.local_test_mode else {}
    for provider in providers.values():
        provider.enabled = True
        provider.status = "healthy"
        provider.commercial_status = "approved"
        ensure_platform_credential(db, provider)
    sync_env_provider_credentials(db)
    if settings.local_test_mode:
        proxy_mode = settings.provider_execution_mode.strip().lower() == "proxy"
        provider_model = "local-test-chat" if settings.local_test_mode else ("openai-gpt-4o-mini-smoke" if proxy_mode else "gpt-5")
        gemini_credential = db.scalar(
            select(ProviderCredential).where(
                ProviderCredential.provider_id == providers["gemini"].id,
                ProviderCredential.organization_id.is_(None),
                ProviderCredential.credential_mode == "platform",
                ProviderCredential.status == "active",
            )
        )
        gemini_provider_model = "gemini-flash-real" if gemini_credential and gemini_credential.secret_reference.startswith("encrypted:") else provider_model
        ollama_credential = db.scalar(
            select(ProviderCredential).where(
                ProviderCredential.provider_id == providers["ollama_cloud"].id,
                ProviderCredential.organization_id.is_(None),
                ProviderCredential.credential_mode == "platform",
                ProviderCredential.status == "active",
            )
        )
        ollama_provider_model = "ollama-cloud-gpt-oss-20b-real" if ollama_credential and ollama_credential.secret_reference.startswith("encrypted:") else provider_model
        upsert_model(
            db,
            model_id="openai/gpt-5",
            provider=providers["openai"],
            provider_model_id=provider_model,
            display_name="GPT-5",
            capabilities="chat,reasoning",
            context_window=128000,
            input_price_paise_per_1k=settings.local_test_input_price_paise_per_1k,
            output_price_paise_per_1k=settings.local_test_output_price_paise_per_1k,
            fallback_model_id="gemini/gemini-3.6-flash",
        )
        upsert_model(
            db,
            model_id="gemini/gemini-3.6-flash",
            provider=providers["gemini"],
            provider_model_id=gemini_provider_model,
            display_name="Gemini 3.6 Flash",
            capabilities="chat,fast",
            context_window=1000000,
            input_price_paise_per_1k=settings.local_test_input_price_paise_per_1k,
            output_price_paise_per_1k=settings.local_test_output_price_paise_per_1k,
            fallback_model_id="ollama_cloud/gpt-oss:20b",
        )
        upsert_model(
            db,
            model_id="ollama_cloud/gpt-oss:20b",
            provider=providers["ollama_cloud"],
            provider_model_id=ollama_provider_model,
            display_name="GPT-OSS 20B on Ollama Cloud",
            capabilities="chat,open-weights",
            context_window=128000,
            input_price_paise_per_1k=settings.local_test_input_price_paise_per_1k,
            output_price_paise_per_1k=settings.local_test_output_price_paise_per_1k,
        )
        db.flush()
        legacy_ids = {
            "compass/gpt-5": "openai/gpt-5",
            "compass/gemini-flash": "gemini/gemini-3.6-flash",
            "compass/llama": "ollama_cloud/gpt-oss:20b",
        }
        for legacy_id, native_id in legacy_ids.items():
            legacy = db.get(ModelCatalog, legacy_id)
            if legacy is None:
                continue
            for grant in db.scalars(select(ApiKeyModel).where(ApiKeyModel.model_id == legacy_id)).all():
                exists = db.scalar(select(ApiKeyModel).where(ApiKeyModel.api_key_id == grant.api_key_id, ApiKeyModel.model_id == native_id))
                if exists is None:
                    db.add(ApiKeyModel(api_key_id=grant.api_key_id, model_id=native_id))
                db.delete(grant)
            legacy.enabled = False
            legacy.published = False
    else:
        # Existing rows from older beta bootstraps remain for historical usage,
        # but cannot advertise or route until a real catalog sync and activation.
        for model in db.scalars(select(ModelCatalog).where(ModelCatalog.catalog_source == "seeded")).all():
            model.enabled = False
            model.published = False
            model.status = "unavailable"
            model.route_readiness_reason = "production catalog sync and activation required"
    if settings.local_test_mode:
        for limit in db.scalars(select(TeamLimit)).all():
            if limit.tokens_per_minute < settings.default_team_token_limit_per_minute:
                limit.tokens_per_minute = settings.default_team_token_limit_per_minute
    bootstrap_admin(db)
    if settings.local_test_mode:
        bootstrap_local_customers(db)
    ensure_projects_for_organizations(db)
    if settings.local_test_mode:
        ensure_default_pricing_policy(db)
    db.commit()


def upsert_provider_api_key(db: Session, provider_name: str, api_key: str) -> ProviderCredential:
    provider = ensure_provider(db, provider_name)
    credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.provider_id == provider.id,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
        )
    )
    if credential is None:
        credential = ProviderCredential(provider_id=provider.id, credential_mode="platform", secret_reference="", status="active")
        db.add(credential)
        db.flush()
    credential.secret_reference = _credential_reference(provider_name, api_key, "platform")
    credential.status = "active"
    credential.last_four = api_key[-4:]
    credential.updated_at = now()
    _set_local_provider_route(db, provider, live=True)
    db.commit()
    return credential


def upsert_byok_api_key(db: Session, team_id: str, user_id: str, provider_name: str, api_key: str) -> ByokCredential:
    provider = ensure_provider(db, provider_name)
    credential = db.scalar(
        select(ByokCredential).where(ByokCredential.team_id == team_id, ByokCredential.provider_id == provider.id)
    )
    if credential is None:
        credential = ByokCredential(team_id=team_id, user_id=user_id, provider_id=provider.id, encrypted_secret="")
        db.add(credential)
    credential.user_id = user_id
    credential.encrypted_secret = _credential_reference(provider_name, api_key, f"team-{team_id}")
    credential.status = "active"
    credential.last_four = api_key[-4:]
    credential.updated_at = now()
    db.commit()
    return credential


def byok_credentials_summary(db: Session, team_id: str) -> list[dict]:
    credentials = db.scalars(
        select(ByokCredential).where(ByokCredential.team_id == team_id).order_by(ByokCredential.updated_at.desc())
    ).all()
    return [
        {
            "id": credential.id,
            "team_id": credential.team_id,
            "provider": credential.provider.name,
            "status": credential.status,
            "configured": credential.status == "active" and credential.encrypted_secret.startswith(("encrypted:", "gcp-secret:")),
            "last_four": credential.last_four,
            "created_at": credential.created_at.isoformat(),
            "updated_at": credential.updated_at.isoformat(),
        }
        for credential in credentials
    ]


def revoke_byok_api_key(db: Session, team_id: str, provider_name: str) -> ByokCredential:
    credential = db.scalar(
        select(ByokCredential)
        .join(Provider, Provider.id == ByokCredential.provider_id)
        .where(ByokCredential.team_id == team_id, Provider.name == provider_name)
    )
    if credential is None:
        raise compass_error(404, "byok_credential_not_found", "BYOK credential not found.")
    credential.encrypted_secret = ""
    credential.last_four = ""
    credential.status = "revoked"
    credential.updated_at = now()
    db.commit()
    return credential


def provider_credentials_summary(db: Session) -> list[dict]:
    providers = db.scalars(select(Provider).order_by(Provider.name)).all()
    credentials = db.scalars(select(ProviderCredential)).all()
    credential_by_provider = {credential.provider_id: credential for credential in credentials}
    rows = []
    for provider in providers:
        credential = credential_by_provider.get(provider.id)
        rows.append(
            {
                "id": provider.id,
                "name": provider.name,
                "enabled": provider.enabled,
                "status": provider.status,
                "credential_status": credential.status if credential else "missing",
                "has_configured_key": bool(credential and credential.secret_reference.startswith(("encrypted:", "gcp-secret:"))),
                "last_four": credential.last_four if credential and credential.last_four else "",
                "updated_at": credential.updated_at.isoformat() if credential else None,
            }
        )
    return rows


def test_platform_credential(db: Session, provider_name: str) -> dict:
    provider = db.scalar(select(Provider).where(Provider.name == provider_name))
    if provider is None:
        raise compass_error(404, "provider_not_found", "Provider was not found.")
    credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.provider_id == provider.id,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
        )
    )
    if credential is None or credential.status != "active" or not _has_usable_reference(credential.secret_reference):
        raise compass_error(409, "provider_credential_missing", "Save an active provider credential before testing it.")
    settings = get_settings()
    if settings.local_test_mode and credential.secret_reference.startswith("server-side/"):
        return {"provider": provider.name, "status": "local_test", "message": "Local test credential is available; no provider call was made."}
    secret = _credential_value(credential.secret_reference)
    if not secret:
        raise compass_error(503, "provider_credential_invalid", "The provider credential is empty or unavailable.")
    credential.last_tested_at = now()
    db.commit()
    return {"provider": provider.name, "status": "configured", "message": "Provider credential decrypted successfully; no paid model request was made."}


def configured_provider_secret(db: Session, provider_name: str) -> str | None:
    credential = db.scalar(
        select(ProviderCredential)
        .join(Provider, Provider.id == ProviderCredential.provider_id)
        .where(
            Provider.name == provider_name,
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.credential_mode == "platform",
            ProviderCredential.status == "active",
        )
    )
    if credential is None or not _has_usable_reference(credential.secret_reference):
        return None
    return _credential_value(credential.secret_reference)


def infer_openai_capabilities(model_id: str) -> list[str]:
    value = model_id.lower()
    if "embedding" in value:
        return ["embeddings"]
    if "image" in value or value.startswith("dall-e"):
        return ["images"]
    if any(term in value for term in ("audio", "transcribe", "tts", "whisper")):
        return ["audio"]
    return ["chat"]


async def discover_provider_models(db: Session) -> dict:
    sources: list[dict] = []
    timeout = httpx.Timeout(15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        openai_credential_error = False
        try:
            openai_key = configured_provider_secret(db, "openai")
        except HTTPException:
            openai_key = None
            openai_credential_error = True
            sources.append(
                {
                    "provider": "openai",
                    "status": "error",
                    "models": [],
                    "error": "The saved OpenAI credential cannot be decrypted. Re-save the provider key.",
                }
            )
        if openai_key:
            try:
                response = await client.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {openai_key}"})
                response.raise_for_status()
                rows = response.json().get("data", [])
                models = [
                    {
                        "provider": "openai",
                        "provider_model_id": row["id"],
                        "display_name": row["id"],
                        "capabilities": infer_openai_capabilities(row["id"]),
                        "context_window": None,
                        "metadata": {"owned_by": row.get("owned_by")},
                    }
                    for row in rows
                    if isinstance(row, dict) and isinstance(row.get("id"), str)
                ]
                sources.append({"provider": "openai", "status": "available", "models": models, "error": None})
            except (httpx.HTTPError, ValueError, TypeError):
                sources.append({"provider": "openai", "status": "error", "models": [], "error": "OpenAI model discovery failed. Verify the provider credential."})
        elif not openai_credential_error:
            sources.append({"provider": "openai", "status": "unconfigured", "models": [], "error": "Configure an OpenAI provider key to discover models."})

        gemini_credential_error = False
        try:
            gemini_key = configured_provider_secret(db, "gemini")
        except HTTPException:
            gemini_key = None
            gemini_credential_error = True
            sources.append(
                {
                    "provider": "gemini",
                    "status": "error",
                    "models": [],
                    "error": "The saved Gemini credential cannot be decrypted. Re-save the provider key.",
                }
            )
        if gemini_key:
            try:
                models = []
                page_token = None
                for _ in range(10):
                    params = {"pageSize": "1000"}
                    if page_token:
                        params["pageToken"] = page_token
                    response = await client.get(
                        "https://generativelanguage.googleapis.com/v1beta/models",
                        headers={"x-goog-api-key": gemini_key},
                        params=params,
                    )
                    response.raise_for_status()
                    payload = response.json()
                    for row in payload.get("models", []):
                        if not isinstance(row, dict) or not isinstance(row.get("name"), str):
                            continue
                        model_id = row["name"].removeprefix("models/")
                        methods = row.get("supportedGenerationMethods") or []
                        models.append(
                            {
                                "provider": "gemini",
                                "provider_model_id": model_id,
                                "display_name": row.get("displayName") or model_id,
                                "capabilities": sorted(str(method) for method in methods),
                                "context_window": row.get("inputTokenLimit"),
                                "metadata": {"output_token_limit": row.get("outputTokenLimit"), "version": row.get("version")},
                            }
                        )
                    page_token = payload.get("nextPageToken")
                    if not page_token:
                        break
                sources.append({"provider": "gemini", "status": "available", "models": models, "error": None})
            except (httpx.HTTPError, ValueError, TypeError):
                sources.append({"provider": "gemini", "status": "error", "models": [], "error": "Gemini model discovery failed. Verify the provider credential."})
        elif not gemini_credential_error:
            sources.append({"provider": "gemini", "status": "unconfigured", "models": [], "error": "Configure a Gemini provider key to discover models."})

        try:
            response = await client.get("https://ollama.com/api/tags")
            response.raise_for_status()
            rows = response.json().get("models", [])
            models = [
                {
                    "provider": "ollama_cloud",
                    "provider_model_id": row.get("model") or row.get("name"),
                    "display_name": row.get("name") or row.get("model"),
                    "capabilities": ["chat"],
                    "context_window": None,
                    "metadata": {
                        "family": (row.get("details") or {}).get("family"),
                        "parameter_size": (row.get("details") or {}).get("parameter_size"),
                    },
                }
                for row in rows
                if isinstance(row, dict) and isinstance(row.get("model") or row.get("name"), str)
            ]
            sources.append({"provider": "ollama_cloud", "status": "available", "models": models, "error": None})
        except (httpx.HTTPError, ValueError, TypeError):
            sources.append({"provider": "ollama_cloud", "status": "error", "models": [], "error": "Ollama Cloud model discovery failed."})

    published = {(row.provider.name, row.provider_model_id): row.id for row in db.scalars(select(ModelCatalog)).all()}
    all_models = []
    for source in sources:
        for model in source["models"]:
            model["compass_model_id"] = published.get((model["provider"], model["provider_model_id"]))
            all_models.append(model)
        source["count"] = len(source["models"])
    all_models.sort(key=lambda row: (row["provider"], row["provider_model_id"].lower()))
    return {"models": all_models, "sources": sources, "total": len(all_models), "refreshed_at": now().isoformat()}


BYOK_SINGLE_KEY_PROVIDERS = {
    "ai21",
    "anthropic",
    "cohere",
    "deepinfra",
    "deepseek",
    "fireworks_ai",
    "gemini",
    "groq",
    "mistral",
    "novita",
    "openai",
    "openrouter",
    "perplexity",
    "replicate",
    "together_ai",
    "voyage",
    "xai",
}
_litellm_catalog_cache: dict = {"expires_at": 0.0, "models": [], "sources": []}


def _native_model_id(provider: str, raw_model_id: str) -> str:
    return native_model_id(provider, raw_model_id)


def _catalog_capabilities(row: dict) -> list[str]:
    capabilities = [str(row.get("mode") or "unknown")]
    flags = {
        "supports_audio_input": "audio-input",
        "supports_audio_output": "audio-output",
        "supports_function_calling": "tools",
        "supports_reasoning": "reasoning",
        "supports_response_schema": "structured-output",
        "supports_vision": "vision",
        "supports_web_search": "web-search",
    }
    capabilities.extend(label for field, label in flags.items() if row.get(field) is True)
    return capabilities


def _as_number(value) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


OPENROUTER_CATALOG_SOURCE = "openrouter"


def _decimal_value(value: object) -> Decimal:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")
    return parsed if parsed.is_finite() and parsed >= 0 else Decimal("0")


def _openrouter_capabilities(row: dict) -> tuple[list[str], list[str], list[str]]:
    architecture = row.get("architecture") if isinstance(row.get("architecture"), dict) else {}
    inputs = sorted({str(value).lower() for value in architecture.get("input_modalities", []) if isinstance(value, str)})
    outputs = sorted({str(value).lower() for value in architecture.get("output_modalities", []) if isinstance(value, str)})
    supported = sorted({str(value) for value in row.get("supported_parameters", []) if isinstance(value, str)})
    capabilities = {"chat"}
    if "image" in inputs:
        capabilities.add("vision")
    if "audio" in inputs or "audio" in outputs:
        capabilities.add("audio")
    if "image" in outputs:
        capabilities.add("images")
    if "tools" in supported or "tool_choice" in supported or "structured_outputs" in supported:
        capabilities.add("tools")
    if "reasoning" in supported or "reasoning" in row:
        capabilities.add("reasoning")
    if "embedding" in str(row.get("id", "")).lower():
        capabilities.discard("chat")
        capabilities.add("embeddings")
    return sorted(capabilities), inputs, outputs


def _active_pricing_policy(db: Session) -> PricingPolicy:
    policy = db.scalar(
        select(PricingPolicy)
        .where(PricingPolicy.status == "active", PricingPolicy.effective_at <= now())
        .order_by(PricingPolicy.effective_at.desc(), PricingPolicy.created_at.desc())
        .limit(1)
    )
    if policy is None:
        if get_settings().environment.strip().lower() in {"production", "prod"}:
            raise compass_error(503, "pricing_policy_unavailable", "An active customer pricing policy must be configured before catalog synchronization or activation.")
        policy = PricingPolicy(
            version="development-v1",
            markup_bps=get_settings().model_pricing_markup_bps,
            usd_to_inr_paise_per_usd=get_settings().usd_to_inr_paise_per_usd,
            status="active",
            effective_at=now(),
        )
        db.add(policy)
        db.flush()
    return policy


def ensure_default_pricing_policy(db: Session) -> PricingPolicy:
    return _active_pricing_policy(db)


def _customer_price_from_usd_per_token(raw_per_token: object, policy: PricingPolicy) -> int:
    usd_per_token = _decimal_value(raw_per_token)
    markup = Decimal(10_000 + policy.markup_bps) / Decimal(10_000)
    paise_per_1k = usd_per_token * Decimal(1_000) * Decimal(policy.usd_to_inr_paise_per_usd) * markup
    return max(0, int(paise_per_1k.to_integral_value(rounding=ROUND_CEILING)))


def _openrouter_customer_price(raw_per_token: object, policy: PricingPolicy) -> int:
    return _customer_price_from_usd_per_token(raw_per_token, policy)


def _source_created_at(value: object) -> datetime | None:
    if not isinstance(value, (int, float)):
        return None
    try:
        return datetime.fromtimestamp(value, UTC).replace(tzinfo=None)
    except (OverflowError, OSError, ValueError):
        return None


def _openrouter_model_values(raw: dict, policy: PricingPolicy, synced_at: datetime) -> dict:
    upstream_id = raw.get("id")
    if not isinstance(upstream_id, str) or not upstream_id.strip():
        raise ValueError("OpenRouter model is missing id")
    model_id = _native_model_id(OPENROUTER_CATALOG_SOURCE, upstream_id.strip())
    capabilities, input_modalities, output_modalities = _openrouter_capabilities(raw)
    capability_types = openrouter_capability_types(capabilities, input_modalities, output_modalities)
    architecture = raw.get("architecture") if isinstance(raw.get("architecture"), dict) else {}
    pricing = raw.get("pricing") if isinstance(raw.get("pricing"), dict) else {}
    context_window = raw.get("context_length")
    if not isinstance(context_window, int) or context_window < 1:
        context_window = 128_000
    raw_metadata = {
        "description": raw.get("description") if isinstance(raw.get("description"), str) else "",
        "canonical_slug": raw.get("canonical_slug") if isinstance(raw.get("canonical_slug"), str) else upstream_id,
        "architecture": architecture,
        "supported_parameters": raw.get("supported_parameters") if isinstance(raw.get("supported_parameters"), list) else [],
        "input_modalities": input_modalities,
        "output_modalities": output_modalities,
        "pricing": pricing,
        "top_provider": raw.get("top_provider") if isinstance(raw.get("top_provider"), dict) else {},
        "per_request_limits": raw.get("per_request_limits"),
    }
    return {
        "id": model_id,
        "provider_model_id": upstream_id,
        "display_name": raw.get("name") if isinstance(raw.get("name"), str) and raw["name"].strip() else upstream_id,
        "protocol": "openrouter_optional",
        "capabilities": ",".join(capabilities),
        "capability_types": capability_types,
        "input_modalities": input_modalities,
        "output_modalities": output_modalities,
        "context_window": context_window,
        "input_price_usd_per_million": _decimal_value(pricing.get("prompt")) * Decimal(1_000_000),
        "output_price_usd_per_million": _decimal_value(pricing.get("completion")) * Decimal(1_000_000),
        "input_price_paise_per_1k": _openrouter_customer_price(pricing.get("prompt"), policy),
        "output_price_paise_per_1k": _openrouter_customer_price(pricing.get("completion"), policy),
        "raw_metadata_json": json.dumps(raw_metadata, sort_keys=True, separators=(",", ":")),
        "source_created_at": _source_created_at(raw.get("created")),
        "last_synced_at": synced_at,
        "pricing_policy_version": policy.version,
    }


async def _fetch_openrouter_catalog(settings, etag: str | None = None) -> tuple[int, dict | None, str | None]:
    headers = {"Accept": "application/json"}
    if settings.openrouter_api_key:
        headers["Authorization"] = f"Bearer {settings.openrouter_api_key}"
    if etag:
        headers["If-None-Match"] = etag
    async with httpx.AsyncClient(timeout=settings.openrouter_timeout_seconds) as client:
        response = await client.get(f"{settings.openrouter_base_url.rstrip('/')}/models", headers=headers)
    if response.status_code == 304:
        return 304, None, response.headers.get("etag") or etag
    if response.status_code == 429 or response.status_code >= 500:
        raise httpx.HTTPStatusError("OpenRouter catalog request can be retried", request=response.request, response=response)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise ValueError("OpenRouter catalog response did not contain a data list")
    return response.status_code, payload, response.headers.get("etag")


def catalog_sync_status(db: Session, source: str, stale_after_seconds: int) -> dict:
    runs = db.scalars(select(CatalogSyncRun).where(CatalogSyncRun.source == source).order_by(CatalogSyncRun.started_at.desc()).limit(20)).all()
    latest = runs[0] if runs else None
    last_success = next((run for run in runs if run.status in {"success", "not_modified"}), None)
    stale = last_success is None or last_success.stale_after_at is None or last_success.stale_after_at < now()
    return {
        "source": source,
        "status": latest.status if latest else "never_synced",
        "last_attempt_at": latest.started_at.isoformat() if latest else None,
        "last_success_at": last_success.completed_at.isoformat() if last_success and last_success.completed_at else None,
        "source_revision": last_success.source_revision if last_success else None,
        "model_count": last_success.model_count if last_success else 0,
        "stale": stale,
        "error": latest.error_message if latest and latest.status == "failed" else None,
    }


def openrouter_catalog_rows(db: Session) -> list[dict]:
    return [row for row in model_catalog_rows(db, include_unpublished=True) if row["catalog_source"] == OPENROUTER_CATALOG_SOURCE]


def openrouter_catalog_response(db: Session) -> dict:
    status = catalog_sync_status(db, OPENROUTER_CATALOG_SOURCE, get_settings().openrouter_catalog_stale_after_seconds)
    return {
        "source": OPENROUTER_CATALOG_SOURCE,
        "models": openrouter_catalog_rows(db),
        "total": len(openrouter_catalog_rows(db)),
        "sync": status,
        "stale": status["stale"],
        "pricing_policy": pricing_policy_row(_active_pricing_policy(db)),
    }


def pricing_policy_row(policy: PricingPolicy) -> dict:
    return {
        "id": policy.id,
        "version": policy.version,
        "markup_bps": policy.markup_bps,
        "usd_to_inr_paise_per_usd": policy.usd_to_inr_paise_per_usd,
        "status": policy.status,
        "effective_at": policy.effective_at.isoformat(),
    }


async def sync_openrouter_catalog(db: Session, *, force: bool = False) -> dict:
    settings = get_settings()
    latest_success = db.scalar(
        select(CatalogSyncRun)
        .where(CatalogSyncRun.source == OPENROUTER_CATALOG_SOURCE, CatalogSyncRun.status.in_(["success", "not_modified"]))
        .order_by(CatalogSyncRun.started_at.desc())
        .limit(1)
    )
    if not force and latest_success and latest_success.completed_at and latest_success.completed_at >= now() - timedelta(seconds=settings.openrouter_catalog_cache_seconds):
        return openrouter_catalog_response(db)
    started_at = now()
    run = CatalogSyncRun(source=OPENROUTER_CATALOG_SOURCE, status="running", started_at=started_at, raw_snapshot_json="{}")
    db.add(run)
    db.commit()
    payload = None
    response_etag = latest_success.etag if latest_success else None
    last_error = ""
    attempts = max(1, min(settings.openrouter_catalog_sync_max_attempts, 5))
    for attempt in range(attempts):
        try:
            status_code, payload, response_etag = await _fetch_openrouter_catalog(settings, latest_success.etag if latest_success else None)
            if status_code == 304:
                run.status = "not_modified"
                run.source_revision = latest_success.source_revision if latest_success else None
                run.etag = response_etag
                run.model_count = latest_success.model_count if latest_success else 0
                run.raw_snapshot_json = latest_success.raw_snapshot_json if latest_success else "{}"
                run.completed_at = now()
                run.stale_after_at = run.completed_at + timedelta(seconds=settings.openrouter_catalog_stale_after_seconds)
                db.commit()
                return openrouter_catalog_response(db)
            break
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            last_error = str(exc)[:500]
            if attempt + 1 < attempts:
                await asyncio.sleep(max(0.0, settings.openrouter_catalog_backoff_seconds) * (2**attempt))
    if payload is None:
        run.status = "failed"
        run.error_message = last_error or "OpenRouter catalog request failed"
        run.completed_at = now()
        db.commit()
        if latest_success:
            return openrouter_catalog_response(db)
        raise compass_error(503, "openrouter_catalog_unavailable", "OpenRouter catalog is unavailable and no previous snapshot exists.") from None

    policy = _active_pricing_policy(db)
    raw_models = payload["data"]
    synced_at = now()
    normalized: list[dict] = []
    for raw in raw_models:
        if not isinstance(raw, dict):
            continue
        try:
            normalized.append(_openrouter_model_values(raw, policy, synced_at))
        except ValueError:
            continue
    if not normalized:
        run.status = "failed"
        run.error_message = "OpenRouter catalog contained no valid model records"
        run.completed_at = now()
        db.commit()
        if latest_success:
            return openrouter_catalog_response(db)
        raise compass_error(503, "openrouter_catalog_invalid", "OpenRouter catalog contained no valid model records.") from None

    provider = ensure_provider(db, OPENROUTER_CATALOG_SOURCE)
    provider.protocol = "openrouter_optional"
    provider.catalog_source = OPENROUTER_CATALOG_SOURCE
    seen_ids = set()
    for values in normalized:
        seen_ids.add(values["id"])
        model = db.get(ModelCatalog, values["id"])
        if model is None:
            model = ModelCatalog(
                id=values["id"],
                provider_id=provider.id,
                provider_model_id=values["provider_model_id"],
                display_name=values["display_name"],
                protocol=values["protocol"],
                capabilities=values["capabilities"],
                capability_types=",".join(values["capability_types"]),
                input_modalities=json.dumps(values["input_modalities"]),
                output_modalities=json.dumps(values["output_modalities"]),
                context_window=values["context_window"],
                input_price_paise_per_1k=values["input_price_paise_per_1k"],
                output_price_paise_per_1k=values["output_price_paise_per_1k"],
                enabled=False,
                published=False,
                status="unavailable",
            )
            db.add(model)
        model.provider_id = provider.id
        model.provider_model_id = values["provider_model_id"]
        model.display_name = values["display_name"]
        model.protocol = values["protocol"]
        model.capabilities = values["capabilities"]
        model.capability_types = ",".join(values["capability_types"])
        model.input_modalities = json.dumps(values["input_modalities"])
        model.output_modalities = json.dumps(values["output_modalities"])
        model.context_window = values["context_window"]
        model.input_price_paise_per_1k = values["input_price_paise_per_1k"]
        model.output_price_paise_per_1k = values["output_price_paise_per_1k"]
        model.input_price_usd_per_million = values["input_price_usd_per_million"]
        model.output_price_usd_per_million = values["output_price_usd_per_million"]
        model.raw_metadata_json = values["raw_metadata_json"]
        model.catalog_source = OPENROUTER_CATALOG_SOURCE
        model.pricing_policy_version = values["pricing_policy_version"]
        model.source_created_at = values["source_created_at"]
        model.last_synced_at = values["last_synced_at"]
        model.supports_tools = "tools" in values["capabilities"]
        model.supports_reasoning = "reasoning" in values["capabilities"]
        model.supports_vision = "vision" in values["capabilities"]
        if model.enabled and model.published:
            model.status = "available"
        else:
            model.status = "unavailable"
    for model in db.scalars(select(ModelCatalog).where(ModelCatalog.catalog_source == OPENROUTER_CATALOG_SOURCE)).all():
        if model.id not in seen_ids:
            model.enabled = False
            model.published = False
            model.status = "unavailable"

    snapshot = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    run.status = "success"
    run.source_revision = hashlib.sha256(snapshot.encode("utf-8")).hexdigest()
    run.etag = response_etag
    run.model_count = len(normalized)
    run.raw_snapshot_json = snapshot
    run.completed_at = now()
    run.stale_after_at = run.completed_at + timedelta(seconds=settings.openrouter_catalog_stale_after_seconds)
    db.commit()
    return openrouter_catalog_response(db)


async def litellm_model_catalog(db: Session, *, force: bool = False) -> dict:
    settings = get_settings()
    current_time = time.monotonic()
    if not force and _litellm_catalog_cache["models"] and current_time < _litellm_catalog_cache["expires_at"]:
        cached_models = _litellm_catalog_cache["models"]
        cached_sources = _litellm_catalog_cache["sources"]
    else:
        base_url = (settings.compass_litellm_url or settings.litellm_url).rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=settings.litellm_timeout_seconds) as client:
                response = await client.get(f"{base_url}/public/litellm_model_cost_map")
                response.raise_for_status()
                raw_catalog = response.json()
        except (httpx.HTTPError, ValueError, TypeError):
            raise compass_error(503, "model_catalog_unavailable", "The controlled LiteLLM model registry is unavailable.") from None
        if not isinstance(raw_catalog, dict):
            raise compass_error(503, "model_catalog_unavailable", "The controlled LiteLLM model registry is invalid.")

        cached_models = normalize_litellm_cost_map(raw_catalog)
        provider_counts: dict[str, int] = {}
        for row in cached_models:
            provider_counts[row["provider"]] = provider_counts.get(row["provider"], 0) + 1
        cached_sources = [
            {"provider": provider, "status": "available", "count": count, "error": None}
            for provider, count in sorted(provider_counts.items(), key=lambda item: (-item[1], item[0]))
        ]
        _litellm_catalog_cache.update(
            expires_at=current_time + settings.litellm_catalog_cache_seconds,
            models=cached_models,
            sources=cached_sources,
        )

    published_ids = set(db.scalars(select(ModelCatalog.id).where(ModelCatalog.enabled.is_(True), ModelCatalog.published.is_(True))).all())
    models = [row | {"compass_model_id": row["provider_model_id"] if row["provider_model_id"] in published_ids else None} for row in cached_models]
    return {
        "models": models,
        "sources": cached_sources,
        "total": len(models),
        "refreshed_at": now().isoformat(),
        "catalog_source": "controlled-litellm-runtime",
        "scope_note": "LiteLLM-maintained provider registry; not a claim that every model on the internet is callable.",
    }


def provider_catalog_response(db: Session, *, provider: str | None = None) -> dict:
    rows = model_catalog_rows(db, include_unpublished=True)
    if provider:
        rows = [row for row in rows if row["provider"] == provider]
    grouped: dict[str, int] = {}
    for row in rows:
        grouped[row["provider"]] = grouped.get(row["provider"], 0) + 1
    providers = {row.name: row for row in db.scalars(select(Provider)).all()}
    sources = []
    for name, count in sorted(grouped.items()):
        provider_row = providers.get(name)
        if provider_row is None:
            status = "unconfigured"
        elif provider_row.enabled and provider_row.status not in {"disabled", "unavailable", "unconfigured"}:
            status = "available" if provider_row.commercial_status == "approved" or get_settings().local_test_mode else "commercial_unapproved"
        else:
            status = provider_row.status
        sources.append({"provider": name, "status": status, "commercial_status": provider_row.commercial_status if provider_row else "unreviewed", "count": count, "error": None})
    return {
        "models": rows,
        "sources": sources,
        "total": len(rows),
        "refreshed_at": now().isoformat(),
        "catalog_source": "compass-registry",
        "scope_note": "Compass-owned registry; route availability is based on verified provider credentials and policies.",
    }


async def sync_litellm_catalog(db: Session, *, force: bool = False) -> dict:
    """Persist the controlled LiteLLM discovery snapshot into the shared registry."""

    settings = get_settings()
    latest = db.scalar(
        select(CatalogSyncRun)
        .where(CatalogSyncRun.source == "litellm")
        .order_by(CatalogSyncRun.started_at.desc())
        .limit(1)
    )
    if not force and latest and latest.status in {"success", "not_modified"} and latest.completed_at and latest.completed_at >= now() - timedelta(seconds=settings.litellm_catalog_cache_seconds):
        return provider_catalog_response(db, provider=None)

    run = CatalogSyncRun(source="litellm", status="running", started_at=now(), raw_snapshot_json="{}")
    db.add(run)
    db.commit()
    try:
        catalog = await litellm_model_catalog(db, force=force)
    except HTTPException as exc:
        run.status = "failed"
        run.error_message = str(exc.detail)
        run.completed_at = now()
        db.commit()
        if latest and latest.status in {"success", "not_modified"}:
            return provider_catalog_response(db)
        raise

    policy = _active_pricing_policy(db)
    records = catalog["models"]
    snapshot = {"models": records, "source": "litellm"}
    run.source_revision = snapshot_revision(snapshot)
    run.raw_snapshot_json = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
    run.model_count = len(records)
    run.status = "success"
    run.completed_at = now()
    run.stale_after_at = run.completed_at + timedelta(seconds=settings.litellm_catalog_cache_seconds * 3)
    seen_ids: set[str] = set()
    verified_at = now()

    for record in records:
        model_id = record["provider_model_id"]
        seen_ids.add(model_id)
        provider = ensure_provider(db, record["provider"])
        provider.protocol = record.get("protocol") or provider_protocol(record["provider"])
        provider.catalog_source = "litellm"
        provider.last_verified_at = verified_at
        model = db.get(ModelCatalog, model_id)
        if model is None:
            model = ModelCatalog(
                id=model_id,
                provider_id=provider.id,
                provider_model_id=record["provider_model_id"],
                display_name=record["display_name"],
                protocol=provider.protocol,
                capabilities=",".join(record["capabilities"]),
                capability_types=",".join(record["capability_types"]),
                input_modalities=json.dumps(record["input_modalities"]),
                output_modalities=json.dumps(record["output_modalities"]),
                context_window=record["context_window"] or 0,
                max_output_tokens=record["max_output_tokens"],
                enabled=False,
                published=False,
                status="unavailable",
                route_readiness_reason="discovered; activation and credentials required",
                catalog_source="litellm",
            )
            db.add(model)
        model.provider_id = provider.id
        model.provider_model_id = record["provider_model_id"]
        model.display_name = record["display_name"]
        model.protocol = provider.protocol
        model.capabilities = ",".join(record["capabilities"])
        model.capability_types = ",".join(record["capability_types"])
        model.input_modalities = json.dumps(record["input_modalities"])
        model.output_modalities = json.dumps(record["output_modalities"])
        model.context_window = record["context_window"] or 0
        model.max_output_tokens = record["max_output_tokens"]
        model.input_price_usd_per_million = record["input_cost_per_million_usd"]
        model.output_price_usd_per_million = record["output_cost_per_million_usd"]
        model.input_price_paise_per_1k = _customer_price_from_usd_per_token(record["input_cost_per_token"], policy) if record["input_cost_per_token"] is not None else 0
        model.output_price_paise_per_1k = _customer_price_from_usd_per_token(record["output_cost_per_token"], policy) if record["output_cost_per_token"] is not None else 0
        model.raw_metadata_json = json.dumps(record["metadata"], sort_keys=True, separators=(",", ":"), default=str)
        model.catalog_source = "litellm"
        model.pricing_policy_version = policy.version
        model.last_synced_at = verified_at
        model.supports_tools = "tools" in record["capabilities"]
        model.supports_reasoning = "reasoning" in record["capabilities"]
        model.supports_vision = "vision" in record["capabilities"]
        if not record["input_cost_per_token"] and not record["output_cost_per_token"]:
            model.status = "unavailable"
            model.route_readiness_reason = "provider did not publish billable pricing"
        elif not model.enabled or not model.published:
            model.status = "unavailable"
            model.route_readiness_reason = "discovered; activation and credentials required"
        else:
            model.status = "available"
            model.route_readiness_reason = "activated catalog route"

    for model in db.scalars(select(ModelCatalog).where(ModelCatalog.catalog_source == "litellm")).all():
        if model.id not in seen_ids:
            model.enabled = False
            model.published = False
            model.status = "retired"
            model.route_readiness_reason = "not present in the latest provider snapshot"
    db.commit()
    return provider_catalog_response(db)


def credential_provider_names(db: Session, team_id: str) -> set[str]:
    byok = set(
        db.scalars(
            select(Provider.name)
            .join(ByokCredential, ByokCredential.provider_id == Provider.id)
            .where(
                ByokCredential.team_id == team_id,
                ByokCredential.status == "active",
                ByokCredential.encrypted_secret.like("encrypted:%") | ByokCredential.encrypted_secret.like("gcp-secret:%"),
            )
        ).all()
    )
    platform = set(
        db.scalars(
            select(Provider.name)
            .join(ProviderCredential, ProviderCredential.provider_id == Provider.id)
            .where(
                ProviderCredential.organization_id.is_(None),
                ProviderCredential.status.in_(["active", "local_test"]),
                (ProviderCredential.secret_reference.like("encrypted:%") | ProviderCredential.secret_reference.like("gcp-secret:%") | ((ProviderCredential.secret_reference.like("server-side/%")) & (ProviderCredential.status == "local_test"))),
            )
        ).all()
    )
    return byok | platform


async def activate_catalog_model(db: Session, team_id: str, model_id: str) -> dict:
    persisted = db.get(ModelCatalog, model_id)
    row = None
    if persisted is not None and persisted.catalog_source in {OPENROUTER_CATALOG_SOURCE, "litellm"}:
        row = {
            "provider": persisted.provider.name,
            "provider_model_id": persisted.provider_model_id,
            "display_name": persisted.display_name,
            "protocol": persisted.protocol,
            "capabilities": [item for item in persisted.capabilities.split(",") if item],
            "capability_types": [item for item in persisted.capability_types.split(",") if item],
            "context_window": persisted.context_window,
        }
    else:
        catalog = await litellm_model_catalog(db)
        row = next((item for item in catalog["models"] if item["provider_model_id"] == model_id), None)
    if row is None:
        raise compass_error(404, "model_not_found", "Model is not present in the controlled LiteLLM registry.")
    capability_types = row.get("capability_types")
    if not isinstance(capability_types, (list, tuple, set)) or not capability_types:
        raise compass_error(409, "provider_capability_unsupported", "The provider catalog did not publish a verified Compass capability for this model.")
    if provider_protocol(row["provider"]) == "unverified":
        raise compass_error(409, "provider_adapter_unavailable", "This provider has no verified Compass adapter.")
    adapter_protocol = row.get("protocol") or provider_protocol(row["provider"])
    unsupported_capabilities = [
        capability
        for capability in capability_types
        if not _provider_adapter_registry.supports_capability(adapter_protocol, str(capability))
    ]
    if unsupported_capabilities:
        raise compass_error(409, "provider_capability_unsupported", "The registered provider adapter cannot execute: " + ", ".join(sorted(map(str, unsupported_capabilities))))
    if row["provider"] not in credential_provider_names(db, team_id):
        raise compass_error(409, "provider_credential_required", "Configure a platform or team provider credential before enabling the model.")

    provider = ensure_provider(db, row["provider"])
    if not provider.enabled or provider.status in {"unconfigured", "disabled", "unavailable"}:
        raise compass_error(409, "provider_route_unavailable", f"Provider {row['provider']} is not enabled. A platform administrator must verify and enable this provider before activating its models.")
    if not get_settings().local_test_mode and provider.commercial_status != "approved":
        raise compass_error(409, "provider_commercial_approval_required", "Commercial approval is required before enabling this provider route.")
    if persisted is not None and persisted.catalog_source in {OPENROUTER_CATALOG_SOURCE, "litellm"}:
        if not get_settings().local_test_mode:
            policy = _active_pricing_policy(db)
            if (
                not persisted.pricing_policy_version
                or persisted.pricing_policy_version != policy.version
                or persisted.input_price_usd_per_million is None
                or persisted.output_price_usd_per_million is None
            ):
                raise compass_error(409, "model_pricing_unavailable", "Refresh the provider catalog and apply an active customer pricing policy before enabling this model.")
        persisted.enabled = True
        persisted.published = True
        persisted.status = "available"
        persisted.route_readiness_reason = "activated with verified provider credential"
        persisted.supports_tools = "tools" in persisted.capabilities
        persisted.supports_reasoning = "reasoning" in persisted.capabilities
        persisted.supports_vision = "vision" in persisted.capabilities
        db.commit()
        return next(item for item in model_catalog_rows(db) if item["id"] == model_id)
    policy = _active_pricing_policy(db)
    input_cost = row.get("input_cost_per_token")
    output_cost = row.get("output_cost_per_token")
    if input_cost is None and row.get("input_cost_per_million_usd") is not None:
        input_cost = Decimal(str(row["input_cost_per_million_usd"])) / Decimal(1_000_000)
    if output_cost is None and row.get("output_cost_per_million_usd") is not None:
        output_cost = Decimal(str(row["output_cost_per_million_usd"])) / Decimal(1_000_000)
    if input_cost is None or output_cost is None:
        raise compass_error(409, "model_pricing_unavailable", "The provider did not publish billable pricing for this model.")
    input_paise = _customer_price_from_usd_per_token(input_cost, policy)
    output_paise = _customer_price_from_usd_per_token(output_cost, policy)
    upsert_model(
        db,
        model_id=model_id,
        provider=provider,
        provider_model_id=model_id,
        display_name=row["display_name"],
        capabilities=",".join(row["capabilities"]),
        context_window=row["context_window"] or 128000,
        input_price_paise_per_1k=input_paise,
        output_price_paise_per_1k=output_paise,
        protocol=row.get("protocol"),
        capability_types=",".join(row.get("capability_types") or []),
        input_modalities=row.get("input_modalities") or [],
        output_modalities=row.get("output_modalities") or [],
        max_output_tokens=row.get("max_output_tokens"),
    )
    db.flush()
    model = db.get(ModelCatalog, model_id)
    model.enabled = True
    model.published = True
    model.status = "available"
    model.route_readiness_reason = "activated with verified provider credential"
    model.catalog_source = "litellm"
    model.input_price_usd_per_million = row.get("input_cost_per_million_usd")
    model.output_price_usd_per_million = row.get("output_cost_per_million_usd")
    model.pricing_policy_version = policy.version
    model.last_synced_at = now()
    model.supports_tools = "tools" in row["capabilities"]
    model.supports_reasoning = "reasoning" in row["capabilities"]
    model.supports_vision = "vision" in row["capabilities"]
    db.commit()
    return next(item for item in model_catalog_rows(db) if item["id"] == model_id)


def create_team(db: Session, name: str, slug: str, notes: str = "", organization_id: str | None = None, project_id: str | None = None) -> Team:
    if db.scalar(select(Team).where(Team.slug == slug)):
        raise compass_error(409, "team_exists", "A team already exists for this slug.")
    if organization_id and project_id is None:
        project_id = ensure_default_project(db, organization_id).id
    team = Team(organization_id=organization_id, project_id=project_id, name=name, slug=slug, notes=notes)
    db.add(team)
    db.flush()
    settings = get_settings()
    db.add(
        TeamLimit(
            team_id=team.id,
            requests_per_minute=settings.default_team_request_limit_per_minute,
            tokens_per_minute=settings.default_team_token_limit_per_minute,
            daily_spend_limit_paise=settings.default_team_daily_spend_limit_paise,
            monthly_spend_limit_paise=settings.default_team_monthly_spend_limit_paise,
        )
    )
    db.add(WalletAccount(team_id=team.id, balance_paise=0))
    db.commit()
    return team


def create_team_member(db: Session, team_id: str, name: str, email: str, role: str) -> TeamMember:
    team = db.get(Team, team_id)
    if team is None or not team.is_active:
        raise compass_error(404, "team_not_found", "Team not found.")
    if db.scalar(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.email == email.lower())):
        raise compass_error(409, "member_exists", "A member already exists for this team and email.")
    member = TeamMember(team_id=team_id, name=name, email=email.lower(), role=role)
    db.add(member)
    db.commit()
    return member


def create_api_key(db: Session, user_id: str, team_id: str, member_id: str | None, name: str, allowed_models: list[str], expires_at=None, project_id: str | None = None, purpose: str = "workspace") -> dict:
    team = db.get(Team, team_id)
    if team is None or not team.is_active:
        raise compass_error(404, "team_not_found", "Team not found.")
    project_id = project_id or team.project_id
    if team.organization_id and project_id is None:
        project_id = ensure_default_project(db, team.organization_id).id
    if project_id is not None:
        project = db.get(Project, project_id)
        if project is None or project.organization_id != team.organization_id or not project.is_active:
            raise compass_error(400, "project_team_mismatch", "The selected project does not belong to this team.")
    if member_id is not None:
        member = db.get(TeamMember, member_id)
        if member is None or member.team_id != team_id or not member.is_active:
            raise compass_error(404, "member_not_found", "Team member not found.")
    unique_models = sorted(set(allowed_models))
    for model_id in unique_models:
        model = db.get(ModelCatalog, model_id)
        if (
            model is None
            or not model.enabled
            or not model.published
            or model.status != "available"
            or not model.provider.enabled
            or model.provider.status in {"disabled", "unavailable"}
            or (not get_settings().local_test_mode and model.provider.commercial_status != "approved")
            or not _catalog_model_is_fresh(model)
        ):
            raise compass_error(404, "model_not_found", f"Model is not available: {model_id}")
    secret, key_id, key_prefix, key_hash = generate_api_key()
    if expires_at is not None and expires_at.tzinfo is not None:
        expires_at = expires_at.astimezone(UTC).replace(tzinfo=None)
    key = ApiKey(key_id=key_id, key_prefix=key_prefix, key_hash=key_hash, user_id=user_id, organization_id=team.organization_id, project_id=project_id, team_id=team_id, member_id=member_id, name=name, purpose=purpose, expires_at=expires_at)
    db.add(key)
    db.flush()
    for model_id in unique_models:
        db.add(ApiKeyModel(api_key_id=key.id, model_id=model_id))
    db.commit()
    effective_models = allowed_model_ids(db, key.id)
    return {"id": key.id, "key": secret, "key_id": key_id, "key_prefix": key_prefix, "name": name, "purpose": purpose, "project_id": project_id, "allowed_models": sorted(effective_models), "models_restricted": bool(unique_models)}


def revoke_api_key(db: Session, api_key_id: str) -> ApiKey:
    key = db.get(ApiKey, api_key_id)
    if key is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    key.status = "revoked"
    key.revoked_at = now()
    db.commit()
    return key


def rotate_api_key(db: Session, api_key_id: str, actor_user_id: str) -> dict:
    """Atomically revoke a key and issue a replacement with the same scope."""

    key = db.scalar(select(ApiKey).where(ApiKey.id == api_key_id).with_for_update())
    if key is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    if key.status != "active":
        raise compass_error(409, "api_key_not_active", "Only an active API key can be rotated.")

    secret, key_id, key_prefix, key_hash = generate_api_key()
    replacement = ApiKey(
        key_id=key_id,
        key_prefix=key_prefix,
        key_hash=key_hash,
        user_id=key.user_id or actor_user_id,
        organization_id=key.organization_id,
        project_id=key.project_id,
        team_id=key.team_id,
        member_id=key.member_id,
        name=key.name,
        purpose=key.purpose,
        scopes_json=key.scopes_json,
        expires_at=key.expires_at,
        daily_limit=key.daily_limit,
        monthly_limit=key.monthly_limit,
        rate_limit=key.rate_limit,
    )
    db.add(replacement)
    db.flush()
    grants = db.scalars(select(ApiKeyModel.model_id).where(ApiKeyModel.api_key_id == key.id)).all()
    for model_id in grants:
        db.add(ApiKeyModel(api_key_id=replacement.id, model_id=model_id))
    key.status = "revoked"
    key.revoked_at = now()
    db.commit()
    return {
        "id": replacement.id,
        "key": secret,
        "key_id": replacement.key_id,
        "key_prefix": replacement.key_prefix,
        "name": replacement.name,
        "purpose": replacement.purpose,
        "project_id": replacement.project_id,
        "allowed_models": sorted(grants),
        "models_restricted": bool(grants),
        "rotated_from": key.id,
    }


def authenticate_api_key(db: Session, bearer: str | None, project_id: str | None = None) -> ApiKey:
    if not bearer or not bearer.startswith("Bearer "):
        raise compass_error(401, "missing_api_key", "Missing Compass API key.")
    secret = bearer.removeprefix("Bearer ").strip()
    device_session = None
    if secret.startswith("cmp_device_"):
        device_session = db.scalar(select(ExtensionSession).where(ExtensionSession.token_hash == hash_api_key(secret)))
        if device_session is None or device_session.revoked_at is not None or device_session.expires_at < now():
            raise compass_error(401, "invalid_device_session", "The VS Code device session has expired or been revoked.")
        device = db.get(ExtensionDevice, device_session.device_id)
        if device is None or device.status != "active":
            raise compass_error(401, "invalid_device_session", "The VS Code device has been revoked.")
        device.last_seen_at = now()
        key = db.get(ApiKey, device_session.api_key_id)
        device_session_context.set(device_session.id)
    else:
        key = db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_api_key(secret)))
    if key is None:
        raise compass_error(401, "invalid_api_key", "Invalid Compass API key.")
    if key.status != "active":
        raise compass_error(401, "revoked_api_key", "Compass API key has been revoked.")
    if key.expires_at is not None and key.expires_at < now():
        raise compass_error(401, "expired_api_key", "Compass API key has expired.")
    if key.team_id is None:
        raise compass_error(401, "invalid_api_key", "Compass API key is not assigned to a team.")
    team = db.get(Team, key.team_id)
    if team is None or not team.is_active:
        raise compass_error(401, "team_disabled", "Compass team is disabled.")
    if key.organization_id and team.organization_id != key.organization_id:
        raise compass_error(401, "invalid_api_key", "Compass API key organization scope is invalid.")
    project_id = project_id or api_project_context.get()
    if project_id:
        project = db.get(Project, project_id)
        if project is None or not project.is_active or project.organization_id != team.organization_id:
            raise compass_error(403, "project_access_denied", "This API key cannot access the selected project.")
        if team.project_id and team.project_id != project_id:
            raise compass_error(403, "project_access_denied", "This API key is not assigned to the selected project.")
        if key.project_id and project_id != key.project_id:
            raise compass_error(403, "project_access_denied", "This API key is not assigned to the selected project.")
        if key.project_id is None:
            assigned_user_id = key.user_id
            if key.member_id:
                assigned_member = db.get(TeamMember, key.member_id)
                assigned_user_id = assigned_member.user_id if assigned_member and assigned_member.user_id else assigned_user_id
            organization_role = db.scalar(
                select(OrganizationMember.role).where(
                    OrganizationMember.organization_id == project.organization_id,
                    OrganizationMember.user_id == assigned_user_id,
                    OrganizationMember.role.in_(["owner", "admin"]),
                )
            ) if assigned_user_id else None
            project_membership = db.scalar(
                select(ProjectMember.id).where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == assigned_user_id,
                    ProjectMember.status == "active",
                )
            ) if assigned_user_id else None
            if organization_role is None and project_membership is None:
                raise compass_error(403, "project_access_denied", "The API key owner is not authorized for the selected project.")
    key.last_used_at = now()
    db.commit()
    return key


def allowed_model_ids(db: Session, api_key_id: str) -> set[str]:
    explicit = set(db.scalars(select(ApiKeyModel.model_id).where(ApiKeyModel.api_key_id == api_key_id)).all())
    if explicit:
        return explicit
    return {row["id"] for row in model_catalog_rows(db)}


def api_key_models_restricted(db: Session, api_key_id: str) -> bool:
    return db.scalar(select(ApiKeyModel.id).where(ApiKeyModel.api_key_id == api_key_id).limit(1)) is not None


def update_api_key_models(db: Session, api_key_id: str, allowed_models: list[str]) -> dict:
    key = db.get(ApiKey, api_key_id)
    if key is None:
        raise compass_error(404, "api_key_not_found", "API key not found.")
    unique_models = sorted(set(allowed_models))
    for model_id in unique_models:
        model = db.get(ModelCatalog, model_id)
        if (
            model is None
            or not model.enabled
            or not model.published
            or model.status != "available"
            or not model.provider.enabled
            or model.provider.status in {"disabled", "unavailable"}
            or (not get_settings().local_test_mode and model.provider.commercial_status != "approved")
            or not _catalog_model_is_fresh(model)
        ):
            raise compass_error(404, "model_not_found", f"Model is not available: {model_id}")
    db.query(ApiKeyModel).filter(ApiKeyModel.api_key_id == api_key_id).delete(synchronize_session=False)
    for model_id in unique_models:
        db.add(ApiKeyModel(api_key_id=api_key_id, model_id=model_id))
    db.commit()
    return {
        "id": key.id,
        "allowed_models": sorted(allowed_model_ids(db, key.id)),
        "models_restricted": bool(unique_models),
    }


def credit_wallet(db: Session, team_id: str, amount_paise: int, idempotency_key: str, reference_id: str, reference_type: str = "manual_test_credit", description: str = "Controlled beta test wallet credit") -> WalletLedger:
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id).with_for_update())
    if wallet is None:
        raise compass_error(404, "wallet_not_found", "Wallet not found.")
    existing = db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == idempotency_key))
    if existing:
        return existing
    before = wallet.balance_paise
    wallet.balance_paise += amount_paise
    wallet.updated_at = now()
    ledger = WalletLedger(wallet_id=wallet.id, type="credit", amount_paise=amount_paise, balance_before=before, balance_after=wallet.balance_paise, reference_type=reference_type, reference_id=reference_id, description=description, idempotency_key=idempotency_key)
    db.add(ledger)
    db.commit()
    return ledger


def debit_wallet(
    db: Session,
    team_id: str,
    amount_paise: int,
    idempotency_key: str,
    reference_id: str,
    reference_type: str = "llm_request",
    description: str = "Compass API usage charge",
) -> WalletLedger:
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id).with_for_update())
    existing = None if wallet is None else db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == idempotency_key))
    if existing:
        return existing
    if wallet is None or wallet.balance_paise < amount_paise:
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")
    before = wallet.balance_paise
    wallet.balance_paise -= amount_paise
    wallet.updated_at = now()
    ledger = WalletLedger(wallet_id=wallet.id, type="debit", amount_paise=-amount_paise, balance_before=before, balance_after=wallet.balance_paise, reference_type=reference_type, reference_id=reference_id, description=description, idempotency_key=idempotency_key)
    db.add(ledger)
    db.commit()
    return ledger


def reserve_wallet(db: Session, team_id: str, amount_paise: int, reservation_id: str) -> WalletLedger:
    """Hold the estimated charge before a provider call can spend paid balance."""
    return debit_wallet(
        db,
        team_id,
        amount_paise,
        f"llm-reservation:{reservation_id}",
        reservation_id,
        reference_type="llm_reservation",
        description="Reserved for in-flight Compass API usage",
    )


def settle_wallet_reservation(db: Session, team_id: str, reservation_id: str, actual_cost_paise: int, reference_id: str) -> WalletLedger | None:
    """Release the estimate and apply the final charge in one locked transaction."""
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id).with_for_update())
    if wallet is None:
        raise compass_error(404, "wallet_not_found", "Wallet not found.")
    reservation_key = f"llm-reservation:{reservation_id}"
    reservation = db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == reservation_key))
    if reservation is None:
        raise compass_error(409, "wallet_reservation_missing", "The in-flight wallet reservation could not be found.")
    settlement_key = f"llm-settlement:{reservation_id}"
    release_key = f"{settlement_key}:release"
    existing = db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == settlement_key))
    if existing is not None:
        return existing

    reserved_paise = max(0, -reservation.amount_paise)
    actual_paise = max(0, actual_cost_paise)
    existing_release = db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == release_key))
    if existing_release is None:
        before_release = wallet.balance_paise
        wallet.balance_paise += reserved_paise
        wallet.updated_at = now()
        db.add(
            WalletLedger(
                wallet_id=wallet.id,
                type="credit",
                amount_paise=reserved_paise,
                balance_before=before_release,
                balance_after=wallet.balance_paise,
                reference_type="llm_reservation_release",
                reference_id=reservation_id,
                description="Released unused Compass API reservation",
                idempotency_key=release_key,
            )
        )
    if actual_paise == 0:
        db.commit()
        return existing_release
    if wallet.balance_paise < actual_paise:
        db.rollback()
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient for the final provider charge.")
    before_charge = wallet.balance_paise
    wallet.balance_paise -= actual_paise
    wallet.updated_at = now()
    ledger = WalletLedger(
        wallet_id=wallet.id,
        type="debit",
        amount_paise=-actual_paise,
        balance_before=before_charge,
        balance_after=wallet.balance_paise,
        reference_type="llm_request",
        reference_id=reference_id,
        description="Compass API usage charge",
        idempotency_key=settlement_key,
    )
    db.add(ledger)
    db.commit()
    return ledger


@dataclass
class ResolvedRoute:
    model: ModelCatalog
    provider: Provider
    credential_mode: str
    secret_reference: str
    resolved_model_id: str


def _circuit_is_open(db: Session, provider_id: str) -> bool:
    latest = db.scalar(
        select(ProviderHealthCheck)
        .where(ProviderHealthCheck.provider_id == provider_id)
        .order_by(ProviderHealthCheck.last_checked_at.desc())
        .limit(1)
    )
    if latest is None or latest.status != "circuit_open":
        return False
    return latest.last_checked_at >= now() - timedelta(seconds=30)


def record_provider_health(db: Session, provider: Provider, *, success: bool, latency_ms: int, error_code: str | None = None) -> None:
    # Include the immediately preceding attempt when callers are composing
    # several health updates in one transaction, including SQLite tests.
    db.flush()
    recent = db.scalars(
        select(ProviderHealthCheck)
        .where(ProviderHealthCheck.provider_id == provider.id)
        .order_by(ProviderHealthCheck.last_checked_at.desc())
        .limit(2)
    ).all()
    checked_at = now()
    if recent and recent[0].last_checked_at is not None and recent[0].last_checked_at >= checked_at:
        # Preserve deterministic newest-first ordering when a database clock
        # has coarser precision than the request rate.
        checked_at = recent[0].last_checked_at + timedelta(microseconds=1)
    consecutive_failures = 0 if success else 1
    if not success:
        consecutive_failures += sum(1 for row in recent if row.status != "healthy")
    status = "healthy" if success else ("circuit_open" if consecutive_failures >= 3 else "degraded")
    db.add(ProviderHealthCheck(provider_id=provider.id, status=status, latency_ms=latency_ms, error_rate=0 if success else 100, last_checked_at=checked_at))
    if status == "circuit_open":
        db.add(OperationalEvent(event_type="provider_circuit_open", severity="critical", service="compass-router", message=f"Provider circuit opened for {provider.name}", metadata_json=json.dumps({"provider": provider.name, "error_code": error_code, "latency_ms": latency_ms})))
    if provider.status not in {"disabled", "unavailable"}:
        provider.status = "healthy" if success else "degraded"


def _model_supports(model: ModelCatalog, capability: str | None) -> bool:
    requested = capability or "chat_completion"
    return capability_matches(requested, model.capability_types, model.capabilities)


def resolve_route(db: Session, api_key: ApiKey, requested_model: str, capability: str | None = None) -> ResolvedRoute:
    model = db.get(ModelCatalog, requested_model)
    if model is None or not model.enabled or not model.published:
        raise compass_error(404, "model_not_found", "Requested model is not available.")
    if model.status in {"expired", "deprecated"}:
        raise compass_error(410, "model_expired", "Requested model has expired or been deprecated.")
    if model.status != "available":
        raise compass_error(503, "model_unavailable", "Requested model is temporarily unavailable.")
    if not _catalog_model_is_fresh(model):
        raise compass_error(503, "model_catalog_stale", "The model catalog is stale; refresh provider discovery before routing.")
    if not get_settings().local_test_mode and (
        not model.pricing_policy_version
        or model.input_price_usd_per_million is None
        or model.output_price_usd_per_million is None
    ):
        raise compass_error(503, "model_pricing_unavailable", "The model has no verified provider pricing and cannot be routed.")
    if not _model_supports(model, capability):
        raise compass_error(400, "model_capability_mismatch", f"Model does not support the {capability} API.")
    provider = model.provider
    requested_capability = capability or "chat_completion"
    protocol = model.protocol or provider.protocol or "unverified"
    if not _provider_adapter_registry.supports_capability(protocol, requested_capability):
        raise compass_error(503, "provider_capability_unsupported", "No verified provider adapter can execute the requested capability.")
    if not provider.enabled or provider.status in {"disabled", "unavailable"}:
        raise compass_error(503, "provider_unavailable", "Resolved provider is disabled.")
    if not get_settings().local_test_mode and provider.commercial_status != "approved":
        raise compass_error(503, "provider_commercial_approval_required", "The provider is not commercially approved for customer traffic.")
    if requested_model not in allowed_model_ids(db, api_key.id):
        raise compass_error(403, "model_not_allowed", "This Compass API key is not allowed to use the requested model.")
    policy = db.scalar(select(ModelPolicy).where(ModelPolicy.team_id == api_key.team_id, ModelPolicy.model_id == model.id))
    if policy is not None and not policy.enabled:
        raise compass_error(403, "model_disabled_for_team", "This model is disabled for the team.")
    if _circuit_is_open(db, provider.id):
        raise compass_error(503, "provider_circuit_open", "Provider circuit breaker is open; retry after the cooldown.")
    settings = get_settings()
    if settings.local_test_mode and model.provider_model_id == "local-test-chat":
        return ResolvedRoute(model, provider, "local_test", "local-test", model.provider_model_id)
    byok = db.scalar(
        select(ByokCredential).where(
            ByokCredential.team_id == api_key.team_id,
            ByokCredential.provider_id == provider.id,
            ByokCredential.status == "active",
        )
    )
    if byok is not None and byok.encrypted_secret.startswith(("encrypted:", "gcp-secret:")):
        return ResolvedRoute(model, provider, "byok", byok.encrypted_secret, requested_model)
    credential = db.scalar(
        select(ProviderCredential).where(
            ProviderCredential.organization_id.is_(None),
            ProviderCredential.provider_id == provider.id,
            ProviderCredential.status.in_(["active", "local_test"]),
        )
    )
    if credential is None or not _has_usable_reference(credential.secret_reference):
        raise compass_error(503, "provider_unavailable", "No usable provider credential is configured.")
    return ResolvedRoute(model, provider, credential.credential_mode, credential.secret_reference, model.provider_model_id)


def route_candidates(db: Session, api_key: ApiKey, requested_model: str, capability: str | None = None) -> list[ResolvedRoute]:
    """Resolve the requested model and its configured fallback chain without loops."""
    policy = db.scalar(select(RoutingPolicy).where(RoutingPolicy.alias == requested_model))
    if policy is not None:
        if not policy.enabled:
            raise compass_error(503, "routing_policy_disabled", "The requested routing policy is disabled.")
        candidates: list[ResolvedRoute] = []
        first_error: HTTPException | None = None
        for model_id in [item.strip() for item in policy.candidate_models.split(",") if item.strip()]:
            try:
                candidates.append(resolve_route(db, api_key, model_id, capability))
            except HTTPException as exc:
                first_error = first_error or exc
        if candidates:
            return candidates
        raise first_error or compass_error(503, "routing_policy_unavailable", "No model in the routing policy is currently available.")
    candidates: list[ResolvedRoute] = []
    visited: set[str] = set()
    model_id: str | None = requested_model
    fallback_attempted = False
    first_error: HTTPException | None = None
    while model_id and model_id not in visited and len(candidates) < 8:
        visited.add(model_id)
        try:
            route = resolve_route(db, api_key, model_id, capability)
        except HTTPException as exc:
            if first_error is None:
                first_error = exc
            error_code = "provider_error"
            if isinstance(exc.detail, dict):
                error_code = exc.detail.get("error", {}).get("code", error_code)
            model = db.get(ModelCatalog, model_id)
            fallback = model.fallback_model_id if model else None
            if not candidates and fallback and not fallback_attempted and error_code in {"provider_circuit_open", "provider_unavailable", "model_unavailable", "model_capability_mismatch"}:
                fallback_attempted = True
                model_id = fallback
                continue
            if candidates:
                break
            raise first_error or exc
        candidates.append(route)
        model_id = route.model.fallback_model_id
    return candidates


def _billing_routes(routes: list[ResolvedRoute]) -> tuple[list[ResolvedRoute], bool]:
    """Keep BYOK requests on the customer credential and outside Compass billing."""
    if routes and routes[0].credential_mode == "byok":
        return routes[:1], True
    return routes, False


def _redis_client(redis_url: str) -> Redis:
    """Create a pooled Redis client; rediss:// enables TLS and URL auth."""
    settings = get_settings()
    return Redis.from_url(
        redis_url,
        socket_connect_timeout=settings.redis_connect_timeout_seconds,
        socket_timeout=settings.redis_socket_timeout_seconds,
        health_check_interval=30,
        max_connections=max(1, settings.redis_max_connections),
        retry=Retry(
            ExponentialBackoff(cap=0.2),
            retries=max(0, min(settings.redis_retry_attempts, 5)),
        ),
        retry_on_error=[ConnectionError, TimeoutError],
        decode_responses=True,
    )


def check_redis(redis_url: str) -> dict:
    client = _redis_client(redis_url)
    try:
        client.ping()
        connection = client.connection_pool.connection_kwargs
        return {
            "status": "ok",
            "scheme": "rediss" if redis_url.lower().startswith("rediss://") else "redis",
            "host": connection.get("host", "localhost"),
            "port": connection.get("port", 6379),
        }
    except RedisError as exc:
        raise RuntimeError("Redis health check failed") from exc
    finally:
        client.close()


def redis_team_rate_limit(redis_url: str, team_id: str, estimated_tokens: int, request_limit: int, token_limit: int) -> tuple[bool, str | None]:
    """Atomically reserve a request and token slot in Redis when available."""
    key_suffix = str(int(time.time() // 60))
    request_key = f"compass:limit:{team_id}:requests:{key_suffix}"
    token_key = f"compass:limit:{team_id}:tokens:{key_suffix}"
    script = """
local requests = redis.call('INCR', KEYS[1])
if requests == 1 then redis.call('EXPIRE', KEYS[1], 61) end
local tokens = redis.call('INCRBY', KEYS[2], ARGV[3])
if tokens == tonumber(ARGV[3]) then redis.call('EXPIRE', KEYS[2], 61) end
local reason = 0
if requests > tonumber(ARGV[1]) then reason = 1 end
if tokens > tonumber(ARGV[2]) then reason = 2 end
return {reason, requests, tokens}
"""
    client = _redis_client(redis_url)
    try:
        values = client.eval(
            script,
            2,
            request_key,
            token_key,
            request_limit,
            token_limit,
            max(estimated_tokens, 0),
        )
        if not isinstance(values, (list, tuple)) or len(values) < 3:
            raise RuntimeError("Redis rate limit response was invalid")
        reason = int(values[0])
        return reason == 0, {1: "rate_limit_exceeded", 2: "token_limit_exceeded"}.get(reason)
    except RedisError as exc:
        raise RuntimeError("Redis rate limit command failed") from exc
    finally:
        client.close()


def calculate_cost_paise(model: ModelCatalog, usage: dict) -> tuple[int, int]:
    input_tokens = int(usage.get("prompt_tokens", 0))
    output_tokens = int(usage.get("completion_tokens", 0))
    customer_cost = ((input_tokens * model.input_price_paise_per_1k) + (output_tokens * model.output_price_paise_per_1k) + 999) // 1000

    # Catalog source prices are stored as USD per million tokens. Use them for
    # provider-cost attribution, while the paise-per-1k fields remain the
    # versioned customer charge after markup. Local fixtures have no source
    # price and intentionally fall back to their explicit test rates.
    source_input = model.input_price_usd_per_million
    source_output = model.output_price_usd_per_million
    if source_input is None or source_output is None:
        provider_cost = customer_cost
    else:
        conversion = Decimal(str(get_settings().usd_to_inr_paise_per_usd))
        source_input_paise_per_1k = (Decimal(str(source_input)) * conversion * Decimal("0.001")).to_integral_value(rounding=ROUND_CEILING)
        source_output_paise_per_1k = (Decimal(str(source_output)) * conversion * Decimal("0.001")).to_integral_value(rounding=ROUND_CEILING)
        provider_cost = int((Decimal(input_tokens) * source_input_paise_per_1k + Decimal(output_tokens) * source_output_paise_per_1k) / Decimal(1000))
    return provider_cost, max(customer_cost, 1)


def estimate_prompt_tokens(body: dict) -> int:
    return sum(len(str(message.get("content", "")).split()) for message in body.get("messages", []))


def estimate_max_cost_paise(model: ModelCatalog, body: dict) -> int:
    return calculate_cost_paise(model, {"prompt_tokens": estimate_prompt_tokens(body), "completion_tokens": int(body.get("max_tokens") or 256)})[1]


def enforce_team_limits(db: Session, team_id: str, estimated_tokens: int, estimated_cost_paise: int = 0) -> None:
    limits = db.scalar(select(TeamLimit).where(TeamLimit.team_id == team_id))
    if limits is None:
        return
    settings = get_settings()
    redis_enforced = False
    if settings.redis_rate_limit_enabled:
        try:
            allowed, reason = redis_team_rate_limit(settings.redis_url, team_id, estimated_tokens, limits.requests_per_minute, limits.tokens_per_minute)
            if not allowed and reason == "rate_limit_exceeded":
                raise compass_error(429, reason, "Team request rate limit exceeded.")
            if not allowed and reason == "token_limit_exceeded":
                raise compass_error(429, reason, "Team token rate limit exceeded.")
            redis_enforced = True
        except HTTPException:
            raise
        except (OSError, RuntimeError, ValueError):
            if settings.environment.strip().lower() in {"production", "prod"}:
                raise compass_error(503, "rate_limit_unavailable", "Distributed rate limiting is unavailable.") from None
    if not redis_enforced:
        since = now() - timedelta(minutes=1)
        minute_requests = db.scalar(select(func.count(LlmRequest.id)).where(LlmRequest.team_id == team_id, LlmRequest.created_at >= since)) or 0
        minute_tokens = db.scalar(select(func.coalesce(func.sum(LlmRequest.total_tokens), 0)).where(LlmRequest.team_id == team_id, LlmRequest.created_at >= since)) or 0
        if minute_requests >= limits.requests_per_minute:
            raise compass_error(429, "rate_limit_exceeded", "Team request rate limit exceeded.")
        if minute_tokens + estimated_tokens > limits.tokens_per_minute:
            raise compass_error(429, "token_limit_exceeded", "Team token rate limit exceeded.")
    day_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = day_start.replace(day=1)
    daily_spend = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.team_id == team_id, LlmRequest.created_at >= day_start, LlmRequest.status == "success")) or 0
    estimated_cost = max(0, estimated_cost_paise)
    if limits.daily_spend_limit_paise > 0 and daily_spend + estimated_cost > limits.daily_spend_limit_paise:
        raise compass_error(429, "team_daily_spend_limit_exceeded", "Team daily spending limit exceeded.")
    monthly_spend = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.team_id == team_id, LlmRequest.created_at >= month_start, LlmRequest.status == "success")) or 0
    if limits.monthly_spend_limit_paise > 0 and monthly_spend + estimated_cost > limits.monthly_spend_limit_paise:
        raise compass_error(429, "team_monthly_spend_limit_exceeded", "Team monthly spending limit exceeded.")


def enforce_api_key_limits(db: Session, api_key: ApiKey, estimated_cost_paise: int) -> None:
    """Apply the key-level request and spend limits before provider work starts."""
    minute_ago = now() - timedelta(minutes=1)
    day_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = day_start.replace(day=1)
    minute_requests = db.scalar(select(func.count(LlmRequest.id)).where(LlmRequest.api_key_id == api_key.id, LlmRequest.created_at >= minute_ago)) or 0
    if api_key.rate_limit > 0 and minute_requests >= api_key.rate_limit:
        raise compass_error(429, "api_key_rate_limit_exceeded", "API key request rate limit exceeded.")
    daily_spend = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.api_key_id == api_key.id, LlmRequest.created_at >= day_start, LlmRequest.status == "success")) or 0
    if api_key.daily_limit > 0 and daily_spend + estimated_cost_paise > api_key.daily_limit:
        raise compass_error(429, "api_key_daily_limit_exceeded", "API key daily spending limit exceeded.")
    monthly_spend = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.api_key_id == api_key.id, LlmRequest.created_at >= month_start, LlmRequest.status == "success")) or 0
    if api_key.monthly_limit > 0 and monthly_spend + estimated_cost_paise > api_key.monthly_limit:
        raise compass_error(429, "api_key_monthly_limit_exceeded", "API key monthly spending limit exceeded.")


def validate_openai_response(data: dict) -> None:
    if not isinstance(data, dict):
        raise compass_error(502, "malformed_provider_response", "Provider response was not an object.")
    if not data.get("id") or data.get("object") != "chat.completion":
        raise compass_error(502, "malformed_provider_response", "Provider response was not OpenAI-compatible.")
    choices = data.get("choices")
    usage = data.get("usage")
    if not isinstance(choices, list) or not choices or not isinstance(usage, dict):
        raise compass_error(502, "malformed_provider_response", "Provider response was missing choices or usage.")
    for field in ("prompt_tokens", "completion_tokens", "total_tokens"):
        if field not in usage:
            raise compass_error(502, "malformed_provider_response", f"Provider response usage missing {field}.")


class LiteLLMClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def base_url(self) -> str:
        return (self.settings.compass_litellm_url or self.settings.litellm_url).rstrip("/")

    async def request_json(self, endpoint: str, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=self.settings.litellm_timeout_seconds) as client:
            try:
                response = await client.post(f"{self.base_url}{endpoint}", json=payload, headers={"Authorization": f"Bearer {self.settings.litellm_master_key}"})
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        try:
            data = response.json()
        except ValueError:
            raise compass_error(502, "malformed_provider_response", "Provider returned malformed JSON.") from None
        if not isinstance(data, dict):
            raise compass_error(502, "malformed_provider_response", "Provider returned an invalid response.")
        return data

    async def stream_request(self, endpoint: str, payload: dict):
        """Yield upstream SSE lines without buffering the provider response."""
        async with httpx.AsyncClient(timeout=self.settings.litellm_timeout_seconds) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}{endpoint}",
                    json=payload,
                    headers={"Authorization": f"Bearer {self.settings.litellm_master_key}"},
                ) as response:
                    if response.status_code == 429:
                        raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
                    if response.status_code >= 500:
                        raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
                    if response.status_code >= 400:
                        raise compass_error(400, "provider_error", "Provider rejected the request.")
                    async for line in response.aiter_lines():
                        yield line
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None

    async def request_bytes(self, endpoint: str, payload: dict) -> tuple[bytes, str]:
        async with httpx.AsyncClient(timeout=self.settings.litellm_timeout_seconds) as client:
            try:
                response = await client.post(f"{self.base_url}{endpoint}", json=payload, headers={"Authorization": f"Bearer {self.settings.litellm_master_key}"})
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        return response.content, response.headers.get("content-type", "application/octet-stream")

    async def request_multipart(self, endpoint: str, data: dict, file: tuple[str, bytes, str]) -> dict:
        async with httpx.AsyncClient(timeout=self.settings.litellm_timeout_seconds) as client:
            try:
                response = await client.post(
                    f"{self.base_url}{endpoint}",
                    data=data,
                    files={"file": file},
                    headers={"Authorization": f"Bearer {self.settings.litellm_master_key}"},
                )
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        try:
            payload = response.json()
        except ValueError:
            raise compass_error(502, "malformed_provider_response", "Provider returned malformed JSON.") from None
        if not isinstance(payload, dict):
            raise compass_error(502, "malformed_provider_response", "Provider returned an invalid response.")
        return payload

    async def chat_completion(self, payload: dict) -> dict:
        data = await self.request_json("/v1/chat/completions", payload)
        validate_openai_response(data)
        return data

    async def health_check(self) -> dict:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{self.base_url}/health/liveliness")
        if response.status_code >= 400:
            raise compass_error(503, "litellm_unavailable", "LiteLLM health check failed.")
        data = response.json()
        if isinstance(data, dict):
            return data
        return {"status": "ok", "detail": data}


def _native_provider_model(provider_name: str, model_id: str) -> str:
    prefix = f"{provider_name}/"
    return model_id.removeprefix(prefix)


LOCAL_LIVE_PROXY_MODELS = {
    "openai": "openai-gpt-4o-mini-smoke",
    "gemini": "gemini-flash-real",
    "ollama_cloud": "ollama-cloud-gpt-oss-20b-real",
}


def _local_live_proxy_model(provider_name: str, requested_model: str) -> str:
    """Map seeded local catalog IDs to the real LiteLLM route after a key is added."""
    return LOCAL_LIVE_PROXY_MODELS.get(provider_name, requested_model)


def _set_local_provider_route(db: Session, provider: Provider, *, live: bool) -> None:
    """Switch seeded local-test catalog routes only after an explicit key action."""
    if not get_settings().local_test_mode:
        return
    live_model = LOCAL_LIVE_PROXY_MODELS.get(provider.name)
    if live_model is None:
        return
    source_model = "local-test-chat" if live else live_model
    target_model = live_model if live else "local-test-chat"
    models = db.scalars(
        select(ModelCatalog).where(
            ModelCatalog.provider_id == provider.id,
            ModelCatalog.provider_model_id == source_model,
        )
    ).all()
    for model in models:
        model.provider_model_id = target_model


def _provider_key(secret_reference: str) -> str:
    if not secret_reference.startswith(("encrypted:", "gcp-secret:")):
        raise compass_error(503, "provider_credential_invalid", "Provider credential is not configured for real execution.")
    return _credential_value(secret_reference)


class DirectProviderClient:
    """Execute through provider APIs when the deployment is not using the proxy runtime."""

    def __init__(self, provider_name: str, secret_reference: str, model_id: str) -> None:
        self.provider_name = provider_name
        self.api_key = _provider_key(secret_reference)
        self.model_id = _native_provider_model(provider_name, model_id)
        self.timeout = get_settings().litellm_timeout_seconds

    @property
    def base_url(self) -> str:
        return {
            "openai": "https://api.openai.com/v1",
            "ollama_cloud": "https://ollama.com/v1",
            "openrouter": "https://openrouter.ai/api/v1",
        }.get(self.provider_name, "")

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    @staticmethod
    def _text_parts(content: object) -> list[dict]:
        if isinstance(content, str):
            return [{"text": content}]
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, str):
                    parts.append({"text": item})
                elif isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append({"text": item["text"]})
            return parts
        return [{"text": str(content)}]

    def _gemini_payload(self, payload: dict) -> dict:
        contents: list[dict] = []
        system_parts: list[dict] = []
        for message in payload.get("messages", []):
            role = str(message.get("role", "user"))
            parts = self._text_parts(message.get("content"))
            if role in {"system", "developer"}:
                system_parts.extend(parts)
                continue
            contents.append({"role": "model" if role == "assistant" else "user", "parts": parts})
        generation_config = {}
        if payload.get("temperature") is not None:
            generation_config["temperature"] = payload["temperature"]
        if payload.get("max_tokens") is not None:
            generation_config["maxOutputTokens"] = payload["max_tokens"]
        result = {"contents": contents}
        if system_parts:
            result["systemInstruction"] = {"parts": system_parts}
        if generation_config:
            result["generationConfig"] = generation_config
        return result

    def _gemini_response(self, data: dict) -> dict:
        candidates = data.get("candidates") or []
        if not candidates:
            raise compass_error(502, "malformed_provider_response", "Gemini returned no candidates.")
        parts = ((candidates[0].get("content") or {}).get("parts") or [])
        content = "".join(str(part.get("text", "")) for part in parts if isinstance(part, dict))
        usage = data.get("usageMetadata") or {}
        return {
            "id": f"gemini-{time.time_ns()}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": self.model_id,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
            "usage": {
                "prompt_tokens": int(usage.get("promptTokenCount", 0)),
                "completion_tokens": int(usage.get("candidatesTokenCount", 0)),
                "total_tokens": int(usage.get("totalTokenCount", 0)),
            },
        }

    async def request_json(self, endpoint: str, payload: dict) -> dict:
        if self.provider_name == "gemini":
            if endpoint not in {"/v1/chat/completions", "/v1/responses"}:
                raise compass_error(400, "provider_capability_unsupported", "This Gemini adapter does not support that endpoint yet.")
            messages = payload.get("messages")
            if messages is None:
                input_value = payload.get("input", "")
                messages = [{"role": "user", "content": input_value}]
            gemini_payload = self._gemini_payload(payload | {"messages": messages})
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_id}:generateContent"
            headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
            response_model = self._gemini_response
        else:
            url = f"{self.base_url}{endpoint}"
            headers = self._headers()
            gemini_payload = payload | {"model": self.model_id}
            response_model = lambda data: data
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=gemini_payload, headers=headers)
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code in {401, 403}:
            raise compass_error(502, "provider_auth_failed", "Provider rejected the configured credential.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        try:
            data = response.json()
        except ValueError:
            raise compass_error(502, "malformed_provider_response", "Provider returned malformed JSON.") from None
        if not isinstance(data, dict):
            raise compass_error(502, "malformed_provider_response", "Provider returned an invalid response.")
        return response_model(data)

    async def stream_request(self, endpoint: str, payload: dict):
        if self.provider_name == "gemini" or not self.base_url:
            raise compass_error(400, "provider_capability_unsupported", f"Streaming is not configured for provider {self.provider_name}.")
        request_payload = payload | {"model": self.model_id, "stream": True}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream("POST", f"{self.base_url}{endpoint}", json=request_payload, headers=self._headers()) as response:
                    if response.status_code == 429:
                        raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
                    if response.status_code in {401, 403}:
                        raise compass_error(502, "provider_auth_failed", "Provider rejected the configured credential.")
                    if response.status_code >= 500:
                        raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
                    if response.status_code >= 400:
                        raise compass_error(400, "provider_error", "Provider rejected the request.")
                    async for line in response.aiter_lines():
                        yield line
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None

    async def chat_completion(self, payload: dict) -> dict:
        data = await self.request_json("/v1/chat/completions", payload)
        validate_openai_response(data)
        return data

    async def request_bytes(self, endpoint: str, payload: dict) -> tuple[bytes, str]:
        if not self.base_url:
            raise compass_error(503, "provider_execution_unavailable", f"Direct execution is not configured for provider {self.provider_name}.")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(f"{self.base_url}{endpoint}", json=payload, headers=self._headers())
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code in {401, 403}:
            raise compass_error(502, "provider_auth_failed", "Provider rejected the configured credential.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        return response.content, response.headers.get("content-type", "application/octet-stream")

    async def request_multipart(self, endpoint: str, data: dict, file: tuple[str, bytes, str]) -> dict:
        if not self.base_url:
            raise compass_error(503, "provider_execution_unavailable", f"Direct execution is not configured for provider {self.provider_name}.")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(f"{self.base_url}{endpoint}", data=data, files={"file": file}, headers={"Authorization": f"Bearer {self.api_key}"})
            except httpx.TimeoutException:
                raise compass_error(504, "provider_timeout", "Provider request timed out.") from None
            except httpx.RequestError:
                raise compass_error(503, "provider_unavailable", "Provider is unavailable.") from None
        if response.status_code == 429:
            raise compass_error(429, "provider_rate_limited", "Provider rate limit exceeded.")
        if response.status_code in {401, 403}:
            raise compass_error(502, "provider_auth_failed", "Provider rejected the configured credential.")
        if response.status_code >= 500:
            raise compass_error(503, "provider_unavailable", "Provider is unavailable.")
        if response.status_code >= 400:
            raise compass_error(400, "provider_error", "Provider rejected the request.")
        try:
            payload = response.json()
        except ValueError:
            raise compass_error(502, "malformed_provider_response", "Provider returned malformed JSON.") from None
        if not isinstance(payload, dict):
            raise compass_error(502, "malformed_provider_response", "Provider returned an invalid response.")
        return payload


_provider_adapter_registry = ProviderAdapterRegistry()
_provider_adapter_registry.register("litellm", lambda adapter_route, client: RuntimeProviderAdapter(adapter_route, client))
_provider_adapter_registry.register("openrouter_optional", lambda adapter_route, client: RuntimeProviderAdapter(adapter_route, client))
# Preserve rows created by the earlier interrupted M4 spelling during rollout.
_provider_adapter_registry.register("optional_openrouter", lambda adapter_route, client: RuntimeProviderAdapter(adapter_route, client))


def provider_client(route: ResolvedRoute):
    settings = get_settings()
    mode = settings.provider_execution_mode.strip().lower()
    if mode == "proxy" or (mode == "auto" and settings.local_test_mode):
        runtime_client = LiteLLMClient()
    elif mode in {"auto", "direct"}:
        runtime_client = DirectProviderClient(route.provider.name, route.secret_reference, route.resolved_model_id)
    else:
        raise compass_error(503, "provider_execution_unavailable", "Provider execution mode is invalid.")
    protocol = route.model.protocol or route.provider.protocol or "unverified"
    adapter_route = ProviderRoute(
        provider=route.provider.name,
        protocol=protocol,
        model_id=route.resolved_model_id,
        credential_mode=route.credential_mode,
        secret_reference=route.secret_reference,
    )
    try:
        return _provider_adapter_registry.resolve(adapter_route, runtime_client)
    except ProviderAdapterError as exc:
        raise compass_error(503, "provider_adapter_unavailable", str(exc)) from None


def create_request_record(db: Session, api_key: ApiKey, route: ResolvedRoute, requested_model: str, status: str, latency_ms: int, error_code: str | None = None, attempts: list[dict] | None = None) -> LlmRequest:
    effective_project_id = api_project_context.get() or api_key.project_id
    record = LlmRequest(user_id=api_key.user_id, organization_id=api_key.organization_id, project_id=effective_project_id, team_id=api_key.team_id, member_id=api_key.member_id, api_key_id=api_key.id, device_session_id=device_session_context.get(), requested_model=requested_model, resolved_model=route.resolved_model_id, provider=route.provider.name, credential_mode=route.credential_mode, status=status, error_code=error_code, latency_ms=latency_ms)
    db.add(record)
    db.flush()
    attempt_rows = attempts or [{"provider": route.provider.name, "provider_model_id": route.resolved_model_id, "status": status, "error_code": error_code, "latency_ms": latency_ms}]
    for attempt in attempt_rows:
        db.add(ProviderAttempt(request_id=record.id, **attempt))
    db.flush()
    return record


async def complete_chat(db: Session, api_key: ApiKey, body: dict) -> dict:
    routes, byok_route = _billing_routes(route_candidates(db, api_key, body["model"]))
    route = routes[0]
    estimated_tokens = estimate_prompt_tokens(body) + int(body.get("max_tokens") or 256)
    estimated_cost = 0 if byok_route else max(estimate_max_cost_paise(candidate.model, body) for candidate in routes)
    enforce_team_limits(db, api_key.team_id, estimated_tokens, estimated_cost)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, route.model.id, estimated_cost)
    if not byok_route and (wallet is None or wallet.balance_paise < estimated_cost):
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")
    reservation_id = new_id() if not byok_route else None
    if reservation_id is not None:
        reserve_wallet(db, api_key.team_id, estimated_cost, reservation_id)
    started = time.perf_counter()
    response: dict | None = None
    last_error: HTTPException | None = None
    attempt_rows: list[dict] = []
    retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
    max_attempts = max(1, min(get_settings().provider_max_attempts, 5))
    for route in routes:
        for attempt_number in range(max_attempts):
            attempt_started = time.perf_counter()
            try:
                provider_payload = body | {"model": route.resolved_model_id, "stream": False}
                if route.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                    provider_payload["api_key"] = _credential_value(route.secret_reference)
                candidate_response = await provider_client(route).chat_completion(provider_payload)
                validate_openai_response(candidate_response)
                response = candidate_response
                attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
                record_provider_health(db, route.provider, success=True, latency_ms=attempt_latency)
                attempt_rows.append({"provider": route.provider.name, "provider_model_id": route.resolved_model_id, "status": "success", "error_code": None, "latency_ms": attempt_latency})
                break
            except HTTPException as exc:
                last_error = exc
                error_code = "provider_error"
                if isinstance(exc.detail, dict):
                    error_code = exc.detail.get("error", {}).get("code", error_code)
                attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
                record_provider_health(db, route.provider, success=False, latency_ms=attempt_latency, error_code=error_code)
                attempt_rows.append({"provider": route.provider.name, "provider_model_id": route.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": attempt_latency})
                if error_code not in retryable or attempt_number + 1 >= max_attempts:
                    break
                await asyncio.sleep(get_settings().provider_retry_backoff_seconds * (2**attempt_number))
        if response is not None:
            break
    if response is None:
        latency_ms = int((time.perf_counter() - started) * 1000)
        error_code = "provider_error"
        if last_error is not None and isinstance(last_error.detail, dict):
            error_code = last_error.detail.get("error", {}).get("code", error_code)
        if reservation_id is not None:
            settle_wallet_reservation(db, api_key.team_id, reservation_id, 0, reservation_id)
        create_request_record(db, api_key, route, body["model"], "error", latency_ms, error_code, attempt_rows)
        db.commit()
        raise last_error or compass_error(503, "provider_unavailable", "No provider route succeeded.")
    latency_ms = int((time.perf_counter() - started) * 1000)
    usage = response.get("usage", {})
    provider_cost, compass_cost = calculate_cost_paise(route.model, usage)
    if byok_route:
        compass_cost = 0
    record = create_request_record(db, api_key, route, body["model"], "success", latency_ms, attempts=attempt_rows)
    record.input_tokens = int(usage.get("prompt_tokens", 0))
    record.output_tokens = int(usage.get("completion_tokens", 0))
    record.total_tokens = int(usage.get("total_tokens", 0))
    record.provider_cost_paise = provider_cost
    record.compass_cost_paise = compass_cost
    db.flush()
    if reservation_id is not None:
        settle_wallet_reservation(db, api_key.team_id, reservation_id, compass_cost, record.id)
    response["model"] = body["model"]
    response["compass"] = {"request_id": record.id, "team_id": api_key.team_id, "member_id": api_key.member_id, "provider": route.provider.name, "credential_mode": route.credential_mode, "latency_ms": latency_ms, "provider_cost_paise": provider_cost, "compass_cost_paise": compass_cost, "local_test_mode": get_settings().local_test_mode}
    return response


async def stream_chat(db: Session, api_key: ApiKey, body: dict):
    """Prepare a real upstream stream and settle the wallet when it ends.

    The local-test path intentionally remains on the existing deterministic
    response helper. Production and staging paths consume provider SSE lines
    incrementally and never manufacture chunks from a buffered response.
    """
    routes, byok_route = _billing_routes(route_candidates(db, api_key, body["model"]))
    estimated_tokens = estimate_prompt_tokens(body) + int(body.get("max_tokens") or 256)
    estimated_cost = 0 if byok_route else max(estimate_max_cost_paise(candidate.model, body) for candidate in routes)
    enforce_team_limits(db, api_key.team_id, estimated_tokens, estimated_cost)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, routes[0].model.id, estimated_cost)
    if not byok_route and (wallet is None or wallet.balance_paise < estimated_cost):
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")

    reservation_id = new_id() if not byok_route else None
    if reservation_id is not None:
        reserve_wallet(db, api_key.team_id, estimated_cost, reservation_id)

    async def events():
        started = time.perf_counter()
        selected = routes[0]
        attempt_rows: list[dict] = []
        usage: dict | None = None
        usage_source = "provider"
        emitted = False
        completed = False
        last_error: HTTPException | None = None
        retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
        max_attempts = max(1, min(get_settings().provider_max_attempts, 5))

        try:
            for candidate in routes:
                selected = candidate
                for attempt_number in range(max_attempts):
                    attempt_started = time.perf_counter()
                    candidate_emitted = False
                    try:
                        provider_payload = body | {"model": candidate.resolved_model_id, "stream": True}
                        if candidate.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                            provider_payload["api_key"] = _credential_value(candidate.secret_reference)
                        async for line in provider_client(candidate).stream_request("/v1/chat/completions", provider_payload):
                            if not line:
                                continue
                            candidate_emitted = True
                            emitted = True
                            if line.startswith("data:"):
                                raw = line[5:].strip()
                                if raw and raw != "[DONE]":
                                    try:
                                        chunk = json.loads(raw)
                                    except (TypeError, ValueError):
                                        chunk = None
                                    if isinstance(chunk, dict) and isinstance(chunk.get("usage"), dict):
                                        usage = _generic_usage(chunk)
                            yield f"{line}\n\n"
                        completed = True
                        latency_ms = int((time.perf_counter() - attempt_started) * 1000)
                        record_provider_health(db, candidate.provider, success=True, latency_ms=latency_ms)
                        attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "success", "error_code": None, "latency_ms": latency_ms})
                        break
                    except HTTPException as exc:
                        last_error = exc
                        error_code = "provider_error"
                        if isinstance(exc.detail, dict):
                            error_code = exc.detail.get("error", {}).get("code", error_code)
                        latency_ms = int((time.perf_counter() - attempt_started) * 1000)
                        record_provider_health(db, candidate.provider, success=False, latency_ms=latency_ms, error_code=error_code)
                        attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": latency_ms})
                        if candidate_emitted or emitted or error_code not in retryable or attempt_number + 1 >= max_attempts:
                            break
                        await asyncio.sleep(get_settings().provider_retry_backoff_seconds * (2**attempt_number))
                if completed or emitted:
                    break

            if not completed:
                error_code = "provider_error"
                if last_error is not None and isinstance(last_error.detail, dict):
                    error_code = last_error.detail.get("error", {}).get("code", error_code)
                error_message = "No provider route succeeded."
                if last_error is not None and isinstance(last_error.detail, dict):
                    error_message = last_error.detail.get("error", {}).get("message", error_message)
                yield f"data: {json.dumps({'error': {'code': error_code, 'message': error_message}})}\n\n"
                yield "data: [DONE]\n\n"
                latency_ms = int((time.perf_counter() - started) * 1000)
                record = create_request_record(db, api_key, selected, body["model"], "error", latency_ms, error_code, attempt_rows)
                record.usage_source = "none"
                if reservation_id is not None:
                    settle_wallet_reservation(db, api_key.team_id, reservation_id, 0, record.id)
                return

            if usage is None:
                usage = {"prompt_tokens": estimate_prompt_tokens(body), "completion_tokens": 0, "total_tokens": estimate_prompt_tokens(body)}
                usage_source = "estimate"
            latency_ms = int((time.perf_counter() - started) * 1000)
            provider_cost, compass_cost = calculate_cost_paise(selected.model, usage)
            if byok_route:
                compass_cost = 0
            record = create_request_record(db, api_key, selected, body["model"], "success", latency_ms, attempts=attempt_rows)
            record.input_tokens = int(usage.get("prompt_tokens", 0))
            record.output_tokens = int(usage.get("completion_tokens", 0))
            record.total_tokens = int(usage.get("total_tokens", 0))
            record.usage_source = usage_source
            record.provider_cost_paise = provider_cost
            record.compass_cost_paise = compass_cost
            db.flush()
            if reservation_id is not None:
                settle_wallet_reservation(db, api_key.team_id, reservation_id, compass_cost, record.id)
        except asyncio.CancelledError:
            latency_ms = int((time.perf_counter() - started) * 1000)
            record = create_request_record(db, api_key, selected, body["model"], "cancelled", latency_ms, "client_disconnected", attempt_rows)
            record.usage_source = "none"
            if reservation_id is not None:
                settle_wallet_reservation(db, api_key.team_id, reservation_id, 0, record.id)
            raise

    return events()


def _generic_usage(response: dict) -> dict:
    usage = response.get("usage") if isinstance(response.get("usage"), dict) else {}
    input_tokens = int(usage.get("prompt_tokens", usage.get("input_tokens", 0)) or 0)
    output_tokens = int(usage.get("completion_tokens", usage.get("output_tokens", 0)) or 0)
    total_tokens = int(usage.get("total_tokens", input_tokens + output_tokens) or 0)
    return {"prompt_tokens": input_tokens, "completion_tokens": output_tokens, "total_tokens": total_tokens}


def _usage_with_source(response: dict, estimated_tokens: int) -> tuple[dict, str]:
    """Use provider usage only when the provider actually returned it."""

    if isinstance(response.get("usage"), dict):
        return _generic_usage(response), "provider"
    estimated = max(0, int(estimated_tokens))
    return {"prompt_tokens": estimated, "completion_tokens": 0, "total_tokens": estimated}, "estimate"


def _stream_usage(line: str) -> dict | None:
    """Extract usage from OpenAI-compatible or Responses SSE payloads."""

    if not line.startswith("data:"):
        return None
    raw = line[5:].strip()
    if not raw or raw == "[DONE]":
        return None
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError):
        return None
    candidates = [payload]
    if isinstance(payload, dict) and isinstance(payload.get("response"), dict):
        candidates.append(payload["response"])
    for candidate in candidates:
        if isinstance(candidate, dict) and isinstance(candidate.get("usage"), dict):
            return _generic_usage(candidate)
    return None


async def stream_json_api(db: Session, api_key: ApiKey, body: dict, endpoint: str, capability: str):
    """Forward a provider SSE stream for non-chat OpenAI-compatible APIs."""

    routes, byok_route = _billing_routes(route_candidates(db, api_key, body["model"], capability))
    requested_max_tokens = int(body.get("max_tokens") or body.get("max_output_tokens") or 256)
    estimated_tokens = _estimate_generic_tokens(body) + requested_max_tokens
    estimated_cost = 0 if byok_route else max(
        estimate_max_cost_paise(
            candidate.model,
            {"messages": [{"content": str(body.get("input") or body.get("prompt") or "")}], "max_tokens": requested_max_tokens},
        )
        for candidate in routes
    )
    enforce_team_limits(db, api_key.team_id, estimated_tokens, estimated_cost)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, routes[0].model.id, estimated_cost)
    if not byok_route and (wallet is None or wallet.balance_paise < estimated_cost):
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")

    reservation_id = new_id() if not byok_route else None
    if reservation_id is not None:
        reserve_wallet(db, api_key.team_id, estimated_cost, reservation_id)

    async def events():
        started = time.perf_counter()
        selected = routes[0]
        attempt_rows: list[dict] = []
        usage: dict | None = None
        emitted = False
        completed = False
        last_error: HTTPException | None = None
        retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
        max_attempts = max(1, min(get_settings().provider_max_attempts, 5))

        try:
            for candidate in routes:
                selected = candidate
                for attempt_number in range(max_attempts):
                    attempt_started = time.perf_counter()
                    candidate_emitted = False
                    try:
                        provider_payload = body | {"model": candidate.resolved_model_id, "stream": True}
                        if candidate.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                            provider_payload["api_key"] = _credential_value(candidate.secret_reference)
                        async for line in provider_client(candidate).stream_request(endpoint, provider_payload):
                            if not line:
                                continue
                            candidate_emitted = True
                            emitted = True
                            streamed_usage = _stream_usage(line)
                            if streamed_usage is not None:
                                usage = streamed_usage
                            yield f"{line}\n\n"
                        completed = True
                        latency_ms = int((time.perf_counter() - attempt_started) * 1000)
                        record_provider_health(db, candidate.provider, success=True, latency_ms=latency_ms)
                        attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "success", "error_code": None, "latency_ms": latency_ms})
                        break
                    except HTTPException as exc:
                        last_error = exc
                        error_code = "provider_error"
                        if isinstance(exc.detail, dict):
                            error_code = exc.detail.get("error", {}).get("code", error_code)
                        latency_ms = int((time.perf_counter() - attempt_started) * 1000)
                        record_provider_health(db, candidate.provider, success=False, latency_ms=latency_ms, error_code=error_code)
                        attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": latency_ms})
                        if candidate_emitted or emitted or error_code not in retryable or attempt_number + 1 >= max_attempts:
                            break
                        await asyncio.sleep(get_settings().provider_retry_backoff_seconds * (2**attempt_number))
                if completed or emitted:
                    break

            if not completed:
                error_code = "provider_error"
                if last_error is not None and isinstance(last_error.detail, dict):
                    error_code = last_error.detail.get("error", {}).get("code", error_code)
                error_message = "No provider route succeeded."
                if last_error is not None and isinstance(last_error.detail, dict):
                    error_message = last_error.detail.get("error", {}).get("message", error_message)
                yield f"data: {json.dumps({'error': {'code': error_code, 'message': error_message}})}\n\n"
                yield "data: [DONE]\n\n"
                latency_ms = int((time.perf_counter() - started) * 1000)
                record = create_request_record(db, api_key, selected, body["model"], "error", latency_ms, error_code, attempt_rows)
                record.usage_source = "none"
                if reservation_id is not None:
                    settle_wallet_reservation(db, api_key.team_id, reservation_id, 0, record.id)
                return

            usage_source = "provider"
            if usage is None:
                usage = {"prompt_tokens": _estimate_generic_tokens(body), "completion_tokens": 0, "total_tokens": _estimate_generic_tokens(body)}
                usage_source = "estimate"
            latency_ms = int((time.perf_counter() - started) * 1000)
            provider_cost, compass_cost = calculate_cost_paise(selected.model, usage)
            if byok_route:
                compass_cost = 0
            record = create_request_record(db, api_key, selected, body["model"], "success", latency_ms, attempts=attempt_rows)
            record.input_tokens = usage["prompt_tokens"]
            record.output_tokens = usage["completion_tokens"]
            record.total_tokens = usage["total_tokens"]
            record.usage_source = usage_source
            record.provider_cost_paise = provider_cost
            record.compass_cost_paise = compass_cost
            db.flush()
            if reservation_id is not None:
                settle_wallet_reservation(db, api_key.team_id, reservation_id, compass_cost, record.id)
        except asyncio.CancelledError:
            latency_ms = int((time.perf_counter() - started) * 1000)
            record = create_request_record(db, api_key, selected, body["model"], "cancelled", latency_ms, "client_disconnected", attempt_rows)
            record.usage_source = "none"
            if reservation_id is not None:
                settle_wallet_reservation(db, api_key.team_id, reservation_id, 0, record.id)
            raise

    return events()


def _estimate_generic_tokens(body: dict) -> int:
    if isinstance(body.get("messages"), list):
        return estimate_prompt_tokens(body)
    value = body.get("input") or body.get("prompt") or ""
    if isinstance(value, list):
        value = " ".join(str(item) for item in value)
    return max(1, len(str(value).split()))


async def complete_json_api(db: Session, api_key: ApiKey, body: dict, endpoint: str, capability: str) -> dict:
    """Execute non-chat OpenAI-compatible APIs through the same Compass controls."""
    routes, byok_route = _billing_routes(route_candidates(db, api_key, body["model"], capability))
    route = routes[0]
    requested_max_tokens = int(body.get("max_tokens") or body.get("max_output_tokens") or 256)
    estimated_tokens = _estimate_generic_tokens(body) + requested_max_tokens
    estimated_cost = 0 if byok_route else max(estimate_max_cost_paise(candidate.model, {"messages": [{"content": str(body.get("input") or body.get("prompt") or "")}], "max_tokens": requested_max_tokens}) for candidate in routes)
    enforce_team_limits(db, api_key.team_id, estimated_tokens, estimated_cost)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, route.model.id, estimated_cost)
    if not byok_route and (wallet is None or wallet.balance_paise < estimated_cost):
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")
    reservation_id = new_id() if not byok_route else None
    if reservation_id is not None:
        reserve_wallet(db, api_key.team_id, estimated_cost, reservation_id)

    started = time.perf_counter()
    response: dict | None = None
    last_error: HTTPException | None = None
    attempt_rows: list[dict] = []
    retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
    max_attempts = max(1, min(get_settings().provider_max_attempts, 5))
    for candidate in routes:
        for attempt_number in range(max_attempts):
            attempt_started = time.perf_counter()
            try:
                provider_payload = body | {"model": candidate.resolved_model_id}
                if candidate.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                    provider_payload["api_key"] = _credential_value(candidate.secret_reference)
                response = await provider_client(candidate).request_json(endpoint, provider_payload)
                attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
                record_provider_health(db, candidate.provider, success=True, latency_ms=attempt_latency)
                attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "success", "error_code": None, "latency_ms": attempt_latency})
                route = candidate
                break
            except HTTPException as exc:
                last_error = exc
                error_code = "provider_error"
                if isinstance(exc.detail, dict):
                    error_code = exc.detail.get("error", {}).get("code", error_code)
                attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
                record_provider_health(db, candidate.provider, success=False, latency_ms=attempt_latency, error_code=error_code)
                attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": attempt_latency})
                if error_code not in retryable or attempt_number + 1 >= max_attempts:
                    break
                await asyncio.sleep(get_settings().provider_retry_backoff_seconds * (2**attempt_number))
        if response is not None:
            break

    latency_ms = int((time.perf_counter() - started) * 1000)
    if response is None:
        error_code = "provider_error"
        if last_error is not None and isinstance(last_error.detail, dict):
            error_code = last_error.detail.get("error", {}).get("code", error_code)
        if reservation_id is not None:
            settle_wallet_reservation(db, api_key.team_id, reservation_id, 0, reservation_id)
        create_request_record(db, api_key, route, body["model"], "error", latency_ms, error_code, attempt_rows)
        db.commit()
        raise last_error or compass_error(503, "provider_unavailable", "No provider route succeeded.")

    usage = _generic_usage(response)
    provider_cost, compass_cost = calculate_cost_paise(route.model, usage)
    if byok_route:
        compass_cost = 0
    record = create_request_record(db, api_key, route, body["model"], "success", latency_ms, attempts=attempt_rows)
    record.input_tokens = usage["prompt_tokens"]
    record.output_tokens = usage["completion_tokens"]
    record.total_tokens = usage["total_tokens"]
    record.provider_cost_paise = provider_cost
    record.compass_cost_paise = compass_cost
    db.flush()
    if reservation_id is not None:
        settle_wallet_reservation(db, api_key.team_id, reservation_id, compass_cost, record.id)
    response.setdefault("model", body["model"])
    response["compass"] = {"request_id": record.id, "team_id": api_key.team_id, "member_id": api_key.member_id, "provider": route.provider.name, "credential_mode": route.credential_mode, "latency_ms": latency_ms, "provider_cost_paise": provider_cost, "compass_cost_paise": compass_cost, "local_test_mode": get_settings().local_test_mode}
    return response


async def complete_binary_api(db: Session, api_key: ApiKey, body: dict, endpoint: str, capability: str) -> tuple[bytes, str]:
    routes, byok_route = _billing_routes(route_candidates(db, api_key, body["model"], capability))
    route = routes[0]
    estimated_tokens = _estimate_generic_tokens(body)
    estimated_cost = 0 if byok_route else max(estimate_max_cost_paise(candidate.model, {"messages": [{"content": str(body.get("input") or "")}], "max_tokens": 256}) for candidate in routes)
    enforce_team_limits(db, api_key.team_id, estimated_tokens, estimated_cost)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, route.model.id, estimated_cost)
    if not byok_route and (wallet is None or wallet.balance_paise < estimated_cost):
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")
    reservation_id = new_id() if not byok_route else None
    if reservation_id is not None:
        reserve_wallet(db, api_key.team_id, estimated_cost, reservation_id)

    started = time.perf_counter()
    last_error: HTTPException | None = None
    audio: bytes | None = None
    content_type = "application/octet-stream"
    attempt_rows: list[dict] = []
    retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
    for candidate in routes:
        try:
            provider_payload = body | {"model": candidate.resolved_model_id}
            if candidate.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                provider_payload["api_key"] = _credential_value(candidate.secret_reference)
            audio, content_type = await provider_client(candidate).request_bytes(endpoint, provider_payload)
            route = candidate
            attempt_latency = int((time.perf_counter() - started) * 1000)
            record_provider_health(db, candidate.provider, success=True, latency_ms=attempt_latency)
            attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "success", "error_code": None, "latency_ms": attempt_latency})
            break
        except HTTPException as exc:
            last_error = exc
            error_code = "provider_error"
            if isinstance(exc.detail, dict):
                error_code = exc.detail.get("error", {}).get("code", error_code)
            attempt_latency = int((time.perf_counter() - started) * 1000)
            record_provider_health(db, candidate.provider, success=False, latency_ms=attempt_latency, error_code=error_code)
            attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": attempt_latency})
            if error_code not in retryable:
                break
    if audio is None:
        latency_ms = int((time.perf_counter() - started) * 1000)
        error_code = "provider_error"
        if last_error is not None and isinstance(last_error.detail, dict):
            error_code = last_error.detail.get("error", {}).get("code", error_code)
        if reservation_id is not None:
            settle_wallet_reservation(db, api_key.team_id, reservation_id, 0, reservation_id)
        record = create_request_record(db, api_key, route, body["model"], "error", latency_ms, error_code, attempt_rows)
        record.usage_source = "none"
        db.commit()
        raise last_error or compass_error(503, "provider_unavailable", "No provider route succeeded.")

    latency_ms = int((time.perf_counter() - started) * 1000)
    record = create_request_record(db, api_key, route, body["model"], "success", latency_ms, attempts=attempt_rows)
    record.input_tokens = estimated_tokens
    record.total_tokens = estimated_tokens
    record.usage_source = "estimate"
    record.provider_cost_paise = 0
    record.compass_cost_paise = estimated_cost
    db.flush()
    if reservation_id is not None:
        settle_wallet_reservation(db, api_key.team_id, reservation_id, estimated_cost, record.id)
    return audio, content_type


async def complete_multipart_api(db: Session, api_key: ApiKey, model_id: str, form_data: dict, file: tuple[str, bytes, str], endpoint: str, capability: str) -> dict:
    routes, byok_route = _billing_routes(route_candidates(db, api_key, model_id, capability))
    route = routes[0]
    estimated_tokens = max(1, len(file[1]) // 4_000)
    estimated_cost = 0 if byok_route else max(estimate_max_cost_paise(candidate.model, {"messages": [{"content": "audio transcription"}], "max_tokens": 256}) for candidate in routes)
    enforce_team_limits(db, api_key.team_id, estimated_tokens, estimated_cost)
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == api_key.team_id))
    enforce_api_key_limits(db, api_key, estimated_cost)
    enforce_model_policy(db, api_key, route.model.id, estimated_cost)
    if not byok_route and (wallet is None or wallet.balance_paise < estimated_cost):
        raise compass_error(402, "insufficient_balance", "Wallet balance is insufficient.")
    reservation_id = new_id() if not byok_route else None
    if reservation_id is not None:
        reserve_wallet(db, api_key.team_id, estimated_cost, reservation_id)

    started = time.perf_counter()
    response: dict | None = None
    last_error: HTTPException | None = None
    attempt_rows: list[dict] = []
    retryable = {"provider_timeout", "provider_unavailable", "provider_rate_limited", "provider_error"}
    for candidate in routes:
        attempt_started = time.perf_counter()
        try:
            provider_data = form_data | {"model": candidate.resolved_model_id}
            if candidate.secret_reference.startswith(("encrypted:", "gcp-secret:")):
                provider_data["api_key"] = _credential_value(candidate.secret_reference)
            response = await provider_client(candidate).request_multipart(endpoint, provider_data, file)
            route = candidate
            attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
            record_provider_health(db, candidate.provider, success=True, latency_ms=attempt_latency)
            attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "success", "error_code": None, "latency_ms": attempt_latency})
            break
        except HTTPException as exc:
            last_error = exc
            error_code = "provider_error"
            if isinstance(exc.detail, dict):
                error_code = exc.detail.get("error", {}).get("code", error_code)
            attempt_latency = int((time.perf_counter() - attempt_started) * 1000)
            record_provider_health(db, candidate.provider, success=False, latency_ms=attempt_latency, error_code=error_code)
            attempt_rows.append({"provider": candidate.provider.name, "provider_model_id": candidate.resolved_model_id, "status": "error", "error_code": error_code, "latency_ms": attempt_latency})
            if error_code not in retryable:
                break
    latency_ms = int((time.perf_counter() - started) * 1000)
    if response is None:
        if reservation_id is not None:
            settle_wallet_reservation(db, api_key.team_id, reservation_id, 0, reservation_id)
        record = create_request_record(db, api_key, route, model_id, "error", latency_ms, "provider_error", attempt_rows)
        record.usage_source = "none"
        db.commit()
        raise last_error or compass_error(503, "provider_unavailable", "No provider route succeeded.")

    usage, usage_source = _usage_with_source(response, estimated_tokens)
    provider_cost, compass_cost = calculate_cost_paise(route.model, usage)
    if byok_route:
        compass_cost = 0
    record = create_request_record(db, api_key, route, model_id, "success", latency_ms, attempts=attempt_rows)
    record.input_tokens = usage["prompt_tokens"]
    record.output_tokens = usage["completion_tokens"]
    record.total_tokens = usage["total_tokens"]
    record.usage_source = usage_source
    record.provider_cost_paise = provider_cost
    record.compass_cost_paise = compass_cost
    db.flush()
    if reservation_id is not None:
        settle_wallet_reservation(db, api_key.team_id, reservation_id, compass_cost, record.id)
    response["compass"] = {"request_id": record.id, "team_id": api_key.team_id, "member_id": api_key.member_id, "provider": route.provider.name, "credential_mode": route.credential_mode, "latency_ms": latency_ms, "provider_cost_paise": provider_cost, "compass_cost_paise": compass_cost, "local_test_mode": get_settings().local_test_mode}
    return response


def _response_text(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for part in value:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                text = part.get("text") or part.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return ""


def stream_openai_chunks(full_response: dict):
    choice = (full_response.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    text_parts = []
    for value in (message.get("content"), message.get("reasoning_content"), choice.get("text")):
        text = _response_text(value)
        if text and text not in text_parts:
            text_parts.append(text)
    content = "\n".join(text_parts)
    tool_calls = message.get("tool_calls") or []
    chunk_id = full_response["id"]
    model = full_response["model"]
    yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': full_response['created'], 'model': model, 'choices': [{'index': 0, 'delta': {'role': 'assistant'}, 'finish_reason': None}]})}\n\n"
    if content:
        yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': full_response['created'], 'model': model, 'choices': [{'index': 0, 'delta': {'content': content}, 'finish_reason': None}]})}\n\n"
    for index, call in enumerate(tool_calls):
        function = call.get("function") or {}
        arguments = function.get("arguments", "")
        if not isinstance(arguments, str):
            arguments = json.dumps(arguments)
        delta = {
            "tool_calls": [{
                "index": index,
                "id": call.get("id") or f"call_{index}",
                "type": call.get("type", "function"),
                "function": {"name": function.get("name", ""), "arguments": arguments},
            }]
        }
        yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': full_response['created'], 'model': model, 'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}]})}\n\n"
    finish_reason = "tool_calls" if tool_calls else "stop"
    yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': full_response['created'], 'model': model, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': finish_reason}], 'usage': full_response.get('usage'), 'compass': full_response.get('compass')})}\n\n"
    yield "data: [DONE]\n\n"


def _catalog_model_is_fresh(model: ModelCatalog) -> bool:
    """A production route must come from a recent verified catalog snapshot."""

    settings = get_settings()
    if settings.local_test_mode:
        return True
    if model.catalog_source == "openrouter":
        max_age = settings.openrouter_catalog_stale_after_seconds
    elif model.catalog_source == "litellm":
        max_age = settings.litellm_catalog_cache_seconds * 3
    else:
        return False
    return model.last_synced_at is not None and model.last_synced_at >= now() - timedelta(seconds=max(60, max_age))


def model_catalog_rows(db: Session, include_unpublished: bool = False) -> list[dict]:
    stmt = select(ModelCatalog).order_by(ModelCatalog.id)
    if not include_unpublished:
        stmt = stmt.join(Provider, Provider.id == ModelCatalog.provider_id).where(
            ModelCatalog.enabled.is_(True),
            ModelCatalog.published.is_(True),
            ModelCatalog.status == "available",
            Provider.enabled.is_(True),
            Provider.status.not_in(["disabled", "unavailable"]),
        )
        if not get_settings().local_test_mode:
            stmt = stmt.where(Provider.commercial_status == "approved")
    rows = db.scalars(stmt).all()
    result = []
    for row in rows:
        try:
            metadata = json.loads(row.raw_metadata_json or "{}")
        except (TypeError, ValueError):
            metadata = {}
        try:
            input_modalities = json.loads(row.input_modalities or "[]")
        except (TypeError, ValueError):
            input_modalities = metadata.get("input_modalities", [])
        try:
            output_modalities = json.loads(row.output_modalities or "[]")
        except (TypeError, ValueError):
            output_modalities = metadata.get("output_modalities", [])
        result.append(
            {
                "id": row.id,
                "display_name": row.display_name,
                "provider": row.provider.name,
                "provider_model_id": row.provider_model_id,
                "protocol": row.protocol,
                "capabilities": [item for item in row.capabilities.split(",") if item],
                "capability_types": [item for item in row.capability_types.split(",") if item],
                "max_output_tokens": row.max_output_tokens,
                "context_window": row.context_window,
                "input_price_paise_per_1k": row.input_price_paise_per_1k,
                "output_price_paise_per_1k": row.output_price_paise_per_1k,
                "input_price_usd_per_million": str(row.input_price_usd_per_million) if row.input_price_usd_per_million is not None else None,
                "output_price_usd_per_million": str(row.output_price_usd_per_million) if row.output_price_usd_per_million is not None else None,
                "supports_streaming": row.supports_streaming,
                "supports_tools": row.supports_tools,
                "supports_reasoning": row.supports_reasoning,
                "supports_vision": row.supports_vision,
                "fallback_model_id": row.fallback_model_id,
                "enabled": row.enabled,
                "published": row.published,
                "status": row.status,
                "route_readiness_reason": row.route_readiness_reason,
                "route_ready": row.enabled and row.published and row.status == "available" and row.provider.enabled and row.provider.status not in {"disabled", "unavailable"} and (get_settings().local_test_mode or row.provider.commercial_status == "approved") and _catalog_model_is_fresh(row),
                "provider_status": row.provider.status,
                "provider_commercial_status": row.provider.commercial_status,
                "provider_enabled": row.provider.enabled,
                "catalog_source": row.catalog_source,
                "pricing_policy_version": row.pricing_policy_version,
                "source_created_at": row.source_created_at.isoformat() if row.source_created_at else None,
                "last_synced_at": row.last_synced_at.isoformat() if row.last_synced_at else None,
                "description": metadata.get("description", ""),
                "input_modalities": input_modalities,
                "output_modalities": output_modalities,
                "supported_parameters": metadata.get("supported_parameters", []),
            }
        )
    if not include_unpublished:
        result = [row for row in result if row["route_ready"]]
    return result


def model_policy_rows(db: Session, team_id: str) -> list[dict]:
    policies = {policy.model_id: policy for policy in db.scalars(select(ModelPolicy).where(ModelPolicy.team_id == team_id)).all()}
    models = db.scalars(
        select(ModelCatalog)
        .join(Provider, Provider.id == ModelCatalog.provider_id)
        .where(
            ModelCatalog.enabled.is_(True),
            ModelCatalog.published.is_(True),
            ModelCatalog.status == "available",
            Provider.enabled.is_(True),
            Provider.status.not_in(["disabled", "unavailable"]),
        )
        .order_by(ModelCatalog.id)
    ).all()
    if not get_settings().local_test_mode:
        models = [
            model
            for model in models
            if model.provider.commercial_status == "approved" and _catalog_model_is_fresh(model)
        ]
    return [{"id": policies.get(model.id).id if model.id in policies else None, "team_id": team_id, "model_id": model.id, "enabled": policies[model.id].enabled if model.id in policies else True, "requests_per_minute": policies[model.id].requests_per_minute if model.id in policies else 0, "daily_spend_limit_paise": policies[model.id].daily_spend_limit_paise if model.id in policies else 0, "monthly_spend_limit_paise": policies[model.id].monthly_spend_limit_paise if model.id in policies else 0, "updated_at": policies[model.id].updated_at.isoformat() if model.id in policies else None} for model in models]


def enforce_model_policy(db: Session, api_key: ApiKey, model_id: str, estimated_cost_paise: int) -> None:
    policy = db.scalar(select(ModelPolicy).where(ModelPolicy.team_id == api_key.team_id, ModelPolicy.model_id == model_id))
    if policy is None:
        return
    if not policy.enabled:
        raise compass_error(403, "model_disabled_for_team", "This model is disabled for the team.")
    minute_ago = now() - timedelta(minutes=1)
    if policy.requests_per_minute > 0:
        requests = db.scalar(select(func.count(LlmRequest.id)).where(LlmRequest.team_id == api_key.team_id, LlmRequest.requested_model == model_id, LlmRequest.created_at >= minute_ago)) or 0
        if requests >= policy.requests_per_minute:
            raise compass_error(429, "model_rate_limit_exceeded", "Model request rate limit exceeded for this team.")
    day_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    if policy.daily_spend_limit_paise > 0:
        daily = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.team_id == api_key.team_id, LlmRequest.requested_model == model_id, LlmRequest.created_at >= day_start, LlmRequest.status == "success")) or 0
        if daily + estimated_cost_paise > policy.daily_spend_limit_paise:
            raise compass_error(429, "model_daily_spend_limit_exceeded", "Model daily spending limit exceeded for this team.")
    month_start = day_start.replace(day=1)
    if policy.monthly_spend_limit_paise > 0:
        monthly = db.scalar(select(func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0)).where(LlmRequest.team_id == api_key.team_id, LlmRequest.requested_model == model_id, LlmRequest.created_at >= month_start, LlmRequest.status == "success")) or 0
        if monthly + estimated_cost_paise > policy.monthly_spend_limit_paise:
            raise compass_error(429, "model_monthly_spend_limit_exceeded", "Model monthly spending limit exceeded for this team.")


def list_api_keys(db: Session, team_id: str | None = None, team_ids: list[str] | None = None, user_id: str | None = None, organization_ids: list[str] | None = None) -> list[dict]:
    if team_ids is not None and not team_ids:
        return []
    stmt = select(ApiKey).order_by(ApiKey.created_at.desc())
    if team_id:
        stmt = stmt.where(ApiKey.team_id == team_id)
    if team_ids is not None:
        stmt = stmt.where(ApiKey.team_id.in_(team_ids))
    if user_id:
        stmt = stmt.where(ApiKey.user_id == user_id)
    if organization_ids is not None:
        if not organization_ids:
            return []
        stmt = stmt.where(ApiKey.organization_id.in_(organization_ids))
    keys = db.scalars(stmt).all()
    if not keys:
        return []
    key_ids = [key.id for key in keys]
    usage_rows = db.execute(
        select(
            LlmRequest.api_key_id,
            func.count(LlmRequest.id),
            func.coalesce(func.sum(LlmRequest.total_tokens), 0),
            func.coalesce(func.sum(LlmRequest.compass_cost_paise), 0),
        )
        .where(LlmRequest.api_key_id.in_(key_ids), LlmRequest.status == "success")
        .group_by(LlmRequest.api_key_id)
    ).all()
    usage = {row[0]: {"requests": row[1], "tokens": row[2], "spend_paise": row[3]} for row in usage_rows}
    return [{"id": key.id, "team_id": key.team_id, "project_id": key.project_id, "member_id": key.member_id, "name": key.name, "purpose": key.purpose, "key": f"{key.key_prefix}...", "status": key.status, "created_at": key.created_at.isoformat(), "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None, "expires_at": key.expires_at.isoformat() if key.expires_at else None, "allowed_models": sorted(allowed_model_ids(db, key.id)), "models_restricted": api_key_models_restricted(db, key.id), "rate_limit": key.rate_limit, "daily_limit_paise": key.daily_limit, "monthly_limit_paise": key.monthly_limit, "usage": usage.get(key.id, {"requests": 0, "tokens": 0, "spend_paise": 0})} for key in keys]


def request_rows(rows: list[LlmRequest]) -> list[dict]:
    return [{"id": row.id, "project_id": row.project_id, "team_id": row.team_id, "member_id": row.member_id, "api_key_id": row.api_key_id, "status": row.status, "error_code": row.error_code, "model": row.requested_model, "provider": row.provider, "tokens": row.total_tokens, "input_tokens": row.input_tokens, "output_tokens": row.output_tokens, "usage_source": row.usage_source, "credential_mode": row.credential_mode, "provider_cost_paise": row.provider_cost_paise, "cost_paise": row.compass_cost_paise, "latency_ms": row.latency_ms, "created_at": row.created_at.isoformat()} for row in rows]


def dashboard_summary(db: Session, team_ids: list[str] | None = None, user_id: str | None = None, workspace_ids: list[str] | None = None) -> dict:
    if team_ids is not None and not team_ids:
        teams = []
        requests = []
        wallets = {}
    else:
        team_stmt = select(Team).order_by(Team.created_at.desc())
        request_stmt = select(LlmRequest).order_by(LlmRequest.created_at.desc()).limit(20)
        wallet_stmt = select(WalletAccount).where(WalletAccount.team_id.is_not(None))
        if team_ids is not None:
            team_stmt = team_stmt.where(Team.id.in_(team_ids))
            request_stmt = request_stmt.where(LlmRequest.team_id.in_(team_ids))
            wallet_stmt = wallet_stmt.where(WalletAccount.team_id.in_(team_ids))
        if user_id:
            request_stmt = request_stmt.where(LlmRequest.user_id == user_id)
        teams = db.scalars(team_stmt).all()
        requests = db.scalars(request_stmt).all()
        wallets = {wallet.team_id: wallet for wallet in db.scalars(wallet_stmt).all()}
    total_spend = sum(row.compass_cost_paise for row in requests if row.status == "success")
    total_tokens = sum(row.total_tokens for row in requests)
    if workspace_ids is None:
        workspace_ids = list(db.scalars(select(Organization.id)).all()) if team_ids is None else list(db.scalars(select(OrganizationMember.organization_id).where(OrganizationMember.user_id == user_id)).all()) if user_id else []
    workspaces = db.scalars(select(Organization).where(Organization.id.in_(workspace_ids)).order_by(Organization.created_at.desc())).all() if workspace_ids else []
    team_counts = dict(db.execute(select(Team.organization_id, func.count(Team.id)).where(Team.organization_id.in_(workspace_ids)).group_by(Team.organization_id)).all()) if workspace_ids else {}
    return {
        "mode": "LOCAL TEST MODE" if get_settings().local_test_mode else "LIVE PROVIDER MODE",
        "workspaces": [{"id": workspace.id, "name": workspace.name, "team_count": team_counts.get(workspace.id, 0), "created_at": workspace.created_at.isoformat()} for workspace in workspaces],
        "teams": [{"id": team.id, "name": team.name, "slug": team.slug, "is_active": team.is_active, "wallet": {"currency": wallets.get(team.id).currency if wallets.get(team.id) else "INR", "balance_paise": wallets.get(team.id).balance_paise if wallets.get(team.id) else 0}} for team in teams],
        "api_keys": list_api_keys(db, team_ids=team_ids, user_id=user_id),
        "models": model_catalog_rows(db),
        "usage": {"requests": len(requests), "tokens": total_tokens, "spend_paise": total_spend},
        "recent_requests": request_rows(requests),
    }
