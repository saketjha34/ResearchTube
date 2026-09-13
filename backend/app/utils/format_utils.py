"""
Formatting utilities for URLs, thumbnails, and text helpers.
"""


def get_youtube_thumbnail(video_id: str) -> str:
    """Return the HQ thumbnail URL for a YouTube video ID."""
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
