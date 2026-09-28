import hashlib
import secrets
import base64
import hmac
import json
from datetime import UTC, datetime, timedelta

from cryptography.fernet import Fernet
from jose import jwt
from passlib.context import CryptContext

from .config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_session_token(user_id: str) -> str:
    settings = get_settings()
    payload = {"sub": user_id, "exp": datetime.now(UTC) + timedelta(hours=12)}
    return jwt.encode(payload, settings.app_secret, algorithm="HS256")


def decode_session_token(token: str) -> str:
    settings = get_settings()
    payload = jwt.decode(token, settings.app_secret, algorithms=["HS256"])
    return str(payload["sub"])


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
