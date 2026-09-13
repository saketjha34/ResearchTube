"""
YouTube Research Prompt Templates.

Typed classes for YouTube research agent prompts, loaded from Jinja2 templates.
"""

from __future__ import annotations

from typing import Any
from app.prompts.base import JinjaPromptTemplate


class PlanYouTubeResearchPromptTemplate(JinjaPromptTemplate):
    """
    Prompt template class for Agent 1's planner component.
    Converts user query into a structured YouTubeResearchRequest.
    """

    def __init__(self) -> None:
        super().__init__(
            template_name="youtube/plan_research.txt",
            required_vars=["user_query", "num_videos"],
        )

    def render(self, user_query: str, num_videos: int, **kwargs: Any) -> str:
        return super().render(user_query=user_query, num_videos=num_videos, **kwargs)

    def format(self, user_query: str, num_videos: int, **kwargs: Any) -> str:
        return self.render(user_query=user_query, num_videos=num_videos, **kwargs)


class ContextAnalysisPromptTemplate(JinjaPromptTemplate):
    """
    Prompt template class for Agent 2's content analysis & ranking component.
    Evaluates video transcripts and metadata to produce ResourceAnalysis.
    """

    def __init__(self) -> None:
        super().__init__(
            template_name="youtube/context_analysis.txt",
            required_vars=["user_query", "context_text"],
        )

    def render(self, user_query: str, context_text: str, **kwargs: Any) -> str:
        return super().render(user_query=user_query, context_text=context_text, **kwargs)

    def format(self, user_query: str, context_text: str, **kwargs: Any) -> str:
        return self.render(user_query=user_query, context_text=context_text, **kwargs)


class FinalReportPromptTemplate(JinjaPromptTemplate):
    """
    Prompt template class for Agent 3's final synthesis component.
    Generates a comprehensive, structured FinalReport.
    """

    def __init__(self) -> None:
        super().__init__(
            template_name="youtube/final_report.txt",
            required_vars=["user_query", "context_text"],
        )

    def render(self, user_query: str, context_text: str, **kwargs: Any) -> str:
        return super().render(user_query=user_query, context_text=context_text, **kwargs)

    def format(self, user_query: str, context_text: str, **kwargs: Any) -> str:
        return self.render(user_query=user_query, context_text=context_text, **kwargs)


# Pre-instantiated class objects for direct use
plan_research_template = PlanYouTubeResearchPromptTemplate()
context_analysis_template = ContextAnalysisPromptTemplate()
final_report_template = FinalReportPromptTemplate()

__all__ = [
    "PlanYouTubeResearchPromptTemplate",
    "ContextAnalysisPromptTemplate",
    "FinalReportPromptTemplate",
    "plan_research_template",
    "context_analysis_template",
    "final_report_template",
]
