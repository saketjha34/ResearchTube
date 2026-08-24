"""
YouTube tools used by the YouTube Research Agents.

Tools:
    1. search_youtube()
    2. get_video_details()
    3. get_video_transcript()

These tools are intentionally kept independent from the agents.
Agents will call these tools when they need YouTube information.
"""

from googleapiclient.discovery import build
from langchain_core.tools import tool
# pyrefly: ignore [missing-import]
from youtube_transcript_api import YouTubeTranscriptApi

from app.core.config import settings


# ============================================================
# YOUTUBE CLIENT
# ============================================================

youtube = build(
    "youtube",
    "v3",
    developerKey=settings.YOUTUBE_API_KEY,
)


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
    using only api.fetch() (compatible with youtube-transcript-api v1.x):

        Layer 1 — English (manual or auto-generated)
        Layer 2 — Common language variants (en-US, en-GB, en-IN, hi, es, etc.)
        Layer 3 — No language filter: accepts whatever YouTube has available

    Returns:
        (transcript_text, language_label) or (None, None) on failure.
    """

    api = YouTubeTranscriptApi()

    # --------------------------------------------------------
    # Layer 1: English (covers both manual and auto-generated)
    # --------------------------------------------------------
    try:
        fetched = api.fetch(video_id, languages=["en"])
        text = "\n".join(s.text for s in fetched)
        if text.strip():
            print(f"[Transcript] {video_id}: Layer 1 (EN) succeeded.")
            return text, "en"
    except Exception as e:
        print(f"[Transcript] {video_id}: Layer 1 failed — {e}")

    # --------------------------------------------------------
    # Layer 2: Common language variants (broad net)
    # --------------------------------------------------------
    other_languages = ["en-US", "en-GB", "en-IN", "en-AU", "hi", "es", "fr", "de", "pt"]
    try:
        fetched = api.fetch(video_id, languages=other_languages)
        text = "\n".join(s.text for s in fetched)
        if text.strip():
            print(f"[Transcript] {video_id}: Layer 2 (language variants) succeeded.")
            return text, "variant"
    except Exception as e:
        print(f"[Transcript] {video_id}: Layer 2 failed — {e}")

    # --------------------------------------------------------
    # Layer 3: No language filter — take whatever is available
    # --------------------------------------------------------
    try:
        fetched = api.fetch(video_id)
        text = "\n".join(s.text for s in fetched)
        if text.strip():
            print(f"[Transcript] {video_id}: Layer 3 (any language) succeeded.")
            return text, "any"
    except Exception as e:
        print(f"[Transcript] {video_id}: Layer 3 failed — {e}")

    print(f"[Transcript] {video_id}: All 3 layers exhausted — no transcript available.")
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
        2. Auto-generated English captions
        3. Any available language, translated to English

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