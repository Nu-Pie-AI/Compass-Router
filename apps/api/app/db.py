from collections.abc import Generator

from sqlalchemy import MetaData, create_engine, event, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


_COMPASS_SCHEMA = "compass"


class Base(DeclarativeBase):
    metadata = MetaData(schema=_COMPASS_SCHEMA)




def _database_url():
    url = make_url(get_settings().database_url)
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
with _bootstrap_engine.begin() as connection:
    connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{_COMPASS_SCHEMA}"'))
_bootstrap_engine.dispose()

engine = create_engine(
    _DATABASE_URL,
    pool_pre_ping=True,
)


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
