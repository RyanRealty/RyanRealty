#!/usr/bin/env python3
"""v5.3 VO: re-synth the 6 sentences that changed between v5.1 and v5.3.

Changes vs v5.1:
- v53_s03a: drops sheep dipping reference, splits ranch life into two beats
- v53_s03b: bridge / family-life beat, replaces sheep_dip beat
- v53_s04: tightened Locati-bridge sentence
- v53_s05b: NEW short poetic line about the home itself
- v53_s09: 'meadow' -> 'river' to match the elk-fording-river photo
- v53_s10: phonetic respelling of Deschutes ('duh-SHOOTS') + 'Trout fill the streams'

Existing v51_s* sentences (s01, s02, s05, s06, s07, s08, s11) stay identical.
"""
import json, urllib.request, sys, subprocess
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "4YYIPFl9wE5c4L2eu2Gb"
MODEL = "eleven_multilingual_v2"

# Only the sentences that changed.
SENTENCES = {
    # Beat 4 surrey — drops sheep_dip mention, frames ranch operations cleanly
    "v53_s03a": "They moved by surrey, and ran sheep and cattle through the seasons.",
    # Beat 5 footbridge — replaces sheep_dip beat, locks the ranch-life thread
    "v53_s03b": "And the children kept their days at the river, until the family sold the land in nineteen seventy.",
    # Beat 6 barn — tightened from the v5.2 long version
    "v53_s04": "A century later, twenty homes share these four hundred acres.",
    # Beat 9 hero exterior — short poetic anchor between Locati and the spec line
    "v53_s05b": "Built to wear in.",
    # Beat 18 elk fording the Little Deschutes — was 'meadow', now 'river' to match photo
    "v53_s09": "The elk still cross the river at dawn.",
    # Beat 20 Snowdrift — phonetic respelling of Deschutes, plus 'trout fill the streams'
    # Try with hyphenated phonetic. Will validate by listening; can swap to plain
    # 'Deschutes' if synth handles it correctly natively.
    "v53_s10": "Trout fill the streams. The Little duh-shoots still runs cold and clear past the old homestead.",
}


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

for slug, txt in SENTENCES.items():
    out_path = OUT / f"{slug}.mp3"
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip] {slug} exists", file=sys.stderr)
        continue
    payload = {
        "text": txt,
        "model_id": MODEL,
        "voice_settings": {
            "stability": 0.55,
            "similarity_boost": 0.85,
            "style": 0.0,
            "use_speaker_boost": True,
            "speed": 0.88,
        },
    }
    print(f"[synth] {slug} ({len(txt)} chars)", file=sys.stderr)
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
        resp = urllib.request.urlopen(req)
        out_path.write_bytes(resp.read())
        print(f"  -> {out_path.name} ({out_path.stat().st_size/1024:.0f}KB)", file=sys.stderr)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {e.code}: {body[:300]}", file=sys.stderr)
        sys.exit(1)

# Probe durations
FFMPEG = "/Users/matthewryan/Library/Python/3.9/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
print("\n[durations]", file=sys.stderr)
v53_durations = {}
# Include existing v51 durations if present
existing = json.loads((OUT / "vo_v51_durations.json").read_text()) if (OUT / "vo_v51_durations.json").exists() else {}
all_files = list(SENTENCES.keys()) + list(existing.keys())
for slug in all_files:
    p = OUT / f"{slug}.mp3"
    if not p.exists():
        continue
    r = subprocess.run([FFMPEG, "-i", str(p)], capture_output=True, text=True)
    for line in r.stderr.split("\n"):
        if "Duration:" in line:
            t = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = t.split(":")
            sec = int(h) * 3600 + int(m) * 60 + float(s)
            v53_durations[slug] = round(sec, 2)
            print(f"  {slug}: {sec:.2f}s", file=sys.stderr)
            break

(OUT / "vo_v53_durations.json").write_text(json.dumps(v53_durations, indent=2))
print(f"\n[manifest] {OUT}/vo_v53_durations.json", file=sys.stderr)
