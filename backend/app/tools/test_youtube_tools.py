"""
Pytest tests for YouTube tools.

These tests DO NOT call the real YouTube API.

The YouTube API and transcript API are mocked so that
tests are:
    - fast
    - deterministic
    - independent of API quota
    - safe to run in CI/CD

Run:

    pytest

Or:

    pytest -v
"""

import pytest

from app.tools.youtube_tools import (
    search_youtube,
    get_video_details,
    get_video_transcript,
)


# ============================================================
# SEARCH YOUTUBE TESTS
# ============================================================


def test_search_youtube_success(monkeypatch):
    """
    Test that search_youtube correctly parses
    YouTube search results.
    """

    # --------------------------------------------------------
    # Fake YouTube API response
    # --------------------------------------------------------

    fake_response = {

        "items": [

            {
                "id": {
                    "videoId": "abc123"
                },

                "snippet": {

                    "title":
                        "Machine Learning Tutorial",

                    "description":
                        "Learn machine learning.",

                    "channelTitle":
                        "Test Channel",

                    "publishedAt":
                        "2026-08-15T10:00:00Z",
                },
            },

            {
                "id": {
                    "videoId": "xyz789"
                },

                "snippet": {

                    "title":
                        "Deep Learning Tutorial",

                    "description":
                        "Learn deep learning.",

                    "channelTitle":
                        "AI Channel",

                    "publishedAt":
                        "2026-08-14T10:00:00Z",
                },
            },
        ]
    }

    # --------------------------------------------------------
    # Mock YouTube search request
    # --------------------------------------------------------

    class FakeSearchRequest:

        def execute(self):

            return fake_response

    class FakeSearch:

        def list(
            self,
            **kwargs
        ):

            # Verify API parameters

            assert kwargs["q"] == "machine learning"

            assert kwargs["part"] == "snippet"

            assert kwargs["type"] == "video"

            assert kwargs["maxResults"] == 5

            return FakeSearchRequest()

    # --------------------------------------------------------
    # Replace youtube.search()
    # --------------------------------------------------------

    class FakeYouTube:

        def search(self):

            return FakeSearch()

    monkeypatch.setattr(
        "app.tools.youtube_tools.youtube",
        FakeYouTube()
    )

    # --------------------------------------------------------
    # Call LangChain tool
    # --------------------------------------------------------

    result = search_youtube.invoke({

        "query":
            "machine learning",

        "max_results":
            5,
    })

    # --------------------------------------------------------
    # Assertions
    # --------------------------------------------------------

    assert len(result) == 2

    assert result[0]["video_id"] == "abc123"

    assert (
        result[0]["title"]
        ==
        "Machine Learning Tutorial"
    )

    assert (
        result[0]["channel"]
        ==
        "Test Channel"
    )

    assert (
        result[0]["url"]
        ==
        "https://www.youtube.com/watch?v=abc123"
    )


def test_search_youtube_empty_query():

    """
    Test that an empty query is rejected.
    """

    with pytest.raises(
        ValueError,
        match="query cannot be empty",
    ):

        search_youtube.invoke({

            "query":
                "",

            "max_results":
                5,
        })


def test_search_youtube_no_results(monkeypatch):
    """
    Test search when YouTube returns no videos.
    """

    class FakeRequest:

        def execute(self):

            return {
                "items": []
            }

    class FakeSearch:

        def list(self, **kwargs):

            return FakeRequest()

    class FakeYouTube:

        def search(self):

            return FakeSearch()

    monkeypatch.setattr(
        "app.tools.youtube_tools.youtube",
        FakeYouTube()
    )

    result = search_youtube.invoke({

        "query":
            "something that does not exist",

        "max_results":
            5,
    })

    assert result == []


# ============================================================
# GET VIDEO DETAILS TESTS
# ============================================================


def test_get_video_details_success(monkeypatch):
    """
    Test successful retrieval and parsing
    of video details.
    """

    fake_response = {

        "items": [

            {
                "snippet": {

                    "title":
                        "Python Tutorial",

                    "description":
                        "Learn Python.",

                    "channelTitle":
                        "Programming Channel",

                    "publishedAt":
                        "2026-08-15T10:00:00Z",
                },

                "statistics": {

                    "viewCount":
                        "100000",

                    "likeCount":
                        "5000",

                    "commentCount":
                        "300",
                },
            }
        ]
    }

    class FakeRequest:

        def execute(self):

            return fake_response

    class FakeVideos:

        def list(
            self,
            **kwargs
        ):

            assert kwargs["id"] == "abc123"

            assert (
                kwargs["part"]
                ==
                "snippet,statistics"
            )

            return FakeRequest()

    class FakeYouTube:

        def videos(self):

            return FakeVideos()

    monkeypatch.setattr(
        "app.tools.youtube_tools.youtube",
        FakeYouTube()
    )

    result = get_video_details.invoke({

        "video_id":
            "abc123"
    })

    assert result["success"] is True

    assert result["video_id"] == "abc123"

    assert (
        result["title"]
        ==
        "Python Tutorial"
    )

    assert (
        result["channel"]
        ==
        "Programming Channel"
    )

    assert (
        result["views"]
        ==
        "100000"
    )

    assert (
        result["likes"]
        ==
        "5000"
    )

    assert (
        result["comments"]
        ==
        "300"
    )

    assert (
        result["url"]
        ==
        "https://www.youtube.com/watch?v=abc123"
    )


def test_get_video_details_not_found(monkeypatch):
    """
    Test behavior when video does not exist.
    """

    class FakeRequest:

        def execute(self):

            return {
                "items": []
            }

    class FakeVideos:

        def list(self, **kwargs):

            return FakeRequest()

    class FakeYouTube:

        def videos(self):

            return FakeVideos()

    monkeypatch.setattr(
        "app.tools.youtube_tools.youtube",
        FakeYouTube()
    )

    result = get_video_details.invoke({

        "video_id":
            "invalid_video"
    })

    assert result["success"] is False

    assert (
        result["error"]
        ==
        "Video not found"
    )

    assert (
        result["video_id"]
        ==
        "invalid_video"
    )


def test_get_video_details_empty_video_id():

    """
    Test that empty video IDs are rejected.
    """

    with pytest.raises(
        ValueError,
        match="video_id cannot be empty",
    ):

        get_video_details.invoke({

            "video_id":
                ""
        })


# ============================================================
# TRANSCRIPT TESTS
# ============================================================


def test_get_video_transcript_english(monkeypatch):
    """
    Test successful English transcript retrieval.
    """

    # --------------------------------------------------------
    # Fake transcript snippet
    # --------------------------------------------------------

    class FakeSnippet:

        def __init__(self, text):

            self.text = text

    fake_transcript = [

        FakeSnippet(
            "Welcome to the Python tutorial."
        ),

        FakeSnippet(
            "Today we will learn Python."
        ),

        FakeSnippet(
            "Let's start with variables."
        ),
    ]

    # --------------------------------------------------------
    # Fake transcript API
    # --------------------------------------------------------

    class FakeTranscriptAPI:

        def fetch(
            self,
            video_id,
            languages
        ):

            assert video_id == "abc123"

            assert languages == ["en"]

            return fake_transcript

    monkeypatch.setattr(
        "app.tools.youtube_tools.YouTubeTranscriptApi",
        FakeTranscriptAPI
    )

    # --------------------------------------------------------
    # Call tool
    # --------------------------------------------------------

    result = get_video_transcript.invoke({

        "video_id":
            "abc123",

        "max_chars":
            5000,
    })

    # --------------------------------------------------------
    # Assertions
    # --------------------------------------------------------

    assert "[Language: en]" in result

    assert (
        "Welcome to the Python tutorial."
        in result
    )

    assert (
        "Today we will learn Python."
        in result
    )

    assert (
        "Let's start with variables."
        in result
    )


def test_get_video_transcript_hindi_fallback(
    monkeypatch
):
    """
    Test that Hindi is attempted when English
    transcript is unavailable.
    """

    class FakeSnippet:

        def __init__(self, text):

            self.text = text

    fake_transcript = [

        FakeSnippet(
            "Yeh Python ka tutorial hai."
        ),

        FakeSnippet(
            "Aaj hum Python seekhenge."
        ),
    ]

    class FakeTranscriptAPI:

        def fetch(
            self,
            video_id,
            languages
        ):

            # English fails

            if languages == ["en"]:

                raise Exception(
                    "English transcript unavailable"
                )

            # Hindi succeeds

            if languages == ["hi"]:

                return fake_transcript

            raise Exception(
                "Unexpected language"
            )

    monkeypatch.setattr(
        "app.tools.youtube_tools.YouTubeTranscriptApi",
        FakeTranscriptAPI
    )

    result = get_video_transcript.invoke({

        "video_id":
            "abc123",

        "max_chars":
            5000,
    })

    assert "[Language: hi]" in result

    assert (
        "Yeh Python ka tutorial hai."
        in result
    )

    assert (
        "Aaj hum Python seekhenge."
        in result
    )


def test_get_video_transcript_unavailable(
    monkeypatch
):
    """
    Test when neither English nor Hindi
    transcript is available.
    """

    class FakeTranscriptAPI:

        def fetch(
            self,
            video_id,
            languages
        ):

            raise Exception(
                "Transcript unavailable"
            )

    monkeypatch.setattr(
        "app.tools.youtube_tools.YouTubeTranscriptApi",
        FakeTranscriptAPI
    )

    result = get_video_transcript.invoke({

        "video_id":
            "abc123",

        "max_chars":
            5000,
    })

    assert (
        "Transcript unavailable"
        in result
    )


def test_get_video_transcript_truncation(
    monkeypatch
):
    """
    Test that a long transcript is truncated
    to max_chars.
    """

    class FakeSnippet:

        def __init__(self, text):

            self.text = text

    long_text = "A" * 5000

    fake_transcript = [

        FakeSnippet(
            long_text
        )
    ]

    class FakeTranscriptAPI:

        def fetch(
            self,
            video_id,
            languages
        ):

            return fake_transcript

    monkeypatch.setattr(
        "app.tools.youtube_tools.YouTubeTranscriptApi",
        FakeTranscriptAPI
    )

    result = get_video_transcript.invoke({

        "video_id":
            "abc123",

        "max_chars":
            100,
    })

    assert (
        "[Language: en]"
        in result
    )

    assert (
        "[TRANSCRIPT TRUNCATED]"
        in result
    )


def test_get_video_transcript_empty_video_id():

    """
    Test that an empty video ID returns
    a meaningful error.
    """

    result = get_video_transcript.invoke({

        "video_id":
            ""
    })

    assert (
        "video_id cannot be empty"
        in result
    )