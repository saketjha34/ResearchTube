"""
Structured logging configuration using structlog.

Renderers:
    dev  (ENVIRONMENT=dev)  → ConsoleRenderer — coloured, human-readable
    prod (ENVIRONMENT=prod) → JSONRenderer    → GCP Cloud Logging parses
                                                each field automatically

Usage:
    # In any module
    import structlog
    logger = structlog.get_logger()

    # Plain log
    logger.info("node.started", node=1, run_id="abc123")

    # Bind context for the lifetime of a pipeline run
    log = logger.bind(run_id="abc123", user_id="u-1")
    log.info("pipeline.started", query="system design")
    log.error("node.failed", node=3, exc="timeout")

Cloud Logging filter examples (prod):
    jsonPayload.run_id="abc123"
    jsonPayload.event="transcript.layer_failed"
    jsonPayload.level="error"
    jsonPayload.node=4
"""

from __future__ import annotations

import logging
import sys

# pyrefly: ignore [missing-import]
import structlog


def configure_logging(environment: str = "dev") -> None:
    """
    Call once at application startup (in FastAPI lifespan).

    Args:
        environment: "dev" or "prod"
    """

    # --------------------------------------------------------
    # Shared processors applied to every log record
    # --------------------------------------------------------
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,          # async context vars
        structlog.stdlib.add_log_level,                   # adds "level" field
        structlog.stdlib.add_logger_name,                 # adds "logger" field
        structlog.processors.TimeStamper(fmt="iso"),      # ISO-8601 timestamp
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,             # formats exception info
    ]

    if environment == "prod":
        # --------------------------------------------------------
        # PRODUCTION: JSON output → Cloud Logging parses fields
        # --------------------------------------------------------
        renderer = structlog.processors.JSONRenderer()
    else:
        # --------------------------------------------------------
        # DEVELOPMENT: Coloured, readable console output
        # --------------------------------------------------------
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # --------------------------------------------------------
    # Configure stdlib logging to route through structlog
    # so third-party libraries (uvicorn, sqlalchemy) are also
    # captured in the same structured format
    # --------------------------------------------------------
    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)

    # Silence noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("LangChain").setLevel(logging.WARNING)
