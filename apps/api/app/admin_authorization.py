"""Server-side platform roles and permission checks for M9 administration."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .errors import compass_error
from .models import PlatformRoleAssignment, User


PLATFORM_ROLES = {
    "PLATFORM_SUPER_ADMIN",
    "PLATFORM_ADMIN",
    "FINANCE_ADMIN",
    "SUPPORT_ADMIN",
    "READ_ONLY_AUDITOR",
}

ROLE_PERMISSIONS = {
    "PLATFORM_SUPER_ADMIN": {"*"},
    "PLATFORM_ADMIN": {
        "admin.view",
        "customers.view",
        "customers.manage",
        "providers.view",
        "providers.manage",
        "models.view",
        "models.manage",
        "routing.view",
        "routing.manage",
        "finance.view",
        "finance.adjust",
        "operations.view",
        "security.view",
        "settings.view",
        "settings.manage",
    },
    "FINANCE_ADMIN": {"admin.view", "finance.view", "finance.adjust", "operations.view"},
    "SUPPORT_ADMIN": {"admin.view", "customers.view", "customers.manage", "operations.view", "security.view"},
    "READ_ONLY_AUDITOR": {"admin.view", "customers.view", "providers.view", "models.view", "routing.view", "finance.view", "operations.view", "security.view", "settings.view"},
}

def platform_roles(db: Session, user: User) -> set[str]:
    """Return only active, server-side platform role assignments."""
    roles = set(
        db.scalars(
            select(PlatformRoleAssignment.role).where(
                PlatformRoleAssignment.user_id == user.id,
                PlatformRoleAssignment.status == "active",
            )
        ).all()
    )
    return {role for role in roles if role in PLATFORM_ROLES}


def platform_permissions(db: Session, user: User) -> set[str]:
    permissions: set[str] = set()
    for role in platform_roles(db, user):
        permissions.update(ROLE_PERMISSIONS[role])
    return permissions


def has_platform_permission(db: Session, user: User, permission: str) -> bool:
    permissions = platform_permissions(db, user)
    return "*" in permissions or permission in permissions


def require_platform_permission(db: Session, user: User, permission: str) -> None:
    if not has_platform_permission(db, user, permission):
        raise compass_error(403, "platform_permission_denied", "You do not have permission for this platform operation.")


def require_super_admin(db: Session, user: User) -> None:
    if "PLATFORM_SUPER_ADMIN" not in platform_roles(db, user):
        raise compass_error(403, "platform_super_admin_required", "Platform Super Admin access is required.")


def clerk_mfa_verified(claims: dict) -> bool:
    if claims.get("mfa_verified") is True or claims.get("mfa") is True:
        return True
    methods = claims.get("amr") or claims.get("authentication_methods") or []
    if isinstance(methods, list):
        return any(str(item.get("method", item) if isinstance(item, dict) else item).lower() in {"mfa", "otp", "totp", "phone_verification"} for item in methods)
    return False
