from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
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
    clerk_user_id: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default=Role.customer.value)
    session_version: Mapped[int] = mapped_column(Integer, default=0)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class UserAccess(Base):
    __tablename__ = "user_access_controls"
    __table_args__ = (UniqueConstraint("user_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="active")
    reason: Mapped[str] = mapped_column(Text, default="")
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class PlatformRoleAssignment(Base):
    __tablename__ = "platform_role_assignments"
    __table_args__ = (UniqueConstraint("user_id", "role"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="active", index=True)
    granted_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    revoked_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class PlatformBootstrapState(Base):
    __tablename__ = "platform_bootstrap_state"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    owner_clerk_user_id: Mapped[str] = mapped_column(String, unique=True)
    status: Mapped[str] = mapped_column(String, default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value_json: Mapped[str] = mapped_column(Text, default="null")
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


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
    clerk_organization_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True, index=True)
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


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("organization_id", "slug"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    slug: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String, default="member")
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
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
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
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
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id"), nullable=True)
    name: Mapped[str] = mapped_column(String)
    purpose: Mapped[str] = mapped_column(String, default="workspace")
    scopes_json: Mapped[str] = mapped_column(Text, default="[]")
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


class ApiKeyMemberAssignment(Base):
    __tablename__ = "api_key_member_assignments"
    __table_args__ = (UniqueConstraint("api_key_id", "member_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    api_key_id: Mapped[str] = mapped_column(ForeignKey("api_keys.id"), index=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("team_members.id"), index=True)
    assigned_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String, default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ApiKeyProjectPolicy(Base):
    __tablename__ = "api_key_project_policies"
    __table_args__ = (UniqueConstraint("api_key_id", "project_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    api_key_id: Mapped[str] = mapped_column(ForeignKey("api_keys.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String, unique=True)
    protocol: Mapped[str] = mapped_column(String, default="litellm")
    catalog_source: Mapped[str] = mapped_column(String, default="manual")
    commercial_status: Mapped[str] = mapped_column(String, default="unreviewed")
    status: Mapped[str] = mapped_column(String, default="unconfigured")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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
    protocol: Mapped[str] = mapped_column(String, default="litellm")
    capabilities: Mapped[str] = mapped_column(Text, default="chat")
    capability_types: Mapped[str] = mapped_column(Text, default="chat_completion,responses")
    input_modalities: Mapped[str] = mapped_column(Text, default="[]")
    output_modalities: Mapped[str] = mapped_column(Text, default="[]")
    context_window: Mapped[int] = mapped_column(Integer, default=128000)
    max_output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_price_paise_per_1k: Mapped[int] = mapped_column(Integer, default=0)
    output_price_paise_per_1k: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_streaming: Mapped[bool] = mapped_column(Boolean, default=True)
    supports_tools: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_reasoning: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_vision: Mapped[bool] = mapped_column(Boolean, default=False)
    fallback_model_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="unavailable")
    route_readiness_reason: Mapped[str] = mapped_column(Text, default="discovery and activation required")
    catalog_source: Mapped[str] = mapped_column(String, default="seeded")
    raw_metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    input_price_usd_per_million: Mapped[Decimal | None] = mapped_column(Numeric(20, 12), nullable=True)
    output_price_usd_per_million: Mapped[Decimal | None] = mapped_column(Numeric(20, 12), nullable=True)
    pricing_policy_version: Mapped[str | None] = mapped_column(String, nullable=True)
    source_created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    provider: Mapped[Provider] = relationship()


class CatalogSyncRun(Base):
    __tablename__ = "catalog_sync_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    source: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, index=True)
    source_revision: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    etag: Mapped[str | None] = mapped_column(String, nullable=True)
    model_count: Mapped[int] = mapped_column(Integer, default=0)
    raw_snapshot_json: Mapped[str] = mapped_column(Text, default="{}")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    stale_after_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class PricingPolicy(Base):
    __tablename__ = "pricing_policies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    version: Mapped[str] = mapped_column(String, unique=True, index=True)
    markup_bps: Mapped[int] = mapped_column(Integer, default=0)
    usd_to_inr_paise_per_usd: Mapped[int] = mapped_column(Integer)
    fx_buffer_bps: Mapped[int] = mapped_column(Integer, default=500)
    platform_fee_bps: Mapped[int] = mapped_column(Integer, default=500)
    fx_source: Mapped[str] = mapped_column(String, default="fixed_local_fallback")
    fx_fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active", index=True)
    effective_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class PricingRevision(Base):
    __tablename__ = "pricing_revisions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id"), index=True)
    administrator_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    previous_policy_json: Mapped[str] = mapped_column(Text, default="{}")
    new_policy_json: Mapped[str] = mapped_column(Text, default="{}")
    change_reason: Mapped[str] = mapped_column(Text)
    effective_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


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
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id"), nullable=True)
    api_key_id: Mapped[str] = mapped_column(ForeignKey("api_keys.id"))
    device_session_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
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
    usage_source: Mapped[str] = mapped_column(String, default="provider")
    provider_cost_paise: Mapped[int] = mapped_column(Integer, default=0)
    compass_cost_paise: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String, index=True)
    role: Mapped[str] = mapped_column(String, default="member")
    token_hash: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    clerk_invitation_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True, index=True)
    delivery_provider: Mapped[str] = mapped_column(String, default="compass")
    status: Mapped[str] = mapped_column(String, default="pending")
    invited_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class EmailOtpChallenge(Base):
    __tablename__ = "email_otp_challenges"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String, index=True)
    purpose: Mapped[str] = mapped_column(String, index=True)
    code_hash: Mapped[str] = mapped_column(String)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class EmailOutbox(Base):
    __tablename__ = "email_outbox"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    recipient: Mapped[str] = mapped_column(String, index=True)
    subject: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str] = mapped_column(Text, default="")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ExtensionDevice(Base):
    __tablename__ = "extension_devices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    device_name: Mapped[str] = mapped_column(String, default="VS Code")
    status: Mapped[str] = mapped_column(String, default="active")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ExtensionDeviceAuthorization(Base):
    __tablename__ = "extension_device_authorizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    device_code_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    user_code: Mapped[str] = mapped_column(String, unique=True, index=True)
    device_name: Mapped[str] = mapped_column(String, default="VS Code")
    status: Mapped[str] = mapped_column(String, default="pending")
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    device_id: Mapped[str | None] = mapped_column(ForeignKey("extension_devices.id"), nullable=True)
    session_id: Mapped[str | None] = mapped_column(ForeignKey("extension_sessions.id"), nullable=True)
    session_token_encrypted: Mapped[str] = mapped_column(Text, default="")
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ExtensionSession(Base):
    __tablename__ = "extension_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    device_id: Mapped[str] = mapped_column(ForeignKey("extension_devices.id"), index=True)
    api_key_id: Mapped[str] = mapped_column(ForeignKey("api_keys.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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


class ClerkWebhookEvent(Base):
    __tablename__ = "clerk_webhook_events"
    __table_args__ = (UniqueConstraint("event_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    payload_hash: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="received")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


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


class RoutingPolicyRevision(Base):
    __tablename__ = "routing_policy_revisions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    routing_policy_id: Mapped[str] = mapped_column(ForeignKey("routing_policies.id"), index=True)
    administrator_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    alias: Mapped[str] = mapped_column(String, index=True)
    candidate_models: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    change_reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


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
