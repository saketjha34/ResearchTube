from urllib.parse import urlparse, urlunparse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.database import Base, engine
from app.core.config import settings


async def ensure_database_exists():
    """Ensure the target database exists; if missing, connect to 'postgres' and create it."""
    try:
        db_url = settings.runtime_database_url
        parsed = urlparse(db_url)
        db_name = parsed.path.lstrip("/")
        if not db_name or db_name == "postgres":
            return

        postgres_url = urlunparse(parsed._replace(path="/postgres"))
        temp_engine = create_async_engine(postgres_url, isolation_level="AUTOCOMMIT")
        async with temp_engine.connect() as conn:
            result = await conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                {"dbname": db_name}
            )
            if not result.scalar():
                print(f"Database '{db_name}' does not exist. Creating database...")
                await conn.execute(text(f'CREATE DATABASE "{db_name}"'))
                print(f"Database '{db_name}' created successfully.")
        await temp_engine.dispose()
    except Exception as e:
        print(f"Database pre-flight check note: {e}")


async def init_db():

    # Parse and log host for easier debugging
    try:
        parsed = urlparse(settings.runtime_database_url)
        print(f"Initializing database at: {parsed.hostname}:{parsed.port} (user: {parsed.username})")
    except Exception:
        print("Initializing database...")

    # Ensure database exists before attempting schema/extension creation
    await ensure_database_exists()

    # ========================================================
    # ENABLE PGVECTOR
    # ========================================================

    async with engine.begin() as connection:

        print("Enabling pgvector extension...")

        await connection.execute(
            text(
                "CREATE EXTENSION IF NOT EXISTS vector"
            )
        )

    # ========================================================
    # CREATE TABLES
    # ========================================================

    print("Creating database tables...")

    async with engine.begin() as connection:

        await connection.run_sync(
            Base.metadata.create_all
        )

    print("Database initialization complete.")