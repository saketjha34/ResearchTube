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

engine = create_async_engine(
    settings.runtime_database_url,
    pool_pre_ping=True,
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