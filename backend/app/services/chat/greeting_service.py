"""
app.services.chat.greeting_service — Chat Greeting & Discovery Domain Service.

Handles personalized welcome greetings with rotating suggestions and lists
all user-researched videos available for conversation scoping.
"""

from __future__ import annotations

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


class GreetingService:
    """Manages chat greetings and available researched videos."""

    def get_chat_greeting(
        self,
        user: Optional[Any] = None,
        name_override: Optional[str] = None,
    ) -> ChatGreetingResponse:
        """
        Returns a personalized greeting sentence interpolated with user's name,
        chosen from 30 curated Claude & ChatGPT style prompts for video research.
        """
        display_name = "there"
        if name_override and name_override.strip():
            display_name = name_override.strip()
        elif user:
            full_name = getattr(user, "full_name", None)
            username = getattr(user, "username", None)
            email = getattr(user, "email", None)

            if full_name and str(full_name).strip():
                display_name = str(full_name).strip().split()[0]
            elif username and str(username).strip():
                display_name = str(username).strip()
            elif email and "@" in str(email):
                display_name = str(email).split("@")[0].capitalize()

        interpolated = [tmpl.format(name=display_name) for tmpl in GREETING_TEMPLATES]
        chosen = random.choice(interpolated)

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
        Return all YouTube videos that the user has researched.

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

        items = [
            AvailableVideoItem(
                db_id=v.id,
                youtube_video_id=v.video_id,
                title=v.title,
                channel=v.channel,
                url=v.url,
            )
            for v in videos
        ]

        return AvailableVideosResponse(videos=items, total=len(items))
