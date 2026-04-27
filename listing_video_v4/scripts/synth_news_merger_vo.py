#!/usr/bin/env python3
"""News clip VO — RE/MAX + Real Brokerage merger, ElevenLabs prosody-chained.

Voice: Victoria — Ryan Realty Anchor (qSeXEcewz7tA0Q0qk9fH).
Model: eleven_turbo_v2_5. Settings: stability 0.50, similarity_boost 0.75,
style 0.35, speaker_boost True.
Voice locked 2026-04-27 — Victoria is the permanent voice.

Each sentence chains previous_text from the prior line for prosody
continuity per ANTI_SLOP_MANIFESTO.md Rule 3 + VIDEO_PRODUCTION_SKILL.md
§7.2.

Pronunciation overrides (input string is what we actually send to
ElevenLabs):
  - "RE/MAX" → "Remax"  (the slash trips multilingual_v2 cadence)
  - "$880M" → "eight hundred eighty million dollar"
  - "180,000" → "one hundred eighty thousand"
  - "120" → "one hundred twenty"
  - "H2 2026" → not in script
"""
import json, urllib.request, urllib.error, sys
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "qSeXEcewz7tA0Q0qk9fH"  # Victoria — Ryan Realty Anchor (HARDCODED, NOT from env)


def load_env(path):
    env = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


env = load_env(Path("/Users/matthewryan/RyanRealty/.env.local"))
KEY = env["ELEVENLABS_API_KEY"]


def synth(slug: str, text: str, prev_text: str = "", model: str = "eleven_turbo_v2_5") -> bool:
    out_path = OUT / f"{slug}.mp3"
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip] {slug} exists", file=sys.stderr)
        return True
    payload = {
        "text": text,
        "model_id": model,
        "voice_settings": {
            "stability": 0.50,
            "similarity_boost": 0.75,
            "style": 0.35,
            "use_speaker_boost": True,
        },
    }
    if prev_text:
        payload["previous_text"] = prev_text
    print(f"[synth] {slug} ({len(text)} chars)", file=sys.stderr)
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}",
        data=json.dumps(payload).encode(),
        headers={
            "xi-api-key": KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
            "User-Agent": "curl/8.4",
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        out_path.write_bytes(resp.read())
        print(f"  -> {out_path.name} ({out_path.stat().st_size/1024:.0f}KB)", file=sys.stderr)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {e.code}: {body[:300]}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  EXC: {e}", file=sys.stderr)
        return False


# Script for the merger clip. Five sentences, prosody-chained.
SENTENCES = [
    ("news_merger_s01", "Two of the biggest names in real estate just merged."),
    ("news_merger_s02", "Real Brokerage is buying Remax in an eight hundred eighty million dollar deal."),
    ("news_merger_s03", "The combined company will have over one hundred eighty thousand agents in more than one hundred twenty countries."),
    ("news_merger_s04", "It's the biggest brokerage consolidation the industry has seen in years."),
    ("news_merger_s05", "Bigger company. Same closing table for you in Bend."),
]


def main():
    ok = 0
    fail = 0
    prev = ""
    for slug, text in SENTENCES:
        if synth(slug, text, prev_text=prev):
            ok += 1
        else:
            fail += 1
        prev = text
    print(f"\nDone: {ok} ok, {fail} fail")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
