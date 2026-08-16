from pydantic_settings import BaseSettings, SettingsConfigDict
import socket
from urllib.parse import urlsplit, urlunsplit


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

    @property
    def runtime_database_url(self) -> str:
        """Return a DB URL that works in both Docker and local runs.

        If DATABASE_URL uses the Docker service hostname "postgres"
        but DNS resolution fails (typical on host machine), fallback
        to localhost while preserving credentials, driver, DB name,
        query params, and port.
        """

        parsed = urlsplit(self.DATABASE_URL)

        if parsed.hostname != "postgres":
            return self.DATABASE_URL

        port = parsed.port or 5432

        try:
            socket.getaddrinfo("postgres", port)
            return self.DATABASE_URL
        except socket.gaierror:
            pass

        username = parsed.username or ""
        password = parsed.password or ""

        auth = ""
        if username:
            auth = username
            if password:
                auth += f":{password}"
            auth += "@"

        netloc = f"{auth}localhost:{port}"

        return urlunsplit(
            (
                parsed.scheme,
                netloc,
                parsed.path,
                parsed.query,
                parsed.fragment,
            )
        )


settings = Settings()