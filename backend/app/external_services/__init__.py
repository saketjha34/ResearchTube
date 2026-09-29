"""
app.external_services — External third-party API clients.
"""

from app.external_services.duckduckgo import DuckDuckGoClient
from app.external_services.e2b_sandbox import (
    E2BSandboxService,
    SandboxExecutionResult,
    e2b_sandbox_service,
)
from app.external_services.firecrawl import FirecrawlClient, FirecrawlError
from app.external_services.html_scraper import HTMLScraper

__all__ = [
    "FirecrawlClient",
    "FirecrawlError",
    "DuckDuckGoClient",
    "HTMLScraper",
    "E2BSandboxService",
    "SandboxExecutionResult",
    "e2b_sandbox_service",
]
