from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# ============================================================
# ASYNC DATABASE ENGINE
# ============================================================

connect_args = {}

# Supabase pooler (Supavisor) on port 6543 uses Transaction Mode which does not support prepared statements.
# Disabling the statement cache is necessary to prevent errors.
if "pooler.supabase.com" in settings.runtime_database_url or ":6543" in settings.runtime_database_url:
    connect_args.update({
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    })

engine = create_async_engine(
    settings.runtime_database_url,
    pool_pre_ping=True,
    connect_args=connect_args,
)


# ============================================================
# SESSION
# ============================================================

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ============================================================
# BASE
# ============================================================

class Base(DeclarativeBase):
    pass


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

async def get_db():

    async with AsyncSessionLocal() as session:

        yield session