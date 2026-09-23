"""
app.external_services.firecrawl — Async Firecrawl API Client.

Provides an asynchronous HTTP wrapper for the Firecrawl REST API v1
to perform web searches and markdown page scraping.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger("firecrawl_client")


class FirecrawlError(Exception):
    """Raised when Firecrawl API request fails or returns an error."""

    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Any] = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.details = details


class FirecrawlClient:
    """
    Asynchronous client for the Firecrawl REST API (v1).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 12.0,
    ) -> None:
        self.api_key = api_key or settings.FIRECRAWL_API_KEY
        self.base_url = (base_url or settings.FIRECRAWL_BASE_URL).rstrip("/")
        self.timeout = timeout

    @property
    def is_configured(self) -> bool:
        """Check if an API key is available."""
        return bool(self.api_key and self.api_key.strip())

    async def search(
        self,
        query: str,
        limit: int = 5,
        scrape_results: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Execute a search query via Firecrawl Search API.

        Args:
            query: The search query string.
            limit: Maximum number of search results (1-10).
            scrape_results: Whether to also scrape page content as markdown.

        Returns:
            List of search result dictionaries containing:
            - title: str
            - url: str
            - description: str
            - markdown: str (optional/truncated)
        """
        if not self.is_configured:
            raise FirecrawlError("FIRECRAWL_API_KEY is not configured.", status_code=401)

        clean_query = query.strip()
        if not clean_query:
            return []

        limit = max(1, min(limit, 10))
        url = f"{self.base_url}/search"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload: Dict[str, Any] = {
            "query": clean_query,
            "limit": limit,
        }
        if scrape_results:
            payload["scrapeOptions"] = {"formats": ["markdown"]}

        logger.info("firecrawl.search.start", query=clean_query, limit=limit)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=headers)

            if response.status_code == 401:
                logger.error("firecrawl.search.unauthorized")
                raise FirecrawlError("Invalid Firecrawl API Key (401 Unauthorized)", status_code=401)

            if response.status_code == 429:
                logger.warning("firecrawl.search.rate_limited")
                raise FirecrawlError("Firecrawl API rate limit exceeded (429)", status_code=429)

            if response.status_code >= 400:
                logger.error(
                    "firecrawl.search.http_error",
                    status_code=response.status_code,
                    body=response.text[:200],
                )
                raise FirecrawlError(
                    f"Firecrawl search failed with HTTP {response.status_code}: {response.text[:150]}",
                    status_code=response.status_code,
                )

            data = response.json()
            raw_items = data.get("data", []) if isinstance(data, dict) else []

            results: List[Dict[str, Any]] = []
            for item in raw_items:
                if not isinstance(item, dict):
                    continue

                item_url = item.get("url") or item.get("sourceURL") or ""
                if not item_url:
                    continue

                title = item.get("title") or item.get("metadata", {}).get("title") or item_url
                desc = (
                    item.get("description")
                    or item.get("metadata", {}).get("description")
                    or ""
                )
                markdown = item.get("markdown") or ""
                # Cap markdown if present to avoid overloading prompt tokens
                if len(markdown) > 1500:
                    markdown = markdown[:1500] + "..."

                results.append({
                    "title": title.strip(),
                    "url": item_url.strip(),
                    "description": desc.strip(),
                    "markdown": markdown.strip(),
                })

            logger.info("firecrawl.search.success", count=len(results))
            return results

        except httpx.TimeoutException as exc:
            logger.warning("firecrawl.search.timeout", error=str(exc))
            raise FirecrawlError(f"Firecrawl search timed out after {self.timeout}s", status_code=408) from exc
        except httpx.RequestError as exc:
            logger.error("firecrawl.search.network_error", error=str(exc))
            raise FirecrawlError(f"Firecrawl network error: {str(exc)}") from exc
        except FirecrawlError:
            raise
        except Exception as exc:
            logger.error("firecrawl.search.unexpected_error", error=str(exc))
            raise FirecrawlError(f"Unexpected error during Firecrawl search: {str(exc)}") from exc

    async def scrape(self, url: str) -> Dict[str, Any]:
        """
        Scrape a single URL using Firecrawl Scrape API.
        """
        if not self.is_configured:
            raise FirecrawlError("FIRECRAWL_API_KEY is not configured.", status_code=401)

        clean_url = url.strip()
        endpoint = f"{self.base_url}/scrape"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {"url": clean_url, "formats": ["markdown"]}

        logger.info("firecrawl.scrape.start", url=clean_url)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(endpoint, json=payload, headers=headers)

            if response.status_code >= 400:
                raise FirecrawlError(
                    f"Firecrawl scrape failed with HTTP {response.status_code}",
                    status_code=response.status_code,
                )

            data = response.json()
            content_data = data.get("data", {}) if isinstance(data, dict) else {}
            return {
                "url": clean_url,
                "markdown": content_data.get("markdown", ""),
                "metadata": content_data.get("metadata", {}),
            }

        except Exception as exc:
            logger.error("firecrawl.scrape.failed", url=clean_url, error=str(exc))
            raise FirecrawlError(f"Failed to scrape {clean_url}: {str(exc)}") from exc

    async def scrape_page(self, url: str, max_chars: int = 3500) -> Optional[str]:
        """
        Scrape a single page and return cleaned, readable markdown content.
        Safely catches errors and returns None on failure.
        """
        try:
            res = await self.scrape(url)
            raw_md = res.get("markdown") or ""
            if not raw_md or len(raw_md.strip()) < 50:
                return None

            import re
            # Clean markdown images, excessive escapes
            cleaned = re.sub(r"!\[.*?\]\(.*?\)", "", raw_md)
            cleaned = cleaned.replace("\\n", "\n").replace("\\r", "\n").replace("\\", "")
            cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

            if len(cleaned) > max_chars:
                truncated = cleaned[:max_chars]
                last_nl = truncated.rfind("\n")
                if last_nl > max_chars // 2:
                    truncated = truncated[:last_nl]
                cleaned = truncated.strip() + "\n..."

            return cleaned
        except Exception as exc:
            logger.warning("firecrawl.scrape_page.error", url=url, error=str(exc))
            return None

