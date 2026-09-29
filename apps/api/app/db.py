from collections.abc import Generator

from sqlalchemy import MetaData, create_engine, event, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


_DATABASE_URL = make_url(get_settings().database_url)
_IS_SQLITE = _DATABASE_URL.get_backend_name() == "sqlite"
_COMPASS_SCHEMA = None if _IS_SQLITE else "compass"


class Base(DeclarativeBase):
    metadata = MetaData(schema=_COMPASS_SCHEMA)




def _database_url():
    url = _DATABASE_URL
    query = dict(url.query)
    # Neon/Prisma URLs may include pooler options that belong to Prisma,
    # not to libpq/psycopg. Keep supported SSL and timeout parameters intact.
    for key in ("pgbouncer", "connection_limit", "pool_timeout"):
        query.pop(key, None)
    return url.set(query=query)


_DATABASE_URL = _database_url()

# Keep Router tables separate when Router and Marketplace share one Neon
# database. The search path makes the existing unqualified ORM models resolve
# inside the Router schema without changing Marketplace's public tables.
_bootstrap_engine = create_engine(_DATABASE_URL, pool_pre_ping=True)
if _COMPASS_SCHEMA:
    with _bootstrap_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{_COMPASS_SCHEMA}"'))
_bootstrap_engine.dispose()

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
    from . import models  # noqa: F401

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
