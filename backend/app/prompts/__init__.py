"""
app.prompts — Jinja2-powered prompt templates package.

Provides typed PromptTemplate classes and Jinja2 template loading from filesystem.
"""

from app.prompts.base import (
    BasePromptTemplate,
    JinjaPromptTemplate,
    TEMPLATES_DIR,
)

from app.prompts.youtube import (
    PlanYouTubeResearchPromptTemplate,
    ContextAnalysisPromptTemplate,
    FinalReportPromptTemplate,
    plan_research_template,
    context_analysis_template,
    final_report_template,
)

__all__ = [
    # Base
    "BasePromptTemplate",
    "JinjaPromptTemplate",
    "TEMPLATES_DIR",
    # Classes
    "PlanYouTubeResearchPromptTemplate",
    "ContextAnalysisPromptTemplate",
    "FinalReportPromptTemplate",
    # Instances
    "plan_research_template",
    "context_analysis_template",
    "final_report_template",
]
