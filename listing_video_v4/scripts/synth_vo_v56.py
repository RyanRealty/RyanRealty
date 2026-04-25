#!/usr/bin/env python3
"""v5.6 VO: re-synth ONLY the sentences that needed to change for tone match
+ Deschutes pronunciation. Keeps the v51_*, v53_*, v54_s03b/s06b sentences
that already sound consistent. Re-synths s04, s05, s05b, s06, s06c, s10, s11
with previous_text chaining so prosody flows continuously.

Goal: closing line "We were honored to be a part of it" should match the rest
of the VO (was synthed differently in v5.5 and Matt called the audio out).
"""
import json, urllib.request, sys, subprocess
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

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


# Full VO script in narrative order (slug, text, beats notes).
# previous_text is auto-chained from the prior entry so the model has
# prosody continuity across sentences.
SCRIPT = [
    ("v51_s01",  "In eighteen ninety two, William Vandevert came up from Texas with a wife named Sadie. They raised eight children on this land.",            None),
    ("v51_s02",  "Three of those children became doctors.",                                                                                                  None),
    ("v53_s03a", "They moved by surrey, and ran sheep and cattle through the seasons.",                                                                       None),
    ("v54_s03b", "And the children kept their days at the river.",                                                                                            None),
    ("v56_s04",  "In nineteen seventy, the ranch was subdivided into a community of twenty custom homes.",                                                     "resynth"),
    ("v56_s05",  "This one was designed by Jerry Locati, who works in steel, and stone, and timber, the way the West actually wears them.",                    "resynth"),
    ("v56_s05b", "Made to wear in.",                                                                                                                            "resynth"),
    ("v56_s06",  "Completed in twenty seventeen. Four bedrooms, four and a half baths. Every west-facing window holds the Cascades.",                          "resynth"),
    ("v56_s06c", "Vaulted timber ceilings. Hand-finished cabinetry. The craft shows in every room.",                                                            "resynth"),
    ("v54_s06b", "The home itself is a looking glass on the West.",                                                                                             None),
    ("v51_s07",  "A sunroom that watches the seasons turn over the pond.",                                                                                      None),
    ("v51_s08",  "A fireplace under cover, where the day ends.",                                                                                                None),
    ("v53_s09",  "The elk still cross the river at dawn.",                                                                                                      None),
    # s10: literal "Deschutes" on multilingual_v2 — model knows the Oregon place
    # name natively. If still wrong, fallback later. previous_text gives prosody.
    ("v56_s10",  "Trout still fill the Little Deschutes, cold and clear past the old homestead.",                                                                "resynth"),
    # s11 carries previous_text=s10 so the closing tone matches.
    ("v56_s11",  "We were honored to be a part of it.",                                                                                                          "resynth"),
]


def synth(slug, text, previous_text=None, next_text=None):
    out_path = OUT / f"{slug}.mp3"
    payload = {
        "text": text,
        "model_id": MODEL,
        "voice_settings": {"stability": 0.55, "similarity_boost": 0.85, "style": 0.0,
                            "use_speaker_boost": True, "speed": 0.88},
    }
    if previous_text:
        payload["previous_text"] = previous_text
    if next_text:
        payload["next_text"] = next_text
    print(f"[synth] {slug} (prev={'yes' if previous_text else 'no'})", file=sys.stderr)
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


# Walk the script. Re-synth only those marked "resynth", chaining previous_text
# from the prior sentence's text in the script.
prev = None
for i, (slug, txt, mode) in enumerate(SCRIPT):
    if mode == "resynth":
        next_txt = SCRIPT[i + 1][1] if i + 1 < len(SCRIPT) else None
        synth(slug, txt, previous_text=prev, next_text=next_txt)
    prev = txt

# Probe durations
FFMPEG = "/Users/matthewryan/Library/Python/3.9/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
durations = {}
for slug, _, mode in SCRIPT:
    if mode != "resynth":
        continue
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

(OUT / "vo_v56_durations.json").write_text(json.dumps(durations, indent=2))
