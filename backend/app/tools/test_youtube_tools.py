"""
Real integration test for the YouTube transcript fetcher.

Tests the 3-layer fallback strategy against real YouTube videos:
  - Video with manual English transcript
  - Video with auto-generated English only  
  - Video with only Hindi auto-generated (no English)
  - Video with no transcript at all
  - The exact problematic video from production logs

Run from backend/ directory:
    python test_youtube_transcript.py
"""

import sys
import os

# Add the backend root to path so app.* imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load .env for YOUTUBE_API_KEY / GEMINI_API_KEY
from dotenv import load_dotenv
load_dotenv()

from app.tools.youtube_tools import _fetch_transcript_with_fallback, get_video_transcript

# ============================================================
# TEST CASES
# Real YouTube video IDs with known transcript situations
# ============================================================

TEST_CASES = [
    {
        "label": "Manual EN transcript (Python tutorial - freeCodeCamp)",
        "video_id": "rfscVS0vtbw",
        "expect": "success",
    },
    {
        "label": "Auto-generated EN captions (Tech talk / conference)",
        "video_id": "dQw4w9WgXcQ",   # Rick Astley - well known, has auto-gen captions
        "expect": "success",
    },
    {
        "label": "Production fail case: Hindi auto-gen only (Databricks video)",
        "video_id": "5LyiPsHQKmk",
        "expect": "any",   # Should be picked up by Layer 3
    },
    {
        "label": "Subtitles disabled by uploader (system design video)",
        "video_id": "OhCp6ppX6bg",
        "expect": "failure",   # Uploader has disabled subtitles — genuinely unavailable
    },
    {
        "label": "Known no-transcript / private video",
        "video_id": "aaaabbbbcccc",   # Invalid / non-existent
        "expect": "failure",
    },
]

# ============================================================
# RUN TESTS
# ============================================================

def run_tests():
    print()
    print("=" * 70)
    print("YOUTUBE TRANSCRIPT FETCHER — INTEGRATION TESTS")
    print("=" * 70)

    passed = 0
    failed = 0
    warnings = 0

    for i, tc in enumerate(TEST_CASES, start=1):
        video_id = tc["video_id"]
        label = tc["label"]
        expect = tc["expect"]

        print()
        print(f"[{i}/{len(TEST_CASES)}] {label}")
        print(f"        Video ID : {video_id}")
        print(f"        Expected : {expect}")
        print()

        text, lang = _fetch_transcript_with_fallback(video_id)

        if text and text.strip():
            chars = len(text)
            preview = text[:200].replace("\n", " ").encode("ascii", errors="replace").decode("ascii")
            print(f"        [PASS] Language: [{lang}]  Characters: {chars}")
            print(f"        Preview: \"{preview}...\"")

            if expect == "failure":
                print(f"        [WARN] UNEXPECTED SUCCESS (expected failure)")
                warnings += 1
            else:
                passed += 1
        else:
            print(f"        [FAIL] NO TRANSCRIPT — all 3 layers exhausted")

            if expect == "failure":
                print(f"        [PASS] Expected failure — correct")
                passed += 1
            else:
                print(f"        [WARN] UNEXPECTED FAILURE (expected {expect})")
                failed += 1

        print()
        print("-" * 70)

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------
    print()
    print("=" * 70)
    print("RESULTS SUMMARY")
    print("=" * 70)
    print(f"  Passed   : {passed}/{len(TEST_CASES)}")
    print(f"  Failed   : {failed}/{len(TEST_CASES)}")
    print(f"  Warnings : {warnings}")
    print()

    # Also test the full tool wrapper
    print("=" * 70)
    print("TOOL WRAPPER TEST: get_video_transcript (via LangChain @tool)")
    print("=" * 70)
    result = get_video_transcript.invoke({"video_id": "rfscVS0vtbw", "max_chars": 500})
    print(result[:600])
    print()

    if failed == 0:
        print("[ALL PASS] All integration tests passed.")
    else:
        print(f"[FAILURES] {failed} test(s) failed — check transcript layer logs above.")


if __name__ == "__main__":
    run_tests()
