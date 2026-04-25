#!/usr/bin/env python3
"""v5.5 VO: 7 sentences re-synthed or new per Matt's v5.4 review.

Changes:
- v55_s04: factual subdivision line, no "century later" metaphor
- v55_s05: "builds with" -> "works in" (kill "build" repetition)
- v55_s05b: "Built to wear in" -> "Made to wear in"
- v55_s06: "Built in 2017" -> "Completed in 2017", Cascade line reworked
- v55_s06c (NEW): premier finishes line on the dining/kitchen beat
- v55_s10: smoother flow, Deschutes pronounced via phoneme attempt
- v55_s11: closing line replaced with humble "honored to be part" register

Deschutes pronunciation strategy:
- Try eleven_v3 model with SSML phoneme tag `<phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme>`
- Fallback if v3 errors: eleven_multilingual_v2 with literal "Deschutes" (model
  may know the Oregon place name natively)
- Last resort: phonetic respelling "duh-shoots"
"""
import json, urllib.request, sys, subprocess
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "4YYIPFl9wE5c4L2eu2Gb"


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


def synth(slug: str, text: str, model: str = "eleven_multilingual_v2") -> bool:
    out_path = OUT / f"{slug}.mp3"
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip] {slug} exists", file=sys.stderr)
        return True
    payload = {
        "text": text,
        "model_id": model,
        "voice_settings": {"stability": 0.55, "similarity_boost": 0.85, "style": 0.0,
                            "use_speaker_boost": True, "speed": 0.88},
    }
    print(f"[synth model={model}] {slug}", file=sys.stderr)
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}",
        data=json.dumps(payload).encode(),
        headers={"xi-api-key": KEY, "Content-Type": "application/json",
                  "Accept": "audio/mpeg", "User-Agent": "curl/8.4"},
    )
    try:
        resp = urllib.request.urlopen(req)
        out_path.write_bytes(resp.read())
        print(f"  -> {out_path.name} ({out_path.stat().st_size/1024:.0f}KB)", file=sys.stderr)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {e.code}: {body[:300]}", file=sys.stderr)
        return False


# Sentences: (slug, text, preferred model)
SENTENCES = [
    ("v55_s04",  "In nineteen seventy, the ranch was subdivided into a community of twenty custom homes.",
                 "eleven_multilingual_v2"),
    ("v55_s05",  "This one was designed by Jerry Locati, who works in steel, and stone, and timber, "
                 "the way the West actually wears them.",
                 "eleven_multilingual_v2"),
    ("v55_s05b", "Made to wear in.",
                 "eleven_multilingual_v2"),
    ("v55_s06",  "Completed in twenty seventeen. Four bedrooms, four and a half baths. "
                 "Every west-facing window holds the Cascades.",
                 "eleven_multilingual_v2"),
    ("v55_s06c", "Vaulted timber ceilings. Hand-finished cabinetry. The craft shows in every room.",
                 "eleven_multilingual_v2"),
    # s10: try v3 model first with phoneme tag
    ("v55_s10",  "Trout still fill the Little "
                 "<phoneme alphabet=\"ipa\" ph=\"dəˈʃuːts\">Deschutes</phoneme>, "
                 "cold and clear past the old homestead.",
                 "eleven_v3"),
    ("v55_s11",  "We were honored to be a part of it.",
                 "eleven_multilingual_v2"),
]

for slug, txt, model in SENTENCES:
    ok = synth(slug, txt, model)
    if not ok and model == "eleven_v3":
        # v3 model unavailable / failed — fall back to multilingual_v2 with literal Deschutes
        print(f"  fallback: trying eleven_multilingual_v2 with literal text", file=sys.stderr)
        fallback_txt = ("Trout still fill the Little Deschutes, "
                         "cold and clear past the old homestead.")
        synth(slug, fallback_txt, "eleven_multilingual_v2")

# Probe durations
FFMPEG = "/Users/matthewryan/Library/Python/3.9/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
durations = {}
for slug, _, _ in SENTENCES:
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

(OUT / "vo_v55_durations.json").write_text(json.dumps(durations, indent=2))
