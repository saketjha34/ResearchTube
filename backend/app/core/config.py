from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    # ========================================================
    # API KEYS
    # ========================================================

    GEMINI_API_KEY: str
    YOUTUBE_API_KEY: str
    OPENAI_API_KEY: str | None = None

    # ========================================================
    # DATABASE
    # ========================================================

    ENVIRONMENT: str = "dev"
    DATABASE_URL: str
    PROD_DATABASE_URL: str | None = None

    # ========================================================
    # RAG
    # ========================================================

    EMBEDDING_MODEL: str = "gemini-embedding-001"

    # ========================================================
    # JWT
    # ========================================================

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ========================================================
    # GOOGLE OAUTH
    # ========================================================

    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str

    # Frontend URLs
    FRONTEND_URL_DEV: str = "http://localhost:5173"
    FRONTEND_URL_PROD: str | None = None

    # ========================================================
    # CONFIG
    # ========================================================

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    @property
    def runtime_database_url(self) -> str:
        """Return the correct DB URL based on ENVIRONMENT.

        - "dev"  → DATABASE_URL      (local Docker postgres)
        - "prod" → PROD_DATABASE_URL (Supabase / hosted postgres)
        """
        if self.ENVIRONMENT == "prod":
            if not self.PROD_DATABASE_URL:
                raise ValueError("PROD_DATABASE_URL must be set when ENVIRONMENT=prod")
            url = self.PROD_DATABASE_URL
        else:
            # dev (default)
            url = self.DATABASE_URL

        # Auto-rewrite direct Supabase URL to pooler URL if we detect the known project ref.
        # This serves as a safety fallback in environments like Vercel which lack IPv6.
        from urllib.parse import urlparse, urlunparse
        try:
            parsed = urlparse(url)
            if parsed.hostname == "db.nkinzcrzcnuvqxtncefs.supabase.co":
                password_part = f":{parsed.password}" if parsed.password else ""
                new_netloc = f"postgres.nkinzcrzcnuvqxtncefs{password_part}@aws-0-ap-northeast-1.pooler.supabase.com:6543"
                parsed = parsed._replace(netloc=new_netloc)
                url = urlunparse(parsed)
        except Exception:
            pass

        # Ensure the asyncpg driver prefix is present
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def runtime_frontend_url(self) -> str:
        """Return the correct frontend URL based on ENVIRONMENT."""
        if self.ENVIRONMENT == "prod":
            if not self.FRONTEND_URL_PROD:
                raise ValueError("FRONTEND_URL_PROD must be set when ENVIRONMENT=prod")
            return self.FRONTEND_URL_PROD
        return self.FRONTEND_URL_DEV

settings = Settings()