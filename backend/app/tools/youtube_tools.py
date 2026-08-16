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

    # --------------------------------------------------------
    # Validate input
    # --------------------------------------------------------

    if not query or not query.strip():
        raise ValueError(
            "YouTube search query cannot be empty."
        )

    # Keep API request within YouTube's allowed range.
    max_results = max(
        1,
        min(max_results, 50)
    )

    # --------------------------------------------------------
    # Call YouTube Search API
    # --------------------------------------------------------

    response = youtube.search().list(
        q=query.strip(),
        part="snippet",
        type="video",
        maxResults=max_results,
    ).execute()

    # --------------------------------------------------------
    # Parse results
    # --------------------------------------------------------

    results = []

    for item in response.get("items", []):

        video_id = (
            item
            .get("id", {})
            .get("videoId")
        )

        snippet = item.get(
            "snippet",
            {}
        )

        # Skip malformed results.
        if not video_id:
            continue

        results.append({

            "video_id": video_id,

            "title": snippet.get(
                "title"
            ),

            "description": snippet.get(
                "description"
            ),

            "channel": snippet.get(
                "channelTitle"
            ),

            "published_at": snippet.get(
                "publishedAt"
            ),

            "url": (
                f"https://www.youtube.com/watch?v={video_id}"
            ),
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
    Get detailed metadata and statistics
    for a YouTube video.

    Args:
        video_id:
            YouTube video ID.

    Returns:
        Video metadata and statistics.
    """

    # --------------------------------------------------------
    # Validate input
    # --------------------------------------------------------

    if not video_id or not video_id.strip():
        raise ValueError(
            "video_id cannot be empty."
        )

    video_id = video_id.strip()

    # --------------------------------------------------------
    # Call YouTube Videos API
    # --------------------------------------------------------

    response = youtube.videos().list(
        part="snippet,statistics",
        id=video_id,
    ).execute()

    items = response.get(
        "items",
        []
    )

    # --------------------------------------------------------
    # Video does not exist
    # --------------------------------------------------------

    if not items:

        return {
            "success": False,
            "error": "Video not found",
            "video_id": video_id,
        }

    # --------------------------------------------------------
    # Extract video information
    # --------------------------------------------------------

    video = items[0]

    snippet = video.get(
        "snippet",
        {}
    )

    statistics = video.get(
        "statistics",
        {}
    )

    return {

        "success": True,

        "video_id": video_id,

        "title": snippet.get(
            "title"
        ),

        "description": snippet.get(
            "description"
        ),

        "channel": snippet.get(
            "channelTitle"
        ),

        "published_at": snippet.get(
            "publishedAt"
        ),

        "views": statistics.get(
            "viewCount"
        ),

        "likes": statistics.get(
            "likeCount"
        ),

        "comments": statistics.get(
            "commentCount"
        ),

        "url": (
            f"https://www.youtube.com/watch?v={video_id}"
        ),
    }


# ============================================================
# TOOL 3: GET VIDEO TRANSCRIPT
# ============================================================

@tool
def get_video_transcript(
    video_id: str,
    max_chars: int = 10000,
) -> str:
    """
    Fetch a YouTube transcript.

    The tool tries:
        1. English
        2. Hindi

    The transcript is truncated to max_chars to prevent
    sending extremely large context to an LLM.

    Args:
        video_id:
            YouTube video ID.

        max_chars:
            Maximum number of characters returned.

    Returns:
        Transcript text.
    """

    # --------------------------------------------------------
    # Validate input
    # --------------------------------------------------------

    if not video_id or not video_id.strip():

        return (
            "Transcript unavailable: "
            "video_id cannot be empty."
        )

    video_id = video_id.strip()

    max_chars = max(
        100,
        max_chars
    )

    # --------------------------------------------------------
    # Initialize transcript API
    # --------------------------------------------------------

    api = YouTubeTranscriptApi()

    # --------------------------------------------------------
    # Try English transcript
    # --------------------------------------------------------

    transcript = None
    language_used = None

    try:

        transcript = api.fetch(
            video_id,
            languages=["en"],
        )

        language_used = "en"

    except Exception:
        pass

    # --------------------------------------------------------
    # Try Hindi transcript
    # --------------------------------------------------------

    if transcript is None:

        try:

            transcript = api.fetch(
                video_id,
                languages=["hi"],
            )

            language_used = "hi"

        except Exception as e:

            return (
                "Transcript unavailable: "
                f"{str(e)}"
            )

    # --------------------------------------------------------
    # Convert transcript to text
    # --------------------------------------------------------

    try:

        text = "\n".join(
            snippet.text
            for snippet in transcript
        )

    except Exception as e:

        return (
            "Transcript parsing failed: "
            f"{str(e)}"
        )

    # --------------------------------------------------------
    # Handle empty transcript
    # --------------------------------------------------------

    if not text.strip():

        return (
            "Transcript unavailable: "
            "transcript is empty."
        )

    # --------------------------------------------------------
    # Limit transcript size
    # --------------------------------------------------------

    if len(text) > max_chars:

        text = (
            text[:max_chars]
            + "\n\n[TRANSCRIPT TRUNCATED]"
        )

    # --------------------------------------------------------
    # Return transcript
    # --------------------------------------------------------

    return (
        f"[Language: {language_used}]\n\n"
        f"{text}"
    )