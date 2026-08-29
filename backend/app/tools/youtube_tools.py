"""
YouTube tools used by the YouTube Research Agents.

Tools:
    1. search_youtube()
    2. get_video_details()
    3. get_video_transcript()

These tools are intentionally kept independent from the agents.
Agents will call these tools when they need YouTube information.

PROXY SUPPORT (for cloud deployments where YouTube blocks GCP IPs):
    Set YOUTUBE_PROXY_URL in your environment to route transcript
    requests through a residential proxy.

    Examples:
        YOUTUBE_PROXY_URL=http://user:pass@proxy.example.com:8080
        YOUTUBE_PROXY_URL=socks5://user:pass@proxy.example.com:1080

    Webshare (free tier): https://proxy.webshare.io/
    Set WEBSHARE_PROXY_USERNAME + WEBSHARE_PROXY_PASSWORD instead
    to use the Webshare-specific config.
"""

import os

# pyrefly: ignore [missing-import]
import structlog

from googleapiclient.discovery import build
from langchain_core.tools import tool
# pyrefly: ignore [missing-import]
from youtube_transcript_api import YouTubeTranscriptApi

from app.core.config import settings


logger = structlog.get_logger("youtube_tools")


# ============================================================
# YOUTUBE CLIENT (YouTube Data API v3)
# ============================================================

youtube = build(
    "youtube",
    "v3",
    developerKey=settings.YOUTUBE_API_KEY,
)


# ============================================================
# PROXY-AWARE TRANSCRIPT API FACTORY
# ============================================================

def _build_transcript_api() -> YouTubeTranscriptApi:
    """
    Build a YouTubeTranscriptApi instance, optionally configured
    with a proxy to work around GCP/cloud IP blocks.

    Priority:
        1. Webshare proxy  (WEBSHARE_PROXY_USERNAME + WEBSHARE_PROXY_PASSWORD)
        2. Generic proxy   (YOUTUBE_PROXY_URL)
        3. No proxy        (works fine on local / non-cloud IPs)
    """

    # ----------------------------------------------------------
    # Option 1: Webshare residential proxy (recommended for prod)
    # ----------------------------------------------------------
    webshare_user = os.getenv("WEBSHARE_PROXY_USERNAME", "").strip()
    webshare_pass = os.getenv("WEBSHARE_PROXY_PASSWORD", "").strip()

    if webshare_user and webshare_pass:
        try:
            from youtube_transcript_api.proxies import WebshareProxyConfig
            logger.info("transcript.proxy_mode", mode="webshare")
            return YouTubeTranscriptApi(
                proxy_config=WebshareProxyConfig(
                    proxy_username=webshare_user,
                    proxy_password=webshare_pass,
                )
            )
        except ImportError:
            logger.warning("transcript.proxy_mode", mode="webshare", status="unavailable_falling_back")

    # ----------------------------------------------------------
    # Option 2: Generic proxy URL  (any provider, e.g. ScraperAPI)
    # e.g. YOUTUBE_PROXY_URL=http://user:pass@31.59.20.176:6754
    # ----------------------------------------------------------
    proxy_url = os.getenv("YOUTUBE_PROXY_URL", "").strip()

    if proxy_url:
        safe_url = proxy_url.split("@")[-1]  # hide credentials in logs
        logger.info("transcript.proxy_mode", mode="custom_session", host=safe_url)
        
        import requests
        import urllib3
        # Suppress urllib3 InsecureRequestWarning for verify=False
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        # Build requests Session with proxy and verify=False to prevent SSL certificate validation issues
        session = requests.Session()
        session.proxies = {
            "http": proxy_url,
            "https": proxy_url,
        }
        session.verify = False
        
        return YouTubeTranscriptApi(http_client=session)

    # ----------------------------------------------------------
    # Option 3: No proxy (default — works on local/residential IPs)
    # ----------------------------------------------------------
    logger.info("transcript.proxy_mode", mode="none")
    return YouTubeTranscriptApi()


# ============================================================
# TOOL 1: SEARCH YOUTUBE
# ============================================================

@tool
def search_youtube(
    query: str,
    max_results: int = 10,
) -> list[dict]:
    """
    Search YouTube for videos related to a research query.

    Args:
        query:
            Natural-language search query.

        max_results:
            Maximum number of videos to return.

    Returns:
        List of YouTube video metadata.
    """

    if not query or not query.strip():
        raise ValueError("YouTube search query cannot be empty.")

    max_results = max(1, min(max_results, 50))

    response = youtube.search().list(
        q=query.strip(),
        part="snippet",
        type="video",
        maxResults=max_results,
    ).execute()

    results = []

    for item in response.get("items", []):

        video_id = (
            item
            .get("id", {})
            .get("videoId")
        )

        snippet = item.get("snippet", {})

        if not video_id:
            continue

        results.append({
            "video_id": video_id,
            "title": snippet.get("title"),
            "description": snippet.get("description"),
            "channel": snippet.get("channelTitle"),
            "published_at": snippet.get("publishedAt"),
            "url": f"https://www.youtube.com/watch?v={video_id}",
        })

    return results


# ============================================================
# TOOL 2: GET VIDEO DETAILS
# ============================================================

@tool
def get_video_details(
    video_id: str,
) -> dict:
    """
    Get detailed metadata and statistics for a YouTube video.

    Args:
        video_id:
            YouTube video ID.

    Returns:
        Video metadata and statistics.
    """

    if not video_id or not video_id.strip():
        raise ValueError("video_id cannot be empty.")

    video_id = video_id.strip()

    response = youtube.videos().list(
        part="snippet,statistics",
        id=video_id,
    ).execute()

    items = response.get("items", [])

    if not items:
        return {
            "success": False,
            "error": "Video not found",
            "video_id": video_id,
        }

    video = items[0]
    snippet = video.get("snippet", {})
    statistics = video.get("statistics", {})

    return {
        "success": True,
        "video_id": video_id,
        "title": snippet.get("title"),
        "description": snippet.get("description"),
        "channel": snippet.get("channelTitle"),
        "published_at": snippet.get("publishedAt"),
        "views": statistics.get("viewCount"),
        "likes": statistics.get("likeCount"),
        "comments": statistics.get("commentCount"),
        "url": f"https://www.youtube.com/watch?v={video_id}",
    }


# ============================================================
# INTERNAL: FETCH TRANSCRIPT WITH 3-LAYER FALLBACK
# ============================================================

def _fetch_transcript_with_fallback(
    video_id: str,
) -> tuple[str | None, str | None]:
    """
    Attempt to fetch a transcript with 3 progressive fallbacks
    using only api.fetch() (compatible with youtube-transcript-api v1.x).

    A proxy-aware API instance is built each call so that env var
    changes at runtime are picked up (e.g. for testing).

        Layer 1 — English (manual or auto-generated)
        Layer 2 — Common language variants (en-US, en-GB, en-IN, hi, es, etc.)
        Layer 3 — No language filter: accepts whatever YouTube has available

    Returns:
        (transcript_text, language_label) or (None, None) on failure.
    """

    api = _build_transcript_api()

    log = logger.bind(video_id=video_id)

    # --------------------------------------------------------
    # Layer 1: English (covers both manual and auto-generated)
    # --------------------------------------------------------
    try:
        fetched = api.fetch(video_id, languages=["en"])
        text = "\n".join(s.text for s in fetched)
        if text.strip():
            log.info("transcript.layer_ok", layer=1, language="en")
            return text, "en"
    except Exception as e:
        log.warning("transcript.layer_failed", layer=1, exc=str(e))

    # --------------------------------------------------------
    # Layer 2: Common language variants (broad net)
    # --------------------------------------------------------
    other_languages = ["en-US", "en-GB", "en-IN", "en-AU", "hi", "es", "fr", "de", "pt"]
    try:
        fetched = api.fetch(video_id, languages=other_languages)
        text = "\n".join(s.text for s in fetched)
        if text.strip():
            log.info("transcript.layer_ok", layer=2, language="variant")
            return text, "variant"
    except Exception as e:
        log.warning("transcript.layer_failed", layer=2, exc=str(e))

    # --------------------------------------------------------
    # Layer 3: No language filter — take whatever is available
    # --------------------------------------------------------
    try:
        fetched = api.fetch(video_id)
        text = "\n".join(s.text for s in fetched)
        if text.strip():
            log.info("transcript.layer_ok", layer=3, language="any")
            return text, "any"
    except Exception as e:
        log.warning("transcript.layer_failed", layer=3, exc=str(e))

    log.error("transcript.exhausted", layers_tried=3)
    return None, None


# ============================================================
# TOOL 3: GET VIDEO TRANSCRIPT
# ============================================================

@tool
def get_video_transcript(
    video_id: str,
    max_chars: int = 15000,
) -> str:
    """
    Fetch a YouTube transcript using a 3-layer fallback strategy:
        1. Manual English transcript
        2. Auto-generated English captions / language variants
        3. Any available language

    Proxy support: Set WEBSHARE_PROXY_USERNAME + WEBSHARE_PROXY_PASSWORD
    or YOUTUBE_PROXY_URL in the environment to bypass cloud IP blocks.

    The transcript is truncated to max_chars to prevent
    sending extremely large context to an LLM.

    Args:
        video_id:
            YouTube video ID.

        max_chars:
            Maximum number of characters returned.

    Returns:
        Transcript text, or an unavailability message.
    """

    if not video_id or not video_id.strip():
        return "Transcript unavailable: video_id cannot be empty."

    video_id = video_id.strip()
    max_chars = max(100, max_chars)

    text, language_used = _fetch_transcript_with_fallback(video_id)

    if not text or not text.strip():
        return (
            "Transcript unavailable: "
            "no transcript found for this video "
            "(manual, auto-generated, or translated)."
        )

    if len(text) > max_chars:
        text = text[:max_chars] + "\n\n[TRANSCRIPT TRUNCATED]"

    return f"[Language: {language_used}]\n\n{text}"