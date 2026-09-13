"""
Base Jinja2 PromptTemplate system.

Provides a typed, object-oriented interface for loading and rendering prompt templates
using Jinja2 from filesystem files or string templates.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Sequence

import jinja2

# Base path for prompt templates: app/prompts/templates/
PROMPTS_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = PROMPTS_DIR / "templates"


def _create_jinja_env(template_dir: Path | None = None) -> jinja2.Environment:
    """Create a configured Jinja2 Environment with FileSystemLoader."""
    loader_dir = template_dir or TEMPLATES_DIR
    return jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(loader_dir)),
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
        undefined=jinja2.StrictUndefined,
    )


# Shared default Jinja2 environment
_default_env = _create_jinja_env()


class JinjaPromptTemplate:
    """
    Object-oriented PromptTemplate powered by Jinja2.

    Supports loading templates from files (e.g. .txt, .jinja) or raw template strings.

    Usage:
        # Load from file relative to app/prompts/templates:
        template = JinjaPromptTemplate.from_file("youtube/plan_research.txt")
        prompt = template.render(user_query="FastAPI tutorial", num_videos=5)

        # Load from string:
        template = JinjaPromptTemplate.from_string("Hello {{ name }}!")
        prompt = template.render(name="World")
    """

    def __init__(
        self,
        template_name: str | None = None,
        template_string: str | None = None,
        required_vars: Sequence[str] | None = None,
        env: jinja2.Environment | None = None,
    ) -> None:
        self.template_name = template_name
        self.template_string = template_string
        self.required_vars = set(required_vars) if required_vars else set()
        self.env = env or _default_env

        if template_name:
            try:
                self._template = self.env.get_template(template_name)
            except jinja2.TemplateNotFound:
                # If path was absolute or direct file, fallback to direct reading
                path = Path(template_name)
                if not path.is_absolute():
                    path = TEMPLATES_DIR / template_name
                if path.exists():
                    content = path.read_text(encoding="utf-8")
                    self._template = self.env.from_string(content)
                else:
                    raise FileNotFoundError(
                        f"Prompt template '{template_name}' not found in {TEMPLATES_DIR} or path."
                    )
        elif template_string is not None:
            self._template = self.env.from_string(template_string)
        else:
            raise ValueError("Either template_name or template_string must be provided.")

    @classmethod
    def from_file(
        cls,
        template_path: str | Path,
        required_vars: Sequence[str] | None = None,
        env: jinja2.Environment | None = None,
    ) -> JinjaPromptTemplate:
        """Create a prompt template loaded from a file."""
        return cls(
            template_name=str(template_path).replace("\\", "/"),
            required_vars=required_vars,
            env=env,
        )

    @classmethod
    def from_string(
        cls,
        template_string: str,
        required_vars: Sequence[str] | None = None,
        env: jinja2.Environment | None = None,
    ) -> JinjaPromptTemplate:
        """Create a prompt template from an in-memory string."""
        return cls(
            template_string=template_string,
            required_vars=required_vars,
            env=env,
        )

    def validate_variables(self, **kwargs: Any) -> None:
        """Ensure all declared required variables are present in kwargs."""
        name = self.template_name or "string_template"
        missing = [v for v in self.required_vars if v not in kwargs or kwargs[v] is None]
        if missing:
            raise ValueError(
                f"Missing required template variables for '{name}': {missing}"
            )

    def render(self, **kwargs: Any) -> str:
        """
        Validate variables and render the template into a prompt string.
        """
        self.validate_variables(**kwargs)
        name = self.template_name or "string_template"
        try:
            rendered = self._template.render(**kwargs)
            return rendered.strip()
        except jinja2.UndefinedError as exc:
            raise ValueError(
                f"Undefined variable in template '{name}': {exc}"
            ) from exc



# Alias for clean OOP naming
BasePromptTemplate = JinjaPromptTemplate
