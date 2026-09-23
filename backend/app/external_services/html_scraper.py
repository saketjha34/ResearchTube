"""
app.external_services.html_scraper — Resilient Zero-API-Key Async HTML Scraper.

Provides a fast, fallback web scraper using httpx and lxml.html.
Extracts clean, readable text and tabular data from websites without
requiring any external paid API or tokens.
"""

from __future__ import annotations

import re
from typing import Dict, Optional
from urllib.parse import urlparse
import httpx
import lxml.html
import structlog

logger = structlog.get_logger("html_scraper")

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

# Elements that contain boilerplate / navigation / non-informational content
_TAGS_TO_DROP = [
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
]


class HTMLScraper:
    """
    Asynchronous web page scraper that downloads HTML and converts it into
    clean, readable plain text / tables for LLM reasoning.
    """

    def __init__(self, timeout: float = 7.0) -> None:
        self.timeout = timeout

    async def scrape(self, url: str, max_chars: int = 3500) -> Optional[str]:
        """
        Fetch a URL and extract its core informative content.

        Args:
            url: The HTTP/HTTPS URL to scrape.
            max_chars: Maximum characters to return to avoid token bloat.

        Returns:
            Clean text/tables extracted from the webpage, or None if failed.
        """
        clean_url = (url or "").strip()
        if not clean_url.startswith("http"):
            return None

        domain = urlparse(clean_url).netloc.replace("www.", "")
        logger.info("html_scraper.fetch.start", url=clean_url, domain=domain)

        try:
            async with httpx.AsyncClient(
                headers=_DEFAULT_HEADERS,
                follow_redirects=True,
                timeout=self.timeout,
                verify=True,
            ) as client:
                response = await client.get(clean_url)

            if response.status_code >= 400:
                logger.warning(
                    "html_scraper.http_error",
                    url=clean_url,
                    status_code=response.status_code,
                )
                return None

            html_text = response.text
            if not html_text or len(html_text.strip()) < 50:
                return None

            # Parse with lxml
            doc = lxml.html.fromstring(html_text)

            # 1. Remove unwanted tags
            for tag in _TAGS_TO_DROP:
                for el in doc.xpath(f"//{tag}"):
                    try:
                        el.drop_tree()
                    except Exception:
                        pass

            # 2. Extract content from main body or articles if available
            main_nodes = doc.xpath("//main | //article | //div[@role='main'] | //div[contains(@class, 'content')]")
            if main_nodes:
                raw_text = "\n".join(node.text_content() for node in main_nodes[:2])
            else:
                raw_text = doc.text_content()

            # 3. Clean up whitespace and empty lines
            lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
            cleaned_text = "\n".join(lines)
            cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text)
            cleaned_text = re.sub(r"[ \t]{2,}", " ", cleaned_text)

            # Cap length cleanly at a word boundary
            if len(cleaned_text) > max_chars:
                truncated = cleaned_text[:max_chars]
                last_nl = truncated.rfind("\n")
                if last_nl > max_chars // 2:
                    truncated = truncated[:last_nl]
                cleaned_text = truncated.strip() + "\n..."

            logger.info(
                "html_scraper.fetch.success",
                url=clean_url,
                chars_extracted=len(cleaned_text),
            )
            return cleaned_text

        except httpx.TimeoutException:
            logger.warning("html_scraper.timeout", url=clean_url, timeout=self.timeout)
            return None
        except Exception as exc:
            logger.warning("html_scraper.failed", url=clean_url, error=str(exc))
            return None
