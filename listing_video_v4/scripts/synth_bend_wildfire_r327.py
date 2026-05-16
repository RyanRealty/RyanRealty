#!/usr/bin/env python3
"""Bend Wildfire R-327 news clip — Victoria VO synth + forced-alignment.

Synthesizes 11 short Victoria bridges with previous_text chaining for prosody
continuity, then calls /v1/forced-alignment for word-level caption timestamps.

Voice settings (canonical per video_production_skills/elevenlabs_voice/SKILL.md):
  Victoria qSeXEcewz7tA0Q0qk9fH, eleven_turbo_v2_5,
  stability 0.40, similarity_boost 0.80, style 0.50, speaker_boost True.

Numbers are spelled out per ElevenLabs ingestion rules. No banned words.
No em-dashes, no semicolons, no hyphens-in-prose.
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio" / "bend_wildfire_r327"
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "qSeXEcewz7tA0Q0qk9fH"


def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


KEY = load_env(Path("/Users/matthewryan/RyanRealty/.env.local"))["ELEVENLABS_API_KEY"]


# Bridge lines (slug → text). Order matters: previous_text chains forward for
# prosody continuity. Each line is one beat in the composition.
BRIDGES = {
    "b1_hook":      "A government burn just escaped fourteen miles from Bend.",
    "b2_acres":     "Twenty five hundred acres on Pine Mountain. Smoke over town.",
    "b3_started":   "Started Thursday when a Forest Service prescribed burn hit conditions they did not expect.",
    "b4_contained": "Seventy percent contained this morning.",
    "b5_pivot":     "Here is what nobody is talking about.",
    "b6_code":      "In five days, every new house Bend builds has to follow Section R three twenty seven.",
    "b7_what":      "Ignition resistant siding. Hardened roofing. Sealed vents.",
    "b8_sisters":   "Sisters has it. Deschutes County has it. Bend joins them May fifteenth.",
    "b9_new_only":  "But only new permits.",
    "b10_smoke":    "Existing homes just get the smoke.",
    "b11_cta":      "What would you spend to harden yours?",
}


def synth(slug: str, text: str, prev_text: str = "") -> bool:
    out_path = OUT / f"{slug}.mp3"
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip-synth] {slug}", file=sys.stderr)
        return True
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
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


def align(slug: str, text: str) -> bool:
    mp3 = OUT / f"{slug}.mp3"
    out_path = OUT / f"{slug}.alignment.json"
    if not mp3.exists():
        print(f"[skip-align] {slug} mp3 missing", file=sys.stderr)
        return False
    if out_path.exists() and out_path.stat().st_size > 256:
        print(f"[skip-align] {slug} already aligned", file=sys.stderr)
        return True

    print(f"[align] {slug} ...", file=sys.stderr)
    boundary = "----alignmentboundarywf2026"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="file"; filename="' + mp3.name.encode() + b'"\r\n'
    body += b"Content-Type: audio/mpeg\r\n\r\n"
    body += mp3.read_bytes()
    body += b"\r\n"
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="text"\r\n\r\n'
    body += text.encode()
    body += b"\r\n"
    body += f"--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/forced-alignment",
        data=body,
        headers={
            "xi-api-key": KEY,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {e.code}: {body_err[:300]}", file=sys.stderr)
        return False

    words = []
    for w in data.get("words", []):
        words.append({
            "text": w.get("text", "").strip(),
            "startSec": round(float(w.get("start", 0.0)), 3),
            "endSec": round(float(w.get("end", 0.0)), 3),
        })
    out = {"words": words}
    out_path.write_text(json.dumps(out, indent=2))
    print(f"  -> {out_path.name} ({len(words)} words)", file=sys.stderr)
    return True


def main():
    # Phase 1: synth all bridges with previous_text chaining
    ok_synth, fail_synth = 0, 0
    prev = ""
    for slug, text in BRIDGES.items():
        if synth(slug, text, prev_text=prev):
            ok_synth += 1
        else:
            fail_synth += 1
        prev = text
    print(f"\n[synth] {ok_synth} ok, {fail_synth} fail", file=sys.stderr)
    if fail_synth > 0:
        return 1

    # Phase 2: forced-alignment on every successfully-synthesized clip
    ok_align, fail_align = 0, 0
    for slug, text in BRIDGES.items():
        if align(slug, text):
            ok_align += 1
        else:
            fail_align += 1
    print(f"[align] {ok_align} ok, {fail_align} fail", file=sys.stderr)

    return 0 if (fail_synth == 0 and fail_align == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
