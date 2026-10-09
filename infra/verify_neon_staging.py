"""Read-only safety checks for the Neon staging branch.

The script prints no connection URL or row contents. It intentionally fails if
known customer or financial tables are non-empty, because a fresh staging
branch must be proven separate from production before deployment.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.api.app.config import Settings
from apps.api.app.db import normalize_database_url


SENSITIVE_TABLES = (
    "users",
    "organizations",
    "organization_members",
    "payment_orders",
    "payment_events",
    "wallet_accounts",
    "wallet_ledger",
    "llm_requests",
)
ALLOWED_SSL_MODES = {"require", "verify-ca", "verify-full"}


def required_url(name: str, value: str | None):
    value = (value or "").strip()
    if not value:
        raise RuntimeError(f"{name} is required and must be supplied through an ignored environment or Secret Manager")
    url = normalize_database_url(value)
    if url.get_backend_name() != "postgresql":
        raise RuntimeError(f"{name} must be a PostgreSQL URL")
    if url.query.get("sslmode") not in ALLOWED_SSL_MODES:
        raise RuntimeError(f"{name} must require TLS with sslmode=require, verify-ca, or verify-full")
    return url


def main() -> int:
    settings = Settings()
    pooled = required_url("DATABASE_URL", settings.database_url)
    direct = required_url("DIRECT_DATABASE_URL", settings.direct_database_url)
    if not pooled.host or "pooler" not in pooled.host:
        raise RuntimeError("DATABASE_URL must use the Neon pooled endpoint")
    if not direct.host or "pooler" in direct.host:
        raise RuntimeError("DIRECT_DATABASE_URL must use the unpooled Neon endpoint")

    runtime_engine = create_engine(pooled, pool_pre_ping=True)
    migration_engine = create_engine(direct, pool_pre_ping=True)
    try:
        with runtime_engine.connect() as connection:
            connection.execute(text("SELECT 1")).scalar_one()
        with migration_engine.connect() as connection:
            connection.execute(text("SELECT 1")).scalar_one()
            version = connection.execute(
                text("SELECT version_num FROM compass.alembic_version ORDER BY version_num DESC LIMIT 1")
            ).scalar_one_or_none()
            if not version:
                raise RuntimeError("Neon staging database has no Alembic head")
            counts = {}
            for table in SENSITIVE_TABLES:
                counts[table] = int(connection.execute(text(f'SELECT COUNT(*) FROM "compass"."{table}"')).scalar_one())
            populated = {table: count for table, count in counts.items() if count}
            if populated:
                raise RuntimeError("Neon staging contains rows in protected customer/financial tables; review the branch before continuing")
    finally:
        runtime_engine.dispose()
        migration_engine.dispose()

    print("Neon staging connectivity, TLS, pooled/direct routing, and empty protected-table checks passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Neon staging verification failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
