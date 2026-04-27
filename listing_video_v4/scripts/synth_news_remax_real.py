#!/usr/bin/env python3
"""News clip VO — RE/MAX + Real Brokerage merger, ElevenLabs, prosody-chained.

Voice: Ellen (BIvP0GN1cAtSRTxNHnWS) — news anchor, declarative, paced.
Settings: stability 0.55, similarity_boost 0.85, style 0.15, speaker_boost True.
Each sentence chains previous_text from same clip for prosody continuity.

Source for every figure (cited in companion citations.json):
  - $880M deal value: Inman 2026-04-27, BusinessWire press release 2026-04-26
  - Real Brokerage acquires RE/MAX Holdings: same
  - Real REMAX Group: new holding company name, HQ Miami, ticker REAX (Nasdaq)
  - 180,000 agents combined / 120 countries: BusinessWire press release
  - 145,000 RE/MAX agents + 33,000 Real agents: HousingWire, BusinessWire
  - $13.80 cash or 5.152 shares per RMAX share: Inman, BusinessWire
  - $30M annual run-rate cost synergies: BusinessWire, NMP
  - Closing H2 2026: BusinessWire
  - Tamir Poleg as Chairman/CEO: BusinessWire, RealEstateNews
"""
import json, urllib.request, sys
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "BIvP0GN1cAtSRTxNHnWS"  # Ellen — news anchor


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


def synth(slug: str, text: str, prev_text: str = "", model: str = "eleven_multilingual_v2") -> bool:
    out_path = OUT / f"{slug}.mp3"
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip] {slug} exists", file=sys.stderr)
        return True
    payload = {
        "text": text,
        "model_id": model,
        "voice_settings": {
            "stability": 0.55,
            "similarity_boost": 0.85,
            "style": 0.15,
            "use_speaker_boost": True,
            "speed": 0.95,
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
        resp = urllib.request.urlopen(req)
        out_path.write_bytes(resp.read())
        print(f"  -> {out_path.name} ({out_path.stat().st_size/1024:.0f}KB)", file=sys.stderr)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {e.code}: {body[:300]}", file=sys.stderr)
        return False


# Numbers spelled out per ANTI_SLOP_MANIFESTO Rule 3 — ElevenLabs reads digits
# unreliably. "RE/MAX" rendered as "REMAX" (the model says it correctly).
# Six sentences for the 45s build target with natural inter-sentence pauses.
# Captions in ClipRemaxRealMerger.tsx are tightened summaries of these full
# spoken lines — VO tells the story, captions reinforce key claims.
SENTENCES = [
    ("news_merger_s01",
     "Two of the biggest names in real estate just merged."),
    ("news_merger_s02",
     "Real Brokerage is buying RE/MAX in an eight hundred eighty million dollar deal."),
    ("news_merger_s03",
     "The combined company will have over one hundred eighty thousand agents in more than one hundred twenty countries."),
    ("news_merger_s04",
     "The new company is called Real REMAX Group, headquartered in Miami."),
    ("news_merger_s05",
     "It's the biggest brokerage consolidation in years. Tech meets tradition."),
    ("news_merger_s06",
     "Bigger company. Same closing table for you in Bend."),
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
        prev = text  # chain prosody
    print(f"\nDone: {ok} ok, {fail} fail")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
