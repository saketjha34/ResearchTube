"""
app.tools.web_search — Resilient Web Search Tool with Firecrawl & DuckDuckGo Fallback.

Provides live internet search capabilities for ResearchTube LLMs.
Uses Firecrawl as the primary engine with automatic zero-key DuckDuckGo fallback.
"""

from __future__ import annotations
from typing import Optional

import asyncio
import re
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse
import structlog
from langchain_core.tools import tool
from pydantic import BaseModel, Field

from app.core.config import settings
from app.external_services.duckduckgo import DuckDuckGoClient
from app.external_services.firecrawl import FirecrawlClient, FirecrawlError
from app.external_services.html_scraper import HTMLScraper

logger = structlog.get_logger("web_search_tool")


def clean_snippet_text(raw_text: str, max_chars: int = 240, fallback_url: str = "") -> str:
    """
    Clean raw markdown, links, images, backslashes, escape sequences, and excess whitespace
    from a search snippet to make it clean, legible, and professional.
    """
    if not raw_text:
        if fallback_url:
            try:
                domain = urlparse(fallback_url).netloc.replace("www.", "")
                if domain:
                    return f"Verified search result from {domain}"
            except Exception:
                pass
        return "Verified live web search result."

    text = str(raw_text).strip()
    # 1. Remove markdown images: ![alt](url)
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    # 2. Convert markdown links [anchor](url) -> anchor
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    # 3. Remove raw backslashes and escaped sequences like \\\n or \n
    text = text.replace("\\n", " ").replace("\\r", " ").replace("\\", "")
    # 4. Remove markdown headers (#), bold/italic (*, _), strikethroughs (~), backticks
    text = re.sub(r"#{1,6}\s*", "", text)
    text = re.sub(r"[*_~`]", "", text)
    # 5. Remove HTML tags if any
    text = re.sub(r"<[^>]+>", "", text)
    # 6. Normalize all whitespace / newlines to single space
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        if fallback_url:
            try:
                domain = urlparse(fallback_url).netloc.replace("www.", "")
                if domain:
                    return f"Verified search result from {domain}"
            except Exception:
                pass
        return "Verified live web search result."

    if len(text) > max_chars:
        truncated = text[:max_chars]
        last_space = truncated.rfind(" ")
        if last_space > max_chars // 2:
            truncated = truncated[:last_space]
        return truncated.strip() + "…"
    return text


class WebSearchInput(BaseModel):
    """Input parameters for the live web search tool."""

    query: str = Field(
        ...,
        description="The specific search query to look up on the live web. Keep it focused and descriptive.",
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Maximum number of search results to retrieve (1 to 10, default 5).",
    )


# Singleton clients
_firecrawl_client: FirecrawlClient | None = None
_ddgs_client: DuckDuckGoClient | None = None
_html_scraper: HTMLScraper | None = None


def get_firecrawl_client() -> FirecrawlClient:
    global _firecrawl_client
    if _firecrawl_client is None:
        _firecrawl_client = FirecrawlClient()
    return _firecrawl_client


def get_duckduckgo_client() -> DuckDuckGoClient:
    global _ddgs_client
    if _ddgs_client is None:
        _ddgs_client = DuckDuckGoClient()
    return _ddgs_client


def get_html_scraper() -> HTMLScraper:
    global _html_scraper
    if _html_scraper is None:
        _html_scraper = HTMLScraper()
    return _html_scraper


async def scrape_single_url(
    url: str,
    title: str,
    firecrawl: FirecrawlClient,
    html_scraper: HTMLScraper,
) -> Dict[str, Any]:
    """
    Scrape a single URL with dual-tier fallback:
    1. Primary: Firecrawl Scrape API
    2. Secondary: Native async HTMLScraper (httpx + lxml.html, zero API keys)
    """
    content: Optional[str] = None
    engine_used = "firecrawl"

    if firecrawl.is_configured:
        try:
            content = await firecrawl.scrape_page(url, max_chars=3500)
            if content:
                logger.info("web_search.scrape_firecrawl_success", url=url, chars=len(content))
        except Exception as exc:
            logger.warning("web_search.scrape_firecrawl_failed", url=url, error=str(exc))
            content = None

    if not content:
        engine_used = "html_scraper"
        try:
            content = await html_scraper.scrape(url, max_chars=3500)
            if content:
                logger.info("web_search.scrape_html_fallback_success", url=url, chars=len(content))
        except Exception as exc:
            logger.warning("web_search.scrape_html_fallback_failed", url=url, error=str(exc))
            content = None

    return {
        "url": url,
        "title": title,
        "content": content,
        "engine": engine_used if content else "none",
    }


async def scrape_top_sources(
    sources: List[Dict[str, Any]],
    max_pages: int = 3,
) -> List[Dict[str, Any]]:
    """
    Concurrently scrape the top N search results to obtain live page text/tables.
    """
    if not sources:
        return []

    firecrawl = get_firecrawl_client()
    html_scraper = get_html_scraper()

    target_sources = [s for s in sources if (s.get("url") or "").startswith("http")][:max_pages]
    if not target_sources:
        return []

    tasks = [
        scrape_single_url(
            url=s["url"],
            title=s.get("title") or "Web Page",
            firecrawl=firecrawl,
            html_scraper=html_scraper,
        )
        for s in target_sources
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    scraped_data: List[Dict[str, Any]] = []
    for r in results:
        if isinstance(r, dict) and r.get("content"):
            scraped_data.append(r)

    logger.info("web_search.scraping_completed", attempted=len(target_sources), succeeded=len(scraped_data))
    return scraped_data


async def search_web_sources(
    query: str,
    limit: int = 5,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Search the web with multi-tier fallback (Firecrawl -> DuckDuckGo).
    Returns (clean_sources_list, engine_used).
    """
    clean_query = query.strip()
    if not clean_query:
        return ([], "none")

    firecrawl = get_firecrawl_client()
    ddgs = get_duckduckgo_client()
    raw_results: List[Dict[str, Any]] = []
    engine_used = "firecrawl"

    # ── Tier 1: Try Firecrawl Primary ──────────────────────
    if firecrawl.is_configured:
        try:
            raw_results = await firecrawl.search(clean_query, limit=limit)
            logger.info("web_search.firecrawl_success", count=len(raw_results))
        except FirecrawlError as fc_err:
            logger.warning(
                "web_search.firecrawl_failed_falling_back_to_ddgs",
                error=str(fc_err),
                status_code=fc_err.status_code,
            )
            raw_results = []
        except Exception as exc:
            logger.warning("web_search.firecrawl_unexpected_error", error=str(exc))
            raw_results = []
    else:
        logger.info("web_search.firecrawl_not_configured_using_ddgs")

    # ── Tier 2: Open-Source Fallback (DuckDuckGo) ──────────
    if not raw_results:
        engine_used = "duckduckgo"
        try:
            raw_results = await ddgs.search(clean_query, limit=limit)
            logger.info("web_search.ddgs_fallback_success", count=len(raw_results))
        except Exception as exc:
            logger.error("web_search.ddgs_fallback_failed", error=str(exc))
            raw_results = []

    clean_sources: List[Dict[str, Any]] = []
    for idx, item in enumerate(raw_results, 1):
        url = item.get("url") or ""
        raw_title = (item.get("title") or "").strip()
        if not raw_title or raw_title.startswith("http"):
            try:
                domain = urlparse(url).netloc.replace("www.", "")
                raw_title = domain.capitalize() if domain else "Web Source"
            except Exception:
                raw_title = "Web Source"

        raw_snippet = item.get("description") or item.get("snippet") or item.get("markdown") or ""
        cleaned_snippet = clean_snippet_text(raw_snippet, max_chars=240, fallback_url=url)

        clean_sources.append({
            "index": idx,
            "title": raw_title,
            "url": url,
            "snippet": cleaned_snippet,
            "source_type": "web",
            "engine": engine_used,
        })

    return (clean_sources, engine_used)


def format_web_search_prompt(
    query: str,
    clean_sources: List[Dict[str, Any]],
    scraped_pages: List[Dict[str, Any]],
) -> str:
    """
    Format search citations and scraped page content for the LLM prompt.
    Does not mention internal tool or engine brand names.
    """
    formatted_blocks: List[str] = [
        f'### Live Web Search Results for: "{query.strip()}"\n'
    ]

    for idx, s in enumerate(clean_sources, 1):
        formatted_blocks.append(
            f"{idx}. **[{s['title']}]({s['url']})**\n"
            f"   *Snippet*: {s['snippet']}\n"
        )

    if scraped_pages:
        formatted_blocks.append("\n### Verified Live Scraped Page Data (High-Priority Real-Time Content):\n")
        formatted_blocks.append(
            "> [!IMPORTANT]\n"
            "> The following text was scraped directly from the live web pages right now. "
            "You MUST prioritize these exact live numbers, stock quotes, trading volume, prices, and tables "
            "over any brief or older search snippets. Ensure your answer accurately matches these live values.\n"
        )
        for p_idx, page in enumerate(scraped_pages, 1):
            formatted_blocks.append(
                f"#### Scraped Source [{p_idx}]: {page['title']} ({page['url']})\n"
                f"```text\n{page['content']}\n```\n"
            )

    return "\n".join(formatted_blocks)


async def execute_web_search(
    query: str,
    limit: int = 5,
) -> Tuple[str, List[Dict[str, Any]], str]:
    """
    Execute web search with multi-tier fallback and page scraping.
    Returns:
        Tuple of (formatted_markdown, raw_sources_list, engine_used)
    """
    clean_query = query.strip()
    if not clean_query:
        return ("No query provided for web search.", [], "none")

    clean_sources, engine_used = await search_web_sources(clean_query, limit=limit)
    if not clean_sources:
        fallback_msg = (
            f"Web search for '{clean_query}' could not retrieve live results due to a temporary "
            "network or service issue. Please answer the user's question directly using your existing "
            "knowledge, and clearly mention that live web search was momentarily unavailable."
        )
        return (fallback_msg, [], "failed")

    scraped_pages = await scrape_top_sources(clean_sources, max_pages=3)
    formatted_text = format_web_search_prompt(clean_query, clean_sources, scraped_pages)
    return (formatted_text, clean_sources, engine_used)


@tool(args_schema=WebSearchInput)
async def firecrawl_web_search(query: str, limit: int = 5) -> str:
    """
    Search the live web using Firecrawl (with automatic DuckDuckGo fallback)
    for current facts, recent news, technical documentation, or questions not covered
    in the YouTube video transcripts.
    """
    formatted_markdown, _, _ = await execute_web_search(query=query, limit=limit)
    return formatted_markdown
