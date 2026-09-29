from datetime import UTC, datetime
from enum import Enum
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def new_id() -> str:
    return str(uuid4())


class Role(str, Enum):
    customer = "customer"
    admin = "admin"
    super_admin = "super_admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default=Role.customer.value)
    session_version: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    window_started_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String)
    daily_limit_paise: Mapped[int] = mapped_column(Integer, default=100_000)
    monthly_limit_paise: Mapped[int] = mapped_column(Integer, default=1_000_000)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("user_id", "organization_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    role: Mapped[str] = mapped_column(String, default=Role.customer.value)


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "email"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"))
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, index=True)
    role: Mapped[str] = mapped_column(String, default="tester")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    team: Mapped[Team] = relationship()


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    key_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String)
    key_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id"), nullable=True)
    name: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="active")
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    daily_limit: Mapped[int] = mapped_column(Integer, default=5000)
    monthly_limit: Mapped[int] = mapped_column(Integer, default=100000)
    rate_limit: Mapped[int] = mapped_column(Integer, default=60)
    team: Mapped[Team | None] = relationship()
    member: Mapped[TeamMember | None] = relationship()


class ApiKeyModel(Base):
    __tablename__ = "api_key_models"
    __table_args__ = (UniqueConstraint("api_key_id", "model_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    api_key_id: Mapped[str] = mapped_column(ForeignKey("api_keys.id"))
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String, unique=True)
    status: Mapped[str] = mapped_column(String, default="healthy")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ProviderCredential(Base):
    __tablename__ = "provider_credentials"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id"))
    credential_mode: Mapped[str] = mapped_column(String, default="platform")
    secret_reference: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="active")
    last_four: Mapped[str] = mapped_column(String, default="")
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ByokCredential(Base):
    __tablename__ = "byok_credentials"
    __table_args__ = (UniqueConstraint("team_id", "provider_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id"))
    encrypted_secret: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="active")
    last_four: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    provider: Mapped[Provider] = relationship()


class ModelCatalog(Base):
    __tablename__ = "models"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id"))
    provider_model_id: Mapped[str] = mapped_column(String)
    display_name: Mapped[str] = mapped_column(String)
    capabilities: Mapped[str] = mapped_column(Text, default="chat")
    context_window: Mapped[int] = mapped_column(Integer, default=128000)
    input_price_paise_per_1k: Mapped[int] = mapped_column(Integer, default=1)
    output_price_paise_per_1k: Mapped[int] = mapped_column(Integer, default=4)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    published: Mapped[bool] = mapped_column(Boolean, default=True)
    supports_streaming: Mapped[bool] = mapped_column(Boolean, default=True)
    supports_tools: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_reasoning: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_vision: Mapped[bool] = mapped_column(Boolean, default=False)
    fallback_model_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="available")
    provider: Mapped[Provider] = relationship()


class ModelPolicy(Base):
    __tablename__ = "model_policies"
    __table_args__ = (UniqueConstraint("team_id", "model_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), index=True)
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id"), index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    requests_per_minute: Mapped[int] = mapped_column(Integer, default=0)
    daily_spend_limit_paise: Mapped[int] = mapped_column(Integer, default=0)
    monthly_spend_limit_paise: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    team: Mapped[Team] = relationship()
    model: Mapped[ModelCatalog] = relationship()


class TeamLimit(Base):
    __tablename__ = "team_limits"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), unique=True)
    requests_per_minute: Mapped[int] = mapped_column(Integer, default=60)
    tokens_per_minute: Mapped[int] = mapped_column(Integer, default=100000)
    daily_spend_limit_paise: Mapped[int] = mapped_column(Integer, default=100000)
    monthly_spend_limit_paise: Mapped[int] = mapped_column(Integer, default=1000000)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    team: Mapped[Team] = relationship()


class WalletAccount(Base):
    __tablename__ = "wallet_accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), unique=True, nullable=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), unique=True, nullable=True, index=True)
    currency: Mapped[str] = mapped_column(String, default="INR")
    balance_paise: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class WalletLedger(Base):
    __tablename__ = "wallet_ledger"
    __table_args__ = (UniqueConstraint("wallet_id", "idempotency_key"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    wallet_id: Mapped[str] = mapped_column(ForeignKey("wallet_accounts.id"))
    type: Mapped[str] = mapped_column(String)
    amount_paise: Mapped[int] = mapped_column(Integer)
    balance_before: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer)
    reference_type: Mapped[str] = mapped_column(String)
    reference_id: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    idempotency_key: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    provider: Mapped[str] = mapped_column(String, default="razorpay")
    provider_order_id: Mapped[str] = mapped_column(String, unique=True)
    amount_paise: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String, default="INR")
    status: Mapped[str] = mapped_column(String, default="created")
    receipt: Mapped[str | None] = mapped_column(String, nullable=True)
    payment_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    payment_method: Mapped[str | None] = mapped_column(String, nullable=True)
    failure_code: Mapped[str | None] = mapped_column(String, nullable=True)
    failure_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    refunded_paise: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class PaymentEvent(Base):
    __tablename__ = "payment_events"
    __table_args__ = (UniqueConstraint("provider", "event_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    provider: Mapped[str] = mapped_column(String, default="razorpay")
    event_id: Mapped[str] = mapped_column(String)
    event_type: Mapped[str] = mapped_column(String)
    payload_hash: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="received")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class PaymentRefund(Base):
    __tablename__ = "payment_refunds"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    order_id: Mapped[str] = mapped_column(ForeignKey("payment_orders.id"), index=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), index=True)
    provider_refund_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    amount_paise: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="requested")
    reason: Mapped[str] = mapped_column(String, default="Customer requested refund")
    failure_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class BillingInvoice(Base):
    __tablename__ = "billing_invoices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    invoice_number: Mapped[str] = mapped_column(String, unique=True, index=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("payment_orders.id"), unique=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), index=True)
    currency: Mapped[str] = mapped_column(String, default="INR")
    subtotal_paise: Mapped[int] = mapped_column(Integer)
    tax_paise: Mapped[int] = mapped_column(Integer, default=0)
    total_paise: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="paid")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class LlmRequest(Base):
    __tablename__ = "llm_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id"), nullable=True)
    api_key_id: Mapped[str] = mapped_column(ForeignKey("api_keys.id"))
    requested_model: Mapped[str] = mapped_column(String)
    resolved_model: Mapped[str] = mapped_column(String)
    provider: Mapped[str] = mapped_column(String)
    route: Mapped[str] = mapped_column(String, default="direct")
    credential_mode: Mapped[str] = mapped_column(String, default="platform")
    status: Mapped[str] = mapped_column(String)
    error_code: Mapped[str | None] = mapped_column(String, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    provider_cost_paise: Mapped[int] = mapped_column(Integer, default=0)
    compass_cost_paise: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class BatchJob(Base):
    __tablename__ = "batch_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), index=True)
    api_key_id: Mapped[str] = mapped_column(ForeignKey("api_keys.id"), index=True)
    provider_batch_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    model: Mapped[str] = mapped_column(String)
    endpoint: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="submitted")
    request_json: Mapped[str] = mapped_column(Text, default="{}")
    response_json: Mapped[str] = mapped_column(Text, default="{}")
    error_code: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class OperationalEvent(Base):
    __tablename__ = "operational_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    event_type: Mapped[str] = mapped_column(String, index=True)
    severity: Mapped[str] = mapped_column(String, default="info")
    service: Mapped[str] = mapped_column(String, default="compass-api")
    message: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)


class ProviderAttempt(Base):
    __tablename__ = "provider_attempts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    request_id: Mapped[str] = mapped_column(ForeignKey("llm_requests.id"))
    provider: Mapped[str] = mapped_column(String)
    provider_model_id: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    error_code: Mapped[str | None] = mapped_column(String, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class RoutingPolicy(Base):
    __tablename__ = "routing_policies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    alias: Mapped[str] = mapped_column(String, unique=True)
    candidate_models: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class ProviderHealthCheck(Base):
    __tablename__ = "provider_health_checks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id"))
    status: Mapped[str] = mapped_column(String)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    error_rate: Mapped[int] = mapped_column(Integer, default=0)
    last_checked_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String)
    target: Mapped[str] = mapped_column(String)
    request_id: Mapped[str | None] = mapped_column(String, nullable=True)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
