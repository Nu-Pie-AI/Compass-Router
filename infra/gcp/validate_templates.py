"""Validate deploy-time Cloud Run templates without contacting GCP.

This check verifies that templates remain placeholder-only and keep secrets in
Cloud Run secret references. It intentionally does not render or apply them.
"""

from __future__ import annotations

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent
TEMPLATES = (
    ROOT / "cloudrun-api-service.yaml.template",
    ROOT / "cloudrun-api-staging-service.yaml.template",
    ROOT / "cloudrun-web-service.yaml.template",
)
PLACEHOLDER = re.compile(r"\$\{[A-Z0-9_]+\}")
SECRET_ENV_NAMES = {
    "DATABASE_URL",
    "DIRECT_DATABASE_URL",
    "REDIS_URL",
    "APP_SECRET",
    "CLERK_SECRET_KEY",
    "CLERK_WEBHOOK_SIGNING_SECRET",
    "LITELLM_MASTER_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "COMPASS_SSO_SECRET",
    "ADMIN_PASSWORD",
    "SMTP_USERNAME",
    "SMTP_PASSWORD",
    "FX_REFRESH_JOB_SECRET",
}
API_REQUIRED_PLACEHOLDERS = {
    "API_SERVICE",
    "CLOUD_SQL_INSTANCE",
    "API_SERVICE_ACCOUNT",
    "API_IMAGE",
    "GCP_PROJECT_ID",
    "WEB_URL",
    "LITELLM_INTERNAL_URL",
    "EMAIL_FROM",
    "SMTP_HOST",
    "PLATFORM_SUPER_ADMIN_CLERK_USER_ID",
    "DATABASE_URL_SECRET",
    "DATABASE_URL_SECRET_VERSION",
    "DIRECT_DATABASE_URL_SECRET",
    "DIRECT_DATABASE_URL_SECRET_VERSION",
    "REDIS_URL_SECRET",
    "REDIS_URL_SECRET_VERSION",
    "APP_SECRET_SECRET",
    "APP_SECRET_SECRET_VERSION",
    "COMPASS_SSO_SECRET",
    "COMPASS_SSO_SECRET_VERSION",
    "ADMIN_PASSWORD_SECRET",
    "ADMIN_PASSWORD_SECRET_VERSION",
    "CLERK_SECRET_SECRET",
    "CLERK_SECRET_SECRET_VERSION",
    "CLERK_WEBHOOK_SECRET",
    "CLERK_WEBHOOK_SECRET_VERSION",
    "LITELLM_MASTER_KEY_SECRET",
    "LITELLM_MASTER_KEY_SECRET_VERSION",
    "RAZORPAY_KEY_ID_SECRET",
    "RAZORPAY_KEY_ID_SECRET_VERSION",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_KEY_SECRET_VERSION",
    "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_WEBHOOK_SECRET_VERSION",
    "SMTP_USERNAME_SECRET",
    "SMTP_USERNAME_SECRET_VERSION",
    "SMTP_PASSWORD_SECRET",
    "SMTP_PASSWORD_SECRET_VERSION",
    "FX_REFRESH_JOB_SECRET",
    "FX_REFRESH_JOB_SECRET_VERSION",
}
WEB_REQUIRED_PLACEHOLDERS = {"WEB_SERVICE", "WEB_SERVICE_ACCOUNT", "WEB_IMAGE", "API_INTERNAL_URL"}
STAGING_API_REQUIRED_PLACEHOLDERS = API_REQUIRED_PLACEHOLDERS - {"CLOUD_SQL_INSTANCE"}
REQUIRED_PRODUCTION_VALUES = {
    "ENVIRONMENT": "production",
    "DATABASE_MIGRATION_MODE": "alembic",
    "SECRET_MANAGER_ENABLED": "true",
    "LOCAL_TEST_MODE": "false",
    "PUBLIC_SIGNUP_ENABLED": "true",
    "BILLING_PAYMENT_MODE": "razorpay",
    "PROVIDER_EXECUTION_MODE": "proxy",
    "REDIS_RATE_LIMIT_ENABLED": "true",
    "EMAIL_DELIVERY_MODE": "smtp",
    "SMTP_USE_TLS": "true",
}


def validate_template(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if "secretKeyRef:" not in text and path.name.startswith("cloudrun-api"):
        raise AssertionError(f"{path.name} has no secretKeyRef entries")
    if "value:" in text and any(token in text for token in ("sk_live_", "rzp_live_", "-----BEGIN", "AIza")):
        raise AssertionError(f"{path.name} contains a possible secret value")
    placeholders = PLACEHOLDER.findall(text)
    if not placeholders:
        raise AssertionError(f"{path.name} has no deployment placeholders")
    if path.name == "cloudrun-api-staging-service.yaml.template":
        required_placeholders = STAGING_API_REQUIRED_PLACEHOLDERS
    elif path.name.startswith("cloudrun-api"):
        required_placeholders = API_REQUIRED_PLACEHOLDERS
    else:
        required_placeholders = WEB_REQUIRED_PLACEHOLDERS
    placeholder_names = {item[2:-1] for item in placeholders}
    missing_placeholders = sorted(required_placeholders - placeholder_names)
    if missing_placeholders:
        raise AssertionError(f"{path.name} is missing deployment placeholders: {', '.join(missing_placeholders)}")
    if path.name.startswith("cloudrun-api"):
        for env_name, expected in REQUIRED_PRODUCTION_VALUES.items():
            assignment = re.search(
                rf"- name: {re.escape(env_name)}\s+value:\s+\"?([^\"\s]+)\"?",
                text,
                flags=re.MULTILINE,
            )
            if assignment is None or assignment.group(1) != expected:
                raise AssertionError(f"{path.name} must set {env_name} to {expected}")
        for env_name in SECRET_ENV_NAMES:
            secret_assignment = re.search(
                rf"- name: {re.escape(env_name)}\s+valueFrom:\s+secretKeyRef:\s+name:\s+\$\{{[A-Z0-9_]+\}}\s+key:\s+\$\{{[A-Z0-9_]+\}}",
                text,
                flags=re.MULTILINE,
            )
            if secret_assignment is None:
                raise AssertionError(f"{path.name} must source {env_name} from Secret Manager")
    for env_name in SECRET_ENV_NAMES:
        plaintext_assignment = re.search(
            rf"- name: {re.escape(env_name)}\s+value:",
            text,
            flags=re.MULTILINE,
        )
        if plaintext_assignment:
            raise AssertionError(f"{path.name} exposes secret env {env_name} as a plaintext value")


def main() -> None:
    for template in TEMPLATES:
        validate_template(template)
    print(f"validated {len(TEMPLATES)} Cloud Run templates")


if __name__ == "__main__":
    main()
