import os
import tempfile

if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.NamedTemporaryFile(suffix=".db", delete=False).name

from app.config import Settings  # noqa: E402
from app.db import migration_database_url, normalize_database_url  # noqa: E402


def test_neon_pooler_url_uses_psycopg_and_preserves_ssl() -> None:
    url = normalize_database_url(
        "postgresql://user:password@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1"
    )
    assert url.drivername == "postgresql+psycopg"
    assert url.query["sslmode"] == "require"
    assert "pgbouncer" not in url.query
    assert "connection_limit" not in url.query


def test_direct_database_url_is_selected_for_migrations() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://pooler/neondb?sslmode=require",
        direct_database_url="postgresql://direct/neondb?sslmode=require",
    )
    assert migration_database_url(settings).host == "direct"
    assert migration_database_url(settings).drivername == "postgresql+psycopg"
