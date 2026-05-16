#!/usr/bin/env python3
"""Bend Policy Pulse — 3-part news series VO synth (Victoria, ElevenLabs).

Voice: Victoria — Ryan Realty Anchor (qSeXEcewz7tA0Q0qk9fH) — HARDCODED.
Model: eleven_turbo_v2_5.
Settings (canonical per CLAUDE.md, updated 2026-05-07):
  stability 0.40, similarity_boost 0.80, style 0.50, use_speaker_boost True.

Sources verified 2026-05-09:
  - BEDAB Jan 5 2026 meeting minutes:
    https://bendoregon.gov/wp-content/uploads/2026/01/For-Approval-01.05.2026-BEDAB-Meeting-Minutes.pdf
  - BEDAB Feb 2 2026 meeting minutes:
    https://bendoregon.gov/wp-content/uploads/2026/03/02.02.2026-BEDAB-Meeting-Minutes.pdf
  - City of Bend Electrification Policy page:
    https://bendoregon.gov/top-priorities/environment-and-climate/electrification-policy-options/

Every figure / claim traces to one of those three sources.
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio" / "bend_pulse"
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "qSeXEcewz7tA0Q0qk9fH"


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
        print(f"[skip] {slug} exists ({out_path.stat().st_size/1024:.0f}KB)", file=sys.stderr)
        return True
    payload = {
        "text": text,
        "model_id": model,
        "voice_settings": {
            "stability": 0.40,
            "similarity_boost": 0.80,
            "style": 0.50,
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
        resp = urllib.request.urlopen(req, timeout=60)
        out_path.write_bytes(resp.read())
        print(f"  -> {out_path.name} ({out_path.stat().st_size/1024:.0f}KB)", file=sys.stderr)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {e.code}: {body[:300]}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  ERROR {type(e).__name__}: {e}", file=sys.stderr)
        return False


# Numbers spelled out for ElevenLabs ingestion (per VIDEO_PRODUCTION_SKILL.md).
# No banned words (stunning, nestled, boasts, must-see, etc.).
# No em-dashes, no colons, no semicolons, no hyphens in prose.
# Every claim traces to a source in this file's docstring.
SCRIPTS = {
    # Part 1 — What Bend is actually proposing.
    # Numbers from Cassie Lacy's "Impacts of Fee Levels" slide, Feb 11 2026
    # Council Work Session: Low Fee $1,954 max per home, Reduced Fee $4,885,
    # Maximum Fee $9,771; housing cost impact 0.23 / 0.58 / 1.15 percent.
    "part1": [
        ("bp_p1_s01", "Bend is about to put a price on natural gas in your next new house."),
        ("bp_p1_s02", "It is called a climate pollution fee. It applies only to new residential construction."),
        ("bp_p1_s03", "On February eleventh, Council weighed three fee levels."),
        ("bp_p1_s04", "Low scenario, one thousand nine hundred fifty four dollars per home, max."),
        ("bp_p1_s05", "Maximum scenario, nine thousand seven hundred seventy one dollars per home."),
        ("bp_p1_s06", "City staff say that lands as a zero point two three to one point one five percent housing cost bump."),
        ("bp_p1_s07", "Existing homes are off the table. New single family, duplexes, townhouses, and ADUs only."),
    ],
    # Part 2 — Who is arguing what. BEDAB Jan 5 testimony + 8-0 vote +
    # Council's response (TCEP structure).
    "part2": [
        ("bp_p2_s01", "Three industries showed up at the Bend Economic Development Board in January."),
        ("bp_p2_s02", "Central Oregon Builders said a fee on new construction will get passed straight to the buyer."),
        ("bp_p2_s03", "The Bend Chamber of Commerce asked for a time limited pilot before any fee goes live."),
        ("bp_p2_s04", "Plumbers and steamfitters union flagged grid capacity at Pacific Power."),
        ("bp_p2_s05", "The board voted eight to zero, asking Council for that pilot."),
        ("bp_p2_s06", "Chair Gary North said the social cost of unaffordable housing is greater than the social cost of carbon."),
        ("bp_p2_s07", "Council heard them. Created a Temporary Committee on Electrification Policy. Four advisory bodies, one table."),
    ],
    # Part 3 — The dates that decide it.
    "part3": [
        ("bp_p3_s01", "Three dates worth putting on your calendar."),
        ("bp_p3_s02", "Late May or early June, the public hearing on the fee at Bend City Council."),
        ("bp_p3_s03", "June third is the first reading of the ordinance."),
        ("bp_p3_s04", "June seventeenth is the second reading. After that, it becomes law."),
        ("bp_p3_s05", "The earliest possible start date for the fee is April first, twenty twenty seven."),
        ("bp_p3_s06", "Bend City Hall, seven ten northwest Wall Street. Attend in person or watch online."),
    ],
}


def main():
    ok = 0
    fail = 0
    for part_key, sentences in SCRIPTS.items():
        prev = ""
        for slug, text in sentences:
            if synth(slug, text, prev_text=prev):
                ok += 1
            else:
                fail += 1
            prev = text
    print(f"\nDone: {ok} ok, {fail} fail", file=sys.stderr)
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
