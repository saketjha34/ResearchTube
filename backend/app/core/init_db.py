from urllib.parse import urlparse
from sqlalchemy import text

from app.db.database import Base, engine
from app.core.config import settings


async def init_db():

    # Parse and log host for easier debugging
    try:
        parsed = urlparse(settings.runtime_database_url)
        print(f"Initializing database at: {parsed.hostname}:{parsed.port} (user: {parsed.username})")
    except Exception:
        print("Initializing database...")

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