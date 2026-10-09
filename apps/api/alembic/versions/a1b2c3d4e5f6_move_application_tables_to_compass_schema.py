"""move application tables to the Compass schema

Revision ID: a1b2c3d4e5f6
Revises: f0a1b2c3d4e5
"""

from typing import Sequence, Union

from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Keep this list explicit so the repair cannot move unrelated public-schema data.
APPLICATION_TABLES = (
    "api_key_models",
    "api_keys",
    "audit_logs",
    "batch_jobs",
    "billing_invoices",
    "byok_credentials",
    "catalog_sync_runs",
    "clerk_webhook_events",
    "email_otp_challenges",
    "email_outbox",
    "extension_device_authorizations",
    "extension_devices",
    "extension_sessions",
    "invitations",
    "llm_requests",
    "login_attempts",
    "model_policies",
    "models",
    "operational_events",
    "organization_members",
    "organizations",
    "payment_events",
    "payment_orders",
    "payment_refunds",
    "platform_bootstrap_state",
    "platform_role_assignments",
    "platform_settings",
    "pricing_policies",
    "pricing_revisions",
    "project_members",
    "projects",
    "provider_attempts",
    "provider_credentials",
    "provider_health_checks",
    "providers",
    "routing_policies",
    "routing_policy_revisions",
    "team_limits",
    "team_members",
    "teams",
    "user_access_controls",
    "users",
    "wallet_accounts",
    "wallet_ledger",
)


def _move(source: str, target: str) -> None:
    for table in APPLICATION_TABLES:
        op.execute(
            f'ALTER TABLE IF EXISTS "{source}"."{table}" SET SCHEMA "{target}"'
        )


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    _move("public", "compass")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    _move("compass", "public")
