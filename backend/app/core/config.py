from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    # ========================================================
    # API KEYS
    # ========================================================

    GEMINI_API_KEY: str
    YOUTUBE_API_KEY: str

    # ========================================================
    # DATABASE
    # ========================================================

    DATABASE_URL: str

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

    # Frontend URL used for OAuth callback redirects
    FRONTEND_URL: str = "http://localhost:5173"

    # ========================================================
    # CONFIG
    # ========================================================

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()