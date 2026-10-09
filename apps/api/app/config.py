from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    environment: str = "development"
    app_secret: str = "dev-only-change-me"
    database_url: str = "postgresql+psycopg://compass:compass@localhost:5432/compass"
    direct_database_url: str | None = None
    database_migration_mode: str = "legacy"
    clerk_secret_key: str | None = None
    clerk_jwt_key: str | None = None
    clerk_authorized_parties: str = ""
    clerk_audience: str | None = None
    clerk_webhook_signing_secret: str | None = None
    redis_url: str = "redis://localhost:6379/0"
    redis_socket_timeout_seconds: float = 1.5
    redis_connect_timeout_seconds: float = 3.0
    redis_max_connections: int = 20
    redis_retry_attempts: int = 2
    compass_web_origin: str = "http://localhost:23000"
    compass_sso_secret: str = "dev-compass-sso-secret-change-me"
    gcp_project_id: str | None = None
    gcp_secret_manager_prefix: str = "compass"
    secret_manager_enabled: bool = False
    compass_litellm_url: str | None = None
    litellm_url: str = "http://localhost:4000"
    litellm_master_key: str = "dev-litellm-key"
    request_body_limit_bytes: int = 1_000_000
    local_test_input_price_paise_per_1k: int = 2
    local_test_output_price_paise_per_1k: int = 6
    local_test_wallet_credit_paise: int = 50_000
    litellm_timeout_seconds: float = 60.0
    provider_execution_mode: str = "proxy"
    provider_max_attempts: int = 2
    provider_retry_backoff_seconds: float = 0.25
    provider_env_sync_mode: str = "missing"
    openai_api_key: str | None = None
    gemini_api_key: str | None = None
    anthropic_api_key: str | None = None
    mistral_api_key: str | None = None
    groq_api_key: str | None = None
    deepseek_api_key: str | None = None
    xai_api_key: str | None = None
    cohere_api_key: str | None = None
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_timeout_seconds: float = 20.0
    openrouter_catalog_cache_seconds: int = 300
    openrouter_catalog_stale_after_seconds: int = 3600
    openrouter_catalog_sync_max_attempts: int = 3
    openrouter_catalog_backoff_seconds: float = 0.5
    model_pricing_markup_bps: int = 0
    together_api_key: str | None = None
    fireworks_api_key: str | None = None
    perplexity_api_key: str | None = None
    nvidia_nim_api_key: str | None = None
    ollama_api_key: str | None = None
    azure_openai_api_key: str | None = None
    azure_ai_api_key: str | None = None
    vertex_ai_api_key: str | None = None
    cerebras_api_key: str | None = None
    sambanova_api_key: str | None = None
    deepinfra_api_key: str | None = None
    huggingface_api_key: str | None = None
    redis_rate_limit_enabled: bool = True
    litellm_catalog_cache_seconds: int = 300
    usd_to_inr_paise_per_usd: int = 8500
    local_test_mode: bool = False
    public_signup_enabled: bool = False
    otp_enabled: bool = True
    otp_ttl_seconds: int = 600
    otp_max_attempts: int = 5
    email_delivery_mode: str = "outbox"
    email_from: str = "no-reply@compass-router.local"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    smtp_timeout_seconds: float = 15.0
    email_max_attempts: int = 5
    observability_log_level: str = "INFO"
    admin_email: str = "admin@example.com"
    admin_password: str = "CompassAdmin123!"
    admin_name: str = "Compass Operator"
    platform_super_admin_clerk_user_id: str | None = None
    platform_super_admin_require_mfa: bool = True
    admin_financial_confirmation_threshold_paise: int = 100_000
    local_test_customer_email: str = "customer@example.com"
    local_test_customer_password: str = "CompassCustomer123!"
    local_test_customer_name: str = "Compass Customer"
    local_test_customer_team_name: str = "Customer Demo Team"
    local_test_customer_team_slug: str = "customer-demo"
    local_test_customer_2_email: str = "customer2@example.com"
    local_test_customer_2_password: str = "CompassCustomer456!"
    local_test_customer_2_name: str = "Compass Customer Two"
    local_test_customer_2_team_name: str = "Customer Two Demo Team"
    local_test_customer_2_team_slug: str = "customer-two-demo"
    default_team_request_limit_per_minute: int = 60
    default_team_token_limit_per_minute: int = 250_000
    default_team_daily_spend_limit_paise: int = 100_000
    default_team_monthly_spend_limit_paise: int = 1_000_000
    billing_payment_mode: str = "development"
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", PROJECT_ROOT / ".env.providers"),
        extra="ignore",
    )


def validate_runtime_config(settings: Settings) -> None:
    """Reject development-only defaults when the service is marked production."""
    if settings.environment.strip().lower() not in {"production", "prod"}:
        return
    problems: list[str] = []
    if settings.app_secret in {"dev-only-change-me", "dev-compose-secret-change-me"}:
        problems.append("APP_SECRET must be replaced")
    if settings.compass_sso_secret.startswith("dev-"):
        problems.append("COMPASS_SSO_SECRET must be replaced")
    if settings.litellm_master_key.startswith("dev-"):
        problems.append("LITELLM_MASTER_KEY must be replaced")
    if settings.local_test_mode:
        problems.append("LOCAL_TEST_MODE must be false")
    if settings.billing_payment_mode.strip().lower() != "razorpay":
        problems.append("BILLING_PAYMENT_MODE must be razorpay")
    if not settings.secret_manager_enabled:
        problems.append("SECRET_MANAGER_ENABLED must be true")
    if settings.database_migration_mode.strip().lower() != "alembic":
        problems.append("DATABASE_MIGRATION_MODE must be alembic")
    if not settings.gcp_project_id:
        problems.append("GCP_PROJECT_ID must be configured")
    if settings.admin_password in {"CompassAdmin123!", "replace-with-local-admin-password"}:
        problems.append("ADMIN_PASSWORD must be replaced")
    if not settings.razorpay_key_id or not settings.razorpay_key_secret or not settings.razorpay_webhook_secret:
        problems.append("Razorpay credentials and webhook secret must be configured")
    if not settings.clerk_secret_key:
        problems.append("CLERK_SECRET_KEY must be configured")
    if not settings.platform_super_admin_clerk_user_id:
        problems.append("PLATFORM_SUPER_ADMIN_CLERK_USER_ID must be configured")
    if not settings.clerk_webhook_signing_secret:
        problems.append("CLERK_WEBHOOK_SIGNING_SECRET must be configured")
    if not settings.smtp_host:
        problems.append("SMTP_HOST must be configured for transactional email delivery")
    if settings.smtp_username and not settings.smtp_password:
        problems.append("SMTP_PASSWORD must be configured when SMTP_USERNAME is set")
    if problems:
        raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
