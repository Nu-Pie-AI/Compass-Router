from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(get_settings().database_url, pool_pre_ping=True)
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
    columns = {column["name"] for column in inspect(engine).get_columns("teams")}
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
