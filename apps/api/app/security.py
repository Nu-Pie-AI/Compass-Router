import hashlib
import secrets
import base64
import hmac
import json
from datetime import UTC, datetime, timedelta

from cryptography.fernet import Fernet
from clerk_backend_api import AuthenticateRequestOptions, Clerk, authenticate_request
from fastapi import Request
from jose import jwt
from passlib.context import CryptContext

from .config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_session_token(user_id: str, session_version: int = 0) -> str:
    settings = get_settings()
    payload = {"sub": user_id, "sv": session_version, "jti": secrets.token_urlsafe(16), "exp": datetime.now(UTC) + timedelta(hours=12)}
    return jwt.encode(payload, settings.app_secret, algorithm="HS256")


def decode_session_token(token: str) -> str:
    return str(decode_session_claims(token)["sub"])


def decode_session_claims(token: str) -> dict:
    settings = get_settings()
    payload = jwt.decode(token, settings.app_secret, algorithms=["HS256"])
    if not payload.get("sub"):
        raise ValueError("session subject is missing")
    return payload


def authenticate_clerk_request(request: Request) -> dict:
    """Verify a Clerk session token without exposing token material to callers."""
    settings = get_settings()
    if not settings.clerk_secret_key and not settings.clerk_jwt_key:
        raise ValueError("Clerk is not configured")
    authorized_parties = [item.strip() for item in settings.clerk_authorized_parties.split(",") if item.strip()]
    options = AuthenticateRequestOptions(
        secret_key=settings.clerk_secret_key,
        jwt_key=settings.clerk_jwt_key,
        audience=settings.clerk_audience or None,
        authorized_parties=authorized_parties or None,
        accepts_token=["session_token"],
    )
    state = authenticate_request(request, options)
    if not state.is_authenticated or not state.payload or not state.payload.get("sub"):
        raise ValueError(state.reason or "Clerk session is not authenticated")
    return dict(state.payload)


def clerk_user_email(clerk_user_id: str) -> str:
    """Read the verified primary email from Clerk during first-user provisioning."""
    settings = get_settings()
    if not settings.clerk_secret_key:
        raise ValueError("CLERK_SECRET_KEY is required for identity provisioning")
    user = Clerk(bearer_auth=settings.clerk_secret_key).users.get(user_id=clerk_user_id)
    primary_id = getattr(user, "primary_email_address_id", None)
    addresses = getattr(user, "email_addresses", None) or []
    selected = next((item for item in addresses if getattr(item, "id", None) == primary_id), None)
    selected = selected or (addresses[0] if addresses else None)
    email = getattr(selected, "email_address", None)
    if not isinstance(email, str) or "@" not in email:
        raise ValueError("Clerk user has no usable verified email")
    verification = getattr(selected, "verification", None)
    verification_status = getattr(verification, "status", None)
    if isinstance(verification, dict):
        verification_status = verification.get("status")
    if verification_status != "verified":
        raise ValueError("Clerk user email is not verified")
    return email.strip().lower()


def decode_marketplace_sso_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload_segment, signature = token.split(".", 1)
        expected = hmac.new(settings.compass_sso_secret.encode("utf-8"), payload_segment.encode("ascii"), hashlib.sha256).digest()
        provided = base64.urlsafe_b64decode(signature + "=" * (-len(signature) % 4))
        if not hmac.compare_digest(expected, provided):
            raise ValueError("invalid signature")
        payload = json.loads(base64.urlsafe_b64decode(payload_segment + "=" * (-len(payload_segment) % 4)))
        if not isinstance(payload, dict) or not isinstance(payload.get("email"), str):
            raise ValueError("invalid payload")
        if int(payload.get("exp", 0)) < int(datetime.now(UTC).timestamp()):
            raise ValueError("expired token")
        return payload
    except (ValueError, TypeError, KeyError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("invalid Marketplace SSO token") from exc


def generate_api_key() -> tuple[str, str, str, str]:
    secret = "sk-compass-" + secrets.token_urlsafe(24).replace("-", "").replace("_", "")[:32]
    key_hash = hash_api_key(secret)
    key_id = "key_" + secrets.token_hex(8)
    key_prefix = secret[:18]
    return secret, key_id, key_prefix, key_hash


def hash_api_key(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def mask_secret(prefix: str) -> str:
    return f"{prefix}..."


def _fernet() -> Fernet:
    digest = hashlib.sha256(get_settings().app_secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(secret: str) -> str:
    return "encrypted:" + _fernet().encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt_secret(encrypted: str) -> str:
    if not encrypted.startswith("encrypted:"):
        return ""
    return _fernet().decrypt(encrypted.removeprefix("encrypted:").encode("utf-8")).decode("utf-8")
