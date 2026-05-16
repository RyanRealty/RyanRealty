#!/usr/bin/env python3
"""
Fetch forced alignment for pre-generated Tumalo VO MP3s.
Runs separately from VO generation to isolate the alignment API call.
"""

import os
import sys
import json
import requests
from pathlib import Path

env_path = Path(__file__).parent.parent.parent / ".env.local"
api_key = None
for line in env_path.read_text().splitlines():
    if line.startswith("ELEVENLABS_API_KEY="):
        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

OUT_DIR = Path("/Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/videos")

CASCADE_CREEK_PLAIN = """Tumalo, Oregon. Twelve minutes from downtown Bend.
Three Sisters Cascade views from nearly every room.
A creek runs through the two-point-two-eight acre lot.
Mature trees. Mountain shadows in the morning.
Three bedrooms. Three baths. Twenty-three twenty-five square feet. Built nineteen ninety-five.
Heated three-car garage. RV parking.
Listed at one million two hundred twenty-five thousand.
Nineteen four ninety-six Tumalo Reservoir Road."""

TUMALO_LIFE_PLAIN = """This is what life in Tumalo, Oregon looks like.
Twelve minutes from downtown Bend.
Float the Deschutes in the morning.
Walk to The Bite for tacos and live music.
Ski Mt. Bachelor in the winter.
Wake up to Cascade views.
Watch deer move through the trees in the evening.
Three bedrooms. Three baths. Two-point-two-eight acres at nineteen four ninety-six Tumalo Reservoir Road.
One million two hundred twenty-five thousand."""


def get_alignment(mp3_path: Path, plain_text: str, slug: str) -> dict:
    url = "https://api.elevenlabs.io/v1/forced-alignment"
    headers = {"xi-api-key": api_key}

    print(f"\n[{slug}] Sending to forced-alignment...")

    with open(mp3_path, "rb") as f:
        audio_bytes = f.read()

    # Try multipart with field name "file"
    import io
    files = {"file": (mp3_path.name, io.BytesIO(audio_bytes), "audio/mpeg")}
    data = {"text": plain_text}
    resp = requests.post(url, headers=headers, files=files, data=data)
    print(f"  Status: {resp.status_code}")

    if resp.status_code == 200:
        result = resp.json()
        words = result.get("words", [])
        print(f"  Words: {len(words)}")
        for w in words[:5]:
            print(f"    '{w.get('text', '')}' {w.get('start', 0):.3f}s — {w.get('end', 0):.3f}s")
        return result
    else:
        print(f"  ERROR: {resp.text[:400]}")
        # Try with "audio_file" field name
        files2 = {"audio_file": (mp3_path.name, io.BytesIO(audio_bytes), "audio/mpeg")}
        resp2 = requests.post(url, headers=headers, files=files2, data=data)
        print(f"  Retry status: {resp2.status_code}")
        if resp2.status_code == 200:
            result = resp2.json()
            print(f"  Words (retry): {len(result.get('words', []))}")
            return result
        else:
            print(f"  Retry error: {resp2.text[:300]}")
            # Return stub alignment based on audio duration
            return build_stub_alignment(plain_text, mp3_path)


def build_stub_alignment(plain_text: str, mp3_path: Path) -> dict:
    """Build a clock-time stub alignment when API fails — evenly spaces words."""
    import subprocess
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(mp3_path)],
        capture_output=True, text=True
    )
    duration = float(result.stdout.strip() or "30")

    words_raw = plain_text.split()
    n = len(words_raw)
    step = duration / max(n, 1)
    words = []
    for i, w in enumerate(words_raw):
        words.append({
            "text": w,
            "start": round(i * step, 3),
            "end": round((i + 1) * step, 3),
        })
    print(f"  Using stub alignment: {n} words over {duration:.2f}s")
    return {"words": words, "characters": [], "audio_file_url": ""}


def main():
    slugs = [
        ("cascade-and-creek", CASCADE_CREEK_PLAIN),
        ("tumalo-life", TUMALO_LIFE_PLAIN),
    ]

    for slug, plain in slugs:
        mp3_path = OUT_DIR / f"{slug}.vo.mp3"
        align_path = OUT_DIR / f"{slug}.alignment.json"

        if not mp3_path.exists():
            print(f"MISSING: {mp3_path}")
            continue

        result = get_alignment(mp3_path, plain, slug)
        align_path.write_text(json.dumps(result, indent=2))
        print(f"  Saved: {align_path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
