from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    app_secret: str = "dev-only-change-me"
    database_url: str = "postgresql+psycopg://compass:compass@localhost:5432/compass"
    redis_url: str = "redis://localhost:6379/0"
    compass_web_origin: str = "http://localhost:23000"
    compass_sso_secret: str = "dev-compass-sso-secret-change-me"
    compass_litellm_url: str | None = None
    litellm_url: str = "http://localhost:4000"
    litellm_master_key: str = "dev-litellm-key"
    request_body_limit_bytes: int = 1_000_000
    local_test_input_price_paise_per_1k: int = 2
    local_test_output_price_paise_per_1k: int = 6
    local_test_wallet_credit_paise: int = 50_000
    litellm_timeout_seconds: float = 60.0
    provider_max_attempts: int = 2
    provider_retry_backoff_seconds: float = 0.25
    redis_rate_limit_enabled: bool = True
    litellm_catalog_cache_seconds: int = 300
    usd_to_inr_paise_per_usd: int = 8500
    local_test_mode: bool = True
    public_signup_enabled: bool = False
    admin_email: str = "admin@example.com"
    admin_password: str = "CompassAdmin123!"
    admin_name: str = "Compass Operator"
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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
