from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, text

from app.config import get_settings
from app.db import Base, migration_database_url
from app import models  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
settings = get_settings()
migration_engine = create_engine(migration_database_url(settings), pool_pre_ping=True)
is_postgres = migration_engine.dialect.name == "postgresql"


def run_migrations_offline() -> None:
    context.configure(
        url=str(migration_database_url(settings)),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=is_postgres,
        version_table_schema="compass" if is_postgres else None,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with migration_engine.connect() as connection:
        if is_postgres:
            connection.execute(text('CREATE SCHEMA IF NOT EXISTS "compass"'))
            connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=is_postgres,
            version_table_schema="compass" if is_postgres else None,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    migration_engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
