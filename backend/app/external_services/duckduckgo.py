"""
app.external_services.duckduckgo — Async DuckDuckGo Search Client.

Provides a 100% free, zero-key, open-source search engine fallback
using the `ddgs` library.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List
import structlog

logger = structlog.get_logger("duckduckgo_client")


class DuckDuckGoClient:
    """
    Asynchronous DuckDuckGo search client using `ddgs.DDGS`.
    Runs the synchronous DDGS search in a background thread to prevent blocking
    the FastAPI async event loop.
    """

    def __init__(self, timeout: float = 10.0) -> None:
        self.timeout = timeout

    def _sync_search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        from ddgs import DDGS

        results: List[Dict[str, Any]] = []
        with DDGS(timeout=int(self.timeout)) as ddgs:
            raw_results = list(ddgs.text(query, max_results=limit))

        for item in raw_results:
            if not isinstance(item, dict):
                continue
            url = item.get("href") or ""
            if not url:
                continue

            title = item.get("title") or url
            snippet = item.get("body") or ""

            results.append({
                "title": title.strip(),
                "url": url.strip(),
                "description": snippet.strip(),
                "snippet": snippet.strip(),
                "markdown": snippet.strip(),
            })

        return results

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Execute an asynchronous search query against DuckDuckGo.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        limit = max(1, min(limit, 10))
        logger.info("ddgs.search.start", query=clean_query, limit=limit)

        try:
            results = await asyncio.wait_for(
                asyncio.to_thread(self._sync_search, clean_query, limit),
                timeout=self.timeout + 2.0,
            )
            logger.info("ddgs.search.success", count=len(results))
            return results
        except asyncio.TimeoutError:
            logger.warning("ddgs.search.timeout", query=clean_query)
            return []
        except Exception as exc:
            logger.error("ddgs.search.error", query=clean_query, error=str(exc))
            return []
