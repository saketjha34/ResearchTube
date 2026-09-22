import asyncio
import os
import socket
from logging.config import fileConfig
from urllib.parse import urlparse, urlunparse

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import settings and Base metadata
from app.core.config import settings
from app.db.database import Base
# Ensure all models are registered with Base.metadata
import app.db.models  # noqa: F401
import pgvector.sqlalchemy  # noqa: F401

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_target_url() -> tuple[str, str, dict]:
    """
    Resolve the database URL and connection arguments based on target environment.
    Dual Workmode:
      - 'dev': Local Docker PostgreSQL (default)
      - 'prod': Hosted PostgreSQL (Supabase, Neon, Cloud)

    Selection order:
      1. -x env=prod or -x env=dev command line argument
      2. ENVIRONMENT environment variable from app settings ('dev' or 'prod')
    """
    x_args = context.get_x_argument(as_dictionary=True)
    target_env = x_args.get("env") or getattr(settings, "ENVIRONMENT", "dev")
    target_env = target_env.lower().strip()

    connect_args: dict = {}

    if target_env == "prod":
        raw_url = settings.PROD_DATABASE_URL
        if not raw_url:
            raise ValueError(
                "PROD_DATABASE_URL is not set in environment or .env file for production migrations."
            )
        url = raw_url

        # Ensure asyncpg dialect
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Handle Supabase connection pooler (port 6543 / pooler domain)
        if "pooler.supabase.com" in url or "6543" in url:
            connect_args["statement_cache_size"] = 0

    else:
        # Development mode
        url = settings.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # asyncpg does not accept ?ssl=false (expects ssl=disable or omitting ssl)
        if "?ssl=false" in url:
            url = url.replace("?ssl=false", "")
        elif "&ssl=false" in url:
            url = url.replace("&ssl=false", "")

        # If running on local host machine outside Docker, point 'postgres' host to 'localhost'
        if not os.path.exists("/.dockerenv"):
            try:
                parsed = urlparse(url)
                if parsed.hostname == "postgres":
                    new_netloc = parsed.netloc.replace("@postgres:", "@localhost:")
                    url = urlunparse(parsed._replace(netloc=new_netloc))
            except Exception:
                pass

    return url, target_env, connect_args


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL and not an Engine.
    """
    url, target_env, _ = get_target_url()
    print(f"Running Alembic offline migrations for environment: [{target_env}]")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with asyncpg and NullPool."""
    url, target_env, connect_args = get_target_url()

    # Mask password for secure logging
    try:
        parsed = urlparse(url)
        masked_netloc = f"{parsed.username}:****@{parsed.hostname}:{parsed.port}"
        masked_url = urlunparse(parsed._replace(netloc=masked_netloc))
    except Exception:
        masked_url = url

    print(f"Running Alembic online migrations for environment: [{target_env}]")
    print(f"Target Database URL: {masked_url}")

    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
