from collections.abc import Generator

from sqlalchemy import MetaData, create_engine, event, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


def normalize_database_url(database_url: str):
    """Normalize PostgreSQL URLs to the installed psycopg SQLAlchemy driver."""
    raw = database_url.strip()
    if raw.startswith("postgres://"):
        raw = "postgresql+psycopg://" + raw[len("postgres://"):]
    url = make_url(raw)
    if url.get_backend_name() == "postgresql" and url.drivername != "postgresql+psycopg":
        url = url.set(drivername="postgresql+psycopg")
    query = dict(url.query)
    # These are Prisma/pooler options and are not SQLAlchemy/psycopg options.
    for key in ("pgbouncer", "connection_limit", "pool_timeout"):
        query.pop(key, None)
    return url.set(query=query)


def migration_database_url(settings=None):
    settings = settings or get_settings()
    return normalize_database_url(settings.direct_database_url or settings.database_url)


_DATABASE_URL = normalize_database_url(get_settings().database_url)
_IS_SQLITE = _DATABASE_URL.get_backend_name() == "sqlite"
_COMPASS_SCHEMA = None if _IS_SQLITE else "compass"


class Base(DeclarativeBase):
    metadata = MetaData(schema=_COMPASS_SCHEMA)


engine = create_engine(
    _DATABASE_URL,
    pool_pre_ping=True,
)


if _COMPASS_SCHEMA:
    @event.listens_for(engine, "connect")
    def _set_database_schema(dbapi_connection, _connection_record):
        with dbapi_connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO "{_COMPASS_SCHEMA}", public')
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    settings = get_settings()
    migration_mode = settings.database_migration_mode.strip().lower()
    if migration_mode == "alembic":
        return
    if settings.environment.strip().lower() in {"production", "prod"} or migration_mode != "legacy":
        raise RuntimeError("Database schema must be managed by Alembic outside explicit development legacy mode.")

    from . import models  # noqa: F401

    if _COMPASS_SCHEMA:
        with engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{_COMPASS_SCHEMA}"'))
    Base.metadata.create_all(bind=engine)
    # The beta stack uses create_all rather than migrations. Keep existing local
    # databases compatible when the workspace/team relationship is introduced.
    columns = {
        column["name"]
        for column in inspect(engine).get_columns("teams", schema=_COMPASS_SCHEMA)
    }
    if "organization_id" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE teams ADD COLUMN organization_id VARCHAR"))
    payment_columns = {
        column["name"]
        for column in inspect(engine).get_columns("payment_orders", schema=_COMPASS_SCHEMA)
    }
    payment_migrations = {
        "receipt": "VARCHAR",
        "payment_id": "VARCHAR",
        "payment_method": "VARCHAR",
        "failure_code": "VARCHAR",
        "failure_description": "TEXT",
        "refunded_paise": "INTEGER DEFAULT 0",
    }
    missing_payment_columns = {
        name: sql_type
        for name, sql_type in payment_migrations.items()
        if name not in payment_columns
    }
    if missing_payment_columns:
        with engine.begin() as connection:
            for name, sql_type in missing_payment_columns.items():
                connection.execute(text(f"ALTER TABLE payment_orders ADD COLUMN {name} {sql_type}"))
    user_columns = {
        column["name"]
        for column in inspect(engine).get_columns("users", schema=_COMPASS_SCHEMA)
    }
    if "session_version" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN session_version INTEGER DEFAULT 0"))
    additive_columns = {
        "users": {"email_verified_at": "DATETIME"},
        "providers": {"commercial_status": "VARCHAR DEFAULT 'unreviewed'"},
        "teams": {"project_id": "VARCHAR"},
        "team_members": {"user_id": "VARCHAR"},
        "api_keys": {"project_id": "VARCHAR", "purpose": "VARCHAR DEFAULT 'workspace'", "scopes_json": "TEXT DEFAULT '[]'"},
        "llm_requests": {"project_id": "VARCHAR", "device_session_id": "VARCHAR"},
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, migrations in additive_columns.items():
            existing = {column["name"] for column in inspector.get_columns(table_name, schema=_COMPASS_SCHEMA)}
            for name, sql_type in migrations.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {sql_type}"))
    # Older beta records were created before teams were attached to workspaces.
    # Link them through the existing member and organization memberships.
    with engine.begin() as connection:
        connection.execute(text("""
            UPDATE teams
            SET organization_id = (
                SELECT om.organization_id
                FROM team_members tm
                JOIN organization_members om ON lower(tm.email) = lower((SELECT u.email FROM users u WHERE u.id = om.user_id))
                WHERE tm.team_id = teams.id
                LIMIT 1
            )
            WHERE organization_id IS NULL
        """))
