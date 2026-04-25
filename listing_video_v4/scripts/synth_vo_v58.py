#!/usr/bin/env python3
"""v5.8 viral cut VO. 4 short lines + reuse v56_s11 closing.

Per Cowork feedback_short_form_retention_rules: hook lands by 1.5s with text +
audible. No greetings. Body holds 2-3 info points (history, architect, closing).

Same voice settings as the rest, prosody chained with previous_text where
applicable so it sounds like one continuous take when stitched.
"""
import json, urllib.request, sys, subprocess
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio"

VOICE = "4YYIPFl9wE5c4L2eu2Gb"
MODEL = "eleven_multilingual_v2"


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


# Order matters — previous_text chains forward.
SCRIPT = [
    # Hook — first audible beat. No previous_text (first line of video).
    ("v58_hook",        "This one never hit the market.",                                                None),
    # History intro — the pattern interrupt at ~25s.
    ("v58_history",     "Eighteen ninety two. The Vandevert family came to four hundred acres.",        "This one never hit the market."),
    # Story payoff.
    ("v58_subdivision", "In nineteen seventy, twenty homes joined them on the land.",                    "Eighteen ninety two. The Vandevert family came to four hundred acres."),
    # Architect tag.
    ("v58_locati",      "Designed by Jerry Locati.",                                                     "In nineteen seventy, twenty homes joined them on the land."),
    # Closing line stays as v56_s11 (already on disk, prosody-chained from
    # the prior batch). Not re-synthed here.
]


def synth(slug, text, prev_text):
    out_path = OUT / f"{slug}.mp3"
    if out_path.exists():
        out_path.unlink()
    payload = {
        "text": text,
        "model_id": MODEL,
        "voice_settings": {"stability": 0.55, "similarity_boost": 0.85, "style": 0.0,
                            "use_speaker_boost": True, "speed": 0.88},
    }
    if prev_text:
        payload["previous_text"] = prev_text
    print(f"[synth] {slug} (prev={'yes' if prev_text else 'no'})", file=sys.stderr)
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}",
        data=json.dumps(payload).encode(),
        headers={"xi-api-key": KEY, "Content-Type": "application/json",
                  "Accept": "audio/mpeg", "User-Agent": "curl/8.4"},
    )
    resp = urllib.request.urlopen(req)
    out_path.write_bytes(resp.read())
    print(f"  -> {out_path.name} ({out_path.stat().st_size/1024:.0f}KB)", file=sys.stderr)


for slug, txt, prev in SCRIPT:
    synth(slug, txt, prev)

FFMPEG = "/Users/matthewryan/Library/Python/3.9/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
durations = {}
for slug, _, _ in SCRIPT:
    p = OUT / f"{slug}.mp3"
    if not p.exists():
        continue
    r = subprocess.run([FFMPEG, "-i", str(p)], capture_output=True, text=True)
    for line in r.stderr.split("\n"):
        if "Duration:" in line:
            t = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = t.split(":")
            durations[slug] = round(int(h) * 3600 + int(m) * 60 + float(s), 2)
            print(f"  {slug}: {durations[slug]}s", file=sys.stderr)
            break

(OUT / "vo_v58_durations.json").write_text(json.dumps(durations, indent=2))
