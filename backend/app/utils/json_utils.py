"""
JSON utilities for safe deserialization of JSON-encoded columns.
"""

import json


def parse_json_list(value: str | None) -> list:
    """Safely parse a JSON-encoded list from a Text column."""
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def parse_json_dict(value: str | None) -> dict:
    """Safely parse a JSON-encoded dict from a Text column."""
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}
