from sqlalchemy import text

from app.db.database import Base, engine


async def init_db():

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