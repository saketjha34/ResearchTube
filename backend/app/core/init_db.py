from app.db.database import engine
from app.db.models import Base
from sqlalchemy import text


def init_db():

    print("Initializing database...")

    # ========================================================
    # ENABLE PGVECTOR
    # ========================================================

    with engine.begin() as connection:

        print("Enabling pgvector extension...")

        connection.execute(
            text(
                "CREATE EXTENSION IF NOT EXISTS vector"
            )
        )

    # ========================================================
    # CREATE TABLES
    # ========================================================

    print("Creating database tables...")

    Base.metadata.create_all(
        bind=engine
    )

    print("Database initialization complete.")