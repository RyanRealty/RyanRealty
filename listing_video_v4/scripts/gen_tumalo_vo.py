#!/usr/bin/env python3
"""
Generate ElevenLabs VO + forced alignment for two Tumalo listing videos:
  - cascade-and-creek (V2)
  - tumalo-life (V8)

Voice: Victoria, ID qSeXEcewz7tA0Q0qk9fH
Model: eleven_v3 (IPA phoneme tags for Tumalo + Deschutes)
Settings: stability 0.40, similarity_boost 0.80, style 0.50, use_speaker_boost True

CLAUDE.md note: eleven_v3 is required because scripts contain IPA phoneme tags.
Forced alignment is called immediately after each MP3 generation.
"""

import os
import sys
import json
import re
import requests
from pathlib import Path

# ── Config ───────────────────────────────────────────────────────────────────

VOICE_ID = "qSeXEcewz7tA0Q0qk9fH"
MODEL_ID = "eleven_v3"  # Required: IPA phoneme tags in script
VOICE_SETTINGS = {
    "stability": 0.40,
    "similarity_boost": 0.80,
    "style": 0.50,
    "use_speaker_boost": True,
}

# Load API key from .env.local
env_path = Path(__file__).parent.parent.parent / ".env.local"
api_key = None
for line in env_path.read_text().splitlines():
    if line.startswith("ELEVENLABS_API_KEY="):
        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

if not api_key:
    print("ERROR: ELEVENLABS_API_KEY not found in .env.local")
    sys.exit(1)

print(f"API key loaded: {api_key[:8]}...{api_key[-4:]}")

# Output directory
OUT_DIR = Path("/Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/videos")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── VO Scripts ───────────────────────────────────────────────────────────────
# NOTE: eleven_v3 uses SSML phoneme tags.
# The "plain" version (for forced alignment) must have tags stripped.
# Numbers spelled out for ElevenLabs ingestion.
#
# IPA: Tumalo = ˈtʌm.ə.loʊ, Deschutes = dəˈʃuːts

CASCADE_CREEK_SSML = """<speak>
<phoneme alphabet="ipa" ph="ˈtʌm.ə.loʊ">Tumalo</phoneme>, Oregon. Twelve minutes from downtown Bend.

Three Sisters Cascade views from nearly every room.

A creek runs through the two-point-two-eight acre lot.

Mature trees. Mountain shadows in the morning.

Three bedrooms. Three baths. Twenty-three twenty-five square feet. Built nineteen ninety-five.

Heated three-car garage. RV parking.

Listed at one million two hundred twenty-five thousand.

Nineteen four ninety-six <phoneme alphabet="ipa" ph="ˈtʌm.ə.loʊ">Tumalo</phoneme> Reservoir Road.
</speak>"""

CASCADE_CREEK_PLAIN = """Tumalo, Oregon. Twelve minutes from downtown Bend.

Three Sisters Cascade views from nearly every room.

A creek runs through the two-point-two-eight acre lot.

Mature trees. Mountain shadows in the morning.

Three bedrooms. Three baths. Twenty-three twenty-five square feet. Built nineteen ninety-five.

Heated three-car garage. RV parking.

Listed at one million two hundred twenty-five thousand.

Nineteen four ninety-six Tumalo Reservoir Road."""

TUMALO_LIFE_SSML = """<speak>
This is what life in <phoneme alphabet="ipa" ph="ˈtʌm.ə.loʊ">Tumalo</phoneme>, Oregon looks like.

Twelve minutes from downtown Bend.

Float the <phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme> in the morning.

Walk to The Bite for tacos and live music.

Ski Mt. Bachelor in the winter.

Wake up to Cascade views.

Watch deer move through the trees in the evening.

Three bedrooms. Three baths. Two-point-two-eight acres at nineteen four ninety-six <phoneme alphabet="ipa" ph="ˈtʌm.ə.loʊ">Tumalo</phoneme> Reservoir Road.

One million two hundred twenty-five thousand.
</speak>"""

TUMALO_LIFE_PLAIN = """This is what life in Tumalo, Oregon looks like.

Twelve minutes from downtown Bend.

Float the Deschutes in the morning.

Walk to The Bite for tacos and live music.

Ski Mt. Bachelor in the winter.

Wake up to Cascade views.

Watch deer move through the trees in the evening.

Three bedrooms. Three baths. Two-point-two-eight acres at nineteen four ninety-six Tumalo Reservoir Road.

One million two hundred twenty-five thousand."""


# ── Helpers ──────────────────────────────────────────────────────────────────

def generate_vo(ssml_text: str, plain_text: str, slug: str) -> Path:
    """Generate VO MP3 using ElevenLabs eleven_v3 (IPA phoneme support)."""
    mp3_path = OUT_DIR / f"{slug}.vo.mp3"
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }

    # eleven_v3 accepts SSML with phoneme tags
    payload = {
        "text": ssml_text,
        "model_id": MODEL_ID,
        "voice_settings": VOICE_SETTINGS,
    }

    print(f"\n[{slug}] Generating VO via ElevenLabs {MODEL_ID}...")
    resp = requests.post(url, headers=headers, json=payload)

    if resp.status_code != 200:
        print(f"ERROR {resp.status_code}: {resp.text[:500]}")
        sys.exit(1)

    mp3_path.write_bytes(resp.content)
    print(f"  VO saved: {mp3_path} ({len(resp.content):,} bytes)")
    return mp3_path


def get_forced_alignment(mp3_path: Path, plain_text: str, slug: str) -> Path:
    """Get word-level timestamps via ElevenLabs forced alignment."""
    align_path = OUT_DIR / f"{slug}.alignment.json"
    url = "https://api.elevenlabs.io/v1/forced-alignment"
    headers = {"xi-api-key": api_key}

    print(f"\n[{slug}] Fetching forced alignment...")
    with open(mp3_path, "rb") as f:
        files = {"file": (mp3_path.name, f, "audio/mpeg")}
        data = {"text": plain_text}
        resp = requests.post(url, headers=headers, files=files, data=data)

    if resp.status_code != 200:
        print(f"ERROR {resp.status_code}: {resp.text[:500]}")
        # Write empty alignment so render can proceed with fallback
        fallback = {"words": [], "characters": [], "audio_file_url": ""}
        align_path.write_text(json.dumps(fallback, indent=2))
        print(f"  WARNING: Using empty fallback alignment")
        return align_path

    result = resp.json()
    align_path.write_text(json.dumps(result, indent=2))
    word_count = len(result.get("words", []))
    print(f"  Alignment saved: {align_path} ({word_count} words)")

    # Print first few words for verification
    words = result.get("words", [])
    for w in words[:5]:
        print(f"    '{w.get('text', '')}' {w.get('start', 0):.3f}s — {w.get('end', 0):.3f}s")

    return align_path


def get_audio_duration(mp3_path: Path) -> float:
    """Get MP3 duration using ffprobe."""
    import subprocess
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(mp3_path)],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except:
        return 0.0


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Tumalo VO Generation — cascade-and-creek + tumalo-life")
    print("=" * 60)

    # Video 1: Cascade & Creek
    cc_mp3 = generate_vo(CASCADE_CREEK_SSML, CASCADE_CREEK_PLAIN, "cascade-and-creek")
    cc_dur = get_audio_duration(cc_mp3)
    print(f"  Duration: {cc_dur:.2f}s")
    cc_align = get_forced_alignment(cc_mp3, CASCADE_CREEK_PLAIN, "cascade-and-creek")

    # Video 2: Tumalo Life
    tl_mp3 = generate_vo(TUMALO_LIFE_SSML, TUMALO_LIFE_PLAIN, "tumalo-life")
    tl_dur = get_audio_duration(tl_mp3)
    print(f"  Duration: {tl_dur:.2f}s")
    tl_align = get_forced_alignment(tl_mp3, TUMALO_LIFE_PLAIN, "tumalo-life")

    print("\n" + "=" * 60)
    print("VO GENERATION COMPLETE")
    print(f"  cascade-and-creek.vo.mp3  → {cc_dur:.2f}s")
    print(f"  tumalo-life.vo.mp3        → {tl_dur:.2f}s")
    print("=" * 60)

    # Return durations for use in Remotion comps
    result = {
        "cascade_and_creek": {"duration_sec": cc_dur, "mp3": str(cc_mp3), "alignment": str(cc_align)},
        "tumalo_life": {"duration_sec": tl_dur, "mp3": str(tl_mp3), "alignment": str(tl_align)},
    }

    summary_path = OUT_DIR / "_vo_summary.json"
    summary_path.write_text(json.dumps(result, indent=2))
    print(f"\nSummary written: {summary_path}")
    return result


if __name__ == "__main__":
    main()
