"""
app.services.chat.greeting_service — Chat Greeting & Discovery Domain Service.

Handles personalized welcome greetings with rotating suggestions and lists
all user-researched videos available for conversation scoping.
"""

from __future__ import annotations

from datetime import datetime
import random
from typing import Any, Optional
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.youtube import ResearchRun, ResearchVideo, YouTubeVideo
from app.schema.chat import (
    AvailableVideoItem,
    AvailableVideosResponse,
    ChatGreetingResponse,
)

_logger = structlog.get_logger()

# ============================================================
# CURATED GREETING SENTENCE TEMPLATES (30 Variations)
# ============================================================

GREETING_TEMPLATES = [
    "Hey {name}, what are we researching today?",
    "Good to see you, {name}. What are we exploring?",
    "Hey {name}, what's on your mind today?",
    "Ready when you are, {name}. Where to start?",
    "Welcome back, {name}. Where shall we begin?",
    "Hey {name}, what concepts should we unpack?",
    "How can I help synthesize your research, {name}?",
    "Hey {name}, what problem are we solving?",
    "Hello {name}, what shall we synthesize today?",
    "Hey {name}, let's explore your video research.",
    "What would you like to discover today, {name}?",
    "Hey {name}, ready to dive into the transcripts?",
    "Where shall we start our deep dive, {name}?",
    "Hey {name}, what insights are we looking for?",
    "Let's learn something new today, {name}.",
    "Hey {name}, what topics are we investigating?",
    "How can I assist your research today, {name}?",
    "Hey {name}, ready to turn videos into answers?",
    "What shall we uncover together, {name}?",
    "Hey {name}, which videos are we breaking down?",
    "Ready to research, {name}. What's the plan?",
    "Hey {name}, let's find answers in your videos.",
    "What topic are we exploring today, {name}?",
    "Hey {name}, what's the research focus today?",
    "Good to see you back, {name}. Where to start?",
    "Hey {name}, ask anything from your video library.",
    "Hey {name}, ready to extract key takeaways?",
    "What questions can I answer for you, {name}?",
    "Hey {name}, what are we learning about today?",
    "Welcome {name}, let's get into the details.",
]


# Cache for YouTube channel stats (subscribers, avatar) to avoid repeated API calls
_CHANNEL_STATS_CACHE: dict[str, dict] = {}


def _format_subscriber_count(count: Optional[int]) -> Optional[str]:
    """Format numeric subscriber count to human-friendly string (e.g. 1.57M, 58.3K)."""
    if count is None:
        return None
    if count >= 1_000_000:
        return f"{count / 1_000_000:.2f}".rstrip("0").rstrip(".") + "M"
    if count >= 1_000:
        return f"{count / 1_000:.1f}".rstrip("0").rstrip(".") + "K"
    return str(count)


class GreetingService:
    """Provides personalized user greetings and researched video discovery."""

    def __init__(self) -> None:
        _logger.info("greeting_service.initialized")

    def get_chat_greeting(
        self,
        user: Optional[Any] = None,
        name_override: Optional[str] = None,
    ) -> ChatGreetingResponse:
        """
        Generate a personalized chat greeting sentence.
        """
        display_name: str = "there"
        if name_override and name_override.strip():
            display_name = name_override.strip()
        elif user is not None:
            full_name = getattr(user, "full_name", None)
            if full_name and full_name.strip():
                display_name = full_name.strip().split()[0]
            else:
                email = getattr(user, "email", None)
                if email and "@" in email:
                    display_name = email.split("@")[0]

        template = random.choice(GREETING_TEMPLATES)
        chosen = template.format(name=display_name)

        interpolated = [t.format(name=display_name) for t in GREETING_TEMPLATES]

        return ChatGreetingResponse(
            greeting=chosen,
            user_name=display_name,
            sentences=interpolated,
        )

    async def list_available_videos(
        self,
        session: AsyncSession,
        user_id: UUID,
    ) -> AvailableVideosResponse:
        """
        Return all YouTube videos that the user has researched with full YouTube statistics.

        These are the videos whose transcripts are ingested in pgvector and can be
        used to scope a chat session.
        """
        _logger.info("chat.list_available_videos", user_id=str(user_id))

        stmt = (
            select(YouTubeVideo)
            .join(ResearchVideo, ResearchVideo.video_id == YouTubeVideo.id)
            .join(ResearchRun, ResearchRun.id == ResearchVideo.research_run_id)
            .where(ResearchRun.user_id == user_id)
            .where(ResearchRun.status == "completed")
            .distinct()
            .order_by(YouTubeVideo.created_at.desc())
        )

        result = await session.execute(stmt)
        videos = result.scalars().all()

        # Resolve channel stats (subscribers & avatar) and missing metadata in batch
        unresolved_video_ids = [
            v.video_id for v in videos
            if (v.channel and v.channel not in _CHANNEL_STATS_CACHE) or (v.published_at is None)
        ]

        video_snippet_map: dict[str, dict] = {}

        if unresolved_video_ids:
            try:
                from app.tools.youtube_tools import youtube
                # Batch request video snippets to get channel IDs and published dates (up to 50 videos)
                chunk = unresolved_video_ids[:50]
                v_res = youtube.videos().list(part="snippet,statistics", id=",".join(chunk)).execute()
                channel_map: dict[str, str] = {}
                db_updates = False
                for item in v_res.get("items", []):
                    v_id = item.get("id")
                    snippet = item.get("snippet", {})
                    c_id = snippet.get("channelId")
                    c_title = snippet.get("channelTitle")
                    if c_id and c_title:
                        channel_map[c_id] = c_title
                    if v_id:
                        video_snippet_map[v_id] = snippet

                # Persist missing published_at or description to database
                for v in videos:
                    v_item = video_snippet_map.get(v.video_id)
                    if v_item:
                        pub_str = v_item.get("publishedAt")
                        if not v.published_at and pub_str:
                            try:
                                v.published_at = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                                db_updates = True
                            except Exception:
                                pass
                        if not v.description and v_item.get("description"):
                            v.description = v_item.get("description")
                            db_updates = True

                if db_updates:
                    try:
                        await session.commit()
                    except Exception:
                        pass

                if channel_map:
                    c_res = youtube.channels().list(
                        part="statistics,snippet",
                        id=",".join(channel_map.keys()),
                    ).execute()
                    for c_item in c_res.get("items", []):
                        stats = c_item.get("statistics", {})
                        snippet = c_item.get("snippet", {})
                        c_title = snippet.get("title")
                        subs_str = stats.get("subscriberCount")
                        subs_int = int(subs_str) if subs_str is not None else None
                        avatar = snippet.get("thumbnails", {}).get("default", {}).get("url")
                        cached_entry = {
                            "subscriber_count": subs_int,
                            "subscribers": _format_subscriber_count(subs_int),
                            "channel_avatar": avatar,
                        }
                        if c_title:
                            _CHANNEL_STATS_CACHE[c_title] = cached_entry
                        _CHANNEL_STATS_CACHE[c_item["id"]] = cached_entry
            except Exception as exc:
                _logger.warning("chat.channel_stats_fetch_failed", error=str(exc))

        items: list[AvailableVideoItem] = []
        for v in videos:
            channel_info = _CHANNEL_STATS_CACHE.get(v.channel or "") or {}
            v_snippet = video_snippet_map.get(v.video_id) or {}
            
            published_val = v.published_at
            if not published_val and v_snippet.get("publishedAt"):
                try:
                    published_val = datetime.fromisoformat(v_snippet["publishedAt"].replace("Z", "+00:00"))
                except Exception:
                    published_val = None

            desc_val = v.description or v_snippet.get("description")

            items.append(
                AvailableVideoItem(
                    db_id=v.id,
                    youtube_video_id=v.video_id,
                    title=v.title,
                    channel=v.channel,
                    url=v.url or f"https://www.youtube.com/watch?v={v.video_id}",
                    thumbnail_url=f"https://i.ytimg.com/vi/{v.video_id}/mqdefault.jpg",
                    views=v.views,
                    likes=v.likes,
                    comments=v.comments,
                    subscribers=channel_info.get("subscribers"),
                    subscriber_count=channel_info.get("subscriber_count"),
                    published_at=published_val,
                    description=desc_val,
                    channel_avatar=channel_info.get("channel_avatar"),
                )
            )

        return AvailableVideosResponse(videos=items, total=len(items))
