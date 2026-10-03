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

import json
import os
import threading
from typing import Optional
import urllib.request

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

# googleapiclient Resource objects are NOT thread-safe; synchronize multi-threaded access.
_youtube_api_lock = threading.Lock()


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
# OEMBED FALLBACK (Public, no API key required)
# ============================================================

def fetch_oembed_details(video_id: str) -> dict:
    """
    Fetch basic video title, channel, and thumbnail from YouTube's public oEmbed endpoint.
    Requires no API key, works when YouTube Data API quota is exceeded or rate-limited.
    """
    if not video_id or not video_id.strip():
        return {"success": False, "video_id": video_id, "error": "Empty video_id"}

    video_id = video_id.strip()
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {
                "success": True,
                "video_id": video_id,
                "title": data.get("title"),
                "channel": data.get("author_name"),
                "thumbnail_url": data.get("thumbnail_url"),
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "description": None,
                "published_at": None,
                "views": None,
                "likes": None,
                "comments": None,
            }
    except Exception as exc:
        logger.warning("oembed.failed", video_id=video_id, exc=str(exc))
        return {
            "success": False,
            "video_id": video_id,
            "error": str(exc),
        }


# ============================================================
# TOOL 2: GET VIDEO DETAILS (Resilient with oEmbed fallback)
# ============================================================

@tool
def get_video_details(
    video_id: str,
) -> dict:
    """
    Get detailed metadata and statistics for a YouTube video.
    Safely falls back to YouTube oEmbed if Data API fails or quota is exhausted.

    Args:
        video_id:
            YouTube video ID.

    Returns:
        Video metadata and statistics.
    """

    if not video_id or not video_id.strip():
        raise ValueError("video_id cannot be empty.")

    video_id = video_id.strip()

    try:
        with _youtube_api_lock:
            response = youtube.videos().list(
                part="snippet,statistics",
                id=video_id,
            ).execute()

        items = response.get("items", [])

        if items:
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
    except Exception as exc:
        logger.warning("youtube_api.details_failed_using_oembed", video_id=video_id, exc=str(exc))

    # Fallback to public oEmbed
    oembed = fetch_oembed_details(video_id)
    if oembed.get("success"):
        return oembed

    return {
        "success": False,
        "error": "Video not found",
        "video_id": video_id,
    }


def get_batch_video_details(video_ids: list[str]) -> dict[str, dict]:
    """
    Batch retrieve video details for multiple video IDs in 50-item chunks.
    Falls back to oEmbed for any video that fails or is missing from YouTube Data API.
    """
    if not video_ids:
        return {}

    unique_ids: list[str] = []
    seen: set[str] = set()
    for vid in video_ids:
        vid_s = vid.strip() if vid else ""
        if vid_s and vid_s not in seen:
            seen.add(vid_s)
            unique_ids.append(vid_s)

    results: dict[str, dict] = {}

    # Process in chunks of 50 (YouTube Data API limit)
    chunk_size = 50
    for i in range(0, len(unique_ids), chunk_size):
        chunk = unique_ids[i:i + chunk_size]
        try:
            with _youtube_api_lock:
                response = youtube.videos().list(
                    part="snippet,statistics",
                    id=",".join(chunk),
                ).execute()

            for item in response.get("items", []):
                vid = item.get("id")
                snippet = item.get("snippet", {})
                statistics = item.get("statistics", {})
                if vid:
                    results[vid] = {
                        "success": True,
                        "video_id": vid,
                        "title": snippet.get("title"),
                        "description": snippet.get("description"),
                        "channel": snippet.get("channelTitle"),
                        "published_at": snippet.get("publishedAt"),
                        "views": statistics.get("viewCount"),
                        "likes": statistics.get("likeCount"),
                        "comments": statistics.get("commentCount"),
                        "url": f"https://www.youtube.com/watch?v={vid}",
                    }
        except Exception as exc:
            logger.warning("youtube_api.batch_failed", chunk_size=len(chunk), exc=str(exc))

    # For any video IDs not resolved by Data API, fall back to oEmbed
    for vid in unique_ids:
        if vid not in results or not results[vid].get("title"):
            oembed = fetch_oembed_details(vid)
            if oembed.get("success"):
                results[vid] = oembed

    return results


# ============================================================
# INTERNAL: FETCH TRANSCRIPT WITH 3-LAYER FALLBACK
# ============================================================

def _fetch_transcript_with_fallback(
    video_id: str,
) -> tuple[str | None, str | None]:
    """
    Attempt to fetch a transcript with 3 progressive fallbacks
    using only api.fetch() (compatible with youtube-transcript-api v1.x).

    A proxy-aware API instance is built first. If the proxy fails or drops connection,
    it automatically falls back to a direct unproxied connection.

        Layer 1 — English (manual or auto-generated)
        Layer 2 — Common language variants (en-US, en-GB, en-IN, hi, es, etc.)
        Layer 3 — No language filter: accepts whatever YouTube has available
        Direct fallback — Retries unproxied if proxy connection failed

    Returns:
        (transcript_text, language_label) or (None, None) on failure.
    """

    api = _build_transcript_api()

    log = logger.bind(video_id=video_id)

    def _try_layers(transcript_api: YouTubeTranscriptApi, prefix: str = "") -> tuple[str | None, str | None]:
        # --------------------------------------------------------
        # Layer 1: English (covers both manual and auto-generated)
        # --------------------------------------------------------
        try:
            fetched = transcript_api.fetch(video_id, languages=["en"])
            text = "\n".join(s.text for s in fetched)
            if text.strip():
                log.info("transcript.layer_ok", layer=f"{prefix}1", language="en")
                return text, "en"
        except Exception as e:
            log.warning("transcript.layer_failed", layer=f"{prefix}1", exc=str(e))

        # --------------------------------------------------------
        # Layer 2: Common language variants (broad net)
        # --------------------------------------------------------
        other_languages = ["en-US", "en-GB", "en-IN", "en-AU", "hi", "es", "fr", "de", "pt"]
        try:
            fetched = transcript_api.fetch(video_id, languages=other_languages)
            text = "\n".join(s.text for s in fetched)
            if text.strip():
                log.info("transcript.layer_ok", layer=f"{prefix}2", language="variant")
                return text, "variant"
        except Exception as e:
            log.warning("transcript.layer_failed", layer=f"{prefix}2", exc=str(e))

        # --------------------------------------------------------
        # Layer 3: No language filter — take whatever is available
        # --------------------------------------------------------
        try:
            fetched = transcript_api.fetch(video_id)
            text = "\n".join(s.text for s in fetched)
            if text.strip():
                log.info("transcript.layer_ok", layer=f"{prefix}3", language="any")
                return text, "any"
        except Exception as e:
            log.warning("transcript.layer_failed", layer=f"{prefix}3", exc=str(e))

        return None, None

    result, lang = _try_layers(api)
    if result:
        return result, lang

    # If a proxy was configured and all layers failed, fall back to direct unproxied connection
    proxy_url = os.getenv("YOUTUBE_PROXY_URL", "").strip()
    webshare_user = os.getenv("WEBSHARE_PROXY_USERNAME", "").strip()
    if proxy_url or webshare_user:
        log.warning("transcript.proxy_failed_retrying_direct", reason="proxy_aborted_or_failed")
        direct_api = YouTubeTranscriptApi()
        result, lang = _try_layers(direct_api, prefix="direct_")
        if result:
            return result, lang

    log.error("transcript.exhausted", layers_tried=3)
    return None, None


# ============================================================
# TOOL 3: GET VIDEO TRANSCRIPT
# ============================================================

@tool
def get_video_transcript(
    video_id: str,
    max_chars: Optional[int] = None,
) -> str:
    """
    Fetch a YouTube transcript using a 3-layer fallback strategy:
        1. Manual English transcript
        2. Auto-generated English captions / language variants
        3. Any available language

    Proxy support: Set WEBSHARE_PROXY_USERNAME + WEBSHARE_PROXY_PASSWORD
    or YOUTUBE_PROXY_URL in the environment to bypass cloud IP blocks.

    Retrieves 100% of the complete transcript without character restrictions
    or truncation by default.

    Args:
        video_id:
            YouTube video ID.

        max_chars:
            Optional character limit. If None or <= 0, 100% of the transcript
            is returned without any truncation.

    Returns:
        Full transcript text, or an unavailability message.
    """

    if not video_id or not video_id.strip():
        return "Transcript unavailable: video_id cannot be empty."

    video_id = video_id.strip()

    text, language_used = _fetch_transcript_with_fallback(video_id)

    if not text or not text.strip():
        return (
            "Transcript unavailable: "
            "no transcript found for this video "
            "(manual, auto-generated, or translated)."
        )

    if max_chars is not None and max_chars > 0 and len(text) > max_chars:
        text = text[:max_chars]

    return f"[Language: {language_used}]\n\n{text}"