import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text


ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
INITIAL_REVISION = "98a7ef85ff78"


def run_alembic(database: Path, command: str) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{database.as_posix()}"
    env["DIRECT_DATABASE_URL"] = ""
    env["DATABASE_MIGRATION_MODE"] = "alembic"
    env["PYTHONPATH"] = "."
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", *command.split()],
        cwd=API_ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )


def test_fresh_database_upgrade_and_downgrade(tmp_path: Path) -> None:
    database = tmp_path / "fresh.sqlite"

    run_alembic(database, "upgrade head")
    inspector = inspect(create_engine(f"sqlite:///{database}"))
    assert "users" in inspector.get_table_names()
    assert "clerk_user_id" in {column["name"] for column in inspector.get_columns("users")}
    assert {"catalog_sync_runs", "pricing_policies", "platform_role_assignments", "platform_bootstrap_state", "platform_settings", "pricing_revisions", "routing_policy_revisions"}.issubset(inspector.get_table_names())
    assert {"protocol", "catalog_source", "commercial_status", "last_verified_at"}.issubset({column["name"] for column in inspector.get_columns("providers")})
    assert {"protocol", "capability_types", "input_modalities", "output_modalities", "max_output_tokens", "route_readiness_reason"}.issubset({column["name"] for column in inspector.get_columns("models")})
    assert "usage_source" in {column["name"] for column in inspector.get_columns("llm_requests")}
    assert "alembic_version" in inspector.get_table_names()

    run_alembic(database, "downgrade base")
    downgraded = create_engine(f"sqlite:///{database}")
    assert inspect(downgraded).get_table_names() == ["alembic_version"]
    with downgraded.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM alembic_version")).scalar_one() == 0

    run_alembic(database, "upgrade head")
    assert "users" in inspect(create_engine(f"sqlite:///{database}")).get_table_names()


def test_upgrade_preserves_populated_pre_clerk_schema(tmp_path: Path) -> None:
    database = tmp_path / "legacy.sqlite"

    run_alembic(database, f"upgrade {INITIAL_REVISION}")
    engine = create_engine(f"sqlite:///{database}")
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, email, password_hash, role, session_version, email_verified_at, created_at) "
                "VALUES (:id, :email, :password_hash, :role, :session_version, :email_verified_at, :created_at)"
            ),
            {
                "id": "legacy-user",
                "email": "legacy@example.com",
                "password_hash": "not-a-real-password-hash",
                "role": "customer",
                "session_version": 0,
                "email_verified_at": None,
                "created_at": "2026-01-01 00:00:00",
            },
        )

    run_alembic(database, "upgrade head")
    with engine.connect() as connection:
        row = connection.execute(text("SELECT id, email, clerk_user_id FROM users WHERE id = 'legacy-user'")).one()
    assert row.id == "legacy-user"
    assert row.email == "legacy@example.com"
    assert row.clerk_user_id is None
