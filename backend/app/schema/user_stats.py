from pydantic import BaseModel, Field
from typing import List, Optional

class ChannelStat(BaseModel):
    channel: str = Field(description="Name of the YouTube channel")
    count: int = Field(description="Number of times recommended")

class ConceptStat(BaseModel):
    concept: str = Field(description="Name of the concept/topic")
    count: int = Field(description="Number of times recurring in reports")

class ChatVideoStat(BaseModel):
    title: str = Field(description="Title of the video discussed in chat")
    channel: Optional[str] = Field(None, description="Channel of the video")
    chat_count: int = Field(description="Number of chat sessions focused on this video")

class ChatScopeStat(BaseModel):
    scope: str = Field(description="Scope type: 'video', 'none' (general), or 'all' (library)")
    count: int = Field(description="Number of sessions in this scope")

class UserStatsResponse(BaseModel):
    # Research Activity Stats
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

    # Conversational AI & Chat Analytics
    total_chat_sessions: int = Field(0, description="Total conversations created by the user")
    total_chat_messages: int = Field(0, description="Total messages exchanged across all sessions")
    total_user_messages: int = Field(0, description="Total questions/queries submitted by user")
    total_assistant_messages: int = Field(0, description="Total AI assistant responses generated")
    average_messages_per_session: float = Field(0.0, description="Average message turns per conversation")
    total_video_scoped_sessions: int = Field(0, description="Conversations scoped to a specific video")
    total_rag_grounded_messages: int = Field(0, description="AI responses citing video transcript chunks")
    rag_grounding_rate: float = Field(0.0, description="Percentage of AI responses grounded in video evidence")
    pinned_chat_sessions: int = Field(0, description="Number of pinned conversations")
    shared_chat_sessions: int = Field(0, description="Number of shared conversation threads")
    top_discussed_videos: List[ChatVideoStat] = Field(default_factory=list, description="Top videos discussed in chat")
    chat_scope_distribution: List[ChatScopeStat] = Field(default_factory=list, description="Distribution of chat session scopes")
