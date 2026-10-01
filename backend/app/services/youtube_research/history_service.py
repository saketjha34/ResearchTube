"""
HistoryService - Singleton service for reading research run history from PostgreSQL.

No AI calls made here - pure DB reads.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Optional
from app.db.models.youtube import (
    ResearchRun,
    YouTubeVideo,
    ResearchVideo,
    ResourceEvaluation,
    ResourceRanking,
    FinalReport,
)

from app.schema.history import (
    HistoryEntry,
    HistoryVideoItem,
    HistoryEvaluation,
    HistoryRecommendedResource,
    HistoryListResponse,
)

from app.utils.json_utils import parse_json_list, parse_json_dict
from app.utils.format_utils import get_youtube_thumbnail


class HistoryService:
    """
    Singleton service for reading and assembling research run history.

    Usage:
        from app.services.history_service import history_service
        history = await history_service.get_user_history(db, user_id)
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def build_entry(
        self,
        session: AsyncSession,
        run: ResearchRun,
    ) -> HistoryEntry:
        """Assemble one HistoryEntry from all related DB rows."""


        # --------------------------------------------------------
        # 1. ResearchVideos (ordered by position)
        # --------------------------------------------------------

        rv_result = await session.execute(
            select(ResearchVideo)
            .where(ResearchVideo.research_run_id == run.id)
            .order_by(ResearchVideo.position)
        )
        research_videos = rv_result.scalars().all()

        db_video_uuids = [rv.video_id for rv in research_videos]

        # --------------------------------------------------------
        # 2. YouTubeVideo rows
        # --------------------------------------------------------

        yt_result = await session.execute(
            select(YouTubeVideo).where(
                YouTubeVideo.id.in_(db_video_uuids)
            )
        )
        yt_videos = yt_result.scalars().all()
        yt_by_uuid: dict[UUID, YouTubeVideo] = {v.id: v for v in yt_videos}
        # also map by YouTube string ID for evaluation lookup
        yt_by_video_id: dict[str, YouTubeVideo] = {
            v.video_id: v for v in yt_videos
        }

        # --------------------------------------------------------
        # 3. ResourceEvaluations for this run
        # --------------------------------------------------------

        eval_result = await session.execute(
            select(ResourceEvaluation)
            .where(ResourceEvaluation.research_run_id == run.id)
            .order_by(ResourceEvaluation.rank)
        )
        evaluations = eval_result.scalars().all()
        eval_by_db_uuid: dict[UUID, ResourceEvaluation] = {
            e.video_id: e for e in evaluations
        }

        # --------------------------------------------------------
        # 4. FinalReport
        # --------------------------------------------------------

        report_result = await session.execute(
            select(FinalReport).where(
                FinalReport.research_run_id == run.id
            )
        )
        report = report_result.scalar_one_or_none()

        # --------------------------------------------------------
        # 5. ResourceRanking summary
        # --------------------------------------------------------

        ranking_result = await session.execute(
            select(ResourceRanking).where(
                ResourceRanking.research_run_id == run.id
            )
        )
        ranking = ranking_result.scalar_one_or_none()

        # --------------------------------------------------------
        # 6. Build HistoryVideoItem list
        # --------------------------------------------------------

        transcript_by_yt_id: dict[str, str] = {}
        if report and report.recommended_resources:
            for r in parse_json_list(report.recommended_resources):
                if isinstance(r, dict) and r.get("video_id") and r.get("transcript"):
                    transcript_by_yt_id[r["video_id"]] = r["transcript"]

        video_items: list[HistoryVideoItem] = []

        for rv in research_videos:

            yt = yt_by_uuid.get(rv.video_id)
            ev = eval_by_db_uuid.get(rv.video_id)

            if not yt:
                continue

            item = HistoryVideoItem(
                # YouTube metadata
                video_id=yt.video_id,
                title=yt.title,
                url=yt.url,
                channel=yt.channel,
                description=yt.description,
                published_at=(
                    yt.published_at.isoformat()
                    if yt.published_at else None
                ),
                thumbnail_url=get_youtube_thumbnail(yt.video_id),
                views=yt.views,
                likes=yt.likes,
                comments=yt.comments,
                transcript=transcript_by_yt_id.get(yt.video_id),
                transcript_available=rv.transcript_available,
                transcript_language=rv.transcript_language,

                # Agent 2 evaluation
                rank=ev.rank if ev else None,
                relevance_score=ev.relevance_score if ev else None,
                educational_quality_score=(
                    ev.educational_quality_score if ev else None
                ),
                coverage_score=ev.coverage_score if ev else None,
                overall_score=ev.overall_score if ev else None,
                beginner_friendly=ev.beginner_friendly if ev else None,
                recommendation_reason=(
                    ev.recommendation_reason if ev else None
                ),
                concepts_covered=(
                    parse_json_list(ev.concepts_covered) if ev else []
                ),
                strengths=(
                    parse_json_list(ev.strengths) if ev else []
                ),
                weaknesses=(
                    parse_json_list(ev.weaknesses) if ev else []
                ),
            )

            video_items.append(item)

        # Sort by rank (unranked last)
        video_items.sort(
            key=lambda x: (x.rank is None, x.rank or 0)
        )

        # --------------------------------------------------------
        # 7. Build HistoryEvaluation list (Agent 2 analysis block)
        # --------------------------------------------------------

        analysis_evaluations: list[HistoryEvaluation] = []

        for ev in evaluations:

            yt = yt_by_uuid.get(ev.video_id)

            analysis_evaluations.append(
                HistoryEvaluation(
                    rank=ev.rank,
                    video_id=yt.video_id if yt else str(ev.video_id),
                    title=yt.title if yt else None,
                    relevance_score=ev.relevance_score,
                    educational_quality_score=ev.educational_quality_score,
                    coverage_score=ev.coverage_score,
                    overall_score=ev.overall_score,
                    beginner_friendly=ev.beginner_friendly,
                    recommendation_reason=ev.recommendation_reason,
                    concepts_covered=parse_json_list(ev.concepts_covered),
                    strengths=parse_json_list(ev.strengths),
                    weaknesses=parse_json_list(ev.weaknesses),
                )
            )

        # --------------------------------------------------------
        # 8. Parse recommended_resources from FinalReport JSON
        # --------------------------------------------------------

        # Map YouTube string ID -> ResearchVideo for factual transcript availability
        rv_by_yt_id: dict[str, ResearchVideo] = {}
        for rv in research_videos:
            yt = yt_by_uuid.get(rv.video_id)
            if yt and yt.video_id:
                rv_by_yt_id[yt.video_id] = rv

        recommended_resources: list[HistoryRecommendedResource] = []

        if report and report.recommended_resources:

            raw_resources = parse_json_list(report.recommended_resources)

            for raw in raw_resources:

                if not isinstance(raw, dict):
                    continue

                video_id = raw.get("video_id")
                rv_match = rv_by_yt_id.get(video_id) if video_id else None

                # Ground truth for transcript availability from DB association
                transcript_available = (
                    rv_match.transcript_available
                    if rv_match is not None
                    else raw.get("transcript_available", False)
                )
                transcript_language = (
                    rv_match.transcript_language
                    if (rv_match is not None and rv_match.transcript_language)
                    else raw.get("transcript_language")
                )

                def _clean_str(val: Any) -> Optional[str]:
                    if val is None:
                        return None
                    s = str(val).strip()
                    if s.lower() in ("none", "null", "n/a", ""):
                        return None
                    return s

                clean_title = _clean_str(raw.get("title"))
                clean_channel = _clean_str(raw.get("channel"))
                clean_desc = _clean_str(raw.get("description"))
                clean_published = _clean_str(raw.get("published_at"))

                # Fallback to DB video record if title/channel/description is missing
                yt_record = yt_by_uuid.get(rv_match.video_id) if (rv_match and rv_match.video_id) else None
                if not clean_title and yt_record:
                    clean_title = _clean_str(yt_record.title)
                if not clean_channel and yt_record:
                    clean_channel = _clean_str(yt_record.channel)
                if not clean_desc and yt_record:
                    clean_desc = _clean_str(yt_record.description)
                if not clean_published and yt_record and yt_record.published_at:
                    clean_published = yt_record.published_at.isoformat()

                if not clean_title and video_id:
                    clean_title = f"Video ({video_id})"

                views_val = raw.get("views")
                if views_val is None and yt_record and yt_record.views is not None:
                    views_val = yt_record.views
                likes_val = raw.get("likes")
                if likes_val is None and yt_record and yt_record.likes is not None:
                    likes_val = yt_record.likes
                comments_val = raw.get("comments")
                if comments_val is None and yt_record and yt_record.comments is not None:
                    comments_val = yt_record.comments

                rec = HistoryRecommendedResource(
                    rank=raw.get("rank"),
                    video_id=video_id,
                    title=clean_title,
                    url=raw.get("url") or (f"https://www.youtube.com/watch?v={video_id}" if video_id else None),
                    channel=clean_channel,
                    published_at=clean_published,
                    description=clean_desc,
                    views=views_val,
                    likes=likes_val,
                    comments=comments_val,
                    transcript=raw.get("transcript"),
                    transcript_available=transcript_available,
                    transcript_language=transcript_language,
                    relevance_score=raw.get("relevance_score"),
                    educational_quality_score=raw.get("educational_quality_score"),
                    coverage_score=raw.get("coverage_score"),
                    overall_score=raw.get("overall_score"),
                    beginner_friendly=raw.get("beginner_friendly"),
                    recommendation_reason=raw.get("recommendation_reason"),
                    concepts_covered=raw.get("concepts_covered") or [],
                    strengths=raw.get("strengths") or [],
                    weaknesses=raw.get("weaknesses") or [],
                    thumbnail_url=(
                        get_youtube_thumbnail(video_id) if video_id else None
                    ),
                )

                recommended_resources.append(rec)

        # --------------------------------------------------------
        # 9. Assemble HistoryEntry
        # --------------------------------------------------------

        return HistoryEntry(
            run_id=str(run.id),
            query=run.user_query,
            status=run.status,
            is_public=run.is_public,
            is_pinned=bool(getattr(run, "is_pinned", False)),
            is_archived=bool(getattr(run, "is_archived", False)),
            video_count=run.video_count,
            created_at=run.created_at,
            completed_at=run.completed_at,

            # Agent 3 — Final Report
            research_question=(
                report.research_question if report else None
            ),
            executive_summary=(
                report.executive_summary if report else None
            ),
            conclusion=(
                report.conclusion if report else None
            ),
            methodology=(
                report.methodology if report else None
            ),
            learning_path=(
                parse_json_list(report.learning_path)
                if report else []
            ),
            key_topics=(
                parse_json_list(report.key_topics)
                if report else []
            ),
            limitations=(
                parse_json_list(report.limitations)
                if report else []
            ),
            recommended_resources=recommended_resources,

            # Agent 2 — Analysis
            analysis_evaluations=analysis_evaluations,
            ranking_summary=(
                ranking.ranking_summary if ranking else None
            ),

            # Videos (enriched)
            videos=video_items,
        )


    # ============================================================
    # GET USER HISTORY (paginated)

    async def get_user_history(
        self,
        session: AsyncSession,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
        archived: bool = False,
    ) -> HistoryListResponse:
        """Return a paginated list of HistoryEntry objects for the given user, newest first."""

        offset = (page - 1) * page_size

        count_result = await session.execute(
            select(func.count())
            .where(ResearchRun.user_id == user_id)
            .where(ResearchRun.is_archived.is_(archived))
        )
        total = count_result.scalar_one()

        runs_result = await session.execute(
            select(ResearchRun)
            .where(ResearchRun.user_id == user_id)
            .where(ResearchRun.is_archived.is_(archived))
            .order_by(ResearchRun.is_pinned.desc(), desc(ResearchRun.created_at))
            .offset(offset)
            .limit(page_size)
        )
        runs = runs_result.scalars().all()

        entries = []
        for run in runs:
            entry = await self.build_entry(session=session, run=run)
            entries.append(entry)

        return HistoryListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=entries,
        )


# Singleton instance
history_service = HistoryService()


# Backward compatibility shims

async def get_user_history(
    session: AsyncSession,
    user_id: UUID,
    page: int = 1,
    page_size: int = 20,
    archived: bool = False,
) -> HistoryListResponse:
    return await history_service.get_user_history(session, user_id, page, page_size, archived)


async def _build_entry(
    session: AsyncSession,
    run: ResearchRun,
) -> HistoryEntry:
    return await history_service.build_entry(session=session, run=run)
