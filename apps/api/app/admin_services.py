"""Transactional services used by the M9 platform administration API."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .admin_authorization import PLATFORM_ROLES
from .config import get_settings
from .errors import compass_error
from .models import (
    PlatformBootstrapState,
    PlatformRoleAssignment,
    PlatformSetting,
    User,
    WalletAccount,
    WalletLedger,
    new_id,
    now,
)
from .services import record_audit_log


SETTING_RULES = {
    "signup_enabled": "bool",
    "public_model_visibility": "bool",
    "maintenance_mode": "bool",
    "provider_availability_policy": "string",
    "trial_credit_paise": "nonnegative_int",
    "maximum_wallet_topup_paise": "positive_int",
    "default_requests_per_minute": "nonnegative_int",
    "default_tokens_per_minute": "nonnegative_int",
    "support_email": "string",
    "support_contact_url": "string",
    "platform_announcement": "string",
    "feature_flags": "bool_map",
}


def bootstrap_platform_owner(db: Session, clerk_user_id: str, confirmation: str, mfa_verified: bool) -> dict:
    settings = get_settings()
    if confirmation != "BOOTSTRAP_PLATFORM_OWNER":
        raise compass_error(400, "bootstrap_confirmation_required", "The owner bootstrap confirmation is invalid.")
    if settings.platform_super_admin_require_mfa and not mfa_verified:
        raise compass_error(403, "owner_mfa_required", "Verified MFA is required before bootstrapping the platform owner.")
    configured_id = (settings.platform_super_admin_clerk_user_id or "").strip()
    if not configured_id:
        raise compass_error(503, "owner_bootstrap_not_configured", "Configure PLATFORM_SUPER_ADMIN_CLERK_USER_ID before bootstrapping the platform owner.")
    if clerk_user_id != configured_id:
        raise compass_error(403, "owner_bootstrap_denied", "This verified Clerk identity is not configured as the platform owner.")
    state = db.get(PlatformBootstrapState, "primary")
    if state is not None:
        if state.owner_clerk_user_id != clerk_user_id:
            raise compass_error(409, "owner_bootstrap_already_used", "The platform owner bootstrap has already been used.")
        if state.status != "active":
            raise compass_error(409, "owner_bootstrap_revoked", "The initial platform owner was revoked and cannot be automatically restored.")
        assignment = db.scalar(select(PlatformRoleAssignment).where(PlatformRoleAssignment.user_id == state.owner_user_id, PlatformRoleAssignment.role == "PLATFORM_SUPER_ADMIN"))
        if assignment is not None and assignment.status == "active":
            return {"status": "already_bootstrapped", "user_id": state.owner_user_id, "clerk_user_id": state.owner_clerk_user_id}
        raise compass_error(409, "owner_bootstrap_revoked", "The initial platform owner assignment is no longer active.")
    user = db.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
    if user is None:
        raise compass_error(409, "identity_not_provisioned", "Provision the verified Clerk identity in Compass before owner bootstrap.")
    state = PlatformBootstrapState(id="primary", owner_user_id=user.id, owner_clerk_user_id=clerk_user_id, status="active")
    assignment = PlatformRoleAssignment(user_id=user.id, role="PLATFORM_SUPER_ADMIN", status="active", reason="Controlled initial owner bootstrap")
    db.add_all([state, assignment])
    record_audit_log(db, user, "platform.owner_bootstrapped", f"user:{user.id}", {"clerk_user_id": clerk_user_id, "bootstrap_state": "primary"})
    db.commit()
    return {"status": "bootstrapped", "user_id": user.id, "clerk_user_id": clerk_user_id}


def grant_platform_role(db: Session, actor: User, target_user_id: str, role: str, reason: str) -> dict:
    if role not in PLATFORM_ROLES or role == "PLATFORM_SUPER_ADMIN":
        raise compass_error(400, "platform_role_invalid", "Only subordinate platform roles can be granted through this operation.")
    target = db.get(User, target_user_id)
    if target is None:
        raise compass_error(404, "user_not_found", "User was not found.")
    assignment = db.scalar(select(PlatformRoleAssignment).where(PlatformRoleAssignment.user_id == target.id, PlatformRoleAssignment.role == role))
    if assignment is None:
        assignment = PlatformRoleAssignment(user_id=target.id, role=role, status="active", granted_by=actor.id, reason=reason.strip())
        db.add(assignment)
    elif assignment.status == "active":
        raise compass_error(409, "platform_role_exists", "This user already has the requested platform role.")
    else:
        assignment.status = "active"
        assignment.granted_by = actor.id
        assignment.revoked_by = None
        assignment.revoked_at = None
        assignment.reason = reason.strip()
        assignment.updated_at = now()
    record_audit_log(db, actor, "platform.role_granted", f"user:{target.id}", {"role": role, "reason": reason.strip()})
    db.commit()
    return {"id": assignment.id, "user_id": target.id, "email": target.email, "role": role, "status": assignment.status}


def revoke_platform_role(db: Session, actor: User, assignment_id: str, reason: str) -> dict:
    assignment = db.get(PlatformRoleAssignment, assignment_id)
    if assignment is None:
        raise compass_error(404, "platform_role_not_found", "Platform role assignment was not found.")
    if assignment.status != "active":
        return {"id": assignment.id, "status": assignment.status, "already_revoked": True}
    if assignment.user_id == actor.id:
        raise compass_error(400, "cannot_revoke_self", "Use a separate authorized administrator to revoke your platform role.")
    assignment.status = "revoked"
    assignment.revoked_by = actor.id
    assignment.revoked_at = now()
    assignment.reason = reason.strip()
    state = db.get(PlatformBootstrapState, "primary")
    if state is not None and state.owner_user_id == assignment.user_id and assignment.role == "PLATFORM_SUPER_ADMIN":
        state.status = "revoked"
        state.revoked_by = actor.id
        state.revoked_at = now()
        state.updated_at = now()
    record_audit_log(db, actor, "platform.role_revoked", f"user:{assignment.user_id}", {"assignment_id": assignment.id, "role": assignment.role, "reason": reason.strip()})
    db.commit()
    return {"id": assignment.id, "user_id": assignment.user_id, "role": assignment.role, "status": assignment.status}


def adjust_wallet(db: Session, actor: User, team_id: str, amount_paise: int, currency: str, reason: str, idempotency_key: str) -> dict:
    wallet = db.scalar(select(WalletAccount).where(WalletAccount.team_id == team_id).with_for_update())
    if wallet is None:
        raise compass_error(404, "wallet_not_found", "Wallet not found.")
    if wallet.currency != currency:
        raise compass_error(400, "currency_mismatch", "The requested currency does not match the wallet.")
    existing = db.scalar(select(WalletLedger).where(WalletLedger.wallet_id == wallet.id, WalletLedger.idempotency_key == idempotency_key))
    if existing is not None:
        return {"ledger_id": existing.id, "team_id": team_id, "balance_paise": existing.balance_after, "idempotent": True}
    if amount_paise < 0 and wallet.balance_paise + amount_paise < 0:
        raise compass_error(402, "insufficient_balance", "The adjustment would make the wallet balance negative.")
    before = wallet.balance_paise
    wallet.balance_paise += amount_paise
    wallet.updated_at = now()
    ledger = WalletLedger(
        wallet_id=wallet.id,
        type="admin_adjustment",
        amount_paise=amount_paise,
        balance_before=before,
        balance_after=wallet.balance_paise,
        reference_type="admin_adjustment",
        reference_id=new_id(),
        description=reason.strip(),
        idempotency_key=idempotency_key,
    )
    db.add(ledger)
    record_audit_log(db, actor, "finance.wallet_adjusted", f"team:{team_id}", {"amount_paise": amount_paise, "currency": currency, "reason": reason.strip(), "idempotency_key": idempotency_key})
    db.commit()
    return {"ledger_id": ledger.id, "team_id": team_id, "balance_paise": ledger.balance_after, "idempotent": False}


def validate_platform_settings(values: dict[str, object]) -> dict[str, object]:
    unknown = sorted(set(values) - set(SETTING_RULES))
    if unknown:
        raise compass_error(400, "platform_setting_invalid", f"Unsupported platform setting: {unknown[0]}.")
    validated: dict[str, object] = {}
    for key, value in values.items():
        rule = SETTING_RULES[key]
        if rule == "bool" and not isinstance(value, bool):
            raise compass_error(400, "platform_setting_invalid", f"{key} must be a boolean.")
        if rule == "string" and (not isinstance(value, str) or len(value) > 2000):
            raise compass_error(400, "platform_setting_invalid", f"{key} must be a string of at most 2000 characters.")
        if rule == "nonnegative_int" and (not isinstance(value, int) or isinstance(value, bool) or value < 0):
            raise compass_error(400, "platform_setting_invalid", f"{key} must be a non-negative integer.")
        if rule == "positive_int" and (not isinstance(value, int) or isinstance(value, bool) or value <= 0):
            raise compass_error(400, "platform_setting_invalid", f"{key} must be a positive integer.")
        if rule == "bool_map" and (not isinstance(value, dict) or any(not isinstance(item, bool) for item in value.values())):
            raise compass_error(400, "platform_setting_invalid", f"{key} must be a map of boolean feature flags.")
        validated[key] = value
    return validated


def platform_settings_rows(db: Session) -> list[dict]:
    rows = db.scalars(select(PlatformSetting).order_by(PlatformSetting.key)).all()
    return [{"key": row.key, "value": json.loads(row.value_json), "updated_at": row.updated_at.isoformat()} for row in rows]


def update_platform_settings(db: Session, actor: User, values: dict[str, object]) -> list[dict]:
    validated = validate_platform_settings(values)
    for key, value in validated.items():
        row = db.get(PlatformSetting, key)
        if row is None:
            row = PlatformSetting(key=key, value_json=json.dumps(value, sort_keys=True), updated_by=actor.id)
            db.add(row)
        else:
            row.value_json = json.dumps(value, sort_keys=True)
            row.updated_by = actor.id
            row.updated_at = now()
        record_audit_log(db, actor, "platform.setting_updated", f"setting:{key}", {"value": value})
    db.commit()
    return platform_settings_rows(db)
