"""
Unit tests for Jinja2 Prompt Templates using unittest, pytest, and MagicMock.
"""

import unittest
from unittest.mock import MagicMock, patch
import pytest
from jinja2 import Environment, TemplateNotFound

from app.prompts import (
    BasePromptTemplate,
    JinjaPromptTemplate,
    PlanYouTubeResearchPromptTemplate,
    ContextAnalysisPromptTemplate,
    FinalReportPromptTemplate,
    ChatRAGPromptTemplate,
    plan_research_template,
    context_analysis_template,
    final_report_template,
    chat_rag_template,
)


class TestPromptTemplatesUnitTest(unittest.TestCase):
    """unittest.TestCase test suite for Prompt Templates using MagicMock."""

    def test_missing_required_variables_raises_value_error(self):
        """Verify omitting required variable raises ValueError."""
        template = JinjaPromptTemplate.from_string(
            "Hello {{ user }}!",
            required_vars=["user"],
        )
        with self.assertRaises(ValueError) as ctx:
            template.render()
        self.assertIn("Missing required template variables", str(ctx.exception))

    def test_mock_jinja_environment_rendering(self):
        """Verify prompt template interaction with mocked Jinja2 Environment."""
        mock_jinja_template = MagicMock()
        mock_jinja_template.render.return_value = "MOCKED RENDER RESULT"

        mock_env = MagicMock(spec=Environment)
        mock_env.get_template.return_value = mock_jinja_template

        prompt_obj = JinjaPromptTemplate("custom/test.txt", required_vars=["name"], env=mock_env)
        rendered = prompt_obj.render(name="ResearchTube")

        self.assertEqual(rendered, "MOCKED RENDER RESULT")
        mock_env.get_template.assert_called_once_with("custom/test.txt")
        mock_jinja_template.render.assert_called_once_with(name="ResearchTube")

    def test_mock_template_not_found(self):
        """Verify FileNotFoundError error handling when template file is missing."""
        mock_env = MagicMock(spec=Environment)
        mock_env.get_template.side_effect = TemplateNotFound("non_existent_template.txt")

        with self.assertRaises(FileNotFoundError):
            JinjaPromptTemplate("non_existent_template.txt", env=mock_env)

    def test_chat_rag_prompt_template_with_mocked_chunks(self):
        """Verify ChatRAGPromptTemplate with mocked context chunks and history."""
        mock_chunk_1 = MagicMock()
        mock_chunk_1.text = "LangChain provides agents and tools."
        mock_chunk_1.video_title = "LangChain Tutorial"
        mock_chunk_1.video_id = "abc123"
        mock_chunk_1.start_time = 12.0

        mock_turn = MagicMock()
        mock_turn.role = "user"
        mock_turn.content = "What is an agent?"

        template = ChatRAGPromptTemplate()
        rendered = template.render(
            user_message="Explain tools",
            scope_description="LangChain agent workflow",
            context_chunks=[mock_chunk_1],
            history=[mock_turn],
            web_search_results="Search result: E2B provides cloud sandboxes.",
        )

        self.assertIn("Explain tools", rendered)
        self.assertIn("LangChain provides agents and tools", rendered)
        self.assertIn("What is an agent?", rendered)
        self.assertIn("E2B provides cloud sandboxes", rendered)

    def test_format_render_equivalence(self):
        """Verify format() alias produces identical result to render()."""
        template = PlanYouTubeResearchPromptTemplate()
        res_render = template.render(user_query="FastAPI tutorial", num_videos=3)
        res_format = template.format(user_query="FastAPI tutorial", num_videos=3)
        self.assertEqual(res_render, res_format)


# Pytest functional test cases
def test_string_template():
    """Test inline string template rendering with variables."""
    template = JinjaPromptTemplate.from_string(
        "Hello {{ name }}! Count: {{ count }}",
        required_vars=["name", "count"],
    )
    rendered = template.render(name="ResearchTube", count=42)
    assert rendered == "Hello ResearchTube! Count: 42"


def test_plan_youtube_research_prompt_class():
    """Test Agent 1 plan prompt rendering via class object and singleton."""
    template = PlanYouTubeResearchPromptTemplate()
    prompt = template.render(
        user_query="Learn Rust for Systems Programming",
        num_videos=5,
    )
    assert "Learn Rust for Systems Programming" in prompt
    assert "video_count MUST be exactly 5." in prompt
    assert "YouTubeResearchRequest" in prompt

    # Singleton instance
    prompt_obj = plan_research_template.render(
        user_query="Learn Rust for Systems Programming",
        num_videos=5,
    )
    assert prompt_obj == prompt


def test_context_analysis_prompt_class():
    """Test Agent 2 context analysis prompt rendering via class object and singleton."""
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

    # Singleton instance
    prompt_obj = context_analysis_template.render(
        user_query="Rust memory safety",
        context_text=context,
    )
    assert prompt_obj == prompt


def test_final_report_prompt_class():
    """Test Agent 3 final report prompt rendering via class object and singleton."""
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

    # Singleton instance
    prompt_obj = final_report_template.render(
        user_query="Rust introduction",
        context_text=context,
    )
    assert prompt_obj == prompt


def test_chat_rag_singleton():
    """Test ChatRAGPromptTemplate singleton instance with minimal arguments."""
    rendered = chat_rag_template.render(user_message="Hello ResearchTube")
    assert "Hello ResearchTube" in rendered
    assert isinstance(rendered, str)
