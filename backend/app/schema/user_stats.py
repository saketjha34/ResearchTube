from pydantic import BaseModel, Field
from typing import List

class ChannelStat(BaseModel):
    channel: str = Field(description="Name of the YouTube channel")
    count: int = Field(description="Number of times recommended")

class ConceptStat(BaseModel):
    concept: str = Field(description="Name of the concept/topic")
    count: int = Field(description="Number of times recurring in reports")

class UserStatsResponse(BaseModel):
    total_research_runs: int = Field(description="Total runs created (all statuses)")
    completed_research_runs: int = Field(description="Total completed runs")
    failed_research_runs: int = Field(description="Total failed runs")
    total_videos_analyzed: int = Field(description="Total unique videos analyzed in completed runs")
    total_views_analyzed: int = Field(description="Cumulative views across unique analyzed videos")
    average_videos_per_run: float = Field(description="Average number of videos processed per run")
    total_channels_discovered: int = Field(description="Unique channels analyzed in completed runs")
    average_run_duration_seconds: float = Field(description="Average execution time of successful runs in seconds")
    average_relevance_score: float = Field(description="Average relevance score of recommended videos")
    average_educational_score: float = Field(description="Average educational quality score of recommended videos")
    average_coverage_score: float = Field(description="Average coverage score of recommended videos")
    total_beginner_friendly_videos: int = Field(description="Total videos marked beginner friendly")
    total_transcript_chunks: int = Field(description="Total transcript chunks vector-embedded for this user")
    top_channels: List[ChannelStat] = Field(description="Top 5 most frequently recommended channels")
    top_concepts: List[ConceptStat] = Field(description="Top 10 most recurring concepts/topics parsed from reports")
