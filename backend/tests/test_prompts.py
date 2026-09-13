"""
Unit tests for Jinja2 Prompt Templates.
"""

import pytest
from app.prompts import (
    BasePromptTemplate,
    JinjaPromptTemplate,
    PlanYouTubeResearchPromptTemplate,
    ContextAnalysisPromptTemplate,
    FinalReportPromptTemplate,
    plan_research_template,
    context_analysis_template,
    final_report_template,
)


def test_string_template():
    """Test inline string template rendering."""
    template = JinjaPromptTemplate.from_string(
        "Hello {{ name }}! Count: {{ count }}",
        required_vars=["name", "count"],
    )
    rendered = template.render(name="ResearchTube", count=42)
    assert rendered == "Hello ResearchTube! Count: 42"


def test_plan_youtube_research_prompt_class():
    """Test Agent 1 plan prompt rendering via class object."""
    template = PlanYouTubeResearchPromptTemplate()
    prompt = template.render(
        user_query="Learn Rust for Systems Programming",
        num_videos=5,
    )
    assert "Learn Rust for Systems Programming" in prompt
    assert "video_count MUST be exactly 5." in prompt
    assert "YouTubeResearchRequest" in prompt

    # Also test singleton instance
    prompt_obj = plan_research_template.render(
        user_query="Learn Rust for Systems Programming",
        num_videos=5,
    )
    assert prompt_obj == prompt


def test_context_analysis_prompt_class():
    """Test Agent 2 context analysis prompt rendering via class object."""
    context = "CHUNK 1: Rust ownership model\nCHUNK 2: Borrow checker rules"
    template = ContextAnalysisPromptTemplate()
    prompt = template.render(
        user_query="Rust memory safety",
        context_text=context,
    )
    assert "USER RESEARCH QUESTION:" in prompt
    assert "Rust memory safety" in prompt
    assert "Rust ownership model" in prompt
    assert "EVALUATION CRITERIA" in prompt

    # Also test singleton instance
    prompt_obj = context_analysis_template.render(
        user_query="Rust memory safety",
        context_text=context,
    )
    assert prompt_obj == prompt


def test_final_report_prompt_class():
    """Test Agent 3 final report prompt rendering via class object."""
    context = "EVALUATION: Top resource is 'Rust in 100 Seconds'"
    template = FinalReportPromptTemplate()
    prompt = template.render(
        user_query="Rust introduction",
        context_text=context,
    )
    assert "Agent 3 of a YouTube research system" in prompt
    assert "Rust introduction" in prompt
    assert "Rust in 100 Seconds" in prompt
    assert "REPORT REQUIREMENTS" in prompt

    # Also test singleton instance
    prompt_obj = final_report_template.render(
        user_query="Rust introduction",
        context_text=context,
    )
    assert prompt_obj == prompt
